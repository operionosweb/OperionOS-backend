function sourceClauseId(item) {
  return item?.source_clause_id || item?.clause_id || null;
}

export function deriveRedeliveryReview({
  redelivery,
  obligations = [],
  deadlines = [],
  risks = [],
  recommendations = [],
  financialImpacts = [],
} = {}) {
  const requirements = Array.isArray(redelivery?.requirements) ? redelivery.requirements : [];
  const countsByCategory = new Map();
  for (const requirement of requirements) {
    countsByCategory.set(requirement.category, (countsByCategory.get(requirement.category) || 0) + 1);
  }
  const requirementsWithLinks = requirements.map((requirement) => {
    const clauseId = requirement.evidence?.clauseId || null;
    const clauseObligations = clauseId
      ? obligations.filter((obligation) => (
        obligation.clause_id === clauseId || obligation.source_clause_id === clauseId
      ))
      : [];
    const obligationIds = new Set(clauseObligations.map((obligation) => obligation.id));
    const clauseDeadlines = deadlines.filter((deadline) => (
      obligationIds.has(deadline.obligation_id)
      || clauseId && sourceClauseId(deadline) === clauseId
    ));
    const clauseRisks = risks.filter((risk) => obligationIds.has(risk.obligation_id));
    const clauseFinancialImpacts = clauseId
      ? financialImpacts.filter((impact) => impact.sourceClauseId === clauseId)
      : [];
    const riskIds = new Set(clauseRisks.map((risk) => risk.id));
    const clauseRecommendations = recommendations.filter((recommendation) => (
      recommendation.is_current === true
      && (riskIds.has(recommendation.source_risk_key)
        || riskIds.has(recommendation.risk_id)
        || obligationIds.has(recommendation.obligation_id))
    ));

    return {
      ...requirement,
      clauseId,
      multipleStatements: countsByCategory.get(requirement.category) > 1,
      obligations: clauseObligations,
      deadlines: clauseDeadlines,
      risks: clauseRisks,
      recommendations: clauseRecommendations,
      financialImpacts: clauseFinancialImpacts,
    };
  });
  const returnLocation = redelivery?.returnLocation || null;
  const locationCandidates = Array.isArray(returnLocation?.candidates) && returnLocation.candidates.length
    ? returnLocation.candidates
    : returnLocation?.value
      ? [{ value: returnLocation.value, evidence: returnLocation.evidence ? [returnLocation.evidence] : [] }]
      : [];

  return {
    requirements: requirementsWithLinks,
    returnLocation: {
      status: returnLocation?.status || (locationCandidates.length ? "explicit" : "not_established"),
      value: locationCandidates.length === 1 ? locationCandidates[0].value : null,
      candidates: locationCandidates,
    },
  };
}
