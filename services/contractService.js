// services/contractService.js

import supabase from "../config/supabase.js";
import { analyzeContractText } from "./aiExtractionService.js";

/**
 * -----------------------------------------
 * UTIL: HASH (for stronger dedup than raw_text compare)
 * -----------------------------------------
 */
import crypto from "crypto";

function generateHash(text = "") {
  return crypto
    .createHash("sha256")
    .update(text)
    .digest("hex");
}

/**
 * -----------------------------------------
 * CREATE CONTRACT (CORE PIPELINE)
 * -----------------------------------------
 */
export async function createContract(contractPayload = {}) {
  try {
    /**
     * Validate input
     */
    if (!contractPayload?.raw_text) {
      return {
        success: false,
        error: "raw_text is required",
      };
    }

    const rawText = contractPayload.raw_text;

    /**
     * -----------------------------------------
     * STEP 1: HASH (primary dedup key)
     * -----------------------------------------
     */
    const documentHash = generateHash(rawText);

    /**
     * -----------------------------------------
     * STEP 2: CHECK CACHE (by hash)
     * -----------------------------------------
     */
    const { data: existingContract, error: fetchError } =
      await supabase
        .from("contracts")
        .select("*")
        .eq("document_hash", documentHash)
        .maybeSingle();

    if (fetchError) {
      console.error("Supabase fetch error:", fetchError);
    }

    /**
     * If found → return cached version immediately
     */
    if (existingContract) {
      console.log("⚡ Cache hit: contract already exists");

      return {
        success: true,
        cached: true,
        contract: existingContract,
      };
    }

    /**
     * -----------------------------------------
     * STEP 3: AI ANALYSIS (only if not cached)
     * -----------------------------------------
     */
    const analysis = await analyzeContractText(rawText);

    /**
     * -----------------------------------------
     * STEP 4: BUILD DB RECORD
     * -----------------------------------------
     */
    const insertPayload = {
      name: contractPayload.name || "Unnamed Contract",

      supplier_name:
        analysis?.supplier_name ||
        contractPayload?.supplier_name ||
        "Unknown Supplier",

      contract_type:
        analysis?.contract_type || "General Contract",

      summary: analysis?.summary || "",

      raw_text: rawText,

      document_hash: documentHash,

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
     * STEP 5: INSERT CONTRACT
     * -----------------------------------------
     */
    const { data, error } = await supabase
      .from("contracts")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    /**
     * -----------------------------------------
     * RESPONSE
     * -----------------------------------------
     */
    return {
      success: true,
      cached: false,
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
  try {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error("getAllContracts Error:", error);
    return [];
  }
}

/**
 * -----------------------------------------
 * GET CONTRACT BY ID
 * -----------------------------------------
 */
export async function getContractById(id) {
  try {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error("getContractById Error:", error);
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

    if (error) throw error;

    return {
      success: true,
      contract: data,
    };
  } catch (error) {
    console.error("updateContract Error:", error);

    return {
      success: false,
      error: error.message,
    };
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

    if (error) throw error;

    return {
      success: true,
    };
  } catch (error) {
    console.error("deleteContract Error:", error);

    return {
      success: false,
      error: error.message,
    };
  }
}
