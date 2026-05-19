export function extractObligations(clauses = []) {
  const obligations = [];

  clauses.forEach((clause) => {
    const text = (clause.clause_text || "").toLowerCase();

    const types = [];
    let priority = "low";

    // =========================
    // FINANCIAL OBLIGATIONS
    // =========================
    const financialKeywords = [
      "fee",
      "fees",
      "charges",
      "charge",
      "rent",
      "payment",
      "pay",
      "liable to pay",
      "on demand",
      "cost",
      "invoice",
    ];

    if (financialKeywords.some((k) => text.includes(k))) {
      types.push("financial");
      priority = "high";
    }

    // =========================
    // MAINTENANCE / AIRWORTHINESS
    // =========================
    const maintenanceKeywords = [
      "maintenance",
      "repair",
      "airworthy",
      "mechanical condition",
      "breakdown",
      "inspection",
      "overhaul",
    ];

    if (maintenanceKeywords.some((k) => text.includes(k))) {
      types.push("maintenance");
      priority = Math.max(priority === "critical" ? 3 : priority === "high" ? 2 : 1, 2)
        ? "high"
        : "medium";
    }

    // =========================
    // INSURANCE (HIGHEST PRIORITY DOMAIN)
    // =========================
    const insuranceKeywords = [
      "insurance",
      "liability",
      "deductible",
      "bodily injury",
      "coverage",
      "occurrence",
      "physical damage",
      "policy",
    ];

    if (insuranceKeywords.some((k) => text.includes(k))) {
      types.push("insurance");
      priority = "critical";
    }

    // =========================
    // OPERATIONAL / SAFETY
    // =========================
    const operationalKeywords = [
      "pilot",
      "flight",
      "vfr",
      "ifr",
      "weather",
      "airport",
      "take-off",
      "landing",
      "operations",
      "aircraft",
    ];

    if (operationalKeywords.some((k) => text.includes(k))) {
      types.push("operational");
      if (priority !== "critical") priority = "medium";
    }

    // =========================
    // REDELIVERY / RETURN
    // =========================
    const redeliveryKeywords = [
      "return",
      "returned",
      "home base",
      "abandoned",
      "scheduled time",
      "re-delivery",
    ];

    if (redeliveryKeywords.some((k) => text.includes(k))) {
      types.push("redelivery");
      priority = "critical";
    }

    // =========================
    // OUTPUT (ONE OR MULTI TYPE)
    // =========================
    if (types.length > 0) {
      obligations.push({
        contract_id: clause.contract_id || null,
        clause_id: clause.id || null,
        obligation_type: types.join("+"), // supports multi-label like "insurance+financial"
        priority,
        description: clause.clause_text,
        status: "open",
      });
    }
  });

  return obligations;
}
