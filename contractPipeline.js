// contractPipeline.js

import { extractClauses } from "./services/clauseExtractionService.js";
import { extractObligations } from "./services/obligationExtractor.js";

/**
 * Normalize OCR / PDF text into deterministic format
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
 * Two-level deterministic clause segmentation:
 * 1. Section level (A, B, C...)
 * 2. Clause level ((1), (2), bullets)
 */
function segmentClauses(text) {
  const normalized = normalizeText(text);

  // STEP 1: split into sections A-H (high-level grouping)
  const sections = normalized.split(/\n\s*[A-H]\.\s/g);

  const allClauses = [];

  for (const section of sections) {
    const trimmedSection = section.trim();
    if (!trimmedSection) continue;

    // STEP 2: split numbered clauses inside section
    const numberedParts = trimmedSection.split(/(?=\(\d+\))/g);

    for (const part of numberedParts) {
      const clean = part.trim();
      if (!clean) continue;
      allClauses.push(clean);
    }
  }

  // STEP 3: extract bullet rules separately (* items)
  const bulletParts = normalized.split(/\n\s*\*\s/g);

  for (const bullet of bulletParts) {
    const clean = bullet.trim();

    if (!clean) continue;
    if (clean.length < 10) continue;

    allClauses.push(clean);
  }

  // STEP 4: deterministic deduplication
  const unique = Array.from(new Set(allClauses));

  return unique;
}

/**
 * Stable hash for debugging consistency
 */
function generateStableKey(text = "") {
  let hash = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }

  return hash;
}

/**
 * Main pipeline
 */
export async function processContract(contract) {
  if (!contract?.extracted_text) {
    throw new Error("Missing extracted_text in contract");
  }

  // STEP 1: normalize
  const normalizedText = normalizeText(contract.extracted_text);

  // STEP 2: deterministic segmentation
  const segments = segmentClauses(normalizedText);

  // STEP 3: extract clauses per segment
  const clauseResults = await Promise.all(
    segments.map(async (segment, index) => {
      const result = await extractClauses(segment);

      return {
        index,
        text: segment,
        clauses: result?.clauses || []
      };
    })
  );

  // STEP 4: flatten clauses
  const flatClauses = clauseResults.flatMap(c => c.clauses);

  // STEP 5: deduplicate clauses deterministically
  const seen = new Set();
  const uniqueClauses = [];

  for (const clause of flatClauses) {
    const key = (clause?.text || clause).toString().trim();

    if (!seen.has(key)) {
      seen.add(key);
      uniqueClauses.push(clause);
    }
  }

  // STEP 6: obligations (run once, full text only)
  const obligationsResult = await extractObligations(normalizedText);
  const obligations = obligationsResult?.obligations || [];

  // STEP 7: final output
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
      rawClauses: flatClauses.length,
      uniqueClauses: uniqueClauses.length,
      textHash: generateStableKey(normalizedText)
    }
  };
}
