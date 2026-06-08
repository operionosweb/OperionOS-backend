import express from "express";
import { apiKeyMiddleware } from "../middleware/apiKeyMiddleware.js";
import { getContractById } from "../services/contractService.js";
import { generateContractCopilot } from "../contractCopilotEngine.js";

const router = express.Router();

/**
 * =========================================
 * HEALTH CHECK
 * =========================================
 */

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "copilot-routes",
    status: "operational",
  });
});

/**
 * =========================================
 * COPILOT ANALYZE CONTRACT
 * =========================================
 * POST /api/copilot/analyze/:contractId
 */

router.post("/analyze/:contractId", apiKeyMiddleware, async (req, res) => {
  try {
    const { contractId } = req.params;

    const contractResult = await getContractById(contractId);

    if (!contractResult?.success) {
      return res.status(404).json({
        success: false,
        error: "Contract not found",
      });
    }

    const copilotResult = await generateContractCopilot({
      contract: contractResult.contract,
      company_context: req.body?.company_context || {},
    });

    return res.status(200).json({
      success: true,
      contract_id: contractId,
      copilot: copilotResult,
    });
  } catch (error) {
    console.error("Copilot route error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Copilot analysis failed",
    });
  }
});

/**
 * =========================================
 * COPILOT DIRECT ANALYSIS (NO DB)
 * =========================================
 * POST /api/copilot/analyze-direct
 */

router.post("/analyze-direct", apiKeyMiddleware, async (req, res) => {
  try {
    const { contract } = req.body;

    if (!contract) {
      return res.status(400).json({
        success: false,
        error: "Contract object is required",
      });
    }

    const copilotResult = await generateContractCopilot({
      contract,
      company_context: req.body?.company_context || {},
    });

    return res.status(200).json({
      success: true,
      copilot: copilotResult,
    });
  } catch (error) {
    console.error("Copilot direct error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Direct copilot analysis failed",
    });
  }
});

export default router;
