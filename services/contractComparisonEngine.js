// services/contractComparisonEngine.js

/**
 * OPERION OS
 * Contract Comparison & Benchmark Intelligence Engine
 *
 * Responsibilities:
 * - Cross-contract comparison
 * - Abnormal clause detection
 * - Portfolio benchmarking
 * - Deviation scoring
 * - Liability outlier analysis
 * - Operational burden comparison
 */

const STANDARD_CLAUSES = [
  "insurance",
  "indemnity",
  "limitation_of_liability",
  "termination",
  "confidentiality",
  "compliance",
  "force_majeure",
  "governing_law",
];

const HIGH_RISK_TERMS = [
  "unlimited liability",
  "uncapped liability",
  "without limitation",
  "sole discretion",
  "irrevocable",
  "non-cancellable",
];

function compareContracts(contractA = {}, contractB = {}) {
  try {
    const clausesA = normalizeClauseCollection(
      contractA?.clauses || []
    );

    const clausesB = normalizeClauseCollection(
      contractB?.clauses || []
    );

    const clauseTypesA = clausesA.map(
      (c) => c.normalized_type
    );

    const clauseTypesB = clausesB.map(
      (c) => c.normalized_type
    );

    const sharedClauses = clauseTypesA.filter((type) =>
      clauseTypesB.includes(type)
    );

    const missingFromA = clauseTypesB.filter(
      (type) => !clauseTypesA.includes(type)
    );

    const missingFromB = clauseTypesA.filter(
      (type) => !clauseTypesB.includes(type)
    );

    const riskScoreA = normalizeRiskScore(
      contractA?.risk_score
    );

    const riskScoreB = normalizeRiskScore(
      contractB?.risk_score
    );

    return {
      contract_a: {
        id: contractA?.id || null,
        name: contractA?.name || "Contract A",
        risk_score: riskScoreA,
      },

      contract_b: {
        id: contractB?.id || null,
        name: contractB?.name || "Contract B",
        risk_score: riskScoreB,
      },

      shared_clauses: sharedClauses,

      missing_clauses: {
        missing_from_contract_a: missingFromA,
        missing_from_contract_b: missingFromB,
      },

      risk_score_difference: Math.abs(
        riskScoreA - riskScoreB
      ),

      liability_difference: {
        contract_a_liability:
          extractLiabilityAmount(contractA),

        contract_b_liability:
          extractLiabilityAmount(contractB),

        difference:
          Math.abs(
            extractLiabilityAmount(contractA) -
              extractLiabilityAmount(contractB)
          ),
      },

      obligation_difference: {
        contract_a_obligations:
          countObligations(contractA),

        contract_b_obligations:
          countObligations(contractB),

        difference:
          Math.abs(
            countObligations(contractA) -
              countObligations(contractB)
          ),
      },

      operational_burden_difference: {
        contract_a_burden:
          calculateOperationalBurden(contractA),

        contract_b_burden:
          calculateOperationalBurden(contractB),
      },
    };
  } catch (error) {
    console.error(
      "compareContracts() Error:",
      error.message
    );

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Portfolio-wide abnormal clause detection
 */
function findAbnormalClauses(contracts = []) {
  try {
    const abnormalities = [];

    for (const contract of contracts) {
      const clauses = normalizeClauseCollection(
        contract?.clauses || []
      );

      for (const clause of clauses) {
        const text = (
          clause?.clause_text || ""
        ).toLowerCase();

        /**
         * Uncapped liability
         */
        if (
          text.includes("unlimited liability") ||
          text.includes("uncapped liability") ||
          text.includes("without limitation")
        ) {
          abnormalities.push({
            contract_id: contract?.id || null,
            contract_name:
              contract?.name || "Unnamed Contract",

            clause_type: clause.normalized_type,

            abnormality_reason:
              "Uncapped liability exposure",

            severity: "Critical",
          });
        }

        /**
         * Missing insurance
         */
        if (
          !containsClause(
            clauses,
            "insurance"
          )
        ) {
          abnormalities.push({
            contract_id: contract?.id || null,
            contract_name:
              contract?.name || "Unnamed Contract",

            clause_type: "insurance",

            abnormality_reason:
              "Missing insurance protection",

            severity: "High",
          });
        }

        /**
         * Weak termination rights
         */
        if (
          clause.normalized_type === "termination" &&
          text.includes("sole discretion")
        ) {
          abnormalities.push({
            contract_id: contract?.id || null,
            contract_name:
              contract?.name || "Unnamed Contract",

            clause_type: "termination",

            abnormality_reason:
              "One-sided termination rights",

            severity: "High",
          });
        }

        /**
         * Excessive notice periods
         */
        if (
          clause.normalized_type === "termination" &&
          detectExcessiveNoticePeriod(text)
        ) {
          abnormalities.push({
            contract_id: contract?.id || null,
            contract_name:
              contract?.name || "Unnamed Contract",

            clause_type: "termination",

            abnormality_reason:
              "Excessive notice period detected",

            severity: "Medium",
          });
        }

        /**
         * Weak indemnity language
         */
        if (
          clause.normalized_type === "indemnity" &&
          detectWeakIndemnity(text)
        ) {
          abnormalities.push({
            contract_id: contract?.id || null,
            contract_name:
              contract?.name || "Unnamed Contract",

            clause_type: "indemnity",

            abnormality_reason:
              "Weak indemnity protections",

            severity: "High",
          });
        }
      }
    }

    return abnormalities;
  } catch (error) {
    console.error(
      "findAbnormalClauses() Error:",
      error.message
    );

    return [];
  }
}

/**
 * Portfolio deviation scoring
 */
function calculateDeviationScore(
  contract = {},
  portfolio = []
) {
  try {
    if (!portfolio.length) {
      return {
        deviation_score: 0,
      };
    }

    const portfolioAverageRisk =
      calculateAveragePortfolioRisk(portfolio);

    const contractRisk = normalizeRiskScore(
      contract?.risk_score
    );

    const riskDeviation = Math.abs(
      contractRisk - portfolioAverageRisk
    );

    const clauses =
      normalizeClauseCollection(
        contract?.clauses || []
      );

    let missingStandards = 0;

    for (const standardClause of STANDARD_CLAUSES) {
      if (
        !containsClause(
          clauses,
          standardClause
        )
      ) {
        missingStandards += 1;
      }
    }

    const abnormalClauseCount =
      detectAbnormalTerms(clauses);

    const deviationScore = Math.min(
      100,
      Math.round(
        riskDeviation +
          missingStandards * 8 +
          abnormalClauseCount * 12
      )
    );

    return {
      contract_id: contract?.id || null,

      contract_name:
        contract?.name || "Unnamed Contract",

      portfolio_average_risk:
        portfolioAverageRisk,

      contract_risk: contractRisk,

      missing_standard_clauses:
        missingStandards,

      abnormal_clause_count:
        abnormalClauseCount,

      deviation_score: deviationScore,

      benchmark_variance:
        deviationScore >= 70
          ? "High"
          : deviationScore >= 40
          ? "Moderate"
          : "Low",
    };
  } catch (error) {
    console.error(
      "calculateDeviationScore() Error:",
      error.message
    );

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Benchmark clause prevalence across portfolio
 */
function benchmarkClauseStructures(
  contracts = []
) {
  try {
    if (!contracts.length) {
      return emptyBenchmarkResponse();
    }

    const benchmark = {
      total_contracts: contracts.length,

      clause_prevalence: {},

      uncapped_liability_percentage: 0,

      missing_insurance_percentage: 0,

      average_risk_score: 0,

      average_operational_burden: 0,
    };

    let uncappedCount = 0;
    let missingInsuranceCount = 0;
    let cumulativeRisk = 0;
    let cumulativeBurden = 0;

    /**
     * Initialize prevalence
     */
    for (const clause of STANDARD_CLAUSES) {
      benchmark.clause_prevalence[clause] = 0;
    }

    for (const contract of contracts) {
      cumulativeRisk += normalizeRiskScore(
        contract?.risk_score
      );

      cumulativeBurden +=
        calculateOperationalBurden(contract);

      const clauses =
        normalizeClauseCollection(
          contract?.clauses || []
        );

      /**
       * Clause prevalence
       */
      for (const standardClause of STANDARD_CLAUSES) {
        if (
          containsClause(
            clauses,
            standardClause
          )
        ) {
          benchmark.clause_prevalence[
            standardClause
          ] += 1;
        }
      }

      /**
       * Uncapped liability
       */
      if (hasUncappedLiability(clauses)) {
        uncappedCount++;
      }

      /**
       * Missing insurance
       */
      if (
        !containsClause(
          clauses,
          "insurance"
        )
      ) {
        missingInsuranceCount++;
      }
    }

    /**
     * Convert prevalence to percentages
     */
    for (const clause in benchmark.clause_prevalence) {
      benchmark.clause_prevalence[
        clause
      ] = Math.round(
        (benchmark.clause_prevalence[
          clause
        ] /
          contracts.length) *
          100
      );
    }

    benchmark.uncapped_liability_percentage =
      Math.round(
        (uncappedCount / contracts.length) *
          100
      );

    benchmark.missing_insurance_percentage =
      Math.round(
        (missingInsuranceCount /
          contracts.length) *
          100
      );

    benchmark.average_risk_score =
      Math.round(
        cumulativeRisk / contracts.length
      );

    benchmark.average_operational_burden =
      Math.round(
        cumulativeBurden / contracts.length
      );

    return benchmark;
  } catch (error) {
    console.error(
      "benchmarkClauseStructures() Error:",
      error.message
    );

    return emptyBenchmarkResponse();
  }
}

/**
 * Detect portfolio outlier liability contracts
 */
function detectOutlierLiabilityTerms(
  contracts = []
) {
  try {
    const outliers = [];

    const averageLiability =
      calculateAverageLiability(contracts);

    for (const contract of contracts) {
      const liability =
        extractLiabilityAmount(contract);

      const clauses =
        normalizeClauseCollection(
          contract?.clauses || []
        );

      if (
        liability > averageLiability * 2
      ) {
        outliers.push({
          contract_id: contract?.id || null,

          contract_name:
            contract?.name ||
            "Unnamed Contract",

          supplier:
            contract?.supplier_name ||
            "Unknown Supplier",

          liability_amount: liability,

          average_portfolio_liability:
            averageLiability,

          reason:
            "Liability exceeds portfolio average significantly",

          severity: "High",
        });
      }

      if (
        hasUncappedLiability(clauses)
      ) {
        outliers.push({
          contract_id: contract?.id || null,

          contract_name:
            contract?.name ||
            "Unnamed Contract",

          supplier:
            contract?.supplier_name ||
            "Unknown Supplier",

          reason:
            "Uncapped liability detected",

          severity: "Critical",
        });
      }
    }

    return outliers;
  } catch (error) {
    console.error(
      "detectOutlierLiabilityTerms() Error:",
      error.message
    );

    return [];
  }
}

/**
 * -------------------------------
 * HELPERS
 * -------------------------------
 */

function normalizeClauseCollection(
  clauses = []
) {
  return clauses.map((clause) => ({
    ...clause,

    normalized_type:
      normalizeClauseType(
        clause?.clause_type ||
          clause?.clause_title ||
          "general"
      ),
  }));
}

function normalizeClauseType(type = "") {
  const value = type.toLowerCase().trim();

  /**
   * Liability
   */
  if (
    value.includes("liability") ||
    value.includes("liability cap")
  ) {
    return "limitation_of_liability";
  }

  /**
   * Insurance
   */
  if (
    value.includes("insurance")
  ) {
    return "insurance";
  }

  /**
   * Indemnity
   */
  if (
    value.includes("indemn")
  ) {
    return "indemnity";
  }

  /**
   * Confidentiality
   */
  if (
    value.includes("confidential")
  ) {
    return "confidentiality";
  }

  /**
   * Compliance
   */
  if (
    value.includes("compliance") ||
    value.includes("gdpr") ||
    value.includes("faa") ||
    value.includes("easa") ||
    value.includes("imo")
  ) {
    return "compliance";
  }

  /**
   * Termination
   */
  if (
    value.includes("termination") ||
    value.includes("terminate")
  ) {
    return "termination";
  }

  /**
   * Force majeure
   */
  if (
    value.includes("force majeure")
  ) {
    return "force_majeure";
  }

  /**
   * Governing law
   */
  if (
    value.includes("governing law") ||
    value.includes("jurisdiction")
  ) {
    return "governing_law";
  }

  return value
    .replace(/\s+/g, "_")
    .trim();
}

function containsClause(
  clauses,
  target
) {
  return clauses.some(
    (c) => c.normalized_type === target
  );
}

function normalizeRiskScore(score) {
  const parsed = Number(score);

  if (isNaN(parsed)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, parsed)
  );
}

function countObligations(contract) {
  return (
    contract?.obligations?.length || 0
  );
}

function extractLiabilityAmount(
  contract
) {
  if (!contract) return 0;

  return Number(
    contract?.value ||
      contract?.contract_value ||
      0
  );
}

function calculateOperationalBurden(
  contract
) {
  const obligations =
    contract?.obligations || [];

  return Math.min(
    100,
    obligations.length * 5
  );
}

function calculateAveragePortfolioRisk(
  portfolio = []
) {
  if (!portfolio.length) {
    return 0;
  }

  const total = portfolio.reduce(
    (sum, contract) =>
      sum +
      normalizeRiskScore(
        contract?.risk_score
      ),
    0
  );

  return Math.round(
    total / portfolio.length
  );
}

function calculateAverageLiability(
  contracts = []
) {
  if (!contracts.length) {
    return 0;
  }

  const total = contracts.reduce(
    (sum, contract) =>
      sum +
      extractLiabilityAmount(
        contract
      ),
    0
  );

  return Math.round(
    total / contracts.length
  );
}

function hasUncappedLiability(
  clauses = []
) {
  return clauses.some((clause) => {
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
  });
}

function detectWeakIndemnity(text) {
  return (
    text.includes(
      "to the extent possible"
    ) ||
    text.includes("reasonable efforts") ||
    text.includes(
      "commercially reasonable"
    )
  );
}

function detectExcessiveNoticePeriod(
  text
) {
  const matches =
    text.match(/(\d+)\s*days?/);

  if (!matches) {
    return false;
  }

  const days = parseInt(matches[1]);

  return days >= 180;
}

function detectAbnormalTerms(
  clauses = []
) {
  let count = 0;

  for (const clause of clauses) {
    const text = (
      clause?.clause_text || ""
    ).toLowerCase();

    for (const term of HIGH_RISK_TERMS) {
      if (text.includes(term)) {
        count++;
      }
    }
  }

  return count;
}

function emptyBenchmarkResponse() {
  return {
    total_contracts: 0,

    clause_prevalence: {},

    uncapped_liability_percentage: 0,

    missing_insurance_percentage: 0,

    average_risk_score: 0,

    average_operational_burden: 0,
  };
}

module.exports = {
  compareContracts,
  findAbnormalClauses,
  calculateDeviationScore,
  benchmarkClauseStructures,
  detectOutlierLiabilityTerms,
};
