// services/chunkingService.js

/**
 * OPERION OS
 * Contract Chunking Engine
 *
 * Responsibilities:
 * - Split large contracts into AI-safe chunks
 * - Preserve clause structure
 * - Reduce token costs
 * - Enable scalable extraction
 */

const DEFAULT_CHUNK_SIZE = 4000;

export function chunkContractText(
  text = "",
  chunkSize = DEFAULT_CHUNK_SIZE
) {
  try {
    if (!text) {
      return [];
    }

    /**
     * Normalize spacing
     */
    const normalized = text
      .replace(/\r/g, "")
      .replace(/\t/g, " ")
      .replace(/\n{3,}/g, "\n\n");

    /**
     * Split by paragraphs first
     */
    const paragraphs =
      normalized.split("\n\n");

    const chunks = [];

    let currentChunk = "";

    for (const paragraph of paragraphs) {
      /**
       * If adding paragraph exceeds chunk size,
       * finalize current chunk
       */
      if (
        currentChunk.length +
          paragraph.length >
        chunkSize
      ) {
        chunks.push(
          currentChunk.trim()
        );

        currentChunk = "";
      }

      currentChunk +=
        paragraph + "\n\n";
    }

    /**
     * Push final chunk
     */
    if (currentChunk.trim()) {
      chunks.push(
        currentChunk.trim()
      );
    }

    return chunks;
  } catch (error) {
    console.error(
      "chunkContractText() Error:",
      error
    );

    return [];
  }
}
