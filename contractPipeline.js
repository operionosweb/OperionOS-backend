import { extractClauses } from "./services/clauseExtractionService.js";
import { extractObligations } from "./services/obligationExtractor.js";

export function processContract(text) {
  if (!text || typeof text !== "string") {
    return {
      clauses: [],
      obligations: [],
      stats: {
        clausesDetected: 0,
        obligationsDetected: 0,
      },
    };
  }

  // STEP 1: Extract raw clauses
  const rawClauses = extractClauses(text);

  // STEP 2: HARD NORMALIZATION (CRITICAL FIX)
  const clausesArray = Array.isArray(rawClauses)
    ? rawClauses
    : rawClauses && typeof rawClauses === "object"
      ? Object.values(rawClauses)
      : [];

  // STEP 3: STRUCTURE SANITIZATION
  const clauses = clausesArray
    .filter(Boolean)
    .map((c, i) => ({
      id: c.id || `clause_${i}`,
      contract_id: c.contract_id || null,
      clause_text: typeof c.clause_text === "string" ? c.clause_text : "",
    }))
    .filter(c => c.clause_text.trim().length > 10);

  // STEP 4: OBLI­GATIONS (NOW SAFE INPUT)
  const obligations = extractObligations(clauses);

  return {
    clauses,
    obligations,
    stats: {
      clausesDetected: clauses.length,
      obligationsDetected: obligations.length,
    },
  };
}
