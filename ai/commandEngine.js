export function interpretCommand(input, fleetData, actions) {

  const text = (input || "").toLowerCase().trim();

  /* ===============================
     CENTRALIZED RISK MODEL
  =============================== */

  const enrichFleet = fleetData.map(f => {

    let score = f.failure || 0;

    let level = "LOW";

    if (score > 75) level = "CRITICAL";
    else if (score > 50) level = "HIGH";
    else if (score > 30) level = "MEDIUM";

    return {
      ...f,
      riskLevel: level
    };

  });

  /* ===============================
     CRITICAL INTENT
  =============================== */

  if (
    text.includes("critical") ||
    text.includes("urgent") ||
    text.includes("danger")
  ) {

    const critical = enrichFleet.filter(
      f => f.riskLevel === "CRITICAL"
    );

    return {
      intent: "CRITICAL_ANALYSIS",
      summary: "Critical risk aircraft identified across fleet.",
      recommendation: "Immediate grounding and inspection required.",
      data: critical
    };
  }

  /* ===============================
     MAINTENANCE INTENT
  =============================== */

  if (
    text.includes("maintenance") ||
    text.includes("repair")
  ) {

    const maintenance = actions.filter(
      a => a.type?.includes("MAINTENANCE")
    );

    return {
      intent: "MAINTENANCE_PLANNING",
      summary: "Maintenance tasks extracted from operational engine.",
      recommendation: "Prioritize high-risk scheduled maintenance tasks.",
      data: maintenance
    };
  }

  /* ===============================
     RISK INTENT
  =============================== */

  if (
    text.includes("risk") ||
    text.includes("warning")
  ) {

    const risk = enrichFleet.filter(
      f => f.riskLevel !== "LOW"
    );

    return {
      intent: "RISK_ANALYSIS",
      summary: "Operational risk distribution across fleet.",
      recommendation: "Monitor medium and high-risk aircraft.",
      data: risk
    };
  }

  /* ===============================
     SUMMARY INTENT
  =============================== */

  if (text.includes("summary")) {

    const avg =
      enrichFleet.reduce((s, f) => s + f.failure, 0) /
      (enrichFleet.length || 1);

    return {
      intent: "FLEET_SUMMARY",
      summary: "Fleet-wide operational health overview.",
      recommendation:
        avg > 60
          ? "Fleet risk elevated — increase maintenance capacity."
          : "Fleet operating within safe thresholds.",
      data: [
        {
          metric: "average_failure",
          value: Math.round(avg)
        }
      ]
    };
  }

  /* ===============================
     DEFAULT HELP
  =============================== */

  return {
    intent: "ASSISTANT_HELP",
    summary: "I can analyze fleet risk, maintenance, or critical alerts.",
    recommendation:
      "Try: 'critical aircraft', 'maintenance status', 'fleet summary'.",
    data: enrichFleet
  };
}
