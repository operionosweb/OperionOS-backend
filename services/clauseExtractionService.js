export function extractClauses(text) {
  if (!text) return [];

  const clauses = [];

  // Match ARTICLE sections
  const articleRegex =
    /ARTICLE\s+(\d+)\s*[–-]\s*([^\n:]+):([\s\S]*?)(?=ARTICLE\s+\d+\s*[–-]|$)/gi;

  let match;

  while ((match = articleRegex.exec(text)) !== null) {
    const clauseNumber = parseInt(match[1]);
    const clauseTitle = match[2].trim();

    const clauseText = `
ARTICLE ${clauseNumber} - ${clauseTitle}:
${match[3].trim()}
    `.trim();

    clauses.push({
      clause_number: clauseNumber,
      clause_title: clauseTitle,
      clause_text: clauseText,
      clause_type: detectClauseType(clauseTitle, clauseText),
    });
  }

  return clauses;
}

export function extractObligations(clauses) {
  if (!clauses || !Array.isArray(clauses)) {
    return [];
  }

  const obligations = [];

  const obligationRegex =
    /\b(shall|must|will|agree to|required to|responsible for)\b[\s\S]*?(?:\.|\n)/gi;

  clauses.forEach((clause) => {
    const matches = clause.clause_text.match(obligationRegex);

    if (matches) {
      matches.forEach((matchText) => {
        obligations.push({
          clause_id: clause.clause_number,
          obligation_text: matchText.trim(),
          responsible_party: detectResponsibleParty(matchText),
          obligation_type: detectObligationType(matchText),
        });
      });
    }
  });

  return obligations;
}

function detectClauseType(title, text) {
  const combined = `${title} ${text}`.toLowerCase();

  if (
    combined.includes("payment") ||
    combined.includes("fee") ||
    combined.includes("invoice")
  ) {
    return "financial";
  }

  if (
    combined.includes("termination") ||
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
    combined.includes("repair")
  ) {
    return "maintenance";
  }

  return "general";
}

function detectResponsibleParty(text) {
  const lower = text.toLowerCase();

  if (lower.includes("club")) {
    return "Club";
  }

  if (lower.includes("lessor")) {
    return "Lessor";
  }

  return "Unknown";
}

function detectObligationType(text) {
  const lower = text.toLowerCase();

  if (
    lower.includes("pay") ||
    lower.includes("fee") ||
    lower.includes("cost")
  ) {
    return "payment";
  }

  if (
    lower.includes("maintain") ||
    lower.includes("repair")
  ) {
    return "maintenance";
  }

  if (
    lower.includes("insurance")
  ) {
    return "insurance";
  }

  if (
    lower.includes("terminate")
  ) {
    return "termination";
  }

  return "general";
}
