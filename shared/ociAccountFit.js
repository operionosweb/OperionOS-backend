export const OCI_ACCOUNT_FIT_CRITERIA = Object.freeze([
  { key: "fitContractComplexity", label: "Contract complexity", weight: 1.3 },
  { key: "fitContractVolume", label: "Likely contract volume", weight: 1.2 },
  { key: "fitAviationRelevance", label: "Aviation relevance", weight: 1.5 },
  { key: "fitFinancialExposure", label: "Potential financial exposure", weight: 1.3 },
  { key: "fitOperationalComplexity", label: "Operational complexity", weight: 1.2 },
  { key: "fitGeographicPriority", label: "Geographic priority", weight: 1 },
  { key: "fitDecisionMakerAccess", label: "Identifiable decision-makers", weight: 1.1 },
  { key: "fitEvidenceQuality", label: "Evidence quality", weight: 1.4 },
  { key: "fitCommercialAccessibility", label: "Commercial accessibility", weight: 1 },
]);

export const OCI_ACCOUNT_FIT_RATINGS = Object.freeze([
  "Unknown",
  "Hypothesis — Low", "Hypothesis — Medium", "Hypothesis — High",
  "Verified — Low", "Verified — Medium", "Verified — High",
]);

const points = Object.freeze({ Low: 1, Medium: 2, High: 3 });
const minimumAssessments = 3;

export function scoreOciAccountFit(data = {}) {
  const assessments = OCI_ACCOUNT_FIT_CRITERIA.flatMap((criterion) => {
    const value = data[criterion.key] || "Unknown";
    if (value === "Unknown") return [];
    const match = /^(Verified|Hypothesis) — (Low|Medium|High)$/.exec(value);
    if (!match) return [];
    return [{ ...criterion, confidence: match[1], level: match[2], points: points[match[2]] }];
  });
  const evidenceRecorded = typeof data.fitEvidence === "string" && data.fitEvidence.trim().length > 0;
  const weight = assessments.reduce((sum, item) => sum + item.weight, 0);
  const weightedPoints = assessments.reduce((sum, item) => sum + item.points * item.weight, 0);
  return {
    score: assessments.length >= minimumAssessments && evidenceRecorded
      ? Math.round(weightedPoints / (weight * 3) * 100) : null,
    assessed: assessments.length,
    unknown: OCI_ACCOUNT_FIT_CRITERIA.length - assessments.length,
    verified: assessments.filter((item) => item.confidence === "Verified").length,
    hypotheses: assessments.filter((item) => item.confidence === "Hypothesis").length,
    evidenceRecorded,
    assessments,
    criteriaCount: OCI_ACCOUNT_FIT_CRITERIA.length,
    minimumAssessments,
  };
}
