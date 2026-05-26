// services/contractService.js

import crypto from "crypto";

import { analyzeContractText } from "./aiExtractionService.js";
import { ingestContract } from "./contractIngestionEngine.js";

/**
 * =========================================
 * IN-MEMORY STORE
 * TEMPORARY DATABASE LAYER
 * =========================================
 */

const contracts = [];

/**
 * =========================================
 * HELPERS
 * =========================================
 */

function generateId() {
  return crypto.randomUUID();
}

/**
 * =========================================
 * CREATE CONTRACT
 * =========================================
 */

export async function createContract({
  filename = "unknown.pdf",
  text = "",
  uploaded_by = "system",
}) {
  try {
    /**
     * -----------------------------------------
     * INGESTION LAYER
     * -----------------------------------------
     */

    const ingestion = await ingestContract({
      text,
      filename,
    });

    /**
     * -----------------------------------------
     * AI ANALYSIS
     * -----------------------------------------
     */

    const aiAnalysis = await analyzeContractText(text);

    /**
     * -----------------------------------------
     * FINAL OBJECT
     * -----------------------------------------
     */

    const contract = {
      id: generateId(),

      filename,

      uploaded_by,

      created_at: new Date().toISOString(),

      ingestion,

      analysis: aiAnalysis?.analysis || {},

      provider_used:
        aiAnalysis?.provider_used || "unknown",

      document_hash:
        ingestion?.document_hash || null,
    };

    contracts.push(contract);

    return {
      success: true,
      contract,
    };
  } catch (error) {
    console.error("createContract Error:", error);

    return {
      success: false,
      error: error.message || "Failed to create contract",
    };
  }
}

/**
 * =========================================
 * GET ALL CONTRACTS
 * =========================================
 */

export async function getAllContracts() {
  return {
    success: true,
    total: contracts.length,
    contracts,
  };
}

/**
 * =========================================
 * GET CONTRACT BY ID
 * =========================================
 */

export async function getContractById(id) {
  try {
    const contract = contracts.find((c) => c.id === id);

    if (!contract) {
      return {
        success: false,
        error: "Contract not found",
      };
    }

    return {
      success: true,
      contract,
    };
  } catch (error) {
    console.error("getContractById Error:", error);

    return {
      success: false,
      error: error.message || "Failed to fetch contract",
    };
  }
}

/**
 * =========================================
 * DELETE CONTRACT
 * =========================================
 */

export async function deleteContract(id) {
  try {
    const index = contracts.findIndex((c) => c.id === id);

    if (index === -1) {
      return {
        success: false,
        error: "Contract not found",
      };
    }

    contracts.splice(index, 1);

    return {
      success: true,
      deleted_id: id,
    };
  } catch (error) {
    console.error("deleteContract Error:", error);

    return {
      success: false,
      error: error.message || "Failed to delete contract",
    };
  }
}
