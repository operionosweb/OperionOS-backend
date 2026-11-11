const DAY_MS = 86_400_000;

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const SYNTHETIC_AIRCRAFT_LEASE = Object.freeze({
  contractId: "OPN-2025-00124",
  contractTitle: "Aircraft Lease Agreement",
  contractRouteId: "demo-aircraft-lease",
  aircraft: "G-OPER",
  classification: "SYNTHETIC DEMO EXAMPLE — NOT CUSTOMER OR LIVE PRODUCT DATA",
  clause: Object.freeze({
    id: "ev-utilisation-clause",
    number: "15.2",
    title: "Aircraft Utilisation",
    page: 57,
    excerpt: "The Lessee shall ensure that cumulative flight hours do not exceed 5,000 during the Term. The Lessee shall retain monthly aircraft utilisation reports.",
  }),
  fxPayment: Object.freeze({
    evidenceId: "ev-fx-payment",
    clauseId: "cl-fx-payment",
    obligation: Object.freeze({
      id: "ob-fx-payment",
      title: "Review the cited foreign-currency maintenance-reserve payment",
    }),
    clauseNumber: "8.4",
    page: 61,
    excerpt: "An additional maintenance reserve payment of USD 1,250,000 is due on 2026-12-01.",
    amount: 1250000,
    currency: "USD",
    dueDate: "2026-12-01",
    referenceRate: 1.1,
    referenceRateUnit: "USD per EUR",
    referenceLabel: "Synthetic illustration only — not sourced from ECB",
    referenceObservations: Object.freeze([
      Object.freeze({
        evidenceId: "ev-fx-reference-prior",
        observationDate: "2026-11-05",
        quotePerEur: 1.12,
      }),
      Object.freeze({
        evidenceId: "ev-fx-reference-current",
        observationDate: "2026-11-06",
        quotePerEur: 1.1,
      }),
    ]),
  }),
  fuelPriceAdjustment: Object.freeze({
    evidenceId: "ev-fuel-price-clause",
    clauseId: "cl-fuel-price-adjustment",
    obligationId: "ob-fuel-price-adjustment",
    clauseNumber: "9.6",
    page: 66,
    title: "Weekly fuel-price adjustment",
    excerpt: "Fuel surcharge shall be calculated weekly as 80% of the increase above the baseline of USD 2.00 per gallon in the U.S. Gulf Coast weekly kerosene-type jet fuel price, multiplied by 20,000 gallons per week, and the Lessee shall pay this adjustment.",
    baselinePrice: 2,
    passThroughPercent: 80,
    quantityGallons: 20000,
    adjustmentPeriod: "week",
    payingParty: "Lessee",
    observation: Object.freeze({
      evidenceId: "ev-fuel-price-observation",
      value: 2.15,
      unit: "USD per gallon",
      currency: "USD",
      market: "U.S. Gulf Coast",
      benchmark: "weekly kerosene-type jet fuel price",
      observationDate: "2026-11-06",
      source: "Synthetic benchmark illustration — not EIA or live data",
      synthetic: true,
    }),
    classification: "SYNTHETIC DEMO EXAMPLE — NOT CUSTOMER OR LIVE PRODUCT DATA",
  }),
  aircraftFinancing: Object.freeze({
    contractId: "OPN-2026-00216",
    contractTitle: "Synthetic Aircraft Financing Facility",
    contractRouteId: "demo-aircraft-financing",
    classification: "SYNTHETIC DEMO EXAMPLE — NOT CUSTOMER OR LIVE PRODUCT DATA",
    clause: Object.freeze({
      id: "ev-financing-interest-clause",
      clauseId: "cl-financing-interest",
      obligationId: "ob-financing-interest",
      number: "6.2",
      title: "Floating-rate aircraft financing",
      page: 34,
      excerpt: "The outstanding principal is USD 10,000,000 as of 2026-11-06. Interest shall accrue at a floating rate based on SOFR plus 250 basis points and reset monthly. The interest rate shall not exceed 7.50% and shall not fall below 1.00% per annum.",
    }),
    principal: Object.freeze({
      amount: 10_000_000,
      currency: "USD",
      asOf: "2026-11-06",
      evidenceId: "ev-financing-principal",
      basis: "synthetic_clause_fact",
    }),
    benchmark: Object.freeze({
      name: "SOFR",
      indicatorId: "interest.us.sofr",
      value: 3.92,
      unit: "percent per annum",
      currency: "USD",
      observationDate: "2026-11-06",
      evidenceId: "ev-financing-benchmark",
      source: "Synthetic benchmark assumption — not sourced from the New York Fed",
      synthetic: true,
    }),
    spreadBasisPoints: 250,
    resetFrequency: "monthly",
    capRatePercent: 7.5,
    floorRatePercent: 1,
  }),
  obligation: Object.freeze({
    id: "ob-utilisation",
    title: "Monitor cumulative aircraft flight-hour allowance",
  }),
  limit: Object.freeze({
    value: 5000,
    unit: "flight_hours",
    measurementPeriod: "during the Term",
  }),
  readings: Object.freeze([
    Object.freeze({
      evidenceId: "ev-utilisation-aug",
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      cumulativeValue: 3900,
      page: 142,
      source: "Synthetic August aircraft utilisation report",
    }),
    Object.freeze({
      evidenceId: "ev-utilisation-sep",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      cumulativeValue: 4100,
      page: 143,
      source: "Synthetic September aircraft utilisation report",
    }),
    Object.freeze({
      evidenceId: "ev-utilisation-oct",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      cumulativeValue: 4300,
      page: 144,
      source: "Synthetic October aircraft utilisation report",
    }),
  ]),
  syntheticOutcome: Object.freeze({
    evidenceId: "ev-utilisation-nov-outcome",
    periodStart: "2026-11-10",
    periodEnd: "2026-11-30",
    cumulativeValue: 4500,
    page: 152,
    source: "Synthetic November aircraft utilisation report",
    classification: "synthetic_actual_illustration",
  }),
  syntheticForecastSnapshot: Object.freeze({
    generatedAt: "2026-11-09T12:00:00.000Z",
    methodologyVersion: "phase55-utilisation-v1",
  }),
  updatedSyntheticObservation: Object.freeze({
    evidenceId: "ev-utilisation-dec-updated",
    periodStart: "2026-12-01",
    periodEnd: "2026-12-31",
    cumulativeValue: 4800,
    page: 153,
    source: "Synthetic December aircraft utilisation report",
  }),
  calendarYearAllowance: Object.freeze({
    clause: Object.freeze({
      id: "ev-utilisation-calendar-year-clause",
      number: "15.3",
      title: "Annual Aircraft Utilisation",
      page: 58,
      excerpt: "Cumulative flight hours shall not exceed 1,000 per calendar year. The Lessee shall submit monthly aircraft utilisation reports.",
    }),
    obligation: Object.freeze({
      id: "ob-calendar-year-utilisation",
      title: "Monitor cumulative calendar-year flight hours",
    }),
    limit: 1000,
    unit: "flight_hours",
    measurementPeriod: "per calendar year",
    readings: Object.freeze([
      Object.freeze({ evidenceId: "ev-utilisation-calendar-jan", periodStart: "2026-01-01", periodEnd: "2026-01-31", cumulativeValue: 100, page: 145, source: "Synthetic January calendar-year utilisation report" }),
      Object.freeze({ evidenceId: "ev-utilisation-calendar-feb", periodStart: "2026-02-01", periodEnd: "2026-02-28", cumulativeValue: 200, page: 146, source: "Synthetic February calendar-year utilisation report" }),
      Object.freeze({ evidenceId: "ev-utilisation-calendar-mar", periodStart: "2026-03-01", periodEnd: "2026-03-31", cumulativeValue: 300, page: 147, source: "Synthetic March calendar-year utilisation report" }),
      Object.freeze({ evidenceId: "ev-utilisation-calendar-apr", periodStart: "2026-04-01", periodEnd: "2026-04-30", cumulativeValue: 400, page: 148, source: "Synthetic April calendar-year utilisation report" }),
      Object.freeze({ evidenceId: "ev-utilisation-calendar-may", periodStart: "2026-05-01", periodEnd: "2026-05-31", cumulativeValue: 500, page: 149, source: "Synthetic May calendar-year utilisation report" }),
      Object.freeze({ evidenceId: "ev-utilisation-calendar-jun", periodStart: "2026-06-01", periodEnd: "2026-06-30", cumulativeValue: 600, page: 150, source: "Synthetic June calendar-year utilisation report" }),
      Object.freeze({ evidenceId: "ev-utilisation-calendar-jul", periodStart: "2026-07-01", periodEnd: "2026-07-31", cumulativeValue: 700, page: 151, source: "Synthetic July calendar-year utilisation report" }),
    ]),
  }),
  externalSources: Object.freeze([
    Object.freeze({ name: "Jet fuel", provider: "Synthetic illustration only — not EIA", status: "synthetic_example_only" }),
    Object.freeze({ name: "Foreign exchange", provider: "European Central Bank", status: "not_connected_in_demo" }),
    Object.freeze({ name: "Interest rates", provider: "Federal Reserve Bank of New York", status: "not_connected_in_demo" }),
  ]),
  outcomeStatus: "not_assessed",
  forecastEvaluationStatus: "not_available",
});

