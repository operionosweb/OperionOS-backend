export function extractObligations(clauses = []) {
  const obligations = [];

  // Better obligation trigger detection
  const obligationPatterns = [
    /\bshall\b/i,
    /\bmust\b/i,
    /\bwill\b/i,
    /\bagrees?\s+to\b/i,
    /\bis required to\b/i,
    /\bare required to\b/i
  ];

  // Detect responsible party
  function detectResponsibleParty(text) {
    const lower = text.toLowerCase();

    if (lower.includes("club shall") || lower.includes("the club shall")) {
      return "Club";
    }

    if (lower.includes("lessor shall") || lower.includes("the lessor shall")) {
      return "Lessor";
    }

    if (lower.includes("either party")) {
      return "Either Party";
    }

    if (lower.includes("both parties")) {
      return "Both Parties";
    }

    if (lower.includes("owner shall")) {
      return "Owner";
    }

    return "Unknown";
  }

  // Better obligation type classification
  function classifyObligation(text, clauseType) {
    const lower = text.toLowerCase();

    if (
      lower.includes("pay") ||
      lower.includes("fee") ||
      lower.includes("cost") ||
      lower.includes("tax") ||
      lower.includes("reimburse")
    ) {
      return "payment";
    }

    if (
      lower.includes("maintain") ||
      lower.includes("repair") ||
      lower.includes("service") ||
      lower.includes("inspection")
    ) {
      return "maintenance";
    }

    if (
      lower.includes("terminate") ||
      lower.includes("termination") ||
      lower.includes("return")
    ) {
      return "termination";
    }

    if (
      lower.includes("notify") ||
      lower.includes("notice")
    ) {
      return "notification";
    }

    if (
      lower.includes("comply") ||
      lower.includes("regulation") ||
      lower.includes("governmental")
    ) {
      return "compliance";
    }

    return clauseType || "general";
  }

  for (const clause of clauses) {
    const text = clause.clause_text || "";

    // Split into sentences more intelligently
    const sentences = text
      .replace(/\n/g, " ")
      .split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
      const cleanedSentence = sentence.trim();

      if (!cleanedSentence || cleanedSentence.length < 20) {
        continue;
      }

      const isObligation = obligationPatterns.some((pattern) =>
        pattern.test(cleanedSentence)
      );

      if (!isObligation) {
        continue;
      }

      // Avoid obvious false positives
      if (
        cleanedSentence.toLowerCase().includes("shall not affect") ||
        cleanedSentence.toLowerCase().includes("shall not be construed")
      ) {
        continue;
      }

      obligations.push({
        clause_id: clause.clause_number,
        clause_title: clause.clause_title,
        obligation_text: cleanedSentence,
        responsible_party: detectResponsibleParty(cleanedSentence),
        obligation_type: classifyObligation(
          cleanedSentence,
          clause.clause_type
        ),
      });
    }
  }

  return obligations;
}
