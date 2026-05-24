// services/portfolioRiskEngine.js

/**
 * OPERION OS
 * Portfolio Risk Intelligence Engine
 *
 * Aggregates intelligence across all contracts.
 *
 * Responsibilities:
 * - Portfolio-wide risk scoring
 * - Supplier exposure analysis
 * - Operational burden scoring
 * - Protection gap detection
 * - Risk heatmaps
 * - Contract maturity analytics
 */

const DEFAULT_RISK_WEIGHTS = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

const CRITICAL_RISK_THRESHOLD = 80;

function calculatePortfolioRisk(contracts = []) {
  try {
    if (!Array.isArray(contracts)) {
      throw new Error("Contracts must be an array");
    }

    const totalContracts = contracts.length;

    if (totalContracts === 0) {
      return emptyPortfolioResponse();
    }

    let cumulativeRiskScore = 0;
    let criticalContracts = 0;

    const riskDistribution = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const supplierExposureMap = {};

    const protectionGaps = {
      insurance: 0,
      indemnity: 0,
      limitation_of_liability: 0,
      termination: 0,
      confidentiality: 0,
      compliance: 0,
    };

    const heatmap = [];
    const maturityTerms = [];

    for (const contract of contracts) {
      const contractRisk = normalizeRiskScore(
        contract?.risk_score
      );

      cumulativeRiskScore += contractRisk;

      if (contractRisk >= CRITICAL_RISK_THRESHOLD) {
        criticalContracts++;
      }

      incrementRiskDistribution(
        riskDistribution,
        contractRisk
      );

      analyzeSupplierExposure(
        contract,
        supplierExposureMap
      );

      analyzeProtectionGaps(
        contract,
        protectionGaps
      );

      buildHeatmap(contract, heatmap);

      analyzeContractMaturity(
        contract,
        maturityTerms
      );
    }

    const portfolioRiskScore = Math.round(
      cumulativeRiskScore / totalContracts
    );

    const supplierExposure =
      buildSupplierExposureRanking(
        supplierExposureMap
      );

    const operationalBurdenScore =
      calculateOperationalBurden(contracts);

    const maturityAnalysis =
      generateMaturityAnalysis(
        maturityTerms
      );

    const highRiskVendors =
      supplierExposure
        .filter(
          (vendor) =>
            vendor.exposure_score >= 75
        )
        .slice(0, 10);

    return {
      success: true,

      portfolio_risk_score:
        portfolioRiskScore,

      total_contracts:
        totalContracts,

      critical_contracts:
        criticalContracts,

      risk_distribution:
        riskDistribution,

      supplier_exposure:
        supplierExposure,

      operational_burden_score:
        operationalBurdenScore,

      missing_protections_summary:
        protectionGaps,

      high_risk_vendors:
        highRiskVendors,

      portfolio_heatmap:
        heatmap,

      maturity_analysis:
        maturityAnalysis,
    };
  } catch (error) {
    console.error(
      "Portfolio Risk Engine Error:",
      error
    );

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Supplier Exposure Intelligence
 */
function analyzeSupplierExposure(
  contract,
  exposureMap
) {
  const supplierName =
    contract?.supplier_name ||
    contract?.vendor_name ||
    contract?.counterparty ||
    "Unknown Supplier";

  if (!exposureMap[supplierName]) {
    exposureMap[supplierName] = {
      supplier: supplierName,
      contracts: 0,
      total_liability: 0,
      cumulative_risk: 0,
      missing_insurance_contracts: 0,
      uncapped_liability_contracts: 0,
      operational_burden: 0,
    };
  }

  const supplier =
    exposureMap[supplierName];

  supplier.contracts += 1;

  const riskScore =
    normalizeRiskScore(
      contract?.risk_score
    );

  supplier.cumulative_risk +=
    riskScore;

  supplier.total_liability +=
    extractLiabilityAmount(contract);

  supplier.operational_burden +=
    extractOperationalBurden(contract);

  const clauses =
    contract?.clauses || [];

  if (isMissingInsurance(clauses)) {
    supplier.missing_insurance_contracts += 1;
  }

  if (hasUncappedLiability(clauses)) {
    supplier.uncapped_liability_contracts += 1;
  }
}

/**
 * Protection Gap Analysis
 */
function analyzeProtectionGaps(
  contract,
  gaps
) {
  const clauses =
    contract?.clauses || [];

  const clauseTypes =
    clauses.map((c) =>
      normalizeClauseType(
        c?.clause_type
      )
    );

  if (
    !containsClause(
      clauseTypes,
      "insurance"
    )
  ) {
    gaps.insurance++;
  }

  if (
    !containsClause(
      clauseTypes,
      "indemnity"
    )
  ) {
    gaps.indemnity++;
  }

  if (
    !containsClause(
      clauseTypes,
      "limitation_of_liability"
    )
  ) {
    gaps.limitation_of_liability++;
  }

  if (
    !containsClause(
      clauseTypes,
      "termination"
    )
  ) {
    gaps.termination++;
  }

  if (
    !containsClause(
      clauseTypes,
      "confidentiality"
    )
  ) {
    gaps.confidentiality++;
  }

  if (
    !containsClause(
      clauseTypes,
      "compliance"
    )
  ) {
    gaps.compliance++;
  }
}

/**
 * Heatmap Builder
 */
function buildHeatmap(
  contract,
  heatmap
) {
  heatmap.push({
    contract_id:
      contract?.id || null,

    contract_name:
      contract?.name ||
      "Unnamed Contract",

    supplier:
      contract?.supplier_name ||
      contract?.vendor_name ||
      "Unknown",

    risk_score:
      normalizeRiskScore(
        contract?.risk_score
      ),

    risk_level:
      determineRiskLevel(
        normalizeRiskScore(
          contract?.risk_score
        )
      ),

    operational_burden:
      extractOperationalBurden(
        contract
      ),

    compliance_risk:
      extractComplianceRisk(
        contract
      ),

    financial_exposure:
      extractLiabilityAmount(
        contract
      ),
  });
}

/**
 * Maturity Analytics
 */
function analyzeContractMaturity(
  contract,
  maturityTerms
) {
  const startDate =
    contract?.start_date;

  const expiryDate =
    contract?.expiry_date;

  if (!startDate || !expiryDate) {
    return;
  }

  const start =
    new Date(startDate);

  const end =
    new Date(expiryDate);

  const months =
    (end.getFullYear() -
      start.getFullYear()) *
      12 +
    (end.getMonth() -
      start.getMonth());

  maturityTerms.push({
    contract_id:
      contract?.id,

    duration_months:
      months,

    expiry_date:
      expiryDate,
  });
}

/**
 * Generate Maturity Summary
 */
function generateMaturityAnalysis(
  maturityTerms
) {
  if (!maturityTerms.length) {
    return {
      average_term_months: 0,
      expiring_within_90_days: 0,
    };
  }

  const totalMonths =
    maturityTerms.reduce(
      (sum, item) =>
        sum + item.duration_months,
      0
    );

  const now = new Date();

  const ninetyDaysFromNow =
    new Date();

  ninetyDaysFromNow.setDate(
    now.getDate() + 90
  );

  const expiringSoon =
    maturityTerms.filter((item) => {
      const expiry = new Date(
        item.expiry_date
      );

      return (
        expiry <=
        ninetyDaysFromNow
      );
    });

  return {
    average_term_months:
      Math.round(
        totalMonths /
          maturityTerms.length
      ),

    expiring_within_90_days:
      expiringSoon.length,
  };
}

/**
 * Operational Burden Intelligence
 */
function calculateOperationalBurden(
  contracts = []
) {
  if (!contracts.length) {
    return 0;
  }

  let totalBurden = 0;

  for (const contract of contracts) {
    totalBurden +=
      extractOperationalBurden(
        contract
      );
  }

  return Math.round(
    totalBurden / contracts.length
  );
}

/**
 * Supplier Exposure Ranking
 */
function buildSupplierExposureRanking(
  exposureMap
) {
  return Object.values(exposureMap)
    .map((supplier) => {
      const exposureScore =
        Math.min(
          100,
          Math.round(
            supplier.cumulative_risk /
              supplier.contracts +
              supplier.uncapped_liability_contracts *
                10 +
              supplier.missing_insurance_contracts *
                5
          )
        );

      return {
        supplier:
          supplier.supplier,

        contracts:
          supplier.contracts,

        exposure_score:
          exposureScore,

        total_liability:
          supplier.total_liability,

        operational_burden:
          supplier.operational_burden,

        missing_insurance_contracts:
          supplier.missing_insurance_contracts,

        uncapped_liability_contracts:
          supplier.uncapped_liability_contracts,
      };
    })
    .sort(
      (a, b) =>
        b.exposure_score -
        a.exposure_score
    );
}

/**
 * Helpers
 */

function normalizeRiskScore(
  score
) {
  const parsed = Number(score);

  if (isNaN(parsed)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, parsed)
  );
}

function incrementRiskDistribution(
  distribution,
  score
) {
  if (score < 25) {
    distribution.low++;
  } else if (score < 50) {
    distribution.medium++;
  } else if (score < 75) {
    distribution.high++;
  } else {
    distribution.critical++;
  }
}

function determineRiskLevel(
  score
) {
  if (score < 25) {
    return "Low";
  }

  if (score < 50) {
    return "Medium";
  }

  if (score < 75) {
    return "High";
  }

  return "Critical";
}

function normalizeClauseType(
  type = ""
) {
  return type
    .toLowerCase()
    .replace(/\s+/g, "_")
    .trim();
}

function containsClause(
  clauseTypes,
  target
) {
  return clauseTypes.includes(
    target
  );
}

function extractLiabilityAmount(
  contract
) {
  if (!contract) {
    return 0;
  }

  if (contract?.value) {
    return (
      Number(contract.value) || 0
    );
  }

  if (contract?.contract_value) {
    return (
      Number(
        contract.contract_value
      ) || 0
    );
  }

  return 0;
}

function extractOperationalBurden(
  contract
) {
  const obligations =
    contract?.obligations || [];

  if (
    !Array.isArray(obligations)
  ) {
    return 0;
  }

  let burden =
    obligations.length * 5;

  for (const obligation of obligations) {
    const severity =
      obligation?.severity ||
      obligation?.risk_level ||
      "Low";

    burden +=
      DEFAULT_RISK_WEIGHTS[
        severity
      ] || 1;
  }

  return Math.min(100, burden);
}

function extractComplianceRisk(
  contract
) {
  const clauses =
    contract?.clauses || [];

  let score = 0;

  for (const clause of clauses) {
    const type =
      normalizeClauseType(
        clause?.clause_type
      );

    if (
      type.includes("gdpr") ||
      type.includes("faa") ||
      type.includes("easa") ||
      type.includes("imo") ||
      type.includes("compliance")
    ) {
      score += 15;
    }
  }

  return Math.min(100, score);
}

function isMissingInsurance(
  clauses = []
) {
  return !clauses.some(
    (clause) =>
      normalizeClauseType(
        clause?.clause_type
      ).includes(
        "insurance"
      )
  );
}

function hasUncappedLiability(
  clauses = []
) {
  return clauses.some(
    (clause) => {
      const text = (
        clause?.clause_text || ""
      ).toLowerCase();

      return (
        text.includes(
          "unlimited liability"
        ) ||
        text.includes(
          "uncapped liability"
        ) ||
        text.includes(
          "without limitation"
        )
      );
    }
  );
}

function emptyPortfolioResponse() {
  return {
    portfolio_risk_score: 0,

    total_contracts: 0,

    critical_contracts: 0,

    risk_distribution: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    },

    supplier_exposure: [],

    operational_burden_score: 0,

    missing_protections_summary: {
      insurance: 0,
      indemnity: 0,
      limitation_of_liability: 0,
      termination: 0,
      confidentiality: 0,
      compliance: 0,
    },

    high_risk_vendors: [],

    portfolio_heatmap: [],

    maturity_analysis: {
      average_term_months: 0,
      expiring_within_90_days: 0,
    },
  };
}

export {
  calculatePortfolioRisk,
  calculateOperationalBurden,
  generateMaturityAnalysis,
  buildSupplierExposureRanking,
};