export function calculateSyntheticFuelPriceAdjustment(lease = SYNTHETIC_AIRCRAFT_LEASE) {
  const terms = lease.fuelPriceAdjustment;
  const observation = terms?.observation;
  const missingInputs = [];
  if (!terms?.evidenceId || !terms?.clauseId) missingInputs.push("a synthetic fuel adjustment clause citation");
  if (!Number.isFinite(terms?.baselinePrice) || terms.baselinePrice <= 0) missingInputs.push("a positive contractual USD-per-gallon baseline");
  if (!Number.isFinite(terms?.passThroughPercent) || terms.passThroughPercent <= 0 || terms.passThroughPercent > 100) {
    missingInputs.push("an explicit pass-through percentage from 0% to 100%");
  }
  if (!Number.isFinite(terms?.quantityGallons) || terms.quantityGallons <= 0) missingInputs.push("an explicit positive gallon quantity");
  if (!["week", "month", "quarter", "year"].includes(terms?.adjustmentPeriod)) missingInputs.push("a supported adjustment period");
  if (!terms?.payingParty) missingInputs.push("the explicitly identified paying party");
  if (
    !observation?.synthetic
    || !Number.isFinite(observation.value)
    || observation.value < 0
    || observation.unit !== "USD per gallon"
    || observation.currency !== "USD"
    || observation.market !== "U.S. Gulf Coast"
    || observation.benchmark !== "weekly kerosene-type jet fuel price"
    || !validDate(observation.observationDate)
  ) {
    missingInputs.push("a matching, explicitly synthetic benchmark observation with date, market, currency, and units");
  }
  if (missingInputs.length) {
    return {
      status: "insufficient_synthetic_data",
      missingInputs,
      syntheticOnly: true,
      reason: "The synthetic clause and reference values do not establish all calculation inputs; no missing value is assumed.",
    };
  }
  const unitIncrease = Math.max(0, observation.value - terms.baselinePrice);
  const amount = unitIncrease * terms.quantityGallons * (terms.passThroughPercent / 100);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount * 100))) {
    return {
      status: "insufficient_synthetic_data",
      missingInputs: ["a finite, supported synthetic calculation result"],
      syntheticOnly: true,
      reason: "The synthetic inputs exceed the supported calculation range.",
    };
  }
  return {
    status: "synthetic_calculated",
    syntheticOnly: true,
    methodology: "phase72-explicit-weekly-fuel-adjustment-v1",
    formula: `max(0, ${observation.value} − ${terms.baselinePrice}) × ${terms.quantityGallons} gallons/${terms.adjustmentPeriod} × ${terms.passThroughPercent}%`,
    baselinePrice: { amount: terms.baselinePrice, unit: "USD per gallon", evidenceId: terms.evidenceId },
    observation: { ...observation },
    unitIncrease: Number(unitIncrease.toFixed(4)),
    volume: { amount: terms.quantityGallons, unit: `gallons per ${terms.adjustmentPeriod}` },
    passThroughPercent: terms.passThroughPercent,
    adjustment: { amount: Number(amount.toFixed(2)), currency: "USD", period: terms.adjustmentPeriod },
    payingParty: terms.payingParty,
    evidenceIds: [terms.evidenceId, observation.evidenceId],
    disclosure: "Synthetic clause-derived illustration only. Not a live benchmark, customer cost, invoice, forecast, or net exposure.",
    limitations: [
      "The illustration uses only the explicit synthetic volume and weekly period.",
      "No taxes, delivery differential, FX conversion, inventory timing, or broader operating fuel use is modeled.",
      "No net recoverable exposure or invoice settlement is established.",
    ],
  };
}

