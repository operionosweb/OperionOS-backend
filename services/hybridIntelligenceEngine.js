// services/hybridIntelligenceEngine.js

/**
 * =========================================
 * OPERION OS
 * HYBRID INTELLIGENCE ENGINE
 * =========================================
 *
 * Combines:
 * - deterministic extraction
 * - AI reasoning
 * - procurement intelligence
 * - risk intelligence
 * - aviation contract intelligence
 *
 * =========================================
 */

import { extractStructuredContractData }
  from "./contractExtractionEngine.js";

import { analyzeContractText }
  from "./aiExtractionService.js";

/**
 * -----------------------------------------
 * MERGE RISK SCORES
 * -----------------------------------------
 */

function mergeRiskScores(ruleScore = 0, aiScore = 0) {
  return Math.min(
    100,
    Math.round((ruleScore * 0.4) + (aiScore * 0.6))
  );
}

/**
 * -----------------------------------------
 * PROCUREMENT INSIGHTS
 * -----------------------------------------
 */

function generateProcurementInsights({
  contractType,
  riskScore,
  autoRenewal,
  paymentTerms,
}) {
  const insights = [];

  if (riskScore >= 70) {
    insights.push(
      "High-risk contract requiring legal review."
    );
  }

  if (autoRenewal) {
    insights.push(
      "Auto-renewal detected. Monitor renewal deadlines carefully."
    );
  }

  if (
    paymentTerms &&
    paymentTerms.includes("90")
  ) {
    insights.push(
      "Extended payment terms detected."
    );
  }

  if (
    contractType ===
    "Aircraft Lease Agreement"
  ) {
    insights.push(
      "Aviation lease detected. Residual value and maintenance exposure should be reviewed."
    );
  }

  return insights;
}

/**
 * -----------------------------------------
 * SUPPLIER RISK INTELLIGENCE
 * -----------------------------------------
 */

function generateSupplierRisk({
  riskScore,
  clauses,
}) {
  if (riskScore >= 80) {
    return "Critical supplier/legal exposure";
  }

  if (
    clauses.includes(
      "limitation of liability"
    )
  ) {
    return "Liability limitation detected";
  }

  if (
    clauses.includes("exclusive")
  ) {
    return "Exclusive vendor dependency risk";
  }

  return "Normal";
}

/**
 * -----------------------------------------
 * COMPLIANCE INTELLIGENCE
 * -----------------------------------------
 */

function generateComplianceFlags({
  governingLaw,
  clauses,
}) {
  const flags = [];

  if (!governingLaw) {
    flags.push(
      "Missing governing law clause"
    );
  }

  if (
    !clauses.includes(
      "confidentiality"
    )
  ) {
    flags.push(
      "Missing confidentiality protections"
    );
  }

  return flags;
}

/**
 * =========================================
 * MAIN HYBRID ENGINE
 * =========================================
 */

export async function runHybridIntelligence(
  contractText = ""
) {
  try {
    /**
     * -----------------------------------------
     * RULE ENGINE
     * -----------------------------------------
     */

    const structured =
      await extractStructuredContractData(
        contractText
      );

    /**
     * -----------------------------------------
     * AI ENGINE
     * -----------------------------------------
     */

    const ai =
      await analyzeContractText(
        contractText
      );

    const structuredData =
      structured || {};

    const aiData =
      ai?.analysis || {};

    /**
     * -----------------------------------------
     * RISK FUSION
     * -----------------------------------------
     */

    const finalRiskScore =
      mergeRiskScores(
        structuredData.risk_score || 0,
        aiData.risk_score || 0
      );

    /**
     * -----------------------------------------
     * PROCUREMENT INTELLIGENCE
     * -----------------------------------------
     */

    const procurementInsights =
      generateProcurementInsights({
        contractType:
          structuredData.contract_type,
        riskScore: finalRiskScore,
        autoRenewal:
          structuredData.auto_renewal,
        paymentTerms:
          structuredData.payment_terms,
      });

    /**
     * -----------------------------------------
     * SUPPLIER INTELLIGENCE
     * -----------------------------------------
     */

    const supplierRisk =
      generateSupplierRisk({
        riskScore: finalRiskScore,
        clauses:
          structuredData.clauses || [],
      });

    /**
     * -----------------------------------------
     * COMPLIANCE FLAGS
     * -----------------------------------------
     */

    const complianceFlags =
      generateComplianceFlags({
        governingLaw:
          structuredData.governing_law,
        clauses:
          structuredData.clauses || [],
      });

    /**
     * -----------------------------------------
     * FINAL RESPONSE
     * -----------------------------------------
     */

    return {
      success: true,

      intelligence: {
        contract_type:
          structuredData.contract_type,

        supplier_name:
          aiData.supplier_name,

        summary:
          aiData.summary,

        final_risk_score:
          finalRiskScore,

        clauses:
          structuredData.clauses || [],

        obligations:
          structuredData.obligations || [],

        governing_law:
          structuredData.governing_law,

        payment_terms:
          structuredData.payment_terms,

        auto_renewal:
          structuredData.auto_renewal,

        procurement_insights:
          procurementInsights,

        supplier_risk:
          supplierRisk,

        compliance_flags:
          complianceFlags,

        ai_provider:
          ai.provider_used || "unknown",

        intelligence_mode:
          "hybrid_ai_rules_engine",
      },
    };
  } catch (error) {
    console.error(
      "Hybrid Intelligence Error:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Hybrid intelligence failed",
    };
  }
}
