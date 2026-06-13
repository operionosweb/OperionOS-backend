export function explainDecision(decision_chain = []) {
  try {
    return decision_chain.map((item) => {
      const reasons = [];

      if (item.risk_trigger?.includes("failure")) {
        reasons.push("Risk triggered by operational failure condition");
      }

      if (item.owner === "Finance") {
        reasons.push("Financial exposure identified in clause");
      }

      if (item.owner === "Technical Services") {
        reasons.push("Maintenance responsibility assigned to technical ops");
      }

      return {
        clause: item.clause,
        explanation: reasons.length
          ? reasons
          : ["Standard operational mapping applied"],
      };
    });
  } catch (err) {
    return [];
  }
}