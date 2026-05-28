// services/vectorMemoryService.js

import OpenAI from "openai";
import supabase from "../config/supabase.js";

/**
 * =========================================
 * OPENAI CLIENT
 * =========================================
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * =========================================
 * GENERATE EMBEDDING (DEBUG MODE)
 * =========================================
 */

export async function generateEmbedding(text = "") {
  try {
    if (!text || typeof text !== "string") {
      console.error("❌ Embedding input invalid:", text);

      return {
        success: false,
        error: "Invalid text for embedding",
      };
    }

    console.log("🧠 Generating embedding...");
    console.log("🔑 API KEY exists:", !!process.env.OPENAI_API_KEY);
    console.log("📏 Input length:", text.length);

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 12000),
    });

    if (!response) {
      console.error("❌ No response from OpenAI");

      return {
        success: false,
        error: "No response from OpenAI",
      };
    }

    const embedding = response?.data?.[0]?.embedding;

    if (!embedding) {
      console.error("❌ Embedding missing in response:", response);

      return {
        success: false,
        error: "Embedding missing from OpenAI response",
      };
    }

    console.log("✅ Embedding generated successfully");

    return {
      success: true,
      embedding,
    };
  } catch (error) {
    console.error("🚨 OPENAI EMBEDDING ERROR:");
    console.error("Message:", error.message);
    console.error("Status:", error.status);
    console.error("Error object:", error);

    return {
      success: false,
      error: error.message || "Embedding failed",
    };
  }
}

/**
 * =========================================
 * STORE EMBEDDING
 * =========================================
 */

export async function storeEmbedding({
  contractId,
  documentHash,
  embedding,
  metadata = {},
}) {
  try {
    const { data, error } = await supabase
      .from("contract_embeddings")
      .insert({
        contract_id: contractId,
        document_hash: documentHash,
        embedding,
        metadata,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      success: true,
      embedding_record: data,
    };
  } catch (error) {
    console.error("storeEmbedding error:", error);

    return {
      success: false,
      error: error.message || "Embedding storage failed",
    };
  }
}
