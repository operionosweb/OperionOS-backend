import { createHash } from "node:crypto";
import { assertOrganizationScope, assertResourceId } from "../../../repositories/phase3/scope.js";
import { createAviationLeaseRecommendationRepository } from "../../../repositories/phase3/aviationLeaseRecommendationRepository.js";

const RECOMMENDATION_TYPES = new Set([
  "review",
  "clarify",
  "monitor_deadline",
  "confirm_compliance",
  "escalate",
]);

const TRANSITIONS = Object.freeze({
  suggested: new Set(["under_review", "accepted", "rejected"]),
  under_review: new Set(["accepted", "rejected"]),
  accepted: new Set(["completed", "rejected"]),
  rejected: new Set(),
  completed: new Set(),
  superseded: new Set(),
});

function recommendationError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function recommendationEvidence(risk) {
  const evidence = [...(risk.contract_evidence || []), ...(risk.operational_evidence || [])]
    .filter((item) => item?.evidenceId && item.reviewStatus !== "rejected");
  return [...new Map(evidence.map((item) => [item.evidenceId, {
    evidenceId: item.evidenceId,
    supportType: item.supportType || (item.relationship === "contradicts" ? "contradicts" : item.relationship === "context" ? "context" : "supports"),
    isPrimary: Boolean(item.isPrimary),
    confidence: item.confidence ?? null,
    reviewStatus: item.reviewStatus || "pending",
    sourceLocator: item.sourceLocator || null,
    pageNumber: item.pageNumber || null,
    excerpt: item.excerpt || null,
    documentName: item.documentName || null,
    versionNumber: item.versionNumber ?? null,
    ambiguityReason: item.ambiguityReason || null,
    periodStatus: item.periodStatus || null,
  }])).values()];
}

function recommendationTypeFor(risk) {
  if (risk.assessment_status === "disputed") return "review";
  if (risk.assessment_status === "not_fulfilled" || risk.deadline_information?.status === "passed") return "escalate";
  if ((risk.uncertainty_indicators || []).some((item) => /ambigu|needs confirmation/i.test(item))
    || (risk.contract_evidence || []).some((item) => item.reviewStatus !== "verified" || item.ambiguityReason)) {
    return "clarify";
  }
  if (["passed", "due_today", "approaching"].includes(risk.deadline_information?.status)) return "monitor_deadline";
  return "confirm_compliance";
}

function ownerRoleFor(risk) {
  if (risk.risk_type === "aviation_lease_utilization_review") return "AIRCRAFT_OPERATIONS";
  if (risk.risk_category === "insurance") return "INSURANCE";
  if (risk.risk_category === "financial") return "FINANCE";
  if (risk.risk_category === "maintenance/operational") return "MAINTENANCE";
  if (risk.risk_category === "delivery/redelivery") {
    return String(risk.risk_type || "").includes("redelivery") ? "LEASE_RETURN" : "AIRCRAFT_DELIVERY";
  }
  return "CONTRACT_REVIEW";
}

function urgencyFor(priority) {
  const normalized = String(priority || "LOW").toLowerCase();
  return ["low", "medium", "high", "critical"].includes(normalized) ? normalized : "low";
}

function explanationFor(risk, evidence) {
  const references = evidence.map((item) => {
    const locator = item.sourceLocator || (item.pageNumber ? `page ${item.pageNumber}` : "source excerpt");
    const excerpt = item.excerpt ? `: "${item.excerpt}"` : "";
    const relationship = item.supportType === "contradicts" ? "contradicts" : item.supportType === "context" ? "provides context" : "supports";
    return `- ${locator} ${relationship} the review${excerpt}`;
  });
  const uncertainty = risk.uncertainty_indicators?.length
    ? risk.uncertainty_indicators.join(" ")
    : "No additional uncertainty indicator was reported; this remains a review recommendation, not a contractual determination.";
  return [
    `Detected: ${risk.title}.`,
    `Affected obligation: ${risk.obligation_description || risk.obligation_id}. ${risk.description}`,
    "Supporting evidence:",
    ...references,
    `Why this action: ${risk.rationale}`,
    `Next step: ${risk.recommended_action}`,
    `Uncertainty: ${uncertainty}`,
    "This is a suggested action, not a contractual requirement or legal determination.",
  ].join("\n");
}

