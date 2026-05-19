const CLAUSE_PATTERNS = [
  {
    category: "payment",
    keywords: ["payment", "invoice", "fee", "rent", "charges"],
  },
  {
    category: "maintenance",
    keywords: ["maintenance", "repair", "airworthy", "inspection"],
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

export function extractClauses(text) {
  if (!text) return [];

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 50);

  const clauses = paragraphs.map((paragraph, index) => {
    let detectedCategory = "general";

    for (const pattern of CLAUSE_PATTERNS) {
      const found = pattern.keywords.some((keyword) =>
        paragraph.toLowerCase().includes(keyword.toLowerCase())
      );

      if (found) {
        detectedCategory = pattern.category;
        break;
      }
    }

    return {
      clause_title: `Clause ${index + 1}`,
      clause_category: detectedCategory,
      clause_text: paragraph,
      risk_level: "medium",
      trigger_type: "manual_review",
    };
  });

  return clauses;
}
