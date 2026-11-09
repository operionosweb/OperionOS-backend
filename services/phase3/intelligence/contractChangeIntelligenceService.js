import { assertOrganizationScope, assertResourceId } from "../../../repositories/phase3/scope.js";
import { createAnalysisRunRepository } from "../../../repositories/phase3/analysisRunRepository.js";
import { createClauseRepository } from "../../../repositories/phase3/clauseRepository.js";
import { createObligationRepository } from "../../../repositories/phase3/obligationRepository.js";
import { createDeadlineRepository } from "../../../repositories/phase3/deadlineRepository.js";
import { createRiskRepository } from "../../../repositories/phase3/riskRepository.js";
import { createEvidenceRepository } from "../../../repositories/phase3/evidenceRepository.js";
import { createContractProfileRepository } from "../../../repositories/phase3/contractProfileRepository.js";
import { buildFinancialImpact } from "./financialImpactService.js";
import supabase from "../../../config/supabase.js";

function changeError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function normalizedText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function stableClauseKey(clause) {
  const number = normalizedText(clause.clause_number);
  if (number) return `number:${number}`;
  const title = normalizedText(clause.title);
  const category = normalizedText(clause.category);
  return title && category ? `title:${category}:${title}` : null;
}

function indexClauses(clauses) {
  const index = new Map();
  for (const clause of clauses) {
    const key = stableClauseKey(clause);
    if (!key) continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(clause);
  }
  return index;
}

function clauseSources(clause, related) {
  if (!clause) return null;
  const evidence = related.evidenceByClause.get(clause.id) || [];
  return {
    clauseId: clause.id,
    clauseNumber: clause.clause_number || null,
    title: clause.title || null,
    category: clause.category || null,
    text: clause.source_text || "",
    confidence: clause.confidence ?? null,
    reviewStatus: clause.review_status || "pending",
    evidenceStatus: evidence.length ? "available" : "missing",
    evidence,
  };
}

function linkedIntelligence(clause, related) {
  if (!clause) return {
    obligations: [],
    deadlines: [],
    risks: [],
    financialAssessments: [],
    potentiallyRelatedDeadlines: [],
  };
  const clauseId = clause.id;
  const obligations = related.obligations
    .filter((item) => item.clause_id === clauseId)
    .map((item) => ({
      id: item.id,
      description: item.description,
      type: item.obligation_type,
      status: item.status,
      reviewStatus: item.review_status,
    }));
  const deadlines = related.deadlines
    .filter((item) => item.source_clause_id === clauseId)
    .map((item) => ({
      id: item.id,
      timingExpression: item.timing_expression || item.original_expression,
      absoluteDate: item.absolute_date || null,
      status: item.status,
      reviewStatus: item.review_status,
    }));
  const risks = related.risks
    .filter((item) => item.clause_id === clauseId
      || item.source_references?.some((reference) => reference.source_type === "clause" && reference.source_id === clauseId))
    .map((item) => ({
      id: item.id,
      title: item.title,
      type: item.risk_type,
      severity: item.severity,
      status: item.status,
      reviewStatus: item.review_status,
    }));
  const clauseEvidenceIds = new Set((related.evidenceByClause.get(clauseId) || []).map((item) => item.id));
  const financialAssessments = (related.financialImpact?.impacts || [])
    .filter((item) => item.sourceClauseId === clauseId
      || item.sourceRiskId && risks.some((risk) => risk.id === item.sourceRiskId)
      || item.sourceEvidenceIds?.some((id) => clauseEvidenceIds.has(id)))
    .map((item) => ({
      id: item.id,
      sourceRiskId: item.sourceRiskId || null,
      category: item.category,
      description: item.description,
      baseAmount: item.baseAmount,
      currency: item.currency,
      frequency: item.frequency || null,
      unit: item.unit || null,
      calculationMethod: item.calculationMethod,
      impactStatus: "possible_effect_requires_review",
    }));
  const termDateChange = /\b(?:lease term|lease expiry|lease expiration|expiry date|expiration date)\b/i
    .test(clause.source_text || "");
  const potentiallyRelatedDeadlines = termDateChange
    ? related.deadlines
      .filter((item) => item.source_clause_id !== clauseId
        && /\b(?:lease expiry|lease expiration|expiry|expiration|end of the term)\b/i
          .test(`${item.original_expression || ""} ${item.timing_expression || ""} ${item.anchor_reference || ""}`))
      .map((item) => ({
        id: item.id,
        sourceClauseId: item.source_clause_id,
        obligationId: item.obligation_id || null,
        timingExpression: item.timing_expression || item.original_expression,
        absoluteDate: item.absolute_date || null,
        status: item.status,
        reviewStatus: item.review_status,
        potentiallyAffectedObligations: related.obligations
          .filter((obligation) => obligation.id === item.obligation_id)
          .map((obligation) => ({
            id: obligation.id,
            description: obligation.description,
            impactStatus: "possible_dependency_requires_review",
          })),
        potentiallyAffectedRisks: related.risks
          .filter((risk) => risk.affected_deadline_ids?.includes(item.id))
          .map((risk) => ({
            id: risk.id,
            title: risk.title,
            type: risk.risk_type,
            impactStatus: "possible_dependency_requires_review",
          })),
      }))
    : [];
  return { obligations, deadlines, risks, financialAssessments, potentiallyRelatedDeadlines };
}

