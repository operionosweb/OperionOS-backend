export function extractObligations(clauses = []) {
  const obligations = [];

  clauses.forEach((clause) => {
    const text = (clause.clause_text || "").toLowerCase();

    let obligationType = null;
    let priority = "medium";

    // FINANCIAL
    if (
      text.includes("fee") ||
      text.includes("charges") ||
      text.includes("rent") ||
      text.includes("liable to pay") ||
      text.includes("on demand")
    ) {
      obligationType = "financial";
      priority = "high";
    }

    // MAINTENANCE / AIRWORTHINESS
    if (
      text.includes("maintenance") ||
      text.includes("repair") ||
      text.includes("airworthy") ||
      text.includes("mechanical condition") ||
      text.includes("breakdown")
    ) {
      obligationType = "maintenance";
      priority = "high";
    }

    // INSURANCE (IMPORTANT FIX)
    if (
      text.includes("insurance") ||
      text.includes("liability") ||
      text.includes("deductible") ||
      text.includes("bodily injury") ||
      text.includes("coverage") ||
      text.includes("occurrence") ||
      text.includes("physical damage")
    ) {
      obligationType = "insurance";
      priority = "critical";
    }

    // OPERATIONAL SAFETY
    if (
      text.includes("pilot") ||
      text.includes("flight") ||
      text.includes("vfr") ||
      text.includes("ifr") ||
      text.includes("weather") ||
      text.includes("airport") ||
      text.includes("take-off") ||
      text.includes("landing")
    ) {
      obligationType = obligationType || "operational";
    }

    // RETURN / REDELIVERY
    if (
      text.includes("return") ||
      text.includes("home base") ||
      text.includes("abandoned") ||
      text.includes("scheduled time")
    ) {
      obligationType = obligationType || "redelivery";
      priority = "critical";
    }

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
