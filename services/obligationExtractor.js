export function extractObligations(clauses = []) {
  const obligations = [];

  clauses.forEach((clause) => {
    const text = (
      clause.clause_text ||
      clause.clause_name ||
      ""
    ).toLowerCase();

    let obligationType = null;
    let priority = "medium";

    /* =========================
       IMPORTANT: NO EARLY RETURN
       (we evaluate ALL clauses)
    ========================= */

    /* =========================
       PAYMENT / FINANCIAL
    ========================= */

    if (
      text.includes("payment") ||
      text.includes("rent") ||
      text.includes("fee") ||
      text.includes("charges") ||
      text.includes("cost") ||
      text.includes("reimburse") ||
      text.includes("charged") ||
      text.includes("liable") ||
      text.includes("liability")
    ) {
      obligationType = "financial";
      priority = "high";
    }

    /* =========================
       MAINTENANCE / TECHNICAL
    ========================= */

    if (
      text.includes("maintenance") ||
      text.includes("repair") ||
      text.includes("inspection") ||
      text.includes("overhaul") ||
      text.includes("service") ||
      text.includes("mechanical")
    ) {
      obligationType = "maintenance";
      priority = "high";
    }

    /* =========================
       OPERATIONAL RESTRICTIONS
    ========================= */

    if (
      text.includes("not be used") ||
      text.includes("shall not") ||
      text.includes("prohibited") ||
      text.includes("restricted") ||
      text.includes("outside") ||
      text.includes("illegal") ||
      text.includes("authorized") === false
    ) {
      obligationType = "operational_restriction";
      priority = "high";
    }

    /* =========================
       COMPLIANCE / CERTIFICATION
    ========================= */

    if (
      text.includes("certificate") ||
      text.includes("certified") ||
      text.includes("license") ||
      text.includes("medical") ||
      text.includes("regulation") ||
      text.includes("compliance") ||
      text.includes("rated")
    ) {
      obligationType = "compliance";
      priority = "critical";
    }

    /* =========================
       INSURANCE / LIABILITY
    ========================= */

    if (
      text.includes("insurance") ||
      text.includes("liability") ||
      text.includes("deductible") ||
      text.includes("coverage")
    ) {
      obligationType = "insurance";
    }

    /* =========================
       RETURN / REDELIVERY
    ========================= */

    if (
      text.includes("return") ||
      text.includes("redelivery") ||
      text.includes("scheduled time") ||
      text.includes("return the aircraft")
    ) {
      obligationType = "redelivery";
      priority = "critical";
    }

    /* =========================
       GENERAL OBLIGATION DETECTION
       (KEY FIX — ENSURES COVERAGE)
    ========================= */

    const hasLegalVerb =
      text.includes("shall") ||
      text.includes("must") ||
      text.includes("agrees") ||
      text.includes("will");

    if (!obligationType && hasLegalVerb) {
      obligationType = "general_obligation";
      priority = "medium";
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
        description:
          clause.clause_text ||
          clause.clause_name ||
          "",
        status: "open",
      });
    }
  });

  return obligations;
}
