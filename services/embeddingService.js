// services/embeddingService.js

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * -----------------------------------------
 * GENERATE EMBEDDING
 * -----------------------------------------
 */

export async function generateEmbedding(
  text = ""
) {
  try {
    if (!text) {
      return null;
    }

    const response =
      await openai.embeddings.create({
        model:
          "text-embedding-3-small",

        input: text,
      });

    return (
      response?.data?.[0]
        ?.embedding || null
    );
  } catch (error) {
    console.error(
      "Embedding Error:",
      error
    );

    return null;
  }
}
