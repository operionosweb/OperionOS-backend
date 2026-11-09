const EVENT_RULES = Object.freeze({
  shop_visit: {
    label: "Shop visit",
    terms: [
      ["shop visit or overhaul", /\b(shop visit|overhaul|engine removal|engine installation)\b/i],
      ["maintenance or airworthiness requirements", /\b(maintenance|airworthiness|inspection|repair|maintenance reserve)\b/i],
      ["technical records", /\b(technical records|maintenance records|release to service)\b/i],
    ],
  },
  maintenance: {
    label: "Maintenance event",
    terms: [
      ["maintenance or airworthiness requirements", /\b(maintenance|airworthiness|inspection|repair|maintenance reserve)\b/i],
      ["technical records", /\b(technical records|maintenance records|release to service)\b/i],
    ],
  },
  aog: {
    label: "Aircraft on Ground (AOG)",
    terms: [
      ["availability, downtime, or service-level terms", /\b(AOG|aircraft on ground|grounded|grounding|downtime|availability|service level|SLA)\b/i],
      ["maintenance or technical records expressly tied to an AOG event", /\b(?:AOG|aircraft on ground|grounded|grounding|downtime)[^.;]{0,100}\b(?:maintenance|repair|shop visit|technical records)\b|\b(?:maintenance|repair|shop visit|technical records)[^.;]{0,100}\b(?:AOG|aircraft on ground|grounded|grounding|downtime)\b/i],
      ["aircraft incident or insurance terms", /\b(insurance|insured|claim|accident|incident)\b/i],
    ],
  },
  delivery: {
    label: "Aircraft delivery",
    terms: [
      ["delivery or acceptance terms", /\b(delivery|acceptance|handover|delivery condition)\b/i],
      ["delivery records or technical documentation", /\b(technical records|delivery documentation|airworthiness records|acceptance documents)\b/i],
    ],
  },
  redelivery: {
    label: "Aircraft redelivery",
    terms: [
      ["redelivery or return-condition terms", /\b(redelivery|redeliver|return condition|return the aircraft|end of lease|lease return)\b/i],
      ["maintenance status or technical records", /\b(maintenance|technical records|maintenance records|airworthiness|inspection)\b/i],
    ],
  },
  supplier_disruption: {
    label: "Supplier disruption",
    terms: [
      ["supplier or service-provider responsibilities", /\b(supplier|vendor|service provider|MRO provider|provider obligations)\b/i],
      ["supplier service-level, delay, or remedy terms", /\b(?:supplier|vendor|service provider|MRO provider)[^.;]{0,100}\b(?:service level|SLA|delay|availability|downtime|penalty|liquidated damages)\b|\b(?:service level|SLA|delay|availability|downtime|penalty|liquidated damages)[^.;]{0,100}\b(?:supplier|vendor|service provider|MRO provider)\b/i],
      ["supplier notice or reporting terms", /\b(?:supplier|vendor|service provider|MRO provider)[^.;]{0,100}\b(?:notice|notify|notification|reporting)\b|\b(?:notice|notify|notification|reporting)[^.;]{0,100}\b(?:supplier|vendor|service provider|MRO provider)\b/i],
    ],
  },
  operational_disruption: {
    label: "Operational disruption",
    terms: [
      ["operational, availability, or disruption terms", /\b(operational disruption|disruption|availability|downtime|grounded|grounding|service level|SLA)\b/i],
      ["event-related notice or reporting terms", /\b(?:aircraft|operational event|disruption|incident|service|delay)[^.;]{0,100}\b(?:notice|notify|notification|reporting)\b|\b(?:notice|notify|notification|reporting)[^.;]{0,100}\b(?:aircraft|operational event|disruption|incident|service|delay)\b/i],
      ["insurance or liability terms", /\b(insurance|insured|liability|claim|indemnity)\b/i],
    ],
  },
  insurance_event: {
    label: "Insurance event",
    terms: [
      ["insurance or coverage terms", /\b(insurance|insured|coverage|certificate of insurance|policy)\b/i],
      ["claim, accident, or insurance notification terms", /\b(?:claim|accident|incident|loss|insurance|insured)[^.;]{0,100}\b(?:notice|notify|notification)\b|\b(?:notice|notify|notification)[^.;]{0,100}\b(?:claim|accident|incident|loss|insurance|insured)\b|\b(claim|accident|incident|loss)\b/i],
      ["liability or indemnity terms", /\b(liability|indemnity|indemnify)\b/i],
    ],
  },
});

