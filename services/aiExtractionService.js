// services/aiExtractionService.js

import crypto from "crypto";

/**
 * =====================================================
 * OPERION AI INTELLIGENCE LAYER (EU-FIRST ARCHITECTURE)
 * =====================================================
 *
 * Priority:
 * 1. Mistral (EU - France)
 * 2. Aleph Alpha (EU - Germany)
 * 3. OpenAI (fallback)
 * 4. Offline heuristic engine (always available)
 */

/**
 * -----------------------------------------
 * MEMORY CACHE
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
 * EU-FIRST AI ROUTER
 * -----------------------------------------
 */
async function euAiAnalyze(text = "") {
  /**
   * NOTE:
   * This is a pluggable architecture layer.
   * You can later connect real APIs without changing core logic.
   */

  const providers = [
    tryMistralAI,
    tryAlephAlpha,
    tryOpenAI,
  ];

  for (const provider of providers) {
    try {
      const result = await provider(text);
      if (result) return result;
    } catch (err) {
      console.warn("Provider failed:", provider.name);
    }
  }

  return null;
}

/**
 * -----------------------------------------
 * MISTRAL AI (EU - FRANCE) PLACEHOLDER
 * -----------------------------------------
 */
async function tryMistralAI(text) {
  if (!process.env.MISTRAL_API_KEY) return null;

  // Placeholder structure (safe stub)
  // You can wire real API later without changing architecture
  return null;
}

/**
 * -----------------------------------------
 * ALEPH ALPHA (EU - GERMANY) PLACEHOLDER
 * -----------------------------------------
 */
async function tryAlephAlpha(text) {
  if (!process.env.ALEPH_ALPHA_API_KEY) return null;
  return null;
}

/**
 * -----------------------------------------
 * OPENAI FALLBACK
 * -----------------------------------------
 */
async function tryOpenAI(text) {
  if (!process.env.OPENAI_API_KEY) return null;
  return null;
}

/**
 * -----------------------------------------
 * SMART CHUNKING
 * -----------------------------------------
 */
function chunkText(text = "", chunkSize = 4000) {
  if (!text) return [];

  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length > chunkSize) {
      chunks.push(currentChunk);
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
 * RULE-BASED CONTRACT TYPE DETECTION
 * -----------------------------------------
 */
function detectContractType(text = "") {
  const lower = text.toLowerCase();

  if (lower.includes("aircraft lease")) return "Aircraft Lease Agreement";
  if (lower.includes("maintenance agreement")) return "Maintenance Agreement";
  if (lower.includes("service level agreement")) return "Service Level Agreement";
  if (lower.includes("procurement")) return "Procurement Contract";

  return "General Contract";
}

/**
 * -----------------------------------------
 * RISK SCORING ENGINE
 * -----------------------------------------
 */
function calculateRiskScore(text = "") {
  const lower = text.toLowerCase();

  let score = 15;

  const riskKeywords = [
    "unlimited liability",
    "without limitation",
    "penalty",
    "termination",
    "indemnify",
    "exclusive",
    "non-cancellable",
    "liquidated damages",
    "breach",
    "default",
  ];

  for (const keyword of riskKeywords) {
    if (lower.includes(keyword)) {
      score += 7;
    }
  }

  return Math.min(100, score);
}

/**
 * -----------------------------------------
 * CLAUSE EXTRACTION
 * -----------------------------------------
 */
function extractClauses(chunks = []) {
  const clauses = [];

  const patterns = [
    { type: "Insurance", regex: /insurance/gi },
    { type: "Termination", regex: /termination/gi },
    { type: "Indemnity", regex: /indemnity/gi },
    { type: "Confidentiality", regex: /confidentiality/gi },
    { type: "Compliance", regex: /compliance/gi },
  ];

  for (const chunk of chunks) {
    for (const p of patterns) {
      if (p.regex.test(chunk)) {
        clauses.push({
          clause_type: p.type,
          risk_level: "Medium",
          clause_text: chunk.substring(0, 500),
        });
      }
    }
  }

  return clauses.slice(0, 25);
}

/**
 * -----------------------------------------
 * OBLIGATION EXTRACTION
 * -----------------------------------------
 */
function extractObligations(chunks = []) {
  const obligations = [];

  const keywords = ["shall", "must", "required to", "obligation", "responsible for"];

  for (const chunk of chunks) {
    const lower = chunk.toLowerCase();

    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        obligations.push({
          obligation: chunk.substring(0, 250),
          severity: "Medium",
        });
        break;
      }
    }
  }

  return obligations.slice(0, 25);
}

/**
 * -----------------------------------------
 * OFFLINE ANALYSIS ENGINE (FALLBACK CORE)
 * -----------------------------------------
 */
function offlineAnalyze(rawText, chunks) {
  return {
    contract_type: detectContractType(rawText),
    supplier_name: "Unknown Supplier",
    summary: "Contract analyzed using EU-first offline intelligence layer.",
    risk_score: calculateRiskScore(rawText),
    contract_value: 0,
    chunks_processed: chunks.length,
    clauses: extractClauses(chunks),
    obligations: extractObligations(chunks),
  };
}

/**
 * -----------------------------------------
 * MAIN ANALYSIS ENGINE
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

    const documentHash = generateHash(rawText);

    /**
     * -----------------------------------------
     * CACHE HIT
     * -----------------------------------------
     */
    if (extractionCache.has(documentHash)) {
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

    /**
     * -----------------------------------------
     * EU-FIRST AI ATTEMPT (optional future plug-in)
     * -----------------------------------------
     */
    const aiResult = await euAiAnalyze(rawText);

    const analysis = aiResult || offlineAnalyze(rawText, chunks);

    /**
     * -----------------------------------------
     * CACHE STORE
     * -----------------------------------------
     */
    extractionCache.set(documentHash, analysis);

    return {
      success: true,
      cached: false,
      cache_source: null,
      document_hash: documentHash,
      analysis,
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
 * LEGACY EXPORT (BACKWARD COMPATIBILITY)
 * -----------------------------------------
 */
export async function extractContractIntelligence(rawText = "") {
  return analyzeContractText(rawText);
}
