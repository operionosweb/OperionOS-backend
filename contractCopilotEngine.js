import { requestLegacyAI } from "./services/ai/legacyAIRequest.js";
import redis from "./services/redisClient.js";
import { logDecisionTrace } from "./services/auditEngine.js";
import { explainDecision } from "./services/explainabilityEngine.js";

/**
 * =========================================
 * SAFE PARSER
 * =========================================
 */

function safeParse(text) {
  if (!text || typeof text !== "string") return null;

  try {
    return JSON.parse(text);
  } catch {
    try {
      const match = text.match(/{[\s\S]*}/);
      if (match) return JSON.parse(match[0]);
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * =========================================
 * LLM CALL
 * =========================================
 */

async function callLLM(prompt, organizationId) {
  const response = await requestLegacyAI({ organizationId, operation: "risk_reasoning", input: prompt, structured: false });
  return response.result;
}

/**
 * =========================================
 * MAIN ENGINE (AUDIT ENABLED)
 * =========================================
 */

export async function generateContractCopilot({
  contract,
  tenant,
  organizationId = tenant?.org_id,
}) {
  try {
    const prompt = `
Return ONLY JSON.

CONTRACT:
${JSON.stringify(contract?.clauses || []).slice(0, 12000)}
`;

    const raw = await callLLM(prompt, organizationId);
    const parsed = safeParse(raw);

    if (!parsed) {
      return {
        decision_chain: [],
        risk_level: "MEDIUM",
      };
    }

    /**
     * =========================================
     * AUDIT LOGGING (CRITICAL 10B FEATURE)
     * =========================================
     */

    await logDecisionTrace({
      contract_id: contract?.id || "unknown",
      tenant_id: organizationId,
      input: contract,
      output: parsed,
      model: "mistral-large",
    });

    /**
     * =========================================
     * EXPLAINABILITY LAYER
     * =========================================
     */

    const explanations = explainDecision(parsed?.decision_chain);

    return {
      ...parsed,
      explanations,
    };
  } catch (err) {
    console.error("COPILOT ERROR:", err.message);

    return {
      decision_chain: [],
      risk_level: "MEDIUM",
      explanations: [],
    };
  }
}