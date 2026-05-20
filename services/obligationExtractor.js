// services/obligationExtractor.js

export function extractObligations(clauses) {
  if (!clauses || !Array.isArray(clauses)) return [];

  const obligations = [];

  const obligationRegex =
    /\b(shall|must|will|agree to|required to|responsible for)\b[\s\S]*?(?:\.|\n)/gi;

  clauses.forEach((clause) => {
    const matches = clause.clause_text?.match(obligationRegex);

    if (!matches) return;

    matches.forEach((matchText) => {
      const cleaned = cleanObligationText(matchText);

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

// ---------------------------
// HELPERS
// ---------------------------

function cleanObligationText(text) {
  return text.replace(/\s+/g, " ").replace(/^[0-9]+\./, "").trim();
}

function detectResponsibleParty(text) {
  const lower = text.toLowerCase();

  if (lower.includes("club")) return "Club";
  if (lower.includes("lessor")) return "Lessor";
  if (lower.includes("either party")) return "Both Parties";

  return "Unknown";
}

function detectObligationType(text) {
  const lower = text.toLowerCase();

  if (
    lower.includes("pay") ||
    lower.includes("fee") ||
    lower.includes("tax") ||
    lower.includes("reimburse")
  ) {
    return "payment";
  }

  if (
    lower.includes("maintain") ||
    lower.includes("repair") ||
    lower.includes("service")
  ) {
    return "maintenance";
  }

  if (
    lower.includes("insurance") ||
    lower.includes("coverage")
  ) {
    return "insurance";
  }

  if (
    lower.includes("terminate") ||
    lower.includes("return")
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

// IMPORTANT: default export fixes your crash
export default {
  extractObligations,
};
