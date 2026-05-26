// services/vectorMemoryService.js

import OpenAI from "openai";
import supabase from "../config/supabase.js";

/**
 * =========================================
 * OPENAI EMBEDDINGS CLIENT
 * =========================================
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * =========================================
 * GENERATE EMBEDDING
 * =========================================
 */

export async function generateEmbedding(text = "") {
  try {
    if (!text || typeof text !== "string") {
      return {
        success: false,
        error: "Invalid text for embedding",
      };
    }

    /**
     * -----------------------------------------
     * OPENAI EMBEDDINGS
     * -----------------------------------------
     */

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 12000),
    });

    const embedding = response?.data?.[0]?.embedding;

    if (!embedding) {
      return {
        success: false,
        error: "Embedding generation failed",
      };
    }

    return {
      success: true,
      embedding,
    };
  } catch (error) {
    console.error("generateEmbedding error:", error);

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

/**
 * =========================================
 * SEMANTIC SEARCH
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
    console.error("semanticSearch error:", error);

    return {
      success: false,
      error: error.message || "Semantic search failed",
    };
  }
}
