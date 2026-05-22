// ======================================================
// PRODUCTION-GRADE OBLIGATION EXTRACTOR
// ======================================================

const OBLIGATION_VERBS = [
  "shall",
  "must",
  "will",
  "agrees to",
  "is required to",
  "responsible for",
  "undertakes to",
];

// ======================================================
// MAIN EXPORT
// ======================================================

export function extractObligations(clauses) {
  const obligations = [];

  clauses.forEach((clause, clauseIndex) => {
    const sentences = splitSentences(clause.clause_text);

    sentences.forEach((sentence) => {
      if (isObligation(sentence)) {
        obligations.push({
          clause_id: clauseIndex + 1,
          obligation_text: sentence.trim(),
          responsible_party: detectParty(sentence),
          obligation_type: classifyObligation(sentence),
        });
      }
    });
  });

  return obligations;
}

// ======================================================
// SENTENCE SPLITTER
// ======================================================

function splitSentences(text) {
  return text
    .replace(/\n/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 20);
}

// ======================================================
// OBLIGATION DETECTION
// ======================================================

function isObligation(sentence) {
  const s = sentence.toLowerCase();
  return OBLIGATION_VERBS.some((v) => s.includes(v));
}

// ======================================================
// PARTY DETECTION
// ======================================================

function detectParty(sentence) {
  const s = sentence.toLowerCase();

  if (s.includes("lessor")) return "lessor";
  if (s.includes("club")) return "club";
  if (s.includes("lessee")) return "lessee";

  return "unknown";
}

// ======================================================
// OBLIGATION TYPE CLASSIFICATION
// ======================================================

function classifyObligation(sentence) {
  const s = sentence.toLowerCase();

  if (s.includes("pay") || s.includes("payment")) return "financial";
  if (s.includes("maintain") || s.includes("repair")) return "maintenance";
  if (s.includes("insur")) return "insurance";
  if (s.includes("report")) return "reporting";

  return "general";
}