function isFinancialTerm(clause) {
  const category = normalizedText(clause?.category);
  const text = String(clause?.source_text || "");
  return /commercial\/payment|pricing\/escalation/.test(category)
    || /\b(?:rent|rental|maintenance reserve|reserve rate|payment|fee|price|amount|eur|usd|gbp)\b/i.test(text);
}

function makeChange({ type, matchBasis, original, comparison, originalData, comparisonData }) {
  const clauseChangeCandidate = type !== "unchanged";
  const financialTermReviewRequired = clauseChangeCandidate && (isFinancialTerm(original) || isFinancialTerm(comparison));
  const originalIntelligence = linkedIntelligence(original, originalData);
  const comparisonIntelligence = linkedIntelligence(comparison, comparisonData);
  const hasDirectLinks = [
    originalIntelligence,
    comparisonIntelligence,
  ].some((items) => items.obligations.length || items.deadlines.length || items.risks.length || items.financialAssessments.length);
  const hasPossibleLinks = [
    originalIntelligence,
    comparisonIntelligence,
  ].some((items) => items.potentiallyRelatedDeadlines.length);
  const impactStatus = type === "unchanged"
    ? "no_text_change_detected"
    : hasDirectLinks
      ? "possible_impact_direct_source_link"
      : hasPossibleLinks
        ? "possible_impact_candidate_link"
        : "unresolved_no_explicit_relationship";
  const candidateChange = type === "unmatched_original" ? "potential_removal"
    : type === "unmatched_comparison" ? "potential_addition"
      : type;
  return {
    type,
    candidateChange,
    matchBasis,
    reviewStatus: type === "unchanged" ? "text_matches" : "requires_human_review",
    impactStatus,
    original: clauseSources(original, originalData),
    comparison: clauseSources(comparison, comparisonData),
    financialTermReviewRequired,
    linkedIntelligence: {
      original: originalIntelligence,
      comparison: comparisonIntelligence,
      reassessmentRequired: type !== "unchanged",
    },
    recommendedAction: type === "unchanged"
      ? null
      : "Confirm whether this source is executed, effective, and applicable; have the authorized contract owner review the cited text and linked intelligence before updating any records.",
  };
}

function evidenceForClauses(clauses, links, evidenceRows, scope) {
  const clauseIds = new Set(clauses.map((clause) => clause.id));
  const evidenceById = new Map(evidenceRows
    .filter((row) => row.organization_id === scope.organizationId
      && row.contract_id === scope.contractId
      && row.document_id === scope.documentId
      && row.document_version_id === scope.documentVersionId
      && row.analysis_run_id === scope.analysisRunId)
    .map((row) => [row.id, row]));
  const result = new Map();
  for (const link of links) {
    if (!clauseIds.has(link.clause_id)) continue;
    const evidence = evidenceById.get(link.evidence_id);
    if (!evidence) continue;
    if (!result.has(link.clause_id)) result.set(link.clause_id, []);
    result.get(link.clause_id).push({
      id: evidence.id,
      pageNumber: evidence.page_number || null,
      sourceLocator: evidence.source_locator || null,
      excerpt: evidence.excerpt,
      reviewStatus: evidence.review_status,
      rank: link.rank,
      isPrimary: link.is_primary,
    });
  }
  return result;
}

async function getScopedRecord(client, table, id, organizationId, columns) {
  const { data, error } = await client.from(table)
    .select(columns)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw changeError("STORAGE_ERROR", `${table} lookup failed`, 503);
  return data || null;
}

