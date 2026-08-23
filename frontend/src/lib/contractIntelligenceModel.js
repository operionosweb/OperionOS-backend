export const INTELLIGENCE_AVAILABILITY = {
  AVAILABLE: "available",
  UNAVAILABLE: "unavailable",
  PENDING: "pending",
  EMPTY: "empty",
};

export const CONTRACT_INTELLIGENCE_TYPES = {
  CONTRACT: "contract",
  DOCUMENT: "document",
  ANALYSIS: "analysis",
  CLAUSE: "clause",
  OBLIGATION: "obligation",
  DEADLINE: "deadline",
  RISK: "risk",
  EVIDENCE: "evidence",
  RECOMMENDATION: "recommendation",
};

export const CONTRACT_INTELLIGENCE_HIERARCHY = [
  { id: "contract", label: "Contract", type: CONTRACT_INTELLIGENCE_TYPES.CONTRACT },
  { id: "document", label: "Document", type: CONTRACT_INTELLIGENCE_TYPES.DOCUMENT, parent: "contract" },
  { id: "analysis", label: "Analysis", type: CONTRACT_INTELLIGENCE_TYPES.ANALYSIS, parent: "document" },
  { id: "clauses", label: "Clauses", type: CONTRACT_INTELLIGENCE_TYPES.CLAUSE, parent: "analysis" },
  { id: "obligations", label: "Obligations", type: CONTRACT_INTELLIGENCE_TYPES.OBLIGATION, parent: "clauses" },
  { id: "deadlines", label: "Deadlines", type: CONTRACT_INTELLIGENCE_TYPES.DEADLINE, parent: "obligations" },
  { id: "risks", label: "Risks", type: CONTRACT_INTELLIGENCE_TYPES.RISK, parent: "analysis" },
  { id: "evidence", label: "Evidence", type: CONTRACT_INTELLIGENCE_TYPES.EVIDENCE, parent: "obligations" },
  { id: "recommendations", label: "Recommendations", type: CONTRACT_INTELLIGENCE_TYPES.RECOMMENDATION, parent: "analysis" },
];

export function deriveAvailabilityState({ isExposed = false, isLoading = false, items } = {}) {
  if (isLoading) return INTELLIGENCE_AVAILABILITY.PENDING;
  if (!isExposed) return INTELLIGENCE_AVAILABILITY.UNAVAILABLE;
  if (Array.isArray(items) && items.length === 0) return INTELLIGENCE_AVAILABILITY.EMPTY;
  return INTELLIGENCE_AVAILABILITY.AVAILABLE;
}
