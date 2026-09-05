const CATEGORY_RULES = [
  ["service_level_penalty", /service.?level|sla|performance/i],
  ["late_payment", /late payment|interest/i],
  ["delay_cost", /delay/i],
  ["grounding_downtime", /ground|downtime|unavailable|availability|late (?:aircraft )?return/i],
  ["minimum_payment", /minimum (?:payment|rent|utili[sz]ation)/i],
  ["termination_exposure", /terminat/i],
  ["escalation_indexation", /escalat|indexation|index-linked/i],
  ["maintenance_exposure", /maintenance|airworth|shop visit|redelivery/i],
  ["supplier_failure", /supplier|vendor|provider failure/i],
  ["operational_disruption", /operational|disruption/i],
  ["penalty", /penalt|liquidated damages/i],
];

function asMoney(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
}

function impactCategory(risk) {
  const source = `${risk.risk_category || ""} ${risk.risk_type || ""} ${risk.title || ""} ${risk.description || ""}`;
  return CATEGORY_RULES.find(([, pattern]) => pattern.test(source))?.[0] || "other_contractual_exposure";
}

function directEvidence(risk) {
  return (risk.evidence || []).map((link) => ({
    evidenceId: link.evidence_id || link.id || link.source?.id || null,
    excerpt: link.source?.excerpt || link.excerpt || null,
    sourceLocator: link.source?.source_locator || link.source_locator || null,
    pageNumber: link.source?.page_number || link.page_number || null,
  })).filter((item) => item.evidenceId || item.excerpt);
}

function addAmount(totals, currency, amount) {
  if (amount === null || !currency) return;
  totals[currency] = Number(((totals[currency] || 0) + amount).toFixed(2));
}

function buildPath(impact) {
  const nodes = [
    { id: `${impact.id}:event`, type: "event", label: impact.triggerEvent || "Current contractual state" },
    { id: `${impact.id}:condition`, type: "condition", label: impact.exposureType === "event_driven" ? "Contract condition must occur" : "Contract terms currently apply" },
    { id: `${impact.id}:clause`, type: "clause", label: impact.sourceClauseNumber ? `Clause ${impact.sourceClauseNumber}` : "Source clause", referenceId: impact.sourceClauseId },
    { id: `${impact.id}:consequence`, type: "financial_consequence", label: impact.resultLabel },
  ];
  if (impact.mitigationAction) nodes.push({ id: `${impact.id}:mitigation`, type: "mitigation", label: impact.mitigationAction, referenceId: impact.recommendationId });
  nodes.push({ id: `${impact.id}:remaining`, type: "remaining_exposure", label: impact.estimatedExposureAfterMitigation === null ? "Remaining exposure not quantified" : impact.remainingExposureLabel });
  nodes.push({ id: `${impact.id}:protected`, type: "protected_value", label: impact.estimatedProtectedValue === null ? "Protected value not quantified" : impact.protectedValueLabel });
  return nodes;
}

