export function generateDailyOpsReport(fleet, actions) {

  /* ===============================
     1. RISK SEGMENTATION
  =============================== */

  const enriched = fleet.map(f => {

    let risk = f.failure || 0;

    let category = "LOW";

    if (risk > 75) category = "CRITICAL";
    else if (risk > 50) category = "HIGH";
    else if (risk > 30) category = "MEDIUM";

    return {
      ...f,
      riskCategory: category
    };

  });

  /* ===============================
     2. GROUPS
  =============================== */

  const critical = enriched.filter(f => f.riskCategory === "CRITICAL");
  const high = enriched.filter(f => f.riskCategory === "HIGH");
  const medium = enriched.filter(f => f.riskCategory === "MEDIUM");

  /* ===============================
     3. PREDICTIVE LOGIC
  =============================== */

  const predictedFailures = enriched
    .filter(f => f.failure > 60)
    .map(f => ({
      aircraft: f.tail,
      probability: Math.round(f.failure),
      prediction: "Likely maintenance required within 7–14 days"
    }));

  /* ===============================
     4. PRIORITY ACTION STACK
  =============================== */

  const priorityActions = actions
    .sort((a, b) => {
      const rank = {
        CRITICAL: 3,
        HIGH: 2,
        MEDIUM: 1
      };

      return rank[b.priority] - rank[a.priority];
    });

  /* ===============================
     5. EXECUTIVE SUMMARY
  =============================== */

  const avgRisk =
    enriched.reduce((s, f) => s + f.failure, 0) /
    (enriched.length || 1);

  let executiveSummary = "";

  if (avgRisk > 70) {
    executiveSummary =
      "Fleet risk is elevated. Immediate operational intervention recommended.";
  } else if (avgRisk > 50) {
    executiveSummary =
      "Fleet showing moderate risk. Preventive maintenance advised.";
  } else {
    executiveSummary =
      "Fleet operating within acceptable safety thresholds.";
  }

  /* ===============================
     FINAL REPORT
  =============================== */

  return {
    timestamp: new Date().toISOString(),

    executiveSummary,

    metrics: {
      averageRisk: Math.round(avgRisk),
      criticalCount: critical.length,
      highCount: high.length,
      mediumCount: medium.length
    },

    riskGroups: {
      critical,
      high,
      medium
    },

    predictedFailures,

    priorityActions
  };
}
