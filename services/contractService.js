// services/contractService.js

import { analyzeContractText } from "./aiExtractionService.js";
import { runHybridIntelligence } from "./hybridIntelligenceEngine.js";

/**
 * =========================================
 * OPERION OS
 * CONTRACT SERVICE (HYBRID MODE)
 * =========================================
 */

/**
 * -----------------------------------------
 * MAIN ENTRY (NEW INTELLIGENCE PIPELINE)
 * -----------------------------------------
 */

export async function processContract(text = "") {
  try {
    if (!text) {
      return {
        success: false,
        error: "No contract text provided",
      };
    }

    /**
     * -----------------------------------------
     * HYBRID INTELLIGENCE ENGINE (PRIMARY)
     * -----------------------------------------
     */

    const hybrid =
      await runHybridIntelligence(text);

    /**
     * -----------------------------------------
     * BACKWARD COMPATIBILITY AI SUMMARY
     * (kept for legacy endpoints/UI)
     * -----------------------------------------
     */

    const legacy =
      await analyzeContractText(text);

    /**
     * -----------------------------------------
     * FINAL RESPONSE
     * -----------------------------------------
     */

    return {
      success: true,

      mode: "hybrid_intelligence_v1",

      intelligence: hybrid?.intelligence,

      analysis: legacy?.analysis,

      metadata: {
        hybrid_enabled: true,
        ai_enabled: true,
        version: "14.2",
      },
    };
  } catch (error) {
    console.error("Contract Service Error:", error);

    return {
      success: false,
      error: error.message || "Contract processing failed",
    };
  }
}

/**
 * -----------------------------------------
 * LEGACY EXPORT (DO NOT BREAK OLD ROUTES)
 * -----------------------------------------
 */

export async function analyzeContractTextLegacy(text = "") {
  return analyzeContractText(text);
}