export function calculateSyntheticInterestRateScenarios(
  financing = SYNTHETIC_AIRCRAFT_LEASE.aircraftFinancing,
  scenarioChanges = [0.5, 1, 2],
) {
  const missingInputs = [];
  const clause = financing?.clause;
  const principal = financing?.principal;
  const benchmark = financing?.benchmark;
  if (!clause?.id || !clause?.clauseId || !clause?.obligationId || !clause?.excerpt) {
    missingInputs.push("a synthetic financing clause and citation");
  }
  if (!Number.isFinite(principal?.amount) || principal.amount <= 0 || principal.currency !== "USD") {
    missingInputs.push("an explicit synthetic USD outstanding principal");
  }
  if (
    !benchmark?.synthetic
    || benchmark.name !== "SOFR"
    || benchmark.indicatorId !== "interest.us.sofr"
    || benchmark.unit !== "percent per annum"
    || benchmark.currency !== principal?.currency
    || !Number.isFinite(benchmark.value)
    || benchmark.value < 0
    || !validDate(benchmark.observationDate)
  ) {
    missingInputs.push("a matching, explicitly synthetic SOFR assumption with date, currency and units");
  }
  if (!Number.isFinite(financing?.spreadBasisPoints) || financing.spreadBasisPoints < 0) {
    missingInputs.push("an explicit synthetic contractual spread");
  }
  if (!["daily", "weekly", "monthly", "quarterly", "semi-annually", "annually"].includes(financing?.resetFrequency)) {
    missingInputs.push("a synthetic contractual reset frequency");
  }
  if (!Array.isArray(scenarioChanges) || scenarioChanges.length < 1 || scenarioChanges.length > 4
    || scenarioChanges.some((change) => !Number.isFinite(change) || change < -100 || change > 100)) {
    missingInputs.push("one to four finite benchmark changes in percentage points");
  }
  const cap = financing?.capRatePercent ?? null;
  const floor = financing?.floorRatePercent ?? null;
  if (
    cap !== null && (!Number.isFinite(cap) || cap < 0 || cap > 100)
    || floor !== null && (!Number.isFinite(floor) || floor < 0 || floor > 100)
    || cap !== null && floor !== null && floor > cap
  ) missingInputs.push("valid synthetic interest-rate cap and floor");
  if (missingInputs.length) {
    return {
      status: "insufficient_synthetic_data",
      missingInputs,
      syntheticOnly: true,
      reason: "The synthetic contract terms and benchmark do not establish all scenario calculation inputs; no missing value is assumed.",
    };
  }

  const applicableRate = (benchmarkPercent) => {
    let rate = benchmarkPercent + financing.spreadBasisPoints / 100;
    if (floor !== null) rate = Math.max(rate, floor);
    if (cap !== null) rate = Math.min(rate, cap);
    return rate;
  };
  const baselineApplicableRate = applicableRate(benchmark.value);
  const baselineAmount = principal.amount * baselineApplicableRate / 100;
  const scenarios = scenarioChanges.map((change, index) => {
    const scenarioBenchmarkPercent = benchmark.value + change;
    if (scenarioBenchmarkPercent < 0 || scenarioBenchmarkPercent > 100) {
      return {
        status: "insufficient_synthetic_data",
        label: `Synthetic scenario ${index + 1}`,
        reason: "The resulting synthetic benchmark assumption must be between 0% and 100%.",
      };
    }
    const rate = applicableRate(scenarioBenchmarkPercent);
    const amount = principal.amount * rate / 100;
    const difference = amount - baselineAmount;
    return {
      status: "synthetic_calculated",
      label: `SOFR ${change >= 0 ? "+" : ""}${change.toFixed(2)} percentage points`,
      scenarioChangePercentagePoints: change,
      assumedBenchmarkPercent: Number(scenarioBenchmarkPercent.toFixed(4)),
      applicableRatePercent: Number(rate.toFixed(6)),
      annualizedInterestExpense: {
        amount: Number(amount.toFixed(2)),
        currency: principal.currency,
        period: "year",
      },
      annualizedDifference: {
        amount: Number(difference.toFixed(2)),
        currency: principal.currency,
        period: "year",
      },
      percentageDifference: baselineAmount === 0
        ? null
        : Number(((difference / baselineAmount) * 100).toFixed(4)),
    };
  });
  if (!Number.isFinite(baselineAmount) || !Number.isSafeInteger(Math.round(baselineAmount * 100))
    || scenarios.some((scenario) => scenario.status === "synthetic_calculated"
      && !Number.isSafeInteger(Math.round(scenario.annualizedInterestExpense.amount * 100)))) {
    return {
      status: "insufficient_synthetic_data",
      missingInputs: ["a finite, supported synthetic calculation result"],
      syntheticOnly: true,
      reason: "The synthetic inputs exceed the supported calculation range.",
    };
  }

  return {
    status: "synthetic_calculated",
    syntheticOnly: true,
    methodology: "phase73-simple-annualized-financing-run-rate-v1",
    financingClassification: "floating_rate",
    benchmark: { ...benchmark },
    principal: { ...principal },
    spreadBasisPoints: financing.spreadBasisPoints,
    resetFrequency: financing.resetFrequency,
    capRatePercent: cap,
    floorRatePercent: floor,
    baseline: {
      applicableRatePercent: Number(baselineApplicableRate.toFixed(6)),
      annualizedInterestExpense: {
        amount: Number(baselineAmount.toFixed(2)),
        currency: principal.currency,
        period: "year",
      },
    },
    scenarios,
    evidenceIds: [clause.id, principal.evidenceId, benchmark.evidenceId].filter(Boolean),
    recommendation: {
      action: "Review the next repricing date, the stated cap and floor, and any hedge coverage; confirm the current balance and lender calculation before financing decisions.",
      supportingEvidenceIds: [clause.id, principal.evidenceId, benchmark.evidenceId].filter(Boolean),
    },
    disclosure: "Synthetic scenario illustration only. The principal, benchmark and outcomes are not customer data or live market observations, and assumptions are not forecasts.",
    limitations: [
      "Simple annualized balance run-rates only; no amortization, compounding, day-count convention, fees, tax, or actual payment schedule is modeled.",
      "No hedge notional, effectiveness, cost, or offset is assumed.",
      "The comparison does not imply a probability, expected loss, lender invoice, or net financing exposure.",
    ],
  };
}

