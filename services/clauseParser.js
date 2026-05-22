// ======================================================
// PRODUCTION-GRADE CLAUSE PARSER
// ======================================================

const CLAUSE_PATTERNS = [
  /ARTICLE\s+\d+[\s\S]*?(?=ARTICLE\s+\d+|APPENDIX|$)/gi,
  /SECTION\s+\d+[\s\S]*?(?=SECTION\s+\d+|APPENDIX|$)/gi,
];

function detectStructuralClauses(text) {
  let clauses = [];

  for (const pattern of CLAUSE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      clauses.push(...matches);
    }
  }

  return clauses.length ? clauses : [text]; // fallback
}

// ======================================================
// CLAUSE TYPE CLASSIFICATION
// ======================================================

function classifyClause(text) {
  const t = text.toLowerCase();

  if (t.includes("payment") || t.includes("fee") || t.includes("rent"))
    return "payment";

  if (t.includes("terminate") || t.includes("termination"))
    return "termination";

  if (t.includes("insurance"))
    return "insurance";

  if (t.includes("maintenance") || t.includes("repair"))
    return "maintenance";

  if (t.includes("liability") || t.includes("indemn"))
    return "liability";

  if (t.includes("notice"))
    return "notice";

  return "general";
}

// ======================================================
// MAIN EXPORT
// ======================================================

export function extractClauses(text) {
  const rawClauses = detectStructuralClauses(text);

  return rawClauses.map((clause, index) => ({
    clause_number: index + 1,
    clause_title: extractTitle(clause),
    clause_text: clause.trim(),
    clause_type: classifyClause(clause),
  }));
}

// ======================================================
// TITLE EXTRACTION (SMART)
// ======================================================

function extractTitle(clauseText) {
  const match = clauseText.match(/ARTICLE\s+\d+\s+[-–]\s*(.+)/i);
  if (match) return match[1].trim().slice(0, 120);

  const firstLine = clauseText.split("\n")[0];
  return firstLine?.trim().slice(0, 120) || "Untitled Clause";
}
