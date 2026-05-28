// services/semanticSearchService.js

import supabase from "../config/supabase.js";

/**
 * =========================================
 * SIMPLE TEXT SIMILARITY (NO OPENAI)
 * =========================================
 */

function simpleScore(text = "", query = "") {
  if (!text || !query) return 0;

  const t = text.toLowerCase();
  const q = query.toLowerCase().split(" ");

  let score = 0;

  for (const word of q) {
    if (t.includes(word)) {
      score += 1;
    }
  }

  return score / q.length;
}

/**
 * =========================================
 * SEMANTIC SEARCH (FALLBACK MODE)
 * =========================================
 */

export async function semanticSearch(query = "", limit = 5) {
  try {
    if (!query || typeof query !== "string") {
      return {
        success: false,
        error: "Query is required",
      };
    }

    /**
     * LOAD CONTRACTS
     */

    const { data: contracts, error } = await supabase
      .from("contracts")
      .select("*");

    if (error) {
      throw error;
    }

    /**
     * SCORE DOCUMENTS
     */

    const scored = (contracts || []).map((contract) => {
      const text =
        `
        ${contract.summary || ""}
        ${JSON.stringify(contract.clauses || "")}
        ${JSON.stringify(contract.obligations || "")}
        `.toLowerCase();

      return {
        contract,
        score: simpleScore(text, query),
      };
    });

    /**
     * SORT RESULTS
     */

    const results = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => ({
        similarity_score: Number(r.score.toFixed(3)),
        contract: r.contract,
      }));

    return {
      success: true,
      query,
      total_results: results.length,
      results,
      mode: "fallback-text-search",
    };
  } catch (error) {
    console.error("semanticSearch fallback error:", error);

    return {
      success: false,
      error: error.message || "Semantic search failed",
    };
  }
}
