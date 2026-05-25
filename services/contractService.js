// services/contractService.js

import supabase from "../config/supabase.js";
import crypto from "crypto";
import { analyzeContractText } from "./aiExtractionService.js";

/**
 * -----------------------------------------
 * HASH
 * -----------------------------------------
 */

function generateHash(text = "") {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * -----------------------------------------
 * NORMALIZE INPUT PAYLOAD
 * -----------------------------------------
 */

function normalizePayload(payload = {}) {
  return {
    name: payload.name || "Unnamed Contract",
    raw_text: payload.raw_text || "",
    force_save: payload.force_save === "true",
    company_id: payload.company_id || null,
  };
}

/**
 * -----------------------------------------
 * CREATE CONTRACT (PRODUCTION SAFE)
 * -----------------------------------------
 */

export async function createContract(contractPayload = {}) {
  try {
    const payload = normalizePayload(contractPayload);

    if (!payload.raw_text) {
      return {
        success: false,
        error: "raw_text is required",
      };
    }

    /**
     * -----------------------------------------
     * HASH GENERATION
     * -----------------------------------------
     */

    const documentHash = generateHash(payload.raw_text);

    /**
     * -----------------------------------------
     * DUPLICATE CHECK (Supabase)
     * -----------------------------------------
     */

    const { data: existingContract } = await supabase
      .from("contracts")
      .select("*")
      .eq("document_hash", documentHash)
      .maybeSingle();

    /**
     * -----------------------------------------
     * FORCE SAVE LOGIC
     * -----------------------------------------
     */

    if (existingContract && !payload.force_save) {
      return {
        success: true,
        duplicate_detected: true,
        duplicate_of: existingContract.id,
        action_required: "Set force_save=true to override",
        existing_contract: existingContract,
      };
    }

    /**
     * -----------------------------------------
     * AI ANALYSIS (SINGLE SOURCE OF TRUTH)
     * -----------------------------------------
     */

    const analysisResult = await analyzeContractText(payload.raw_text);

    if (!analysisResult?.success) {
      return {
        success: false,
        error: "AI analysis failed",
      };
    }

    const analysis = analysisResult.analysis || {};

    /**
     * -----------------------------------------
     * FINAL INSERT PAYLOAD (CLEAN + STABLE SCHEMA)
     * -----------------------------------------
     */

    const insertPayload = {
      name: payload.name,
      supplier_name: analysis.supplier_name || "Unknown Supplier",
      raw_text: payload.raw_text,
      document_hash: documentHash,

      duplicate_of: existingContract?.id || null,
      is_duplicate: !!existingContract,

      contract_type: analysis.contract_type || "General Contract",
      summary: analysis.summary || "",

      clauses: Array.isArray(analysis.clauses) ? analysis.clauses : [],
      obligations: Array.isArray(analysis.obligations)
        ? analysis.obligations
        : [],

      risk_score: analysis.risk_score || 0,
      contract_value: analysis.contract_value || 0,

      start_date: analysis.start_date || null,
      expiry_date: analysis.expiry_date || null,

      created_at: new Date().toISOString(),
    };

    /**
     * -----------------------------------------
     * INSERT INTO SUPABASE
     * -----------------------------------------
     */

    const { data, error } = await supabase
      .from("contracts")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error("Supabase Insert Error:", error);
      throw error;
    }

    /**
     * -----------------------------------------
     * RESPONSE
     * -----------------------------------------
     */

    return {
      success: true,
      duplicate_detected: !!existingContract,
      duplicate_of: existingContract?.id || null,
      contract: data,
      analysis_provider: analysisResult.provider_used || "unknown",
    };
  } catch (error) {
    console.error("createContract Error:", error);

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * -----------------------------------------
 * READ OPERATIONS
 * -----------------------------------------
 */

export async function getAllContracts() {
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAllContracts Error:", error);
    return [];
  }

  return data || [];
}

export async function getContractById(id) {
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("getContractById Error:", error);
    return null;
  }

  return data;
}

/**
 * -----------------------------------------
 * UPDATE
 * -----------------------------------------
 */

export async function updateContract(id, updates = {}) {
  const { data, error } = await supabase
    .from("contracts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: true,
    contract: data,
  };
}

/**
 * -----------------------------------------
 * DELETE
 * -----------------------------------------
 */

export async function deleteContract(id) {
  const { error } = await supabase
    .from("contracts")
    .delete()
    .eq("id", id);

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: true,
  };
}
