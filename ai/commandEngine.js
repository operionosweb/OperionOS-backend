export function interpretCommand(input, fleetData, actions) {

  const cmd = input.toLowerCase();

  let result = {
    type: "UNKNOWN",
    response: "",
    data: []
  };

  /* ===============================
     HIGH RISK REQUESTS
  =============================== */

  if (cmd.includes("critical")) {

    const filtered = fleetData.filter(f => f.failure > 75);

    return {
      type: "FILTER",
      response: "Showing critical aircraft requiring immediate action.",
      data: filtered
    };
  }

  /* ===============================
     MAINTENANCE REQUESTS
  =============================== */

  if (cmd.includes("maintenance")) {

    const maintenanceActions = actions.filter(
      a => a.type.includes("MAINTENANCE")
    );

    return {
      type: "ACTIONS",
      response: "Showing all maintenance-related actions.",
      data: maintenanceActions
    };
  }

  /* ===============================
     RISK ANALYSIS
  =============================== */

  if (cmd.includes("risk") || cmd.includes("high risk")) {

    const filtered = fleetData.filter(f => f.failure > 50);

    return {
      type: "FILTER",
      response: "Showing high-risk fleet segments.",
      data: filtered
    };
  }

  /* ===============================
     SUMMARY COMMAND
  =============================== */

  if (cmd.includes("summary")) {

    const avg =
      fleetData.reduce((a, b) => a + b.failure, 0) /
      (fleetData.length || 1);

    return {
      type: "SUMMARY",
      response: `Fleet average failure probability is ${Math.round(avg)}%.`,
      data: []
    };
  }

  /* ===============================
     DEFAULT
  =============================== */

  return {
    type: "HELP",
    response:
      "Try commands: critical, maintenance, risk, summary",
    data: []
  };
}
