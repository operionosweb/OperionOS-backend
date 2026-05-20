// services/clauseExtractionService.js

// ---------------------------------------------------
// CLAUSE EXTRACTION
// ---------------------------------------------------

export function extractClauses(textArray) {
  if (!textArray || !Array.isArray(textArray)) return [];

  const clauses = [];

  textArray.forEach((text, index) => {
    if (!text || typeof text !== "string") return;

    const clauseNumber = index + 1;

    const clauseTitle = extractTitle(text, clauseNumber);

    const clauseText = `
ARTICLE ${clauseNumber} - ${clauseTitle}:
${text}
    `.trim();

    clauses.push({
      clause_number: clauseNumber,
      clause_title: clauseTitle,
      clause_text: clauseText,
      clause_type: detectClauseType(clauseTitle, clauseText),
    });
  });

  return clauses;
}

// ---------------------------------------------------
// TITLE EXTRACTION
// ---------------------------------------------------

function extractTitle(text, fallbackNumber) {
  const match = text.match(/ARTICLE\s+\d+\s*[-–—:]\s*([^\n:]+)/i);

  if (match && match[1]) {
    return match[1].trim();
  }

  return `Clause ${fallbackNumber}`;
}

// ---------------------------------------------------
// CLAUSE TYPE DETECTION
// ---------------------------------------------------

function detectClauseType(title, text) {
  const combined = `${title} ${text}`.toLowerCase();

  if (
    combined.includes("payment") ||
    combined.includes("fee") ||
    combined.includes("tax") ||
    combined.includes("invoice")
  ) {
    return "financial";
  }

  if (
    combined.includes("termination") ||
    combined.includes("return") ||
    combined.includes("expire")
  ) {
    return "termination";
  }

  if (
    combined.includes("insurance") ||
    combined.includes("liability")
  ) {
    return "liability";
  }

  if (
    combined.includes("maintenance") ||
    combined.includes("repair") ||
    combined.includes("airworthy")
  ) {
    return "maintenance";
  }

  if (
    combined.includes("notice")
  ) {
    return "notification";
  }

  return "general";
}

// ---------------------------------------------------
// DEFAULT EXPORT (CRITICAL FOR YOUR PIPELINE)
// ---------------------------------------------------

export default {
  extractClauses,
};
