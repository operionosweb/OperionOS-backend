import OpenAI from "openai";
import supabase from "../config/supabase.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateEmbedding(text = "") {
  try {
    console.log("====================================");
    console.log("🔴 OPENAI DEBUG START");
    console.log("API KEY EXISTS:", !!process.env.OPENAI_API_KEY);

    if (process.env.OPENAI_API_KEY) {
      console.log(
        "KEY PREFIX:",
        process.env.OPENAI_API_KEY.substring(0, 8)
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        error: "OPENAI_API_KEY missing in Render environment",
      };
    }

    if (!text) {
      return {
        success: false,
        error: "Empty input text",
      };
    }

    console.log("TEXT LENGTH:", text.length);

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    });

    console.log("RAW OPENAI RESPONSE:", response);

    const embedding = response?.data?.[0]?.embedding;

    if (!embedding) {
      console.error("❌ NO EMBEDDING IN RESPONSE");
      console.error(response);

      return {
        success: false,
        error: "No embedding returned",
      };
    }

    console.log("✅ EMBEDDING SUCCESS");
    console.log("====================================");

    return {
      success: true,
      embedding,
    };
  } catch (error) {
    console.log("====================================");
    console.error("🚨 OPENAI FAILED FULL ERROR:");
    console.error("MESSAGE:", error.message);
    console.error("STATUS:", error.status);
    console.error("CODE:", error.code);
    console.error("TYPE:", error.type);
    console.error("FULL ERROR:", error);

    return {
      success: false,
      error: error.message,
    };
  }
}

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
