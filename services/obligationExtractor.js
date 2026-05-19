export function extractObligations(clauses = []) {
  const obligations = [];

  clauses.forEach((clause) => {
    const text = (clause.clause_text || "").toLowerCase();

    let obligationType = null;
    let priority = "medium";

    /* =========================
       CORE OBLIGATION SIGNALS
       (IMPORTANT ADDITION)
    ========================= */

    const hasObligationLanguage =
      text.includes("shall") ||
      text.includes("must") ||
      text.includes("agrees") ||
      text.includes("will") ||
      text.includes("required") ||
      text.includes("responsible for");

    if (!hasObligationLanguage) {
      return; // skip non-obligations early
    }

    /* =========================
       PAYMENT OBLIGATIONS
    ========================= */

    if (
      text.includes("payment") ||
      text.includes("rent") ||
      text.includes("maintenance reserve") ||
      text.includes("fee") ||
      text.includes("charges") ||
      text.includes("cost") ||
      text.includes("reimburse")
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
      text.includes("inspection") ||
      text.includes("repair") ||
      text.includes("service")
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
      text.includes("liability coverage") ||
      text.includes("deductible")
    ) {
      obligationType = "insurance";
    }

    /* =========================
       OPERATIONAL / USAGE RESTRICTIONS
    ========================= */

    if (
      text.includes("not be used") ||
      text.includes("not operate") ||
      text.includes("prohibited") ||
      text.includes("shall not") ||
      text.includes("outside") ||
      text.includes("restricted")
    ) {
      obligationType = "operational_restriction";
      priority = "high";
    }

    /* =========================
       SAFETY / COMPLIANCE
    ========================= */

    if (
      text.includes("certified") ||
      text.includes("license") ||
      text.includes("medical") ||
      text.includes("regulation") ||
      text.includes("compliance")
    ) {
      obligationType = "compliance";
      priority = "critical";
    }

    /* =========================
       RETURN / REDELIVERY
    ========================= */

    if (
      text.includes("return") ||
      text.includes("redelivery") ||
      text.includes("return condition") ||
      text.includes("scheduled time")
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
