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
 * CREATE CONTRACT (EU-FIRST STORAGE ENABLED)
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
     * STEP 1: STORAGE (UPLOADCARE)
     * -----------------------------------------
     * Optional: only runs if file is provided
     */
    let fileUpload = null;

    if (contractPayload.fileBuffer) {
      fileUpload = await uploadFile(
        contractPayload.fileBuffer,
        contractPayload.filename || "contract.pdf"
      );
    }

    /**
     * -----------------------------------------
     * STEP 2: DOCUMENT HASH
     * -----------------------------------------
     */
    const documentHash = generateHash(rawText);

    /**
     * -----------------------------------------
     * STEP 3: DUPLICATE CHECK
     * -----------------------------------------
     */
    const { data: existingContract, error: fetchError } = await supabase
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
     * STEP 4: AI ANALYSIS
     * -----------------------------------------
     */
    const analysis =
      contractPayload.analysis ||
      (await analyzeContractText(rawText));

    /**
     * -----------------------------------------
     * STEP 5: INSERT CONTRACT
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

      /**
       * -----------------------------------------
       * EU STORAGE METADATA (UPLOADCARE)
       * -----------------------------------------
       */
      file_url: fileUpload?.file_url || null,
      file_uuid: fileUpload?.file_uuid || null,

      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("contracts")
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;

    /**
     * -----------------------------------------
     * STEP 6: EMBEDDINGS (ASYNC SAFE MODE)
     * -----------------------------------------
     */
    (async () => {
      try {
        const embeddingText = `
          ${analysis?.summary || ""}
          ${rawText.slice(0, 8000)}
        `;

        const embedding = await generateEmbedding(embeddingText);

        if (embedding) {
          await supabase
            .from("contracts")
            .update({ embedding })
            .eq("id", data.id);
        }
      } catch (err) {
        console.error("Embedding generation failed:", err);
      }
    })();

    /**
     * -----------------------------------------
     * RESPONSE
     * -----------------------------------------
     */
    return {
      success: true,
      duplicate_detected: !!existingContract,
      duplicate_of: existingContract?.id || null,
      file_uploaded: !!fileUpload,
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
