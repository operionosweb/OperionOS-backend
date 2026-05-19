export function extractClauses(text) {
  if (!text) return [];

  const clean = text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // STEP 1: detect real clause blocks using paragraph clustering
  const paragraphs = clean
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 40);

  const blocks = [];
  let currentBlock = "";

  for (const p of paragraphs) {
    const looksLikeNewClause =
      /^[A-Z]\.|^\(\d+\)|^\d+\.|^FLIGHT|^NOTICE|^TRANSIENT|^[A-Z ]{6,}/.test(p);

    if (looksLikeNewClause && currentBlock.length > 100) {
      blocks.push(currentBlock);
      currentBlock = p;
    } else {
      currentBlock += " " + p;
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  // STEP 2: fallback if segmentation failed
  const finalBlocks =
    blocks.length > 1
      ? blocks
      : clean.split(/\n\n+/).filter((b) => b.length > 120);

  // STEP 3: return structured clauses
  return finalBlocks.map((block, i) => {
    return {
      id: `clause_${i + 1}`,
      contract_id: null,
      clause_title: `Clause ${i + 1}`,
      clause_text: block.trim(),
    };
  });
}
