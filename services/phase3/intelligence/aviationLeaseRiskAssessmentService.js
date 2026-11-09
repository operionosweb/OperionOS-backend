import { monitorDeadlines } from "./deadlineMonitoringService.js";
import { deriveAviationLeaseFinancialExposure } from "./aviationLeaseFinancialExposureService.js";

const ASSESSMENT_PRIORITY = Object.freeze({
  not_assessed: "informational",
  pending_evidence: "informational",
  insufficient_evidence: "low",
  evidence_submitted: "low",
  under_review: "low",
  partially_fulfilled: "medium",
  not_fulfilled: "high",
  disputed: "high",
  fulfilled: "informational",
});

const PRIORITY_ORDER = Object.freeze({
  informational: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
});

const SEVERITY_FOR_PRIORITY = Object.freeze({
  informational: "low",
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
});

const UTILIZATION_APPROACHING_PERCENT = 80;
const UTILIZATION_NUMBER = "(?<![\\d,.])-?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?(?![\\d,]|\\.(?=\\d))";
const UTILIZATION_MINIMUM_OBSERVATIONS = 3;
const UTILIZATION_MAX_AGE_DAYS = 30;

function classificationFor(profile) {
  let classification = profile?.classification;
  if (typeof classification === "string") {
    try {
      classification = JSON.parse(classification);
    } catch {
      return null;
    }
  }
  return classification;
}

function utilizationMetric(unit) {
  return /\bhour/i.test(unit) ? "flight_hours" : "flight_cycles";
}

