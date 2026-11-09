const REQUIRED_SCOPE_FIELDS = [
  "organizationId",
  "contractId",
  "analysisRunId",
  "documentVersionId",
  "clauseId",
];

function isVerifiedEvidence(item) {
  return Boolean(item?.evidenceId && item.reviewStatus === "verified");
}

export function createAviationContractualExposureAssessment(input) {
  if (!input || !REQUIRED_SCOPE_FIELDS.every((field) => (
    typeof input[field] === "string" && input[field].trim().length > 0
  ))
    || typeof input.id !== "string" || !input.id.trim()
    || typeof input.category !== "string" || !input.category.trim()
    || typeof input.status !== "string" || !input.status.trim()
    || !input.riskVariable || typeof input.riskVariable !== "object"
    || typeof input.methodology?.id !== "string" || !input.methodology.id.trim()
    || typeof input.methodology?.description !== "string" || !input.methodology.description.trim()
    || typeof input.priority?.level !== "string" || !input.priority.level.trim()
    || typeof input.priority?.basis !== "string" || !input.priority.basis.trim()
    || !input.result || typeof input.result !== "object"
    || typeof input.recommendation?.riskIdentified !== "string" || !input.recommendation.riskIdentified.trim()
    || typeof input.recommendation?.potentialConsequence !== "string" || !input.recommendation.potentialConsequence.trim()
    || typeof input.recommendation?.proposedAction !== "string" || !input.recommendation.proposedAction.trim()
    || typeof input.recommendation?.expectedBenefit !== "string" || !input.recommendation.expectedBenefit.trim()) return null;
  if (["contractualFacts", "verifiedObservations", "userAssumptions", "missingInformation", "limitations"].some(
    (field) => input[field] !== undefined && !Array.isArray(input[field]),
  )) return null;

  const assessmentTimestamp = input.assessmentTimestamp || new Date().toISOString();
  if (typeof assessmentTimestamp !== "string" || !Number.isFinite(Date.parse(assessmentTimestamp))) return null;

  const contractualEvidence = Array.isArray(input.evidence?.contractual)
    ? input.evidence.contractual.filter(isVerifiedEvidence)
    : [];
  if (!contractualEvidence.length) return null;

  const operationalEvidence = Array.isArray(input.evidence?.operational)
    ? input.evidence.operational.filter(isVerifiedEvidence)
    : [];
  const externalEvidence = Array.isArray(input.evidence?.external)
    ? input.evidence.external.filter(isVerifiedEvidence)
    : [];
  const forecastEvidence = Array.isArray(input.evidence?.forecast)
    ? input.evidence.forecast.filter(isVerifiedEvidence)
    : [];
  const recommendationEvidence = [...new Map(
    [...contractualEvidence, ...operationalEvidence, ...externalEvidence, ...forecastEvidence]
      .map((item) => [item.evidenceId, item]),
  ).values()];

  return {
    frameworkVersion: 1,
    id: input.id,
    category: input.category,
    status: input.status,
    contract: {
      contractId: input.contractId,
      contractTitle: input.contractTitle || "Contract",
      organizationId: input.organizationId,
      analysisRunId: input.analysisRunId,
      documentVersionId: input.documentVersionId,
    },
    obligation: {
      obligationId: input.obligationId || null,
      description: input.obligationDescription || null,
      linkStatus: input.obligationId ? "linked" : "not_linked",
    },
    clause: {
      clauseId: input.clauseId,
      clauseNumber: input.clauseNumber || null,
      title: input.clauseTitle || null,
    },
    riskVariable: input.riskVariable,
    methodology: input.methodology,
    dataFreshness: input.dataFreshness && typeof input.dataFreshness === "object"
      ? input.dataFreshness
      : {
        status: "not_assessed",
        assessedAsOf: input.assessmentAsOf || null,
        latestObservationDate: null,
        ageDays: null,
        maxAgeDays: null,
        sourceName: null,
      },
    calculationInputs: {
      contractualFacts: input.contractualFacts || [],
      verifiedObservations: input.verifiedObservations || [],
      userAssumptions: input.userAssumptions || [],
      missingInformation: [...new Set(input.missingInformation || [])],
    },
    result: input.result,
    severity: {
      level: "not_scored",
      reason: "No validated cross-category severity score is defined; exposure types remain separate.",
    },
    priority: input.priority,
    recommendation: {
      riskIdentified: input.recommendation.riskIdentified,
      supportingClause: {
        clauseId: input.clauseId,
        clauseNumber: input.clauseNumber || null,
      },
      supportingEvidence: recommendationEvidence,
      potentialConsequence: input.recommendation.potentialConsequence,
      proposedAction: input.recommendation.proposedAction,
      expectedBenefit: input.recommendation.expectedBenefit,
      priority: input.priority,
      missingInformation: [...new Set(input.missingInformation || [])],
      actionState: "recommendation_only",
      humanApprovalRequired: true,
      performedAt: null,
      advisoryOnly: true,
    },
    evidence: {
      contractual: contractualEvidence,
      operational: operationalEvidence,
      external: externalEvidence,
      forecast: forecastEvidence,
    },
    assessmentTimestamp,
    assessmentAsOf: input.assessmentAsOf || null,
    limitations: [...new Set(input.limitations || [])],
  };
}
