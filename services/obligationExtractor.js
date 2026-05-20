// services/obligationExtractor.js

export function extractObligations(clauses = []) {
  const allObligations = [];

  for (const clause of clauses) {
    const obligations = extractFromClause(clause);

    allObligations.push(...obligations);
  }

  return allObligations;
}

/**
 * MAIN CLAUSE PROCESSOR
 */
function extractFromClause(clause) {
  const text = clause.clause_text || "";
  const clauseId = clause.clause_number;

  const sentences = splitSentences(text);

  const obligations = [];

  for (const sentence of sentences) {
    if (!isObligation(sentence)) continue;

    obligations.push({
      clause_id: clauseId,
      obligation_text: normalizeSentence(sentence),
      responsible_party: detectResponsibleParty(clause, sentence),
      obligation_type: classifyObligation(sentence)
    });
  }

  return obligations;
}

/**
 * SENTENCE SPLITTING (SAFE SIMPLE VERSION)
 */
function splitSentences(text) {
  return text
    .replace(/\n/g, " ")
    .split(".")
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * CRITICAL FIX: RESPONSIBLE PARTY DETECTION
 * Uses BOTH clause context + sentence subject
 */
function detectResponsibleParty(clause, sentence) {
  const text = (sentence + " " + (clause.clause_text || "")).toLowerCase();

  // Strong explicit patterns first (highest priority)
  if (text.includes("club shall") || text.includes("the club shall") || text.startsWith("club ")) {
    return "Club";
  }

  if (text.includes("lessor shall") || text.includes("the lessor shall") || text.startsWith("lessor ")) {
    return "Lessor";
  }

  // Clause-level fallback (important for fragmented sentences)
  const clauseText = (clause.clause_text || "").toLowerCase();

  if (clauseText.includes("club shall")) return "Club";
  if (clauseText.includes("lessor shall")) return "Lessor";

  // Directional heuristics (secondary signal)
  if (sentence.toLowerCase().includes("club")) return "Club";
  if (sentence.toLowerCase().includes("lessor")) return "Lessor";

  return "Unknown";
}

/**
 * OB LIGATION DETECTION
 */
function isObligation(sentence) {
  const lower = sentence.toLowerCase();

  return (
    lower.includes("shall") ||
    lower.includes("must") ||
    lower.includes("will") ||
    lower.includes("agrees to") ||
    lower.includes("is responsible for")
  );
}

/**
 * CLEAN OUTPUT NORMALIZATION
 */
function normalizeSentence(sentence) {
  return sentence.trim().replace(/\s+/g, " ") + ".";
}

/**
 * BASIC CLASSIFIER (KEEP LIGHTWEIGHT FOR NOW)
 */
function classifyObligation(text) {
  const lower = text.toLowerCase();

  if (lower.includes("pay") || lower.includes("fee") || lower.includes("cost")) {
    return "payment";
  }

  if (lower.includes("maintain") || lower.includes("repair") || lower.includes("service")) {
    return "maintenance";
  }

  if (lower.includes("insurance")) {
    return "insurance";
  }

  if (lower.includes("notice") || lower.includes("notify")) {
    return "notification";
  }

  if (lower.includes("terminate")) {
    return "termination";
  }

  if (lower.includes("tax")) {
    return "tax";
  }

  return "general";
}
