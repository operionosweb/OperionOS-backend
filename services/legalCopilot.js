// services/legalCopilot.js

/**
 * OPERION OS
 * AI Legal Copilot
 *
 * Responsibilities:
 * - Legal intelligence orchestration
 * - Intent detection
 * - Portfolio analytics routing
 * - Enterprise legal Q&A
 * - Executive response generation
 *
 * Architecture:
 * User Query
 *    ↓
 * Intent Detection
 *    ↓
 * Engine Routing
 *    ↓
 * Structured Retrieval
 *    ↓
 * Executive Summary Generation
 */

/**
 * Services
 */
const {
  calculatePortfolioRisk,
} = require("./portfolioRiskEngine");

const {
  findAbnormalClauses,
  benchmarkClauseStructures,
  detectOutlierLiabilityTerms,
  calculateDeviationScore,
} = require("./contractComparisonEngine");

const {
  searchClauses,
  searchByClauseType,
  searchByRiskLevel,
  searchMissingProtections,
  searchUpcomingExpirations,
  searchSuppliers,
  searchHighRiskTerms,
  searchComplianceClauses,
} = require("./searchEngine");

const {
  getAllContracts,
} = require("./contractService");

/**
 * -----------------------------------------
 * MAIN ENTRY POINT
 * -----------------------------------------
 */
async function processLegalQuery(
  query = ""
) {
  try {
    if (!query) {
      return {
        success: false,
        error: "Query is required",
      };
    }

    const contracts =
      await getAllContracts();

    const intent =
      detectIntent(query);

    const results =
      await routeIntent(
        intent,
        query,
        contracts
      );

    const executiveSummary =
      generateExecutiveSummary(
        intent,
        results,
        query
      );

    return {
      success: true,

      query,

      detected_intent:
        intent,

      executive_summary:
        executiveSummary,

      data: results,
    };
  } catch (error) {
    console.error(
      "processLegalQuery() Error:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Failed to process legal query",
    };
  }
}

/**
 * -----------------------------------------
 * INTENT DETECTION
 * -----------------------------------------
 */
function detectIntent(query = "") {
  const normalized =
    normalizeText(query);

  /**
   * Missing protections
   */
  if (
    normalized.includes(
      "missing insurance"
    ) ||
    normalized.includes(
      "missing indemnity"
    ) ||
    normalized.includes(
      "missing protection"
    )
  ) {
    return "missing_protections";
  }

  /**
   * High-risk / uncapped liability
   */
  if (
    normalized.includes(
      "uncapped liability"
    ) ||
    normalized.includes(
      "unlimited liability"
    ) ||
    normalized.includes(
      "high risk"
    )
  ) {
    return "high_risk";
  }

  /**
   * Supplier risk
   */
  if (
    normalized.includes(
      "supplier"
    ) ||
    normalized.includes(
      "vendor"
    )
  ) {
    return "supplier_risk";
  }

  /**
   * Compliance
   */
  if (
    normalized.includes("gdpr") ||
    normalized.includes("faa") ||
    normalized.includes("easa") ||
    normalized.includes("imo") ||
    normalized.includes(
      "compliance"
    )
  ) {
    return "compliance";
  }

  /**
   * Expirations
   */
  if (
    normalized.includes("expire") ||
    normalized.includes("renewal") ||
    normalized.includes(
      "expiring"
    )
  ) {
    return "expirations";
  }

  /**
   * Obligations
   */
  if (
    normalized.includes(
      "obligation"
    ) ||
    normalized.includes(
      "deadline"
    )
  ) {
    return "obligations";
  }

  /**
   * Benchmarking
   */
  if (
    normalized.includes(
      "benchmark"
    ) ||
    normalized.includes(
      "deviation"
    ) ||
    normalized.includes(
      "outlier"
    )
  ) {
    return "benchmarking";
  }

  /**
   * Portfolio risk
   */
  if (
    normalized.includes(
      "portfolio"
    ) ||
    normalized.includes("risk")
  ) {
    return "portfolio_risk";
  }

  /**
   * Default search
   */
  return "search";
}

/**
 * -----------------------------------------
 * ROUTE INTENT
 * -----------------------------------------
 */
