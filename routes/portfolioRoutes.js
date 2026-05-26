// routes/portfolioRoutes.js

import express from "express";

import {
  calculatePortfolioRisk,
} from "../services/portfolioRiskEngine.js";

const router = express.Router();

/**
 * =========================================
 * PORTFOLIO HEALTH
 * =========================================
 */

router.get("/", async (req, res) => {
  try {
    const portfolio =
      await calculatePortfolioRisk();

    return res.status(200).json({
      success: true,
      portfolio,
    });
  } catch (error) {
    console.error(
      "Portfolio Route Error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Portfolio analysis failed",
    });
  }
});

/**
 * =========================================
 * PORTFOLIO SUMMARY
 * =========================================
 */

router.get("/summary", async (req, res) => {
  try {
    const portfolio =
      await calculatePortfolioRisk();

    return res.status(200).json({
      success: true,

      summary: {
        total_contracts:
          portfolio.total_contracts,

        average_risk_score:
          portfolio.average_risk_score,

        portfolio_health:
          portfolio.portfolio_health,

        high_risk_contracts:
          portfolio.high_risk_contracts,
      },
    });
  } catch (error) {
    console.error(
      "Portfolio Summary Error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Portfolio summary failed",
    });
  }
});

export default router;