function moneyLabel(amount, currency) {
  if (amount === null || !currency) return "Amount not quantified";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

export function buildFinancialImpact({ contractId, analysisRunId, clauses = [], obligations = [], deadlines = [], risks = [], profile = null } = {}) {
  const clauseById = new Map(clauses.map((item) => [item.id, item]));
  const obligationById = new Map(obligations.map((item) => [item.id, item]));
  const deadlineById = new Map(deadlines.map((item) => [item.id, item]));
  const recommendations = profile?.recommendations || [];
  const recommendationByRisk = new Map(recommendations.filter((item) => item.riskId || item.risk_id).map((item) => [item.riskId || item.risk_id, item]));
  const totals = { currentContractual: {}, eventDriven: {}, potentialAvoidable: {}, protectedValue: {}, totalQuantified: {} };

  const impacts = risks.map((risk) => {
    const financial = risk.financial_exposure || {};
    const baseAmount = financial.type === "quantified" ? asMoney(financial.amount) : null;
    const currency = baseAmount === null ? null : String(financial.currency || "").toUpperCase() || null;
    const explicitAfter = asMoney(financial.estimated_after_mitigation ?? risk.metadata?.financial_impact?.estimated_after_mitigation);
    const estimatedAfter = baseAmount !== null && explicitAfter !== null && explicitAfter <= baseAmount ? explicitAfter : null;
    const protectedValue = estimatedAfter === null ? null : Number((baseAmount - estimatedAfter).toFixed(2));
    const sourceClauseId = risk.clause_id || risk.source_clause_ids?.[0] || null;
    const sourceClause = clauseById.get(sourceClauseId);
    const sourceObligationIds = risk.affected_obligation_ids || [];
    const sourceDeadlineIds = risk.affected_deadline_ids || [];
    const recommendation = recommendationByRisk.get(risk.id);
    const triggerEvent = String(risk.condition || "").trim() || null;
    const exposureType = triggerEvent ? "event_driven" : "current_contractual";
    const resultLabel = moneyLabel(baseAmount, currency);
    const item = {
      id: `financial-impact:${risk.id}`,
      contractId,
      analysisRunId,
      sourceRiskId: risk.id,
      sourceClauseId,
      sourceClauseNumber: sourceClause?.clause_number || null,
      sourceObligationIds,
      sourceDeadlineIds,
      sourceEvidenceIds: directEvidence(risk).map((item) => item.evidenceId).filter(Boolean),
      category: impactCategory(risk),
      exposureType,
      description: risk.title || risk.description || "Contractual financial exposure",
      baseAmount,
      currency,
      calculationMethod: baseAmount === null ? "not_quantifiable_from_available_evidence" : "direct_contract_amount",
      calculation: baseAmount === null ? null : `${moneyLabel(baseAmount, currency)} stated in the evidence-linked risk finding`,
      assumptions: baseAmount === null
        ? ["No monetary amount supported by the available contract evidence."]
        : ["The contractual amount is presented without probability weighting or predictive adjustment."],
      probability: Number.isFinite(risk.probability) ? risk.probability : null,
      confidence: Number.isFinite(Number(risk.confidence)) ? Number(risk.confidence) : null,
      timeHorizon: sourceDeadlineIds.map((id) => deadlineById.get(id)?.timing_expression || deadlineById.get(id)?.absolute_date).find(Boolean) || null,
      triggerEvent,
      consequence: risk.consequence || risk.impact || risk.exposure || null,
      mitigationAction: recommendation?.action || risk.recommendation || null,
      recommendationId: recommendation?.id || recommendation?.riskId || recommendation?.risk_id || null,
      currentExposure: exposureType === "current_contractual" ? baseAmount : null,
      potentialEventExposure: exposureType === "event_driven" ? baseAmount : null,
      estimatedExposureAfterMitigation: estimatedAfter,
      estimatedProtectedValue: protectedValue,
      resultLabel,
      remainingExposureLabel: moneyLabel(estimatedAfter, currency),
      protectedValueLabel: moneyLabel(protectedValue, currency),
      provenance: {
        clause: sourceClause ? { id: sourceClause.id, number: sourceClause.clause_number || null, title: sourceClause.title || null, text: sourceClause.source_text || null } : null,
        obligations: sourceObligationIds.map((id) => obligationById.get(id)).filter(Boolean).map((item) => ({ id: item.id, description: item.description, type: item.obligation_type || null })),
        deadlines: sourceDeadlineIds.map((id) => deadlineById.get(id)).filter(Boolean).map((item) => ({ id: item.id, timingExpression: item.timing_expression || null, absoluteDate: item.absolute_date || null })),
        evidence: directEvidence(risk),
      },
    };
    item.path = buildPath(item);
    addAmount(totals.totalQuantified, currency, baseAmount);
    addAmount(exposureType === "event_driven" ? totals.eventDriven : totals.currentContractual, currency, baseAmount);
    addAmount(totals.potentialAvoidable, currency, protectedValue);
    addAmount(totals.protectedValue, currency, protectedValue);
    return item;
  });

  const quantified = impacts.filter((item) => item.baseAmount !== null && item.currency);
  const unquantified = impacts.filter((item) => item.baseAmount === null);
  return {
    contractId,
    analysisRunId,
    status: !impacts.length ? "empty" : quantified.length ? unquantified.length ? "partial" : "quantified" : "unquantified",
    summary: totals,
    impacts,
    actions: impacts.filter((item) => item.mitigationAction).map((item) => ({
      recommendationId: item.recommendationId,
      riskId: item.sourceRiskId,
      action: item.mitigationAction,
      currency: item.currency,
      currentExposure: item.baseAmount,
      estimatedExposureAfterMitigation: item.estimatedExposureAfterMitigation,
      estimatedProtectedValue: item.estimatedProtectedValue,
    })),
    missingInputs: [
      !quantified.length && "No evidence-backed monetary amount was found in quantified risk findings.",
      impacts.some((item) => item.mitigationAction && item.estimatedProtectedValue === null) && "Post-mitigation amounts are not present, so potential protected value cannot be calculated.",
      impacts.some((item) => item.exposureType === "event_driven" && item.probability === null) && "Event probabilities are unavailable; event-driven exposure is not probability-weighted.",
    ].filter(Boolean),
    methodology: {
      version: "financial-impact.v1",
      deterministic: true,
      predictive: false,
      currenciesAggregatedSeparately: true,
      statement: "Amounts are derived from evidence-linked risk findings. No exchange-rate conversion, probability estimate, or forecast is introduced.",
    },
  };
}