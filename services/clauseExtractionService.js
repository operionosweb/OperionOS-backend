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

    if (!matches) return;

    matches.forEach((matchText) => {
      const cleaned = cleanObligationText(matchText);

      // Ignore garbage / tiny matches
      if (cleaned.length < 25) return;

      obligations.push({
        clause_id: clause.clause_number,
        obligation_text: cleaned,
        responsible_party: detectResponsibleParty(cleaned),
        obligation_type: detectObligationType(cleaned),
      });
    });
  });

  return obligations;
}

function cleanObligationText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[0-9]+\./, "")
    .trim();
}

function detectClauseType(title, text) {
  const combined = `${title} ${text}`.toLowerCase();

  if (
    combined.includes("payment") ||
    combined.includes("fee") ||
    combined.includes("invoice") ||
    combined.includes("tax")
  ) {
    return "financial";
  }

  if (
    combined.includes("termination") ||
    combined.includes("expire") ||
    combined.includes("return")
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
    combined.includes("airworthiness")
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

function detectResponsibleParty(text) {
  const lower = text.toLowerCase();

  if (
    lower.includes("club shall") ||
    lower.includes("club will") ||
    lower.includes("club agrees")
  ) {
    return "Club";
  }

  if (
    lower.includes("lessor shall") ||
    lower.includes("lessor will") ||
    lower.includes("lessor agrees")
  ) {
    return "Lessor";
  }

  if (
    lower.includes("either party")
  ) {
    return "Both Parties";
  }

  return "Unknown";
}

function detectObligationType(text) {
  const lower = text.toLowerCase();

  // Payment
  if (
    lower.includes("pay") ||
    lower.includes("payment") ||
    lower.includes("fee") ||
    lower.includes("invoice") ||
    lower.includes("reimburse") ||
    lower.includes("tax")
  ) {
    return "payment";
  }

  // Maintenance
  if (
    lower.includes("maintain") ||
    lower.includes("repair") ||
    lower.includes("service") ||
    lower.includes("overhaul") ||
    lower.includes("airworthy")
  ) {
    return "maintenance";
  }

  // Insurance
  if (
    lower.includes("insurance") ||
    lower.includes("insured") ||
    lower.includes("coverage")
  ) {
    return "insurance";
  }

  // Termination
  if (
    lower.includes("terminate") ||
    lower.includes("termination") ||
    lower.includes("return the aircraft")
  ) {
    return "termination";
  }

  // Notification
  if (
    lower.includes("notice") ||
    lower.includes("notify") ||
    lower.includes("written notice")
  ) {
    return "notification";
  }

  // Compliance
  if (
    lower.includes("law") ||
    lower.includes("regulation") ||
    lower.includes("government")
  ) {
    return "compliance";
  }

  return "general";
}
