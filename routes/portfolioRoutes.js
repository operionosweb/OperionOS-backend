// routes/portfolioRoutes.js

import express from "express";

import {
  calculatePortfolioRisk,
} from "../services/portfolioRiskEngine.js";
import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireOrganizationMembership } from "../middleware/organizationMiddleware.js";
import { requireOrganizationPermission } from "../middleware/authorizationMiddleware.js";
import { readAnalysisRunAviationLeaseRiskAssessment } from "./analysisRunRoutes.js";
import { readAviationContractPortfolioIntelligence } from "../services/phase3/intelligence/aviationContractPortfolioIntelligenceService.js";
import {
  deriveAviationFxReferenceSensitivity,
  deriveAviationFxScenarioComparisons,
  deriveAviationInterestRateScenarioComparisons,
  deriveAviationIndexationScenarios,
  refreshAviationExternalObservations,
  readAviationExternalRiskIntelligence,
} from "../services/phase3/intelligence/aviationExternalRiskIntelligenceService.js";
import { deriveAviationPredictiveContractRisk } from "../services/phase3/intelligence/aviationPredictiveContractRiskService.js";
import { sendSafeHttpError } from "../utils/safeHttpError.js";

const router = express.Router();

router.use(
  authenticateUser,
  requireOrganizationMembership,
  requireOrganizationPermission("contract:read")
);

/**
 * =========================================
 * PORTFOLIO HEALTH
 * =========================================
 */

router.get("/", async (req, res) => {
  try {
    const portfolio =
      await calculatePortfolioRisk(req.organization.id);

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

router.get("/aviation-intelligence", async (req, res) => {
  try {
    const [portfolio, externalRisk] = await Promise.all([
      readAviationContractPortfolioIntelligence({
        organizationId: req.organization.id,
        readLeaseAssessment: readAnalysisRunAviationLeaseRiskAssessment,
      }),
      readAviationExternalRiskIntelligence({
        organizationId: req.organization.id,
      }),
    ]);
    const predictiveRisk = deriveAviationPredictiveContractRisk({
      organizationId: req.organization.id,
      portfolio,
      externalRisk,
      asOf: portfolio.asOf,
    });
    return res.status(200).json({ success: true, portfolio, predictiveRisk });
  } catch (error) {
    return sendSafeHttpError(res, error, {
      status: 503,
      code: "AVIATION_PORTFOLIO_UNAVAILABLE",
      message: "Aviation portfolio intelligence could not be completed",
    });
  }
});

router.get("/aviation-external-risk", async (req, res) => {
  try {
    const contractId = req.query.contractId || null;
    const analysisRunId = req.query.analysisRunId || null;
    const [externalRisk, leaseAssessment] = await Promise.all([
      readAviationExternalRiskIntelligence({
        organizationId: req.organization.id,
        contractId,
        analysisRunId,
      }),
      analysisRunId
        ? readAnalysisRunAviationLeaseRiskAssessment({
          organizationId: req.organization.id,
          analysisRunId,
        })
        : Promise.resolve(null),
    ]);
    const predictiveRisk = deriveAviationPredictiveContractRisk({
      organizationId: req.organization.id,
      externalRisk,
      leaseAssessment,
      contractId,
      analysisRunId,
      documentVersionId: leaseAssessment?.documentVersionId || null,
      asOf: externalRisk.asOf,
    });
    return res.status(200).json({ success: true, externalRisk, predictiveRisk });
  } catch (error) {
    return sendSafeHttpError(res, error, {
      status: 503,
      code: "AVIATION_EXTERNAL_RISK_UNAVAILABLE",
      message: "Aviation external risk intelligence could not be completed",
    });
  }
});

router.post(
  "/aviation-external-risk/refresh",
  requireOrganizationPermission("contract:write"),
  async (_req, res) => {
    try {
      const refresh = await refreshAviationExternalObservations();
      if (refresh.status === "unavailable") {
        return res.status(503).json({
          success: false,
          error: "No verified external observations were available from the supported sources",
          refresh,
        });
      }
      return res.status(200).json({ success: true, refresh });
    } catch (error) {
      return sendSafeHttpError(res, error, {
        status: 503,
        code: "AVIATION_EXTERNAL_REFRESH_UNAVAILABLE",
        message: "External aviation observations could not be refreshed",
      });
    }
  },
);

router.post("/aviation-external-risk/:contractId/fx-sensitivity", async (req, res) => {
  const {
    assessmentId,
    analysisRunId = null,
    scenarioQuotePerEur,
    scenarios,
  } = req.body || {};
  const hasSingleScenario = Number.isFinite(scenarioQuotePerEur)
    && scenarioQuotePerEur > 0
    && scenarioQuotePerEur <= 1_000_000;
  const hasScenarioSet = Array.isArray(scenarios)
    && scenarios.length >= 1
    && scenarios.length <= 4
    && scenarios.every((scenario) => (
      typeof scenario?.label === "string"
      && scenario.label.trim().length > 0
      && scenario.label.trim().length <= 80
      && Number.isFinite(scenario.scenarioQuotePerEur)
      && scenario.scenarioQuotePerEur > 0
      && scenario.scenarioQuotePerEur <= 1_000_000
    ));
  if (
    typeof assessmentId !== "string"
    || !assessmentId.trim()
    || assessmentId.length > 512
    || (scenarios !== undefined && !hasScenarioSet)
    || hasSingleScenario === hasScenarioSet
  ) {
    return res.status(400).json({
      success: false,
      error: "A verified assessment and either one positive quote-currency-per-EUR rate or one to four labelled scenario rates are required",
    });
  }

  try {
    const externalRisk = await readAviationExternalRiskIntelligence({
      organizationId: req.organization.id,
      contractId: req.params.contractId,
      analysisRunId,
    });
    const assessment = externalRisk.contractualAssessments.find((item) => item.id === assessmentId);
    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: "The requested verified contract assessment is unavailable",
      });
    }

    if (hasScenarioSet) {
      const scenarioComparisons = deriveAviationFxScenarioComparisons(
        assessment,
        scenarios,
        req.organization.id,
      );
      return res.status(200).json({ success: true, scenarioComparisons });
    }

    const sensitivity = deriveAviationFxReferenceSensitivity(
      assessment,
      scenarioQuotePerEur,
      req.organization.id,
    );
    return res.status(200).json({ success: true, sensitivity });
  } catch (error) {
    return sendSafeHttpError(res, error, {
      status: 503,
      code: "AVIATION_FX_SENSITIVITY_UNAVAILABLE",
      message: "Aviation FX reference sensitivity could not be completed",
    });
  }
});

