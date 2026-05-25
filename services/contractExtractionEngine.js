// services/contractExtractionEngine.js

import crypto from "crypto";
import { analyzeWithProviders } from "./aiProviders.js";

/**
 * =========================================
 * OPERION OS - CONTRACT EXTRACTION ENGINE
 * SINGLE SOURCE OF TRUTH (AI ROUTING ENTRY)
 * =========================================
 */

/**
 * -----------------------------------------
 * HASH (DEDUP + AUDIT)
 * -----------------------------------------
 */

function generateHash(text = "") {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * -----------------------------------------
 * SAFE NORMALIZER
 * -----------------------------------------
 */

function normalize(aiResult = {}, chunks = 0) {
  const a = aiResult?.analysis || {};

  return {
    contract_type: a.contract_type || "General Contract",
    supplier_name: a.supplier_name || "Unknown",
    summary: a.summary || "AI analysis completed.",
    risk_score: a.risk_score || 0,
    contract_value: a.contract_value || 0,
    clauses: Array.isArray(a.clauses) ? a.clauses : [],
    obligations: Array.isArray(a.obligations) ? a.obligations : [],
    chunks_processed: chunks
  };
}

/**
 * -----------------------------------------
 * SMART CHUNKING
 * -----------------------------------------
 */

function chunkText(text = "", size = 4000) {
  if (!text) return [];

  const parts = text.split(/\n\s*\n/);
  const chunks = [];

  let current = "";

  for (const p of parts) {
    if ((current + p).length > size) {
      if (current) chunks.push(current);
      current = p;
    } else {
      current += "\n\n" + p;
    }
  }

  if (current) chunks.push(current);

  return chunks;
}

/**
 * -----------------------------------------
 * MAIN EXTRACTION FUNCTION
 * -----------------------------------------
 */

export async function extractStructuredContractData(text = "") {
  try {
    if (!text || typeof text !== "string") {
      return {
        success: false,
        error: "Invalid input text"
      };
    }

    const hash = generateHash(text);
    const chunks = chunkText(text);

    const ai = await analyzeWithProviders(text);

    return {
      success: true,
      document_hash: hash,
      chunks: chunks.length,
      analysis: normalize(ai, chunks.length),
      provider_used: ai?.provider || "unknown"
    };
  } catch (err) {
    console.error("contractExtractionEngine error:", err);

    return {
      success: false,
      error: err.message || "Extraction failed"
    };
  }
}

/**
 * -----------------------------------------
 * BACKWARD COMPATIBILITY EXPORT
 * -----------------------------------------
 */

export async function analyzeContractText(text) {
  return extractStructuredContractData(text);
}
