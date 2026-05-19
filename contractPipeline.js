import { extractClauses } from "./services/clauseExtractionService.js";
import { extractObligations } from "./services/obligationExtractor.js";

export async function processContract(contract) {
  try {
    const text = contract?.extracted_text || "";

    if (!text) {
      return {
        success: false,
        error: "No extracted text found in contract",
      };
    }

    // STEP 1: Extract clauses
    let rawClauses = await extractClauses(text);

    // 🔧 FIX: normalize clauses into array ALWAYS
    const clauses = Array.isArray(rawClauses)
      ? rawClauses
      : rawClauses?.clauses
      ? rawClauses.clauses
      : Object.values(rawClauses || {});

    // STEP 2: Ensure clause structure consistency
    const normalizedClauses = clauses
      .filter((c) => c && typeof c === "object")
      .map((c, index) => ({
        id: c.id || `clause_${index}`,
        contract_id: contract.id,
        clause_text: c.clause_text || c.text || c.content || "",
      }))
      .filter((c) => c.clause_text.length > 0);

    // STEP 3: Extract obligations (NOW GUARANTEED ARRAY INPUT)
    const obligations = extractObligations(normalizedClauses);

    // STEP 4: Optional debug logging
    console.log("Clauses extracted:", normalizedClauses.length);
    console.log("Obligations extracted:", obligations.length);

    // STEP 5: Return structured result
    return {
      success: true,
      contract,
      clauses: normalizedClauses,
      obligations,
      clausesDetected: normalizedClauses.length,
      obligationsDetected: obligations.length,
    };
  } catch (error) {
    console.error("Contract pipeline error:", error);

    return {
      success: false,
      error: error.message || "Unknown pipeline error",
    };
  }
}
