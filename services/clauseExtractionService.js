// services/clauseExtractionService.js

function normalizeText(text) {
  if (!text) return "";

  return text
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/Page\s+\d+/gi, "")
    .trim();
}

function cleanClause(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

export function extractClauses(text) {
  const normalized = normalizeText(text);

  const clauses = [];

  // =====================================================
  // ARTICLE-BASED CONTRACTS
  // =====================================================

  const articleRegex =
    /(ARTICLE\s+\d+\s*[–—\-:]*[\s\S]*?)(?=ARTICLE\s+\d+\s*[–—\-:]|APPENDIX|$)/gi;

  const articleMatches = normalized.match(articleRegex);

  if (articleMatches) {
    for (const article of articleMatches) {
      const clean = cleanClause(article);

      if (clean.length > 40) {
        clauses.push(clean);
      }
    }
  }

  // =====================================================
  // LETTERED CLAUSES (A. B. C.)
  // =====================================================

  const letterRegex =
    /([A-Z]\.\s+[\s\S]*?)(?=\n[A-Z]\.\s+|$)/g;

  const letterMatches = normalized.match(letterRegex);

  if (letterMatches) {
    for (const clause of letterMatches) {
      const clean = cleanClause(clause);

      if (clean.length > 30) {
        clauses.push(clean);
      }
    }
  }

  // =====================================================
  // NUMBERED CLAUSES (1. 2. 3.)
  // =====================================================

  const numberedRegex =
    /(\(?\d+\)?[.)]?\s+[\s\S]*?)(?=\n\(?\d+\)?[.)]?\s+|$)/g;

  const numberedMatches = normalized.match(numberedRegex);

  if (numberedMatches) {
    for (const clause of numberedMatches) {
      const clean = cleanClause(clause);

      if (clean.length > 30) {
        clauses.push(clean);
      }
    }
  }

  // =====================================================
  // BULLET CLAUSES (* • -)
  // =====================================================

  const bulletRegex =
    /([•*\-]\s+[\s\S]*?)(?=\n[•*\-]\s+|$)/g;

  const bulletMatches = normalized.match(bulletRegex);

  if (bulletMatches) {
    for (const clause of bulletMatches) {
      const clean = cleanClause(clause);

      if (clean.length > 30) {
        clauses.push(clean);
      }
    }
  }

  // =====================================================
  // FALLBACK: SPLIT LARGE PARAGRAPHS
  // =====================================================

  if (clauses.length < 10) {
    const paragraphs = normalized.split(/\n\s*\n/);

    for (const p of paragraphs) {
      const clean = cleanClause(p);

      if (clean.length > 80) {
        clauses.push(clean);
      }
    }
  }

  // =====================================================
  // REMOVE DUPLICATES
  // =====================================================

  const uniqueClauses = [...new Set(clauses)];

  // =====================================================
  // RETURN STRUCTURED CLAUSES
  // =====================================================

  return uniqueClauses.map((clause, index) => ({
    clause_number: index + 1,
    clause_title: clause.substring(0, 80),
    clause_text: clause,
    clause_type: detectClauseType(clause)
  }));
}

function detectClauseType(text) {
  const lower = text.toLowerCase();

  if (
    lower.includes("payment") ||
    lower.includes("fee") ||
    lower.includes("invoice") ||
    lower.includes("tax")
  ) {
    return "financial";
  }

  if (
    lower.includes("terminate") ||
    lower.includes("termination")
  ) {
    return "termination";
  }

  if (
    lower.includes("insurance") ||
    lower.includes("liability")
  ) {
    return "liability";
  }

  if (
    lower.includes("maintenance") ||
    lower.includes("repair")
  ) {
    return "maintenance";
  }

  if (
    lower.includes("notice")
  ) {
    return "notice";
  }

  if (
    lower.includes("assignment")
  ) {
    return "assignment";
  }

  if (
    lower.includes("confidential")
  ) {
    return "confidentiality";
  }

  return "general";
}
