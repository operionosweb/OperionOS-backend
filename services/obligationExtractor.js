export function extractObligations(clauses = []) {
  const obligations = [];

  clauses.forEach((clause) => {
    const text = (clause.clause_text || "").toLowerCase();

    let obligationType = null;
    let priority = "medium";

    /* =========================
       PAYMENT OBLIGATIONS
    ========================= */

    if (
      text.includes("payment") ||
      text.includes("rent") ||
      text.includes("maintenance reserve")
    ) {
      obligationType = "financial";
      priority = "high";
    }

    /* =========================
       MAINTENANCE OBLIGATIONS
    ========================= */

    if (
      text.includes("maintenance") ||
      text.includes("overhaul") ||
      text.includes("inspection")
    ) {
      obligationType = "maintenance";
      priority = "high";
    }

    /* =========================
       LLP OBLIGATIONS
    ========================= */

    if (
      text.includes("life limited part") ||
      text.includes("llp")
    ) {
      obligationType = "llp";
      priority = "critical";
    }

    /* =========================
       INSURANCE OBLIGATIONS
    ========================= */

    if (
      text.includes("insurance") ||
      text.includes("liability coverage")
    ) {
      obligationType = "insurance";
    }

    /* =========================
       RETURN CONDITIONS
    ========================= */

    if (
      text.includes("redelivery") ||
      text.includes("return condition")
    ) {
      obligationType = "redelivery";
      priority = "critical";
    }

    /* =========================
       SAVE OBLIGATION
    ========================= */

    if (obligationType) {
      obligations.push({
        contract_id: clause.contract_id,
        clause_id: clause.id,
        obligation_type: obligationType,
        priority,
        description: clause.clause_text,
        status: "open",
      });
    }
  });

  return obligations;
}
