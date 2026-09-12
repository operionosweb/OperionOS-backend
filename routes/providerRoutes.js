// routes/providerRoutes.js

import express from "express";

const router = express.Router();

/**
 * =========================================
 * PROVIDER HEALTH CHECK
 * =========================================
 */

router.get("/health", async (req, res) => {
  try {

    const providers = [
      {
        name: "mistral",
        status: process.env.MISTRAL_API_KEY
          ? "configured"
          : "missing_key",
        region: "EU (France)",
      },
    ];

    const healthyProviders =
      providers.filter(
        (p) => p.status === "configured"
      ).length;

    return res.status(200).json({
      success: true,
      total_providers: providers.length,
      healthy_providers: healthyProviders,
      providers,
      timestamp: new Date().toISOString(),
    });

  } catch {
    console.error("Provider health check failed");

    return res.status(500).json({
      success: false,
      error: "Provider health check failed",
    });
  }
});

export default router;
