// routes/copilotRoutes.js

/**
 * OPERION OS
 * AI Legal Copilot Routes
 *
 * Responsibilities:
 * - Conversational legal intelligence
 * - Executive AI querying
 * - Portfolio intelligence access
 * - Enterprise legal analytics APIs
 */

const express = require("express");

const router = express.Router();

/**
 * Services
 */
const {
  processLegalQuery,
} = require("../services/legalCopilot");

const {
  getAllContracts,
} = require("../services/contractService");

const {
  calculatePortfolioRisk,
} = require("../services/portfolioRiskEngine");

/**
 * -----------------------------------------
 * POST /copilot/query
 * Main AI copilot endpoint
 * -----------------------------------------
 */
router.post(
  "/query",
  async (req, res) => {
    try {
      const { query } = req.body;

      if (!query) {
        return res.status(400).json({
          success: false,
          error:
            "Query is required",
        });
      }

      const response =
        await processLegalQuery(
          query
        );

      return res.status(200).json({
        success: true,
        response,
      });
    } catch (error) {
      console.error(
        "Copilot Query Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to process copilot query",
      });
    }
  }
);

/**
 * -----------------------------------------
 * POST /copilot/analyze
 * Analyze entire contract portfolio
 * -----------------------------------------
 */
router.post(
  "/analyze",
  async (req, res) => {
    try {
      const contracts =
        await getAllContracts();

      const portfolioAnalysis =
        calculatePortfolioRisk(
          contracts
        );

      return res.status(200).json({
        success: true,

        analysis:
          portfolioAnalysis,
      });
    } catch (error) {
      console.error(
        "Copilot Analyze Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to analyze portfolio",
      });
    }
  }
);

/**
 * -----------------------------------------
 * GET /copilot/status
 * Health check endpoint
 * -----------------------------------------
 */
router.get(
  "/status",
  async (req, res) => {
    try {
      return res.status(200).json({
        success: true,

        service:
          "OPERION AI Legal Copilot",

        status: "online",

        capabilities: [
          "Portfolio Risk Intelligence",
          "Supplier Risk Analytics",
          "Cross-Contract Benchmarking",
          "Semantic Clause Search",
          "Compliance Intelligence",
          "Executive Legal Analytics",
          "Risk Heatmaps",
          "Obligation Intelligence",
        ],

        version: "1.0.0",
      });
    } catch (error) {
      console.error(
        "Copilot Status Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Copilot status unavailable",
      });
    }
  }
);

/**
 * -----------------------------------------
 * POST /copilot/suggest
 * Future recommendation engine
 * -----------------------------------------
 */
router.post(
  "/suggest",
  async (req, res) => {
    try {
      const { contractId } =
        req.body;

      return res.status(200).json({
        success: true,

        message:
          "AI recommendation engine coming soon.",

        future_capabilities: [
          "Clause Rewrite Suggestions",
          "Negotiation Recommendations",
          "Risk Mitigation Strategies",
          "AI Amendment Generation",
          "Automated Redlining",
        ],

        contract_id:
          contractId || null,
      });
    } catch (error) {
      console.error(
        "Copilot Suggest Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to generate recommendations",
      });
    }
  }
);

module.exports = router;
