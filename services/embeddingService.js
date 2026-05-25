// services/embeddingService.js

import OpenAI from "openai";

/**
 * -----------------------------------------
 * PROVIDER CONFIG (EU-FIRST READY)
 * -----------------------------------------
 */

/**
 * Future EU providers can be added here:
 * - Mistral (France)
 * - Aleph Alpha (Germany)
 * - HuggingFace Inference (EU region)
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * -----------------------------------------
 * EU-FIRST EMBEDDING ROUTER
 * -----------------------------------------
 */

async function generateOpenAIEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response?.data?.[0]?.embedding || null;
}

/**
 * -----------------------------------------
 * MAIN EXPORT (SMART ROUTER)
 * -----------------------------------------
 */

export async function generateEmbedding(text = "") {
  try {
    if (!text) return null;

    /**
     * -----------------------------------------
     * STEP 1: EU PROVIDERS (PLACEHOLDER HOOK)
     * -----------------------------------------
     *
     * In production you can plug:
     * - Mistral embeddings (via API)
     * - Aleph Alpha embeddings
     * - Local models (bge-large, etc.)
     */

    const EU_PROVIDER_ENABLED = false;

    if (EU_PROVIDER_ENABLED) {
      // Future EU embedding logic goes here
      // return await generateEUEembedding(text);
    }

    /**
     * -----------------------------------------
     * STEP 2: FALLBACK (OPENAI - US)
     * -----------------------------------------
     */
    return await generateOpenAIEmbedding(text);
  } catch (error) {
    console.error("Embedding Error:", error);
    return null;
  }
}
