export function extractObligations(clauses = []) {
  if (!Array.isArray(clauses)) return [];

  const obligations = [];

  for (const clause of clauses) {
    const text = (clause?.clause_text || "").toLowerCase();

    if (!text) continue;

    let obligationType = null;
    let priority = "medium";

    // FINANCIAL
    if (
      /fee|charges|rent|liable to pay|on demand|cost|payment/.test(text)
    ) {
      obligationType = "financial";
      priority = "high";
    }

    // MAINTENANCE / AIRWORTHINESS
    if (
      /maintenance|repair|airworthy|mechanical|breakdown/.test(text)
    ) {
      obligationType = obligationType || "maintenance";
      priority = "high";
    }

    // INSURANCE (CRITICAL)
    if (
      /insurance|liability|deductible|bodily injury|coverage|occurrence|physical damage/.test(text)
    ) {
      obligationType = "insurance";
      priority = "critical";
    }

    // OPERATIONAL SAFETY
    if (
      /pilot|flight|vfr|ifr|weather|airport|take-off|landing/.test(text)
    ) {
      obligationType = obligationType || "operational";
    }

    // RETURN / REDELIVERY
    if (
      /return|home base|abandoned|scheduled time/.test(text)
    ) {
      obligationType = obligationType || "redelivery";
      priority = "critical";
    }

    if (obligationType) {
      obligations.push({
        contract_id: clause.contract_id || null,
        clause_id: clause.id,
        obligation_type: obligationType,
        priority,
        description: clause.clause_text,
        status: "open",
      });
    }
  }

  return obligations;
}
