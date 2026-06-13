import supabase from "../supabaseClient.js";

/**
 * =========================================
 * CONTRACT ECONOMICS ENGINE (AIRLINE ROI)
 * =========================================
 */

export async function calculateContractEconomics({
  contract_id,
  company_id,
  clauses = [],
  risk_level = "MEDIUM",
}) {
  try {
    /**
     * =========================
     * BASE ASSUMPTIONS (MVP MODEL)
     * =========================
     */

    const baseLeaseCost = 1000000; // per contract baseline (mock model)
    const maintenanceMultiplier = 1.2;
    const riskMultiplier = {
      LOW: 0.9,
      MEDIUM: 1.0,
      HIGH: 1.3,
      CRITICAL: 1.8,
    };

    /**
     * =========================
     * CLAUSE SCORING
     * =========================
     */

    let maintenanceRisk = 0;
    let financialRisk = 0;
    let operationalRisk = 0;

    for (const clause of clauses) {
      const text = (clause?.clause || "").toLowerCase();

      if (text.includes("maintenance")) maintenanceRisk += 2;
      if (text.includes("penalty")) financialRisk += 3;
      if (text.includes("downtime")) operationalRisk += 2;
      if (text.includes("return condition")) operationalRisk += 3;
      if (text.includes("engine")) maintenanceRisk += 2;
    }

    /**
     * =========================
     * RISK SCORE MODEL
     * =========================
     */

    const riskScore =
      maintenanceRisk + financialRisk + operationalRisk;

    const normalizedRiskScore = Math.min(100, riskScore * 5);

    /**
     * =========================
     * COST IMPACT MODEL
     * =========================
     */

    const riskFactor = riskMultiplier[risk_level] || 1.0;

    const estimatedCost =
      baseLeaseCost *
      maintenanceMultiplier *
      riskFactor *
      (1 + normalizedRiskScore / 100);

    /**
     * =========================
     * ROI CLASSIFICATION
     * =========================
     */

    let recommendation = "ACCEPT";

    if (estimatedCost > 2000000) recommendation = "RENEGOTIATE";
    if (estimatedCost > 3000000) recommendation = "REJECT";

    /**
     * =========================
     * SAVE ECONOMIC ANALYSIS
     * =========================
     */

    const { error } = await supabase.from("contract_economics").insert([
      {
        contract_id,
        company_id,
        risk_level,
        risk_score: normalizedRiskScore,
        estimated_cost: estimatedCost,
        recommendation,
        maintenance_risk: maintenanceRisk,
        financial_risk: financialRisk,
        operational_risk: operationalRisk,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;

    return {
      success: true,
      risk_score: normalizedRiskScore,
      estimated_cost: estimatedCost,
      recommendation,
      breakdown: {
        maintenanceRisk,
        financialRisk,
        operationalRisk,
      },
    };
  } catch (err) {
    console.error("❌ ECONOMICS ENGINE ERROR:", err.message);

    return {
      success: false,
      error: err.message,
    };
  }
}