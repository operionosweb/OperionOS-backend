export function extractObligations(clauses) {
  try {
    const obligations = [];

    clauses.forEach((clause) => {
      const sentences = clause.clause_text.split(".");

      sentences.forEach((sentence) => {
        const cleaned = sentence.trim();

        if (!cleaned) return;

        const lower = cleaned.toLowerCase();

        // obligation detection
        if (
          lower.includes("shall") ||
          lower.includes("must") ||
          lower.includes("will")
        ) {
          obligations.push({
            clause_id: clause.clause_number,
            obligation_text: cleaned,
            responsible_party: detectResponsibleParty(cleaned),
            obligation_type: detectObligationType(cleaned)
          });
        }
      });
    });

    return obligations;
  } catch (err) {
    console.error("OBLIGATION EXTRACTION FAILED:", err);
    return [];
  }
}

function detectResponsibleParty(text) {
  const lower = text.toLowerCase();

  if (lower.includes("club")) return "Club";
  if (lower.includes("lessor")) return "Lessor";

  return "Unknown";
}

function detectObligationType(text) {
  const lower = text.toLowerCase();

  if (
    lower.includes("pay") ||
    lower.includes("fee") ||
    lower.includes("tax")
  ) {
    return "payment";
  }

  if (
    lower.includes("maintain") ||
    lower.includes("repair")
  ) {
    return "maintenance";
  }

  if (
    lower.includes("terminate")
  ) {
    return "termination";
  }

  if (
    lower.includes("notify") ||
    lower.includes("notice")
  ) {
    return "notification";
  }

  return "general";
}