function eventError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateAviationEventInput(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw eventError("AVIATION_EVENT_INVALID", "Provide an aviation event review.");
  }
  if (!Object.hasOwn(EVENT_RULES, input.category)) {
    throw eventError("AVIATION_EVENT_CATEGORY_INVALID", "Select a supported aviation event category.");
  }
  if (typeof input.assetId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.assetId)) {
    throw eventError("AVIATION_EVENT_ASSET_INVALID", "Select an aircraft with an established contract relationship.");
  }
  if (typeof input.summary !== "string" || input.summary.trim().length < 8 || input.summary.trim().length > 500) {
    throw eventError("AVIATION_EVENT_SUMMARY_INVALID", "Provide an event summary between 8 and 500 characters.");
  }
  if (typeof input.sourceExcerpt !== "string" || input.sourceExcerpt.trim().length < 8 || input.sourceExcerpt.trim().length > 3000) {
    throw eventError("AVIATION_EVENT_SOURCE_REQUIRED", "Provide an event source excerpt between 8 and 3,000 characters.");
  }
  if (input.eventDate !== undefined && input.eventDate !== null && input.eventDate !== "" && !validDate(input.eventDate)) {
    throw eventError("AVIATION_EVENT_DATE_INVALID", "Event date must be a valid ISO calendar date.");
  }
  if (input.sourceLocator !== undefined
    && (typeof input.sourceLocator !== "string" || input.sourceLocator.trim().length > 250)) {
    throw eventError("AVIATION_EVENT_SOURCE_LOCATOR_INVALID", "Event source locator must be 250 characters or fewer.");
  }
  return {
    assetId: input.assetId,
    category: input.category,
    summary: input.summary.trim(),
    eventDate: input.eventDate || null,
    source: {
      type: "user_submitted_event_context",
      excerpt: input.sourceExcerpt.trim(),
      sourceLocator: input.sourceLocator?.trim() || null,
      verified: false,
    },
    verificationStatus: "unverified",
  };
}

function evidenceForClause(evidence, clauseId) {
  return evidence.filter((item) => item.clause_id === clauseId && item.review_status !== "rejected")
    .map((item) => ({
      id: item.id,
      excerpt: item.excerpt || null,
      sourceLocator: item.source_locator || null,
      pageNumber: item.page_number ?? null,
      confidence: item.confidence ?? null,
      reviewStatus: item.review_status || "pending",
    }));
}

function relatedRisks(risks, clauseId, obligationIds) {
  const obligationSet = new Set(obligationIds);
  return risks.filter((risk) => risk.clause_id === clauseId
    || (risk.affected_obligation_ids || []).some((id) => obligationSet.has(id)))
    .map((risk) => ({
      id: risk.id,
      title: risk.title || risk.description || "Contract risk finding",
      category: risk.risk_category || risk.risk_type || null,
      priority: risk.priority || risk.severity || null,
      fulfilmentStatus: risk.fulfilmentStatus || risk.fulfilment_status || null,
      reviewStatus: risk.review_status || risk.status || null,
      explanation: risk.explanation || risk.rationale || risk.description || null,
      evidence: risk.evidence || [],
    }));
}

function relatedRecommendations(recommendations, risks, obligationIds) {
  const riskIds = new Set(risks.map((item) => item.id));
  const obligationSet = new Set(obligationIds);
  return recommendations.filter((item) => item.is_current !== false
    && (obligationSet.has(item.obligation_id)
      || riskIds.has(item.risk_id || item.riskId)
      || riskIds.has(item.risk_finding_id)))
    .map((item) => ({
      id: item.id || item.recommendation_key || item.recommendationKey || null,
      action: item.action || item.recommendation || null,
      reason: item.explanation || item.reason || item.rationale || null,
      priority: item.priority || null,
      suggestedOwner: item.suggested_owner || item.suggestedOwner || null,
      decisionStatus: item.decision_status || item.decisionStatus || null,
      evidence: item.evidence || [],
    }))
    .filter((item) => item.action);
}

