import axios from "axios";
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

async function callLLM(prompt) {
  if (process.env.MISTRAL_API_KEY) {
    const res = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-large-latest",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
        },
      }
    );

    return res.data?.choices?.[0]?.message?.content;
  }

  throw new Error("No LLM");
}

/**
 * =========================================
 * MAIN ENGINE (AUDIT ENABLED)
 * =========================================
 */

export async function generateContractCopilot({
  contract,
  tenant,
}) {
  try {
    const prompt = `
Return ONLY JSON.

CONTRACT:
${JSON.stringify(contract?.clauses || []).slice(0, 12000)}
`;

    const raw = await callLLM(prompt);
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
      tenant_id: tenant?.org_id || "default",
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