function utilizationNumber(value) {
  const parsed = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function explicitUtilizationLimits(text) {
  const limits = new Map();
  const sentences = String(text || "").split(/(?<=[.;!?])\s+|\n+/);
  const capPattern = /\b(?:not\s+(?:to\s+)?exceed|no\s+more\s+than|maximum(?:\s+permitted)?(?:\s+of)?|limit(?:ed)?\s+(?:to|of)|capped?\s+at|up\s+to|in\s+excess\s+of)\b/i;
  const measurementPattern = new RegExp(`(${UTILIZATION_NUMBER})\\s*(flight\\s+hours?|flight\\s+cycles?)\\b`, "gi");
  const addLimit = (unit, value) => {
    if (!limits.has(unit)) limits.set(unit, value);
    else if (limits.get(unit) !== value) limits.set(unit, null);
  };

  for (const sentence of sentences) {
    const cap = capPattern.exec(sentence);
    if (!cap) continue;
    const values = [...sentence.slice(cap.index).matchAll(measurementPattern)];
    for (const match of values) {
      const value = utilizationNumber(match[1]);
      if (value === null) continue;
      const unit = utilizationMetric(match[2]);
      addLimit(unit, value);
    }
  }

  const suffixPattern = new RegExp(`\\b(${UTILIZATION_NUMBER})\\s*(flight\\s+hours?|flight\\s+cycles?)\\s+(?:maximum|limit)\\b`, "gi");
  for (const match of String(text || "").matchAll(suffixPattern)) {
    const value = utilizationNumber(match[1]);
    if (value === null) continue;
    const unit = utilizationMetric(match[2]);
    addLimit(unit, value);
  }
  return limits;
}

function explicitMinimumUtilizationLimits(text) {
  const limits = new Map();
  const sentences = String(text || "").split(/(?<=[.;!?])\s+|\n+/);
  const minimumPattern = /\b(?:at\s+least|minimum(?:\s+of)?|not\s+less\s+than|no\s+less\s+than)\b/gi;
  const directionPattern = /\b(?:at\s+least|minimum(?:\s+of)?|not\s+less\s+than|no\s+less\s+than|not\s+(?:to\s+)?exceed|no\s+more\s+than|maximum(?:\s+permitted)?(?:\s+of)?|limit(?:ed)?\s+(?:to|of)|capped?\s+at|up\s+to|in\s+excess\s+of)\b/gi;
  const measurementPattern = new RegExp(`(${UTILIZATION_NUMBER})\\s*(flight\\s+hours?|flight\\s+cycles?)\\b`, "gi");
  for (const sentence of sentences) {
    const directions = [...sentence.matchAll(directionPattern)];
    for (const minimum of sentence.matchAll(minimumPattern)) {
      const start = minimum.index + minimum[0].length;
      const nextDirection = directions.find((item) => item.index > minimum.index);
      const clauseFragment = sentence.slice(start, nextDirection?.index ?? sentence.length);
      for (const match of clauseFragment.matchAll(measurementPattern)) {
        const value = utilizationNumber(match[1]);
        if (value === null) continue;
        const unit = utilizationMetric(match[2]);
        if (!limits.has(unit)) limits.set(unit, value);
        else if (limits.get(unit) !== value) limits.set(unit, null);
      }
    }
  }
  return limits;
}

export function hasExplicitAircraftLeaseUtilisationLimit(clauseText) {
  return explicitUtilizationLimits(clauseText).size > 0
    || explicitMinimumUtilizationLimits(clauseText).size > 0;
}

function contractualUtilizationPeriod(text) {
  const source = String(text || "");
  const match = source.match(/\b(?:during|in|for)\s+(?:each|every)\s+(lease|calendar)\s+year\b|\bper\s+(lease|calendar)\s+year\b|\bper\s+(annum|month|quarter)\b/i);
  if (!match) return null;
  if (match[1] || match[2]) return `each ${match[1] || match[2]} year`;
  return match[3].toLowerCase() === "annum" ? "per annum" : `per ${match[3].toLowerCase()}`;
}

function parseUtilizationReading(evidence, metric) {
  const excerpt = String(evidence.excerpt || "");
  const label = metric === "flight_hours" ? "hours?" : "cycles?";
  const patterns = [
    new RegExp(`\\b(?:recorded|actual|total|reported)\\s+(?:flight\\s+)?${label}\\s*(?:were|was|is|:|=)?\\s*(${UTILIZATION_NUMBER})\\b`, "i"),
    new RegExp(`\\b(?:flight\\s+)?${label}\\s+(?:recorded|actual|total|reported)\\s*(?:were|was|is|:|=)?\\s*(${UTILIZATION_NUMBER})\\b`, "i"),
    new RegExp(`\\b(?:recorded|actual|total|reported)\\s+utili[sz]ation\\s*[:=]\\s*(${UTILIZATION_NUMBER})\\s+flight\\s+${label}`, "i"),
    new RegExp(`\\b(${UTILIZATION_NUMBER})\\s+flight\\s+${label}\\s+(?:recorded|actual|total|reported)\\b`, "i"),
  ];
  for (const pattern of patterns) {
    const match = excerpt.match(pattern);
    if (!match) continue;
    return { found: true, value: utilizationNumber(match[1]) };
  }
  return { found: false, value: null };
}

function parseCumulativeUtilizationReading(evidence, metric) {
  const excerpt = String(evidence.excerpt || "");
  const cumulativeMarker = /\b(?:cumulative|to[- ]date|year[- ]to[- ]date|lease[- ]year[- ]to[- ]date|current\s+lease[- ]year)\b/i;
  if (!cumulativeMarker.test(excerpt)) return { found: false, value: null };
  const unit = metric === "flight_hours" ? "hours?" : "cycles?";
  const patterns = [
    new RegExp(`\\b(?:cumulative|to[- ]date|year[- ]to[- ]date|lease[- ]year[- ]to[- ]date|current\\s+lease[- ]year(?:\\s+cumulative)?)\\s+(?:(?:recorded|actual|total|reported)\\s+)?(?:flight\\s+)?${unit}\\s*(?:were|was|is|:|=)?\\s*(${UTILIZATION_NUMBER})\\b`, "i"),
    new RegExp(`\\b(?:recorded|actual|total|reported)\\s+(?:cumulative\\s+|to[- ]date\\s+|year[- ]to[- ]date\\s+|lease[- ]year[- ]to[- ]date\\s+)(?:flight\\s+)?${unit}\\s*(?:were|was|is|:|=)?\\s*(${UTILIZATION_NUMBER})\\b`, "i"),
    new RegExp(`\\b(?:flight\\s+)?${unit}\\s+(?:cumulative|to[- ]date|year[- ]to[- ]date)\\s*(?:were|was|is|:|=)?\\s*(${UTILIZATION_NUMBER})\\b`, "i"),
    new RegExp(`\\b(?:total\\s+)?(?:flight\\s+)?${unit}\\s+(?:to[- ]date|year[- ]to[- ]date|cumulative)\\s*(?:were|was|is|:|=)?\\s*(${UTILIZATION_NUMBER})\\b`, "i"),
  ];
  for (const pattern of patterns) {
    const match = excerpt.match(pattern);
    if (match) return { found: true, value: utilizationNumber(match[1]) };
  }
  return { found: false, value: null };
}

function parseReportingPeriod(excerpt) {
  const range = String(excerpt || "").match(
    /\b(?:(?:reporting\s+)?period(?:\s+covered)?\s*[:=]\s*|from\s+)(\d{4}-\d{2}-\d{2})\s+(?:to|through|until)\s+(\d{4}-\d{2}-\d{2})\b/i
  );
  if (!range) return null;
  const [, start, end] = range;
  const validDate = (value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!validDate(start) || !validDate(end) || start > end) return { invalid: true };
  return { start, end };
}

function completeUtilizationPeriod(measurementPeriod, period, asOf) {
  if (
    !measurementPeriod
    || !period
    || dateOnlyDay(period.start) === null
    || dateOnlyDay(period.end) === null
    || period.start > period.end
    || period.end > asOf
  ) return false;
  const start = new Date(`${period.start}T00:00:00.000Z`);
  const end = new Date(`${period.end}T00:00:00.000Z`);
  if (/calendar\s+year/i.test(measurementPeriod)) {
    return start.getUTCMonth() === 0 && start.getUTCDate() === 1
      && end.getUTCFullYear() === start.getUTCFullYear()
      && end.getUTCMonth() === 11 && end.getUTCDate() === 31;
  }
  if (/month/i.test(measurementPeriod)) {
    return start.getUTCDate() === 1
      && end.getUTCFullYear() === start.getUTCFullYear()
      && end.getUTCMonth() === start.getUTCMonth()
      && end.getUTCDate() === new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  }
  if (/quarter/i.test(measurementPeriod)) {
    const quarterStartMonth = Math.floor(start.getUTCMonth() / 3) * 3;
    return start.getUTCDate() === 1
      && start.getUTCMonth() === quarterStartMonth
      && end.getUTCFullYear() === start.getUTCFullYear()
      && end.getUTCMonth() === quarterStartMonth + 2
      && end.getUTCDate() === new Date(Date.UTC(start.getUTCFullYear(), quarterStartMonth + 3, 0)).getUTCDate();
  }
  if (/lease\s+year|annum/i.test(measurementPeriod)) {
    const anniversary = new Date(start);
    anniversary.setUTCFullYear(anniversary.getUTCFullYear() + 1);
    anniversary.setUTCDate(anniversary.getUTCDate() - 1);
    return anniversary.toISOString().slice(0, 10) === period.end;
  }
  return false;
}

function dateOnlyDay(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? Math.floor(date.getTime() / 86_400_000)
    : null;
}

function dateAfterDays(value, days) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeHistoricalEvidence(item) {
  return {
    evidenceId: item.evidenceId || item.evidence_id || item.id,
    documentName: item.documentName || item.document_name || null,
    versionNumber: item.versionNumber ?? item.version_number ?? null,
    sourceLocator: item.sourceLocator || item.source_locator || null,
    pageNumber: item.pageNumber || item.page_number || null,
    excerpt: item.excerpt || null,
    confidence: item.confidence ?? null,
    reviewStatus: item.reviewStatus || item.review_status || null,
    ambiguityReason: item.ambiguityReason || item.ambiguity_reason || null,
    relationship: item.relationship || null,
    periodStatus: item.periodStatus || item.period_status || null,
  };
}

function insufficientForecast(metric, status, reason, details = {}) {
  return {
    unit: metric,
    status,
    reason,
    forecastReliability: status,
    contractualLimit: details.contractualLimit ?? null,
    contractualMeasurementPeriod: details.contractualMeasurementPeriod || null,
    observations: details.observations || [],
    sources: details.sources || [],
    financialExposure: { status: "not_calculated", amount: null, reason: "No supported contractual charge methodology and complete inputs were established." },
  };
}

function deriveMetricForecast({ metric, limit, measurementPeriod, history, latestAssessmentStatus, asOf, deadlineDate }) {
  const details = { contractualLimit: limit, contractualMeasurementPeriod: measurementPeriod };
  if (limit === null) {
    return insufficientForecast(metric, "ambiguous_contract_limit", "The source clause contains conflicting numeric limits for this unit; no forecast was made.", details);
  }
  if (!measurementPeriod) {
    return insufficientForecast(metric, "contract_period_missing", "The contractual measurement period is not explicit in the source clause; no forecast was made.", details);
  }
  if (latestAssessmentStatus !== "fulfilled") {
    return insufficientForecast(metric, "unapproved_evidence", "The latest reviewer assessment does not approve the utilization obligation as fulfilled; no forecast was made.", details);
  }

  const matchingEvidence = [];
  let unsupportedCumulativeReading = false;
  for (const assessment of history) {
    if (assessment.status !== "fulfilled") continue;
    for (const rawEvidence of assessment.evidence || []) {
      const evidence = normalizeHistoricalEvidence(rawEvidence);
      if (!new RegExp(`\\bflight\\s+${metric === "flight_hours" ? "hours?" : "cycles?"}\\b`, "i").test(evidence.excerpt || "")) continue;
      const reading = parseCumulativeUtilizationReading(evidence, metric);
      if (!reading.found) {
        unsupportedCumulativeReading = true;
        continue;
      }
      matchingEvidence.push({ evidence, reading, period: parseReportingPeriod(evidence.excerpt) });
    }
  }
  if (unsupportedCumulativeReading) {
    return insufficientForecast(metric, "inconsistent_evidence", "Linked evidence includes utilization values that are not explicitly cumulative; period totals were not treated as cumulative readings.", details);
  }
  if (!matchingEvidence.length) {
    return insufficientForecast(metric, "missing_evidence", "No reviewer-linked cumulative utilization observations were available.", details);
  }
  if (matchingEvidence.some(({ evidence }) => evidence.reviewStatus !== "verified"
    || evidence.relationship !== "supports"
    || evidence.periodStatus !== "matches")) {
    return insufficientForecast(metric, "unapproved_evidence", "Every utilization observation must be verified, supporting, and reviewer-marked as period-matched.", {
      ...details,
      sources: matchingEvidence.map(({ evidence }) => evidence),
    });
  }
  if (matchingEvidence.some(({ reading, period }) => reading.value === null || !period || period.invalid)) {
    return insufficientForecast(metric, "invalid_evidence", "A utilization value or reporting date range is invalid or missing; no forecast was made.", {
      ...details,
      sources: matchingEvidence.map(({ evidence }) => evidence),
    });
  }

  const byPeriod = new Map();
  for (const item of matchingEvidence) {
    const key = `${item.period.start}:${item.period.end}`;
    const existing = byPeriod.get(key);
    if (existing && existing.reading.value !== item.reading.value) {
      return insufficientForecast(metric, "inconsistent_evidence", "Different cumulative readings cover the same reporting period; no forecast was made.", details);
    }
    if (existing) existing.sources.push(item.evidence);
    else byPeriod.set(key, { ...item, sources: [item.evidence] });
  }
  const observations = [...byPeriod.values()].sort((left, right) => left.period.start.localeCompare(right.period.start));
  for (let index = 1; index < observations.length; index += 1) {
    if (observations[index].period.start <= observations[index - 1].period.end) {
      return insufficientForecast(metric, "overlapping_periods", "Utilization reporting periods overlap; no forecast was made.", {
        ...details,
        observations: observations.map(({ period, reading }) => ({ ...period, cumulativeUtilisation: reading.value })),
      });
    }
  }
  for (let index = 1; index < observations.length; index += 1) {
    if (dateOnlyDay(observations[index].period.start) !== dateOnlyDay(observations[index - 1].period.end) + 1) {
      return insufficientForecast(metric, "missing_periods", "There is a gap between reporting periods; missing periods were not treated as zero utilization.", {
        ...details,
        observations: observations.map(({ period, reading }) => ({ ...period, cumulativeUtilisation: reading.value })),
      });
    }
  }
  if (observations.length < UTILIZATION_MINIMUM_OBSERVATIONS) {
    return insufficientForecast(metric, "limited_history", `At least ${UTILIZATION_MINIMUM_OBSERVATIONS} distinct, contiguous, fulfilled reporting periods are required; no forecast was made.`, {
      ...details,
      observations: observations.map(({ period, reading }) => ({ ...period, cumulativeUtilisation: reading.value })),
      sources: observations.flatMap((item) => item.sources),
    });
  }

  const latest = observations.at(-1);
  const asOfDay = dateOnlyDay(asOf);
  const latestDay = dateOnlyDay(latest.period.end);
  if (asOfDay === null || latestDay === null) {
    return insufficientForecast(metric, "invalid_date", "The assessment date or latest reporting date is invalid; no forecast was made.", details);
  }
  if (latestDay > asOfDay) {
    return insufficientForecast(metric, "invalid_date", "The latest utilization reporting period is in the future; no forecast was made.", details);
  }
  if (asOfDay - latestDay > UTILIZATION_MAX_AGE_DAYS) {
    return insufficientForecast(metric, "outdated_evidence", `The latest utilization observation is older than ${UTILIZATION_MAX_AGE_DAYS} days; refresh evidence before forecasting.`, {
      ...details,
      observations: observations.map(({ period, reading }) => ({ ...period, cumulativeUtilisation: reading.value })),
      sources: observations.flatMap((item) => item.sources),
    });
  }

  const intervalRates = [];
  for (let index = 1; index < observations.length; index += 1) {
    const previous = observations[index - 1];
    const current = observations[index];
    const days = dateOnlyDay(current.period.end) - dateOnlyDay(previous.period.end);
    const consumed = current.reading.value - previous.reading.value;
    if (days <= 0 || consumed < 0) {
      return insufficientForecast(metric, "invalid_consumption", "Cumulative utilization decreased or reporting dates are not increasing; no forecast was made.", details);
    }
    if (consumed === 0) {
      return insufficientForecast(metric, "zero_consumption_anomaly", "A zero-consumption interval makes the utilization rate ambiguous; no forecast was made.", details);
    }
    intervalRates.push(consumed / days);
  }

  const totalElapsedDays = dateOnlyDay(latest.period.end) - dateOnlyDay(observations[0].period.end);
  const totalConsumed = latest.reading.value - observations[0].reading.value;
  if (totalElapsedDays <= 0 || totalConsumed <= 0) {
    return insufficientForecast(metric, "invalid_consumption", "A positive average daily consumption rate could not be established; no forecast was made.", details);
  }

  const averageDailyConsumption = totalConsumed / totalElapsedDays;
  const firstRate = intervalRates[0];
  const lastRate = intervalRates.at(-1);
  const trend = intervalRates.length < 2 ? "insufficient_intervals"
    : lastRate > firstRate * 1.05 ? "increasing"
      : lastRate < firstRate * 0.95 ? "decreasing" : "stable";
  const headroom = limit - latest.reading.value;
  const thresholdReached = headroom <= 0;
  const estimatedDaysToThreshold = thresholdReached ? 0 : Math.ceil(headroom / averageDailyConsumption);
  const projectedThresholdDate = thresholdReached ? null : dateAfterDays(latest.period.end, estimatedDaysToThreshold);
  const validDeadline = deadlineDate && dateOnlyDay(deadlineDate) !== null ? deadlineDate : null;
  const deadlineComparison = !validDeadline || !projectedThresholdDate ? null : {
    deadlineDate: validDeadline,
    projectedToReachBeforeDeadline: projectedThresholdDate <= validDeadline,
  };

  return {
    unit: metric,
    status: thresholdReached ? "threshold_reached" : "forecast_available",
    forecastReliability: "sufficient_verified_evidence",
    contractualLimit: limit,
    contractualMeasurementPeriod: measurementPeriod,
    currentVerifiedUtilisation: latest.reading.value,
    remainingHeadroom: headroom,
    averageDailyConsumption: Number(averageDailyConsumption.toFixed(4)),
    intervalDailyConsumption: intervalRates.map((rate, index) => ({
      from: observations[index].period.end,
      to: observations[index + 1].period.end,
      value: Number(rate.toFixed(4)),
    })),
    historicalTrend: trend,
    observations: observations.map(({ period, reading }) => ({ ...period, cumulativeUtilisation: reading.value })),
    evidenceCoverage: {
      observationCount: observations.length,
      coveredFrom: observations[0].period.start,
      coveredThrough: latest.period.end,
      reportingPeriodsContiguous: true,
    },
    lastObservedDate: latest.period.end,
    estimatedDaysToThreshold,
    projectedThresholdDate,
    deadlineComparison,
    forecastAssumption: "Estimate assumes the observed average calendar-day consumption rate continues unchanged; it is not a guaranteed outcome and does not model planned or disrupted operations.",
    sources: observations.flatMap((item) => item.sources),
    financialExposure: {
      status: "not_calculated",
      amount: null,
      reason: "No explicit excess-utilization charging formula and complete calculation inputs were established.",
    },
  };
}

export function deriveAircraftLeaseUtilisationForecast({
  clauseText,
  history = [],
  asOf = new Date().toISOString().slice(0, 10),
  deadlineDate = null,
} = {}) {
  const limits = explicitUtilizationLimits(clauseText);
  const measurementPeriod = contractualUtilizationPeriod(clauseText);
  const metrics = ["flight_hours", "flight_cycles"]
    .filter((metric) => limits.has(metric))
    .map((metric) => deriveMetricForecast({
      metric,
      limit: limits.get(metric),
      measurementPeriod,
      history,
      latestAssessmentStatus: history[0]?.status || null,
      asOf,
      deadlineDate,
    }));
  return {
    applicable: metrics.length > 0,
    measurementPeriod,
    metrics,
  };
}

function utilizationDataStatus({ candidates, asOf, allowCompletedPeriod = false }) {
  if (!candidates.length) return { status: "unavailable", reason: "No explicit numeric utilization figure is present in linked operational evidence." };
  if (candidates.some((item) => item.reading.value === null)) {
    return { status: "invalid", reason: "A linked utilization figure is invalid or negative; no calculation was made." };
  }

  const complete = candidates.filter((item) => item.period && !item.period.invalid);
  if (!complete.length) {
    const invalidPeriod = candidates.some((item) => item.period?.invalid);
    return {
      status: invalidPeriod ? "invalid" : "incomplete",
      reason: invalidPeriod
        ? "A linked reporting period is invalid; no calculation was made."
        : "A complete reporting date range is missing; no utilization calculation was made.",
    };
  }
  if (complete.some((item) => item.period.start > asOf)) {
    return { status: "invalid", reason: "The linked reporting period begins after the assessment date; no calculation was made." };
  }
  if (complete.some((item) => item.period.end > asOf)) {
    return { status: "invalid", reason: "The linked reporting period ends after the assessment date; no calculation was made." };
  }
  const current = allowCompletedPeriod
    ? complete
    : complete.filter((item) => item.period.end >= asOf);
  if (!current.length) {
    return { status: "stale", reason: "Linked utilization evidence ends before the assessment date; refresh the operational records." };
  }
  if (allowCompletedPeriod && current.some((item) => {
    const ageDays = dateOnlyDay(asOf) - dateOnlyDay(item.period.end);
    return ageDays > UTILIZATION_MAX_AGE_DAYS;
  })) {
    return { status: "stale", reason: `Completed-period utilization evidence is older than ${UTILIZATION_MAX_AGE_DAYS} days; refresh the records before assessing the minimum.` };
  }
  if (current.length !== candidates.length) {
    return { status: "incomplete", reason: "Some linked utilization evidence lacks a complete current reporting period; no calculation was made." };
  }
  if (current.some((item) => item.evidence.reviewStatus !== "verified")) {
    return { status: "unverified", reason: "Utilization source evidence is not verified; no calculation was made." };
  }
  if (current.some((item) => item.evidence.relationship !== "supports" || item.evidence.periodStatus !== "matches")) {
    return { status: "period_mismatch", reason: "Utilization evidence is not marked as supporting and matching the contractual period; no calculation was made." };
  }

  const periods = new Set(current.map((item) => `${item.period.start}:${item.period.end}`));
  if (periods.size !== 1) {
    return { status: "ambiguous", reason: "Linked utilization sources cover different reporting periods; no calculation was made." };
  }
  const values = new Set(current.map((item) => item.reading.value));
  if (values.size !== 1) {
    return { status: "ambiguous", reason: "Linked verified sources report conflicting utilization values for the same period; no calculation was made." };
  }
  return {
    status: "available",
    value: current[0].reading.value,
    period: current[0].period,
    sources: current.map(({ evidence }) => ({
      evidenceId: evidence.evidenceId,
      documentName: evidence.documentName || null,
      versionNumber: evidence.versionNumber ?? null,
      sourceLocator: evidence.sourceLocator || null,
      pageNumber: evidence.pageNumber || null,
      excerpt: evidence.excerpt || null,
      confidence: evidence.confidence ?? null,
      reviewStatus: evidence.reviewStatus || null,
      relationship: evidence.relationship || null,
      periodStatus: evidence.periodStatus || null,
    })),
  };
}

function deriveUtilizationExposure(clause, operationalEvidence, assessment, asOf, history, deadlineDate, scope) {
  const limits = explicitUtilizationLimits(clause.source_text);
  const minimums = explicitMinimumUtilizationLimits(clause.source_text);
  if (!limits.size && !minimums.size) return null;
  const assessmentAllowsUsage = ["evidence_submitted", "under_review", "fulfilled"].includes(assessment?.status);
  const measurementPeriod = contractualUtilizationPeriod(clause.source_text);
  const requirements = [
    ...[...limits].map(([unit, limit]) => ({ unit, threshold: limit, direction: "maximum" })),
    ...[...minimums].map(([unit, limit]) => ({ unit, threshold: limit, direction: "minimum" })),
  ];
  const metrics = requirements.map(({ unit, threshold, direction }) => {
    const candidates = operationalEvidence
      .map((evidence) => ({
        evidence,
        reading: parseUtilizationReading(evidence, unit),
        period: parseReportingPeriod(evidence.excerpt),
      }))
      .filter((item) => item.reading.found);
    const data = assessmentAllowsUsage
      ? utilizationDataStatus({ candidates, asOf, allowCompletedPeriod: direction === "minimum" })
      : { status: candidates.length ? "unverified" : "unavailable", reason: candidates.length
        ? "The latest human assessment does not support a utilization calculation; review its evidence and status."
        : "No explicit numeric utilization figure is present in linked operational evidence." };
    const metric = {
      unit,
      direction,
      contractualLimit: direction === "maximum" ? threshold : null,
      contractualMinimum: direction === "minimum" ? threshold : null,
      contractualMeasurementPeriod: measurementPeriod,
      recordedUtilisation: null,
      headroom: null,
      remainingRequirement: null,
      consumedPercent: null,
      status: data.status,
      reason: data.reason || null,
      reportingPeriod: null,
      sources: data.sources || [],
      forecast: direction === "minimum"
        ? insufficientForecast(unit, "minimum_requirement_forecast_not_supported", "Minimum-utilization attainment is not projected; no future operating rate or shortfall consequence is assumed.", {
          contractualLimit: null,
          contractualMeasurementPeriod: measurementPeriod,
        })
        : deriveMetricForecast({
          metric: unit,
          limit: threshold,
          measurementPeriod,
          history,
          latestAssessmentStatus: history[0]?.status || null,
          asOf,
          deadlineDate,
        }),
    };
    const withFinancialExposure = (value) => ({
      ...value,
      financialExposure: direction === "minimum"
        ? {
          status: "not_calculated",
          reason: "A verified contractual shortfall charge and calculation formula are not established; no monetary minimum-utilization penalty is inferred.",
          current: { status: "not_calculated", amount: null, currency: null },
          projected: { status: "not_calculated", amount: null, currency: null },
          limitations: ["A minimum-utilization shortfall is an operational quantity, not a financial amount without an express applicable contractual formula."],
        }
        : deriveAviationLeaseFinancialExposure({
          clause,
          unit,
          contractualLimit: threshold,
          contractualMeasurementPeriod: measurementPeriod,
          assessmentStatus: assessment?.status || "not_assessed",
          currentUtilisationStatus: value.status,
          currentUtilisation: value.recordedUtilisation,
          currentReportingPeriod: value.reportingPeriod,
          currentSources: value.sources,
          forecast: value.forecast,
          asOf,
          contractId: scope.contractId,
          contractVersionId: scope.documentVersionId,
        }),
    });
    if (threshold === null) {
      metric.status = direction === "minimum" ? "ambiguous_contract_minimum" : "ambiguous_contract_limit";
      metric.reason = `The cited clause contains conflicting numeric ${direction} thresholds for this utilization unit; no comparison was made.`;
      return withFinancialExposure(metric);
    }
    if (data.status !== "available") return withFinancialExposure(metric);

    if (direction === "minimum") {
      if (!completeUtilizationPeriod(measurementPeriod, data.period, asOf)) {
        return withFinancialExposure({
          ...metric,
          recordedUtilisation: data.value,
          status: "minimum_period_incomplete",
          reason: "The verified reading does not establish a complete contractual minimum-utilisation period; no shortfall comparison was made.",
          reportingPeriod: data.period,
          sources: data.sources,
        });
      }
      const status = data.value < threshold ? "below_minimum"
        : data.value === threshold ? "at_minimum" : "above_minimum";
      return withFinancialExposure({
        ...metric,
        recordedUtilisation: data.value,
        remainingRequirement: Math.max(0, threshold - data.value),
        status,
        reason: null,
        reportingPeriod: data.period,
        sources: data.sources,
      });
    }

    const consumedPercent = threshold === 0
      ? data.value === 0 ? 0 : null
      : (data.value / threshold) * 100;
    const status = threshold === 0
      ? data.value === 0 ? "at_limit" : "exceeded"
      : data.value > threshold ? "exceeded"
        : data.value === threshold ? "at_limit"
          : consumedPercent >= UTILIZATION_APPROACHING_PERCENT ? "approaching" : "within_limit";
    return withFinancialExposure({
      ...metric,
      recordedUtilisation: data.value,
      headroom: threshold - data.value,
      consumedPercent: consumedPercent === null ? null : Number(consumedPercent.toFixed(2)),
      status,
      reason: null,
      reportingPeriod: data.period,
      sources: data.sources,
    });
  });
  return {
    approachingThresholdPercent: UTILIZATION_APPROACHING_PERCENT,
    metrics,
  };
}

function aviationCategory(obligation, clause) {
  const obligationType = String(obligation.obligation_type || "").toLowerCase();
  const text = [
    obligation.description,
    obligation.action,
    obligation.object,
    clause.title,
    clause.category,
    clause.source_text,
  ].filter(Boolean).join(" ").toLowerCase();

  if (
    /\bflight\s+(?:hours?|cycles?)\b/.test(text)
    && (explicitUtilizationLimits(clause.source_text).size || explicitMinimumUtilizationLimits(clause.source_text).size)
  ) {
    return {
      category: "utilization",
      riskCategory: "maintenance/operational",
      subject: "aircraft utilization limit",
      action: "Compare period-matched flight-hour and flight-cycle records with the cited contractual allowance; review any expressly linked excess-usage terms with the authorized operations and finance owners before calculating a charge.",
    };
  }
  if (obligationType === "redelivery" || /\b(redeliver|redelivery|return of (?:the )?aircraft)\b/.test(text)) {
    return {
      category: "redelivery",
      riskCategory: "delivery/redelivery",
      subject: "aircraft redelivery",
      action: "Assign the lease-return owner to reconcile each cited aircraft condition and technical-record requirement; record evidence for each item.",
    };
  }
  if (obligationType === "insurance" || /\b(aviation|hull|aircraft liability|insurance certificate|insured party|insurance coverage)\b/.test(text)) {
    return {
      category: "insurance",
      riskCategory: "insurance",
      subject: "aircraft insurance",
      action: "Obtain current insurance certificates and compare coverage, insured parties, and effective dates with the cited lease clause.",
    };
  }
  if (obligationType === "delivery" || /\b(delivery condition|aircraft delivery|delivery documentation|acceptance requirements|technical records at delivery)\b/.test(text)) {
    return {
      category: "delivery",
      riskCategory: "delivery/redelivery",
      subject: "aircraft delivery",
      action: "Request the cited aircraft delivery documents and reconcile each express acceptance condition with source evidence.",
    };
  }
  if (/\b(monthly rent|lease rent|rental payment|maintenance reserve payment|pay monthly maintenance reserve|pay monthly aircraft rent)\b/.test(text)) {
    const maintenanceReserve = /\bmaintenance reserve\b/.test(text);
    return {
      category: "financial",
      riskCategory: "financial",
      subject: maintenanceReserve ? "maintenance-reserve payment" : "aircraft lease payment",
      action: maintenanceReserve
        ? "Review the next aircraft lease maintenance-reserve payment against the cited contractual basis and retain the operational period evidence."
        : "Review the upcoming lease payment against the cited clause, confirm the applicable period and payment owner, and retain payment evidence.",
    };
  }
  if (obligationType === "maintenance" || /\b(maintenance|technical records|airworthiness records|maintenance reserve)\b/.test(text)) {
    return {
      category: "maintenance",
      riskCategory: "maintenance/operational",
      subject: "aircraft maintenance",
      action: /\b(reserve|payment|pay|rate)\b/.test(text)
        ? "Review the next aircraft lease maintenance-reserve payment against the cited contractual basis and retain the operational period evidence."
        : "Request the cited maintenance release and technical records, then reconcile any outstanding item with the authorized maintenance owner.",
    };
  }
  return null;
}

function deadlinePriority(deadline) {
  if (!deadline) return null;
  if (deadline.monitoring.status === "passed") {
    return deadline.review_status === "verified" ? "high" : "informational";
  }
  if (deadline.monitoring.status === "due_today") return "high";
  if (deadline.monitoring.status === "approaching") return "medium";
  if (deadline.monitoring.status === "unverified_date") return "informational";
  return null;
}

function assessmentAction(category, status) {
  if (status === "disputed") {
    return `Reconcile the conflicting ${category.subject} evidence with the authorized lease and operational owners before closing the review.`;
  }
  if (status === "not_fulfilled") {
    return `Escalate the human-reviewed ${category.subject} assessment to its authorized owner and document the follow-up; this is not a legal breach determination.`;
  }
  if (status === "partially_fulfilled") {
    return `Identify which cited ${category.subject} requirements remain unsupported and request period-matched evidence for those items.`;
  }
  if (status === "insufficient_evidence" || status === "pending_evidence" || status === "not_assessed") {
    return `${category.action} Missing evidence is not proof of non-fulfilment.`;
  }
  if (status === "evidence_submitted" || status === "under_review") {
    return `Review the submitted ${category.subject} evidence, source quality, and applicable period before recording a conclusion.`;
  }
  return category.action;
}

function sourceEvidence(clause) {
  return (clause.evidence || [])
    .filter((link) => link.source && link.source.review_status !== "rejected")
    .map((link) => ({
      evidenceId: link.evidence_id,
      sourceLocator: link.source.source_locator || null,
      pageNumber: link.source.page_number || null,
      excerpt: link.source.excerpt,
      confidence: link.source.confidence ?? null,
      reviewStatus: link.source.review_status || "pending",
      ambiguityReason: link.source.ambiguity_reason || null,
      supportType: link.support_type || "supports",
      isPrimary: Boolean(link.is_primary),
    }));
}

function operationalEvidence(assessment) {
  return (assessment?.evidence || []).map((item) => ({
    evidenceId: item.evidence_id || item.id,
    documentName: item.document_name || null,
    versionNumber: item.version_number ?? null,
    sourceLocator: item.source_locator || null,
    pageNumber: item.page_number || null,
    excerpt: item.excerpt || null,
    confidence: item.confidence ?? null,
    reviewStatus: item.review_status || null,
    ambiguityReason: item.ambiguity_reason || null,
    relationship: item.relationship,
    periodStatus: item.period_status,
  }));
}

function uncertaintyIndicators(evidence, assessment) {
  const indicators = [];
  for (const item of evidence) {
    if (item.reviewStatus !== "verified") indicators.push(`Evidence ${item.evidenceId} has review status ${item.reviewStatus}.`);
    if (item.ambiguityReason) indicators.push(`Evidence ${item.evidenceId}: ${item.ambiguityReason}`);
    if (Number.isFinite(Number(item.confidence)) && Number(item.confidence) < 0.85) {
      indicators.push(`Evidence ${item.evidenceId} has extraction confidence ${Math.round(Number(item.confidence) * 100)}%; this is extraction quality, not a probability of non-compliance.`);
    }
    if (item.periodStatus && item.periodStatus !== "matches") {
      indicators.push(`Evidence ${item.evidenceId} period is ${item.periodStatus}.`);
    }
  }
  if (!assessment) indicators.push("No human fulfilment assessment has been recorded; absence of evidence does not establish non-fulfilment.");
  return [...new Set(indicators)];
}

export function deriveAviationLeaseRiskAssessment({
  profile,
  scope,
  clauses = [],
  obligations = [],
  deadlines = [],
  latestAssessments = [],
  utilizationHistoryByObligation = {},
  asOf,
} = {}) {
  const classification = classificationFor(profile);
  if (classification?.type !== "AIRCRAFT_LEASE" || classification?.status !== "confirmed") {
    return {
      applicable: false,
      reason: "A confirmed aircraft lease classification is required before aviation lease risk assessment.",
      risks: [],
    };
  }

  const clausesById = new Map(clauses.map((clause) => [clause.id, clause]));
  const assessmentsByObligation = new Map(latestAssessments.map((assessment) => [assessment.obligation_id, assessment]));
  const monitoredDeadlines = monitorDeadlines(deadlines, { asOf });
  const asOfDate = typeof asOf === "string" ? asOf : (asOf || new Date()).toISOString().slice(0, 10);
  const risks = [];
  const chargedUtilizationClauseUnits = new Set();

  for (const obligation of obligations) {
    if (!obligation.id || !obligation.clause_id || !obligation.description) continue;
    const clause = clausesById.get(obligation.clause_id);
    if (!clause?.id || !clause.source_text) continue;
    const category = aviationCategory(obligation, clause);
    if (!category) continue;
    const contractEvidence = sourceEvidence(clause);
    if (!contractEvidence.length) continue;

    const assessment = assessmentsByObligation.get(obligation.id) || null;
    const assessmentStatus = assessment?.status || "not_assessed";
    const deadlinesForObligation = monitoredDeadlines.filter((deadline) => (
      deadline.obligation_id === obligation.id && deadline.source_evidence_id
    ));
    const deadline = deadlinesForObligation
      .sort((left, right) => (left.monitoring.daysRemaining ?? Number.MAX_SAFE_INTEGER)
        - (right.monitoring.daysRemaining ?? Number.MAX_SAFE_INTEGER))[0] || null;
    const assessedPriority = ASSESSMENT_PRIORITY[assessmentStatus] || "informational";
    const timedPriority = deadlinePriority(deadline);
    let priority = timedPriority && PRIORITY_ORDER[timedPriority] > PRIORITY_ORDER[assessedPriority]
      ? timedPriority
      : assessedPriority;
    const operational = operationalEvidence(assessment);
    const utilizationHistory = utilizationHistoryByObligation[obligation.id] || [];
    const verifiedForecastDeadlines = deadlinesForObligation
      .filter((item) => item.review_status === "verified" && dateOnlyDay(item.absolute_date) !== null
        && item.absolute_date >= asOfDate)
      .sort((left, right) => left.absolute_date.localeCompare(right.absolute_date));
    const utilizationExposure = category.category === "utilization"
      ? deriveUtilizationExposure(
        clause,
        operational,
        assessment,
        asOfDate,
        utilizationHistory,
        verifiedForecastDeadlines[0]?.absolute_date || null,
        scope,
      )
      : null;
    for (const metric of utilizationExposure?.metrics || []) {
      const financial = metric.financialExposure;
      const key = `${scope.organizationId}:${scope.contractId}:${scope.documentVersionId}:${clause.id}:${metric.direction}:${metric.unit}`;
      const hasPositiveExposure = (financial.current?.amount || 0) > 0 || (financial.projected?.amount || 0) > 0;
      if (!hasPositiveExposure) continue;
      if (chargedUtilizationClauseUnits.has(key)) {
        const reason = "The same contract-version clause and utilization unit is already represented by another obligation; this duplicate was not counted.";
        metric.financialExposure = {
          ...financial,
          status: "duplicate_not_aggregated",
          reason,
          current: { status: "duplicate_not_aggregated", amount: null, currency: financial.currency, reason },
          projected: { status: "duplicate_not_aggregated", amount: null, currency: financial.currency, reason },
          limitations: [...(financial.limitations || []), reason],
        };
      } else {
        chargedUtilizationClauseUnits.add(key);
      }
    }
    const forecastSources = utilizationExposure?.metrics.flatMap((metric) => metric.forecast?.sources || []) || [];
    const riskOperationalEvidence = [...new Map(
      [...operational, ...forecastSources]
        .filter((item) => item?.evidenceId)
        .map((item) => [item.evidenceId, item]),
    ).values()];
    const uncertainty = uncertaintyIndicators([...contractEvidence, ...riskOperationalEvidence], assessment);
    const previouslyAtRisk = ["disputed", "not_fulfilled", "partially_fulfilled", "insufficient_evidence"].includes(assessment?.previous_status);
    const forecastMetrics = utilizationExposure?.metrics.map((metric) => metric.forecast) || [];
    const usableForecast = forecastMetrics.find((item) => ["forecast_available", "threshold_reached"].includes(item.status));
    const financialMetrics = utilizationExposure?.metrics.map((metric) => metric.financialExposure) || [];
    const currentFinancialExposure = financialMetrics.find((item) => item.current?.status === "currently_demonstrated_exposure");
    const projectedFinancialExposure = financialMetrics.find((item) => item.projected?.status === "potential_future_exposure");
    const minimumShortfall = utilizationExposure?.metrics.find((metric) => (
      metric.direction === "minimum" && metric.status === "below_minimum"
    ));
    if (minimumShortfall && PRIORITY_ORDER[priority] < PRIORITY_ORDER.medium) priority = "medium";
    const hasFinancialReview = Boolean(currentFinancialExposure || projectedFinancialExposure);
    const resolved = assessmentStatus === "fulfilled" && previouslyAtRisk && !timedPriority && !usableForecast && !hasFinancialReview;
    if (assessmentStatus === "fulfilled" && !timedPriority && !previouslyAtRisk
      && category.category !== "utilization") continue;

    const deadlineStatus = deadline?.monitoring.status || null;
    const riskStatus = resolved
      ? "resolved"
      : usableForecast || hasFinancialReview || minimumShortfall
        ? "requires_review"
        : ["disputed", "not_fulfilled", "partially_fulfilled", "insufficient_evidence", "pending_evidence", "under_review", "evidence_submitted"].includes(assessmentStatus)
        ? "requires_review"
        : "identified";
    const title = resolved
      ? `Previously identified ${category.subject} concern reviewed`
      : currentFinancialExposure
        ? "Verified aircraft utilization indicates contractual excess-charge exposure"
        : projectedFinancialExposure
          ? "Projected aircraft utilization may incur contractual excess charges"
          : minimumShortfall
            ? "Recorded aircraft utilization is below a stated contractual minimum"
      : assessmentStatus === "fulfilled" && category.category === "utilization" && usableForecast?.status === "threshold_reached"
        ? "Recorded aircraft utilization is at or above the contractual limit"
        : assessmentStatus === "fulfilled" && category.category === "utilization" && usableForecast
          ? "Aircraft utilization threshold projection available"
          : assessmentStatus === "fulfilled" && category.category === "utilization"
            ? "Review aircraft utilization history"
      : assessmentStatus === "disputed"
        ? `Conflicting ${category.subject} evidence`
        : assessmentStatus === "not_fulfilled"
          ? `Human assessment identifies an outstanding ${category.subject} obligation`
          : assessmentStatus === "partially_fulfilled"
            ? `Partial evidence for ${category.subject} obligation`
            : deadlineStatus === "passed"
              ? `${category.subject} deadline date has passed`
              : deadlineStatus === "due_today"
                ? `${category.subject} deadline is today`
                : deadlineStatus === "approaching"
                  ? `${category.subject} deadline is approaching`
                  : `Review evidence for ${category.subject} obligation`;
    const baseDescription = resolved
      ? "A later human assessment records the obligation as fulfilled. The earlier assessment remains in history."
      : assessmentStatus === "fulfilled" && category.category === "utilization" && usableForecast
        ? usableForecast.status === "threshold_reached"
          ? "The latest verified cumulative utilization reading is at or above the cited limit. Confirm the measurement and applicable lease terms with the authorized operations and lease owners; this is not a legal breach determination."
          : `Verified historical utilization supports an estimate that the ${usableForecast.unit.replace("_", " ")} limit may be reached on ${usableForecast.projectedThresholdDate}. This estimate assumes the observed average rate continues; it is not a prediction of breach or a probability.`
        : assessmentStatus === "fulfilled" && minimumShortfall
          ? `Verified recorded utilization is ${minimumShortfall.remainingRequirement} ${minimumShortfall.unit.replace("_", " ")} below the stated minimum for the reviewer-matched period. This is a measurement for review, not a breach or penalty determination.`
        : assessmentStatus === "fulfilled" && category.category === "utilization"
          ? `No reliable historical utilization forecast is available: ${forecastMetrics.map((item) => item.reason).filter(Boolean).join(" ")} Current contractual and recorded values, when available, remain distinct from estimates.`
      : assessmentStatus === "not_assessed" && deadlineStatus === "passed"
        ? "The extracted contractual date has passed, but no human fulfilment assessment is recorded. The date alone does not establish whether the action was completed or whether non-fulfilment occurred."
        : assessmentStatus === "not_assessed" && ["due_today", "approaching"].includes(deadlineStatus)
          ? "The contract states this aircraft lease obligation and its date is approaching, but no operational fulfilment assessment is recorded. This evidence gap is not proof of non-fulfilment."
      : assessmentStatus === "not_assessed"
          ? category.category === "utilization"
            ? "The cited lease clause sets an aircraft flight-hour or flight-cycle limit, but no period-matched utilization records are linked. The clause alone does not establish that the limit has been reached or exceeded."
            : "The contract states this aircraft lease obligation, but no operational fulfilment assessment is recorded. This evidence gap is not proof of non-fulfilment."
        : assessmentStatus === "not_fulfilled"
          ? "A human reviewer recorded the obligation as not fulfilled based on cited contradictory operational evidence. This is not an automated breach determination."
          : assessmentStatus === "disputed"
            ? "A human reviewer recorded conflicting supporting and contradictory operational evidence. The conflict remains unresolved."
            : assessmentStatus === "partially_fulfilled"
              ? "A human reviewer recorded partial fulfilment; the remaining contractual scope requires follow-up."
              : deadlineStatus === "passed"
                ? "The extracted contractual date has passed, but the date alone does not establish whether the action was completed."
                : deadlineStatus === "due_today"
                  ? "The verified contractual date is today. The date alone does not establish performance or non-performance."
                  : deadlineStatus === "approaching"
                    ? "The verified contractual date is within the 30-day planning window; this is not a prediction that the obligation will be missed."
                    : `The latest human assessment is ${assessmentStatus.replaceAll("_", " ")}; review the operational evidence and applicable period.`;
    const financialDescription = currentFinancialExposure
      ? ` The verified recorded utilization produces a current contractual excess-charge exposure of ${currentFinancialExposure.current.amount} ${currentFinancialExposure.current.currency} for ${currentFinancialExposure.contractualProvision.unit.replace("_", " ")}. This is a calculation from the cited clause, not an invoice or legal liability.`
      : projectedFinancialExposure
        ? ` At the explicitly stated contractual measurement date ${projectedFinancialExposure.projected.measurementDate}, continued historical utilization would produce an estimated ${projectedFinancialExposure.projected.amount} ${projectedFinancialExposure.projected.currency} exposure for ${projectedFinancialExposure.contractualProvision.unit.replace("_", " ")}. This is a projection, not an incurred liability.`
        : "";
    const description = `${baseDescription}${financialDescription}`;
    const utilizationStatuses = utilizationExposure?.metrics.map((metric) => metric.status) || [];
    const forecastDeadlineComparison = forecastMetrics.find((item) => item.deadlineComparison);
    const action = resolved
      ? "Retain the assessment and cited evidence; continue monitoring any later recurring payment or maintenance period separately."
      : currentFinancialExposure
        ? `Have the aircraft operations, finance, and lease owners verify the ${currentFinancialExposure.current.excessUnits} excess ${currentFinancialExposure.contractualProvision.unit.replace("_", " ")} against the cited ${currentFinancialExposure.contractualProvision.rate.currency} ${currentFinancialExposure.contractualProvision.rate.amount} rate and confirm any applicable contractual cap before processing or discussing a charge.`
        : projectedFinancialExposure
          ? `Review the projected ${projectedFinancialExposure.projected.amount} ${projectedFinancialExposure.projected.currency} ${projectedFinancialExposure.contractualProvision.unit.replace("_", " ")} exposure before the contractual measurement date ${projectedFinancialExposure.projected.measurementDate}; increase utilisation monitoring with the aircraft operations owner.`
          : minimumShortfall
            ? `Confirm the period-matched ${minimumShortfall.unit.replace("_", " ")} reading and the applicable minimum-utilization and any express shortfall terms with the aircraft operations and lease owners; no penalty is inferred.`
      : usableForecast?.status === "threshold_reached"
        ? "Confirm the latest cumulative flight-hour or flight-cycle reading with the authorized operations owner, reconcile its reporting period to the cited lease clause, and review any expressly stated excess-usage terms before discussing lessor action."
        : forecastDeadlineComparison
          ? `Compare the estimated ${forecastDeadlineComparison.unit.replace("_", " ")} threshold date of ${forecastDeadlineComparison.projectedThresholdDate} with the verified contractual deadline of ${forecastDeadlineComparison.deadlineComparison.deadlineDate}; the estimate is ${forecastDeadlineComparison.deadlineComparison.projectedToReachBeforeDeadline ? "on or before" : "after"} that date. Increase utilisation monitoring with the aircraft operations owner.`
          : usableForecast
            ? `Review the estimated ${usableForecast.unit.replace("_", " ")} threshold date of ${usableForecast.projectedThresholdDate} with the aircraft operations owner and refresh verified cumulative utilization evidence regularly; the constant-rate estimate is not a breach claim.`
      : utilizationStatuses.includes("exceeded")
        ? "Validate the period-matched flight-hour and flight-cycle records against the cited cap and review any expressly stated excess-usage terms with the authorized operations, finance, and lease owners; confirm the evidence before discussing any lessor action."
        : utilizationStatuses.includes("approaching") || utilizationStatuses.includes("at_limit")
          ? "Monitor aircraft flight-hour and flight-cycle utilization more frequently against the cited lease caps; review remaining headroom with the authorized operations owner and consider a lessor discussion only if supported by the contract and current operational evidence."
      : timedPriority && ["passed", "due_today", "approaching"].includes(deadlineStatus)
        ? deadline.recommended_action || category.action
        : assessmentAction(category, assessmentStatus);
    const rationale = category.category === "utilization"
      ? currentFinancialExposure || projectedFinancialExposure
        ? "The utilization-related financial estimate uses an explicit reviewer-verified excess-unit rate and allowance from the cited clause, verified operational evidence, and—when projected—the deterministic Phase 55 average-rate assumption through an explicitly stated measurement date. It is not a confirmed liability, invoice, or legal conclusion."
        : "The contractual ceiling is derived from the cited clause. Recorded cumulative usage is kept separate from any deterministic rate estimate, which is based only on verified reviewer-approved historical evidence. Neither a projection nor an approaching threshold establishes breach or a charge."
      : `${resolved ? "Resolved by a subsequent human assessment. " : ""}This screening finding is derived from the cited aircraft lease clause and available assessment/deadline records. Priority describes review urgency, not legal liability.`;

    risks.push({
      id: `aviation-lease-obligation-${obligation.id}`,
      contract_id: scope.contractId,
      obligation_id: obligation.id,
      obligation_description: obligation.description,
      obligation_review_status: obligation.review_status || null,
      clause_id: clause.id,
      risk_category: category.riskCategory,
      risk_type: `aviation_lease_${category.category}_review`,
      title,
      description,
      rationale,
      severity: SEVERITY_FOR_PRIORITY[priority],
      priority: priority.toUpperCase(),
      status: riskStatus,
      assessment_status: assessmentStatus,
      evidence_state: assessmentStatus === "disputed" ? "conflicting"
        : assessmentStatus === "not_assessed" || assessmentStatus === "insufficient_evidence" ? "insufficient"
          : assessmentStatus === "fulfilled" ? "reviewed" : "human_review",
      deadline_information: deadline ? {
        id: deadline.id,
        absoluteDate: deadline.absolute_date || null,
        expression: deadline.timing_expression || deadline.original_expression || null,
        status: deadlineStatus,
        reviewRequired: deadline.monitoring.reviewRequired,
        daysRemaining: deadline.monitoring.daysRemaining,
        asOf: deadline.monitoring.asOf,
      } : null,
      recommended_action: action,
      contract_evidence: contractEvidence,
      operational_evidence: riskOperationalEvidence,
      utilisation_exposure: utilizationExposure,
      utilisation_financial_exposure: utilizationExposure?.metrics.map((metric) => metric.financialExposure) || [],
      evidence_confidence: {
        contract: contractEvidence.map(({ evidenceId, confidence, reviewStatus }) => ({ evidenceId, confidence, reviewStatus })),
        operational: riskOperationalEvidence.map(({ evidenceId, confidence, reviewStatus }) => ({ evidenceId, confidence, reviewStatus })),
      },
      uncertainty_indicators: uncertainty,
      source_references: [
        { source_type: "clause", source_id: clause.id },
        { source_type: "obligation", source_id: obligation.id },
        ...(deadline ? [{ source_type: "deadline", source_id: deadline.id }] : []),
        ...(assessment?.id ? [{ source_type: "fulfilment_assessment", source_id: assessment.id }] : []),
        ...contractEvidence.map((item) => ({ source_type: "contract_evidence", source_id: item.evidenceId })),
        ...riskOperationalEvidence.map((item) => ({ source_type: "operational_evidence", source_id: item.evidenceId })),
      ],
      affected_obligation_ids: [obligation.id],
      affected_deadline_ids: deadline ? [deadline.id] : [],
      financial_exposure: null,
      probability: null,
      derived: true,
      metadata: {
        deterministic: true,
        read_time_derived: true,
        aircraft_lease_only: true,
        confidence_is_not_probability: true,
      },
    });
  }

  return { applicable: true, reason: null, risks };
}
