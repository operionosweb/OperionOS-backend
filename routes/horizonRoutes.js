import express from "express";
import { buildHorizonPayload } from "../services/horizonSyncService.js";

const router = express.Router();

/**
 * =========================================
 * HORIZON CONTRACT INTELLIGENCE API
 * =========================================
 */

router.post("/contract-intelligence", async (req, res) => {
  try {
    const { contract, tenant } = req.body;

    if (!contract) {
      return res.status(400).json({
        success: false,
        error: "Missing contract payload",
      });
    }

    const result = await buildHorizonPayload({
      contract,
      tenant,
    });

    return res.json(result);
  } catch (err) {
    console.error("❌ HORIZON ROUTE ERROR:", err.message);

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

export default router;