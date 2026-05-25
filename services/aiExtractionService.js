// services/aiExtractionService.js

import crypto from "crypto";
import { analyzeWithProviders } from "./aiProviders.js";

/**
 * =========================================
 * OPERION OS
 * AI EXTRACTION SERVICE
 * =========================================
 */

/**
 * -----------------------------------------
 * SIMPLE MEMORY CACHE
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
 * TEXT CHUNKING
 * -----------------------------------------
 */

function chunkText(text = "", chunkSize = 4000) {
  if (!text) return [];

  const paragraphs = text.split(/\n\s*\n/);

  const chunks = [];

  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (
      (currentChunk + paragraph).length >
      chunkSize
    ) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }

      currentChunk = paragraph;
    } else {
      currentChunk += "\n\n" + paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * -----------------------------------------
 * SAFE NORMALIZATION
 * -----------------------------------------
 */

function normalizeAIOutput(
  providerResult,
  chunksLength = 0
) {
  const analysis =
    providerResult?.analysis || {};

  return {
    contract_type:
      analysis.contract_type ||
      "General Contract",

    supplier_name:
      analysis.supplier_name ||
      "Unknown Supplier",

    summary:
      analysis.summary ||
      "Contract analyzed successfully.",

    risk_score:
      typeof analysis.risk_score === "number"
        ? analysis.risk_score
        : 0,

    contract_value:
      typeof analysis.contract_value ===
      "number"
        ? analysis.contract_value
        : 0,

    chunks_processed: chunksLength,

    clauses: Array.isArray(analysis.clauses)
      ? analysis.clauses
      : [],

    obligations: Array.isArray(
      analysis.obligations
    )
      ? analysis.obligations
      : [],
  };
}

/**
 * =========================================
 * MAIN ANALYSIS ENGINE
 * =========================================
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
     * -----------------------------------------
     * HASH
     * -----------------------------------------
     */

    const documentHash =
      generateHash(rawText);

    /**
     * -----------------------------------------
     * CACHE HIT
     * -----------------------------------------
     */

    if (
      extractionCache.has(documentHash)
    ) {
      console.log(
        "⚡ CACHE HIT:",
        documentHash
      );

      return {
        success: true,
        cached: true,
        cache_source: "memory_cache",
        document_hash: documentHash,
        analysis:
          extractionCache.get(documentHash),
      };
    }

    /**
     * -----------------------------------------
     * CHUNKING
     * -----------------------------------------
     */

    const chunks = chunkText(rawText);

    console.log(
      `📄 Document chunked into ${chunks.length} chunks`
    );

    /**
     * -----------------------------------------
     * AI PROVIDER PIPELINE
     * -----------------------------------------
     */

    const aiResult =
      await analyzeWithProviders(rawText);

    /**
     * -----------------------------------------
     * NORMALIZATION
     * -----------------------------------------
     */

    const normalized =
      normalizeAIOutput(
        aiResult,
        chunks.length
      );

    /**
     * -----------------------------------------
     * CACHE STORE
     * -----------------------------------------
     */

    extractionCache.set(
      documentHash,
      normalized
    );

    console.log(
      "✅ CACHE STORED:",
      documentHash
    );

    /**
     * -----------------------------------------
     * RESPONSE
     * -----------------------------------------
     */

    return {
      success: true,
      cached: false,
      cache_source: null,
      document_hash: documentHash,
      analysis: normalized,
      provider_used:
        aiResult?.provider || "unknown",
    };
  } catch (error) {
    console.error(
      "❌ analyzeContractText Error:",
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
 * =========================================
 * BACKWARD COMPATIBILITY EXPORT
 * =========================================
 */

export async function extractContractIntelligence(
  rawText = ""
) {
  return analyzeContractText(rawText);
}
