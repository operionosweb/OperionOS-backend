const CLAUSE_PATTERNS = [
  {
    category: "payment",
    keywords: [
      "payment",
      "invoice",
      "fee",
      "fees",
      "rent",
      "charges",
      "rate",
      "cost",
      "liable to pay",
      "on demand"
    ],
  },
  {
    category: "maintenance",
    keywords: [
      "maintenance",
      "repair",
      "overhaul",
      "inspection",
      "airworthy",
      "mechanical condition",
      "breakdown"
    ],
  },
  {
    category: "insurance",
    keywords: [
      "insurance",
      "liability",
      "bodily injury",
      "deductible",
      "coverage",
      "occurrence",
      "physical damage"
    ],
  },
  {
    category: "operational",
    keywords: [
      "flight",
      "operation",
      "weather",
      "vfr",
      "ifr",
      "pilot in command",
      "take-off",
      "landing",
      "airport"
    ],
  },
  {
    category: "redelivery",
    keywords: [
      "return",
      "redelivery",
      "return the aircraft",
      "abandoned",
      "home base",
      "scheduled time"
    ],
  },
];

function cleanText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * FIXED CLAUSE DETECTION (stable version)
 */
export function extractClauses(text) {
  if (!text) return [];

  const cleaned = cleanText(text);

  // STEP 1: split ONLY by double line breaks OR bullet blocks
  const rawBlocks = cleaned.split(/\n(?=\*|\d+\.|\([A-Z]\)|[A-Z]\.)/g);

  const clauses = [];

  rawBlocks.forEach((block, index) => {
    const section = block.trim();

    if (section.length < 40) return;

    let detectedCategory = "general";

    const lower = section.toLowerCase();

    for (const pattern of CLAUSE_PATTERNS) {
      if (pattern.keywords.some((k) => lower.includes(k))) {
        detectedCategory = pattern.category;
        break;
      }
    }

    clauses.push({
      clause_title: `Clause ${index + 1}`,
      clause_category: detectedCategory,
      clause_text: section,
      risk_level:
        detectedCategory === "insurance" ||
        detectedCategory === "maintenance"
          ? "high"
          : "medium",
      trigger_type: "auto_detected",
    });
  });

  return clauses;
}
