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

  clauses.forEach((clause) => {
    // Clean formatting
    const normalizedText = clause.clause_text
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Split into readable legal sentences
    const sentences = normalizedText.split(/(?<=\.)\s+/);

    sentences.forEach((sentence) => {
      const cleaned = sentence.trim();

      if (!cleaned || cleaned.length < 20) {
        return;
      }

      const lower = cleaned.toLowerCase();

      const isObligation =
        lower.includes(" shall ") ||
        lower.includes(" must ") ||
        lower.includes(" will ") ||
        lower.includes(" agrees to ") ||
        lower.includes(" agree to ") ||
        lower.includes(" required to ") ||
        lower.includes(" responsible for ");

      if (!isObligation) {
        return;
      }

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

function detectClauseType(title, text) {
  const combined = `${title} ${text}`.toLowerCase();

  if (
    combined.includes("payment") ||
    combined.includes("fee") ||
    combined.includes("invoice") ||
    combined.includes("tax") ||
    combined.includes("reimburse")
  ) {
    return "financial";
  }

  if (
    combined.includes("termination") ||
    combined.includes("terminate") ||
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
    combined.includes("service") ||
    combined.includes("airworthy")
  ) {
    return "maintenance";
  }

  if (
    combined.includes("notice") ||
    combined.includes("notify")
  ) {
    return "notification";
  }

  return "general";
}

function detectResponsibleParty(text) {
  const lower = text.toLowerCase();

  if (
    lower.startsWith("club") ||
    lower.includes(" the club ") ||
    lower.includes("club shall") ||
    lower.includes("club will") ||
    lower.includes("club agrees")
  ) {
    return "Club";
  }

  if (
    lower.startsWith("lessor") ||
    lower.includes(" the lessor ") ||
    lower.includes("lessor shall") ||
    lower.includes("lessor will") ||
    lower.includes("lessor agrees")
  ) {
    return "Lessor";
  }

  if (
    lower.includes("either party") ||
    lower.includes("both parties")
  ) {
    return "Both Parties";
  }

  return "Unknown";
}

function detectObligationType(text) {
  const lower = text.toLowerCase();

  if (
    lower.includes("pay") ||
    lower.includes("payment") ||
    lower.includes("fee") ||
    lower.includes("cost") ||
    lower.includes("expense") ||
    lower.includes("reimburse") ||
    lower.includes("tax")
  ) {
    return "payment";
  }

  if (
    lower.includes("maintain") ||
    lower.includes("maintenance") ||
    lower.includes("repair") ||
    lower.includes("service") ||
    lower.includes("overhaul")
  ) {
    return "maintenance";
  }

  if (
    lower.includes("insurance") ||
    lower.includes("insured") ||
    lower.includes("coverage")
  ) {
    return "insurance";
  }

  if (
    lower.includes("terminate") ||
    lower.includes("termination")
  ) {
    return "termination";
  }

  if (
    lower.includes("notice") ||
    lower.includes("notify")
  ) {
    return "notification";
  }

  if (
    lower.includes("law") ||
    lower.includes("regulation") ||
    lower.includes("governmental") ||
    lower.includes("compliance")
  ) {
    return "compliance";
  }

  return "general";
}
