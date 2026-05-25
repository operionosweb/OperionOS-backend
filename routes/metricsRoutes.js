// routes/metricsRoutes.js

import express from "express";
import { getMetrics } from "../services/aiTelemetry.js";

const router = express.Router();

/**
 * -----------------------------------------
 * BASIC HEALTH + AI METRICS ENDPOINT
 * -----------------------------------------
 * Safe for admin/debug only (no PII)
 * -----------------------------------------
 */

router.get("/", (req, res) => {
  try {
    const metrics = getMetrics();

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      ai_metrics: metrics,
      system: {
        region: "EU-first",
        pipeline: "mistral → aleph_alpha → openai → fallback",
      },
    });
  } catch (error) {
    console.error("Metrics error:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to load metrics",
    });
  }
});

export default router;
