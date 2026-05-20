export async function extractObligations(clauses = []) {
  try {
    const obligations = [];

    for (const clause of clauses) {
      const text = clause.clause_text || "";
      const clauseName = clause.clause_name || "Unknown Clause";

      // Split into sentences
      const sentences = text
        .replace(/\n/g, " ")
        .split(/[.?!]/)
        .map((s) => s.trim())
        .filter(Boolean);

      for (const sentence of sentences) {
        const lower = sentence.toLowerCase();

        // Detect obligation language
        const isObligation =
          lower.includes("shall") ||
          lower.includes("must") ||
          lower.includes("required to") ||
          lower.includes("agrees to") ||
          lower.includes("will pay") ||
          lower.includes("is liable for");

        if (isObligation) {
          obligations.push({
            clause_name: clauseName,
            obligation_text: sentence,
            obligation_type: detectObligationType(sentence),
            priority: detectPriority(sentence),
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    return obligations;
  } catch (error) {
    console.error("Obligation extraction failed:", error);
    return [];
  }
}

function detectObligationType(text = "") {
  const lower = text.toLowerCase();

  if (
    lower.includes("pay") ||
    lower.includes("fee") ||
    lower.includes("tax") ||
    lower.includes("reimburse")
  ) {
    return "financial";
  }

  if (
    lower.includes("maintain") ||
    lower.includes("repair") ||
    lower.includes("inspection")
  ) {
    return "maintenance";
  }

  if (
    lower.includes("insurance") ||
    lower.includes("insured")
  ) {
    return "insurance";
  }

  if (
    lower.includes("terminate") ||
    lower.includes("notice")
  ) {
    return "termination";
  }

  return "general";
}

function detectPriority(text = "") {
  const lower = text.toLowerCase();

  if (
    lower.includes("immediately") ||
    lower.includes("within 30 days") ||
    lower.includes("termination")
  ) {
    return "high";
  }

  if (
    lower.includes("shall") ||
    lower.includes("must")
  ) {
    return "medium";
  }

  return "low";
}
