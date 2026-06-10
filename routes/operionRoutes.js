const express = require("express");
const router = express.Router();

const operionOrchestrator = require("../services/operionOrchestrator");

/**
 * 🧠 OPERION CONTRACT ANALYSIS ENDPOINT
 * This is the single AI entry point for OperionOS
 */

router.post("/analyze-contract", async (req, res) => {
  try {
    const { contract_text, document_id, metadata } = req.body;

    // =========================
    // 1. BASIC VALIDATION
    // =========================
    if (!contract_text) {
      return res.status(400).json({
        success: false,
        error: "contract_text is required",
      });
    }

    // =========================
    // 2. CONTEXT ENRICHMENT
    // (multi-tenant ready)
    // =========================
    const context = {
      user: req.user, // from your temp auth middleware
      org_id: req.user?.org_id || "default-org",
      document_id: document_id || null,
      metadata: metadata || {},
      request_id: generateRequestId(),
      timestamp: new Date().toISOString(),
    };

    // =========================
    // 3. ORCHESTRATOR CALL
    // =========================
    const result = await operionOrchestrator.analyzeContract({
      contract_text,
      context,
    });

    // =========================
    // 4. STRUCTURED RESPONSE
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
 * =========================
 * HEALTH CHECK FOR OPERION
 * =========================
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

module.exports = router;
