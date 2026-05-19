export function extractObligations(clauses = []) {
  const obligations = [];

  // 🔧 SAFETY: ensure array input
  if (!Array.isArray(clauses)) {
    console.warn("extractObligations expected array but got:", typeof clauses);
    return obligations;
  }

  clauses.forEach((clause) => {
    const text = ((clause?.clause_text || "") + "").toLowerCase().trim();

    if (!text) return;

    let obligationType = null;
    let priority = "medium";

    // -------------------------
    // FINANCIAL OBLIGATIONS
    // -------------------------
    if (
      text.includes("fee") ||
      text.includes("fees") ||
      text.includes("charge") ||
      text.includes("charges") ||
      text.includes("rent") ||
      text.includes("payment") ||
      text.includes("pay") ||
      text.includes("liable to pay") ||
      text.includes("on demand") ||
      text.includes("cost") ||
      text.includes("expense")
    ) {
      obligationType = "financial";
      priority = "high";
    }

    // -------------------------
    // MAINTENANCE / AIRWORTHINESS
    // -------------------------
    if (
      text.includes("maintenance") ||
      text.includes("repair") ||
      text.includes("repairs") ||
      text.includes("airworthy") ||
      text.includes("mechanical") ||
      text.includes("breakdown") ||
      text.includes("service")
    ) {
      obligationType = obligationType || "maintenance";
      priority = "high";
    }

    // -------------------------
    // INSURANCE
    // -------------------------
    if (
      text.includes("insurance") ||
      text.includes("liability") ||
      text.includes("deductible") ||
      text.includes("bodily injury") ||
      text.includes("coverage") ||
      text.includes("insured") ||
      text.includes("occurrence") ||
      text.includes("physical damage")
    ) {
      obligationType = "insurance";
      priority = "critical";
    }

    // -------------------------
    // OPERATIONAL / SAFETY
    // -------------------------
    if (
      text.includes("pilot") ||
      text.includes("flight") ||
      text.includes("vfr") ||
      text.includes("ifr") ||
      text.includes("weather") ||
      text.includes("airport") ||
      text.includes("take-off") ||
      text.includes("landing") ||
      text.includes("operate") ||
      text.includes("operation")
    ) {
      obligationType = obligationType || "operational";
    }

    // -------------------------
    // RETURN / REDELIVERY
    // -------------------------
    if (
      text.includes("return") ||
      text.includes("return aircraft") ||
      text.includes("home base") ||
      text.includes("abandoned") ||
      text.includes("scheduled time")
    ) {
      obligationType = obligationType || "redelivery";
      priority = "critical";
    }

    // -------------------------
    // LEGAL / PENALTY
    // -------------------------
    if (
      text.includes("attorney") ||
      text.includes("lawsuit") ||
      text.includes("suit") ||
      text.includes("legal") ||
      text.includes("damages")
    ) {
      obligationType = obligationType || "legal";
      priority = "high";
    }

    if (obligationType) {
      obligations.push({
        contract_id: clause.contract_id || null,
        clause_id: clause.id || null,
        obligation_type: obligationType,
        priority,
        description: clause.clause_text || "",
        status: "open",
      });
    }
  });

  return obligations;
}
