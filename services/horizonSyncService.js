import { generateContractCopilot } from "../contractCopilotEngine.js";

/**
 * =========================================
 * HORIZON SYNC LAYER (FRONTEND CONTRACT API)
 * =========================================
 *
 * Purpose:
 * - Normalize backend AI output for UI consumption
 * - Ensure Horizon dashboard never breaks on schema changes
 * - Provide stable contract intelligence contract
 */

export async function buildHorizonPayload({
  contract,
  tenant,
}) {
  try {
    const result = await generateContractCopilot({
      contract,
      tenant,
    });

    /**
     * =========================
     * NORMALIZATION LAYER
     * =========================
     */

    const decision_chain = result?.decision_chain || [];

    const risk_level = result?.risk_level || "MEDIUM";

    const executive_summary =
      result?.executive_summary ||
      "No summary available";

    const economics = result?.economics || null;

    /**
     * =========================
     * UI-SAFE TRANSFORMATION
     * =========================
     */

    const operational_summary = {
      total_clauses: decision_chain.length,
      high_risk_items: decision_chain.filter(
        (c) =>
          (c?.risk_trigger || "").toLowerCase().includes("fail") ||
          (c?.operational_consequence || "")
            .toLowerCase()
            .includes("grounded")
      ).length,
      owners: [
        ...new Set(decision_chain.map((c) => c.owner).filter(Boolean)),
      ],
    };

    /**
     * =========================
     * FRONTEND PAYLOAD
     * =========================
     */

    return {
      success: true,

      contract_intelligence: {
        executive_summary,
        risk_level,
        decision_chain,
      },

      economics,

      dashboard: {
        operational_summary,
        risk_level,
        readiness_score: calculateReadinessScore(
          decision_chain,
          risk_level
        ),
      },

      meta: {
        generated_at: new Date().toISOString(),
        version: "horizon-sync-v1",
      },
    };
  } catch (err) {
    console.error("❌ HORIZON SYNC ERROR:", err.message);

    return {
      success: false,
      error: "Horizon sync failed",
      fallback: true,
    };
  }
}

/**
 * =========================================
 * READINESS SCORE MODEL (UI KPI)
 * =========================================
 */

function calculateReadinessScore(decision_chain, risk_level) {
  let base = 100;

  if (risk_level === "HIGH") base -= 25;
  if (risk_level === "CRITICAL") base -= 50;

  const riskPenalty =
    decision_chain.filter((c) =>
      (c?.risk_trigger || "").toLowerCase().includes("fail")
    ).length * 5;

  return Math.max(0, base - riskPenalty);
}