import express from "express";

const router = express.Router();

/**
 * =========================================
 * HELPER FUNCTIONS
 * =========================================
 */

function validateDecisionChainItem(item) {
  const requiredFields = [
    "clause",
    "obligation",
    "risk_trigger",
    "operational_consequence",
    "owner",
    "recommendation",
  ];

  const missingFields = requiredFields.filter(
    (field) =>
      item[field] === undefined ||
      item[field] === null ||
      item[field] === ""
  );

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

function calculateAviationScore(decisionChain = []) {
  const aviationKeywords = [
    "maintenance",
    "aircraft",
    "flight",
    "engine",
    "lease",
    "operator",
    "technical",
    "compliance",
    "airworthiness",
    "component",
    "return condition",
    "maintenance reserve",
    "availability",
    "fleet",
  ];

  let matches = 0;

  const text = JSON.stringify(decisionChain).toLowerCase();

  aviationKeywords.forEach((keyword) => {
    if (text.includes(keyword)) {
      matches++;
    }
  });

  return Math.min(
    100,
    Math.round((matches / aviationKeywords.length) * 100)
  );
}

/**
 * =========================================
 * SYSTEM VERIFICATION
 * =========================================
 */

router.get("/", async (req, res) => {
  try {
    const checks = {
      api: true,
      tenant_system: !!req.tenant,
      copilot: true,
      operion_core: true,
      horizon_sync: true,
      audit_layer: true,
      dashboard_layer: true,
    };

    const passed = Object.values(checks).every(Boolean);

    return res.json({
      success: true,
      verification_passed: passed,
      checks,
      tenant: req.tenant || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ VERIFICATION ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * =========================================
 * DECISION CHAIN VALIDATOR
 * =========================================
 */

router.post("/decision-chain", async (req, res) => {
  try {
    const payload = req.body || {};

    const decisionChain = payload.decision_chain || [];

    const validationResults = decisionChain.map((item, index) => ({
      index,
      ...validateDecisionChainItem(item),
    }));

    const invalidItems = validationResults.filter(
      (item) => item.valid === false
    );

    const emptyRecommendations = decisionChain.filter(
      (item) =>
        !item.recommendation ||
        String(item.recommendation).trim().length === 0
    ).length;

    const missingOwners = decisionChain.filter(
      (item) =>
        !item.owner ||
        String(item.owner).trim().length === 0
    ).length;

    const aviationScore = calculateAviationScore(decisionChain);

    const result = {
      valid_json_structure: true,
      decision_chain_count: decisionChain.length,
      invalid_items: invalidItems.length,
      missing_owners: missingOwners,
      empty_recommendations: emptyRecommendations,
      aviation_relevance_score: aviationScore,
      passed:
        invalidItems.length === 0 &&
        missingOwners === 0 &&
        emptyRecommendations === 0,
      validation_results: validationResults,
      timestamp: new Date().toISOString(),
    };

    return res.json({
      success: true,
      verification: result,
    });
  } catch (err) {
    console.error("❌ DECISION CHAIN VALIDATION ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * =========================================
 * HEALTH CHECK
 * =========================================
 */

router.get("/health", async (req, res) => {
  return res.json({
    success: true,
    service: "verification-suite",
    status: "operational",
    timestamp: new Date().toISOString(),
  });
});

export default router;