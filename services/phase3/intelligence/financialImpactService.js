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

function profileEvidence(finding) {
  const evidence = finding?.evidence;
  if (!evidence) return [];
  return [{
    evidenceId: evidence.evidenceId || null,
    excerpt: evidence.evidenceText || null,
    sourceLocator: evidence.sourceLocation || null,
    pageNumber: evidence.pageNumber || null,
  }].filter((item) => item.evidenceId || item.excerpt);
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

  const riskImpacts = risks.map((risk) => {
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

  const commercialTerms = profile?.metadata?.leaseIntelligence?.commercialTerms
    || profile?.metadata?.lease_intelligence?.commercial_terms
    || {};
  const profileTerms = [
    commercialTerms.baseRent && { key: "base-rent", category: "base_rent", description: "Base rent", finding: commercialTerms.baseRent, frequency: commercialTerms.baseRent.frequency, aggregationEligible: false, nature: "explicit_contractual_amount" },
    commercialTerms.securityDeposit && { key: "security-deposit", category: "security", description: "Security deposit", finding: commercialTerms.securityDeposit, aggregationEligible: true, nature: "explicit_contractual_amount" },
    commercialTerms.rentEscalation && { key: "rent-escalation", category: "escalation_indexation", description: "Rent escalation mechanism", finding: commercialTerms.rentEscalation, aggregationEligible: false, nature: "contractual_formula" },
    ...(commercialTerms.maintenanceReserves || []).map((reserve, index) => ({ key: `maintenance-reserve-${index}`, category: "maintenance_reserve", description: `${reserve.coveredComponent || "Component"} maintenance reserve`, finding: { ...reserve.rate, evidence: reserve.evidence }, frequency: reserve.paymentFrequency, unit: reserve.rate?.unit, aggregationEligible: false, nature: "explicit_contractual_rate", conditions: reserve.reimbursementMechanics || null })),
  ].filter(Boolean);
  const profileImpacts = profileTerms.map((term) => {
    const amount = asMoney(term.finding.amount);
    const currency = amount === null ? null : String(term.finding.currency || "").toUpperCase() || null;
    const formula = term.finding.formula || null;
    const evidence = profileEvidence(term.finding);
    const resultLabel = amount === null
      ? formula || "Amount not quantified"
      : `${moneyLabel(amount, currency)}${term.frequency ? ` / ${term.frequency}` : term.unit ? ` / ${term.unit.replaceAll("_", " ")}` : ""}`;
    const item = {
      id: `financial-impact:profile:${term.key}`,
      contractId, analysisRunId, sourceRiskId: null,
      sourceClauseId: term.finding.evidence?.clauseId || null,
      sourceClauseNumber: term.finding.evidence?.clauseNumber || null,
      sourceObligationIds: [], sourceDeadlineIds: [],
      sourceEvidenceIds: evidence.map((item) => item.evidenceId).filter(Boolean),
      category: term.category, exposureType: "current_contractual", financialNature: term.nature,
      description: term.description, baseAmount: amount, currency,
      frequency: term.frequency || null, unit: term.unit || null, conditions: term.conditions || null,
      aggregationEligible: term.aggregationEligible,
      calculationMethod: formula ? "contractual_formula_requires_inputs" : amount === null ? "not_quantifiable_from_available_evidence" : term.aggregationEligible ? "direct_contract_amount" : "direct_contract_rate",
      calculation: formula || (amount !== null ? `${resultLabel} stated in the evidence-linked contract profile` : null),
      assumptions: term.aggregationEligible ? ["The amount is stated directly in the contract."] : ["The stated rate is not converted into total exposure because the required duration or usage inputs are not established."],
      probability: null, confidence: term.finding.evidence?.confidence ?? null,
      timeHorizon: null, triggerEvent: null, consequence: null,
      mitigationAction: null, recommendationId: null,
      currentExposure: term.aggregationEligible ? amount : null, potentialEventExposure: null,
      estimatedExposureAfterMitigation: null, estimatedProtectedValue: null,
      resultLabel, remainingExposureLabel: "Remaining exposure not quantified", protectedValueLabel: "Protected value not quantified",
      provenance: { clause: null, obligations: [], deadlines: [], evidence },
    };
    item.path = buildPath(item);
    if (term.aggregationEligible) {
      addAmount(totals.totalQuantified, currency, amount);
      addAmount(totals.currentContractual, currency, amount);
    }
    return item;
  });
  const impacts = [...profileImpacts, ...riskImpacts];

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
      profileImpacts.some((item) => !item.aggregationEligible && item.baseAmount !== null) && "Recurring rates are shown but not aggregated without evidence-backed duration or usage inputs.",
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