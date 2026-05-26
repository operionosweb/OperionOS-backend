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
 * GENERATE EMBEDDING (DEBUG ENHANCED)
 * =========================================
 */

export async function generateEmbedding(text = "") {
  try {
    /**
     * -----------------------------------------
     * VALIDATION
     * -----------------------------------------
     */

    if (!text || typeof text !== "string") {
      return {
        success: false,
        error: "Invalid text for embedding",
      };
    }

    /**
     * -----------------------------------------
     * DEBUG: CHECK ENV LOADED
     * -----------------------------------------
     */

    console.log(
      "OPENAI KEY EXISTS:",
      !!process.env.OPENAI_API_KEY
    );

    console.log(
      "Generating embedding for text length:",
      text.length
    );

    /**
     * -----------------------------------------
     * OPENAI EMBEDDINGS CALL
     * -----------------------------------------
     */

    const response =
      await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000),
      });

    console.log(
      "OpenAI embedding response received"
    );

    const embedding =
      response?.data?.[0]?.embedding;

    /**
     * -----------------------------------------
     * VALIDATE RESPONSE
     * -----------------------------------------
     */

    if (!embedding) {
      console.error(
        "❌ Invalid OpenAI response:",
        JSON.stringify(
          response,
          null,
          2
        )
      );

      return {
        success: false,
        error:
          "No embedding returned from OpenAI",
      };
    }

    return {
      success: true,
      embedding,
    };
  } catch (error) {
    console.error(
      "❌ OPENAI EMBEDDING ERROR:",
      {
        message: error.message,
        status: error.status,
        stack: error.stack,
        response: error.response?.data,
      }
    );

    return {
      success: false,
      error:
        error.message ||
        "Embedding failed",
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
    console.error(
      "storeEmbedding error:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Embedding storage failed",
    };
  }
}

/**
 * =========================================
 * DIRECT VECTOR SEARCH (LEGACY)
 * =========================================
 */

export async function semanticSearch({
  embedding,
  matchCount = 5,
}) {
  try {
    const { data, error } =
      await supabase.rpc(
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
    console.error(
      "semanticSearch error:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Semantic search failed",
    };
  }
}
