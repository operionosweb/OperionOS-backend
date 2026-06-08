import supabase from "../config/supabase.js";

/* =========================================
   COSINE SIMILARITY
========================================= */

function cosineSimilarity(a = [], b = []) {
  if (!a.length || !b.length) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) return 0;

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/* =========================================
   GET QUERY EMBEDDING
========================================= */

async function getQueryEmbedding(query) {
  try {
    const res = await fetch(
      `${process.env.BASE_URL || ""}/api/internal/embedding`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.INTERNAL_API_KEY || "",
        },
        body: JSON.stringify({ text: query }),
      }
    );

    const data = await res.json();

    if (!data?.embedding) return null;

    return data.embedding;
  } catch (err) {
    console.error("Query embedding error:", err.message);
    return null;
  }
}

/* =========================================
   MAIN SEMANTIC SEARCH
========================================= */

export async function semanticSearch(query = "", limit = 5) {
  try {
    if (!query) {
      return {
        success: false,
        error: "Query is required",
      };
    }

    console.log("====================================");
    console.log("🔵 SEMANTIC SEARCH START");
    console.log("QUERY:", query);

    /**
     * 1. GET QUERY EMBEDDING
     */

    const queryEmbedding = await getQueryEmbedding(query);

    /**
     * 2. LOAD ALL EMBEDDINGS
     */

    const { data: rows, error } = await supabase
      .from("contract_embeddings")
      .select(`
        embedding,
        contract_id,
        contracts (
          id,
          filename,
          contract_type,
          supplier_name,
          summary,
          risk_score,
          clauses,
          obligations,
          document_hash
        )
      `);

    if (error) throw error;

    if (!rows || rows.length === 0) {
      return {
        success: true,
        query,
        total_results: 0,
        results: [],
      };
    }

    /**
     * 3. SCORE RESULTS
     */

    const scored = rows.map((row) => {
      const score = queryEmbedding
        ? cosineSimilarity(queryEmbedding, row.embedding)
        : 0;

      return {
        score,
        contract: row.contracts,
      };
    });

    /**
     * 4. SORT RESULTS
     */

    const results = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => ({
        similarity_score: Number(r.score.toFixed(3)),
        contract: r.contract,
      }));

    console.log("✅ SEARCH COMPLETE");
    console.log("====================================");

    return {
      success: true,
      query,
      total_results: results.length,
      results,
      mode: "true-semantic-vector-search",
    };
  } catch (error) {
    console.error("🚨 semanticSearch error:", error);

    return {
      success: false,
      error: error.message || "Search failed",
    };
  }
}
