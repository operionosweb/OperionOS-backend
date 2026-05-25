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
 * CREATE CONTRACT (ENTERPRISE CORE)
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
     * STEP 1: DOCUMENT HASH
     * -----------------------------------------
     */
    const documentHash = generateHash(rawText);

    /**
     * -----------------------------------------
     * STEP 2: DUPLICATE CHECK (SOURCE OF TRUTH = SUPABASE)
     * -----------------------------------------
     */
    const { data: existingContract, error: fetchError } =
      await supabase
        .from("contracts")
        .select("*")
        .eq("document_hash", documentHash)
        .maybeSingle();

    if (fetchError) {
      console.error("Duplicate check error:", fetchError);
    }

    const forceSave = contractPayload.force_save === "true";

    if (existingContract && !forceSave) {
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
     * STEP 3: AI ANALYSIS
     * -----------------------------------------
     */
    const analysis =
      contractPayload.analysis ||
      (await analyzeContractText(rawText));

    /**
     * -----------------------------------------
     * STEP 4: INSERT CONTRACT
     * -----------------------------------------
     */
    const insertPayload = {
      name: contractPayload.name || "Unnamed Contract",
      supplier_name: analysis?.supplier_name || "Unknown Supplier",
      raw_text: rawText,
      document_hash: documentHash,
      duplicate_of: existingContract?.id || null,
      is_duplicate: !!existingContract,
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

    const { data, error } = await supabase
      .from("contracts")
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      duplicate_detected: !!existingContract,
      duplicate_of: existingContract?.id || null,
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
