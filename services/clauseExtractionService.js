export function extractClauses(text) {
  if (!text) return [];

  const clean = text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // =========================
  // STEP 1: split by major headers
  // =========================
  const sectionSplitRegex =
    /(?=\n[A-Z]\.\s)|(?=\nFLIGHT OPERATIONS)|(?=\nTRANSIENT MAINTENANCE)|(?=\nNOTICE OF)|(?=\n[A-Z][A-Z ]{5,}\n)/g;

  const sections = clean.split(sectionSplitRegex).filter(Boolean);

  const clauses = [];

  let clauseIndex = 1;

  for (const section of sections) {
    const trimmed = section.trim();
    if (trimmed.length < 80) continue;

    // =========================
    // STEP 2: detect sub-clauses
    // =========================
    const subParts = trimmed.split(
      /(?=\(\d+\))|(?=\*\s)|(?=\n\d+\.)|(?=\n•)/
    );

    if (subParts.length === 1) {
      // no sub-structure → keep as single clause
      clauses.push({
        id: `clause_${clauseIndex++}`,
        contract_id: null,
        clause_title: `Clause ${clauseIndex - 1}`,
        clause_text: trimmed,
      });
      continue;
    }

    // multiple structured parts → expand
    for (const part of subParts) {
      const p = part.trim();
      if (p.length < 60) continue;

      clauses.push({
        id: `clause_${clauseIndex++}`,
        contract_id: null,
        clause_title: `Clause ${clauseIndex - 1}`,
        clause_text: p,
      });
    }
  }

  return clauses;
}
