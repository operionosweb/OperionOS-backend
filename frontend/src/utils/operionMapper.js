export function mapOperionDecisionChain(data) {
  if (!data?.decision_chain) return [];

  return data.decision_chain.map((item) => {
    return {
      clause: item.clause,

      // UI sections
      explanation: {
        whyItMatters: item.why_it_matters,
        riskTrigger: item.risk_trigger,
        consequence: item.operational_consequence,
      },

      ownership: {
        department: item.owner,
      },

      action: {
        recommendation: item.recommendation,
      },

      risk: {
        severity: item.severity_score || 0,
        level:
          item.severity_score > 75
            ? "CRITICAL"
            : item.severity_score > 50
            ? "HIGH"
            : item.severity_score > 25
            ? "MEDIUM"
            : "LOW",
      },
    };
  });
}