export function createContractChangeIntelligenceService({
  client = supabase,
  analysisRunRepository = createAnalysisRunRepository(client),
  clauseRepository = createClauseRepository(client),
  obligationRepository = createObligationRepository(client),
  deadlineRepository = createDeadlineRepository(client),
  riskRepository = createRiskRepository(client),
  evidenceRepository = createEvidenceRepository(client),
  profileRepository = createContractProfileRepository(),
  snapshotLoader = null,
} = {}) {
  async function loadSnapshot(analysisRun, organizationId, calculationTimestamp) {
    const version = await getScopedRecord(
      client,
      "document_versions",
      analysisRun.document_version_id,
      organizationId,
      "id, document_id, organization_id, version_number, extraction_status"
    );
    if (!version) throw changeError("ANALYSIS_RUN_NOT_FOUND", "Analysis run not found", 404);
    if (version.extraction_status !== "completed") {
      throw changeError("SOURCE_EXTRACTION_INCOMPLETE", "Both source documents must have completed text extraction", 422);
    }

    const document = await getScopedRecord(
      client,
      "documents",
      version.document_id,
      organizationId,
      "id, contract_id, organization_id, filename"
    );
    if (!document || document.contract_id !== analysisRun.contract_id) {
      throw changeError("ANALYSIS_RUN_NOT_FOUND", "Analysis run not found", 404);
    }

    const scope = {
      organizationId,
      contractId: analysisRun.contract_id,
      documentId: version.document_id,
      documentVersionId: version.id,
      analysisRunId: analysisRun.id,
    };
    const [clauses, obligations, deadlines, risks, evidenceRows, profile] = await Promise.all([
      clauseRepository.listByRun(scope),
      obligationRepository.listByRunScope(scope),
      deadlineRepository.listByRunScope(scope),
      riskRepository.listByRunScope(scope),
      evidenceRepository.listByRun({ organizationId, analysisRunId: analysisRun.id }),
      profileRepository.getByRun({ organizationId, analysisRunId: analysisRun.id }),
    ]);
    const scopedClauses = clauses.filter((row) => row.organization_id === organizationId
      && row.contract_id === scope.contractId
      && row.document_id === scope.documentId
      && row.document_version_id === scope.documentVersionId
      && row.analysis_run_id === scope.analysisRunId);
    if (!scopedClauses.length) {
      throw changeError("CHANGE_COMPARISON_UNAVAILABLE", "Both completed analyses must contain clause intelligence", 422);
    }
    const links = await clauseRepository.listClauseEvidenceLinks({
      organizationId,
      clauseIds: scopedClauses.map((clause) => clause.id),
    });
    const scopedEvidence = evidenceRows.filter((row) => row.organization_id === organizationId
      && row.contract_id === scope.contractId
      && row.document_id === scope.documentId
      && row.document_version_id === scope.documentVersionId
      && row.analysis_run_id === scope.analysisRunId);
    const scopedObligations = obligations.filter((row) => row.organization_id === organizationId
      && row.contract_id === scope.contractId
      && row.document_id === scope.documentId
      && row.document_version_id === scope.documentVersionId
      && row.analysis_run_id === scope.analysisRunId);
    const scopedDeadlines = deadlines.filter((row) => row.organization_id === organizationId
      && row.contract_id === scope.contractId
      && row.document_id === scope.documentId
      && row.document_version_id === scope.documentVersionId
      && row.analysis_run_id === scope.analysisRunId);
    const scopedRisks = risks.filter((row) => row.organization_id === organizationId
      && row.contract_id === scope.contractId
      && row.document_id === scope.documentId
      && row.document_version_id === scope.documentVersionId
      && row.analysis_run_id === scope.analysisRunId);
    const financialImpact = buildFinancialImpact({
      contractId: scope.contractId,
      analysisRunId: scope.analysisRunId,
      clauses: scopedClauses,
      obligations: scopedObligations,
      deadlines: scopedDeadlines,
      risks: scopedRisks.filter((risk) => !["superseded", "resolved"].includes(risk.status)),
      profile,
      calculationTimestamp,
    });
    return {
      source: {
        analysisRunId: analysisRun.id,
        analysisRunCreatedAt: analysisRun.created_at || null,
        documentId: document.id,
        documentCreatedAt: document.created_at || null,
        documentName: document.filename,
        documentVersionId: version.id,
        documentVersionNumber: version.version_number,
      },
      clauses: scopedClauses,
      obligations: scopedObligations,
      deadlines: scopedDeadlines,
      risks: scopedRisks,
      financialImpact,
      evidenceByClause: evidenceForClauses(scopedClauses, links, scopedEvidence, scope),
    };
  }

  return {
    async compare({ organizationId, sourceAAnalysisRunId, sourceBAnalysisRunId }) {
      assertOrganizationScope(organizationId);
      assertResourceId(sourceAAnalysisRunId, "sourceAAnalysisRunId");
      assertResourceId(sourceBAnalysisRunId, "sourceBAnalysisRunId");
      if (sourceAAnalysisRunId === sourceBAnalysisRunId) {
        throw changeError("CHANGE_COMPARISON_REQUIRES_TWO_RUNS", "Select two different completed analyses", 400);
      }

      const [sourceARun, sourceBRun] = await Promise.all([
        analysisRunRepository.getById(sourceAAnalysisRunId, organizationId),
        analysisRunRepository.getById(sourceBAnalysisRunId, organizationId),
      ]);
      if (!sourceARun || !sourceBRun
        || sourceARun.organization_id !== organizationId
        || sourceBRun.organization_id !== organizationId
        || sourceARun.contract_id !== sourceBRun.contract_id) {
        throw changeError("ANALYSIS_RUN_NOT_FOUND", "Both analyses must belong to this organization and the same contract", 404);
      }
      if (sourceARun.status !== "completed" || sourceBRun.status !== "completed") {
        throw changeError("ANALYSIS_NOT_COMPLETED", "Both analyses must be completed before comparison", 422);
      }

      const load = snapshotLoader || loadSnapshot;
      const calculationTimestamp = new Date().toISOString();
      const [sourceA, sourceB] = await Promise.all([
        load(sourceARun, organizationId, calculationTimestamp),
        load(sourceBRun, organizationId, calculationTimestamp),
      ]);
      return buildContractChangeComparison({ sourceA, sourceB });
    },
  };
}