router.post("/aviation-external-risk/:contractId/indexation-sensitivity", async (req, res) => {
  const { assessmentId, analysisRunId = null, scenarios } = req.body || {};
  if (typeof assessmentId !== "string" || !assessmentId.trim() || assessmentId.length > 512
    || !Array.isArray(scenarios) || scenarios.length < 1 || scenarios.length > 4
    || scenarios.some((item) => typeof item?.label !== "string" || !item.label.trim() || item.label.length > 80
      || !Number.isFinite(item.indexValue) || item.indexValue <= 0 || item.indexValue > 1e6)) {
    return res.status(400).json({ success: false, error: "A verified assessment and one to four labelled positive index-level assumptions up to 1000000 are required" });
  }
  try {
    const externalRisk = await readAviationExternalRiskIntelligence({
      organizationId: req.organization.id, contractId: req.params.contractId, analysisRunId,
    });
    const assessment = externalRisk.contractualAssessments.find((item) => item.id === assessmentId);
    if (!assessment) return res.status(404).json({ success: false, error: "The requested verified contract assessment is unavailable" });
    return res.status(200).json({
      success: true,
      scenarioComparisons: deriveAviationIndexationScenarios(assessment, scenarios, req.organization.id),
    });
  } catch (error) {
    return sendSafeHttpError(res, error, { status: 503, code: "INDEXATION_SENSITIVITY_UNAVAILABLE", message: "Indexation comparison could not be completed" });
  }
});

router.post("/aviation-external-risk/:contractId/interest-sensitivity", async (req, res) => {
  const {
    assessmentId,
    analysisRunId = null,
    principalAmount,
    scenarios,
  } = req.body || {};
  const validScenarios = Array.isArray(scenarios)
    && scenarios.length >= 1
    && scenarios.length <= 4
    && scenarios.every((scenario) => (
      typeof scenario?.label === "string"
      && scenario.label.trim().length > 0
      && scenario.label.trim().length <= 80
      && Number.isFinite(scenario.scenarioBenchmarkPercent)
      && scenario.scenarioBenchmarkPercent >= 0
      && scenario.scenarioBenchmarkPercent <= 100
    ));
  if (
    typeof assessmentId !== "string"
    || !assessmentId.trim()
    || assessmentId.length > 512
    || !Number.isFinite(principalAmount)
    || principalAmount <= 0
    || principalAmount > 1_000_000_000_000
    || !validScenarios
  ) {
    return res.status(400).json({
      success: false,
      error: "A verified assessment, positive principal, and one to four labelled SOFR assumptions from 0% to 100% are required",
    });
  }

  try {
    const externalRisk = await readAviationExternalRiskIntelligence({
      organizationId: req.organization.id,
      contractId: req.params.contractId,
      analysisRunId,
    });
    const assessment = externalRisk.contractualAssessments.find((item) => item.id === assessmentId);
    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: "The requested verified contract assessment is unavailable",
      });
    }

    const scenarioComparisons = deriveAviationInterestRateScenarioComparisons(
      assessment,
      { principalAmount, scenarios },
      req.organization.id,
    );
    return res.status(200).json({ success: true, scenarioComparisons });
  } catch (error) {
    return sendSafeHttpError(res, error, {
      status: 503,
      code: "AVIATION_INTEREST_SENSITIVITY_UNAVAILABLE",
      message: "Aviation interest-rate scenario comparison could not be completed",
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
      await calculatePortfolioRisk(req.organization.id);

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
