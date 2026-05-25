// services/aiExtractionService.js

import crypto from "crypto";
import { analyzeWithProviders } from "./aiProviders.js";

/**
 * -----------------------------------------
 * IN-MEMORY CACHE
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
 * SMART CHUNKING (unchanged but stable)
 * -----------------------------------------
 */

function chunkText(text = "", chunkSize = 4000) {
  if (!text) return [];

  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];

  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length > chunkSize) {
      if (currentChunk) chunks.push(currentChunk);
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
 * POST-PROCESS NORMALIZATION
 * -----------------------------------------
 * Ensures all providers return consistent structure
 * -----------------------------------------
 */

function normalizeAIOutput(providerResult, chunksLength) {
  const analysis = providerResult?.analysis || {};

  return {
    contract_type: analysis.contract_type || "General Contract",
    supplier_name: analysis.supplier_name || "Unknown Supplier",
    summary:
      analysis.summary ||
      "Contract analyzed using EU-first AI pipeline.",
    risk_score: analysis.risk_score || 0,
    contract_value: analysis.contract_value || 0,
    chunks_processed: chunksLength || 0,
    clauses: Array.isArray(analysis.clauses)
      ? analysis.clauses
      : [],
    obligations: Array.isArray(analysis.obligations)
      ? analysis.obligations
      : [],
  };
}

/**
 * -----------------------------------------
 * MAIN ANALYSIS ENGINE (EU-FIRST AI PIPELINE)
 * -----------------------------------------
 */

export async function analyzeContractText(rawText = "") {
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

    const documentHash = generateHash(rawText);

    /**
     * -----------------------------------------
     * CACHE HIT
     * -----------------------------------------
     */

    if (extractionCache.has(documentHash)) {
      console.log("⚡ CACHE HIT:", documentHash);

      return {
        success: true,
        cached: true,
        cache_source: "memory_cache",
        document_hash: documentHash,
        analysis: extractionCache.get(documentHash),
      };
    }

    /**
     * -----------------------------------------
     * CHUNKING
     * -----------------------------------------
     */

    const chunks = chunkText(rawText);

    console.log(`Document chunked into ${chunks.length} chunks`);

    /**
     * -----------------------------------------
     * AI PIPELINE (EU-FIRST)
     * -----------------------------------------
     * All intelligence now comes from aiProviders.js
     * -----------------------------------------
     */

    const aiResult = await analyzeWithProviders(rawText);

    /**
     * -----------------------------------------
     * FALLBACK SAFETY CHECK
     * -----------------------------------------
     */

    const normalized = normalizeAIOutput(aiResult, chunks.length);

    /**
     * -----------------------------------------
     * CACHE STORE
     * -----------------------------------------
     */

    extractionCache.set(documentHash, normalized);

    console.log("✅ CACHE STORED:", documentHash);

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
      provider_used: aiResult?.provider || "unknown",
    };
  } catch (error) {
    console.error("analyzeContractText Error:", error);

    return {
      success: false,
      error: error.message || "Analysis failed",
    };
  }
}

/**
 * -----------------------------------------
 * LEGACY EXPORT (BACKWARD COMPATIBLE)
 * -----------------------------------------
 */

export async function extractContractIntelligence(rawText = "") {
  return analyzeContractText(rawText);
}