async function routeIntent(
  intent,
  query,
  contracts
) {
  switch (intent) {
    /**
     * Portfolio analytics
     */
    case "portfolio_risk":
      return calculatePortfolioRisk(
        contracts
      );

    /**
     * Supplier intelligence
     */
    case "supplier_risk": {
      const portfolio =
        calculatePortfolioRisk(
          contracts
        );

      return {
        high_risk_vendors:
          portfolio.high_risk_vendors,

        supplier_exposure:
          portfolio.supplier_exposure,
      };
    }

    /**
     * Missing protections
     */
    case "missing_protections": {
      if (
        query.includes(
          "insurance"
        )
      ) {
        return searchMissingProtections(
          "insurance",
          contracts
        );
      }

      if (
        query.includes(
          "indemnity"
        )
      ) {
        return searchMissingProtections(
          "indemnity",
          contracts
        );
      }

      return searchMissingProtections(
        "limitation_of_liability",
        contracts
      );
    }

    /**
     * Compliance
     */
    case "compliance": {
      if (
        query
          .toLowerCase()
          .includes("gdpr")
      ) {
        return searchComplianceClauses(
          "gdpr",
          contracts
        );
      }

      if (
        query
          .toLowerCase()
          .includes("faa")
      ) {
        return searchComplianceClauses(
          "faa",
          contracts
        );
      }

      if (
        query
          .toLowerCase()
          .includes("easa")
      ) {
        return searchComplianceClauses(
          "easa",
          contracts
        );
      }

      if (
        query
          .toLowerCase()
          .includes("imo")
      ) {
        return searchComplianceClauses(
          "imo",
          contracts
        );
      }

      return searchComplianceClauses(
        "compliance",
        contracts
      );
    }

    /**
     * High risk
     */
    case "high_risk":
      return {
        high_risk_contracts:
          searchByRiskLevel(
            "Critical",
            contracts
          ),

        high_risk_terms:
          searchHighRiskTerms(
            contracts
          ),

        liability_outliers:
          detectOutlierLiabilityTerms(
            contracts
          ),
      };

    /**
     * Benchmarking
     */
    case "benchmarking":
      return {
        benchmark:
          benchmarkClauseStructures(
            contracts
          ),

        abnormalities:
          findAbnormalClauses(
            contracts
          ),

        deviations:
          contracts.map(
            (contract) =>
              calculateDeviationScore(
                contract,
                contracts
              )
          ),
      };

    /**
     * Expirations
     */
    case "expirations":
      return searchUpcomingExpirations(
        contracts,
        365
      );

    /**
     * Obligations
     */
    case "obligations":
      return searchClauses(
        "obligation",
        contracts
      );

    /**
     * Generic search
     */
    case "search":
    default:
      return searchClauses(
        query,
        contracts
      );
  }
}

/**
 * -----------------------------------------
 * EXECUTIVE SUMMARY GENERATION
 * -----------------------------------------
 */
function generateExecutiveSummary(
  intent,
  results,
  query
) {
  try {
    switch (intent) {
      /**
       * Portfolio Risk
       */
      case "portfolio_risk":
        return `
Portfolio analysis completed across ${
          results.total_contracts || 0
        } contracts.

Current portfolio risk score is ${
          results.portfolio_risk_score || 0
        }.

${
  results.critical_contracts || 0
} contracts are classified as critical risk.

${
  results.high_risk_vendors
    ?.length || 0
} suppliers are categorized as high-risk exposure entities.
        `.trim();

      /**
       * Supplier Risk
       */
      case "supplier_risk":
        return `
Supplier risk analysis identified ${
          results.high_risk_vendors
            ?.length || 0
        } high-risk vendors.

Portfolio supplier concentration and exposure analytics have been completed successfully.
        `.trim();

      /**
       * Missing Protections
       */
      case "missing_protections":
        return `
${
  results.length || 0
} contracts are missing requested legal protections.

These contracts may create elevated operational and liability exposure.
        `.trim();

      /**
       * Compliance
       */
      case "compliance":
        return `
Compliance analysis identified ${
          results.length || 0
        } matching compliance-related clauses and obligations.

Potential regulatory exposure areas have been surfaced for executive review.
        `.trim();

      /**
       * High Risk
       */
      case "high_risk":
        return `
High-risk analysis completed.

${
  results.high_risk_contracts
    ?.length || 0
} contracts are classified as critical risk.

${
  results.high_risk_terms
    ?.length || 0
} elevated legal exposure terms were detected across the portfolio.

${
  results.liability_outliers
    ?.length || 0
} liability outlier contracts were identified.
        `.trim();

      /**
       * Benchmarking
       */
      case "benchmarking":
        return `
Portfolio benchmarking completed successfully.

${
  results.abnormalities
    ?.length || 0
} abnormal legal structures were detected.

Deviation analysis has identified contracts that materially diverge from portfolio standards.
        `.trim();

      /**
       * Expirations
       */
      case "expirations":
        return `
${
  results.length || 0
} contracts are approaching expiration or renewal deadlines.

Executive renewal planning may be required.
        `.trim();

      /**
       * Obligations
       */
      case "obligations":
        return `
Operational obligation analysis completed.

${
  results.length || 0
} obligation-related clauses were identified across the portfolio.
        `.trim();

      /**
       * Generic Search
       */
      case "search":
      default:
        return `
Search completed successfully for query:
"${query}"

${
  results.length || 0
} relevant contractual matches were identified.
        `.trim();
    }
  } catch (error) {
    console.error(
      "generateExecutiveSummary() Error:",
      error.message
    );

    return "Executive analysis completed.";
  }
}

/**
 * -----------------------------------------
 * HELPERS
 * -----------------------------------------
 */

function normalizeText(
  text = ""
) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  processLegalQuery,
  detectIntent,
  routeIntent,
  generateExecutiveSummary,
};
