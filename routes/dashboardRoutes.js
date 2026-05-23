// routes/dashboardRoutes.js

/**
 * OPERION OS
 * Executive Dashboard Routes
 *
 * Responsibilities:
 * - Portfolio analytics APIs
 * - Supplier intelligence APIs
 * - Risk dashboard endpoints
 * - Benchmarking APIs
 * - Heatmap APIs
 * - Executive overview APIs
 */

const express = require("express");
const router = express.Router();

/**
 * Services
 */
const {
  calculatePortfolioRisk,
} = require("../services/portfolioRiskEngine");

const {
  findAbnormalClauses,
  benchmarkClauseStructures,
  detectOutlierLiabilityTerms,
  calculateDeviationScore,
} = require("../services/contractComparisonEngine");

const {
  getAllContracts,
} = require("../services/contractService");

/**
 * -----------------------------------------
 * GET /dashboard/overview
 * Executive portfolio overview
 * -----------------------------------------
 */
router.get("/overview", async (req, res) => {
  try {
    const contracts = await getAllContracts();

    const portfolio =
      calculatePortfolioRisk(contracts);

    const benchmarking =
      benchmarkClauseStructures(
        contracts
      );

    const abnormalities =
      findAbnormalClauses(contracts);

    const outliers =
      detectOutlierLiabilityTerms(
        contracts
      );

    return res.status(200).json({
      success: true,

      overview: {
        total_contracts:
          portfolio.total_contracts,

        portfolio_risk_score:
          portfolio.portfolio_risk_score,

        critical_contracts:
          portfolio.critical_contracts,

        operational_burden_score:
          portfolio.operational_burden_score,

        high_risk_vendors:
          portfolio.high_risk_vendors
            .length,

        abnormal_clauses:
          abnormalities.length,

        liability_outliers:
          outliers.length,
      },

      benchmarking,

      maturity_analysis:
        portfolio.maturity_analysis,
    });
  } catch (error) {
    console.error(
      "Dashboard Overview Error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Failed to load overview dashboard",
    });
  }
});

/**
 * -----------------------------------------
 * GET /dashboard/portfolio-risk
 * Portfolio risk analytics
 * -----------------------------------------
 */
router.get(
  "/portfolio-risk",
  async (req, res) => {
    try {
      const contracts =
        await getAllContracts();

      const portfolio =
        calculatePortfolioRisk(
          contracts
        );

      return res.status(200).json({
        success: true,
        data: portfolio,
      });
    } catch (error) {
      console.error(
        "Portfolio Risk Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to calculate portfolio risk",
      });
    }
  }
);

/**
 * -----------------------------------------
 * GET /dashboard/high-risk
 * High-risk contracts & vendors
 * -----------------------------------------
 */
router.get(
  "/high-risk",
  async (req, res) => {
    try {
      const contracts =
        await getAllContracts();

      const highRiskContracts =
        contracts.filter(
          (contract) =>
            Number(
              contract?.risk_score || 0
            ) >= 75
        );

      const portfolio =
        calculatePortfolioRisk(
          contracts
        );

      return res.status(200).json({
        success: true,

        high_risk_contracts:
          highRiskContracts,

        high_risk_vendors:
          portfolio.high_risk_vendors,
      });
    } catch (error) {
      console.error(
        "High Risk Dashboard Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to load high-risk dashboard",
      });
    }
  }
);

/**
 * -----------------------------------------
 * GET /dashboard/suppliers
 * Supplier intelligence
 * -----------------------------------------
 */
router.get(
  "/suppliers",
  async (req, res) => {
    try {
      const contracts =
        await getAllContracts();

      const portfolio =
        calculatePortfolioRisk(
          contracts
        );

      return res.status(200).json({
        success: true,

        total_suppliers:
          portfolio.supplier_exposure
            .length,

        suppliers:
          portfolio.supplier_exposure,
      });
    } catch (error) {
      console.error(
        "Supplier Dashboard Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to load supplier dashboard",
      });
    }
  }
);

/**
 * -----------------------------------------
 * GET /dashboard/benchmarking
 * Benchmark & deviation analytics
 * -----------------------------------------
 */
