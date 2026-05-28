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
 * DEBUG HELPERS
 * =========================================
 */

function debugEnv() {
  console.log("🔐 OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);

  if (process.env.OPENAI_API_KEY) {
    console.log(
      "🔐 OPENAI_API_KEY prefix:",
      process.env.OPENAI_API_KEY.slice(0, 7)
    );
  } else {
    console.error("❌ OPENAI_API_KEY IS MISSING IN RENDER ENV");
  }
}

/**
 * =========================================
 * GENERATE EMBEDDING (FIXED + DEBUG)
 * =========================================
 */

export async function generateEmbedding(text = "") {
  try {
    debugEnv();

    if (!text || typeof text !== "string") {
      return {
        success: false,
        error: "Invalid text for embedding",
      };
    }

    console.log("🧠 Generating embedding for text length:", text.length);

    /**
     * CALL OPENAI
     */

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 12000),
    });

    if (!response?.data?.[0]?.embedding) {
      console.error("❌ OpenAI returned empty embedding response");
      return {
        success: false,
        error: "Empty embedding response from OpenAI",
      };
    }

    console.log("✅ Embedding generated successfully");

    return {
      success: true,
      embedding: response.data[0].embedding,
    };
  } catch (error) {
    console.error("❌ generateEmbedding FULL ERROR:");
    console.error(error);

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
