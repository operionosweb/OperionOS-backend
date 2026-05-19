const CLAUSE_PATTERNS = [
  { category: "payment", keywords: ["payment", "fee", "rent", "charges", "reimburse"] },
  { category: "maintenance", keywords: ["maintenance", "repair", "inspection", "service"] },
  { category: "insurance", keywords: ["insurance", "liability", "deductible", "damage"] },
  { category: "operational_restriction", keywords: ["not be used", "prohibited", "shall not"] },
  { category: "compliance", keywords: ["certificate", "rated", "comply", "regulation"] },
  { category: "redelivery", keywords: ["return", "redelivery", "home base", "abandoned"] },
];

function cleanText(text) {
  return text
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   SMART SENTENCE EXTRACTION
   (not structure-based)
========================= */

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);
}

/* =========================
   CATEGORY DETECTION
========================= */

function detectCategory(text) {
  const lower = text.toLowerCase();

  for (const p of CLAUSE_PATTERNS) {
    if (p.keywords.some((k) => lower.includes(k))) {
      return p.category;
    }
  }

  return "general";
}

/* =========================
   OBLIGATION DETECTION
========================= */

function isObligation(text) {
  const lower = text.toLowerCase();

  return (
    lower.includes("shall") ||
    lower.includes("must") ||
    lower.includes("agrees") ||
    lower.includes("will") ||
    lower.includes("liable") ||
    lower.includes("responsible") ||
    lower.includes("not be") ||
    lower.includes("prohibited") ||
    lower.includes("required")
  );
}

/* =========================
   MAIN ENGINE
========================= */

export function extractClauses(text) {
  if (!text) return [];

  const cleaned = cleanText(text);
  const sentences = splitSentences(cleaned);

  const clauses = sentences.map((sentence, index) => {
    const category = detectCategory(sentence);
    const obligation = isObligation(sentence);

    return {
      clause_title: `Clause ${index + 1}`,
      clause_category: category,
      clause_text: sentence,
      risk_level: obligation ? "high" : "low",
      trigger_type: "stream_v2",
    };
  });

  return clauses;
}
