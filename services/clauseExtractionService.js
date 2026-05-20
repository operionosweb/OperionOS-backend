// contractPipeline.js

function normalizeText(text = "") {
  return text
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanClause(clause = "") {
  return clause
    .replace(/\s+/g, " ")
    .replace(/^[•*\-]\s*/, "")
    .trim();
}

function isUsefulClause(text = "") {
  if (!text) return false;

  const clean = text.trim();

  if (clean.length < 20) return false;

  if (/^initials$/i.test(clean)) return false;

  if (/^signed:/i.test(clean)) return false;

  if (/^witness:/i.test(clean)) return false;

  return true;
}

function segmentClauses(text = "") {
  const normalized = normalizeText(text);

  const clauses = [];

  // =====================================================
  // ARTICLE blocks
  // =====================================================

  const articleRegex =
    /(ARTICLE\s+\d+\s*[–-]\s*[\w\s,:&()\/]+:?)/gi;

  const articleMatches = [...normalized.matchAll(articleRegex)];

  if (articleMatches.length > 0) {
    for (let i = 0; i < articleMatches.length; i++) {
      const start = articleMatches[i].index;

      const end =
        i + 1 < articleMatches.length
          ? articleMatches[i + 1].index
          : normalized.length;

      const block = normalized.slice(start, end).trim();

      if (isUsefulClause(block)) {
        clauses.push(block);
      }
    }
  }

  // =====================================================
  // LETTER SECTIONS
  // =====================================================

  const letterSections = normalized.split(
    /\n\s*[A-Z]\.\s+/g
  );

  for (const section of letterSections) {
    const clean = cleanClause(section);

    if (isUsefulClause(clean)) {
      clauses.push(clean);
    }
  }

  // =====================================================
  // NUMBERED CLAUSES
  // =====================================================

  const numberedClauses = normalized.split(
    /(?=\n?\s*\d+\.\s+)/
  );

  for (const clause of numberedClauses) {
    const clean = cleanClause(clause);

    if (isUsefulClause(clean)) {
      clauses.push(clean);
    }
  }

  // =====================================================
  // SUBCLAUSES (1)
  // =====================================================

  const subClauses = normalized.split(
    /(?=\(\d+\))/
  );

  for (const clause of subClauses) {
    const clean = cleanClause(clause);

    if (isUsefulClause(clean)) {
      clauses.push(clean);
    }
  }

  // =====================================================
  // BULLETS
  // =====================================================

  const bulletClauses = normalized.split(
    /\n\s*[•*\-]\s+/g
  );

  for (const clause of bulletClauses) {
    const clean = cleanClause(clause);

    if (isUsefulClause(clean)) {
      clauses.push(clean);
    }
  }

  // =====================================================
  // OBLIGATION SENTENCES
  // =====================================================

  const obligationSentences = normalized.match(
    /[^.!\n]+(?:shall|must|will|agree(?:s|d)? to|required to)[^.!\n]*[.]/gi
  );

  if (obligationSentences) {
    for (const sentence of obligationSentences) {
      const clean = cleanClause(sentence);

      if (isUsefulClause(clean)) {
        clauses.push(clean);
      }
    }
  }

  // =====================================================
  // DEDUPLICATION
  // =====================================================

  return [...new Set(clauses)];
}

module.exports = {
  segmentClauses,
  normalizeText,
};
