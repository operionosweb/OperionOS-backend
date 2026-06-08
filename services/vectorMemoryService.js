import supabase from "../config/supabase.js";

/* ===============================
   LIGHTWEIGHT EMBEDDING (NO OPENAI)
=============================== */

function createEmbedding(text = "") {
  if (!text) return [];

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const vector = new Array(128).fill(0);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = (hash << 5) - hash + word.charCodeAt(j);
      hash |= 0;
    }

    const index = Math.abs(hash) % 128;
    vector[index] += 1;
  }

  // normalize vector
  const magnitude = Math.sqrt(
    vector.reduce((sum, v) => sum + v * v, 0)
  );

  return vector.map((v) =>
    magnitude === 0 ? 0 : v / magnitude
  );
}

/* ===============================
   GENERATE EMBEDDING (DROP-IN REPLACEMENT)
=============================== */

export async function generateEmbedding(text = "") {
  try {
    if (!text) {
      return {
        success: false,
        error: "Empty input text",
      };
    }

    const embedding = createEmbedding(text.slice(0, 8000));

    return {
      success: true,
      embedding,
      model: "local-hash-embedding",
    };
  } catch (error) {
    console.error("Embedding error:", error);

    return {
      success: false,
      error: error.message || "Embedding failed",
    };
  }
}

/* ===============================
   STORE EMBEDDING
=============================== */

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

    if (error) throw error;

    return {
      success: true,
      embedding_record: data,
    };
  } catch (error) {
    console.error("storeEmbedding error:", error);

    return {
      success: false,
      error: error.message,
    };
  }
}