router.get(
  "/benchmarking",
  async (req, res) => {
    try {
      const contracts =
        await getAllContracts();

      const benchmarking =
        benchmarkClauseStructures(
          contracts
        );

      const deviations =
        contracts.map((contract) =>
          calculateDeviationScore(
            contract,
            contracts
          )
        );

      return res.status(200).json({
        success: true,

        benchmarking,

        deviation_analysis:
          deviations.sort(
            (a, b) =>
              b.deviation_score -
              a.deviation_score
          ),
      });
    } catch (error) {
      console.error(
        "Benchmarking Dashboard Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to load benchmarking dashboard",
      });
    }
  }
);

/**
 * -----------------------------------------
 * GET /dashboard/outliers
 * Liability outlier analytics
 * -----------------------------------------
 */
router.get(
  "/outliers",
  async (req, res) => {
    try {
      const contracts =
        await getAllContracts();

      const outliers =
        detectOutlierLiabilityTerms(
          contracts
        );

      const abnormalities =
        findAbnormalClauses(
          contracts
        );

      return res.status(200).json({
        success: true,

        liability_outliers:
          outliers,

        abnormal_clauses:
          abnormalities,
      });
    } catch (error) {
      console.error(
        "Outlier Dashboard Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to load outlier dashboard",
      });
    }
  }
);

/**
 * -----------------------------------------
 * GET /dashboard/upcoming-obligations
 * Upcoming obligation deadlines
 * -----------------------------------------
 */
router.get(
  "/upcoming-obligations",
  async (req, res) => {
    try {
      const contracts =
        await getAllContracts();

      const obligations = [];

      const now = new Date();

      const next90Days = new Date();
      next90Days.setDate(
        now.getDate() + 90
      );

      for (const contract of contracts) {
        const contractObligations =
          contract?.obligations || [];

        for (const obligation of contractObligations) {
          const deadline =
            obligation?.deadline;

          if (!deadline) continue;

          const parsedDeadline =
            new Date(deadline);

          if (
            parsedDeadline >= now &&
            parsedDeadline <= next90Days
          ) {
            obligations.push({
              contract_id:
                contract?.id || null,

              contract_name:
                contract?.name ||
                "Unnamed Contract",

              supplier:
                contract?.supplier_name ||
                "Unknown Supplier",

              obligation:
                obligation?.title ||
                obligation?.description ||
                "Unnamed Obligation",

              severity:
                obligation?.severity ||
                "Medium",

              deadline,
            });
          }
        }
      }

      obligations.sort(
        (a, b) =>
          new Date(a.deadline) -
          new Date(b.deadline)
      );

      return res.status(200).json({
        success: true,

        total_upcoming:
          obligations.length,

        obligations,
      });
    } catch (error) {
      console.error(
        "Upcoming Obligations Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to load upcoming obligations",
      });
    }
  }
);

/**
 * -----------------------------------------
 * GET /dashboard/heatmap
 * Portfolio risk heatmap
 * -----------------------------------------
 */
router.get(
  "/heatmap",
  async (req, res) => {
    try {
      const contracts =
        await getAllContracts();

      const portfolio =
        calculatePortfolioRisk(
          contracts
        );

      return res.status(200).json({
        success: true,

        heatmap:
          portfolio.portfolio_heatmap,
      });
    } catch (error) {
      console.error(
        "Heatmap Dashboard Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to load heatmap dashboard",
      });
    }
  }
);

/**
 * -----------------------------------------
 * GET /dashboard/contracts
 * Contract portfolio list
 * -----------------------------------------
 */
router.get(
  "/contracts",
  async (req, res) => {
    try {
      const contracts =
        await getAllContracts();

      const formattedContracts =
        contracts.map((contract) => ({
          id: contract?.id,

          name:
            contract?.name ||
            "Unnamed Contract",

          supplier:
            contract?.supplier_name ||
            "Unknown Supplier",

          risk_score:
            contract?.risk_score || 0,

          value:
            contract?.value || 0,

          expiry_date:
            contract?.expiry_date ||
            null,

          clauses:
            contract?.clauses
              ?.length || 0,

          obligations:
            contract?.obligations
              ?.length || 0,
        }));

      return res.status(200).json({
        success: true,

        total_contracts:
          formattedContracts.length,

        contracts:
          formattedContracts,
      });
    } catch (error) {
      console.error(
        "Contracts Dashboard Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to load contracts dashboard",
      });
    }
  }
);

module.exports = router;