function keyFor(risk, evidence) {
  const fingerprint = JSON.stringify({
    riskKey: risk.id,
    assessmentStatus: risk.assessment_status,
    deadline: risk.deadline_information
      ? [risk.deadline_information.id, risk.deadline_information.status, risk.deadline_information.absoluteDate]
      : null,
    action: risk.recommended_action,
    evidenceIds: evidence.map((item) => item.evidenceId).sort(),
    ...(risk.utilisation_exposure ? {
      utilisationExposure: risk.utilisation_exposure.metrics.map((metric) => ({
        unit: metric.unit,
        contractualLimit: metric.contractualLimit,
        recordedUtilisation: metric.recordedUtilisation,
        headroom: metric.headroom,
        consumedPercent: metric.consumedPercent,
        status: metric.status,
        reportingPeriod: metric.reportingPeriod,
        sourceIds: metric.sources.map((source) => source.evidenceId).sort(),
        forecast: metric.forecast ? {
          status: metric.forecast.status,
          averageDailyConsumption: metric.forecast.averageDailyConsumption ?? null,
          historicalTrend: metric.forecast.historicalTrend ?? null,
          projectedThresholdDate: metric.forecast.projectedThresholdDate ?? null,
          remainingHeadroom: metric.forecast.remainingHeadroom ?? null,
          observations: metric.forecast.observations,
          deadlineComparison: metric.forecast.deadlineComparison ?? null,
          sourceIds: metric.forecast.sources.map((source) => source.evidenceId).sort(),
        } : null,
        financialExposure: metric.financialExposure ? {
          status: metric.financialExposure.status,
          provision: metric.financialExposure.contractualProvision ? {
            rate: metric.financialExposure.contractualProvision.rate,
            allowance: metric.financialExposure.contractualProvision.allowance,
            measurementPeriod: metric.financialExposure.contractualProvision.measurementPeriod,
            cap: metric.financialExposure.contractualProvision.cap,
            clauseId: metric.financialExposure.contractualProvision.clauseId,
            contractVersionId: metric.financialExposure.contractualProvision.contractVersionId,
          } : null,
          current: {
            status: metric.financialExposure.current?.status,
            amount: metric.financialExposure.current?.amount ?? null,
            currency: metric.financialExposure.current?.currency ?? null,
            excessUnits: metric.financialExposure.current?.excessUnits ?? null,
          },
          projected: {
            status: metric.financialExposure.projected?.status,
            amount: metric.financialExposure.projected?.amount ?? null,
            currency: metric.financialExposure.projected?.currency ?? null,
            measurementDate: metric.financialExposure.projected?.measurementDate ?? null,
            projectedUtilisation: metric.financialExposure.projected?.projectedUtilisation ?? null,
          },
          sourceIds: [
            ...(metric.financialExposure.contractualProvision?.evidence || []).map((source) => source.evidenceId),
            ...(metric.financialExposure.current?.sources || []).map((source) => source.evidenceId),
            ...(metric.financialExposure.projected?.sources || []).map((source) => source.evidenceId),
          ].filter(Boolean).sort(),
        } : null,
      })),
    } : {}),
  });
  return createHash("sha256").update(fingerprint).digest("hex");
}

function normalizeStoredRecord(record) {
  const history = Array.isArray(record.decision_history) ? record.decision_history : [];
  const latest = history.at(-1) || null;
  return { ...record, decision_history: history, latest_decision: latest };
}

