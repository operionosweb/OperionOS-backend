import { assertOrganizationScope } from "../../../repositories/phase3/scope.js";
import { createSearchChunkRepository } from "../../../repositories/phase3/searchChunkRepository.js";
import { answerContractQuestion } from "./contractAssistantService.js";

function assistantError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function sourceLocator(result) {
  if (Number.isInteger(result.pageStart) && Number.isInteger(result.pageEnd) && result.pageStart !== result.pageEnd) {
    return `pages ${result.pageStart}-${result.pageEnd}`;
  }
  if (Number.isInteger(result.pageStart)) return `page ${result.pageStart}`;
  if (Number.isInteger(result.page_number)) return `page ${result.page_number}`;
  if (Number.isInteger(result.charStart) && Number.isInteger(result.charEnd)) {
    return `characters ${result.charStart}-${result.charEnd}`;
  }
  if (Number.isInteger(result.char_start) && Number.isInteger(result.char_end)) {
    return `characters ${result.char_start}-${result.char_end}`;
  }
  return null;
}

const MAX_SUPPLEMENTAL_CITATIONS = 24;
const MAX_FINANCIAL_FINDINGS = 8;
const MAX_RECOMMENDATIONS = 8;
const MAX_AIRCRAFT_RELATIONSHIPS = 8;

function questionNeedsFinancialIntelligence(question) {
  return /\b(financial|payment|rent|reserve|escalat|cpi|currency|amount|exposure|invoice|cost)\b/i.test(question);
}

function questionNeedsRecommendations(question) {
  return /\b(risk|recommend|action|review|mitigat|fulfilment|fulfillment|assessment|what should|next step)\b/i.test(question);
}

function questionNeedsAircraftRelationships(question) {
  return /\b(aircraft|registration|msn|serial number|fleet|airframe)\b/i.test(question);
}

function citationFromEvidence(evidence, context, type) {
  if (!evidence?.id || typeof evidence.excerpt !== "string" || !evidence.excerpt.trim()) return null;
  return {
    id: `${type}:${evidence.id}:${context.documentVersionId}`,
    type,
    contract: { id: context.contractId, title: context.contractTitle },
    document: { id: context.documentId || null },
    version: { id: context.documentVersionId, number: Number(context.versionNumber) },
    analysisRunId: context.analysisRunId,
    source: {
      id: evidence.id,
      pageStart: evidence.page_number ?? evidence.pageNumber ?? null,
      pageEnd: evidence.page_number ?? evidence.pageNumber ?? null,
      charStart: evidence.char_start ?? evidence.charStart ?? null,
      charEnd: evidence.char_end ?? evidence.charEnd ?? null,
      locator: evidence.source_locator || evidence.sourceLocator || sourceLocator(evidence),
      excerpt: evidence.excerpt.trim(),
    },
  };
}

function relevantFinancialImpact(impact, question) {
  if (!impact || !Array.isArray(impact.provenance?.evidence) || !impact.provenance.evidence.length) return false;
  if (/\b(reserve|maintenance)\b/i.test(question)) {
    return /maintenance|reserve/i.test(`${impact.category} ${impact.description}`);
  }
  if (/\b(escalat|cpi|index|rent)\b/i.test(question)) {
    return /escalation|indexation|base_rent|financial_term_conflict/i.test(`${impact.category} ${impact.description}`);
  }
  return true;
}

