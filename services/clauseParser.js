export function extractClauses(text) {
  try {
    const clauses = [];

    // Match ARTICLE X patterns
    const regex =
      /ARTICLE\s+(\d+)\s*[–-]\s*([A-Z\s]+):([\s\S]*?)(?=ARTICLE\s+\d+\s*[–-]|$)/gi;

    let match;

    while ((match = regex.exec(text)) !== null) {
      const clauseNumber = Number(match[1]);
      const clauseTitle = match[2].trim();
      const clauseText = match[3].trim();

      clauses.push({
        clause_number: clauseNumber,
        clause_title: clauseTitle,
        clause_text: clauseText,
        clause_type: detectClauseType(clauseTitle, clauseText)
      });
    }

    return clauses;
  } catch (err) {
    console.error("CLAUSE EXTRACTION FAILED:", err);
    return [];
  }
}

function detectClauseType(title, text) {
  const content = `${title} ${text}`.toLowerCase();

  if (
    content.includes("payment") ||
    content.includes("fee") ||
    content.includes("tax")
  ) {
    return "financial";
  }

  if (
    content.includes("termination") ||
    content.includes("return")
  ) {
    return "termination";
  }

  if (
    content.includes("insurance") ||
    content.includes("liability")
  ) {
    return "liability";
  }

  if (
    content.includes("maintenance") ||
    content.includes("repair")
  ) {
    return "maintenance";
  }

  return "general";
}
