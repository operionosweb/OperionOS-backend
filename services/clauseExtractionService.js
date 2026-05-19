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
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * FIXED VERSION:
 * - NO dangerous length gating
 * - proper structural flushing
 * - bullet + section awareness
 */
export function extractClauses(text) {
  if (!text) return [];

  const cleaned = cleanText(text);
  const lines = cleaned.split("\n");

  const clauses = [];

  let buffer = "";
  let lastWasHeader = false;

  const isHeader = (line) =>
    /^[A-H]\.\s/.test(line) || // A. B. C.
    /^\(\d+\)/.test(line) || // (1)
    /^[A-Z\s]{6,}$/.test(line) || // ALL CAPS HEADER
    line.includes("FLIGHT OPERATIONS SAFETY RULES") ||
    line.includes("TRANSIENT MAINTENANCE POLICY") ||
    line.includes("NOTICE OF INSURANCE COVERAGE");

  const isBullet = (line) =>
    /^\*/.test(line) || // * bullets
    /^•/.test(line);

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed.length > 60) {
      clauses.push(trimmed);
    }
    buffer = "";
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const header = isHeader(line);
    const bullet = isBullet(line);

    // 🔥 FORCE FLUSH on headers (IMPORTANT FIX)
    if (header) {
      flush();
      buffer += line + " ";
      lastWasHeader = true;
      continue;
    }

    // bullets belong to current clause
    if (bullet) {
      buffer += line + " ";
      lastWasHeader = false;
      continue;
    }

    // normal line
    buffer += line + " ";
    lastWasHeader = false;
  }

  flush();

  return clauses.map((section, index) => {
    let detectedCategory = "general";

    for (const pattern of CLAUSE_PATTERNS) {
      if (
        pattern.keywords.some((keyword) =>
          section.toLowerCase().includes(keyword)
        )
      ) {
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
