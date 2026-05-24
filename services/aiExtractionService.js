// services/aiExtractionService.js

import crypto from "crypto";

/**
 * -----------------------------------------
 * SIMPLE IN-MEMORY CACHE
 * -----------------------------------------
 */

const extractionCache = new Map();

/**
 * -----------------------------------------
 * HASH GENERATOR
 * -----------------------------------------
 */

function generateHash(text = "") {
  return crypto
    .createHash("sha256")
    .update(text)
    .digest("hex");
}

/**
 * -----------------------------------------
 * CHUNK TEXT
 * -----------------------------------------
 */

function chunkText(
  text = "",
  chunkSize = 4000
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
 * MAIN EXTRACTION
 * -----------------------------------------
 */

export async function analyzeContractText(
  rawText = ""
) {
  try {
    if (!rawText) {
      return {
        success: false,
        error: "No text provided",
      };
    }

    /**
     * Generate document hash
     */
    const documentHash =
      generateHash(rawText);

    /**
     * -----------------------------------------
     * CACHE HIT
     * -----------------------------------------
     */

    if (
      extractionCache.has(
        documentHash
      )
    ) {
      console.log(
        "CACHE HIT:",
        documentHash
      );

      return {
        success: true,

        cached: true,

        cache_source:
          "memory_cache",

        document_hash:
          documentHash,

        analysis:
          extractionCache.get(
            documentHash
          ),
      };
    }

    /**
     * -----------------------------------------
     * CHUNKING
     * -----------------------------------------
     */

    const chunks =
      chunkText(rawText);

    console.log(
      `Document split into ${chunks.length} chunks`
    );

    /**
     * -----------------------------------------
     * TEMP MOCK ANALYSIS
     * Replace with GPT later
     * -----------------------------------------
     */

    const analysis = {
      contract_type:
        "Aircraft Lease Agreement",

      supplier_name:
        "Unknown Supplier",

      summary:
        "Contract successfully analyzed using chunk pipeline.",

      risk_score: 42,

      contract_value: 0,

      chunks_processed:
        chunks.length,

      clauses: [],

      obligations: [],
    };

    /**
     * -----------------------------------------
     * STORE CACHE
     * -----------------------------------------
     */

    extractionCache.set(
      documentHash,
      analysis
    );

    console.log(
      "CACHE STORED:",
      documentHash
    );

    return {
      success: true,

      cached: false,

      cache_source: null,

      document_hash:
        documentHash,

      analysis,
    };
  } catch (error) {
    console.error(
      "analyzeContractText Error:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Analysis failed",
    };
  }
}

/**
 * -----------------------------------------
 * LEGACY EXPORT
 * -----------------------------------------
 */

export async function extractContractIntelligence(
  rawText = ""
) {
  return analyzeContractText(
    rawText
  );
}
