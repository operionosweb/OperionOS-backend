import express from "express";
import { buildHorizonPayload } from "../services/horizonSyncService.js";
import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireOrganizationMembership } from "../middleware/organizationMiddleware.js";

const router = express.Router();

/**
 * =========================================
 * HORIZON CONTRACT INTELLIGENCE API
 * =========================================
 */

router.post(
  "/contract-intelligence",
  authenticateUser,
  requireOrganizationMembership,
  async (req, res) => {
  try {
    const { contract } = req.body;

    if (!contract) {
      return res.status(400).json({
        success: false,
        error: "Missing contract payload",
      });
    }

    const result = await buildHorizonPayload({
      contract,
      tenant: req.tenant,
      organizationId: req.organization.id,
    });

    return res.json(result);
  } catch (err) {
    console.error("❌ HORIZON ROUTE ERROR:", err.message);

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
  }
);

export default router;