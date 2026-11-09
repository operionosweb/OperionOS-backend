import express from "express";
import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireOrganizationMembership } from "../middleware/organizationMiddleware.js";
import { requireOrganizationPermission } from "../middleware/authorizationMiddleware.js";
import { readAnalysisRunAviationLeaseRiskAssessment } from "./analysisRunRoutes.js";
import { createAviationOutcomeIntelligenceService } from "../services/phase3/intelligence/aviationOutcomeIntelligenceService.js";
import { sendSafeHttpError } from "../utils/safeHttpError.js";

const router = express.Router();
const outcomeIntelligence = createAviationOutcomeIntelligenceService({
  assessmentReader: readAnalysisRunAviationLeaseRiskAssessment,
});

router.use(
  authenticateUser,
  requireOrganizationMembership,
  requireOrganizationPermission("contract:read"),
);

router.get("/:analysisRunId", async (req, res) => {
  try {
    const result = await outcomeIntelligence.list({
      organizationId: req.organization.id,
      analysisRunId: req.params.analysisRunId,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendSafeHttpError(res, error, {
      status: 503,
      code: "AVIATION_OUTCOME_HISTORY_UNAVAILABLE",
      message: "Aviation outcome history could not be loaded",
    });
  }
});

router.post(
  "/:analysisRunId/outcomes",
  requireOrganizationPermission("contract:write"),
  async (req, res) => {
    try {
      const outcome = await outcomeIntelligence.recordOutcome({
        organizationId: req.organization.id,
        analysisRunId: req.params.analysisRunId,
        reviewerUserId: req.user.id,
        input: req.body,
      });
      return res.status(201).json({ success: true, outcome });
    } catch (error) {
      return sendSafeHttpError(res, error, {
        status: 503,
        code: "AVIATION_OUTCOME_RECORD_FAILED",
        message: "Aviation outcome evidence could not be recorded",
      });
    }
  },
);

router.post(
  "/:analysisRunId/forecast-snapshots",
  requireOrganizationPermission("contract:write"),
  async (req, res) => {
    try {
      const result = await outcomeIntelligence.snapshotForecast({
        organizationId: req.organization.id,
        analysisRunId: req.params.analysisRunId,
        reviewerUserId: req.user.id,
        metric: req.body?.metric,
      });
      return res.status(201).json({ success: true, ...result });
    } catch (error) {
      return sendSafeHttpError(res, error, {
        status: 503,
        code: "AVIATION_FORECAST_SNAPSHOT_FAILED",
        message: "The deterministic forecast could not be preserved",
      });
    }
  },
);

router.get("/:analysisRunId/backtest", async (req, res) => {
  try {
    const backtest = await outcomeIntelligence.backtest({
      organizationId: req.organization.id,
      analysisRunId: req.params.analysisRunId,
    });
    return res.status(200).json({ success: true, backtest });
  } catch (error) {
    return sendSafeHttpError(res, error, {
      status: 503,
      code: "AVIATION_BACKTEST_UNAVAILABLE",
      message: "Aviation forecast evaluation could not be completed",
    });
  }
});

export default router;