export function calculateSyntheticUtilisationJourney(lease = SYNTHETIC_AIRCRAFT_LEASE) {
  const readings = lease.readings;
  const limit = Number(lease.limit?.value);
  if (!Array.isArray(readings) || readings.length < 3 || !Number.isFinite(limit) || limit <= 0) {
    return { status: "insufficient_synthetic_data", reason: "Three valid cumulative readings and a positive contractual limit are required." };
  }
  const points = readings.map((reading) => ({
    ...reading,
    endTime: Date.parse(`${reading.periodEnd}T00:00:00.000Z`),
  }));
  if (points.some((point) => !Number.isFinite(point.endTime)
    || !Number.isFinite(Number(point.cumulativeValue))
    || Number(point.cumulativeValue) < 0
    || point.periodStart > point.periodEnd)
    || points.some((point, index) => index > 0 && (
      point.periodStart <= points[index - 1].periodEnd
      || Number(point.cumulativeValue) <= Number(points[index - 1].cumulativeValue)
    ))) {
    return { status: "insufficient_synthetic_data", reason: "The synthetic readings are invalid, overlapping or non-increasing." };
  }
  const first = points[0];
  const previous = points.at(-2);
  const latest = points.at(-1);
  const elapsedDays = (latest.endTime - first.endTime) / DAY_MS;
  const averageDailyRate = (Number(latest.cumulativeValue) - Number(first.cumulativeValue)) / elapsedDays;
  const headroom = limit - Number(latest.cumulativeValue);
  if (elapsedDays <= 0 || averageDailyRate <= 0 || headroom <= 0) {
    return { status: "insufficient_synthetic_data", reason: "A positive remaining headroom and increasing daily rate are required for an estimate." };
  }
  const horizonDays = Math.ceil(headroom / averageDailyRate);
  const projected = new Date(latest.endTime + horizonDays * DAY_MS).toISOString().slice(0, 10);
  return {
    status: "synthetic_deterministic_estimate",
    contractualLimit: limit,
    recordedUtilisation: Number(latest.cumulativeValue),
    remainingHeadroom: headroom,
    consumedPercent: Number(((Number(latest.cumulativeValue) / limit) * 100).toFixed(1)),
    earlyWarning: {
      classification: Number(latest.cumulativeValue) / limit >= 0.8
        ? "approaching_limit_review"
        : "monitor",
      basis: "Existing Phase 54 80% consumed review convention; not a probability or breach determination.",
    },
    latestObservedChange: {
      from: {
        evidenceId: previous.evidenceId,
        observationDate: previous.periodEnd,
        cumulativeUtilisation: Number(previous.cumulativeValue),
      },
      to: {
        evidenceId: latest.evidenceId,
        observationDate: latest.periodEnd,
        cumulativeUtilisation: Number(latest.cumulativeValue),
      },
      observedDifference: Number(latest.cumulativeValue) - Number(previous.cumulativeValue),
      unit: lease.limit.unit,
    },
    averageDailyRate: Number(averageDailyRate.toFixed(4)),
    horizonDays,
    projectedThresholdDate: projected,
    coveredFrom: first.periodStart,
    coveredThrough: latest.periodEnd,
    observationCount: points.length,
    assumption: "Synthetic estimate applies the observed average calendar-day rate unchanged; it is not a forecast of breach or a probability.",
    recommendation: {
      priority: "review_with_operations_and_lease_owners",
      action: "Continue reviewing each retained monthly utilization report against the cumulative term allowance. If later records indicate likely excess use, review the applicable lease terms and discuss options with the lessor early.",
      supportingEvidenceIds: [lease.clause.id, latest.evidenceId],
    },
  };
}

