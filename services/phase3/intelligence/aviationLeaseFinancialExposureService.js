const MONEY_NUMBER = "(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?";
const SUPPORTED_CURRENCIES = new Set([
  "AUD", "CAD", "CHF", "CNY", "DKK", "EUR", "GBP", "HKD", "JPY", "NOK", "NZD", "SEK", "SGD", "USD",
]);

function roundedMoney(value) {
  return Number((Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dayNumber(value) {
  return validDate(value) ? Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / 86_400_000) : null;
}

function periodEndFromClause(text) {
  const match = String(text || "").match(
    /\b(?:lease\s+year|(?:utili[sz]ation|measurement)\s+period)\s+(?:ends?(?:\s+on)?|ending|end(?:s)?\s+on)\s+(\d{4}-\d{2}-\d{2})\b/i,
  );
  return match && validDate(match[1]) ? match[1] : null;
}

function metricPhrase(unit) {
  return unit === "flight_hours" ? "flight hours" : "flight cycles";
}

function relevantChargeSentences(text, unit) {
  const target = unit === "flight_hours" ? /flight\s+hours?/i : /flight\s+cycles?/i;
  return String(text || "")
    .split(/(?<=[.;!?])\s+|\n+/)
    .filter((sentence) => target.test(sentence));
}

function findRateTerms(text, unit) {
  const matches = [];
  const ratePattern = new RegExp(
    `\\b(?:([A-Z]{3})\\s*)?(${MONEY_NUMBER})\\s*(?:per|/)\\s*(?:each\\s+)?flight\\s+(hours?|cycles?)\\b`,
    "gi",
  );
  const expectedUnit = unit === "flight_hours" ? "hour" : "cycle";
  for (const sentence of relevantChargeSentences(text, unit)) {
    for (const match of sentence.matchAll(ratePattern)) {
      if (match[3].toLowerCase().startsWith(expectedUnit) === false) continue;
      if (!/\b(?:excess|additional|above\s+(?:the\s+)?(?:allowance|limit|cap))\b/i.test(sentence)) continue;
      if (!/\b(?:(?:shall|will|must)\s+(?:be\s+)?(?:charged|billed|invoiced|payable)|(?:shall|will|must)\s+pay|(?:is|are)\s+(?:charged|billed|invoiced|payable)|rate\s*(?:is|of|:))\b/i.test(sentence)) continue;
      matches.push({
        currency: match[1]?.toUpperCase() || null,
        amount: Number(match[2].replaceAll(",", "")),
        unit,
        sourceText: sentence.trim(),
      });
    }
  }
  const unique = new Map(matches.map((item) => [`${item.currency}:${item.amount}:${item.unit}`, item]));
  return [...unique.values()];
}

function hasUnsupportedCondition(text, unit) {
  const sentences = String(text || "").split(/(?<=[.;!?])\s+|\n+/);
  const chargeTerms = /\b(?:charge|charged|billed|invoiced|payable|pay|payment|fee|rate)\b/i;
  const isUnitThresholdCondition = new RegExp(
    `\\b(?:if|when)\\s+(?:the\\s+)?(?:total\\s+)?(?:flight\\s+)?${unit === "flight_hours" ? "hours?" : "cycles?"}\\b[^.;]{0,80}\\b(?:exceed|above|in\\s+excess\\s+of)\\b`,
    "i",
  );
  return sentences.some((sentence) => {
    if (!chargeTerms.test(sentence) && !new RegExp(`\\bflight\\s+${unit === "flight_hours" ? "hours?" : "cycles?"}\\b`, "i").test(sentence)) {
      return false;
    }
    if (/\b(?:subject\s+to|provided\s+that|unless|only\s+if|if\s+and\s+only\s+if|at\s+the\s+option\s+of|at\s+lessor\s+discretion|sole\s+discretion)\b/i.test(sentence)) {
      return true;
    }
    return /\b(?:if|when|upon|following|in\s+the\s+event\s+that)\b/i.test(sentence)
      && !isUnitThresholdCondition.test(sentence);
  });
}

function findCurrencylessRate(text, unit) {
  const pattern = new RegExp(
    `\\b${MONEY_NUMBER}\\s*(?:per|/)\\s*(?:each\\s+)?flight\\s+${unit === "flight_hours" ? "hours?" : "cycles?"}\\b`,
    "i",
  );
  return relevantChargeSentences(text, unit).some((sentence) => (
    pattern.test(sentence)
    && /\b(?:excess|additional|above\s+(?:the\s+)?(?:allowance|limit|cap))\b/i.test(sentence)
  ));
}

function capMatchesMeasurementPeriod(text, measurementPeriod) {
  const period = String(measurementPeriod || "").toLowerCase();
  if (/lease\s+year/.test(period)) return /\b(?:each|every|per)\s+lease\s+year\b/i.test(text);
  if (/calendar\s+year/.test(period)) return /\b(?:each|every|per)\s+calendar\s+year\b/i.test(text);
  if (/per\s+annum/.test(period)) return /\bper\s+annum\b/i.test(text);
  if (/per\s+month/.test(period)) return /\b(?:each|every|per)\s+month\b/i.test(text);
  if (/per\s+quarter/.test(period)) return /\b(?:each|every|per)\s+quarter\b/i.test(text);
  return false;
}

function parseChargeCap(text, measurementPeriod) {
  const pattern = new RegExp(
    `\\b(?:aggregate|total)\\s+(?:excess\\s+)?(?:utili[sz]ation\\s+)?(?:(flight[ -]+hours?|flight[ -]+cycles?)\\s+)?(?:charges?|fees?)\\s+(?:are\\s+)?(?:capped\\s+at|shall\\s+not\\s+exceed|limited\\s+to)\\s+([A-Z]{3})\\s*(${MONEY_NUMBER})\\b`,
    "gi",
  );
  return String(text || "").split(/(?<=[.;!?])\s+|\n+/).flatMap((sentence) => (
    [...sentence.matchAll(pattern)].map((match) => ({
      unit: match[1] ? (/hours?/i.test(match[1]) ? "flight_hours" : "flight_cycles") : null,
      currency: match[2].toUpperCase(),
      amount: Number(match[3].replaceAll(",", "")),
      measurementPeriodMatches: capMatchesMeasurementPeriod(sentence, measurementPeriod),
    }))
  ));
}

function sourceSupportsProvision(clause, rate, limit, unit) {
  if (clause.review_status !== "verified") return false;
  const limitPattern = new RegExp(
    `\\b${Number(limit).toLocaleString("en-US")}\\s*${unit === "flight_hours" ? "flight\\s+hours?" : "flight\\s+cycles?"}\\b`,
    "i",
  );
  const ratePattern = new RegExp(
    `\\b${rate.currency}\\s*${Number(rate.amount).toLocaleString("en-US")}\\s*(?:per|/)\\s*(?:each\\s+)?flight\\s+${unit === "flight_hours" ? "hours?" : "cycles?"}\\b`,
    "i",
  );
  return (clause.evidence || []).some((link) => (
    link.support_type === "supports"
    && link.source?.review_status === "verified"
    && limitPattern.test(link.source.excerpt || "")
    && ratePattern.test(link.source.excerpt || "")
    && /\b(?:excess|additional|above\s+(?:the\s+)?(?:allowance|limit|cap))\b/i.test(link.source.excerpt || "")
  ));
}

function sourceSupportsCap(clause, cap, unit) {
  const capPattern = new RegExp(
    `\\b(?:aggregate|total)\\s+(?:excess\\s+)?(?:utili[sz]ation\\s+)?(?:${unit === "flight_hours" ? "flight[ -]+hours?" : "flight[ -]+cycles?"}\\s+)?(?:charges?|fees?)\\s+(?:are\\s+)?(?:capped\\s+at|shall\\s+not\\s+exceed|limited\\s+to)\\s+${cap.currency}\\s*${Number(cap.amount).toLocaleString("en-US")}\\b`,
    "i",
  );
  return (clause.evidence || []).some((link) => (
    link.support_type === "supports"
    && link.source?.review_status === "verified"
    && capPattern.test(link.source.excerpt || "")
  ));
}

function unavailable(status, reason, details = {}) {
  return {
    status,
    reason,
    current: { status, amount: null, currency: details.currency || null },
    projected: { status, amount: null, currency: details.currency || null },
    contractualProvision: details.contractualProvision || null,
    calculationMethod: null,
    calculationDate: details.calculationDate || null,
    assumptions: [],
    limitations: [reason],
  };
}

function cappedAmount(amount, cap) {
  return cap ? Math.min(amount, cap.amount) : amount;
}

export function deriveAviationLeaseFinancialExposure({
  clause,
  unit,
  contractualLimit,
  contractualMeasurementPeriod,
  assessmentStatus,
  currentUtilisationStatus,
  currentUtilisation,
  currentReportingPeriod,
  currentSources = [],
  forecast,
  asOf,
  contractId,
  contractVersionId,
} = {}) {
  const currencylessRate = findCurrencylessRate(clause?.source_text, unit);
  const rates = findRateTerms(clause?.source_text, unit);
  if (!rates.length) {
    return unavailable(
      currencylessRate ? "requires_contractual_evidence" : "requires_contractual_evidence",
      currencylessRate
        ? "The excess-utilization rate does not identify a supported ISO currency; no financial amount was calculated."
        : "No explicit excess-utilization rate for this unit was established in the cited clause; no industry rate was substituted.",
      { calculationDate: asOf },
    );
  }
  if (rates.length > 1) {
    return unavailable("cannot_reliably_calculate", "Conflicting excess-utilization rates occur in the cited clause; no rate was selected.", { calculationDate: asOf });
  }

  const rate = rates[0];
  if (!rate.currency || !SUPPORTED_CURRENCIES.has(rate.currency)) {
    return unavailable("requires_contractual_evidence", "A recognized contractual currency is required; no currency conversion or symbol-based inference was applied.", {
      calculationDate: asOf,
      currency: rate.currency,
    });
  }
  if (!Number.isFinite(rate.amount) || rate.amount < 0) {
    return unavailable("cannot_reliably_calculate", "The contractual excess-utilization rate is invalid; no financial amount was calculated.", { calculationDate: asOf });
  }
  if (contractualLimit === null || !Number.isFinite(contractualLimit) || contractualLimit < 0
    || !contractualMeasurementPeriod) {
    return unavailable("requires_contractual_evidence", "A single numeric allowance and explicit contractual measurement period are required.", {
      calculationDate: asOf,
      currency: rate.currency,
    });
  }
  if (/\bminimum\b/i.test(clause.source_text || "")) {
    return unavailable("cannot_reliably_calculate", "The clause includes a minimum-utilization or minimum-payment term whose interaction with excess charges is not established.", {
      calculationDate: asOf,
      currency: rate.currency,
    });
  }
  if (hasUnsupportedCondition(clause.source_text, unit)) {
    return unavailable("cannot_reliably_calculate", "The financial provision contains an additional condition that this deterministic assessment cannot resolve.", {
      calculationDate: asOf,
      currency: rate.currency,
    });
  }

  const caps = parseChargeCap(clause.source_text, contractualMeasurementPeriod);
  const hasUnparsedCap = /\b(?:aggregate|total)\b[^.;\n]{0,100}\b(?:cap(?:ped)?|maximum)\b/i.test(clause.source_text || "")
    && caps.length === 0;
  if (hasUnparsedCap) {
    return unavailable("cannot_reliably_calculate", "A financial cap is present but its scope or methodology is not supported by the recognized clause pattern.", {
      calculationDate: asOf,
      currency: rate.currency,
    });
  }
  if (caps.some((item) => item.unit === null)) {
    return unavailable("cannot_reliably_calculate", "An aggregate cap spans multiple or unspecified utilization units and cannot be allocated without risking double-counting.", {
      calculationDate: asOf,
    });
  }
  if (caps.length > 1 && new Set(caps.filter((item) => item.unit === unit).map((cap) => `${cap.currency}:${cap.amount}`)).size > 1) {
    return unavailable("cannot_reliably_calculate", "Conflicting financial caps occur in the cited clause; no cap was selected.", { calculationDate: asOf });
  }
  const cap = caps.find((item) => item.unit === unit) || null;
  if (cap && !cap.measurementPeriodMatches) {
    return unavailable("cannot_reliably_calculate", "The contractual cap does not state the same measurement period as the utilization allowance.", {
      calculationDate: asOf,
      currency: rate.currency,
    });
  }
  if (cap && cap.currency !== rate.currency) {
    return unavailable("cannot_reliably_calculate", "The contractual rate and cap use different currencies; no conversion methodology is specified.", {
      calculationDate: asOf,
      currency: rate.currency,
    });
  }
  if (cap && !sourceSupportsCap(clause, cap, unit)) {
    return unavailable("requires_contractual_evidence", "A verified supporting clause citation must contain the same financial cap before it can be applied.", {
      calculationDate: asOf,
      currency: rate.currency,
    });
  }
  if (!sourceSupportsProvision(clause, rate, contractualLimit, unit)) {
    return unavailable("requires_contractual_evidence", "A verified supporting clause citation must contain the same allowance and excess rate before calculation.", {
      calculationDate: asOf,
      currency: rate.currency,
    });
  }
  if (assessmentStatus !== "fulfilled") {
    return unavailable("requires_operational_evidence", "A fulfilled reviewer assessment is required before using operational records for financial exposure.", {
      calculationDate: asOf,
      currency: rate.currency,
      contractualProvision: { rate, cap, contractualLimit, contractualMeasurementPeriod },
    });
  }

  const contractualProvision = {
    contractId: contractId || null,
    contractVersionId: contractVersionId || null,
    clauseId: clause.id || null,
    clauseNumber: clause.clause_number || null,
    unit,
    allowance: contractualLimit,
    measurementPeriod: contractualMeasurementPeriod,
    rate: { amount: rate.amount, currency: rate.currency, per: unit },
    cap: cap ? { amount: cap.amount, currency: cap.currency, measurementPeriod: contractualMeasurementPeriod } : null,
    evidence: (clause.evidence || [])
      .filter((link) => link.support_type === "supports" && link.source?.review_status === "verified")
      .map((link) => ({
        evidenceId: link.evidence_id,
        sourceLocator: link.source.source_locator || null,
        pageNumber: link.source.page_number || null,
        excerpt: link.source.excerpt || null,
        reviewStatus: link.source.review_status,
      })),
  };
  const base = {
    currency: rate.currency,
    contractualProvision,
    calculationDate: asOf,
    calculationMethod: "max(0, utilization - contractual allowance) × explicit excess-unit rate, then apply an explicitly supported same-currency aggregate cap",
    assumptions: [],
    limitations: [
      "Calculated amounts are informational exposure estimates, not invoices, incurred liabilities, accounting provisions, or legal conclusions.",
      "No currency conversion, minimum payment, or conditional charge is inferred.",
    ],
  };

  if (!validDate(asOf)) {
    return unavailable("cannot_reliably_calculate", "The calculation date is invalid.", { calculationDate: asOf, currency: rate.currency });
  }
  if (currentUtilisationStatus !== "within_limit" && currentUtilisationStatus !== "approaching"
    && currentUtilisationStatus !== "at_limit" && currentUtilisationStatus !== "exceeded") {
    return {
      ...base,
      status: "requires_operational_evidence",
      current: { status: "requires_operational_evidence", amount: null, currency: rate.currency, reason: "A verified, current, period-matched utilization reading is unavailable." },
      projected: { status: forecast?.status === "forecast_available" ? "not_projected" : "requires_operational_evidence", amount: null, currency: rate.currency, reason: forecast?.reason || "Verified historical forecast evidence is unavailable." },
    };
  }
  if (!Number.isFinite(currentUtilisation) || currentUtilisation < 0 || !currentSources.length) {
    return unavailable("cannot_reliably_calculate", "The current operational reading is invalid or has no linked source evidence.", {
      calculationDate: asOf,
      currency: rate.currency,
      contractualProvision,
    });
  }

  const currentExcess = Math.max(0, currentUtilisation - contractualLimit);
  const currentAmount = cappedAmount(roundedMoney(currentExcess * rate.amount), cap);
  const currentStatus = currentExcess > 0 ? "currently_demonstrated_exposure" : "no_demonstrated_exposure";
  const current = {
    status: currentStatus,
    amount: currentAmount,
    currency: rate.currency,
    excessUnits: currentExcess,
    recordedUtilisation: currentUtilisation,
    reportingPeriod: currentReportingPeriod || null,
    sources: currentSources,
    calculation: `max(0, ${currentUtilisation} ${metricPhrase(unit)} - ${contractualLimit} ${metricPhrase(unit)}) × ${rate.currency} ${rate.amount} per ${metricPhrase(unit)}${cap ? `; capped at ${cap.currency} ${cap.amount}` : ""} = ${rate.currency} ${currentAmount}`,
  };

  const periodEnd = periodEndFromClause(clause.source_text);
  if (!forecast || !["forecast_available", "threshold_reached"].includes(forecast.status)) {
    return {
      ...base,
      status: currentStatus,
      current,
      projected: {
        status: "requires_operational_evidence",
        amount: null,
        currency: rate.currency,
        reason: forecast?.reason || "A verified Phase 55 forecast is unavailable.",
      },
    };
  }
  if (!periodEnd) {
    return {
      ...base,
      status: currentExcess > 0 ? currentStatus : "cannot_reliably_calculate",
      current,
      projected: {
        status: "cannot_reliably_calculate",
        amount: null,
        currency: rate.currency,
        reason: "The clause does not establish an exact measurement-period end date for a projected charge calculation.",
      },
    };
  }
  if (!currentReportingPeriod?.end
    || currentReportingPeriod.end !== forecast.lastObservedDate
    || currentUtilisation !== forecast.currentVerifiedUtilisation) {
    return {
      ...base,
      status: currentExcess > 0 ? currentStatus : "requires_operational_evidence",
      current,
      projected: {
        status: "requires_operational_evidence",
        amount: null,
        currency: rate.currency,
        reason: "The current verified meter reading, reporting-period end, and Phase 55 forecast observation do not align; no projected charge was calculated.",
      },
    };
  }
  if (periodEnd <= asOf || periodEnd < forecast.lastObservedDate) {
    return {
      ...base,
      status: currentExcess > 0 ? currentStatus : "cannot_reliably_calculate",
      current,
      projected: {
        status: "cannot_reliably_calculate",
        amount: null,
        currency: rate.currency,
        reason: "The contractual measurement date is not a future date relative to current verified evidence.",
      },
    };
  }
  const daysToPeriodEnd = dayNumber(periodEnd) - dayNumber(forecast.lastObservedDate);
  const dailyRate = Number(forecast.averageDailyConsumption);
  if (!Number.isFinite(dailyRate) || dailyRate < 0 || !Number.isFinite(daysToPeriodEnd) || daysToPeriodEnd <= 0) {
    return {
      ...base,
      status: currentExcess > 0 ? currentStatus : "cannot_reliably_calculate",
      current,
      projected: {
        status: "cannot_reliably_calculate",
        amount: null,
        currency: rate.currency,
        reason: "A valid positive historical utilization rate and future contractual measurement date are required.",
      },
    };
  }
  const projectedUtilisation = forecast.currentVerifiedUtilisation + dailyRate * daysToPeriodEnd;
  const projectedExcess = Math.max(0, projectedUtilisation - contractualLimit);
  const projectedAmount = cappedAmount(roundedMoney(projectedExcess * rate.amount), cap);
  const projectedStatus = projectedExcess > 0 ? "potential_future_exposure" : "no_demonstrated_exposure";
  const projected = {
    status: projectedStatus,
    amount: projectedAmount,
    currency: rate.currency,
    measurementDate: periodEnd,
    projectedUtilisation: Number(projectedUtilisation.toFixed(4)),
    projectedExcessUnits: Number(projectedExcess.toFixed(4)),
    sources: forecast.sources || [],
    calculation: `(${forecast.currentVerifiedUtilisation} + ${dailyRate} × ${daysToPeriodEnd} calendar days) projected ${metricPhrase(unit)}; max(0, projected utilization - ${contractualLimit}) × ${rate.currency} ${rate.amount}${cap ? `, capped at ${cap.currency} ${cap.amount}` : ""} = ${rate.currency} ${projectedAmount}`,
    assumptions: [forecast.forecastAssumption],
  };
  return {
    ...base,
    status: projectedExcess > 0 ? projectedStatus : currentExcess > 0 ? currentStatus : "no_demonstrated_exposure",
    current,
    projected,
    assumptions: [forecast.forecastAssumption],
  };
}
