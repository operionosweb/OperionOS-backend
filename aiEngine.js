import { requestLegacyAI } from "./services/ai/legacyAIRequest.js";

/* ===============================
   MAIN ENGINE
=============================== */

export async function analyzeContract(text, organizationId) {
  const result = await requestLegacyAI({
    organizationId,
    operation: "full_contract_analysis",
    input: text,
    system: "You are a legal aviation contract intelligence engine. Return structured JSON only.",
  });
  return result.result;
}
