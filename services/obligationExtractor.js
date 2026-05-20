// ============================================
// ADVANCED OBLIGATION EXTRACTION ENGINE
// ============================================

export function extractObligations(clauses) {
  const obligations = [];

  for (const clause of clauses) {
    const text = clause.clause_text || "";

    // Clean formatting
    const normalizedText = text
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Split into legal sentences
    const sentences = normalizedText.match(/[^.!?]+[.!?]+/g) || [];

    for (const sentence of sentences) {
      const cleanSentence = sentence.trim();

      // Ignore very short garbage
      if (cleanSentence.length < 25) continue;

      // Detect legal obligation language
      const obligationPatterns = [
        /\bshall\b/i,
        /\bmust\b/i,
        /\bwill\b/i,
        /\bagrees?\s+to\b/i,
        /\bis required to\b/i,
        /\bare required to\b/i,
      ];

      const isObligation = obligationPatterns.some((pattern) =>
        pattern.test(cleanSentence)
      );

      if (!isObligation) continue;

      // ============================================
      // RESPONSIBLE PARTY DETECTION
      // ============================================

      let responsibleParty = "Unknown";

      if (
        /\bClub\b/i.test(cleanSentence) &&
        !/\bLessor\b/i.test(cleanSentence)
      ) {
        responsibleParty = "Club";
      } else if (
        /\bLessor\b/i.test(cleanSentence) &&
        !/\bClub\b/i.test(cleanSentence)
      ) {
        responsibleParty = "Lessor";
      } else if (
        /\bEither party\b/i.test(cleanSentence)
      ) {
        responsibleParty = "Either Party";
      } else if (
        /\bboth parties\b/i.test(cleanSentence)
      ) {
        responsibleParty = "Both Parties";
      }

      // ============================================
      // OBLIGATION TYPE DETECTION
      // ============================================

      let obligationType = "general";

      if (
        /\bpay\b|\bpayment\b|\bfee\b|\bcost\b|\btax\b|\breimburse\b/i.test(
          cleanSentence
        )
      ) {
        obligationType = "payment";
      } else if (
        /\binsurance\b|\binsured\b|\bcoverage\b/i.test(cleanSentence)
      ) {
        obligationType = "insurance";
      } else if (
        /\bmaintain\b|\brepair\b|\boverhaul\b|\bservice\b/i.test(
          cleanSentence
        )
      ) {
        obligationType = "maintenance";
      } else if (
        /\bterminate\b|\btermination\b|\breturn\b/i.test(cleanSentence)
      ) {
        obligationType = "termination";
      } else if (
        /\bnotify\b|\bnotice\b/i.test(cleanSentence)
      ) {
        obligationType = "notification";
      } else if (
        /\bcomply\b|\bregulation\b|\bgovernmental\b/i.test(cleanSentence)
      ) {
        obligationType = "compliance";
      }

      // ============================================
      // CLEAN OBLIGATION TEXT
      // ============================================

      const cleanedObligation = cleanSentence
        .replace(/\s+/g, " ")
        .trim();

      // Avoid duplicates
      const alreadyExists = obligations.some(
        (o) =>
          o.obligation_text === cleanedObligation &&
          o.clause_id === clause.clause_number
      );

      if (alreadyExists) continue;

      obligations.push({
        clause_id: clause.clause_number,
        clause_title: clause.clause_title,
        obligation_text: cleanedObligation,
        responsible_party: responsibleParty,
        obligation_type: obligationType,
      });
    }
  }

  return obligations;
}