export function buildContractChangeComparison({ sourceA, sourceB }) {
  if (!sourceA?.clauses?.length || !sourceB?.clauses?.length) {
    throw changeError("CHANGE_COMPARISON_UNAVAILABLE", "Both analyses must contain clause intelligence", 422);
  }
  const indexA = indexClauses(sourceA.clauses);
  const indexB = indexClauses(sourceB.clauses);
  const matchedIdsA = new Set();
  const matchedIdsB = new Set();
  const changes = [];

  for (const clauseA of sourceA.clauses) {
    const key = stableClauseKey(clauseA);
    const candidatesA = key ? indexA.get(key) || [] : [];
    const candidatesB = key ? indexB.get(key) || [] : [];
    if (candidatesA.length === 1 && candidatesB.length === 1) {
      const clauseB = candidatesB[0];
      matchedIdsA.add(clauseA.id);
      matchedIdsB.add(clauseB.id);
      const type = normalizedText(clauseA.source_text) === normalizedText(clauseB.source_text) ? "unchanged" : "modified";
      changes.push(makeChange({
        type,
        matchBasis: key.startsWith("number:") ? "unique_clause_number" : "unique_category_and_title",
        original: clauseA,
        comparison: clauseB,
        originalData: sourceA,
        comparisonData: sourceB,
      }));
      continue;
    }
    if (matchedIdsA.has(clauseA.id)) continue;
    const ambiguous = candidatesA.length > 1 || candidatesB.length > 1 || !key;
    changes.push(makeChange({
      type: "unmatched_original",
      matchBasis: ambiguous ? "ambiguous_or_missing_clause_identity" : "no_unique_counterpart",
      original: clauseA,
      comparison: null,
      originalData: sourceA,
      comparisonData: sourceB,
    }));
    matchedIdsA.add(clauseA.id);
  }

  for (const clauseB of sourceB.clauses) {
    if (matchedIdsB.has(clauseB.id)) continue;
    const key = stableClauseKey(clauseB);
    const candidatesA = key ? indexA.get(key) || [] : [];
    const candidatesB = key ? indexB.get(key) || [] : [];
    const ambiguous = candidatesA.length > 1 || candidatesB.length > 1 || !key;
    changes.push(makeChange({
      type: "unmatched_comparison",
      matchBasis: ambiguous ? "ambiguous_or_missing_clause_identity" : "no_unique_counterpart",
      original: null,
      comparison: clauseB,
      originalData: sourceA,
      comparisonData: sourceB,
    }));
    matchedIdsB.add(clauseB.id);
  }

  const summary = changes.reduce((counts, change) => ({
    ...counts,
    [change.type]: (counts[change.type] || 0) + 1,
  }), {});
  return {
    status: "review_required",
    sourceA: sourceA.source,
    sourceB: sourceB.source,
    comparisonBasis: {
      sourceA: "explicitly_selected",
      sourceB: "explicitly_selected",
      contractualChronology: "unknown",
      legalApplicability: "unknown",
    },
    summary,
    changes,
    interpretation: {
      legalApplicability: "unknown",
      executionStatus: "unknown",
      effectiveDate: "unknown",
      supersessionStatus: "unknown",
    },
    limitations: [
      "This is a candidate text comparison of two explicitly selected completed analyses, not a determination that either document is an amendment or legally operative.",
      "Unmatched clauses are not asserted to have been added or removed; they may be renumbered, omitted by extraction, or unresolved.",
      "Linked obligations, deadlines, and risks are surfaced for review only. No findings are recalculated, superseded, or written by this comparison.",
      "Financial terms are flagged for review from clause category or wording; no financial delta or legal consequence is calculated.",
      "Upload and analysis timestamps do not establish execution, effective date, applicability, or supersession.",
    ],
  };
}
