export function interpretCommand(input, fleetData, actions) {

  const text = (input || "").toLowerCase().trim();

  /* ===============================
     RESPONSE TEMPLATE
  =============================== */

  const response = {
    intent: "UNKNOWN",
    summary: "",
    recommendation: "",
    data: []
  };

  /* ===============================
     1. CRITICAL INTENT
  =============================== */

  const criticalKeywords = [
    "critical",
    "urgent",
    "immediate",
    "danger",
    "stop"
  ];

  if (criticalKeywords.some(k => text.includes(k))) {

    const critical = fleetData.filter(
      f => f.failure > 75
    );

    return {
      intent: "CRITICAL_ANALYSIS",
      summary: "Identified aircraft requiring immediate operational attention.",
      recommendation: "Ground high-risk aircraft and trigger inspection workflow.",
      data: critical
    };
  }

  /* ===============================
     2. MAINTENANCE INTENT
  =============================== */

  const maintenanceKeywords = [
    "maintenance",
    "repair",
    "service",
    "fix"
  ];

  if (maintenanceKeywords.some(k => text.includes(k))) {

    const maintenance = actions.filter(
      a => a.type?.includes("MAINTENANCE")
    );

    return {
      intent: "MAINTENANCE_PLANNING",
      summary: "Generated maintenance-related operational tasks.",
      recommendation: "Schedule preventive maintenance based on risk thresholds.",
      data: maintenance
    };
  }

  /* ===============================
     3. RISK INTENT
  =============================== */

  const riskKeywords = [
    "risk",
    "danger",
    "unsafe",
    "warning"
  ];

  if (riskKeywords.some(k => text.includes(k))) {

    const risk = fleetData.filter(
      f => f.failure > 50
    );

    return {
      intent: "RISK_ANALYSIS",
      summary: "Analyzing medium-to-high risk aircraft across fleet.",
      recommendation: "Monitor elevated-risk aircraft and adjust flight schedules if needed.",
      data: risk
    };
  }

  /* ===============================
     4. SUMMARY INTENT
  =============================== */

  if (text.includes("summary") || text.includes("overview")) {

    const avg =
      fleetData.reduce((sum, f) => sum + f.failure, 0) /
      (fleetData.length || 1);

    return {
      intent: "FLEET_SUMMARY",
      summary: "Generated fleet-wide operational overview.",
      recommendation:
        avg > 60
          ? "Fleet risk elevated — review maintenance capacity."
          : "Fleet operating within acceptable thresholds.",
      data: [
        {
          metric: "average_failure",
          value: Math.round(avg)
        }
      ]
    };
  }

  /* ===============================
     5. DEFAULT INTENT (ASSISTANT MODE)
  =============================== */

  return {
    intent: "ASSISTANT_HELP",
    summary: "I can analyze fleet status, risk, or maintenance needs.",
    recommendation:
      "Try: 'show critical aircraft', 'maintenance status', or 'fleet summary'.",
    data: []
  };
}
