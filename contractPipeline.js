function segmentClauses(text) {
  if (!text || typeof text !== "string") return [];

  const normalized = normalizeText(text);

  const allClauses = [];

  // ------------------------------------
  // STEP 1: Extract SECTION blocks A–H
  // ------------------------------------
  const sectionRegex = /([A-H]\.)\s/g;
  const parts = normalized.split(sectionRegex);

  // We reconstruct proper sections (split removes markers)
  const sections = [];

  for (let i = 1; i < parts.length; i += 2) {
    const sectionHeader = parts[i];
    const sectionBody = parts[i + 1] || "";
    sections.push(sectionHeader + sectionBody);
  }

  // ------------------------------------
  // STEP 2: Process each section
  // ------------------------------------
  for (const section of sections) {
    if (!section || !section.trim()) continue;

    const sectionText = section.trim();

    // ------------------------------------
    // STEP 3: Extract numbered clauses (1)-(99)
    // ------------------------------------
    const numberedClauses = sectionText.match(/\(\d+\)[\s\S]*?(?=\(\d+\)|$)/g);

    if (numberedClauses) {
      for (const clause of numberedClauses) {
        const clean = clause.trim();
        if (clean.length > 5) {
          allClauses.push(clean);
        }
      }
    }

    // ------------------------------------
    // STEP 4: Extract bullet clauses (*, •, -)
    // ------------------------------------
    const bulletClauses = sectionText.match(/(?:^|\n)\s*[\*\-•]\s.*(?=\n|$)/g);

    if (bulletClauses) {
      for (const bullet of bulletClauses) {
        const clean = bullet.replace(/^\s*[\*\-•]\s*/, "").trim();
        if (clean.length > 8) {
          allClauses.push(clean);
        }
      }
    }
  }

  // ------------------------------------
  // STEP 5: Global fallback (important)
  // ------------------------------------
  const fallbackNumbered = normalized.match(/\(\d+\)[^\n]+/g);
  if (fallbackNumbered) {
    for (const item of fallbackNumbered) {
      allClauses.push(item.trim());
    }
  }

  const fallbackBullets = normalized.match(/(?:^|\n)\s*[\*\-•]\s.+/g);
  if (fallbackBullets) {
    for (const item of fallbackBullets) {
      allClauses.push(item.replace(/^\s*[\*\-•]\s*/, "").trim());
    }
  }

  // ------------------------------------
  // STEP 6: CLEAN + DEDUPE (LAST STEP ONLY)
  // ------------------------------------
  const cleaned = allClauses
    .map(c => c.replace(/\s+/g, " ").trim())
    .filter(c => c.length > 10);

  const unique = [...new Set(cleaned)];

  return unique;
}
