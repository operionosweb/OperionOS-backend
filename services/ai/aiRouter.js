import { requestLegacyAI } from "./legacyAIRequest.js";

export async function runAIAnalysis({ prompt, contractType, riskScore, organizationId, confirmation = false }) {
  const result = await requestLegacyAI({
    organizationId,
    operation: Number(riskScore || 0) >= 70 ? "risk_reasoning" : "clause_interpretation",
    input: prompt,
    confirmation,
    structured: false,
    system: `You are Operion's aviation contract intelligence assistant. Contract type: ${contractType || "unknown"}. Return the requested answer.`,
  });
  return { success: true, provider_used: result.job?.provider || "cache", output: result.result, source: result.source };
}
