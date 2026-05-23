// ======================================================
// CONTRACT RISK ENGINE
// ======================================================

export async function analyzeContractRisk(
  clauses,
  obligations
) {

  try {

    let totalRiskScore = 0;

    const risks = [];

    const criticalFlags = [];

    // ======================================================
    // CLAUSE RISK ANALYSIS
    // ======================================================

    for (const clause of clauses) {

      const clauseText =
        (clause.clause_text || "").toLowerCase();

      const clauseTitle =
        clause.clause_title || "Unknown Clause";

      const clauseType =
        clause.clause_type || "general";

      // ======================================================
      // TERMINATION RISK
      // ======================================================

      if (
        clauseType === "termination"
      ) {

        totalRiskScore += 20;

        risks.push({
          category: "termination",
          severity: "HIGH",
          clause: clauseTitle,
          issue:
            "Termination rights detected"
        });

        if (
          clauseText.includes("immediate")
        ) {

          totalRiskScore += 15;

          criticalFlags.push(
            "immediate_termination"
          );
        }
      }

      // ======================================================
      // LIABILITY RISK
      // ======================================================

      if (
        clauseType === "liability"
      ) {

        totalRiskScore += 15;

        risks.push({
          category: "liability",
          severity: "HIGH",
          clause: clauseTitle,
          issue:
            "Liability exposure detected"
        });

        if (
          clauseText.includes("unlimited")
        ) {

          totalRiskScore += 25;

          criticalFlags.push(
            "unlimited_liability"
          );
        }
      }

      // ======================================================
      // PAYMENT RISK
      // ======================================================

      if (
        clauseType === "payment"
      ) {

        totalRiskScore += 10;

        risks.push({
          category: "payment",
          severity: "MEDIUM",
          clause: clauseTitle,
          issue:
            "Payment obligations detected"
        });

        if (
          clauseText.includes("penalty") ||
          clauseText.includes("interest")
        ) {

          totalRiskScore += 10;

          criticalFlags.push(
            "payment_penalties"
          );
        }
      }

      // ======================================================
      // INSURANCE RISK
      // ======================================================

      if (
        clauseType === "insurance"
      ) {

        totalRiskScore += 8;

        risks.push({
          category: "insurance",
          severity: "MEDIUM",
          clause: clauseTitle,
          issue:
            "Insurance obligations detected"
        });
      }

      // ======================================================
      // COMPLIANCE RISK
      // ======================================================

      if (
        clauseType === "compliance"
      ) {

        totalRiskScore += 18;

        risks.push({
          category: "compliance",
          severity: "HIGH",
          clause: clauseTitle,
          issue:
            "Regulatory compliance obligations detected"
        });

        if (
          clauseText.includes("faa") ||
          clauseText.includes("easa") ||
          clauseText.includes("icao")
        ) {

          totalRiskScore += 12;

          criticalFlags.push(
            "aviation_regulatory_exposure"
          );
        }
      }

      // ======================================================
      // CONFIDENTIALITY RISK
      // ======================================================

      if (
        clauseType === "confidentiality"
      ) {

        totalRiskScore += 7;

        risks.push({
          category: "confidentiality",
          severity: "MEDIUM",
          clause: clauseTitle,
          issue:
            "Confidentiality obligations detected"
        });
      }
    }

    // ======================================================
    // OBLIGATION LOAD ANALYSIS
    // ======================================================

    if (
      obligations.length > 15
    ) {

      totalRiskScore += 10;

      criticalFlags.push(
        "high_operational_burden"
      );
    }

    // ======================================================
    // SCORE NORMALIZATION
    // ======================================================

    if (
      totalRiskScore > 100
    ) {

      totalRiskScore = 100;
    }

    // ======================================================
    // RISK SUMMARY
    // ======================================================

    let riskSummary =
      "Low contract risk profile";

    if (
      totalRiskScore >= 70
    ) {

      riskSummary =
        "High contractual and operational risk exposure";
    }

    else if (
      totalRiskScore >= 40
    ) {

      riskSummary =
        "Moderate contractual risk exposure";
    }

    // ======================================================
    // FINAL RESPONSE
    // ======================================================

    return {

      contract_risk_score:
        totalRiskScore,

      risk_summary:
        riskSummary,

      risks,

      critical_flags:
        criticalFlags
    };

  } catch (err) {

    console.error(
      "RISK ENGINE ERROR:",
      err
    );

    return {

      contract_risk_score: 0,

      risk_summary:
        "Risk analysis failed",

      risks: [],

      critical_flags: [
        "analysis_failed"
      ]
    };
  }
}
