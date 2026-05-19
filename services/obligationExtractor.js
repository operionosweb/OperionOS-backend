export function extractObligations(clauses = []) {
  const obligations = [];

  const matchAny = (text, keywords) =>
    keywords.some((k) => text.includes(k));

  clauses.forEach((clause) => {
    const text = (clause.clause_text || "").toLowerCase();

    const detected = new Set();
    let priority = "low";

    // =========================
    // FINANCIAL OBLIGATIONS
    // =========================
    if (
      matchAny(text, [
        "fee",
        "fees",
        "charge",
        "charges",
        "rent",
        "payment",
        "pay",
        "liable",
        "on demand",
        "cost",
        "invoice",
        "rates",
      ])
    ) {
      detected.add("financial");
      priority = "high";
    }

    // =========================
    // MAINTENANCE / AIRCRAFT CONDITION
    // =========================
    if (
      matchAny(text, [
        "maintenance",
        "repair",
        "airworthy",
        "mechanical",
        "breakdown",
        "inspection",
        "overhaul",
      ])
    ) {
      detected.add("maintenance");
      priority = "high";
    }

    // =========================
    // INSURANCE / LIABILITY (CRITICAL)
    // =========================
    if (
      matchAny(text, [
        "insurance",
        "liability",
        "deductible",
        "bodily injury",
        "coverage",
        "occurrence",
        "physical damage",
        "policy",
      ])
    ) {
      detected.add("insurance");
      priority = "critical";
    }

    // =========================
    // OPERATIONAL / FLIGHT RULES
    // =========================
    if (
      matchAny(text, [
        "pilot",
        "flight",
        "vfr",
        "ifr",
        "weather",
        "airport",
        "take-off",
        "landing",
        "operate",
        "aircraft",
        "command",
      ])
    ) {
      detected.add("operational");
      if (priority !== "critical") priority = "medium";
    }

    // =========================
    // REDELIVERY / RETURN OBLIGATIONS
    // =========================
    if (
      matchAny(text, [
        "return",
        "returned",
        "home base",
        "abandoned",
        "scheduled time",
        "reimburse",
        "expenses",
      ])
    ) {
      detected.add("redelivery");
      priority = "critical";
    }

    // =========================
    // OUTPUT
    // =========================
    if (detected.size > 0) {
      obligations.push({
        contract_id: clause.contract_id || null,
        clause_id: clause.id || null,
        obligation_type: Array.from(detected).join("+"),
        priority,
        description: clause.clause_text,
        status: "open",
      });
    }
  });

  return obligations;
}
