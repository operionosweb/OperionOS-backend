import express from "express";

// CommonJS compatibility import (IMPORTANT FIX)
import contractPipeline from "../contractPipeline.js";

const { processContract } = contractPipeline;

const router = express.Router();

/* =========================
   HEALTH CHECK
========================= */

router.get("/", (req, res) => {
  res.json({
    status: "contract routes active",
    timestamp: new Date().toISOString(),
  });
});

/* =========================
   PROCESS CONTRACT
========================= */

router.post("/process", async (req, res) => {
  try {
    const contract = req.body;

    if (!contract) {
      return res.status(400).json({
        success: false,
        error: "No contract provided",
      });
    }

    const result = await processContract(contract);

    return res.json(result);
  } catch (error) {
    console.error("Contract route error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
});

export default router;
