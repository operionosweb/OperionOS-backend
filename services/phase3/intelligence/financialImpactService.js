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
  if (value === null || value === undefined || typeof value === "boolean"
    || typeof value === "string" && !value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
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
  return [finding?.evidence, ...(finding?.evidenceCandidates || [])]
    .filter(Boolean)
    .map((evidence) => ({
      evidenceId: evidence.evidenceId || null,
      excerpt: evidence.evidenceText || null,
      sourceLocator: evidence.sourceLocation || null,
      pageNumber: evidence.pageNumber || null,
      clauseId: evidence.clauseId || null,
      clauseNumber: evidence.clauseNumber || null,
    }))
    .filter((item) => item.evidenceId || item.excerpt);
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

export function buildFinancialImpact({
  contractId,
  analysisRunId,
  clauses = [],
  obligations = [],
  deadlines = [],
  risks = [],
  profile = null,
  calculationTimestamp = null,
} = {}) {
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
    commercialTerms.rentEscalation && { key: "rent-escalation", category: "escalation_indexation", description: "Rent escalation mechanism", finding: commercialTerms.rentEscalation, frequency: commercialTerms.rentEscalation.frequency, aggregationEligible: false, nature: "contractual_formula" },
    ...(commercialTerms.financialTermConflicts || [])
      .filter((conflict) => conflict.field === "base_rent")
      .map((conflict, index) => ({
        key: `financial-term-conflict-${index}`,
        category: "financial_term_conflict",
        description: "Conflicting base-rent terms",
        finding: {
          formula: conflict.description,
          evidenceCandidates: (conflict.candidates || []).map((candidate) => candidate.evidence).filter(Boolean),
        },
        aggregationEligible: false,
        nature: "conflicting_extracted_terms",
      })),
    ...(commercialTerms.maintenanceReserves || []).map((reserve, index) => ({ key: `maintenance-reserve-${index}`, category: "maintenance_reserve", description: `${reserve.coveredComponent || "Component"} maintenance reserve`, finding: { ...reserve.rate, evidence: reserve.evidence }, frequency: reserve.paymentFrequency, unit: reserve.rate?.unit, aggregationEligible: false, nature: "explicit_contractual_rate", conditions: reserve.reimbursementMechanics || null })),
  ].filter(Boolean);
  const profileImpacts = profileTerms.map((term) => {
    const amount = asMoney(term.finding.amount);
    const currency = amount === null ? null : String(term.finding.currency || "").toUpperCase() || null;
    const formula = term.finding.formula || null;
    const sourceClauseId = term.finding.evidence?.clauseId || null;
    const linkedDeadlines = sourceClauseId
      ? deadlines.filter((deadline) => (deadline.source_clause_id || deadline.clause_id || deadline.clauseId) === sourceClauseId)
      : [];
    const matchingPaymentDates = term.key === "base-rent" && sourceClauseId
      ? (commercialTerms.paymentDates || []).filter((item) => item.evidence?.clauseId === sourceClauseId)
      : [];
    const paymentDateCandidates = [...new Map(matchingPaymentDates
      .map((item) => [String(item.value || "").trim().toLowerCase(), item]))
      .values()];
    const paymentDateConflict = paymentDateCandidates.length > 1;
    const matchingPaymentDate = paymentDateConflict ? null : paymentDateCandidates[0]?.value || null;
    const paymentDateEvidence = profileEvidence({
      evidenceCandidates: matchingPaymentDates.map((item) => item.evidence).filter(Boolean),
    });
    const baseRent = term.category === "escalation_indexation" ? commercialTerms.baseRent : null;
    const baseRentAmount = asMoney(baseRent?.amount);
    const baseRentCurrency = String(baseRent?.currency || "").toUpperCase() || null;
    const rawEscalationRate = term.finding.ratePercent;
    const escalationRate = (typeof rawEscalationRate === "number"
      || typeof rawEscalationRate === "string" && rawEscalationRate.trim())
      ? Number(rawEscalationRate)
      : Number.NaN;
    const formulaType = term.finding.formulaType || "fixed_percentage";
    const escalationLimitations = [];
    if (term.category === "escalation_indexation") {
      if (formulaType === "cpi_index") escalationLimitations.push("CPI/index observations, reference dates, and the contractual adjustment interval are unavailable.");
      else if (formulaType === "interest_rate_index") escalationLimitations.push("The contractual benchmark observations, reference dates, and adjustment interval are unavailable.");
      else if (formulaType === "foreign_exchange_index") escalationLimitations.push("The contractual exchange-rate observations, reference dates, and adjustment interval are unavailable.");
      else if (formulaType === "conflicting") escalationLimitations.push("Conflicting rent-adjustment mechanisms were found; human review is required before calculation.");
      else {
        if (formulaType !== "fixed_percentage" || !Number.isFinite(escalationRate) || escalationRate < 0) escalationLimitations.push("A valid non-negative fixed escalation rate is not established.");
        if (term.finding.frequency !== "annual") escalationLimitations.push("An explicit annual escalation interval is not established.");
      }
      if (baseRentAmount === null || !baseRentCurrency) escalationLimitations.push("An evidence-backed base rent amount and currency are not available.");
      if (!calculationTimestamp || !Number.isFinite(Date.parse(calculationTimestamp))) escalationLimitations.push("A valid calculation timestamp was not supplied.");
    }
    const calculatedAmount = term.category === "escalation_indexation" && formulaType === "fixed_percentage"
      && !escalationLimitations.length
      ? Number((baseRentAmount * (1 + escalationRate / 100)).toFixed(2))
      : null;
    const termEvidence = [...profileEvidence(term.finding), ...paymentDateEvidence];
    const baseRentEvidence = term.category === "escalation_indexation" ? profileEvidence(baseRent) : [];
    const evidence = [...new Map([...termEvidence, ...baseRentEvidence]
      .map((item) => [`${item.evidenceId || ""}:${item.excerpt || ""}`, item])).values()];
    const clauseEvidence = [
      term.finding.evidence,
      ...(term.finding.evidenceCandidates || []),
      ...(term.category === "escalation_indexation" ? [baseRent?.evidence, ...(baseRent?.evidenceCandidates || [])] : []),
      ...matchingPaymentDates.map((item) => item.evidence),
    ]
      .filter((item) => item?.clauseId);
    const clausesById = new Map(clauseEvidence.map((item) => [item.clauseId, {
      id: item.clauseId,
      number: item.clauseNumber || null,
      title: null,
      text: item.evidenceText || null,
    }]));
    const resultLabel = calculatedAmount !== null
      ? `${moneyLabel(calculatedAmount, baseRentCurrency)}${baseRent.frequency ? ` / ${baseRent.frequency}` : ""} after one annual adjustment`
      : amount === null
      ? formula || "Amount not quantified"
      : `${moneyLabel(amount, currency)}${term.frequency ? ` / ${term.frequency}` : term.unit ? ` / ${term.unit.replaceAll("_", " ")}` : ""}`;
    const linkedDeadlineDetails = linkedDeadlines.map((deadline) => ({
      id: deadline.id,
      timingExpression: deadline.timing_expression || null,
      absoluteDate: deadline.absolute_date || null,
      relationship: "same_source_clause",
    }));
    const paymentSchedule = term.frequency || term.unit || matchingPaymentDate || paymentDateConflict
      ? {
        frequency: term.frequency || null,
        unit: term.unit || null,
        dueRule: matchingPaymentDate || linkedDeadlines.map((deadline) => deadline.timing_expression).find(Boolean) || null,
        dueRuleCandidates: paymentDateCandidates.map((item) => item.value).filter(Boolean),
        nextPaymentDate: null,
        occurrenceDatesGenerated: false,
        status: paymentDateConflict ? "requires_review"
          : term.frequency || matchingPaymentDate || linkedDeadlines.length ? "rule_identified" : "incomplete",
      }
      : null;
    const calculationMethod = calculatedAmount !== null
      ? "fixed_annual_rate_one_period"
      : formula ? "contractual_formula_requires_inputs"
        : amount === null ? "not_quantifiable_from_available_evidence"
          : term.aggregationEligible ? "direct_contract_amount" : "direct_contract_rate";
    const calculation = calculatedAmount !== null
      ? `${moneyLabel(baseRentAmount, baseRentCurrency)} × (1 + ${escalationRate} / 100) = ${moneyLabel(calculatedAmount, baseRentCurrency)} after one annual adjustment`
      : formula || (amount !== null ? `${resultLabel} stated in the evidence-linked contract profile` : null);
    const item = {
      id: `financial-impact:profile:${term.key}`,
      contractId, analysisRunId, sourceRiskId: null,
      sourceClauseId,
      sourceClauseNumber: term.finding.evidence?.clauseNumber || null,
      sourceObligationIds: [], sourceDeadlineIds: [],
      sourceEvidenceIds: evidence.map((item) => item.evidenceId).filter(Boolean),
      category: term.category, exposureType: "current_contractual", financialNature: term.nature,
      description: term.description, baseAmount: amount, currency: currency || (calculatedAmount !== null ? baseRentCurrency : null),
      frequency: term.frequency || null, unit: term.unit || null, conditions: term.conditions || null,
      aggregationEligible: term.aggregationEligible,
      calculatedAmount,
      adjustmentFrequency: term.category === "escalation_indexation" ? term.finding.frequency || null : null,
      recurrenceRule: term.category === "escalation_indexation" ? term.finding.recurrenceRule || null : null,
      paymentSchedule,
      calculationMethod,
      calculation,
      calculationTimestamp: calculatedAmount === null ? null : new Date(calculationTimestamp).toISOString(),
      calculationInputs: calculatedAmount === null ? [] : [
        { name: "Base rent", amount: baseRentAmount, currency: baseRentCurrency, inputDate: null, evidence: baseRentEvidence },
        { name: "Fixed annual increase", ratePercent: escalationRate, currency: null, inputDate: null, evidence: termEvidence },
      ],
      calculationLimitations: calculatedAmount === null
        ? escalationLimitations
        : ["The adjustment effective date and input observation dates are not established; this is one-period arithmetic, not a due amount or forecast."],
      assumptions: calculatedAmount !== null
        ? ["Applies the stated fixed annual rate once to the evidence-backed base rent. Input dates are unavailable. This scenario does not establish that an adjustment is currently due or effective."]
        : term.aggregationEligible ? ["The amount is stated directly in the contract."] : ["The stated rate is not converted into total exposure because the required duration or usage inputs are not established."],
      probability: null, confidence: term.finding.evidence?.confidence ?? null,
      timeHorizon: null, triggerEvent: null, consequence: null,
      mitigationAction: null, recommendationId: null,
      currentExposure: term.aggregationEligible ? amount : null, potentialEventExposure: null,
      estimatedExposureAfterMitigation: null, estimatedProtectedValue: null,
      resultLabel, remainingExposureLabel: "Remaining exposure not quantified", protectedValueLabel: "Protected value not quantified",
      provenance: {
        clause: clausesById.values().next().value || null,
        clauses: [...clausesById.values()],
        obligations: [],
        deadlines: linkedDeadlineDetails,
        evidence,
      },
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
      ...profileImpacts.flatMap((item) => item.calculationLimitations || []),
      profileImpacts.some((item) => item.category === "financial_term_conflict") && "Conflicting base-rent terms are preserved as unquantified evidence; human review is required before relying on an amount or frequency.",
      profileImpacts.some((item) => item.paymentSchedule?.status === "requires_review") && "Conflicting payment due rules share the financial-term clause; human review is required.",
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