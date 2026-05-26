// services/portfolioRiskEngine.js

import supabase from "../config/supabase.js";

/**
 * =========================================
 * OPERION OS
 * PORTFOLIO RISK ENGINE
 * =========================================
 */

export async function calculatePortfolioRisk() {
  try {
    /**
     * -----------------------------------------
     * LOAD CONTRACTS
     * -----------------------------------------
     */

    const { data, error } = await supabase
      .from("contracts")
      .select("*");

    if (error) {
      throw error;
    }

    const contracts = data || [];

    /**
     * -----------------------------------------
     * EMPTY PORTFOLIO
     * -----------------------------------------
     */

    if (contracts.length === 0) {
      return {
        total_contracts: 0,
        average_risk_score: 0,
        high_risk_contracts: 0,
        medium_risk_contracts: 0,
        low_risk_contracts: 0,
        top_suppliers: [],
        portfolio_health: "empty",
      };
    }

    /**
     * -----------------------------------------
     * METRICS
     * -----------------------------------------
     */

    let totalRisk = 0;

    let highRisk = 0;
    let mediumRisk = 0;
    let lowRisk = 0;

    const supplierMap = {};

    for (const contract of contracts) {
      const risk =
        Number(contract.risk_score) || 0;

      totalRisk += risk;

      /**
       * RISK BUCKETS
       */

      if (risk >= 70) {
        highRisk++;
      } else if (risk >= 40) {
        mediumRisk++;
      } else {
        lowRisk++;
      }

      /**
       * SUPPLIER AGGREGATION
       */

      const supplier =
        contract.supplier_name ||
        "Unknown Supplier";

      if (!supplierMap[supplier]) {
        supplierMap[supplier] = 0;
      }

      supplierMap[supplier]++;
    }

    /**
     * -----------------------------------------
     * AVERAGES
     * -----------------------------------------
     */

    const averageRisk =
      totalRisk / contracts.length;

    /**
     * -----------------------------------------
     * TOP SUPPLIERS
     * -----------------------------------------
     */

    const topSuppliers = Object.entries(
      supplierMap
    )
      .map(([supplier, count]) => ({
        supplier,
        contracts: count,
      }))
      .sort((a, b) => b.contracts - a.contracts)
      .slice(0, 5);

    /**
     * -----------------------------------------
     * HEALTH STATUS
     * -----------------------------------------
     */

    let portfolioHealth = "healthy";

    if (averageRisk >= 70) {
      portfolioHealth = "critical";
    } else if (averageRisk >= 50) {
      portfolioHealth = "warning";
    }

    /**
     * -----------------------------------------
     * RESPONSE
     * -----------------------------------------
     */

    return {
      total_contracts: contracts.length,

      average_risk_score:
        Math.round(averageRisk),

      high_risk_contracts: highRisk,

      medium_risk_contracts: mediumRisk,

      low_risk_contracts: lowRisk,

      top_suppliers: topSuppliers,

      portfolio_health:
        portfolioHealth,
    };
  } catch (error) {
    console.error(
      "calculatePortfolioRisk error:",
      error
    );

    return {
      total_contracts: 0,
      average_risk_score: 0,
      high_risk_contracts: 0,
      medium_risk_contracts: 0,
      low_risk_contracts: 0,
      top_suppliers: [],
      portfolio_health: "error",
      error:
        error.message ||
        "Portfolio analysis failed",
    };
  }
}
