import { extractClauses as serviceExtractClauses } from "./services/clauseExtractionService.js";
import { extractObligations as serviceExtractObligations } from "./services/obligationExtractor.js";

/* =========================
   NORMALIZE TEXT
========================= */

function normalizeText(text) {
  if (!text || typeof text !== "string") return "";

  return text
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* =========================
   SEGMENT CLAUSES
========================= */

function segmentClauses(text) {
  if (!text || typeof text !== "string") return [];

  const normalized = normalizeText(text);

  const articleRegex = /(ARTICLE\s+\d+\s*[-–—:]?.*?)(?=ARTICLE\s+\d+\s*[-–—:]|$)/gis;

  const matches = normalized.match(articleRegex);

  if (!matches) return [];

  return matches
    .map(m => m.trim())
    .filter(m => m.length > 10);
}

/* =========================
   MAIN PIPELINE
========================= */

export async function processContract(contract) {
  try {
    const extractedText = contract?.extracted_text || "";

    const segmentedClauses = segmentClauses(extractedText);

    let extractedClauses = [];

    try {
      extractedClauses = await serviceExtractClauses(segmentedClauses);
    } catch (err) {
      console.error("Clause extraction failed:", err.message);

      extractedClauses = segmentedClauses.map((c, i) => ({
        clause_number: i + 1,
        clause_title: `Clause ${i + 1}`,
        clause_text: c,
        clause_type: "general"
      }));
    }

    let obligations = [];

    try {
      obligations = await serviceExtractObligations(extractedClauses);
    } catch (err) {
      console.error("Obligation extraction failed:", err.message);
      obligations = [];
    }

    return {
      success: true,
      contract,
      clauses: extractedClauses,
      obligations,
      clausesDetected: extractedClauses.length,
      obligationsDetected: obligations.length
    };

  } catch (error) {
    console.error("Pipeline failed:", error);

    return {
      success: false,
      error: error.message
    };
  }
}
