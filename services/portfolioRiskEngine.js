// services/portfolioRiskEngine.js

/**
 * =========================================
 * OPERION OS
 * PORTFOLIO RISK INTELLIGENCE ENGINE
 * =========================================
 */

/**
 * -----------------------------------------
 * CALCULATE PORTFOLIO METRICS
 * -----------------------------------------
 */

export function analyzePortfolioRisk(contracts = []) {
  try {
    /**
     * -----------------------------------------
     * BASIC TOTALS
     * -----------------------------------------
     */

    const totalContracts = contracts.length;

    const averageRisk =
      totalContracts === 0
        ? 0
        : Math.round(
            contracts.reduce(
              (sum, c) => sum + (c.risk_score || 0),
              0
            ) / totalContracts
          );

    /**
     * -----------------------------------------
     * HIGH RISK CONTRACTS
     * -----------------------------------------
     */

    const highRiskContracts = contracts.filter(
      (c) => (c.risk_score || 0) >= 70
    );

    /**
     * -----------------------------------------
     * CONTRACT TYPES
     * -----------------------------------------
     */

    const contractTypes = {};

    for (const contract of contracts) {
      const type =
        contract.contract_type || "Unknown";

      contractTypes[type] =
        (contractTypes[type] || 0) + 1;
    }

    /**
     * -----------------------------------------
     * TOP SUPPLIERS
     * -----------------------------------------
     */

    const supplierMap = {};

    for (const contract of contracts) {
      const supplier =
        contract.supplier_name || "Unknown";

      supplierMap[supplier] =
        (supplierMap[supplier] || 0) + 1;
    }

    /**
     * -----------------------------------------
     * TOP RISKY CONTRACTS
     * -----------------------------------------
     */

    const topRisks = [...contracts]
      .sort(
        (a, b) =>
          (b.risk_score || 0) -
          (a.risk_score || 0)
      )
      .slice(0, 5);

    /**
     * -----------------------------------------
     * RETURN
     * -----------------------------------------
     */

    return {
      success: true,

      total_contracts: totalContracts,

      average_risk_score: averageRisk,

      high_risk_contracts: highRiskContracts.length,

      contract_types: contractTypes,

      supplier_distribution: supplierMap,

      top_risky_contracts: topRisks,

      generated_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error(
      "Portfolio Risk Engine Error:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Portfolio analysis failed",
    };
  }
}
