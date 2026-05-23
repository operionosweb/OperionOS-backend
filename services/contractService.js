// services/contractRiskEngine.js

/**
 * OPERION OS
 * Contract Risk Engine
 *
 * Responsibilities:
 * - Contract risk scoring
 * - Financial exposure analysis
 * - Compliance risk analysis
 * - Operational burden scoring
 * - Liability intelligence
 */

/**
 * -----------------------------------------
 * MAIN RISK ENGINE
 * -----------------------------------------
 */
export async function calculateContractRisk(
  contract = {}
) {
  try {
    const clauses =
      contract?.clauses || [];

    const obligations =
      contract?.obligations ||
      [];

    /**
     * Risk categories
     */
    const financialRisk =
      calculateFinancialRisk(
        clauses
      );

    const complianceRisk =
      calculateComplianceRisk(
        clauses
      );

    const operationalRisk =
      calculateOperationalRisk(
        obligations
      );

    const liabilityRisk =
      calculateLiabilityRisk(
        clauses
      );

    /**
     * Weighted overall score
     */
    const overallRiskScore =
      Math.round(
        financialRisk * 0.3 +
          complianceRisk * 0.25 +
          operationalRisk *
            0.2 +
          liabilityRisk * 0.25
      );

    /**
     * Risk level
     */
    const riskLevel =
      determineRiskLevel(
        overallRiskScore
      );

    return {
      success: true,

      overall_risk_score:
        overallRiskScore,

      risk_level: riskLevel,

      financial_risk:
        financialRisk,

      compliance_risk:
        complianceRisk,

      operational_risk:
        operationalRisk,

      liability_risk:
        liabilityRisk,

      critical_issues:
        identifyCriticalIssues(
          clauses
        ),
    };
  } catch (error) {
    console.error(
      "calculateContractRisk() Error:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Risk analysis failed",
    };
  }
}

/**
 * -----------------------------------------
 * FINANCIAL RISK
 * -----------------------------------------
 */
function calculateFinancialRisk(
  clauses = []
) {
  let score = 20;

  for (const clause of clauses) {
    const text = (
      clause?.clause_text || ""
    ).toLowerCase();

    if (
      text.includes(
        "uncapped liability"
      )
    ) {
      score += 40;
    }

    if (
      text.includes(
        "unlimited liability"
      )
    ) {
      score += 40;
    }

    if (
      text.includes(
        "liquidated damages"
      )
    ) {
      score += 20;
    }

    if (
      text.includes(
        "penalty"
      )
    ) {
      score += 15;
    }
  }

  return Math.min(
    100,
    score
  );
}

/**
 * -----------------------------------------
 * COMPLIANCE RISK
 * -----------------------------------------
 */
function calculateComplianceRisk(
  clauses = []
) {
  let score = 10;

  for (const clause of clauses) {
    const text = (
      clause?.clause_text || ""
    ).toLowerCase();

    if (
      text.includes("gdpr")
    ) {
      score += 10;
    }

    if (
      text.includes("faa")
    ) {
      score += 15;
    }

    if (
      text.includes("easa")
    ) {
      score += 15;
    }

    if (
      text.includes("imo")
    ) {
      score += 15;
    }

    if (
      text.includes(
        "non-compliance"
      )
    ) {
      score += 20;
    }
  }

  return Math.min(
    100,
    score
  );
}

/**
 * -----------------------------------------
 * OPERATIONAL RISK
 * -----------------------------------------
 */
function calculateOperationalRisk(
  obligations = []
) {
  const score =
    obligations.length * 5;

  return Math.min(
    100,
    score
  );
}

/**
 * -----------------------------------------
 * LIABILITY RISK
 * -----------------------------------------
 */
function calculateLiabilityRisk(
  clauses = []
) {
  let score = 15;

  for (const clause of clauses) {
    const text = (
      clause?.clause_text || ""
    ).toLowerCase();

    if (
      text.includes(
        "indemnify"
      )
    ) {
      score += 15;
    }

    if (
      text.includes(
        "hold harmless"
      )
    ) {
      score += 15;
    }

    if (
      text.includes(
        "unlimited liability"
      )
    ) {
      score += 40;
    }
  }

  return Math.min(
    100,
    score
  );
}

/**
 * -----------------------------------------
 * RISK LEVEL
 * -----------------------------------------
 */
function determineRiskLevel(
  score
) {
  if (score >= 80) {
    return "Critical";
  }

  if (score >= 60) {
    return "High";
  }

  if (score >= 40) {
    return "Medium";
  }

  return "Low";
}

/**
 * -----------------------------------------
 * CRITICAL ISSUES
 * -----------------------------------------
 */
function identifyCriticalIssues(
  clauses = []
) {
  const issues = [];

  for (const clause of clauses) {
    const text = (
      clause?.clause_text || ""
    ).toLowerCase();

    if (
      text.includes(
        "uncapped liability"
      )
    ) {
      issues.push({
        issue:
          "Uncapped liability detected",

        severity: "Critical",
      });
    }

    if (
      text.includes(
        "unlimited liability"
      )
    ) {
      issues.push({
        issue:
          "Unlimited liability exposure",

        severity: "Critical",
      });
    }

    if (
      text.includes(
        "no insurance"
      )
    ) {
      issues.push({
        issue:
          "Missing insurance protections",

        severity: "High",
      });
    }
  }

  return issues;
}
