const CLAUSE_PATTERNS = [
  {
    category: "payment",
    keywords: ["payment", "invoice", "fee", "rent", "charges"],
  },
  {
    category: "maintenance",
    keywords: ["maintenance", "repair", "inspection", "overhaul"],
  },
  {
    category: "insurance",
    keywords: ["insurance", "liability", "damage"],
  },
  {
    category: "redelivery",
    keywords: ["return", "redelivery", "return condition"],
  },
  {
    category: "operational",
    keywords: ["flight", "operation", "weather", "utilization"],
  },
];

function cleanText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/\n+/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractClauses(text) {
  if (!text) return [];

  const cleaned = cleanText(text);

  /* =========================
     SPLIT BY LEGAL SECTIONS
  ========================= */

  const sections = cleaned.split(
    /(?=\b[A-Z]\.\s)|(?=\*\s)|(?=NOTICE OF)|(?=TRANSIENT MAINTENANCE POLICY)|(?=FLIGHT OPERATIONS SAFETY RULES)/g
  );

  const clauses = sections
    .map((section) => section.trim())
    .filter((section) => section.length > 80)
    .map((section, index) => {
      let detectedCategory = "general";

      for (const pattern of CLAUSE_PATTERNS) {
        const found = pattern.keywords.some((keyword) =>
          section.toLowerCase().includes(keyword.toLowerCase())
        );

        if (found) {
          detectedCategory = pattern.category;
          break;
        }
      }

      return {
        clause_title: `Clause ${index + 1}`,
        clause_category: detectedCategory,
        clause_text: section,
        risk_level: "medium",
        trigger_type: "manual_review",
      };
    });

  return clauses;
}
