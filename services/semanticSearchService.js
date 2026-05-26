// services/semanticSearchService.js

import supabase from "../config/supabase.js";

import {
  generateEmbedding,
} from "./vectorMemoryService.js";

/**
 * =========================================
 * COSINE SIMILARITY
 * =========================================
 */

function cosineSimilarity(a = [], b = []) {
  try {
    if (!a.length || !b.length) {
      return 0;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (!normA || !normB) {
      return 0;
    }

    return dot / (normA * normB);
  } catch (error) {
    console.error(
      "cosineSimilarity error:",
      error
    );

    return 0;
  }
}

/**
 * =========================================
 * SEMANTIC SEARCH
 * =========================================
 */

export async function semanticSearch(
  query = "",
  limit = 5
) {
  try {
    /**
     * -----------------------------------------
     * VALIDATION
     * -----------------------------------------
     */

    if (!query || typeof query !== "string") {
      return {
        success: false,
        error: "Query is required",
      };
    }

    /**
     * -----------------------------------------
     * QUERY EMBEDDING
     * -----------------------------------------
     */

    const embeddingResult =
      await generateEmbedding(query);

    if (!embeddingResult.success) {
      return {
        success: false,
        error: "Embedding generation failed",
      };
    }

    const queryEmbedding =
      embeddingResult.embedding;

    /**
     * -----------------------------------------
     * LOAD VECTOR MEMORY
     * -----------------------------------------
     */

    const { data, error } = await supabase
      .from("contract_embeddings")
      .select("*");

    if (error) {
      throw error;
    }

    const embeddings = data || [];

    /**
     * -----------------------------------------
     * CALCULATE SIMILARITIES
     * -----------------------------------------
     */

    const scored = embeddings.map(
      (item) => {
        const similarity =
          cosineSimilarity(
            queryEmbedding,
            item.embedding || []
          );

        return {
          ...item,
          similarity_score: similarity,
        };
      }
    );

    /**
     * -----------------------------------------
     * SORT + LIMIT
     * -----------------------------------------
     */

    const topResults = scored
      .sort(
        (a, b) =>
          b.similarity_score -
          a.similarity_score
      )
      .slice(0, limit);

    /**
     * -----------------------------------------
     * LOAD CONTRACTS
     * -----------------------------------------
     */

    const contractIds =
      topResults.map(
        (r) => r.contract_id
      );

    const { data: contracts } =
      await supabase
        .from("contracts")
        .select("*")
        .in("id", contractIds);

    /**
     * -----------------------------------------
     * MERGE SCORES
     * -----------------------------------------
     */

    const merged = topResults.map(
      (result) => {
        const contract =
          contracts.find(
            (c) =>
              c.id ===
              result.contract_id
          );

        return {
          similarity_score:
            Number(
              result.similarity_score.toFixed(
                4
              )
            ),

          contract,
        };
      }
    );

    return {
      success: true,
      query,
      total_results: merged.length,
      results: merged,
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