export function calculateSyntheticOutcomeComparison(lease = SYNTHETIC_AIRCRAFT_LEASE) {
  const projection = calculateSyntheticUtilisationJourney(lease);
  const outcome = lease.syntheticOutcome;
  const latest = lease.readings?.at(-1);
  const generatedAt = new Date(lease.syntheticForecastSnapshot?.generatedAt);
  const generatedDate = Number.isFinite(generatedAt.getTime()) ? generatedAt.toISOString().slice(0, 10) : null;
  if (projection.status !== "synthetic_deterministic_estimate"
    || !outcome
    || !generatedDate
    || !validDate(outcome.periodStart)
    || !validDate(outcome.periodEnd)
    || outcome.periodStart > outcome.periodEnd
    || outcome.periodStart <= generatedDate
    || outcome.periodStart <= latest.periodEnd
    || outcome.periodEnd > projection.projectedThresholdDate
    || !Number.isFinite(Number(outcome.cumulativeValue))
    || Number(outcome.cumulativeValue) < Number(latest.cumulativeValue)) {
    return {
      status: "not_available",
      reason: "A subsequent synthetic cumulative example within the original projection horizon is required; no missing outcome is treated as zero.",
    };
  }
  const daysFromLastObservation = dateDifferenceDays(latest.periodEnd, outcome.periodEnd);
  const projectedCumulativeValue = Number(latest.cumulativeValue) + projection.averageDailyRate * daysFromLastObservation;
  const actualCumulativeValue = Number(outcome.cumulativeValue);
  const signedError = projectedCumulativeValue - actualCumulativeValue;
  return {
    status: "synthetic_descriptive_comparison",
    sampleSizeStatus: "insufficient_sample_size",
    methodology: lease.syntheticForecastSnapshot.methodologyVersion,
    forecastGeneratedAt: lease.syntheticForecastSnapshot.generatedAt,
    unit: lease.limit.unit,
    projectedCumulativeValue: Number(projectedCumulativeValue.toFixed(4)),
    actualCumulativeValue,
    signedError: Number(signedError.toFixed(4)),
    absoluteError: Number(Math.abs(signedError).toFixed(4)),
    percentageError: actualCumulativeValue >= 1
      ? Number(((Math.abs(signedError) / actualCumulativeValue) * 100).toFixed(2))
      : null,
    period: { start: outcome.periodStart, end: outcome.periodEnd },
    daysFromLastObservation,
    evidenceIds: [latest.evidenceId, outcome.evidenceId],
    disclosure: "Both the projection inputs and later outcome are synthetic illustrations, not independently verified customer evidence. This single example is not an accuracy or calibration claim.",
  };
}

