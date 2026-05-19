export function extractObligations(clauses = []) {
  const obligations = [];

  clauses.forEach((clause) => {
    const text = (
      clause.clause_text ||
      clause.clause_name ||
      ""
    ).toLowerCase();

    let obligationType = "general_obligation";
    let priority = "medium";

    /* =========================
       STEP 1: OBLIGATION INTENT DETECTION
       (CRITICAL FIX)
    ========================= */

    const isObligation =
      text.includes("shall") ||
      text.includes("must") ||
      text.includes("agrees") ||
      text.includes("will") ||
      text.includes("required") ||
      text.includes("responsible") ||
      text.includes("liable") ||
      text.includes("not be") ||
      text.includes("prohibited");

    if (!isObligation) {
      return; // truly non-obligational clauses
    }

    /* =========================
       STEP 2: CLASSIFICATION
    ========================= */

    if (
      text.includes("payment") ||
      text.includes("rent") ||
      text.includes("fee") ||
      text.includes("charges") ||
      text.includes("reimburse") ||
      text.includes("cost")
    ) {
      obligationType = "financial";
      priority = "high";
    }

    if (
      text.includes("maintenance") ||
      text.includes("repair") ||
      text.includes("inspection") ||
      text.includes("service")
    ) {
      obligationType = "maintenance";
      priority = "high";
    }

    if (
      text.includes("insurance") ||
      text.includes("liability") ||
      text.includes("deductible")
    ) {
      obligationType = "insurance";
    }

    if (
      text.includes("not be used") ||
      text.includes("shall not") ||
      text.includes("prohibited") ||
      text.includes("restricted")
    ) {
      obligationType = "operational_restriction";
      priority = "high";
    }

    if (
      text.includes("license") ||
      text.includes("certificate") ||
      text.includes("rated") ||
      text.includes("medical") ||
      text.includes("regulation")
    ) {
      obligationType = "compliance";
      priority = "critical";
    }

    if (
      text.includes("return") ||
      text.includes("redelivery") ||
      text.includes("scheduled time")
    ) {
      obligationType = "redelivery";
      priority = "critical";
    }

    /* =========================
       STEP 3: SAVE (ALWAYS TRUE OBLIGATIONS)
    ========================= */

    obligations.push({
      contract_id: clause.contract_id,
      clause_id: clause.id,
      obligation_type: obligationType,
      priority,
      description: clause.clause_text || clause.clause_name || "",
      status: "open",
    });
  });

  return obligations;
}
