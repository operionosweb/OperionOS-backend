export async function extractObligations(text) {
  try {
    if (!text || typeof text !== "string") {
      return [];
    }

    const obligationPatterns = [
      /\bshall\b/gi,
      /\bmust\b/gi,
      /\bagrees to\b/gi,
      /\brequired to\b/gi,
      /\bwill\b/gi
    ];

    const sentences = text
      .replace(/\n/g, " ")
      .split(/[.?!]/)
      .map(s => s.trim())
      .filter(Boolean);

    const obligations = [];

    for (const sentence of sentences) {
      const isObligation = obligationPatterns.some(pattern =>
        pattern.test(sentence)
      );

      if (!isObligation) continue;

      let responsibleParty = "Unknown";

      if (/club/i.test(sentence)) {
        responsibleParty = "Club";
      } else if (/lessor/i.test(sentence)) {
        responsibleParty = "Lessor";
      }

      let triggerType = "general";

      if (/pay|payment|fee|cost|invoice/i.test(sentence)) {
        triggerType = "payment";
      } else if (/insurance/i.test(sentence)) {
        triggerType = "insurance";
      } else if (/maintain|maintenance|repair/i.test(sentence)) {
        triggerType = "maintenance";
      } else if (/terminate|termination/i.test(sentence)) {
        triggerType = "termination";
      }

      let riskLevel = "low";

      if (/penalty|liable|violation|breach/i.test(sentence)) {
        riskLevel = "high";
      } else if (/shall|must/i.test(sentence)) {
        riskLevel = "medium";
      }

      obligations.push({
        obligation_text: sentence,
        responsible_party: responsibleParty,
        trigger_type: triggerType,
        risk_level: riskLevel
      });
    }

    return obligations;

  } catch (error) {
    console.error("Obligation extraction failed:", error);
    return [];
  }
}