export function reassessSyntheticUtilisation(lease = SYNTHETIC_AIRCRAFT_LEASE, observation = lease.updatedSyntheticObservation) {
  const previous = calculateSyntheticUtilisationJourney(lease);
  const latest = lease.readings?.at(-1);
  if (previous.status !== "synthetic_deterministic_estimate"
    || !observation
    || !validDate(observation.periodStart)
    || !validDate(observation.periodEnd)
    || observation.periodStart > observation.periodEnd
    || observation.periodStart <= latest.periodEnd
    || !Number.isFinite(Number(observation.cumulativeValue))
    || Number(observation.cumulativeValue) < Number(latest.cumulativeValue)
    || typeof observation.evidenceId !== "string"
    || !observation.evidenceId.trim()) {
    return {
      status: "not_available",
      reason: "A later, valid cumulative observation with explicit synthetic provenance is required; no missing value is inferred.",
    };
  }
  const updatedLease = {
    ...lease,
    readings: [...lease.readings, { ...observation, cumulativeValue: Number(observation.cumulativeValue) }],
  };
  const updated = calculateSyntheticUtilisationJourney(updatedLease);
  if (updated.status !== "synthetic_deterministic_estimate") {
    return { status: "not_available", reason: updated.reason || "The updated synthetic observation does not support a new deterministic estimate." };
  }
  return {
    status: "synthetic_reassessment",
    assessedAsOf: observation.periodEnd,
    observation: {
      evidenceId: observation.evidenceId,
      periodStart: observation.periodStart,
      periodEnd: observation.periodEnd,
      cumulativeValue: Number(observation.cumulativeValue),
      unit: lease.limit.unit,
    },
    previousProjection: {
      estimatedThresholdDate: previous.projectedThresholdDate,
      recordedUtilisation: previous.recordedUtilisation,
    },
    updatedProjection: {
      estimatedThresholdDate: updated.projectedThresholdDate,
      recordedUtilisation: updated.recordedUtilisation,
      remainingHeadroom: updated.remainingHeadroom,
      averageDailyRate: updated.averageDailyRate,
      methodology: "phase55-utilisation-v1",
    },
    syntheticOnly: true,
    persisted: false,
    disclosure: "Recalculated locally from synthetic historical readings and this updated synthetic report. It is not independently verified, persisted, monitored, or evidence of a customer outcome.",
  };
}

