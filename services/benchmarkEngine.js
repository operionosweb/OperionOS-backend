// ======================================================
// ENTERPRISE CONTRACT BENCHMARK ENGINE
// ======================================================

const STANDARD_PROTECTIONS = [

  "LIABILITY",
  "INSURANCE",
  "TERMINATION",
  "COMPLIANCE",
  "PAYMENT",
  "GOVERNING_LAW"
];

// ======================================================
// MAIN ENGINE
// ======================================================

export function benchmarkContract(
  clauses = [],
  obligations = []
) {

  const clauseTypes =
    clauses.map(
      (c) => c.clause_type
    );

  // ====================================================
  // MISSING PROTECTIONS
  // ====================================================

  const missingProtections =
    STANDARD_PROTECTIONS.filter(
      (required) =>
        !clauseTypes.includes(required)
    );

  // ====================================================
  // RISK CONCENTRATION
  // ====================================================

  const highRiskClauses =
    clauses.filter(
      (c) =>
        c.risk_level === "HIGH"
    );

  // ====================================================
  // OPERATIONAL LOAD
  // ====================================================

  const operationalLoad =
    obligations.length;

  // ====================================================
  // BENCHMARK SCORE
  // ====================================================

  let benchmarkScore = 100;

  benchmarkScore -=
    missingProtections.length * 10;

  benchmarkScore -=
    highRiskClauses.length * 3;

  benchmarkScore -=
    Math.max(
      0,
      operationalLoad - 10
    );

  benchmarkScore =
    Math.max(
      0,
      benchmarkScore
    );

  // ====================================================
  // CONTRACT MATURITY
  // ====================================================

  let maturity = "ADVANCED";

  if (
    benchmarkScore < 80
  ) {

    maturity = "MODERATE";
  }

  if (
    benchmarkScore < 60
  ) {

    maturity = "WEAK";
  }

  if (
    benchmarkScore < 40
  ) {

    maturity = "CRITICAL";
  }

  // ====================================================
  // BENCHMARK ANALYSIS
  // ====================================================

  return {

    benchmark_score:
      benchmarkScore,

    contract_maturity:
      maturity,

    missing_protections:
      missingProtections,

    high_risk_clause_count:
      highRiskClauses.length,

    operational_load:
      operationalLoad,

    benchmark_summary: {

      strongest_area:
        findStrongestArea(
          clauses
        ),

      weakest_area:
        missingProtections[0] ||
        "None",

      portfolio_readiness:
        benchmarkScore > 75
          ? "Enterprise Ready"
          : "Requires Improvement"
    }
  };
}

// ======================================================
// STRONGEST AREA
// ======================================================

function findStrongestArea(
  clauses
) {

  const counts = {};

  clauses.forEach((c) => {

    counts[c.clause_type] =
      (
        counts[c.clause_type] || 0
      ) + 1;
  });

  let strongest = "GENERAL";
  let max = 0;

  for (
    const [key, value]
    of Object.entries(counts)
  ) {

    if (value > max) {

      strongest = key;
      max = value;
    }
  }

  return strongest;
}
