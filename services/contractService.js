// services/contractService.js

import crypto from "crypto";

import supabase from "../config/supabase.js";

import { analyzeContractText } from "./aiExtractionService.js";
import { ingestContract } from "./contractIngestionEngine.js";

import {
  generateEmbedding,
  storeEmbedding,
} from "./vectorMemoryService.js";

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
     * VALIDATION
     * -----------------------------------------
     */

    if (!text || typeof text !== "string") {
      return {
        success: false,
        error: "Contract text is required",
      };
    }

    /**
     * -----------------------------------------
     * INGESTION ENGINE
     * -----------------------------------------
     */

    const ingestion = await ingestContract({
      text,
      filename,
      fileId,
    });

    if (!ingestion.success) {
      return ingestion;
    }

    /**
     * -----------------------------------------
     * AI ANALYSIS
     * -----------------------------------------
     */

    const intelligence = await analyzeContractText(text);

    if (!intelligence.success) {
      return intelligence;
    }

    /**
     * -----------------------------------------
     * NORMALIZED CONTRACT
     * -----------------------------------------
     */

    const contract = {
      id: generateId(),

      filename,

      file_id: fileId,

      contract_type:
        intelligence.analysis.contract_type,

      supplier_name:
        intelligence.analysis.supplier_name,

      summary:
        intelligence.analysis.summary,

      risk_score:
        intelligence.analysis.risk_score,

      contract_value:
        intelligence.analysis.contract_value,

      clauses:
        intelligence.analysis.clauses,

      obligations:
        intelligence.analysis.obligations,

      document_hash:
        ingestion.document_hash,

      provider_used:
        intelligence.provider_used,

      created_at:
        new Date().toISOString(),

      updated_at:
        new Date().toISOString(),
    };

    /**
     * -----------------------------------------
     * STORE CONTRACT
     * -----------------------------------------
     */

    const { data, error } = await supabase
      .from("contracts")
      .insert(contract)
      .select()
      .single();

    if (error) {
      throw error;
    }

    /**
     * -----------------------------------------
     * VECTOR MEMORY GENERATION
     * -----------------------------------------
     */

    try {
      const embeddingResult =
        await generateEmbedding(text);

      if (embeddingResult.success) {
        await storeEmbedding({
          contractId: data.id,
          documentHash: data.document_hash,
          embedding: embeddingResult.embedding,
          metadata: {
            filename: data.filename,
            contract_type: data.contract_type,
            supplier_name: data.supplier_name,
            risk_score: data.risk_score,
          },
        });

        console.log(
          "🧠 Vector memory stored:",
          data.id
        );
      }
    } catch (embeddingError) {
      console.error(
        "Embedding pipeline error:",
        embeddingError
      );
    }

    /**
     * -----------------------------------------
     * RESPONSE
     * -----------------------------------------
     */

    return {
      success: true,
      contract: data,
    };
  } catch (error) {
    console.error("createContract error:", error);

    return {
      success: false,
      error:
        error.message ||
        "Contract creation failed",
    };
  }
}

/**
 * =========================================
 * GET ALL CONTRACTS
 * =========================================
 */

export async function getAllContracts() {
  try {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    return {
      success: true,
      total: data.length,
      contracts: data,
    };
  } catch (error) {
    console.error("getAllContracts error:", error);

    return {
      success: false,
      error:
        error.message ||
        "Failed to fetch contracts",
    };
  }
}

/**
 * =========================================
 * GET CONTRACT BY ID
 * =========================================
 */

export async function getContractById(id) {
  try {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw error;
    }

    return {
      success: true,
      contract: data,
    };
  } catch (error) {
    console.error("getContractById error:", error);

    return {
      success: false,
      error:
        error.message ||
        "Contract not found",
    };
  }
}

/**
 * =========================================
 * UPDATE CONTRACT
 * =========================================
 */

export async function updateContract(
  id,
  updates = {}
) {
  try {
    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("contracts")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      success: true,
      contract: data,
    };
  } catch (error) {
    console.error("updateContract error:", error);

    return {
      success: false,
      error:
        error.message ||
        "Update failed",
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
    const { error } = await supabase
      .from("contracts")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }

    return {
      success: true,
      deleted_id: id,
    };
  } catch (error) {
    console.error("deleteContract error:", error);

    return {
      success: false,
      error:
        error.message ||
        "Delete failed",
    };
  }
}