function dateDifferenceDays(start, end) {
  return (Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / DAY_MS;
}

export function calculateSyntheticCalendarYearProjection(lease = SYNTHETIC_AIRCRAFT_LEASE, asOf = "2026-08-09") {
  const allowance = lease.calendarYearAllowance;
  const readings = allowance?.readings;
  if (
    !Array.isArray(readings)
    || readings.length < 3
    || !Number.isFinite(allowance.limit)
    || allowance.limit <= 0
    || !/\bcalendar\s+year\b/i.test(String(allowance.measurementPeriod || ""))
    || !/\bper calendar year\b/i.test(String(allowance.clause?.excerpt || ""))
    || !validDate(asOf)
  ) {
    return { status: "insufficient_synthetic_data", reason: "A positive calendar-year allowance and at least three valid synthetic cumulative readings are required." };
  }
  const calendarYear = asOf.slice(0, 4);
  const yearStart = `${calendarYear}-01-01`;
  const yearEnd = `${calendarYear}-12-31`;
  const points = readings.map((reading) => ({
    ...reading,
    startDay: validDate(reading.periodStart) ? Date.parse(`${reading.periodStart}T00:00:00.000Z`) / DAY_MS : null,
    endDay: validDate(reading.periodEnd) ? Date.parse(`${reading.periodEnd}T00:00:00.000Z`) / DAY_MS : null,
  }));
  const valid = points.every((point, index) => (
    point.startDay !== null
    && point.endDay !== null
    && point.periodStart <= point.periodEnd
    && point.periodStart.slice(0, 4) === calendarYear
    && point.periodEnd.slice(0, 4) === calendarYear
    && Number.isFinite(point.cumulativeValue)
    && point.cumulativeValue >= 0
    && (!index || (
      point.startDay === points[index - 1].endDay + 1
      && point.cumulativeValue > points[index - 1].cumulativeValue
    ))
  ));
  const first = points[0];
  const latest = points.at(-1);
  const ageDays = validDate(latest.periodEnd)
    ? (Date.parse(`${asOf}T00:00:00.000Z`) - Date.parse(`${latest.periodEnd}T00:00:00.000Z`)) / DAY_MS
    : null;
  if (!valid || first.periodStart !== yearStart || ageDays < 0 || ageDays > 30 || latest.periodEnd > asOf) {
    return {
      status: "insufficient_synthetic_data",
      reason: "Synthetic readings must be contiguous, current, cumulative, and begin at the same calendar-year boundary as the cited allowance.",
    };
  }

  const elapsedDays = latest.endDay - first.startDay + 1;
  const horizonDays = (Date.parse(`${yearEnd}T00:00:00.000Z`) / DAY_MS) - latest.endDay;
  if (elapsedDays <= 0 || horizonDays <= 0) {
    return { status: "period_complete_or_invalid", reason: "No future portion of the current synthetic calendar year is available to project." };
  }
  const dailyRate = latest.cumulativeValue / elapsedDays;
  const annualizedConsumptionRate = dailyRate * 365;
  const projectedUtilisation = latest.cumulativeValue + dailyRate * horizonDays;
  const projectedExcess = Math.max(0, projectedUtilisation - allowance.limit);
  return {
    status: "synthetic_deterministic_projection",
    methodologyVersion: "phase67-calendar-year-run-rate-v1",
    classification: projectedExcess > 0
      ? "potential_exposure_developing"
      : projectedUtilisation >= allowance.limit * 0.8
        ? "monitoring_recommended"
        : "no_identified_material_exposure",
    unit: allowance.unit,
    contractualLimit: allowance.limit,
    annualizedConsumptionRate: Number(annualizedConsumptionRate.toFixed(2)),
    recordedUtilisation: latest.cumulativeValue,
    projectedUtilisationAtPeriodEnd: Number(projectedUtilisation.toFixed(2)),
    projectedExcessUnits: Number(projectedExcess.toFixed(2)),
    coverage: { observationCount: points.length, from: first.periodStart, through: latest.periodEnd },
    horizon: { start: latest.periodEnd, end: yearEnd, days: horizonDays },
    assumption: "The verified synthetic calendar-year cumulative usage rate to date continues unchanged through the end of the calendar year.",
    limitation: "This synthetic deterministic projection is not a guaranteed outcome, probability, breach finding, or financial penalty.",
    supportingEvidenceIds: [allowance.clause.id, ...readings.map((reading) => reading.evidenceId)],
  };
}

export function calculateSyntheticFxReferenceSensitivity({
  paymentAmount,
  referenceQuotePerEur,
  scenarioQuotePerEur,
} = {}) {
  if (
    !Number.isFinite(paymentAmount) || paymentAmount <= 0
    || !Number.isFinite(referenceQuotePerEur) || referenceQuotePerEur <= 0
    || !Number.isFinite(scenarioQuotePerEur) || scenarioQuotePerEur <= 0 || scenarioQuotePerEur > 1_000_000
  ) {
    return { status: "insufficient_synthetic_inputs" };
  }
  const referenceEquivalent = paymentAmount / referenceQuotePerEur;
  const scenarioEquivalent = paymentAmount / scenarioQuotePerEur;
  const change = scenarioEquivalent - referenceEquivalent;
  const changePercent = (change / referenceEquivalent) * 100;
  if (!Number.isFinite(referenceEquivalent) || !Number.isFinite(scenarioEquivalent) || !Number.isFinite(changePercent)) {
    return { status: "insufficient_synthetic_inputs" };
  }
  const round = (value) => Number(value.toFixed(2));
  return {
    status: "synthetic_deterministic_sensitivity",
    referenceEquivalent: round(referenceEquivalent),
    scenarioEquivalent: round(scenarioEquivalent),
    change: round(change),
    changePercent: round(changePercent),
  };
}

export function calculateSyntheticFxScenarioComparisons({
  paymentAmount,
  paymentCurrency,
  paymentDueDate,
  paymentEvidenceId,
  referenceQuotePerEur,
  referenceRateUnit,
  referenceEvidenceId,
  scenarios,
} = {}) {
  if (
    !Array.isArray(scenarios)
    || scenarios.length < 1
    || scenarios.length > 4
    || typeof paymentCurrency !== "string"
    || !validDate(paymentDueDate)
    || !paymentEvidenceId
    || !referenceRateUnit
    || !referenceEvidenceId
  ) return { status: "insufficient_synthetic_inputs", scenarios: [] };

  const comparisons = scenarios.map((scenario, index) => {
    const label = typeof scenario?.label === "string" ? scenario.label.trim() : "";
    const sensitivity = calculateSyntheticFxReferenceSensitivity({
      paymentAmount,
      referenceQuotePerEur,
      scenarioQuotePerEur: scenario?.quotePerEur,
    });
    if (!label || sensitivity.status !== "synthetic_deterministic_sensitivity") {
      return { status: "insufficient_synthetic_inputs", label: label || `Scenario ${index + 1}` };
    }

    return {
      status: sensitivity.status,
      scenarioId: `synthetic-fx-scenario-${index + 1}`,
      label,
      assumption: {
        quotePerEur: scenario.quotePerEur,
        unit: referenceRateUnit,
        type: "synthetic_user_assumption",
      },
      baselineObservation: {
        value: referenceQuotePerEur,
        unit: referenceRateUnit,
        evidenceId: referenceEvidenceId,
        sourceType: "synthetic_demo_only",
      },
      baselineResult: { amount: sensitivity.referenceEquivalent, currency: "EUR" },
      scenarioResult: { amount: sensitivity.scenarioEquivalent, currency: "EUR" },
      signedDifference: { amount: sensitivity.change, currency: "EUR" },
      absoluteDifference: { amount: Math.abs(sensitivity.change), currency: "EUR" },
      percentageDifference: sensitivity.changePercent,
      payment: {
        amount: paymentAmount,
        currency: paymentCurrency,
        dueDate: paymentDueDate,
      },
      evidenceReferences: [paymentEvidenceId, referenceEvidenceId],
      methodology: "phase64-fx-reference-sensitivity-v1",
      recommendation: {
        status: "synthetic_recommendation_only",
        action: "Review the cited payment currency and hedge context with treasury; no customer action is performed.",
      },
      contractualImpactExplanation: `The hypothetical ${referenceRateUnit} assumption changes the EUR reference equivalent for the cited ${paymentAmount.toLocaleString("en-GB")} ${paymentCurrency} payment from ${sensitivity.referenceEquivalent.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to ${sensitivity.scenarioEquivalent.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
      notForecast: true,
      synthetic: true,
    };
  });
  return {
    status: comparisons.every((item) => item.status === "synthetic_deterministic_sensitivity")
      ? "synthetic_scenario_comparison"
      : "insufficient_synthetic_inputs",
    comparisons,
    synthetic: true,
    notForecast: true,
  };
}

export function calculateSyntheticFxReferenceMovement({
  paymentAmount,
  paymentDueDate,
  referenceObservations,
  asOf = "2026-11-09",
} = {}) {
  if (
    !Number.isFinite(paymentAmount) || paymentAmount <= 0
    || !validDate(paymentDueDate)
    || !validDate(asOf)
    || !Array.isArray(referenceObservations)
  ) return { status: "insufficient_synthetic_inputs" };

  const observations = referenceObservations
    .filter((item) => validDate(item?.observationDate)
      && Number.isFinite(item?.quotePerEur)
      && item.quotePerEur > 0
      && typeof item.evidenceId === "string"
      && item.evidenceId.trim())
    .sort((left, right) => left.observationDate.localeCompare(right.observationDate));
  if (
    observations.length < 2
    || observations.at(-1).observationDate === observations.at(-2).observationDate
  ) return { status: "insufficient_synthetic_inputs" };

  const previous = observations.at(-2);
  const current = observations.at(-1);
  const intervalDays = Math.floor(
    (Date.parse(`${current.observationDate}T00:00:00.000Z`) - Date.parse(`${previous.observationDate}T00:00:00.000Z`)) / DAY_MS,
  );
  const ageDays = Math.floor(
    (Date.parse(`${asOf}T00:00:00.000Z`) - Date.parse(`${current.observationDate}T00:00:00.000Z`)) / DAY_MS,
  );
  if (current.observationDate > asOf) return { status: "insufficient_synthetic_inputs" };
  if (ageDays > 7) {
    return {
      status: "stale_synthetic_data",
      freshnessStatus: "stale",
      currentObservation: current,
      ageDays,
      reason: "The latest synthetic reference observation is older than the illustrative seven-day freshness window; no current movement warning is shown.",
    };
  }
  const previousEquivalent = paymentAmount / previous.quotePerEur;
  const currentEquivalent = paymentAmount / current.quotePerEur;
  const change = currentEquivalent - previousEquivalent;
  const daysUntilPayment = Math.floor(
    (Date.parse(`${paymentDueDate}T00:00:00.000Z`) - Date.parse(`${asOf}T00:00:00.000Z`)) / DAY_MS,
  );
  if (
    !Number.isFinite(previousEquivalent)
    || !Number.isFinite(currentEquivalent)
    || !Number.isFinite(change)
    || !Number.isFinite(daysUntilPayment)
    || intervalDays <= 0
    || intervalDays > 5
  ) return { status: "insufficient_synthetic_inputs" };

  const round = (value) => Number(value.toFixed(2));
  return {
    status: "synthetic_reference_comparison",
    classification: change > 0 && daysUntilPayment >= 0 && daysUntilPayment <= 30
      ? "attention_required"
      : "monitor",
    previousObservation: previous,
    currentObservation: current,
    freshnessStatus: "synthetic_current",
    ageDays,
    intervalDays,
    previousReferenceEquivalent: round(previousEquivalent),
    currentReferenceEquivalent: round(currentEquivalent),
    referenceEquivalentChange: round(change),
    referenceEquivalentChangePercent: round((change / previousEquivalent) * 100),
    currency: "EUR",
    daysUntilPayment,
    recommendation: "Review the cited payment with treasury; confirm the actual settlement rate, reporting currency, and hedge status.",
    supportingEvidenceIds: [
      previous.evidenceId,
      current.evidenceId,
    ],
    limitations: [
      "Rates, dates, and results are synthetic illustration inputs and are not sourced from the ECB.",
      "EUR values are reference equivalents, not transaction prices, incurred loss, or the organization's reporting-currency amount.",
      "The comparison describes observed synthetic values only; it is not a forecast.",
    ],
  };
}
