// ======================================================
// OBLIGATION EXTRACTION ENGINE
// ======================================================

export async function extractObligations(clauses) {

  try {

    const obligations = [];

    // ======================================================
    // LOOP THROUGH CLAUSES
    // ======================================================

    for (const clause of clauses) {

      const clauseText =
        (clause.clause_text || "").toLowerCase();

      const clauseTitle =
        clause.clause_title || "Unknown Clause";

      // ======================================================
      // PAYMENT OBLIGATIONS
      // ======================================================

      if (
        clauseText.includes("pay") ||
        clauseText.includes("payment") ||
        clauseText.includes("fees") ||
        clauseText.includes("invoice")
      ) {

        obligations.push({

          clause_title: clauseTitle,

          obligation_type: "payment",

          responsible_party:
            detectResponsibleParty(clauseText),

          obligation_text:
            "Financial payment obligation detected",

          priority: "HIGH",

          deadline:
            extractDeadline(clauseText),

          risk_level: "HIGH"
        });
      }

      // ======================================================
      // NOTICE OBLIGATIONS
      // ======================================================

      if (
        clauseText.includes("notice") ||
        clauseText.includes("notify") ||
        clauseText.includes("written notice")
      ) {

        obligations.push({

          clause_title: clauseTitle,

          obligation_type: "notice",

          responsible_party:
            detectResponsibleParty(clauseText),

          obligation_text:
            "Notice obligation detected",

          priority: "MEDIUM",

          deadline:
            extractDeadline(clauseText),

          risk_level: "MEDIUM"
        });
      }

      // ======================================================
      // INSURANCE OBLIGATIONS
      // ======================================================

      if (
        clauseText.includes("insurance") ||
        clauseText.includes("insured")
      ) {

        obligations.push({

          clause_title: clauseTitle,

          obligation_type: "insurance",

          responsible_party:
            detectResponsibleParty(clauseText),

          obligation_text:
            "Insurance obligation detected",

          priority: "HIGH",

          deadline: null,

          risk_level: "HIGH"
        });
      }

      // ======================================================
      // MAINTENANCE OBLIGATIONS
      // ======================================================

      if (
        clauseText.includes("maintain") ||
        clauseText.includes("maintenance") ||
        clauseText.includes("repair")
      ) {

        obligations.push({

          clause_title: clauseTitle,

          obligation_type: "maintenance",

          responsible_party:
            detectResponsibleParty(clauseText),

          obligation_text:
            "Maintenance obligation detected",

          priority: "MEDIUM",

          deadline: null,

          risk_level: "MEDIUM"
        });
      }

      // ======================================================
      // COMPLIANCE OBLIGATIONS
      // ======================================================

      if (
        clauseText.includes("compliance") ||
        clauseText.includes("regulation") ||
        clauseText.includes("law")
      ) {

        obligations.push({

          clause_title: clauseTitle,

          obligation_type: "compliance",

          responsible_party:
            detectResponsibleParty(clauseText),

          obligation_text:
            "Compliance obligation detected",

          priority: "HIGH",

          deadline: null,

          risk_level: "HIGH"
        });
      }
    }

    // ======================================================
    // RETURN RESULTS
    // ======================================================

    return obligations;

  } catch (err) {

    console.error(
      "❌ OBLIGATION ENGINE FAILED"
    );

    console.error(err);

    return [];
  }
}

// ======================================================
// RESPONSIBLE PARTY DETECTION
// ======================================================

function detectResponsibleParty(text) {

  if (text.includes("lessor")) {
    return "Lessor";
  }

  if (text.includes("club")) {
    return "Club";
  }

  if (text.includes("party")) {
    return "Both Parties";
  }

  return "Unknown";
}

// ======================================================
// DEADLINE EXTRACTION
// ======================================================

function extractDeadline(text) {

  const regex =
    /(\d+)\s+days/gi;

  const match =
    text.match(regex);

  if (match && match.length > 0) {
    return match[0];
  }

  return null;
}
