export function extractClauses(text = "") {
  if (!text || typeof text !== "string") {
    return [];
  }

  // Normalize text
  const cleanText = text
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // STEP 1: Split ONLY on strong structural markers
  // We do NOT use naive split('.' or line breaks anymore)
  const blocks = cleanText.split(/\n(?=[A-Z][\w\s]{0,40}\.)/g);

  const clauses = [];
  let clauseId = 0;

  for (const block of blocks) {
    const trimmed = block.trim();

    if (trimmed.length < 20) continue;

    clauses.push({
      id: `clause_${clauseId++}`,
      clause_text: trimmed,
    });
  }

  // FALLBACK: if structure fails, do paragraph-based split
  if (clauses.length <= 3) {
    const fallbackBlocks = cleanText.split(/\n\s*\n/);

    return fallbackBlocks
      .filter((b) => b.trim().length > 20)
      .map((b, i) => ({
        id: `clause_${i}`,
        clause_text: b.trim(),
      }));
  }

  return clauses;
}
