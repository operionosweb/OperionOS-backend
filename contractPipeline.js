import clauseExtractionService from "./services/clauseExtractionService.js";
import obligationExtractor from "./services/obligationExtractor.js";

// ---------------------------------------------------
// NORMALIZE TEXT
// ---------------------------------------------------

function normalizeText(text) {
  if (!text || typeof text !== "string") return "";

  return text
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------
// SEGMENT CLAUSES
// ---------------------------------------------------

function segmentClauses(text) {
  if (!text || typeof text !== "string") return [];

  const normalized = normalizeText(text);
  const allClauses = [];

  const articleRegex =
    /(ARTICLE\s+\d+\s*[-–—:]?.*?)(?=ARTICLE\s+\d+\s*[-–—:]|$)/gis;

  const articleMatches = normalized.match(articleRegex);

  if (articleMatches) {
    for (const article of articleMatches) {
      const cleanArticle = article.trim();

      if (cleanArticle.length > 20) {
        allClauses.push(cleanArticle);
      }

      const numberedClauses = cleanArticle.match(
        /\d+\.\s[\s\S]*?(?=\n\d+\.|\nARTICLE|$)/g
      );

      if (numberedClauses) {
        for (const clause of numberedClauses) {
          const clean = clause.trim();
          if (clean.length > 10) allClauses.push(clean);
        }
      }

      const letterClauses = cleanArticle.match(
        /[a-z]\)\s[\s\S]*?(?=\n[a-z]\)|$)/gi
      );

      if (letterClauses) {
        for (const clause of letterClauses) {
          const clean = clause.trim();
          if (clean.length > 10) allClauses.push(clean);
        }
      }
    }
  }

  const bullets = normalized.match(/(?:^|\n)\s*[\*\-•]\s.+/g);

  if (bullets) {
    for (const bullet of bullets) {
      const clean = bullet.replace(/^\s*[\*\-•]\s*/, "").trim();
      if (clean.length > 10) allClauses.push(clean);
    }
  }

  const cleaned = allClauses
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter((c) => c.length > 10);

  return [...new Set(cleaned)];
}

// ---------------------------------------------------
// MAIN PIPELINE
// ---------------------------------------------------

export async function processContract(contract) {
  try {
    const extractedText = contract?.extracted_text || "";

    const segmentedClauses = segmentClauses(extractedText);

    console.log("SEGMENTED CLAUSES:", segmentedClauses.length);

    // ------------------------------------
    // CLAUSE EXTRACTION
    // ------------------------------------

    let extractedClauses = [];

    try {
      extractedClauses =
        await clauseExtractionService.extractClauses(segmentedClauses);
    } catch (err) {
      console.error("Clause extraction failed:", err.message);

      extractedClauses = segmentedClauses.map((c, index) => ({
        clause_number: index + 1,
        clause_title: `Clause ${index + 1}`,
        clause_text: c,
        clause_type: "general",
      }));
    }

    // ------------------------------------
    // OBLIGATION EXTRACTION
    // ------------------------------------

    let obligations = [];

    try {
      obligations =
        await obligationExtractor.extractObligations(extractedClauses);
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
      obligationsDetected: obligations.length,
      debug: {
        segmentedClauses: segmentedClauses.length,
      },
    };
  } catch (error) {
    console.error("Contract pipeline failed:", error);

    return {
      success: false,
      error: error.message,
    };
  }
}

// helpers
export { segmentClauses, normalizeText };
