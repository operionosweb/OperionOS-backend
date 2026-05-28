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
 * GENERATE EMBEDDING (DEBUG SAFE)
 * =========================================
 */

export async function generateEmbedding(text = "") {
  try {
    /**
     * ENV DEBUG (CRITICAL FOR RENDER)
     */
    console.log("🔴 OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);

    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        error: "OPENAI_API_KEY missing in runtime environment",
      };
    }

    if (!text || typeof text !== "string") {
      return {
        success: false,
        error: "Invalid text input for embedding",
      };
    }

    console.log("🧠 Generating embedding...");
    console.log("📏 Input length:", text.length);

    /**
     * OPENAI REQUEST
     */

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 12000),
    });

    /**
     * VALIDATION
     */

    const embedding = response?.data?.[0]?.embedding;

    if (!embedding) {
      console.error("❌ Invalid OpenAI response:", response);

      return {
        success: false,
        error: "Empty embedding returned from OpenAI",
      };
    }

    console.log("✅ Embedding generated successfully");

    return {
      success: true,
      embedding,
    };
  } catch (error) {
    console.error("🚨 OpenAI Embedding Error:");
    console.error("Message:", error.message);
    console.error("Status:", error.status);
    console.error("Full error:", error);

    return {
      success: false,
      error: error.message || "Embedding generation failed",
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

/**
 * =========================================
 * SEMANTIC SEARCH (RPC fallback)
 * =========================================
 */

export async function semanticSearch({
  embedding,
  matchCount = 5,
}) {
  try {
    const { data, error } = await supabase.rpc(
      "match_contract_embeddings",
      {
        query_embedding: embedding,
        match_count: matchCount,
      }
    );

    if (error) {
      throw error;
    }

    return {
      success: true,
      matches: data || [],
    };
  } catch (error) {
    console.error("semanticSearch RPC error:", error);

    return {
      success: false,
      error: error.message || "Semantic search failed",
    };
  }
}
