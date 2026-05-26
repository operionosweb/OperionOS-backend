// services/semanticSearchService.js

import supabase from "../config/supabase.js";

import {
  generateEmbedding,
} from "./vectorMemoryService.js";

/**
 * =========================================
 * SEMANTIC CONTRACT SEARCH
 * =========================================
 */

export async function semanticSearch(
  query,
  limit = 5
) {
  try {
    if (!query) {
      return {
        success: false,
        error: "Query required",
      };
    }

    /**
     * -----------------------------------------
     * GENERATE QUERY EMBEDDING
     * -----------------------------------------
     */

    const embeddingResult =
      await generateEmbedding(query);

    if (!embeddingResult.success) {
      return embeddingResult;
    }

    /**
     * -----------------------------------------
     * VECTOR SEARCH
     * -----------------------------------------
     */

    const { data, error } = await supabase.rpc(
      "match_contract_embeddings",
      {
        query_embedding:
          embeddingResult.embedding,

        match_count: limit,
      }
    );

    if (error) {
      throw error;
    }

    return {
      success: true,
      query,
      matches: data || [],
      total_matches: data?.length || 0,
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
