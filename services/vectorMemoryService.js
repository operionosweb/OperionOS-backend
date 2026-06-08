import axios from "axios";
import supabase from "../config/supabase.js";

/* =========================================
   EMBEDDING PROVIDER (EU-FRIENDLY + FREE)
========================================= */

async function generateHuggingFaceEmbedding(text = "") {
  try {
    if (!text || typeof text !== "string") {
      return null;
    }

    const response = await axios.post(
      "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
      {
        inputs: text.slice(0, 2000),
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY || ""}`,
          "Content-Type": "application/json",
        },
      }
    );

    const embedding = response?.data;

    if (!embedding || !Array.isArray(embedding)) {
      console.error("❌ HF embedding invalid response");
      return null;
    }

    return embedding;
  } catch (err) {
    console.error("HuggingFace embedding error:", err?.response?.data || err.message);
    return null;
  }
}

/* =========================================
   FALLBACK EMBEDDING (ZERO DEPENDENCY)
========================================= */

function fallbackEmbedding(text = "") {
  const vec = new Array(384).fill(0);

  if (!text) return vec;

  const words = text.toLowerCase().split(/\s+/);

  for (let i = 0; i < words.length; i++) {
    const index = (words[i].charCodeAt(0) * (i + 1)) % 384;
    vec[index] += 1;
  }

  return vec;
}

/* =========================================
   MAIN EMBEDDING FUNCTION
========================================= */

export async function generateEmbedding(text = "") {
  try {
    console.log("====================================");
    console.log("🔵 EMBEDDING GENERATION START");
    console.log("TEXT LENGTH:", text?.length || 0);

    // 1. HuggingFace (FREE + EU FRIENDLY)
    const hfEmbedding = await generateHuggingFaceEmbedding(text);

    if (hfEmbedding) {
      console.log("✅ HuggingFace embedding success");
      console.log("====================================");

      return {
        success: true,
        embedding: hfEmbedding,
        provider: "huggingface",
      };
    }

    // 2. Fallback (ALWAYS WORKS)
    console.log("⚠️ Using fallback embedding");

    const fallback = fallbackEmbedding(text);

    return {
      success: true,
      embedding: fallback,
      provider: "fallback",
    };
  } catch (error) {
    console.error("🚨 Embedding system failed:", error.message);

    return {
      success: true,
      embedding: fallbackEmbedding(text),
      provider: "fallback-error",
    };
  }
}

/* =========================================
   STORE EMBEDDING (UNCHANGED - SUPABASE)
========================================= */

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