export function buildAviationEventImpact({
  contractId,
  analysisRunId,
  event: eventInput,
  assetRelationship,
  clauses = [],
  evidence = [],
  obligations = [],
  deadlines = [],
  risks = [],
  financialImpact = null,
  recommendations = [],
} = {}) {
  const event = validateAviationEventInput(eventInput);
  if (!assetRelationship || assetRelationship.aircraft_id !== event.assetId) {
    throw eventError("AVIATION_ASSET_CONTRACT_RELATIONSHIP_NOT_FOUND", "No active evidence-backed aircraft relationship exists for this contract.", 422);
  }
  if (!assetRelationship.evidence_id) {
    throw eventError("AVIATION_ASSET_LINK_EVIDENCE_UNAVAILABLE", "The aircraft relationship has no available source evidence and cannot support an event review.", 422);
  }

  const rule = EVENT_RULES[event.category];
  const relatedClauses = clauses.flatMap((clause) => {
    if (!clause?.id || !String(clause.source_text || "").trim()) return [];
    const text = `${clause.title || ""} ${clause.source_text}`;
    const reasons = rule.terms.filter(([, pattern]) => pattern.test(text)).map(([reason]) => reason);
    if (!reasons.length) return [];

    const clauseObligations = obligations.filter((item) => item.clause_id === clause.id)
      .map((item) => ({
        id: item.id,
        description: item.description || null,
        type: item.obligation_type || null,
        actor: item.actor || null,
        action: item.action || null,
        object: item.object || null,
        reviewStatus: item.review_status || null,
      }));
    const obligationIds = clauseObligations.map((item) => item.id);
    const clauseRisks = relatedRisks(risks, clause.id, obligationIds);
    const clauseDeadlines = deadlines.filter((item) => (
      (item.source_clause_id || item.clause_id) === clause.id
      || obligationIds.includes(item.obligation_id)
    )).map((item) => ({
      id: item.id,
      timingExpression: item.timing_expression || item.original_expression || null,
      absoluteDate: item.absolute_date || null,
      monitoringStatus: item.monitoring?.status || null,
      reviewStatus: item.review_status || null,
    }));
    const clauseFinancialImpacts = (financialImpact?.impacts || [])
      .filter((item) => item.sourceClauseId === clause.id)
      .map((item) => ({
        id: item.id,
        category: item.category,
        description: item.description,
        baseAmount: item.baseAmount ?? null,
        calculatedAmount: item.calculatedAmount ?? null,
        currency: item.currency || null,
        resultLabel: item.resultLabel || "Not quantified",
        calculationMethod: item.calculationMethod || null,
        sourceEvidenceIds: item.sourceEvidenceIds || [],
      }));

    return [{
      relationshipType: "potentially_relevant",
      determination: "deterministic_contract_text_match",
      reasons,
      clause: {
        id: clause.id,
        number: clause.clause_number || null,
        title: clause.title || null,
        sourceText: clause.source_text,
        evidence: evidenceForClause(evidence, clause.id),
      },
      obligations: clauseObligations,
      deadlines: clauseDeadlines,
      risks: clauseRisks,
      financialImpacts: clauseFinancialImpacts,
      recommendations: relatedRecommendations(recommendations, clauseRisks, obligationIds),
    }];
  });

  return {
    contractId,
    analysisRunId,
    reviewStatus: "requires_human_review",
    outcome: relatedClauses.length ? "potential_contract_terms_identified" : "no_contract_terms_matched",
    event: {
      category: event.category,
      label: rule.label,
      summary: event.summary,
      eventDate: event.eventDate,
      verificationStatus: event.verificationStatus,
      source: event.source,
    },
    asset: {
      id: assetRelationship.aircraft_id,
      registration: assetRelationship.registration || null,
      serialNumber: assetRelationship.serial_number || null,
      aircraftType: assetRelationship.aircraft_type || null,
      manufacturer: assetRelationship.manufacturer || null,
      model: assetRelationship.model || null,
      contractRelationship: {
        id: assetRelationship.id,
        type: assetRelationship.relationship_type,
        confidence: assetRelationship.confidence ?? null,
        sourceIdentifier: assetRelationship.source_identifier || null,
        sourceReference: assetRelationship.source_reference || null,
        evidence: {
          id: assetRelationship.evidence_id,
          excerpt: assetRelationship.excerpt || null,
          sourceLocator: assetRelationship.source_locator || null,
          pageNumber: assetRelationship.page_number ?? null,
        },
      },
    },
    potentialImpacts: relatedClauses,
    limitations: [
      "The event context is user-submitted and remains unverified; this review is not an event record.",
      "A deterministic text match indicates a clause may be relevant; it does not establish causation, contractual effect, liability, payment, or breach.",
      "Dates and financial terms are shown only when present in existing contract intelligence; no new date or amount is calculated from the event.",
      "This review is transient and does not create or alter event, risk, fulfilment, recommendation, or decision history.",
      relatedClauses.length
        ? "Human review is required to confirm the event, asset relationship, relevant clause, obligation, evidence, and any appropriate action."
        : "No matching clause was identified by the supported deterministic terms; this does not establish that the event has no contractual effect.",
    ],
  };
}
