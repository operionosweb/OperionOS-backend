// services/aiExtractionService.js

import crypto from "crypto";
import { analyzeWithProviders } from "./aiProviders.js";

/**
 * =========================================
 * EU-FIRST CONTRACT INTELLIGENCE ENGINE
 * PRODUCTION HARDENED
 * =========================================
 */

/**
 * -----------------------------------------
 * IN-MEMORY CACHE (SAFE FOR SINGLE INSTANCE)
 * -----------------------------------------
 */

const extractionCache = new Map();

/**
 * -----------------------------------------
 * HASH GENERATOR
 * -----------------------------------------
 */

function generateHash(text = "") {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * -----------------------------------------
 * SMART CHUNKING (STABLE + SAFE)
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

  if (currentChunk) chunks.push(currentChunk);

  return chunks;
}

/**
 * -----------------------------------------
 * SAFE AI NORMALIZER (CRITICAL PRODUCTION LAYER)
 * Prevents crashes from malformed provider output
 * -----------------------------------------
 */

function normalizeAIOutput(providerResult, chunksLength = 0) {
  const analysis = providerResult?.analysis || {};

  return {
    contract_type: typeof analysis.contract_type === "string"
      ? analysis.contract_type
      : "General Contract",

    supplier_name: typeof analysis.supplier_name === "string"
      ? analysis.supplier_name
      : "Unknown Supplier",

    summary: typeof analysis.summary === "string"
      ? analysis.summary
      : "Contract analyzed using EU-first AI pipeline.",

    risk_score:
      typeof analysis.risk_score === "number"
        ? Math.min(100, Math.max(0, analysis.risk_score))
        : 0,

    contract_value:
      typeof analysis.contract_value === "number"
        ? analysis.contract_value
        : 0,

    chunks_processed: chunksLength,

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
 * PROVIDER FAILURE GUARD
 * Ensures system NEVER crashes if AI fails
 * -----------------------------------------
 */

function safeProviderResult(result) {
  if (!result || typeof result !== "object") {
    return {
      provider: "fallback_safe_mode",
      analysis: {
        contract_type: "General Contract",
        supplier_name: "Unknown Supplier",
        summary: "AI provider failed safely - fallback activated.",
        risk_score: 0,
        contract_value: 0,
        clauses: [],
        obligations: [],
      },
    };
  }

  return result;
}

/**
 * -----------------------------------------
 * MAIN ANALYSIS ENGINE (EU-FIRST PIPELINE)
 * -----------------------------------------
 */

export async function analyzeContractText(rawText = "") {
  try {
    if (!rawText || typeof rawText !== "string") {
      return {
        success: false,
        error: "No valid text provided",
      };
    }

    /**
     * -----------------------------------------
     * HASH (DEDUPLICATION CORE)
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

    console.log(`📄 Document chunked into ${chunks.length} chunks`);

    /**
     * -----------------------------------------
     * EU-FIRST AI PIPELINE
     * -----------------------------------------
     * Mistral → Aleph Alpha → OpenAI → fallback
     * (handled inside aiProviders.js)
     * -----------------------------------------
     */

    let aiResult;

    try {
      aiResult = await analyzeWithProviders(rawText);
    } catch (err) {
      console.error("❌ AI pipeline failure:", err);

      aiResult = {
        provider: "hard_fallback",
        analysis: {
          contract_type: "General Contract",
          supplier_name: "Unknown Supplier",
          summary: "AI pipeline failed safely. Fallback analysis used.",
          risk_score: 0,
          contract_value: 0,
          clauses: [],
          obligations: [],
        },
      };
    }

    /**
     * -----------------------------------------
     * SAFETY WRAP
     * -----------------------------------------
     */

    const safeResult = safeProviderResult(aiResult);

    /**
     * -----------------------------------------
     * NORMALIZATION LAYER
     * -----------------------------------------
     */

    const normalized = normalizeAIOutput(safeResult, chunks.length);

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
      provider_used: safeResult?.provider || "unknown",
      eu_pipeline: "mistral→aleph_alpha→openai→fallback",
    };
  } catch (error) {
    console.error("❌ analyzeContractText fatal error:", error);

    return {
      success: false,
      error: error.message || "Analysis failed",
      provider_used: "system_error",
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
