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
    const sentences = splitIntoSentences(clause.clause_text);

    sentences.forEach((sentence) => {
      if (containsObligation(sentence)) {
        obligations.push({
          clause_id: clause.clause_number,
          obligation_text: cleanSentence(sentence),
          responsible_party: detectResponsibleParty(sentence),
          obligation_type: detectObligationType(sentence),
        });
      }
    });
  });

  return obligations;
}

/* =========================
   SENTENCE SPLITTING
========================= */

function splitIntoSentences(text) {
  return text
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
}

/* =========================
   OBLIGATION DETECTION
========================= */

function containsObligation(sentence) {
  const lower = sentence.toLowerCase();

  return (
    lower.includes("shall") ||
    lower.includes("must") ||
    lower.includes("will") ||
    lower.includes("agree to") ||
    lower.includes("agrees to") ||
    lower.includes("required to") ||
    lower.includes("responsible for")
  );
}

/* =========================
   CLEANING
========================= */

function cleanSentence(sentence) {
  return sentence
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   CLAUSE TYPE DETECTION
========================= */

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

/* =========================
   RESPONSIBLE PARTY DETECTION
========================= */

function detectResponsibleParty(sentence) {
  const lower = sentence.toLowerCase();

  if (
    lower.includes("club shall") ||
    lower.includes("club will") ||
    lower.includes("club agrees") ||
    lower.includes("club must")
  ) {
    return "Club";
  }

  if (
    lower.includes("lessor shall") ||
    lower.includes("lessor will") ||
    lower.includes("lessor agrees") ||
    lower.includes("lessor must")
  ) {
    return "Lessor";
  }

  return "Unknown";
}

/* =========================
   OBLIGATION TYPE DETECTION
========================= */

function detectObligationType(sentence) {
  const lower = sentence.toLowerCase();

  if (
    lower.includes("pay") ||
    lower.includes("fee") ||
    lower.includes("cost") ||
    lower.includes("invoice") ||
    lower.includes("tax")
  ) {
    return "payment";
  }

  if (
    lower.includes("maintain") ||
    lower.includes("repair") ||
    lower.includes("service") ||
    lower.includes("overhaul")
  ) {
    return "maintenance";
  }

  if (lower.includes("insurance")) {
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

  return "general";
}
