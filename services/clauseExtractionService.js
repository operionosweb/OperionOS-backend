const CLAUSE_PATTERNS = [
  { category: "payment", keywords: ["payment", "fee", "rent", "charges", "reimburse"] },
  { category: "maintenance", keywords: ["maintenance", "repair", "inspection", "service"] },
  { category: "insurance", keywords: ["insurance", "liability", "deductible", "damage"] },
  { category: "operational_restriction", keywords: ["not be used", "prohibited", "shall not"] },
  { category: "compliance", keywords: ["certificate", "rated", "comply", "regulation"] },
  { category: "redelivery", keywords: ["return", "redelivery", "home base", "abandoned"] },
];

/* =========================
   CLEAN TEXT
========================= */

function cleanText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   SPLIT BY LEGAL BOUNDARIES
   (NOT SENTENCES)
========================= */

function splitLegalBlocks(text) {
  return text
    .split(/\n(?=[A-Z]\.|[A-Z]\s|•|\*)/g) // section markers
    .map((t) => t.trim())
    .filter((t) => t.length > 60);
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
    lower.includes("prohibited")
  );
}

/* =========================
   MAIN EXTRACTOR
========================= */

export function extractClauses(text) {
  if (!text) return [];

  const cleaned = cleanText(text);
  const blocks = splitLegalBlocks(cleaned);

  const clauses = blocks.map((block, index) => {
    const category = detectCategory(block);
    const obligation = isObligation(block);

    return {
      clause_title: `Clause ${index + 1}`,
      clause_category: category,
      clause_text: block,
      risk_level: obligation ? "high" : "low",
      trigger_type: "hybrid_v1",
    };
  });

  return clauses;
}
