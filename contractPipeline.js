function segmentClauses(text) {
  if (!text || typeof text !== "string") return [];

  const normalized = normalizeText(text);

  const allClauses = [];

  // -------------------------------
  // STEP 1: Split by major sections (A. B. C. ... or A) B) formats)
  // -------------------------------
  const sectionSplitRegex = /\n\s*[A-Z]\.\s|\n\s*[A-Z]\)\s/g;
  const sections = normalized.split(sectionSplitRegex);

  for (const section of sections) {
    if (!section || !section.trim()) continue;

    let workingSection = section.trim();

    // -------------------------------
    // STEP 2: Extract numbered clauses (1) (2) (3)
    // -------------------------------
    const numberedParts = workingSection.split(/(?=\(\d+\))/g);

    for (const part of numberedParts) {
      if (part && part.trim()) {
        allClauses.push(part.trim());
      }
    }

    // -------------------------------
    // STEP 3: Extract bullet points (*, •, -)
    // -------------------------------
    const bulletParts = workingSection.split(/\n\s*[\*\-•]\s/g);

    for (const b of bulletParts) {
      const clean = b.trim();
      if (!clean) continue;

      // avoid junk fragments
      if (clean.length < 8) continue;

      allClauses.push(clean);
    }
  }

  // -------------------------------
  // STEP 4: Global fallback extraction
  // (catches missed clauses outside A–H structure)
  // -------------------------------
  const fallbackNumbered = normalized.match(/\(\d+\)[^\(\)]*/g);
  if (fallbackNumbered) {
    for (const item of fallbackNumbered) {
      allClauses.push(item.trim());
    }
  }

  const fallbackBullets = normalized.match(/(?:^|\n)\s*[\*\-•]\s.*(?=\n|$)/g);
  if (fallbackBullets) {
    for (const item of fallbackBullets) {
      allClauses.push(item.replace(/^\s*[\*\-•]\s*/, "").trim());
    }
  }

  // -------------------------------
  // STEP 5: Clean + deduplicate
  // -------------------------------
  const cleaned = allClauses
    .map(c => c.replace(/\s+/g, " ").trim())
    .filter(c => c.length > 10);

  const unique = Array.from(new Set(cleaned));

  return unique;
}
