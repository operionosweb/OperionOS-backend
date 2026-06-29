// services/aiExtractionService.js

import crypto from "crypto";
import { analyzeWithProviders } from "./aiProviders.js";

/**
 * =========================================
 * OPERION OS
 * AI EXTRACTION SERVICE (UPGRADED)
 * =========================================
 *
 * Now supports:
 * - Contract Intelligence Core compatibility
 * - Aviation-aware risk tagging
 * - Action recommendation layer
 * - Deadline detection
 * - Structured risk categories
 * =========================================
 */

/**
 * MEMORY CACHE
 */
const extractionCache = new Map();

/**
 * HASH GENERATOR
 */
function generateHash(text = "") {
  return crypto
    .createHash("sha256")
    .update(text)
    .digest("hex");
}

/**
 * TEXT CHUNKING
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
 * SAFE NORMALIZATION (UPGRADED SCHEMA)
 */
function normalizeAIOutput(providerResult, chunksLength = 0) {
  const analysis = providerResult?.analysis || {};

  return {
    contract_type: analysis.contract_type || "General Contract",
    supplier_name: analysis.supplier_name || "Unknown Supplier",
    summary: analysis.summary || "Contract analyzed successfully.",

    risk_score:
      typeof analysis.risk_score === "number"
        ? analysis.risk_score
        : 0,

    contract_value:
      typeof analysis.contract_value === "number"
        ? analysis.contract_value
        : 0,

    chunks_processed: chunksLength,

    /**
     * CORE STRUCTURES
     */
    clauses: Array.isArray(analysis.clauses)
      ? analysis.clauses
      : [],

    obligations: Array.isArray(analysis.obligations)
      ? analysis.obligations
      : [],

    /**
     * NEW: DEADLINES (CRITICAL FOR OPERION)
     */
    deadlines: Array.isArray(analysis.deadlines)
      ? analysis.deadlines
      : [],

    /**
     * NEW: ACTIONABLE INSIGHTS (HARD RULE #6)
     */
    recommendations: Array.isArray(analysis.recommendations)
      ? analysis.recommendations
      : [],

    /**
     * NEW: STRUCTURED RISK BREAKDOWN
     */
    risk_breakdown: {
      financial_risk: analysis?.risk_breakdown?.financial_risk || 0,
      operational_risk: analysis?.risk_breakdown?.operational_risk || 0,
      legal_risk: analysis?.risk_breakdown?.legal_risk || 0,
      compliance_risk: analysis?.risk_breakdown?.compliance_risk || 0
    },

    /**
     * NEW: AVIATION CONTEXT (IMPORTANT FOR YOUR MARKET)
     */
    aviation_context: {
      fleet_dependency: analysis?.aviation_context?.fleet_dependency || false,
      supplier_dependency: analysis?.aviation_context?.supplier_dependency || false,
      mro_exposure: analysis?.aviation_context?.mro_exposure || false,
      airport_dependency: analysis?.aviation_context?.airport_dependency || false
    }
  };
}

/**
 * =========================================
 * MAIN ANALYSIS ENGINE
 * =========================================
 */
export async function analyzeContractText(rawText = "") {
  try {
    if (!rawText) {
      return {
        success: false,
        error: "No text provided"
      };
    }

    /**
     * HASH
     */
    const documentHash = generateHash(rawText);

    /**
     * CACHE HIT
     */
    if (extractionCache.has(documentHash)) {
      console.log("⚡ CACHE HIT:", documentHash);

      return {
        success: true,
        cached: true,
        cache_source: "memory_cache",
        document_hash: documentHash,
        analysis: extractionCache.get(documentHash)
      };
    }

    /**
     * CHUNKING
     */
    const chunks = chunkText(rawText);

    console.log(`📄 Document chunked into ${chunks.length} chunks`);

    /**
     * AI PIPELINE
     */
    const aiResult = await analyzeWithProviders(rawText);

    /**
     * NORMALIZATION
     */
    const normalized = normalizeAIOutput(aiResult, chunks.length);

    /**
     * CACHE STORE
     */
    extractionCache.set(documentHash, normalized);

    console.log("✅ CACHE STORED:", documentHash);

    /**
     * RESPONSE
     */
    return {
      success: true,
      cached: false,
      cache_source: null,
      document_hash: documentHash,
      analysis: normalized,
      provider_used: aiResult?.provider || "unknown"
    };
  } catch (error) {
    console.error("❌ analyzeContractText Error:", error);

    return {
      success: false,
      error: error.message || "Analysis failed"
    };
  }
}

/**
 * BACKWARD COMPATIBILITY
 */
export async function extractContractIntelligence(rawText = "") {
  return analyzeContractText(rawText);
}
