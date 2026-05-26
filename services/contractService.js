// services/contractService.js

import crypto from "crypto";

import { analyzeContractText } from "./aiExtractionService.js";
import { ingestContract } from "./contractIngestionEngine.js";

/**
 * =========================================
 * IN-MEMORY CONTRACT STORE
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
  text,
  filename = "contract.pdf",
  fileId = null,
}) {
  try {
    /**
     * -----------------------------------------
     * INGESTION
     * -----------------------------------------
     */

    const ingestion = await ingestContract({
      text,
      filename,
      fileId,
    });

    /**
     * -----------------------------------------
     * AI ANALYSIS
     * -----------------------------------------
     */

    const intelligence = await analyzeContractText(text);

    /**
     * -----------------------------------------
     * CONTRACT OBJECT
     * -----------------------------------------
     */

    const contract = {
      id: generateId(),

      filename,

      file_id: fileId,

      created_at: new Date().toISOString(),

      ingestion,

      intelligence,
    };

    contracts.push(contract);

    return {
      success: true,
      contract,
    };
  } catch (error) {
    console.error("createContract error:", error);

    return {
      success: false,
      error: error.message || "Contract creation failed",
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
}

/**
 * =========================================
 * UPDATE CONTRACT
 * =========================================
 */

export async function updateContract(id, updates = {}) {
  const index = contracts.findIndex((c) => c.id === id);

  if (index === -1) {
    return {
      success: false,
      error: "Contract not found",
    };
  }

  contracts[index] = {
    ...contracts[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  return {
    success: true,
    contract: contracts[index],
  };
}

/**
 * =========================================
 * DELETE CONTRACT
 * =========================================
 */

export async function deleteContract(id) {
  const index = contracts.findIndex((c) => c.id === id);

  if (index === -1) {
    return {
      success: false,
      error: "Contract not found",
    };
  }

  const deleted = contracts.splice(index, 1);

  return {
    success: true,
    deleted: deleted[0],
  };
}
