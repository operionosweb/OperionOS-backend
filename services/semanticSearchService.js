import supabase from "../config/supabase.js";

/* ===============================
   COSINE SIMILARITY
=============================== */

function cosineSimilarity(a = [], b = []) {
  if (!a.length || !b.length) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += (a[i] || 0) * (b[i] || 0);
    magA += (a[i] || 0) * (a[i] || 0);
    magB += (b[i] || 0) * (b[i] || 0);
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) return 0;

  return dot / (magA * magB);
}

/* ===============================
   LOCAL EMBEDDING (must match vectorMemoryService.js)
=============================== */

function createEmbedding(text = "") {
  if (!text) return [];

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const vector = new Array(128).fill(0);

  for (let word of words) {
    let hash = 0;

    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }

    const index = Math.abs(hash) % 128;
    vector[index] += 1;
  }

  const magnitude = Math.sqrt(
    vector.reduce((s, v) => s + v * v, 0)
  );

  return vector.map((v) =>
    magnitude === 0 ? 0 : v / magnitude
  );
}

/* ===============================
   SEMANTIC SEARCH (REAL VERSION)
=============================== */

export async function semanticSearch(query = "", limit = 5) {
  try {
    if (!query || typeof query !== "string") {
      return {
        success: false,
        error: "Query is required",
      };
    }

    const queryVector = createEmbedding(query);

    const { data: embeddings, error } = await supabase
      .from("contract_embeddings")
      .select(`
        embedding,
        metadata
      `);

    if (error) throw error;

    const scored = (embeddings || []).map((item) => {
      const score = cosineSimilarity(
        queryVector,
        item.embedding || []
      );

      return {
        score,
        contract: item.metadata || {},
      };
    });

    const results = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => ({
        similarity_score: Number(r.score.toFixed(4)),
        contract: r.contract,
      }));

    return {
      success: true,
      query,
      total_results: results.length,
      results,
      mode: "cosine-vector-search",
    };
  } catch (error) {
    console.error("semanticSearch error:", error);

    return {
      success: false,
      error: error.message || "Semantic search failed",
    };
  }
}