export function deriveAviationLeaseRecommendations({ scope, risks = [], storedRecommendations = [] } = {}) {
  const stored = storedRecommendations.map(normalizeStoredRecord);
  const active = [];
  const activeKeys = new Set();
  const byKey = new Map(stored.map((item) => [item.recommendation_key, item]));

  for (const risk of risks) {
    if (!risk?.id || !risk.obligation_id || !risk.clause_id || risk.status === "resolved") continue;
    const evidence = recommendationEvidence(risk);
    if (!evidence.length || !risk.recommended_action) continue;
    const recommendationType = recommendationTypeFor(risk);
    if (!RECOMMENDATION_TYPES.has(recommendationType)) continue;
    const key = keyFor(risk, evidence);
    activeKeys.add(key);
    const saved = byKey.get(key);
    const latestDecision = saved?.latest_decision || null;
    const evidenceConfidences = evidence.map((item) => Number(item.confidence))
      .filter((value) => Number.isFinite(value) && value >= 0 && value <= 1);
    active.push({
      id: saved?.id || key,
      recommendation_key: key,
      organization_id: scope.organizationId,
      contract_id: scope.contractId,
      document_id: scope.documentId,
      document_version_id: scope.documentVersionId,
      analysis_run_id: scope.analysisRunId,
      obligation_id: risk.obligation_id,
      obligation_description: risk.obligation_description || null,
      risk_id: null,
      source_risk_key: risk.id,
      risk_category: risk.risk_category,
      clause_id: risk.clause_id,
      recommendation_type: recommendationType,
      action: risk.recommended_action,
      business_rationale: explanationFor(risk, evidence),
      urgency: urgencyFor(risk.priority),
      priority: risk.priority,
      owner_role: ownerRoleFor(risk),
      evidence_confidence: evidenceConfidences.length ? Math.min(...evidenceConfidences) : null,
      review_status: saved?.review_status || "pending",
      status: latestDecision?.status || "suggested",
      status_source: latestDecision ? "recorded" : "derived",
      reviewer_user_id: latestDecision?.reviewer_user_id || null,
      created_at: saved?.created_at || null,
      is_current: true,
      evidence,
      decision_history: saved?.decision_history || [],
    });
  }

  const historical = stored
    .filter((record) => !activeKeys.has(record.recommendation_key))
    .map((record) => {
      const latest = record.latest_decision;
      const canBeSuperseded = latest && !["completed", "rejected", "superseded"].includes(latest.status);
      return {
        ...record,
        status: canBeSuperseded ? "superseded" : latest?.status || "suggested",
        status_source: canBeSuperseded ? "derived" : "recorded",
        status_explanation: canBeSuperseded
          ? "The current evidence-derived risk or recommended action changed or was resolved; prior decisions remain unchanged in history."
          : null,
        reviewer_user_id: latest?.reviewer_user_id || null,
        is_current: false,
      };
    });

  return [...active, ...historical];
}

export function validateAviationLeaseRecommendationDecision(input) {
  if (!input || !["under_review", "accepted", "rejected", "completed"].includes(input.status)) {
    throw recommendationError("RECOMMENDATION_STATUS_INVALID", "Select a supported recommendation decision.");
  }
  const explanation = typeof input.explanation === "string" ? input.explanation.trim() : "";
  if (!explanation || explanation.length > 2000) {
    throw recommendationError("RECOMMENDATION_EXPLANATION_INVALID", "Provide a decision note of up to 2,000 characters.");
  }
  return { status: input.status, explanation };
}

export function createAviationLeaseRecommendationService({
  repository = createAviationLeaseRecommendationRepository(),
} = {}) {
  return {
    async list({ scope, risks }) {
      assertOrganizationScope(scope.organizationId);
      const records = await repository.listByRun(scope);
      return deriveAviationLeaseRecommendations({ scope, risks, storedRecommendations: records });
    },

    async decide({ recommendation, reviewerUserId, input }) {
      if (!recommendation || recommendation.status === "superseded" || recommendation.status_source === "derived" && recommendation.id !== recommendation.recommendation_key) {
        throw recommendationError("RECOMMENDATION_NOT_CURRENT", "This recommendation is no longer available for review.", 409);
      }
      try {
        assertResourceId(reviewerUserId, "reviewerUserId");
        assertOrganizationScope(recommendation.organization_id);
        assertResourceId(recommendation.contract_id, "contractId");
        assertResourceId(recommendation.obligation_id, "obligationId");
        assertResourceId(recommendation.clause_id, "clauseId");
      } catch {
        throw recommendationError("RECOMMENDATION_SCOPE_INVALID", "The recommendation scope is invalid.", 400);
      }
      const decision = validateAviationLeaseRecommendationDecision(input);
      const allowed = TRANSITIONS[recommendation.status];
      if (recommendation.status !== decision.status && !allowed?.has(decision.status)) {
        throw recommendationError("RECOMMENDATION_TRANSITION_INVALID", `A recommendation cannot transition from ${recommendation.status} to ${decision.status}.`, 409);
      }
      return repository.recordDecision({
        recommendation,
        reviewerUserId,
        ...decision,
      });
    },
  };
}
