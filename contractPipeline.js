// contractPipeline.js

import { extractClauses } from "./services/clauseExtractionService.js";
import { extractObligations } from "./services/obligationExtractor.js";

/**
 * Normalize contract text into a deterministic format.
 * This is the #1 fix for inconsistent clause detection.
 */
function normalizeText(text = "") {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/•/g, "*")
    .trim();
}

/**
 * Stable clause segmentation:
 * We force structure BEFORE AI/heuristics run.
 */
function segmentClauses(text) {
  const normalized = normalizeText(text);

  // Split on strong structural markers FIRST (most reliable)
  const structuredSplit = normalized.split(
    /(?=\n\s*[A-H]\.\s|\n\s*\(\d+\)\s|\n\s*\*\s)/g
  );

  // Clean segments
  const cleaned = structuredSplit
    .map(s => s.trim())
    .filter(Boolean);

  // Deduplicate (important for OCR / PDF duplication issues)
  const unique = Array.from(new Set(cleaned));

  return unique;
}

/**
 * Deterministic hash-like key for stability tracking
 */
function generateStableKey(contractText) {
  let hash = 0;
  for (let i = 0; i < contractText.length; i++) {
    const char = contractText.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}

/**
 * Main pipeline entry
 */
export async function processContract(contract) {
  if (!contract || !contract.extracted_text) {
    throw new Error("Invalid contract input: missing extracted_text");
  }

  // STEP 1: Normalize ONCE (critical fix)
  const normalizedText = normalizeText(contract.extracted_text);

  // STEP 2: Stable segmentation (this removes randomness)
  const segments = segmentClauses(normalizedText);

  // STEP 3: Deterministic clause extraction (NO re-feeding raw text)
  const clauses = await Promise.all(
    segments.map(async (segment, index) => {
      const result = await extractClauses(segment);

      return {
        index,
        text: segment,
        clauses: result?.clauses || [],
        raw: result
      };
    })
  );

  // STEP 4: Flatten clauses deterministically
  const flatClauses = clauses.flatMap(c => c.clauses || []);

  // STEP 5: Stable deduplication (important for repeated PDF patterns)
  const seen = new Set();
  const uniqueClauses = [];

  for (const clause of flatClauses) {
    const key = (clause.text || clause).toString().trim();

    if (!seen.has(key)) {
      seen.add(key);
      uniqueClauses.push(clause);
    }
  }

  // STEP 6: Obligation extraction (ONLY once, full text)
  const obligationsResult = await extractObligations(normalizedText);

  const obligations = obligationsResult?.obligations || [];

  // STEP 7: Final deterministic output
  return {
    success: true,
    contract: {
      ...contract,
      extracted_text: normalizedText
    },
    clausesDetected: uniqueClauses.length,
    obligationsDetected: obligations.length,

    clauses: uniqueClauses,
    obligations,

    debug: {
      segments: segments.length,
      clausesRaw: flatClauses.length,
      clausesUnique: uniqueClauses.length,
      textHash: generateStableKey(normalizedText)
    }
  };
}
