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
    if (!text || typeof text !== "string") {
      return {
        success: false,
        error: "Invalid text for embedding",
      };
    }

    console.log("🧠 Generating embedding...");
    console.log("🔑 API Key exists:", !!process.env.OPENAI_API_KEY);

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    });

    if (!response?.data?.[0]?.embedding) {
      console.error("❌ No embedding returned:", response);
      return {
        success: false,
        error: "No embedding returned from OpenAI",
        debug: response,
      };
    }

    return {
      success: true,
      embedding: response.data[0].embedding,
    };
  } catch (error) {
    console.error("❌ generateEmbedding FULL ERROR:");
    console.error("Message:", error.message);
    console.error("Status:", error.status);
    console.error("Code:", error.code);
    console.error("Response:", error.response?.data);

    return {
      success: false,
      error: error.message || "Embedding failed",
      debug: {
        status: error.status,
        code: error.code,
        response: error.response?.data,
      },
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
