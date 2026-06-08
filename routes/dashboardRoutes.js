import express from "express";

const router = express.Router();

/**
 * =========================================
 * DASHBOARD HEALTH CHECK
 * =========================================
 */

router.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "dashboard-routes",
    status: "operational",
  });
});

/**
 * =========================================
 * PLACEHOLDER DASHBOARD ENDPOINT
 * =========================================
 */

router.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Dashboard API working",
  });
});

export default router;
