// services/chunkVectorService.js

import crypto from "crypto";

import supabase from "../config/supabase.js";

import {
  generateEmbedding,
} from "./embeddingService.js";

/**
 * -----------------------------------------
 * CHUNK CONTRACT TEXT
 * -----------------------------------------
 */

function chunkText(
  text = "",
  chunkSize = 2000
) {
  const chunks = [];

  for (
    let i = 0;
    i < text.length;
    i += chunkSize
  ) {
    chunks.push(
      text.slice(i, i + chunkSize)
    );
  }

  return chunks;
}

/**
 * -----------------------------------------
 * HASH
 * -----------------------------------------
 */

function generateHash(
  text = ""
) {
  return crypto
    .createHash("sha256")
    .update(text)
    .digest("hex");
}

/**
 * -----------------------------------------
 * STORE CONTRACT CHUNKS
 * -----------------------------------------
 */

export async function storeContractChunks(
  contractId,
  text = ""
) {
  try {
    const chunks =
      chunkText(text);

    const insertedChunks = [];

    for (
      let index = 0;
      index < chunks.length;
      index++
    ) {
      const chunk =
        chunks[index];

      const chunkHash =
        generateHash(chunk);

      /**
       * -----------------------------------------
       * DUPLICATE CHUNK CHECK
       * -----------------------------------------
       */

      const {
        data: existing,
      } = await supabase
        .from("contract_chunks")
        .select("id")
        .eq(
          "chunk_hash",
          chunkHash
        )
        .maybeSingle();

      if (existing) {
        continue;
      }

      /**
       * -----------------------------------------
       * EMBEDDING
       * -----------------------------------------
       */

      const embedding =
        await generateEmbedding(
          chunk
        );

      /**
       * -----------------------------------------
       * INSERT
       * -----------------------------------------
       */

      const {
        data,
        error,
      } = await supabase
        .from("contract_chunks")
        .insert({
          contract_id:
            contractId,

          chunk_index:
            index,

          chunk_text:
            chunk,

          chunk_hash:
            chunkHash,

          embedding,
        })
        .select()
        .single();

      if (error) {
        console.error(error);
        continue;
      }

      insertedChunks.push(data);
    }

    return {
      success: true,
      chunks_inserted:
        insertedChunks.length,
    };
  } catch (error) {
    console.error(
      "storeContractChunks Error:",
      error
    );

    return {
      success: false,
      error: error.message,
    };
  }
}
