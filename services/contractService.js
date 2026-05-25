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
 * CREATE CONTRACT (PRODUCTION SAFE)
 * -----------------------------------------
 */
export async function createContract(contractPayload = {}) {
  try {
    if (!contractPayload?.raw_text) {
      return { success: false, error: "raw_text is required" };
    }

    const rawText = contractPayload.raw_text;
    const documentHash = generateHash(rawText);

    /**
     * -----------------------------------------
     * DUPLICATE CHECK (SAFE)
     * -----------------------------------------
     */
    let existingContract = null;

    const { data: existing, error: fetchError } = await supabase
      .from("contracts")
      .select("*")
      .eq("document_hash", documentHash)
      .maybeSingle();

    if (fetchError) {
      console.error("Duplicate check error:", fetchError);
    }

    existingContract = existing || null;

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
     * AI ANALYSIS (SAFE FALLBACK)
     * -----------------------------------------
     */
    let analysis = null;

    try {
      analysis =
        contractPayload.analysis ||
        (await analyzeContractText(rawText));
    } catch (aiError) {
      console.error("AI analysis failed:", aiError);

      analysis = {
        supplier_name: "Unknown Supplier",
        contract_type: "General Contract",
        summary: "",
        clauses: [],
        obligations: [],
        risk_score: 0,
        contract_value: 0,
        start_date: null,
        expiry_date: null,
      };
    }

    /**
     * -----------------------------------------
     * INSERT PAYLOAD
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

    if (error) {
      console.error("Insert error:", error);
      throw error;
    }

    return {
      success: true,
      duplicate_detected: !!existingContract,
      duplicate_of: existingContract?.id || null,
      contract: data,
    };
  } catch (error) {
    console.error("createContract fatal error:", error);

    return {
      success: false,
      error: error.message || "Failed to create contract",
    };
  }
}

/**
 * -----------------------------------------
 * READ ALL CONTRACTS (SAFE)
 * -----------------------------------------
 */
export async function getAllContracts() {
  try {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getAllContracts error:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("getAllContracts fatal:", error);
    return [];
  }
}

/**
 * -----------------------------------------
 * GET CONTRACT BY ID (SAFE)
 * -----------------------------------------
 */
export async function getContractById(id) {
  try {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("getContractById error:", error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error("getContractById fatal:", error);
    return null;
  }
}

/**
 * -----------------------------------------
 * UPDATE CONTRACT
 * -----------------------------------------
 */
export async function updateContract(id, updates = {}) {
  try {
    const { data, error } = await supabase
      .from("contracts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("updateContract error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, contract: data };
  } catch (error) {
    console.error("updateContract fatal:", error);
    return { success: false, error: error.message };
  }
}

/**
 * -----------------------------------------
 * DELETE CONTRACT
 * -----------------------------------------
 */
export async function deleteContract(id) {
  try {
    const { error } = await supabase
      .from("contracts")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("deleteContract error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("deleteContract fatal:", error);
    return { success: false, error: error.message };
  }
}
