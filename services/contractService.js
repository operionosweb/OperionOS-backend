// services/contractService.js

import supabase from "../config/supabase.js";
import { analyzeContractText } from "./aiExtractionService.js";
import crypto from "crypto";

/**
 * -----------------------------------------
 * HASH GENERATOR
 * -----------------------------------------
 */
function generateHash(text = "") {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * -----------------------------------------
 * CREATE CONTRACT (UPSERT SAFE PIPELINE)
 * -----------------------------------------
 */
export async function createContract(contractPayload = {}) {
  try {
    if (!contractPayload?.raw_text) {
      return {
        success: false,
        error: "raw_text is required",
      };
    }

    const rawText = contractPayload.raw_text;

    /**
     * -----------------------------------------
     * STEP 1: HASH (SOURCE OF TRUTH KEY)
     * -----------------------------------------
     */
    const documentHash = generateHash(rawText);

    const forceSave = contractPayload.force_save === "true";

    /**
     * -----------------------------------------
     * STEP 2: AI ANALYSIS (optional reuse)
     * -----------------------------------------
     */
    const analysis =
      contractPayload.analysis ||
      (await analyzeContractText(rawText));

    /**
     * -----------------------------------------
     * STEP 3: BUILD PAYLOAD
     * -----------------------------------------
     */
    const insertPayload = {
      name: contractPayload.name || "Unnamed Contract",
      supplier_name: analysis?.supplier_name || "Unknown Supplier",
      raw_text: rawText,

      document_hash: documentHash,

      duplicate_of: null, // resolved after upsert
      is_duplicate: false,

      contract_type: analysis?.contract_type || "General Contract",
      summary: analysis?.summary || "",
      clauses: analysis?.clauses || [],
      obligations: analysis?.obligations || [],
      risk_score: analysis?.risk_score || 0,
      contract_value: analysis?.contract_value || 0,
      start_date: analysis?.start_date || null,
      expiry_date: analysis?.expiry_date || null,

      created_at: new Date().toISOString(),
    };

    /**
     * -----------------------------------------
     * STEP 4: UPSERT (ATOMIC OPERATION)
     * -----------------------------------------
     * Requires UNIQUE constraint on document_hash
     */
    const { data, error } = await supabase
      .from("contracts")
      .upsert(insertPayload, {
        onConflict: "document_hash",
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) throw error;

    /**
     * -----------------------------------------
     * STEP 5: DUPLICATE DETECTION LOGIC (POST UPSERT SAFETY FLAG)
     * -----------------------------------------
     */
    const duplicateDetected = data?.created_at !== insertPayload.created_at;

    return {
      success: true,
      duplicate_detected: duplicateDetected,
      contract: data,
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
 * -----------------------------------------
 * GET ALL CONTRACTS
 * -----------------------------------------
 */
export async function getAllContracts() {
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return [];
  return data || [];
}

/**
 * -----------------------------------------
 * GET CONTRACT BY ID
 * -----------------------------------------
 */
export async function getContractById(id) {
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

/**
 * -----------------------------------------
 * UPDATE CONTRACT
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
    return { success: false, error: error.message };
  }

  return { success: true, contract: data };
}

/**
 * -----------------------------------------
 * DELETE CONTRACT
 * -----------------------------------------
 */
export async function deleteContract(id) {
  const { error } = await supabase
    .from("contracts")
    .delete()
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