export async function answerPortfolioContractQuestion({
  organizationId,
  question,
  searchRepository = createSearchChunkRepository(),
  intelligenceReader = null,
  limit = 8,
} = {}) {
  assertOrganizationScope(organizationId);
  const normalizedQuestion = typeof question === "string" ? question.trim() : "";
  if (normalizedQuestion.length < 3 || normalizedQuestion.length > 500) {
    throw assistantError("INVALID_ASSISTANT_QUESTION", "Question must contain between 3 and 500 characters");
  }

  const retrieved = await searchRepository.searchPortfolio({
    organizationId,
    query: normalizedQuestion,
    limit,
  });
  const results = Array.isArray(retrieved) ? retrieved : retrieved?.results;
  if (!Array.isArray(results)) {
    throw assistantError("INVALID_PORTFOLIO_SEARCH_RESULT", "Portfolio search returned an invalid result", 500);
  }
  const eligibleResults = results.filter((item) => (
    item?.id && item.contractId && item.contractTitle
    && item.documentVersionId && Number.isInteger(Number(item.versionNumber)) && Number(item.versionNumber) > 0
    && item.analysisRunId && typeof item.excerpt === "string" && item.excerpt.trim()
  ));
  let incompleteReferences = Boolean(retrieved?.incompleteReferences) || eligibleResults.length !== results.length;
  const citations = eligibleResults.map((item) => ({
    id: item.id,
    type: "indexed_contract_passage",
    contract: { id: item.contractId, title: item.contractTitle },
    document: { id: item.documentId || null },
    version: { id: item.documentVersionId, number: Number(item.versionNumber) },
    analysisRunId: item.analysisRunId || null,
    clause: item.clause ? {
      id: item.clause.id,
      number: item.clause.number || null,
      title: item.clause.title || null,
    } : null,
    source: {
      id: item.id,
      pageStart: item.pageStart ?? null,
      pageEnd: item.pageEnd ?? null,
      charStart: item.charStart ?? null,
      charEnd: item.charEnd ?? null,
      locator: sourceLocator(item),
      excerpt: item.excerpt.trim(),
    },
  }));
  const contextsByRun = new Map();
  for (const result of eligibleResults) {
    if (!contextsByRun.has(result.analysisRunId)) contextsByRun.set(result.analysisRunId, result);
  }
  const includeFinancial = questionNeedsFinancialIntelligence(normalizedQuestion);
  const includeRecommendations = questionNeedsRecommendations(normalizedQuestion);
  const includeAircraftRelationships = questionNeedsAircraftRelationships(normalizedQuestion);
  const runInsights = intelligenceReader
    ? await Promise.all([...contextsByRun.values()].map(async (context) => ({
      context,
      intelligence: await intelligenceReader({
        organizationId,
        analysisRunId: context.analysisRunId,
        question: normalizedQuestion,
        includeFinancial,
        includeRecommendations,
        includeAircraftRelationships,
      }),
    })))
    : [];
  if (runInsights.some(({ intelligence }) => !intelligence || typeof intelligence !== "object")) {
    throw assistantError("INVALID_PORTFOLIO_INTELLIGENCE_RESULT", "Portfolio intelligence returned an invalid result", 500);
  }
  const citationsByKey = new Set(citations.map((citation) => citation.id));
  let supplementalCitationsCapped = false;
  const addCitation = (evidence, context, type) => {
    const citation = citationFromEvidence(evidence, context, type);
    if (!citation) return null;
    if (!citationsByKey.has(citation.id)) {
      if (citations.length - eligibleResults.length >= MAX_SUPPLEMENTAL_CITATIONS) {
        supplementalCitationsCapped = true;
        return null;
      }
      citationsByKey.add(citation.id);
      citations.push(citation);
    }
    return citation.id;
  };
  const structuredAnswers = [];
  const financialFindings = [];
  const recommendations = [];
  const aircraftRelationships = [];
  const recommendationKeys = new Set();
  for (const { context, intelligence } of runInsights) {
    const assistant = intelligence.assistant;
    if (assistant?.established && typeof assistant.answer === "string") {
      const citationIds = (assistant.evidence || [])
        .map((item) => addCitation(item, context, "structured_intelligence"))
        .filter(Boolean);
      if (citationIds.length) {
        structuredAnswers.push({
          contract: { id: context.contractId, title: context.contractTitle },
          version: { id: context.documentVersionId, number: Number(context.versionNumber) },
          answer: assistant.answer,
          findingTypes: [...new Set((assistant.findings || []).map((finding) => finding.type))],
          citationIds,
        });
      } else {
        incompleteReferences = true;
      }
    } else if (assistant && assistant.established !== false) {
      throw assistantError("INVALID_PORTFOLIO_INTELLIGENCE_RESULT", "Structured contract intelligence returned an invalid result", 500);
    }

    if (includeFinancial && intelligence.financialImpact) {
      for (const impact of (intelligence.financialImpact.impacts || []).filter((item) => relevantFinancialImpact(item, normalizedQuestion))) {
        if (financialFindings.length >= MAX_FINANCIAL_FINDINGS) {
          supplementalCitationsCapped = true;
          break;
        }
        const citationIds = (impact.provenance?.evidence || [])
          .map((item) => addCitation({
            id: item.evidenceId,
            excerpt: item.excerpt,
            source_locator: item.sourceLocator,
            page_number: item.pageNumber,
          }, context, "financial_evidence"))
          .filter(Boolean);
        if (citationIds.length) {
          financialFindings.push({
            contract: { id: context.contractId, title: context.contractTitle },
            version: { id: context.documentVersionId, number: Number(context.versionNumber) },
            category: impact.category,
            description: impact.description,
            resultLabel: impact.resultLabel,
            calculation: impact.calculation,
            calculationMethod: impact.calculationMethod,
            financialNature: impact.financialNature || null,
            currency: impact.currency || null,
            calculationLimitations: impact.calculationLimitations || [],
            citationIds,
          });
        }
      }
    }

    if (includeRecommendations && intelligence.leaseAssessment?.applicable) {
      for (const recommendation of intelligence.leaseAssessment.recommendations || []) {
        if (recommendations.length >= MAX_RECOMMENDATIONS) {
          supplementalCitationsCapped = true;
          break;
        }
        if (!recommendation.is_current || ["rejected", "superseded"].includes(recommendation.status)) continue;
        const key = `${recommendation.recommendation_key || recommendation.id}:${context.documentVersionId}`;
        if (recommendationKeys.has(key)) continue;
        const citationIds = (recommendation.evidence || [])
          .map((item) => addCitation({
            id: item.evidenceId,
            excerpt: item.excerpt,
            source_locator: item.sourceLocator,
            page_number: item.pageNumber,
          }, context, "recommendation_evidence"))
          .filter(Boolean);
        if (!citationIds.length) continue;
        recommendationKeys.add(key);
        recommendations.push({
          contract: { id: context.contractId, title: context.contractTitle },
          version: { id: context.documentVersionId, number: Number(context.versionNumber) },
          action: recommendation.action,
          rationale: recommendation.business_rationale,
          urgency: recommendation.urgency,
          ownerRole: recommendation.owner_role,
          status: recommendation.status,
          citationIds,
          humanReviewRequired: true,
        });
      }
    }

    if (includeAircraftRelationships) {
      for (const relationship of intelligence.aircraftRelationships || []) {
        if (aircraftRelationships.length >= MAX_AIRCRAFT_RELATIONSHIPS) {
          supplementalCitationsCapped = true;
          break;
        }
        const citationId = addCitation({
          id: relationship.evidence_id,
          excerpt: relationship.excerpt,
          source_locator: relationship.source_locator,
          page_number: relationship.page_number,
        }, context, "aircraft_relationship_evidence");
        if (!citationId) continue;
        aircraftRelationships.push({
          contract: { id: context.contractId, title: context.contractTitle },
          version: { id: context.documentVersionId, number: Number(context.versionNumber) },
          registration: relationship.registration || null,
          serialNumber: relationship.serial_number || null,
          aircraftType: relationship.aircraft_type || null,
          relationshipType: relationship.relationship_type,
          citationId,
        });
      }
    }
  }
  const distinctContracts = new Set(citations.map((citation) => citation.contract.id));
  const indexedDistinctContracts = new Set(eligibleResults.map((item) => item.contractId));
  const versionsByContract = new Map();
  for (const citation of citations) {
    if (!versionsByContract.has(citation.contract.id)) versionsByContract.set(citation.contract.id, new Set());
    versionsByContract.get(citation.contract.id).add(citation.version.number);
  }
  const multiVersionContracts = [...versionsByContract.entries()]
    .filter(([, versions]) => versions.size > 1)
    .map(([contractId]) => contractId);
  const capped = eligibleResults.length >= limit;
  incompleteReferences ||= supplementalCitationsCapped;
  const coverage = {
    source: "completed_tenant_contract_search_index",
    completeness: incompleteReferences ? "partial" : capped ? "capped" : "retrieved",
    returnedPassages: eligibleResults.length,
    returnedContracts: indexedDistinctContracts.size,
    limit,
    additionalMatchesPossible: capped,
    unresolvedReferencesOmitted: incompleteReferences,
    structuredAnalysisRuns: runInsights.length,
    portfolioAggregation: false,
    supplementalResultsCapped: supplementalCitationsCapped,
  };

  if (!citations.length) {
    return {
      established: false,
      answer: incompleteReferences
        ? "I cannot establish this reliably. Matching index records could not all be resolved to accessible completed contract versions."
        : "I cannot establish this reliably from matching accessible contract passages in the completed portfolio index.",
      question: normalizedQuestion,
      citations: [],
      findings: [],
      structuredAnswers: [],
      financialFindings: [],
      recommendations: [],
      aircraftRelationships: [],
      uncertainty: [
        "No cited passage supports an answer to this question.",
        ...(incompleteReferences ? ["Some matching index records could not be resolved and were omitted."] : []),
      ],
      coverage,
      intelligenceConsumption: 0,
    };
  }

  const uncertainty = [
    "Explanations are deterministic summaries of existing extracted or derived intelligence; they are not model-generated legal conclusions and do not verify extracted contract terms.",
    "Structured findings are loaded only for completed analysis runs represented by matching indexed passages. This is not an exhaustive portfolio aggregation.",
    "Only indexed passages from completed analysis runs are searched. Unindexed contracts or incomplete extractions are not represented in these results.",
    ...(coverage.additionalMatchesPossible ? ["The result is capped; additional matching passages may exist and these results are not a complete portfolio inventory."] : []),
    ...(incompleteReferences ? ["Some matching index records could not be resolved and were omitted; portfolio coverage is partial."] : []),
    ...(supplementalCitationsCapped ? ["Related structured results exceeded the response limit; some supporting intelligence was omitted."] : []),
    ...(multiVersionContracts.length
      ? ["Multiple contract versions matched for at least one contract. Versions are shown separately; no version was selected as controlling or treated as superseding another."]
      : []),
    ...(structuredAnswers.some((item) => item.findingTypes.includes("risk"))
      ? ["Risk findings are existing assessments for review, not confirmed breaches."]
      : []),
    ...(recommendations.length ? ["Displayed actions are existing advisory recommendations; human review remains required and no action is executed."]
      : []),
    ...(financialFindings.length ? ["Financial terms and calculations are shown only with linked evidence. Amounts are not combined across currencies, and calculated exposure is not a confirmed cash balance or payment."]
      : []),
    ...(aircraftRelationships.length ? ["Aircraft links are existing organization-scoped relationships and are shown only with their source evidence."]
      : []),
  ];
  const answerParts = structuredAnswers.map((item) =>
    `${item.contract.title} (version ${item.version.number}): ${item.answer}`);
  if (financialFindings.length) {
    answerParts.push(`Existing financial intelligence contains ${financialFindings.length} evidence-linked finding${financialFindings.length === 1 ? "" : "s"} among the retrieved analyses.`);
  }
  if (recommendations.length) {
    answerParts.push(`There ${recommendations.length === 1 ? "is" : "are"} ${recommendations.length} current evidence-linked recommendation${recommendations.length === 1 ? "" : "s"} for human review.`);
  }
  if (aircraftRelationships.length) {
    answerParts.push(`Found ${aircraftRelationships.length} existing evidence-linked aircraft relationship${aircraftRelationships.length === 1 ? "" : "s"} among the retrieved analyses.`);
  }
  return {
    established: true,
    answerType: structuredAnswers.length || financialFindings.length || recommendations.length || aircraftRelationships.length
      ? "deterministic_structured_answer"
      : "retrieval_only",
    answer: answerParts.length
      ? `${answerParts.join(" ")} Results are limited to the matching completed analyses shown below; no complete portfolio count or controlling-version conclusion is inferred.`
      : `Retrieved ${citations.length} matching source passage${citations.length === 1 ? "" : "s"} across ${distinctContracts.size} contract${distinctContracts.size === 1 ? "" : "s"}, but existing structured intelligence did not establish a direct answer. Review the cited source text; no contractual conclusion has been inferred.`,
    question: normalizedQuestion,
    citations,
    findings: citations.filter((citation) => citation.type === "indexed_contract_passage").map((citation) => ({
      type: "contract_text",
      id: citation.id,
      label: `${citation.contract.title} · version ${citation.version.number}${citation.source.locator ? ` · ${citation.source.locator}` : ""}`,
    })),
    structuredAnswers,
    financialFindings,
    recommendations,
    aircraftRelationships,
    uncertainty,
    coverage,
    intelligenceConsumption: 0,
  };
}
