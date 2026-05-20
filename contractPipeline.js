// contractPipeline.js

const clauseExtractionService = require("./services/clauseExtractionService");
const obligationExtractor = require("./services/obligationExtractor");

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
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
}

// ---------------------------------------------------
// SEGMENT CLAUSES
// ---------------------------------------------------

function segmentClauses(text) {
  if (!text || typeof text !== "string") return [];

  const normalized = normalizeText(text);
  const allClauses = [];

  // ARTICLE-based segmentation
  const articleRegex =
    /(ARTICLE\s+\d+\s*[-–—:]?.*?)(?=ARTICLE\s+\d+\s*[-–—:]|$)/gis;

  const articleMatches = normalized.match(articleRegex);

  if (articleMatches) {
    for (const article of articleMatches) {
      const cleanArticle = article.trim();

      if (cleanArticle.length > 20) {
        allClauses.push(cleanArticle);
      }

      // Numbered subclauses
      const numberedClauses = cleanArticle.match(
        /\d+\.\s[\s\S]*?(?=\n\d+\.|\nARTICLE|$)/g
      );

      if (numberedClauses) {
        for (const clause of numberedClauses) {
          if (clause.trim().length > 10) {
            allClauses.push(clause.trim());
          }
        }
      }

      // Letter clauses
      const letterClauses = cleanArticle.match(
        /[a-z]\)\s[\s\S]*?(?=\n[a-z]\)|$)/gi
      );

      if (letterClauses) {
        for (const clause of letterClauses) {
          if (clause.trim().length > 10) {
            allClauses.push(clause.trim());
          }
        }
      }
    }
  }

  // Bullet extraction fallback
  const bullets = normalized.match(/(?:^|\n)\s*[\*\-•]\s.+/g);

  if (bullets) {
    for (const bullet of bullets) {
      const clean = bullet.replace(/^\s*[\*\-•]\s*/, "").trim();
      if (clean.length > 10) {
        allClauses.push(clean);
      }
    }
  }

  // Cleanup + deduplicate
  const cleaned = allClauses
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter((c) => c.length > 10);

  return [...new Set(cleaned)];
}

// ---------------------------------------------------
// CLAUSE NORMALIZATION (CRITICAL FIX)
// ---------------------------------------------------

function normalizeClauses(rawClauses) {
  if (!Array.isArray(rawClauses)) return [];

  return rawClauses.map((clause, index) => {
    if (typeof clause === "string") {
      return {
        clause_number: index + 1,
        clause_title: `Clause ${index + 1}`,
        clause_text: clause,
        clause_type: "general"
      };
    }

    return {
      clause_number: clause.clause_number || index + 1,
      clause_title: clause.clause_title || `Clause ${index + 1}`,
      clause_text: clause.clause_text || "",
      clause_type: clause.clause_type || "general"
    };
  });
}

// ---------------------------------------------------
// MAIN PIPELINE (FIXED + UNIFIED)
// ---------------------------------------------------

async function processContract(contract) {
  try {
    const extractedText =
      typeof contract === "string"
        ? contract
        : contract?.extracted_text || contract?.text || "";

    if (!extractedText) {
      throw new Error("No contract text provided to pipeline");
    }

    // STEP 1: Normalize + segment
    const segmentedClauses = segmentClauses(extractedText);

    console.log("SEGMENTED CLAUSES:", segmentedClauses.length);

    // STEP 2: Normalize structure BEFORE AI processing
    let extractedClauses;

    try {
      extractedClauses =
        await clauseExtractionService.extractClauses(segmentedClauses);
    } catch (err) {
      console.error("Clause extraction failed:", err.message);

      extractedClauses = normalizeClauses(segmentedClauses);
    }

    extractedClauses = normalizeClauses(extractedClauses);

    // STEP 3: Obligation extraction (stable structured input)
    let obligations = [];

    try {
      obligations =
        await obligationExtractor.extractObligations(extractedClauses);
    } catch (err) {
      console.error("Obligation extraction failed:", err.message);
      obligations = [];
    }

    // STEP 4: Final response
    return {
      success: true,

      clauses: extractedClauses,

      obligations,

      clausesDetected: extractedClauses.length,

      obligationsDetected: obligations.length,

      debug: {
        segmentedClauses: segmentedClauses.length,
        extractedClausesType: typeof extractedClauses,
        obligationsType: typeof obligations
      }
    };
  } catch (error) {
    console.error("Contract pipeline failed:", error);

    return {
      success: false,
      error: error.message
    };
  }
}

// ---------------------------------------------------

module.exports = {
  processContract,
  segmentClauses,
  normalizeText,
  normalizeClauses
};
