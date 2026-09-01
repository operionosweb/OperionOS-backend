import crypto from "node:crypto";
import { z } from "zod";

import { createRiskRepository } from "../../../repositories/phase3/riskRepository.js";
import { assertOrganizationScope, assertResourceId } from "../../../repositories/phase3/scope.js";
import { aiGateway } from "../../ai/aiGateway.js";
import { isRiskType, RISK_CATEGORIES, RISK_TAXONOMY_VERSION } from "./riskTaxonomy.js";

const PIPELINE_VERSION = "phase3e-contract-risk-v1";
const PROMPT_VERSION = "contract-risk-semantic-v1";
const SCHEMA_VERSION = "phase3e.risk.v1";
const AI_BATCH_SIZE = 10;

const SemanticRiskSchema = z.object({
  category: z.enum(RISK_CATEGORIES),
  risk_type: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  rationale: z.string().trim().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number().min(0).max(1),
  source_clause_ids: z.array(z.string().uuid()).min(1),
  consequence: z.string().trim().min(1).nullable().optional(),
  condition: z.string().trim().min(1).nullable().optional(),
}).strict();

const SemanticOutputSchema = z.object({ risks: z.array(SemanticRiskSchema).max(AI_BATCH_SIZE) }).strict();

function normalized(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sourceText(clause) {
  return normalized(clause.source_text || clause.text || clause.description);
}

function moneyFrom(text) {
  const match = text.match(/\b(EUR|USD|GBP)\s*([\d,.]+)\s*(million|billion|m|bn)?\b/i);
  if (!match) return null;
  const multiplier = /billion|bn/i.test(match[3] || "") ? 1_000_000_000
    : /million|m/i.test(match[3] || "") ? 1_000_000 : 1;
  const amount = Number(match[2].replaceAll(",", "")) * multiplier;
  if (!Number.isFinite(amount)) return null;
  return { currency: match[1].toUpperCase(), amount, expression: match[0] };
}

function evidenceForClause(clause) {
  if (Array.isArray(clause.evidence) && clause.evidence.length) return clause.evidence;
  if (clause.source_evidence_id) {
    return [{ evidence_id: clause.source_evidence_id, rank: 1, support_type: "supports", is_primary: true }];
  }
  return [];
}

function relatedForClause(clauseId, records) {
  return records.filter((record) => record.clause_id === clauseId || record.source_clause_id === clauseId);
}

function makeCandidate({ clause, clauses = [clause], obligations = [], deadlines = [], category, riskType,
  title, description, rationale, severity, confidence, consequence = null, financialExposure = null,
  condition = null, status = "identified", metadata = {} }) {
  const sourceReferences = clauses.map((item) => ({ source_type: "clause", source_id: item.id }));
  for (const item of obligations) sourceReferences.push({ source_type: "obligation", source_id: item.id });
  for (const item of deadlines) sourceReferences.push({ source_type: "deadline", source_id: item.id });
  const evidence = clauses.flatMap(evidenceForClause);
  return {
    category,
    risk_type: riskType,
    title,
    description,
    rationale,
    severity,
    confidence,
    probability: null,
    consequence,
    financial_exposure: financialExposure,
    condition,
    status,
    source_type: sourceReferences.length > 1 ? "multiple" : sourceReferences[0]?.source_type || "clause",
    source_references: sourceReferences,
    source_clause_ids: clauses.map((item) => item.id),
    affected_obligation_ids: obligations.map((item) => item.id),
    affected_deadline_ids: deadlines.map((item) => item.id),
    evidence,
    metadata: { ...metadata, deterministic: true },
  };
}

function clauseCandidates(clause, obligations, deadlines, allClauses) {
  const text = sourceText(clause);
  const lower = text.toLowerCase();
  const linkedObligations = relatedForClause(clause.id, obligations);
  const linkedDeadlines = relatedForClause(clause.id, deadlines);
  const candidates = [];
  const amount = moneyFrom(text);

  if (/\b(late fee|late payment|penalty|liquidated damages)\b/i.test(text) && amount) {
    candidates.push(makeCandidate({
      clause, obligations: linkedObligations, deadlines: linkedDeadlines,
      category: "financial", riskType: "penalty_exposure", title: "Explicit contractual financial consequence",
      description: `${amount.expression} is stated as a contractual payment consequence.`,
      rationale: "The analysed clause expressly attaches a quantified financial consequence to non-performance or delay.",
      severity: amount.amount >= 100_000 ? "high" : "medium", confidence: 0.99,
      consequence: "The stated contractual amount may become payable if the specified trigger occurs.",
      financialExposure: { type: "quantified", ...amount },
    }));
  }

  const indemnity = /\bindemnif(?:y|ies|ication)\b/i.test(text);
  const broadLoss = /\b(all|any)\s+(?:loss(?:es)?|liabilit(?:y|ies)|claims?|damages?)\b/i.test(text);
  const explicitUncapped = /\b(unlimited|uncapped|without limit(?:ation)?)\b/i.test(text);
  if ((indemnity && broadLoss) || explicitUncapped) {
    candidates.push(makeCandidate({
      clause, obligations: linkedObligations, deadlines: linkedDeadlines,
      category: "liability", riskType: explicitUncapped ? "uncapped_liability" : "broad_indemnity",
      title: explicitUncapped ? "Potential uncapped liability exposure" : "Broad indemnity exposure",
      description: "The clause uses broad loss or liability language without a quantified limit in the supplied contractual basis.",
      rationale: "Broad indemnity or express unlimited language may expose the obligated party to liabilities that are not quantified by the contract text analysed here.",
      severity: explicitUncapped ? "critical" : "high", confidence: explicitUncapped ? 0.99 : 0.94,
      consequence: "Contractual liability may extend to the stated categories of loss if the clause is triggered.",
      financialExposure: { type: "unquantified", amount: null, currency: null, cap_status: "potentially_uncapped" },
    }));
  }

  const cap = text.match(/\bliabilit(?:y|ies)\s+(?:is|shall be)\s+capped at\s+([^.;]+)/i);
  const carveOut = text.match(/\bexcept for\s+([^.;]+)/i);
  if (cap && carveOut) {
    candidates.push(makeCandidate({
      clause, obligations: linkedObligations, category: "liability", riskType: "uncapped_liability",
      title: "Liability cap carve-outs may remain uncapped",
      description: `The liability cap has stated carve-outs for ${normalized(carveOut[1])}, which may remain uncapped.`,
      rationale: "The contract states a liability cap but excludes specified categories from that cap.",
      severity: "high", confidence: 0.98,
      consequence: "The stated carve-out categories may fall outside the contractual cap.",
      financialExposure: { type: "cap_with_carve_outs", cap: moneyFrom(cap[1]), carve_outs: normalized(carveOut[1]), amount: null },
    }));
  }

  const termination = text.match(/\b(may|shall)\s+terminate\b/i);
  if (termination && /\bdefault\b/i.test(text)) {
    const cure = linkedDeadlines.find((item) => item.deadline_type === "cure_period")
      || linkedDeadlines.find((item) => /cure|default/i.test(`${item.original_expression || ""} ${item.trigger_expression || ""}`));
    const cureText = text.match(/\b(?:after|within)\s+(\d+)\s+(business\s+)?days?\b/i);
    candidates.push(makeCandidate({
      clause, obligations: linkedObligations, deadlines: cure ? [cure] : linkedDeadlines,
      category: "termination_default", riskType: cure || cureText ? "cure_period_exposure" : "termination_exposure",
      title: cure || cureText ? "Default cure period linked to termination right" : "Termination right following contractual default",
      description: `The contract provides that a party ${termination[1].toLowerCase()} terminate following the stated default mechanism${cureText ? ` after ${cureText[1]} days` : ""}.`,
      rationale: "A contractual default can activate a termination mechanism; discretionary 'may terminate' language is not treated as inevitable termination.",
      severity: "high", confidence: 0.97,
      consequence: "The party holding the right may terminate if the contractual conditions are satisfied.",
      condition: "The stated default and any applicable cure conditions must occur.",
    }));
  }

  const renewal = /\bautomatically renews?\b/i.test(text);
  if (renewal) {
    const notice = text.match(/\b(\d+)\s+(business\s+)?days?\s+before\b/i);
    candidates.push(makeCandidate({
      clause, obligations: linkedObligations, deadlines: linkedDeadlines,
      category: "commercial", riskType: "automatic_renewal", title: "Automatic renewal notice window",
      description: `The agreement automatically renews${notice ? ` unless notice is provided at least ${notice[1]} days before expiry` : " under the stated mechanism"}.`,
      rationale: "Failure to use the contractual notice window may result in renewal for the stated term.",
      severity: "medium", confidence: 0.99,
      consequence: "The contract may renew under its express renewal mechanism.",
    }));
  }

  const references = [...text.matchAll(/\b(Schedule|Appendix|Annex)\s+(\d+[A-Za-z]?)\b/gi)];
  for (const reference of references) {
    const label = `${reference[1]} ${reference[2]}`;
    const located = allClauses.some((item) => item.id !== clause.id
      && new RegExp(`^(?:${reference[1]}\\s+${reference[2]})\\b`, "i").test(sourceText(item)));
    if (!located) {
      candidates.push(makeCandidate({
        clause, obligations: linkedObligations, category: "data_information", riskType: "information_dependency",
        title: `Dependency on unavailable ${label}`,
        description: `${label} was not located in the analysed document.`,
        rationale: "The clause depends on referenced contractual material that was not present in the analysed clause set.",
        severity: "medium", confidence: 0.92,
        consequence: "The analysed document may not contain all material needed to interpret or perform the stated requirement.",
        status: "requires_review", metadata: { missing_reference: label },
      }));
    }
  }

  return candidates;
}

function deadlineCandidates(deadline, obligations, clausesById) {
  const clause = clausesById.get(deadline.source_clause_id);
  if (!clause) return [];
  const linkedObligations = obligations.filter((item) => item.id === deadline.obligation_id);
  if (deadline.deadline_type === "ambiguous" || deadline.computability === "ambiguous") {
    return [makeCandidate({
      clause, obligations: linkedObligations, deadlines: [deadline], category: "timing", riskType: "ambiguous_deadline",
      title: "Ambiguous contractual timing", description: "The contractual timing is expressed without a determinable date or duration.",
      rationale: "The existing deadline intelligence identifies timing ambiguity; the risk layer preserves that fact without inventing a numeric interpretation.",
      severity: "medium", confidence: Number(deadline.confidence || 0.8),
      consequence: "The timing uncertainty may make contractual compliance planning difficult.", status: "requires_review",
    })];
  }
  if (Number(deadline.amount) > 0 && Number(deadline.amount) <= 5 && ["hours", "days", "business_days"].includes(deadline.unit)) {
    return [makeCandidate({
      clause, obligations: linkedObligations, deadlines: [deadline], category: "timing", riskType: "short_notice_period",
      title: "Short contractual response period",
      description: `The linked obligation must be performed within ${deadline.amount} ${deadline.unit.replaceAll("_", " ")}.`,
      rationale: "A short express period may create operational compliance pressure following the contractual trigger.",
      severity: Number(deadline.amount) <= 2 || deadline.unit === "hours" ? "high" : "medium",
      confidence: Math.min(Number(deadline.confidence || 0.9), 0.99),
      consequence: "Failure to meet the stated period may create the contractual exposure described by the linked clause.",
      condition: deadline.condition || deadline.trigger_expression || null,
    })];
  }
  if (deadline.deadline_type === "recurring" && linkedObligations.some((item) => ["compliance", "notification"].includes(item.obligation_type))) {
    return [makeCandidate({
      clause, obligations: linkedObligations, deadlines: [deadline], category: "timing", riskType: "recurring_compliance",
      title: "Recurring contractual compliance requirement",
      description: `The linked compliance obligation recurs ${deadline.recurrence?.frequency?.replaceAll("_", " ") || "under the stated schedule"}.`,
      rationale: "A repeated express compliance requirement creates an ongoing administrative exposure without implying that a breach has occurred.",
      severity: "low", confidence: Math.min(Number(deadline.confidence || 0.9), 0.99),
      consequence: "A missed recurrence may create the exposure stated by the linked contractual requirement.",
    })];
  }
  return [];
}

function contradictionCandidates(clauses, obligations, deadlines) {
  const expressions = [];
  for (const clause of clauses) {
    const match = sourceText(clause).match(/\b(notif(?:y|ication)|notice)\b[^.]{0,100}?\bwithin\s+(\d+)\s+(business\s+)?days?\b/i);
    if (match) expressions.push({ clause, subject: "notice", amount: Number(match[2]), business: Boolean(match[3]) });
  }
  if (expressions.length < 2) return [];
  const first = expressions[0];
  const conflict = expressions.find((item) => item.amount !== first.amount || item.business !== first.business);
  if (!conflict) return [];
  const linkedObligations = obligations.filter((item) => [first.clause.id, conflict.clause.id].includes(item.clause_id));
  const linkedDeadlines = deadlines.filter((item) => [first.clause.id, conflict.clause.id].includes(item.source_clause_id));
  return [makeCandidate({
    clause: first.clause, clauses: [first.clause, conflict.clause], obligations: linkedObligations, deadlines: linkedDeadlines,
    category: "timing", riskType: "ambiguous_deadline", title: "Potential inconsistency between notice periods",
    description: `The analysed clauses state ${first.amount} ${first.business ? "Business " : ""}Days and ${conflict.amount} ${conflict.business ? "Business " : ""}Days for notice.`,
    rationale: "The analysed document contains different numerical notice periods; this finding does not determine which clause controls.",
    severity: "medium", confidence: 0.95,
    consequence: "The inconsistent periods may create uncertainty about the applicable contractual timing.", status: "requires_review",
  })];
}

export function screenDeterministicRiskCandidates({ clauses = [], obligations = [], deadlines = [] }) {
  const clausesById = new Map(clauses.map((clause) => [clause.id, clause]));
  const candidates = clauses.flatMap((clause) => clauseCandidates(clause, obligations, deadlines, clauses));
  candidates.push(...deadlines.flatMap((deadline) => deadlineCandidates(deadline, obligations, clausesById)));
  candidates.push(...contradictionCandidates(clauses, obligations, deadlines));
  return candidates.map((candidate) => ({
    ...candidate,
    risk_identity: crypto.createHash("sha256").update(JSON.stringify({
      category: candidate.category,
      risk_type: candidate.risk_type,
      source_references: candidate.source_references,
      source_hashes: candidate.source_clause_ids.map((id) => crypto.createHash("sha256").update(sourceText(clausesById.get(id))).digest("hex")),
      taxonomy_version: RISK_TAXONOMY_VERSION,
      pipeline_version: PIPELINE_VERSION,
      schema_version: SCHEMA_VERSION,
    })).digest("hex"),
  }));
}

export function selectSemanticRiskCandidates({ clauses = [], deterministicRisks = [] }) {
  const deterministicClauseIds = new Set(deterministicRisks.flatMap((risk) => risk.source_clause_ids));
  const nuancedPattern = /\b(sole discretion|commercially reasonable|best endeavours|material adverse|exclusive supplier|unreasonably withhold|subcontractor dependency|subject to availability)\b/i;
  return clauses.filter((clause) => !deterministicClauseIds.has(clause.id) && nuancedPattern.test(sourceText(clause)));
}

export function createGatewayRiskProvider({ gateway = aiGateway, confirmation = false, metrics = {} } = {}) {
  return {
    async analyzeStructured(payload) {
      metrics.requests = (metrics.requests || 0) + 1;
      const input = JSON.stringify(payload);
      const result = await gateway.request({
        organizationId: payload.organization_id,
        userId: payload.user_id || null,
        operation: "risk_reasoning",
        input,
        documentHash: crypto.createHash("sha256").update(input).digest("hex"),
        confirmation,
        structured: true,
        system: "Identify only material contractual exposure supported by the supplied candidate clauses and related facts. Return structured JSON. Do not give legal advice, predict probability, invent consequences or amounts, or reference sources outside the supplied IDs.",
      });
      metrics.estimatedIntelligence = (metrics.estimatedIntelligence || 0) + Number(result.estimatedIntelligence || result.job?.estimatedIntelligence || 0);
      metrics.actualIntelligence = (metrics.actualIntelligence || 0) + Number(result.job?.actualIntelligence || 0);
      if (result.source === "cache") metrics.cacheHits = (metrics.cacheHits || 0) + 1;
      if (result.source === "provider") metrics.cacheMisses = (metrics.cacheMisses || 0) + 1;
      if (!result.success) throw Object.assign(new Error("Risk semantic analysis was not completed"), { code: result.code || "AI_REQUEST_BLOCKED", status: 409 });
      const parsed = SemanticOutputSchema.safeParse(result.result);
      if (!parsed.success) throw Object.assign(new Error("Risk semantic output failed schema validation"), { code: "PROVIDER_OUTPUT_INVALID", status: 422, issues: parsed.error.issues });
      return parsed.data;
    },
  };
}

function semanticPayload({ scope, userId, clauses, obligations, deadlines }) {
  const clauseIds = new Set(clauses.map((clause) => clause.id));
  return {
    organization_id: scope.organizationId,
    user_id: userId,
    candidate_clauses: clauses.map((clause) => ({
      id: clause.id,
      clause_number: clause.clause_number || null,
      category: clause.category || null,
      text: sourceText(clause),
    })),
    related_obligations: obligations.filter((item) => clauseIds.has(item.clause_id)).map((item) => ({
      id: item.id,
      clause_id: item.clause_id,
      actor: item.actor || null,
      action: item.action || null,
      object: item.object || null,
      condition: item.condition || null,
      consequence: item.consequence || null,
    })),
    related_deadlines: deadlines.filter((item) => clauseIds.has(item.source_clause_id)).map((item) => ({
      id: item.id,
      source_clause_id: item.source_clause_id,
      obligation_id: item.obligation_id || null,
      timing_expression: item.timing_expression || item.original_expression,
      computability: item.computability || null,
      ambiguity: item.ambiguity || null,
    })),
    taxonomy_version: RISK_TAXONOMY_VERSION,
    prompt_version: PROMPT_VERSION,
    schema_version: SCHEMA_VERSION,
    source_intelligence_version: PIPELINE_VERSION,
  };
}

function materializeSemanticRisk(risk, { clausesById, obligations, deadlines }) {
  if (!isRiskType(risk.category, risk.risk_type)) {
    throw Object.assign(new Error("Risk semantic output used an unsupported taxonomy value"), { code: "PROVIDER_OUTPUT_INVALID", status: 422 });
  }
  const clauses = risk.source_clause_ids.map((id) => clausesById.get(id));
  if (clauses.some((clause) => !clause)) {
    throw Object.assign(new Error("Risk semantic output referenced an unavailable source"), { code: "RISK_SOURCE_INVALID", status: 422 });
  }
  const clauseIds = new Set(risk.source_clause_ids);
  const linkedObligations = obligations.filter((item) => clauseIds.has(item.clause_id));
  const linkedDeadlines = deadlines.filter((item) => clauseIds.has(item.source_clause_id));
  return makeCandidate({
    clause: clauses[0], clauses, obligations: linkedObligations, deadlines: linkedDeadlines,
    category: risk.category, riskType: risk.risk_type, title: risk.title,
    description: risk.description, rationale: risk.rationale, severity: risk.severity,
    confidence: risk.confidence, consequence: risk.consequence || null, condition: risk.condition || null,
    status: risk.confidence < 0.75 ? "requires_review" : "identified", metadata: { deterministic: false },
  });
}

function stageRow(candidate, scope) {
  return {
    organization_id: scope.organizationId,
    contract_id: scope.contractId,
    document_id: scope.documentId,
    document_version_id: scope.documentVersionId,
    analysis_run_id: scope.analysisRunId,
    clause_id: candidate.source_clause_ids[0] || null,
    risk_category: candidate.category,
    risk_type: candidate.risk_type,
    title: candidate.title,
    description: candidate.description,
    rationale: candidate.rationale,
    severity: candidate.severity,
    probability: null,
    impact: candidate.consequence,
    exposure: candidate.description,
    explanation: candidate.rationale,
    confidence: candidate.confidence,
    source_type: candidate.source_type,
    source_references: candidate.source_references,
    financial_exposure: candidate.financial_exposure,
    consequence: candidate.consequence,
    affected_obligation_ids: candidate.affected_obligation_ids,
    affected_deadline_ids: candidate.affected_deadline_ids,
    condition: candidate.condition,
    status: candidate.status,
    risk_version: PIPELINE_VERSION,
    metadata: {
      ...candidate.metadata,
      taxonomy_version: RISK_TAXONOMY_VERSION,
      prompt_version: PROMPT_VERSION,
      schema_version: SCHEMA_VERSION,
      source_intelligence_version: PIPELINE_VERSION,
    },
    risk_identity: candidate.risk_identity,
    review_status: candidate.status === "requires_review" ? "requires_review" : "pending",
    evidence: candidate.evidence,
  };
}

export function createContractRiskIntelligenceService({ repository = createRiskRepository(), provider = null, metrics = {}, now = () => Date.now() } = {}) {
  return {
    async runStage({ useAIFallback = false, userId = null, ...scope }) {
      assertOrganizationScope(scope.organizationId);
      assertResourceId(scope.contractId, "contractId");
      assertResourceId(scope.documentId, "documentId");
      assertResourceId(scope.documentVersionId, "documentVersionId");
      assertResourceId(scope.analysisRunId, "analysisRunId");
      const startedAt = now();
      const intelligence = await repository.listIntelligence(scope);
      const screeningStartedAt = now();
      const deterministic = screenDeterministicRiskCandidates(intelligence);
      const deterministicScreeningMs = now() - screeningStartedAt;
      const semanticCandidates = useAIFallback ? selectSemanticRiskCandidates({ clauses: intelligence.clauses, deterministicRisks: deterministic }) : [];
      const semantic = [];
      const failedCandidates = [];
      const clausesById = new Map(intelligence.clauses.map((clause) => [clause.id, clause]));
      const aiStartedAt = now();
      for (let offset = 0; offset < semanticCandidates.length; offset += AI_BATCH_SIZE) {
        const batch = semanticCandidates.slice(offset, offset + AI_BATCH_SIZE);
        try {
          if (!provider?.analyzeStructured) throw Object.assign(new Error("Risk AI fallback is not configured"), { code: "PROVIDER_NOT_CONFIGURED", status: 422 });
          const payload = semanticPayload({ scope, userId, clauses: batch, obligations: intelligence.obligations, deadlines: intelligence.deadlines });
          const output = await provider.analyzeStructured(payload);
          const allowedIds = new Set(batch.map((clause) => clause.id));
          for (const risk of output.risks) {
            if (risk.source_clause_ids.some((id) => !allowedIds.has(id))) {
              throw Object.assign(new Error("Risk semantic output escaped its candidate source set"), { code: "RISK_SOURCE_INVALID", status: 422 });
            }
            const candidate = materializeSemanticRisk(risk, { clausesById, obligations: intelligence.obligations, deadlines: intelligence.deadlines });
            semantic.push({
              ...candidate,
              risk_identity: crypto.createHash("sha256").update(JSON.stringify({
                candidate,
                taxonomy: RISK_TAXONOMY_VERSION,
                prompt: PROMPT_VERSION,
                schema: SCHEMA_VERSION,
              })).digest("hex"),
            });
          }
        } catch (error) {
          failedCandidates.push(...batch.map((clause) => ({ source_clause_id: clause.id, code: error.code || "RISK_ANALYSIS_FAILED" })));
        }
      }
      const aiAnalysisMs = now() - aiStartedAt;
      const risks = [...deterministic, ...semantic].filter((risk) => risk.evidence.length).map((risk) => stageRow(risk, scope));
      const persisted = await repository.persistRisks({ ...scope, risks });
      return {
        status: failedCandidates.length ? "partial_failure" : persisted.insertedRisks ? "risks_persisted" : risks.length ? "already_processed" : "no_material_risks",
        ...persisted,
        totalClauses: intelligence.clauses.length,
        totalObligations: intelligence.obligations.length,
        totalDeadlines: intelligence.deadlines.length,
        deterministicCandidates: deterministic.length,
        aiCandidates: semanticCandidates.length,
        aiRequests: metrics.requests || 0,
        estimatedIntelligence: metrics.estimatedIntelligence || 0,
        actualIntelligence: metrics.actualIntelligence || 0,
        cacheHits: metrics.cacheHits || 0,
        cacheMisses: metrics.cacheMisses || 0,
        failedCandidates,
        severityCounts: risks.reduce((counts, risk) => ({ ...counts, [risk.severity]: (counts[risk.severity] || 0) + 1 }), {}),
        performance: { deterministicScreeningMs, aiAnalysisMs, totalMs: now() - startedAt },
        versions: { taxonomy: RISK_TAXONOMY_VERSION, prompt: PROMPT_VERSION, schema: SCHEMA_VERSION, sourceIntelligence: PIPELINE_VERSION },
      };
    },
  };
}

export const contractRiskIntelligenceConstants = Object.freeze({
  pipelineVersion: PIPELINE_VERSION,
  promptVersion: PROMPT_VERSION,
  schemaVersion: SCHEMA_VERSION,
  taxonomyVersion: RISK_TAXONOMY_VERSION,
});