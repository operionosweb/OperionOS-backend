// services/contractService.js

import crypto from "crypto";

import supabase from "../config/supabase.js";

import { analyzeContractText } from "./aiExtractionService.js";
import { ingestContract } from "./contractIngestionEngine.js";

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
     * INGESTION ENGINE
     * -----------------------------------------
     */

    const ingestion = await ingestContract({
      text,
      filename,
      fileId,
    });

    /**
     * -----------------------------------------
     * AI INTELLIGENCE
     * -----------------------------------------
     */

    const intelligence = await analyzeContractText(text);

    /**
     * -----------------------------------------
     * NORMALIZED DATA
     * -----------------------------------------
     */

    const contract = {
      id: generateId(),

      filename,

      file_id: fileId,

      contract_type:
        intelligence?.analysis?.contract_type ||
        ingestion?.contract_type ||
        "General Contract",

      supplier_name:
        intelligence?.analysis?.supplier_name ||
        "Unknown Supplier",

      summary:
        intelligence?.analysis?.summary ||
        "",

      risk_score:
        intelligence?.analysis?.risk_score || 0,

      contract_value:
        intelligence?.analysis?.contract_value || 0,

      clauses:
        intelligence?.analysis?.clauses || [],

      obligations:
        intelligence?.analysis?.obligations || [],

      document_hash:
        ingestion?.document_hash || null,

      provider_used:
        intelligence?.provider_used || "unknown",

      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    /**
     * -----------------------------------------
     * SAVE TO SUPABASE
     * -----------------------------------------
     */

    const { data, error } = await supabase
      .from("contracts")
      .insert(contract)
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);

      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      contract: data,
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
  try {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
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
      error: error.message,
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

    if (error || !data) {
      return {
        success: false,
        error: "Contract not found",
      };
    }

    return {
      success: true,
      contract: data,
    };
  } catch (error) {
    console.error("getContractById error:", error);

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * =========================================
 * UPDATE CONTRACT
 * =========================================
 */

export async function updateContract(id, updates = {}) {
  try {
    const { data, error } = await supabase
      .from("contracts")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return {
        success: false,
        error: "Contract update failed",
      };
    }

    return {
      success: true,
      contract: data,
    };
  } catch (error) {
    console.error("updateContract error:", error);

    return {
      success: false,
      error: error.message,
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
    const { data, error } = await supabase
      .from("contracts")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return {
        success: false,
        error: "Delete failed",
      };
    }

    return {
      success: true,
      deleted: data,
    };
  } catch (error) {
    console.error("deleteContract error:", error);

    return {
      success: false,
      error: error.message,
    };
  }
}
