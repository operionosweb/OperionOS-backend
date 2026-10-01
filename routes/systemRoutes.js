import express from "express";
import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireSuperAdmin } from "../middleware/superAdminMiddleware.js";

const router = express.Router();

router.use(authenticateUser, requireSuperAdmin);

/**
 * =========================================
 * SYSTEM DIAGNOSTICS
 * =========================================
 */

router.get("/status", async (req, res) => {
  try {
    return res.json({
      success: true,

      services: {
        api: "healthy",
        copilot: "enabled",
        operion: "enabled",
        dashboard: "enabled",
        tenant_system: "enabled",
        horizon_sync: "enabled",
        audit_layer: "enabled",
      },

      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;