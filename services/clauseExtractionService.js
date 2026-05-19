const CLAUSE_PATTERNS = [
  {
    category: "payment",
    keywords: ["payment", "invoice", "fee", "rent", "charges", "reimburse"],
  },
  {
    category: "maintenance",
    keywords: ["maintenance", "repair", "inspection", "overhaul", "service"],
  },
  {
    category: "insurance",
    keywords: ["insurance", "liability", "damage", "deductible"],
  },
  {
    category: "redelivery",
    keywords: ["return", "redelivery", "abandoned", "home base"],
  },
  {
    category: "operational_restriction",
    keywords: ["not be used", "shall not", "prohibited", "restricted"],
  },
  {
    category: "compliance",
    keywords: ["certificate", "rated", "medical", "regulations", "comply"],
  },
];

function cleanText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   SENTENCE SPLITTER (CRITICAL FIX)
========================= */

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function detectCategory(sentence) {
  const lower = sentence.toLowerCase();

  for (const pattern of CLAUSE_PATTERNS) {
    if (
      pattern.keywords.some((kw) => lower.includes(kw.toLowerCase()))
    ) {
      return pattern.category;
    }
  }

  return "general";
}

/* =========================
   OBLIGATION FILTER (KEY FIX)
========================= */

function isObligation(sentence) {
  const lower = sentence.toLowerCase();

  return (
    lower.includes("shall") ||
    lower.includes("must") ||
    lower.includes("agrees") ||
    lower.includes("will") ||
    lower.includes("required") ||
    lower.includes("liable") ||
    lower.includes("not be") ||
    lower.includes("prohibited") ||
    lower.includes("responsible")
  );
}

export function extractClauses(text) {
  if (!text) return [];

  const cleaned = cleanText(text);
  const sentences = splitSentences(cleaned);

  const clauses = sentences
    .filter((sentence) => sentence.length > 40)
    .map((sentence, index) => {
      const category = detectCategory(sentence);
      const obligation = isObligation(sentence);

      return {
        clause_title: `Clause ${index + 1}`,
        clause_category: category,
        clause_text: sentence,
        risk_level: obligation ? "high" : "low",
        trigger_type: "auto_detect",
      };
    })
    .filter((c) => c.clause_text.length > 0);

  return clauses;
}
