import express from "express";
import operionOrchestrator from "../services/operionOrchestrator.js";

const router = express.Router();

/**
 * 🧠 OPERION CONTRACT ANALYSIS ENDPOINT
 * Single entry point for AI contract intelligence
 */

router.post("/analyze-contract", async (req, res) => {
  try {
    const { contract_text, document_id, metadata } = req.body;

    // =========================
    // VALIDATION
    // =========================
    if (!contract_text) {
      return res.status(400).json({
        success: false,
        error: "contract_text is required",
      });
    }

    // =========================
    // CONTEXT ENRICHMENT (MULTI-TENANT READY)
    // =========================
    const context = {
      user: req.user,
      org_id: req.user?.org_id || "default-org",
      document_id: document_id || null,
      metadata: metadata || {},
      request_id: generateRequestId(),
      timestamp: new Date().toISOString(),
    };

    console.log("🧠 Operion request:", context.request_id);

    // =========================
    // ORCHESTRATOR CALL
    // =========================
    const result = await operionOrchestrator.analyzeContract({
      contract_text,
      context,
    });

    // =========================
    // RESPONSE
    // =========================
    return res.json({
      success: true,
      request_id: context.request_id,
      data: result,
    });

  } catch (err) {
    console.error("❌ Operion analysis failed:", err);

    return res.status(500).json({
      success: false,
      error: "Contract analysis failed",
      message: err.message,
    });
  }
});

/**
 * 🩺 OPERION HEALTH CHECK
 */

router.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "operion-orchestrator",
    status: "active",
    timestamp: new Date().toISOString(),
  });
});

/**
 * =========================
 * REQUEST ID GENERATOR
 * =========================
 */

function generateRequestId() {
  return (
    "op_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).substring(2, 10)
  );
}

export default router;
