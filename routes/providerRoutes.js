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
        name: "openai",
        status: process.env.OPENAI_API_KEY
          ? "configured"
          : "missing_key",
        region: "global",
      },

      {
        name: "anthropic",
        status: process.env.ANTHROPIC_API_KEY
          ? "configured"
          : "missing_key",
        region: "global",
      },

      {
        name: "mistral",
        status: process.env.MISTRAL_API_KEY
          ? "configured"
          : "missing_key",
        region: "EU (France)",
      },

      {
        name: "azure-openai",
        status: process.env.AZURE_OPENAI_API_KEY
          ? "configured"
          : "missing_key",
        region: "EU/Global",
      },

      {
        name: "uploadcare",
        status: process.env.UPLOADCARE_PUBLIC_KEY
          ? "configured"
          : "missing_key",
        region: "EU-friendly storage",
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

  } catch (error) {

    console.error(
      "Provider health route error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Provider health failed",
    });
  }
});

export default router;
