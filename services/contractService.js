// services/contractService.js

import { extractStructuredContractData } from "./contractExtractionEngine.js";
import { ingestContract } from "./contractIngestionEngine.js";

/**
 * =========================================
 * OPERION OS - CONTRACT SERVICE LAYER
 * API BUSINESS LOGIC ORCHESTRATION
 * =========================================
 */

/**
 * -----------------------------------------
 * CREATE CONTRACT (MAIN ENTRY)
 * -----------------------------------------
 */

export async function createContract({
  text,
  filename = "unknown.pdf",
  fileId = null
}) {
  try {
    if (!text) {
      return {
        success: false,
        error: "No contract text provided"
      };
    }

    /**
     * STEP 1 — AI STRUCTURED EXTRACTION
     */

    const extraction = await extractStructuredContractData(text);

    /**
     * STEP 2 — INGESTION PIPELINE (AUDIT + HASH + TYPE)
     */

    const ingestion = await ingestContract({
      text,
      filename,
      fileId
    });

    /**
     * STEP 3 — MERGE OUTPUTS
     */

    return {
      success: true,
      contract: {
        ...extraction,
        ingestion
      }
    };

  } catch (error) {
    console.error("createContract error:", error);

    return {
      success: false,
      error: error.message || "Contract creation failed"
    };
  }
}

/**
 * -----------------------------------------
 * GET CONTRACT (PLACEHOLDER SAFE LAYER)
 * -----------------------------------------
 */

export async function getContract(id) {
  try {
    return {
      success: true,
      contract_id: id,
      message: "Contract retrieval not yet implemented"
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * -----------------------------------------
 * DELETE CONTRACT (PLACEHOLDER SAFE LAYER)
 * -----------------------------------------
 */

export async function deleteContract(id) {
  try {
    return {
      success: true,
      contract_id: id,
      deleted: true
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
