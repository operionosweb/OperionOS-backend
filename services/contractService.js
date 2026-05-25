 // services/contractService.js

import supabase from "../config/supabase.js";
import { analyzeContractText } from "./aiExtractionService.js";
import { generateEmbedding } from "./embeddingService.js";
import { uploadFile } from "./storageService.js";
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
 * CREATE CONTRACT
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
     * OPTIONAL FILE UPLOAD (UPLOADCARE)
     */
    let fileUpload = null;

    if (contractPayload.fileBuffer) {
      fileUpload = await uploadFile(
        contractPayload.fileBuffer,
        contractPayload.filename || "contract.pdf"
      );
    }

    /**
     * HASH
     */
    const documentHash = generateHash(rawText);

    /**
     * DUPLICATE CHECK
     */
    const { data: existingContract } = await supabase
      .from("contracts")
      .select("*")
      .eq("document_hash", documentHash)
      .maybeSingle();

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
     * AI ANALYSIS
     */
    const analysis =
      contractPayload.analysis ||
      (await analyzeContractText(rawText));

    /**
     * INSERT
     */
    const { data, error } = await supabase
      .from("contracts")
      .insert({
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
        file_url: fileUpload?.file_url || null,
        file_uuid: fileUpload?.file_uuid || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    /**
     * EMBEDDINGS (ASYNC SAFE)
     */
    (async () => {
      try {
        const embeddingText = `${analysis?.summary || ""}\n${rawText.slice(0, 8000)}`;

        const embedding = await generateEmbedding(embeddingText);

        if (embedding) {
          await supabase
            .from("contracts")
            .update({ embedding })
            .eq("id", data.id);
        }
      } catch (err) {
        console.error("Embedding error:", err);
      }
    })();

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
      error: error.message,
    };
  }
}

/**
 * -----------------------------------------
 * GET ALL CONTRACTS
 * -----------------------------------------
 */

export async function getAllContracts() {
  const { data } = await supabase
    .from("contracts")
    .select("*")
    .order("created_at", { ascending: false });

  return data || [];
}

/**
 * -----------------------------------------
 * GET CONTRACT BY ID
 * -----------------------------------------
 */

export async function getContractById(id) {
  const { data } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", id)
    .single();

  return data || null;
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
 * DELETE CONTRACT (FIXED EXPORT)
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
