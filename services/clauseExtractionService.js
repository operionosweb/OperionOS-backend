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
    keywords: ["insurance", "liability", "damage", "coverage", "deductible"],
  },
  {
    category: "redelivery",
    keywords: ["return", "redelivery", "home base", "scheduled time"],
  },
  {
    category: "operational",
    keywords: ["flight", "operation", "weather", "vfr", "ifr", "airport"],
  },
];

function cleanText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/\n+/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * NEW APPROACH:
 * We detect clause blocks instead of splitting randomly.
 */
export function extractClauses(text) {
  if (!text) return [];

  const cleaned = cleanText(text);

  const lines = cleaned.split("\n");

  const clauses = [];
  let currentClause = "";

  const isNewClauseStart = (line) => {
    return (
      /^[A-H]\.\s/.test(line) || // A. B. C.
      /^\(\d+\)/.test(line) || // (1) (2)
      /^[A-Z\s]{6,}$/.test(line) || // SECTION HEADERS
      line.includes("FLIGHT OPERATIONS SAFETY RULES") ||
      line.includes("TRANSIENT MAINTENANCE POLICY") ||
      line.includes("NOTICE OF INSURANCE COVERAGE")
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (isNewClauseStart(line) && currentClause.length > 80) {
      clauses.push(currentClause.trim());
      currentClause = line + " ";
    } else {
      currentClause += line + " ";
    }
  }

  if (currentClause.length > 80) {
    clauses.push(currentClause.trim());
  }

  return clauses.map((section, index) => {
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
}
