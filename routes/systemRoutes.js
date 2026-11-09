import express from "express";
import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireSuperAdmin } from "../middleware/superAdminMiddleware.js";
import { getDeclaredSystemStatus } from "../services/systemStatus.js";
import { prepareReviewedInflationObservation } from "../services/phase3/intelligence/inflationObservationReview.js";
import { createExternalAviationObservationRepository } from "../repositories/phase3/externalAviationObservationRepository.js";
import { sendSafeHttpError } from "../utils/safeHttpError.js";

const router = express.Router();

router.use(authenticateUser, requireSuperAdmin);

router.post("/inflation-observations", async (req, res) => {
  let observation;
  try {
    observation = prepareReviewedInflationObservation(req.body);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return res.status(400).json({ success: false, error: error.message });
  }
  try {
    const result = await createExternalAviationObservationRepository()
      .insertReviewedInflationObservation(observation, req.user.id);
    return res.status(200).json({ success: true, ...result, verification: "platform_reviewer_verified_publication" });
  } catch (error) {
    return sendSafeHttpError(res, error, {
      status: 503,
      code: "INFLATION_OBSERVATION_UNAVAILABLE",
      message: "Reviewed inflation observation could not be recorded; verify approved migration readiness",
    });
  }
});

/**
 * =========================================
 * SYSTEM DIAGNOSTICS
 * =========================================
 */

router.get("/status", async (req, res) => {
  try {
    return res.json(getDeclaredSystemStatus());
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;