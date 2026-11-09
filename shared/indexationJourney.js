import { parseIndexationTerms, calculateIndexation } from "./aviationIndexation.js";

export const SYNTHETIC_INDEXATION = Object.freeze({
  contractRouteId: "demo-mro-agreement",
  contractId: "SYN-MRO-2026-74",
  documentVersionId: "synthetic-mro-v1",
  clauseId: "cl-mro-indexation",
  evidenceId: "ev-mro-indexation",
  observationEvidenceId: "ev-mro-index",
  excerpt: "Annual CPI indexation. Index series: CUUR0000SA0. Baseline price: USD 100,000 per year. Index baseline: 300 for 2025-09. Observation period: 2026-09. Indexed share: 80%. Adjustment formula: baseline price * (1 + indexed share * (current index / baseline index - 1)). Adjustment cap: 3%. Adjustment floor: 0%. Adjustment applies only when absolute index change exceeds 1%. Adjustment frequency: annual. Adjustment date: 2027-01-01. Notice: 30 days before adjustment. Customer shall pay the revised price.",
  observation: Object.freeze({
    value: 315, period: "2026-09", publicationTimestamp: "2026-10-15T12:30:00Z",
    synthetic: true, verification: "synthetic_reviewed_example_not_official_data",
  }),
  disclosure: "SYNTHETIC DEMO ONLY. All prices, index levels, publication dates and review states are fabricated for this example, not BLS data or customer records. Not a forecast, invoice or net recoverable exposure.",
});

export function calculateSyntheticIndexation(indexValue = SYNTHETIC_INDEXATION.observation.value) {
  const terms = parseIndexationTerms(SYNTHETIC_INDEXATION.excerpt);
  return {
    ...calculateIndexation(terms, indexValue), terms,
    synthetic: true, documentVersionId: SYNTHETIC_INDEXATION.documentVersionId,
    evidenceIds: [SYNTHETIC_INDEXATION.evidenceId, SYNTHETIC_INDEXATION.observationEvidenceId],
    disclosure: SYNTHETIC_INDEXATION.disclosure,
  };
}
