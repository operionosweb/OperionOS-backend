import express from "express";
import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireSuperAdmin } from "../middleware/superAdminMiddleware.js";

const router = express.Router();

router.use(authenticateUser, requireSuperAdmin);

router.get(
  "/dashboard",
  async (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Welcome Super Admin",
      user: req.user,
    });
  }
);

router.get(
  "/health",
  async (req, res) => {
    return res.status(200).json({
      success: true,
      admin_system: "operational",
      timestamp: new Date().toISOString(),
    });
  }
);

export default router;
