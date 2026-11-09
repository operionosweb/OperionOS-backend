import { randomUUID } from "node:crypto";
import { INFLATION_SERIES, INDEXATION_METHOD, parseIndexationTerms, calculateIndexation } from "../../../shared/aviationIndexation.js";
import { assertOrganizationScope, assertResourceId } from "../../../repositories/phase3/scope.js";
import { createExternalAviationObservationRepository } from "../../../repositories/phase3/externalAviationObservationRepository.js";
import { createAviationContractualExposureAssessment } from "./aviationContractualExposureAssessment.js";
import {
  createExternalAviationSignalService,
  EXTERNAL_SIGNAL_SOURCES,
} from "./externalAviationSignalService.js";

const AVIATION_CONTRACT_TYPES = new Set([
  "AIRCRAFT_LEASE",
  "AIRCRAFT_PURCHASE",
  "MRO",
  "ENGINE_MAINTENANCE",
  "POWER_BY_HOUR",
  "COMPONENT_SUPPORT",
  "INSURANCE",
  "GROUND_HANDLING",
  "AIRPORT_SERVICES",
  "SUPPLIER",
  "FINANCING",
]);
const CONTRACT_CURRENCIES = new Set([
  "AUD", "CAD", "CHF", "CNY", "DKK", "EUR", "GBP", "HKD", "JPY",
  "NOK", "NZD", "SEK", "SGD", "USD",
]);
const INDICATOR_RULES = Object.freeze({
  ...Object.fromEntries(Object.values(INFLATION_SERIES).map((series) => [series.indicatorId, { ...series, category: "inflation" }])),
  "fuel.jet.us.gulf_coast": { category: "fuel", sourceId: "eia", unit: "USD per gallon", currency: "USD", maxAgeDays: 14 },
  "fx.eur.usd": { category: "fx", sourceId: "ecb", unit: "USD per EUR", currency: "USD", baseCurrency: "EUR", quoteCurrency: "USD", maxAgeDays: 7 },
  "fx.eur.gbp": { category: "fx", sourceId: "ecb", unit: "GBP per EUR", currency: "GBP", baseCurrency: "EUR", quoteCurrency: "GBP", maxAgeDays: 7 },
  "fx.eur.chf": { category: "fx", sourceId: "ecb", unit: "CHF per EUR", currency: "CHF", baseCurrency: "EUR", quoteCurrency: "CHF", maxAgeDays: 7 },
  "fx.eur.jpy": { category: "fx", sourceId: "ecb", unit: "JPY per EUR", currency: "JPY", baseCurrency: "EUR", quoteCurrency: "JPY", maxAgeDays: 7 },
  "fx.eur.cad": { category: "fx", sourceId: "ecb", unit: "CAD per EUR", currency: "CAD", baseCurrency: "EUR", quoteCurrency: "CAD", maxAgeDays: 7 },
  "fx.eur.aud": { category: "fx", sourceId: "ecb", unit: "AUD per EUR", currency: "AUD", baseCurrency: "EUR", quoteCurrency: "AUD", maxAgeDays: 7 },
  "fx.eur.cny": { category: "fx", sourceId: "ecb", unit: "CNY per EUR", currency: "CNY", baseCurrency: "EUR", quoteCurrency: "CNY", maxAgeDays: 7 },
  "fx.eur.dkk": { category: "fx", sourceId: "ecb", unit: "DKK per EUR", currency: "DKK", baseCurrency: "EUR", quoteCurrency: "DKK", maxAgeDays: 7 },
  "fx.eur.hkd": { category: "fx", sourceId: "ecb", unit: "HKD per EUR", currency: "HKD", baseCurrency: "EUR", quoteCurrency: "HKD", maxAgeDays: 7 },
  "fx.eur.nok": { category: "fx", sourceId: "ecb", unit: "NOK per EUR", currency: "NOK", baseCurrency: "EUR", quoteCurrency: "NOK", maxAgeDays: 7 },
  "fx.eur.nzd": { category: "fx", sourceId: "ecb", unit: "NZD per EUR", currency: "NZD", baseCurrency: "EUR", quoteCurrency: "NZD", maxAgeDays: 7 },
  "fx.eur.sek": { category: "fx", sourceId: "ecb", unit: "SEK per EUR", currency: "SEK", baseCurrency: "EUR", quoteCurrency: "SEK", maxAgeDays: 7 },
  "fx.eur.sgd": { category: "fx", sourceId: "ecb", unit: "SGD per EUR", currency: "SGD", baseCurrency: "EUR", quoteCurrency: "SGD", maxAgeDays: 7 },
  "interest.us.sofr": { category: "interest", sourceId: "nyfed", unit: "percent per annum", currency: "USD", maxAgeDays: 7 },
});
const FX_INDICATOR_BY_CURRENCY = Object.freeze({
  USD: "fx.eur.usd",
  GBP: "fx.eur.gbp",
  CHF: "fx.eur.chf",
  JPY: "fx.eur.jpy",
  CAD: "fx.eur.cad",
  AUD: "fx.eur.aud",
  CNY: "fx.eur.cny",
  DKK: "fx.eur.dkk",
  HKD: "fx.eur.hkd",
  NOK: "fx.eur.nok",
  NZD: "fx.eur.nzd",
  SEK: "fx.eur.sek",
  SGD: "fx.eur.sgd",
});
const INDICATOR_GEOGRAPHIC_SCOPE = Object.freeze({
  "fuel.jet.us.gulf_coast": "United States Gulf Coast spot market",
  "interest.us.sofr": "United States secured overnight financing market",
});

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validTimestamp(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(String(value || ""))
    && Number.isFinite(Date.parse(value));
}

function dayDistance(older, newer) {
  return Math.floor((Date.parse(`${newer}T00:00:00.000Z`) - Date.parse(`${older}T00:00:00.000Z`)) / 86_400_000);
}

function parseClassification(value) {
  if (typeof value !== "string") return value && typeof value === "object" ? value : null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeObservation(row, asOf) {
  const indicatorId = row?.indicator_id || row?.indicatorId;
  const rule = INDICATOR_RULES[indicatorId];
  const sourceId = row?.source_id || row?.sourceId;
  const observationDate = row?.observation_date || row?.observationDate;
  const publicationTimestamp = row?.publication_timestamp || row?.publicationTimestamp || null;
  const retrievalTimestamp = row?.retrieval_timestamp || row?.retrievalTimestamp;
  const value = Number(row?.value);
  const expectedSourceReference = rule?.sourceId === "ecb"
    ? `https://data-api.ecb.europa.eu/service/data/EXR/D.${rule.quoteCurrency}.EUR.SP00.A`
    : rule?.sourceId === "nyfed"
      ? EXTERNAL_SIGNAL_SOURCES.nyfed.reference
      : rule?.sourceId === "eia"
        ? EXTERNAL_SIGNAL_SOURCES.eia.reference
        : rule?.category === "inflation" ? rule.sourceReference : null;
  if (
    !rule
    || row?.data_quality_status !== "verified"
    || row?.record_type !== "published_observation"
    || sourceId !== rule.sourceId
    || row?.category !== rule.category
    || row?.unit !== rule.unit
    || row?.currency !== rule.currency
    || rule.baseCurrency && row?.base_currency !== rule.baseCurrency
    || rule.quoteCurrency && row?.quote_currency !== rule.quoteCurrency
    || publicationTimestamp && !validTimestamp(publicationTimestamp)
    || !retrievalTimestamp
    || !validTimestamp(retrievalTimestamp)
    || typeof row?.is_historical !== "boolean"
    || typeof row?.market_applicability !== "string"
    || row.market_applicability.trim().length === 0
    || !["recorded", "revision"].includes(row?.update_status)
    || !Number.isFinite(value)
    || value <= 0
    || !validDate(observationDate)
    || observationDate > asOf
    || row?.source_reference !== expectedSourceReference
    || rule?.category === "inflation" && (
      !row.reviewed_by || !validTimestamp(row.reviewed_at)
      || !publicationTimestamp || observationDate?.slice(8) !== "01"
      || publicationTimestamp.slice(0, 7) <= observationDate.slice(0, 7)
      || Date.parse(publicationTimestamp) > Date.parse(retrievalTimestamp)
      || Date.parse(row.reviewed_at) < Date.parse(publicationTimestamp)
      || row.market_applicability !== rule.geography
      || retrievalTimestamp.slice(0, 10) > asOf
    )
  ) return null;

  const ageDays = dayDistance(observationDate, asOf);
  return {
    id: row.id || null,
    indicatorId,
    category: rule.category,
    value,
    unit: rule.unit,
    currency: row.currency || null,
    baseCurrency: row.base_currency || null,
    quoteCurrency: row.quote_currency || null,
    marketApplicability: row.market_applicability || null,
    observationDate,
    publicationTimestamp,
    retrievalTimestamp,
    sourceId,
    sourceType: "official_publication",
    geographicScope: rule.geography || INDICATOR_GEOGRAPHIC_SCOPE[indicatorId]
      || "ECB euro reference-rate series; no transaction venue or local market is implied",
    sourceName: rule.sourceName || EXTERNAL_SIGNAL_SOURCES[sourceId].name,
    sourceReference: row.source_reference,
    attribution: rule.category === "inflation" ? rule.sourceName : EXTERNAL_SIGNAL_SOURCES[sourceId].attribution,
    sourceDisclaimer: rule.category === "inflation" ? "Publication reviewed by a platform administrator; no automated live inflation feed." : EXTERNAL_SIGNAL_SOURCES[sourceId].disclaimer || null,
    dataQualityStatus: "verified",
    validationStatus: "source_series_and_units_validated",
    recordType: "published_observation",
    historical: Boolean(row.is_historical),
    updateStatus: row.update_status,
    freshnessStatus: ageDays > rule.maxAgeDays ? "stale" : "current",
    ageDays,
    ...(rule.category === "inflation" ? {
      observationPeriod: observationDate.slice(0, 7),
      reviewedAt: row.reviewed_at,
      verification: "platform_reviewer_verified_publication",
    } : {}),
  };
}

function normalizeObservations(rows, asOf) {
  const grouped = new Map();
  for (const row of rows) {
    const item = normalizeObservation(row, asOf);
    if (!item) continue;
    if (!grouped.has(item.indicatorId)) grouped.set(item.indicatorId, []);
    grouped.get(item.indicatorId).push(item);
  }
  const latest = new Map();
  for (const [indicatorId, items] of grouped) {
    items.sort((left, right) => (
      right.observationDate.localeCompare(left.observationDate)
      || String(right.retrievalTimestamp).localeCompare(String(left.retrievalTimestamp))
      || String(right.id).localeCompare(String(left.id))
    ));
    const byDate = new Map();
    for (const item of items) {
      if (!byDate.has(item.observationDate)) byDate.set(item.observationDate, item);
    }
    const ordered = [...byDate.values()];
    const current = ordered[0];
    const previous = ordered[1];
    const intervalDays = previous ? dayDistance(previous.observationDate, current.observationDate) : null;
    const maximumComparisonGapDays = current.category === "fuel" ? 14 : 5;
    const movement = previous ? {
      status: intervalDays > 0 && intervalDays <= maximumComparisonGapDays
        && current.freshnessStatus === "current"
        && previous.freshnessStatus === "current"
        ? "comparable"
        : "insufficient_history",
      fromObservationId: previous.id,
      fromObservationDate: previous.observationDate,
      fromValue: previous.value,
      toObservationId: current.id,
      toObservationDate: current.observationDate,
      toValue: current.value,
      intervalDays,
      absoluteChange: Number((current.value - previous.value).toFixed(8)),
      percentChange: Number((((current.value - previous.value) / previous.value) * 100).toFixed(6)),
      sourceId: current.sourceId,
      sourceReference: current.sourceReference,
      unit: current.unit,
    } : null;
    latest.set(indicatorId, { ...current, movement });
  }
  return latest;
}

function observationCoverage(rows, asOf) {
  const grouped = new Map(Object.keys(INDICATOR_RULES).map((id) => [id, []]));
  for (const row of rows) {
    const indicatorId = row?.indicator_id || row?.indicatorId;
    if (grouped.has(indicatorId)) grouped.get(indicatorId).push(row);
  }

  return [...grouped.entries()].map(([indicatorId, sourceRows]) => {
    const rule = INDICATOR_RULES[indicatorId];
    const valid = sourceRows
      .map((row) => normalizeObservation(row, asOf))
      .filter(Boolean)
      .sort((left, right) => (
        right.observationDate.localeCompare(left.observationDate)
        || String(right.retrievalTimestamp).localeCompare(String(left.retrievalTimestamp))
        || String(right.id).localeCompare(String(left.id))
      ));
    const byDate = new Map();
    for (const item of valid) {
      if (!byDate.has(item.observationDate)) byDate.set(item.observationDate, item);
    }
    const points = [...byDate.values()].sort((left, right) => left.observationDate.localeCompare(right.observationDate));
    const intervals = points.slice(1).map((point, index) => ({
      from: points[index].observationDate,
      to: point.observationDate,
      days: dayDistance(points[index].observationDate, point.observationDate),
    }));
    const maximumExpectedGapDays = rule.category === "fuel" ? 14 : 5;
    const gaps = intervals.filter((interval) => interval.days > maximumExpectedGapDays);
    const latest = points.at(-1) || null;
    const expectedRecordCount = Number(sourceRows[0]?.indicator_record_count);
    const recordCount = Number.isFinite(expectedRecordCount) ? expectedRecordCount : sourceRows.length;
    const truncated = recordCount > 501;
    const inconsistentUnitCount = sourceRows.filter((row) => row?.unit !== rule.unit).length;
    const inconsistentCurrencyCount = sourceRows.filter((row) => (
      row?.currency !== rule.currency
      || rule.baseCurrency && row?.base_currency !== rule.baseCurrency
      || rule.quoteCurrency && row?.quote_currency !== rule.quoteCurrency
    )).length;
    const unverifiedRecordCount = sourceRows.filter((row) => row?.data_quality_status !== "verified").length;
    const nonPublishedRecordCount = sourceRows.filter((row) => row?.record_type !== "published_observation").length;
    const duplicateDateCount = valid.length - points.length;
    const revisionRecordCount = sourceRows.filter((row) => row?.update_status === "revision").length;
    let status;
    let reason;
    if (inconsistentUnitCount > 0) {
      status = "inconsistent_units";
      reason = "One or more stored records use a unit that does not match the indicator's defined source unit.";
    } else if (inconsistentCurrencyCount > 0) {
      status = "inconsistent_currency";
      reason = "One or more stored records use a currency pair that does not match the indicator's defined source currency.";
    } else if (points.length === 0 && unverifiedRecordCount > 0) {
      status = "unverified_source";
      reason = "Records exist, but none qualify as verified published observations for descriptive history.";
    } else if (points.length === 0) {
      status = "insufficient_history";
      reason = "No eligible verified published observations are available for this indicator.";
    } else if (latest.freshnessStatus === "stale") {
      status = "stale_observations";
      reason = `The latest verified observation is ${latest.ageDays} day(s) old, beyond the source's ${rule.maxAgeDays}-day freshness window.`;
    } else if (points.length < 2) {
      status = "insufficient_history";
      reason = "Only one distinct verified observation date is available.";
    } else {
      status = "partial_coverage";
      reason = truncated
        ? "Recent history is capped at 501 records; older observations are omitted from this assessment."
        : "Observed dates are summarized, but no intended model evaluation window or complete expected calendar was supplied; completeness is not claimed.";
    }

    return {
      indicatorId,
      category: rule.category,
      sourceId: rule.sourceId,
      unit: rule.unit,
      currency: rule.currency,
      expectedPeriodicity: rule.category === "fuel" ? "weekly" : "business_daily",
      maximumExpectedGapDays,
      status,
      reason,
      observationCount: points.length,
      recordCount,
      oldestObservationDate: points[0]?.observationDate || null,
      latestObservationDate: latest?.observationDate || null,
      latestAgeDays: latest?.ageDays ?? null,
      spanDays: points.length > 1 ? dayDistance(points[0].observationDate, latest.observationDate) : 0,
      maximumObservedGapDays: intervals.length
        ? Math.max(...intervals.map((interval) => interval.days))
        : null,
      gapsExceedingExpectedCadence: gaps,
      duplicateDateCount,
      revisionRecordCount,
      inconsistentUnitCount,
      inconsistentCurrencyCount,
      unverifiedRecordCount,
      nonPublishedRecordCount,
      truncated,
      intendedUse: "descriptive monitoring only; not statistical model eligibility",
      dataQualityStatus: points.length ? "verified_points_only" : "no_verified_points",
    };
  });
}

function normalizeProvision(row, organizationId) {
  if (row?.organization_id !== organizationId) {
    throw new Error("External risk repository returned a cross-organization provision");
  }
  if (row.clause_review_status !== "verified" || row.evidence_review_status !== "verified" || !row.evidence_id) return null;
  const classification = parseClassification(row.classification);
  if (classification?.status !== "confirmed" || !AVIATION_CONTRACT_TYPES.has(classification.type)) return null;
  const excerpt = String(row.excerpt || "").trim();
  if (!excerpt || !row.document_version_id || !row.analysis_run_id) return null;
  const obligationEvidence = row.obligation_evidence_id
    && row.obligation_review_status === "verified"
    && row.obligation_evidence_review_status === "verified"
    ? {
      evidenceId: row.obligation_evidence_id,
      pageNumber: row.obligation_page_number || null,
      sourceLocator: row.obligation_source_locator || null,
      excerpt: String(row.obligation_excerpt || "").trim(),
      reviewStatus: "verified",
    }
    : null;
  return {
    organizationId,
    contractId: row.contract_id,
    contractTitle: row.contract_title || "Contract",
    contractType: classification.type,
    analysisRunId: row.analysis_run_id,
    documentVersionId: row.document_version_id,
    clauseId: row.clause_id,
    clauseNumber: row.clause_number || null,
    clauseTitle: row.clause_title || null,
    obligationId: obligationEvidence ? row.obligation_id : null,
    obligationDescription: obligationEvidence ? row.obligation_description || null : null,
    obligationEvidence,
    excerpt,
    evidence: {
      evidenceId: row.evidence_id,
      pageNumber: row.page_number || null,
      sourceLocator: row.source_locator || null,
      excerpt,
      reviewStatus: "verified",
    },
  };
}

function supportedMechanism(text) {
  const indexationTerms = parseIndexationTerms(text);
  if (indexationTerms) return {
    category: "inflation",
    mechanism: indexationTerms.classification === "unsupported_requires_review" ? "requires_review" : "explicit_price_indexation",
    indexationTerms,
    sentence: text,
  };
  const sentences = String(text || "")
    .replace(/\bU\.S\.(?=\s)/gi, "US")
    .split(/(?<=[.;!?])\s+|\n+/);
  const fuel = sentences.find((sentence) => (
    /\bfuel\b/i.test(sentence)
    && /\b(?:surcharge|index(?:ed|ation)?|adjust(?:ment|ed)?|escalation|price\s+adjustment|pass[- ]?through|cost\s+recovery)\b/i.test(sentence)
  ));
  if (fuel) return { category: "fuel", mechanism: "explicit_fuel_price_adjustment", sentence: fuel };

  const paymentSentence = sentences.find((sentence) => (
    /\b(?:payment|payable|pay|paid|invoice|rent|fee|charge|remittance)\b/i.test(sentence)
    && new RegExp(`\\b(?:${[...CONTRACT_CURRENCIES].join("|")})\\b`, "i").test(sentence)
  ));
  const currencyMatch = paymentSentence?.match(new RegExp(`\\b(${[...CONTRACT_CURRENCIES].join("|")})\\b`, "i"));
  if (currencyMatch && currencyMatch[1].toUpperCase() !== "EUR") {
    const currency = currencyMatch[1].toUpperCase();
    const amountPattern = new RegExp(
      `(?:\\b${currency}\\s*([\\d,]+(?:\\.\\d{1,2})?)\\b|\\b([\\d,]+(?:\\.\\d{1,2})?)\\s*${currency}\\b)`,
      "i",
    );
    const amountMatch = paymentSentence.match(amountPattern);
    const amount = amountMatch ? Number((amountMatch[1] || amountMatch[2]).replaceAll(",", "")) : null;
    const dateMatch = paymentSentence.match(/\b\d{4}-\d{2}-\d{2}\b/);
    return {
      category: "fx",
      mechanism: "explicit_foreign_currency_payment",
      currency,
      paymentAmount: Number.isFinite(amount) && amount > 0 ? amount : null,
      paymentDate: dateMatch && validDate(dateMatch[0]) ? dateMatch[0] : null,
      sentence: paymentSentence,
    };
  }

  const rateSentence = sentences.find((sentence) => (
    /\b(SOFR|SONIA|EURIBOR|LIBOR)\b/i.test(sentence)
    && /\b(?:floating|variable|reset|re-set|adjustable|rate\s+shall\s+change|\bplus\b|\+|margin)\b/i.test(sentence)
    && /\b(?:interest|financing|loan|principal|borrowing|facility)\b/i.test(sentence)
  ));
  const benchmark = rateSentence?.match(/\b(SOFR|SONIA|EURIBOR|LIBOR)\b/i);
  if (benchmark) {
    const spreadMatch = rateSentence.match(/\b(?:plus|margin(?:\s+of)?)\s+(\d+(?:\.\d+)?)\s*(basis\s+points?|bps|%)\b/i);
    const spreadBasisPoints = spreadMatch
      ? Number(spreadMatch[1]) * (spreadMatch[2].includes("%") ? 100 : 1)
      : null;
    const resetMatch = rateSentence.match(/\breset(?:s|ting)?\s+(daily|weekly|monthly|quarterly|semi-annual(?:ly)?|annual(?:ly)?)\b/i);
    return {
      category: "interest",
      mechanism: "explicit_floating_reference_rate",
      benchmark: benchmark[1].toUpperCase(),
      spreadBasisPoints: Number.isFinite(spreadBasisPoints) ? spreadBasisPoints : null,
      resetFrequency: resetMatch?.[1]?.toLowerCase() || null,
      sentence: rateSentence,
    };
  }
  const fixedRateSentence = sentences.find((sentence) => (
    /\b(?:fixed(?:\s+interest)?\s+rate|interest\s+rate\s+is\s+fixed)\b/i.test(sentence)
    && /\b(?:interest|financing|loan|principal|borrowing|facility)\b/i.test(sentence)
  ));
  if (fixedRateSentence) {
    return {
      category: "interest",
      mechanism: "explicit_fixed_interest_rate",
      sentence: fixedRateSentence,
    };
  }
  const variableRateSentence = sentences.find((sentence) => (
    /\b(?:floating|variable|adjustable)\s+(?:interest\s+)?rate\b/i.test(sentence)
    && /\b(?:interest|financing|loan|principal|borrowing|facility)\b/i.test(sentence)
  ));
  if (variableRateSentence) {
    return {
      category: "interest",
      mechanism: "requires_review",
      sentence: variableRateSentence,
    };
  }
  if (/\bfuel\b/i.test(text)) return { category: "fuel", mechanism: "requires_review", sentence: text };
  const ambiguousRateSentence = sentences.find((sentence) => (
    /\b(SOFR|SONIA|EURIBOR|LIBOR)\b/i.test(sentence)
    && /\b(?:floating|variable|reset|re-set|adjustable|interest|financing|loan|principal|borrowing|facility)\b/i.test(sentence)
  ));
  const ambiguousBenchmark = ambiguousRateSentence?.match(/\b(SOFR|SONIA|EURIBOR|LIBOR)\b/i);
  if (ambiguousBenchmark) {
    return {
      category: "interest",
      mechanism: "requires_review",
      benchmark: ambiguousBenchmark[1].toUpperCase(),
      sentence: ambiguousRateSentence,
    };
  }
  return null;
}

function parseFinancingTerms(text, mechanism) {
  const excerpt = String(text || "");
  const principalMatch = excerpt.match(
    /\b(?:outstanding\s+)?principal(?:\s+balance)?\s+(?:of|is|:)\s*(USD|EUR|GBP|CHF|CAD|AUD|JPY|CNY|DKK|HKD|NOK|NZD|SEK|SGD)\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ) || excerpt.match(
    /\b(USD|EUR|GBP|CHF|CAD|AUD|JPY|CNY|DKK|HKD|NOK|NZD|SEK|SGD)\s*\$?\s*([\d,]+(?:\.\d{1,2})?)\s+(?:outstanding\s+)?principal\b/i,
  );
  const principalAmount = principalMatch ? Number(principalMatch[2].replaceAll(",", "")) : null;
  const principalCurrency = principalMatch?.[1]?.toUpperCase() || null;
  const spreadMatch = excerpt.match(
    /(?:\bplus\b|\+|\bmargin(?:\s+of)?\b)\s*(\d+(?:\.\d+)?)\s*(basis\s+points?|bps|%|percent)\b/i,
  );
  const spreadValue = spreadMatch ? Number(spreadMatch[1]) : null;
  const spreadBasisPoints = spreadValue === null
    ? null
    : /%|percent/i.test(spreadMatch[2]) ? spreadValue * 100 : spreadValue;
  const resetMatch = excerpt.match(/\breset(?:s|ting)?\s+(daily|weekly|monthly|quarterly|semi-annual(?:ly)?|annual(?:ly)?)\b/i);
  const fixedRateMatch = excerpt.match(
    /\bfixed(?:\s+interest)?\s+rate\s+(?:of|at)\s+(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:per\s+annum|p\.a\.)\b/i,
  );
  const capMatch = excerpt.match(
    /\b(?:interest\s+)?rate\s+(?:be\s+)?(?:capped\s+at|shall\s+not\s+exceed|not\s+exceed)\s+(\d+(?:\.\d+)?)\s*(?:%|percent)/i,
  );
  const floorMatch = excerpt.match(
    /(?:\b(?:interest\s+)?rate\s+(?:be\s+)?(?:floored\s+at|subject\s+to\s+a\s+floor\s+of|shall\s+not\s+fall\s+below|not\s+fall\s+below)|\band\s+shall\s+not\s+fall\s+below)\s+(\d+(?:\.\d+)?)\s*(?:%|percent)/i,
  );
  const rateProtectionMentioned = /\b(?:cap(?:ped)?|floor(?:ed)?|collar)\b/i.test(excerpt);
  const hedgingTermsPresent = /\b(?:hedg(?:e|ing)|interest\s+rate\s+swap|swap\s+agreement|collar)\b/i.test(excerpt);
  const benchmark = mechanism.benchmark || null;
  const classification = mechanism.mechanism === "explicit_fixed_interest_rate"
    ? "fixed_rate"
    : mechanism.mechanism === "explicit_floating_reference_rate"
      ? "floating_rate"
      : "unknown_requires_review";
  const fixedRatePercent = fixedRateMatch ? Number(fixedRateMatch[1]) : null;
  const capRatePercent = capMatch ? Number(capMatch[1]) : null;
  const floorRatePercent = floorMatch ? Number(floorMatch[1]) : null;
  const missingInputs = [];

  if (classification === "unknown_requires_review") {
    missingInputs.push("a reviewer-confirmed fixed or floating rate mechanism and named benchmark");
  }
  if (!principalMatch || !Number.isFinite(principalAmount) || principalAmount <= 0) {
    missingInputs.push("an explicit positive outstanding principal and currency");
  }
  if (classification === "floating_rate") {
    if (!benchmark) missingInputs.push("a contractually named interest-rate benchmark");
    if (spreadBasisPoints === null || !Number.isFinite(spreadBasisPoints) || spreadBasisPoints < 0 || spreadBasisPoints > 10000) {
      missingInputs.push("an explicit non-negative contractual spread");
    }
    if (!resetMatch) missingInputs.push("the contractual reset frequency");
  } else if (classification === "fixed_rate"
    && (!Number.isFinite(fixedRatePercent) || fixedRatePercent < 0 || fixedRatePercent > 100)) {
    missingInputs.push("an explicit fixed annual interest rate");
  }
  if (classification === "floating_rate" && rateProtectionMentioned && capRatePercent === null && floorRatePercent === null) {
    missingInputs.push("a quantifiable contractual interest-rate cap or floor");
  }
  if (
    capRatePercent !== null && (!Number.isFinite(capRatePercent) || capRatePercent < 0 || capRatePercent > 100)
    || floorRatePercent !== null && (!Number.isFinite(floorRatePercent) || floorRatePercent < 0 || floorRatePercent > 100)
    || capRatePercent !== null && floorRatePercent !== null && floorRatePercent > capRatePercent
  ) missingInputs.push("valid, internally consistent contractual cap and floor values");
  if (principalCurrency && classification === "floating_rate" && benchmark === "SOFR" && principalCurrency !== "USD") {
    missingInputs.push("a USD principal matching the contractually named SOFR benchmark");
  }
  if (benchmark && benchmark !== "SOFR") {
    missingInputs.push(`a verified current observation for the contractually named ${benchmark} benchmark`);
  }

  return {
    classification,
    benchmark,
    principalAmount: Number.isFinite(principalAmount) && principalAmount > 0 ? principalAmount : null,
    principalCurrency,
    spreadBasisPoints: Number.isFinite(spreadBasisPoints) ? spreadBasisPoints : null,
    resetFrequency: resetMatch?.[1]?.toLowerCase() || null,
    fixedRatePercent: Number.isFinite(fixedRatePercent) ? fixedRatePercent : null,
    capRatePercent: Number.isFinite(capRatePercent) ? capRatePercent : null,
    floorRatePercent: Number.isFinite(floorRatePercent) ? floorRatePercent : null,
    hedgingTermsPresent,
    rateProtectionMentioned,
    missingInputs: [...new Set(missingInputs)],
  };
}

function applicableInterestRatePercent(benchmarkPercent, spreadBasisPoints, terms) {
  let applicableRate = benchmarkPercent + spreadBasisPoints / 100;
  if (terms.floorRatePercent !== null) applicableRate = Math.max(applicableRate, terms.floorRatePercent);
  if (terms.capRatePercent !== null) applicableRate = Math.min(applicableRate, terms.capRatePercent);
  return applicableRate;
}

function deriveIndexationExposure(terms, observation, evidence, asOf) {
  const missingInputs = [...terms.missingInputs];
  const needsObservation = terms.classification !== "fixed_price" && terms.fixedEscalationPercent === null;
  const location = evidence.sourceLocator || (Number.isInteger(evidence.pageNumber) && evidence.pageNumber > 0);
  if (!location) missingInputs.push("A verified contractual evidence location");
  if (needsObservation && (
    !observation || observation.freshnessStatus !== "current"
    || observation.indicatorId !== terms.series?.indicatorId
    || observation.observationPeriod !== terms.referencePeriod
    || observation.verification !== "platform_reviewer_verified_publication"
  )) missingInputs.push("Fresh platform-reviewed publication for the exact contractual series, base, geography and reference month");
  const result = calculateIndexation({ ...terms, missingInputs }, observation?.value ?? null);
  const limitations = [
    "A clause-based price adjustment, not an invoice, an incurred loss, or a forecast.",
    "Recoverability is not netted: downstream rights, actual payment and cost allocation require separate verified evidence.",
    "Only explicit annual index-ratio or fixed-escalation formulas are calculated; no index substitution, compounding or retroactive adjustment is inferred.",
    "Monthly index freshness is measured from the first day of its reference month, with a 75-day maximum; the stated contractual month must match.",
  ];
  const noticeDate = Number.isFinite(terms.noticeDays) && terms.noticeDays !== null && validDate(terms.adjustmentDate)
    ? new Date(Date.parse(`${terms.adjustmentDate}T00:00:00Z`) - terms.noticeDays * 86400000).toISOString().slice(0, 10)
    : null;
  const action = terms.classification === "fixed_price"
    ? "Confirm the fixed-price period and any separately evidenced exceptions before agreeing a supplier uplift."
    : `Review the cited formula, exact index and ${terms.protection === "uncapped" ? "absence of an adjustment cap; consider negotiating a cap and cost allocation" : "stated cap and floor"}${noticeDate ? `; review notice before ${noticeDate}` : "; clarify notice provisions"}. Confirm the baseline, publication and adjustment date with the supplier before accepting a revised price.`;
  return {
    ...result, terms,
    methodology: INDEXATION_METHOD,
    assessedAsOf: asOf,
    noticeDate,
    adjustmentTiming: !validDate(terms.adjustmentDate) ? "not_established" : terms.adjustmentDate < asOf ? "past_date_requires_review" : "upcoming",
    explanation: result.calculation
      ? `The explicit formula revises ${terms.currency} ${terms.baselinePrice.toFixed(2)} per ${terms.pricePeriod} to ${terms.currency} ${result.calculation.revisedPrice.toFixed(2)} (${result.calculation.adjustmentPercent}% contractual adjustment). Incremental cost ${result.calculation.incrementalCost.toFixed(2)}; not a settled invoice or net exposure.`
      : result.status === "fixed_price" ? "The cited arrangement is fixed-price; no inflation-linked increase is inferred."
        : "Indexation identified but required contractual terms or matching reviewed observations are missing; no price increase is inferred.",
    limitations,
    recommendation: {
      issue: terms.protection === "uncapped" && terms.classification !== "fixed_price"
        ? "The cited price adjustment has no quantified cap in the reviewed evidence."
        : "The cited price and any adjustment must follow the actual contractual mechanism.",
      action, priority: terms.protection === "uncapped" ? "review" : "monitor",
      expectedCommercialBenefit: "Review may clarify price protection, notice and cost allocation; no savings or recovery is guaranteed.",
      supportingEvidenceIds: [evidence.evidenceId, needsObservation ? observation?.id : null].filter(Boolean),
      limitations,
    },
  };
}

export function deriveAviationIndexationScenarios(assessment, scenarios, organizationId) {
  assertOrganizationScope(organizationId);
  if (!Array.isArray(scenarios) || scenarios.length < 1 || scenarios.length > 4
    || scenarios.some((item) => typeof item?.label !== "string" || !item.label.trim() || item.label.length > 80
      || !Number.isFinite(item.indexValue) || item.indexValue <= 0 || item.indexValue > 1e6)) {
    throw new TypeError("One to four labelled positive index-level assumptions up to 1000000 are required");
  }
  if (assessment?.organizationId !== organizationId) throw new Error("Indexation assessment organization scope mismatch");
  const exposure = assessment.indexationExposure;
  const eligible = assessment.status === "verified_contractual_relationship"
    && assessment.category === "inflation" && exposure?.status === "calculated"
    && exposure.terms.fixedEscalationPercent === null && assessment.observation?.freshnessStatus === "current"
    && assessment.documentVersionId && assessment.analysisRunId && assessment.evidence?.reviewStatus === "verified";
  const createdAt = new Date().toISOString();
  return scenarios.map(({ label, indexValue }) => {
    const scenarioId = randomUUID();
    const calculation = eligible ? calculateIndexation(exposure.terms, indexValue).calculation : null;
    return {
      scenarioId, label: label.trim(), createdAt,
      status: calculation ? "calculated" : "insufficient_evidence",
      organizationId, contractId: assessment.contractId, documentVersionId: assessment.documentVersionId,
      analysisRunId: assessment.analysisRunId, clauseId: assessment.clauseId,
      methodology: INDEXATION_METHOD, notForecast: true, advisoryStatus: "recommendation_only",
      assumption: { indexValue, basis: "user_supplied_assumption", referencePeriod: exposure?.terms.referencePeriod },
      baselineObservation: assessment.observation || null,
      baselineResult: eligible ? exposure.calculation : null,
      scenarioResult: calculation,
      signedDifference: calculation ? Number((calculation.revisedPrice - exposure.calculation.revisedPrice).toFixed(2)) : null,
      reason: calculation ? "The same contractual formula is applied to an assumed index level; not a forecast."
        : "A calculated current-version indexation assessment with a fresh exact-series observation is required.",
      evidenceReferences: [assessment.evidence?.evidenceId, assessment.observation?.id].filter(Boolean),
      recommendation: exposure?.recommendation || null,
      limitations: [...(exposure?.limitations || []), "Ephemeral comparison only; not saved as a historical assessment or forecast."],
    };
  });
}

function deriveInterestRateExposure(mechanism, observation, evidence) {
  const terms = parseFinancingTerms(evidence.excerpt, mechanism);
  const observationIsApplicable = terms.benchmark === "SOFR"
    && observation?.indicatorId === "interest.us.sofr"
    && observation.sourceId === "nyfed"
    && observation.dataQualityStatus === "verified"
    && observation.recordType === "published_observation"
    && observation.unit === "percent per annum"
    && observation.currency === "USD"
    && /United States secured overnight financing rate/i.test(observation.marketApplicability || "")
    && observation.freshnessStatus === "current";
  const missingInputs = [...terms.missingInputs];
  if (terms.classification === "floating_rate" && !observationIsApplicable) {
    missingInputs.push(terms.benchmark === "SOFR"
      ? observation
        ? "a fresh verified New York Fed SOFR observation with matching currency and units"
        : "a stored verified current New York Fed SOFR observation"
      : `a verified current observation for ${terms.benchmark}; other benchmarks are not substituted`);
  }
  if (terms.classification === "fixed_rate" && terms.fixedRatePercent === null) {
    missingInputs.push("a fixed annual rate stated in the cited contractual evidence");
  }

  const canCalculate = missingInputs.length === 0;
  const applicableRate = canCalculate
    ? terms.classification === "fixed_rate"
      ? terms.fixedRatePercent
      : applicableInterestRatePercent(observation.value, terms.spreadBasisPoints, terms)
    : null;
  const annualizedAmount = canCalculate ? terms.principalAmount * applicableRate / 100 : null;
  const withinRange = Number.isFinite(annualizedAmount)
    && Number.isSafeInteger(Math.round(annualizedAmount * 100));
  if (canCalculate && !withinRange) missingInputs.push("a principal and rate within the supported calculation range");
  const calculated = canCalculate && withinRange;
  const limitations = [
    "The amount is a simple annualized balance run-rate, not accrued or payable interest for a billing period.",
    "No amortization, principal schedule, compounding, day-count convention, fees, tax, or payment date is inferred.",
    terms.hedgingTermsPresent
      ? "Hedging terms are present, but no hedge notional, effectiveness, cost, or offset is quantified; the result is gross contractual interest."
      : "No hedge position or offset is assumed.",
    "A current reference rate is informational context unless the verified clause names the same benchmark.",
  ];
  const reason = calculated
    ? `The ${terms.classification.replaceAll("_", " ")} clause supports a simple annualized run-rate of ${terms.principalCurrency} ${Number(annualizedAmount.toFixed(2)).toLocaleString("en-GB")} at ${applicableRate.toFixed(4)}%${terms.classification === "floating_rate" ? ` (verified ${terms.benchmark} ${observation.value}% plus ${terms.spreadBasisPoints} basis points, subject to the stated protection)` : ""}. This is not a forecast or a contractual payment amount.`
    : "The cited financing provision is classified, but verified evidence does not establish every input required for a supported annualized run-rate.";

  return {
    status: calculated ? "calculated" : "not_calculated",
    exposureClassification: terms.classification,
    benchmark: terms.benchmark,
    terms,
    calculation: calculated ? {
      status: "calculated",
      methodology: "phase73-simple-annualized-financing-run-rate-v1",
      principal: {
        amount: terms.principalAmount,
        currency: terms.principalCurrency,
        evidenceId: evidence.evidenceId,
        basis: "explicit_verified_clause_value",
      },
      benchmarkRate: terms.classification === "floating_rate" ? {
        value: observation.value,
        unit: observation.unit,
        observationDate: observation.observationDate,
        evidenceId: observation.id,
        sourceId: observation.sourceId,
        sourceReference: observation.sourceReference,
      } : null,
      spreadBasisPoints: terms.spreadBasisPoints,
      fixedRatePercent: terms.fixedRatePercent,
      applicableRatePercent: Number(applicableRate.toFixed(6)),
      capRatePercent: terms.capRatePercent,
      floorRatePercent: terms.floorRatePercent,
      resetFrequency: terms.resetFrequency,
      annualizedInterestExpense: {
        amount: Number(annualizedAmount.toFixed(2)),
        currency: terms.principalCurrency,
        period: "year",
      },
      calculationBasis: "simple_annualized_balance_run_rate",
    } : null,
    missingInputs: [...new Set(missingInputs)],
    explanation: reason,
    limitations,
    recommendation: {
      issue: terms.classification === "floating_rate"
        ? "The verified clause links financing cost to a floating benchmark and contractual margin."
        : terms.classification === "fixed_rate"
          ? "The cited clause states a fixed annual interest rate; repricing or early repayment terms are not inferred."
          : "The financing rate mechanism requires reviewer confirmation.",
      action: terms.classification === "floating_rate"
        ? "Review the next contractual repricing date, rate cap/floor and any hedge coverage; confirm the outstanding balance and lender calculation before financing decisions."
        : terms.classification === "fixed_rate"
          ? "Confirm the fixed-rate period, maturity, refinancing date and any early-repayment provisions before expiry."
          : "Have a reviewer confirm the rate mechanism, named benchmark, margin and applicable protection in the cited clause.",
      expectedCommercialBenefit: "Review may clarify rate protection and upcoming repricing choices; no savings or avoided cost is guaranteed.",
      supportingEvidenceIds: [evidence.evidenceId, observationIsApplicable ? observation.id : null].filter(Boolean),
      limitations,
    },
  };
}

function parseFuelAdjustmentTerms(sentence) {
  const baselineMatch = sentence.match(
    /\bincrease\s+above\s+(?:the\s+)?(?:baseline\s+of\s+)?USD\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:per|\/)\s*gallon\b/i,
  );
  const passThroughMatch = sentence.match(
    /\b([\d.]+)\s*(?:%|percent)\s*(?:of\s+(?:the\s+)?increase|pass[- ]?through)\b/i,
  );
  const quantityMatch = sentence.match(
    /\b([\d,]+(?:\.\d+)?)\s*gallons?\s+per\s+(week|month|quarter|year|adjustment\s+period)\b/i,
  );
  const baselinePrice = baselineMatch ? Number(baselineMatch[1].replaceAll(",", "")) : null;
  const passThroughPercent = passThroughMatch ? Number(passThroughMatch[1]) : null;
  const quantityGallons = quantityMatch ? Number(quantityMatch[1].replaceAll(",", "")) : null;
  const adjustmentPeriod = quantityMatch?.[2]?.toLowerCase().replace(/\s+/g, "_") || null;
  const matchingBenchmark = /\b(?:U\.S\.|US)\s+Gulf Coast\b/i.test(sentence)
    && /\b(?:kerosene[- ]type\s+)?jet fuel\b/i.test(sentence)
    && /\b(?:weekly|week)\b/i.test(sentence);
  const explicitlyPayable = /\b(?:lessee|customer|buyer|airline)\s+shall\s+pay\b/i.test(sentence);
  const formulaIsExplicit = /\bincrease\s+above\b/i.test(sentence)
    && /\b(?:multiplied by|applied to|times)\b/i.test(sentence);
  const terms = {
    baselinePrice,
    baselineUnit: "USD per gallon",
    passThroughPercent,
    quantityGallons,
    adjustmentPeriod,
    matchingBenchmark,
    explicitlyPayable,
    formulaIsExplicit,
  };
  const missingInputs = [];
  if (!matchingBenchmark) missingInputs.push("a contractually specified U.S. Gulf Coast weekly jet-fuel benchmark");
  if (!Number.isFinite(baselinePrice) || baselinePrice <= 0) missingInputs.push("an explicit USD-per-gallon adjustment baseline");
  if (!formulaIsExplicit) missingInputs.push("an explicit one-sided increase formula linked to the baseline and volume");
  if (!Number.isFinite(passThroughPercent) || passThroughPercent <= 0 || passThroughPercent > 100) {
    missingInputs.push("an explicit pass-through percentage from 0% to 100%");
  }
  if (!Number.isFinite(quantityGallons) || quantityGallons <= 0) missingInputs.push("an explicit gallon quantity per adjustment period");
  if (!adjustmentPeriod) missingInputs.push("the adjustment period for the stated volume");
  if (!explicitlyPayable) missingInputs.push("the contractual party responsible for paying the adjustment");
  return { ...terms, missingInputs };
}

function deriveFuelPriceExposure(mechanism, observation) {
  const terms = parseFuelAdjustmentTerms(mechanism.sentence);
  const isFixedPriceOnly = /\bfixed[- ]price\b/i.test(mechanism.sentence)
    && !/\b(?:surcharge|index(?:ed|ation)?|adjust(?:ment|ed)?|escalation|pass[- ]?through)\b/i.test(mechanism.sentence);
  const observationIsApplicable = observation?.indicatorId === "fuel.jet.us.gulf_coast"
    && observation.sourceId === "eia"
    && observation.dataQualityStatus === "verified"
    && observation.recordType === "published_observation"
    && observation.unit === "USD per gallon"
    && observation.currency === "USD"
    && /U\.S\. Gulf Coast/i.test(observation.marketApplicability || "")
    && observation.freshnessStatus === "current";
  const missingInputs = [...terms.missingInputs];
  if (!observation) missingInputs.push("a stored verified observation matching the contractual fuel benchmark");
  else if (!observationIsApplicable) missingInputs.push("a fresh verified observation matching the contractual benchmark, source, currency and units");

  if (isFixedPriceOnly) {
    return {
      status: "not_calculated",
      exposureClassification: "fixed_price_term_identified",
      calculation: null,
      missingInputs: [],
      explanation: "The cited provision describes a fixed-price fuel arrangement; no variable price adjustment is calculated.",
      recommendation: {
        issue: "A fixed-price term is identified, but its duration, reopening rights, and included volume are not established by this clause.",
        action: "Review the fixed-price term, expiry, reopeners, and covered quantity before relying on it as fuel-cost protection.",
        expectedCommercialBenefit: "Clarifying the contract's fixed-price scope can help identify when market movements may become unallocated; no savings are guaranteed.",
        supportingEvidenceIds: [mechanism.evidenceId].filter(Boolean),
        limitations: ["No fuel-price protection beyond the exact cited fixed-price wording is inferred."],
      },
    };
  }

  if (missingInputs.length) {
    const classification = mechanism.mechanism === "requires_review"
      ? "unknown_requires_clause_review"
      : "direct_adjustment_terms_incomplete";
    return {
      status: "not_calculated",
      exposureClassification: classification,
      calculation: null,
      missingInputs: [...new Set(missingInputs)],
      explanation: "A fuel-related contractual provision is identified, but the verified clause or matching current observation does not establish all calculation inputs.",
      recommendation: {
        issue: "The fuel-price linkage or adjustment mechanics cannot yet be fully established from current verified evidence.",
        action: "Review the cited clause and confirm the named benchmark, adjustment baseline, pass-through percentage, covered gallon volume, period, and paying party before quantifying exposure.",
        expectedCommercialBenefit: "Completing the contractual and evidence record can clarify whether the organization bears or recovers fuel movements; no benefit is guaranteed.",
        supportingEvidenceIds: [mechanism.evidenceId, observation?.id].filter(Boolean),
        limitations: ["No missing contractual term, fuel quantity, or external price has been assumed."],
      },
    };
  }

  const unitIncrease = Math.max(0, observation.value - terms.baselinePrice);
  const amount = unitIncrease * terms.quantityGallons * (terms.passThroughPercent / 100);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount * 100))) {
    return {
      status: "not_calculated",
      exposureClassification: "calculation_out_of_supported_range",
      calculation: null,
      missingInputs: [],
      explanation: "The verified inputs exceed the supported calculation range.",
      recommendation: {
        issue: "The provision is linked to a current matching fuel observation, but the result is outside the supported numeric range.",
        action: "Review the source values and clause arithmetic before quantifying the adjustment.",
        expectedCommercialBenefit: "A validated calculation may clarify the contractual adjustment; no benefit is guaranteed.",
        supportingEvidenceIds: [mechanism.evidenceId, observation.id].filter(Boolean),
        limitations: ["No rounded or estimated replacement value is substituted."],
      },
    };
  }

  const roundedAmount = Number(amount.toFixed(2));
  const aboveBaseline = observation.value > terms.baselinePrice;
  const payer = /\b(?:lessee|airline)\s+shall\s+pay\b/i.test(mechanism.sentence)
    ? "lessee_or_airline"
    : "customer_or_buyer";
  return {
    status: "calculated",
    exposureClassification: "direct_contractual_adjustment",
    calculation: {
      status: "calculated",
      methodology: "phase72-explicit-weekly-fuel-adjustment-v1",
      formula: `max(0, current ${observation.unit} − contractual baseline ${terms.baselinePrice} ${terms.baselineUnit}) × ${terms.quantityGallons} gallons/${terms.adjustmentPeriod.replaceAll("_", " ")} × ${terms.passThroughPercent}%`,
      baselinePrice: { amount: terms.baselinePrice, unit: terms.baselineUnit, type: "verified_contractual_fact" },
      currentPrice: {
        amount: observation.value,
        unit: observation.unit,
        observationDate: observation.observationDate,
        evidenceId: observation.id,
        sourceId: observation.sourceId,
        sourceName: observation.sourceName,
        sourceReference: observation.sourceReference,
        freshnessStatus: observation.freshnessStatus,
      },
      unitIncrease: { amount: Number(unitIncrease.toFixed(4)), unit: "USD per gallon" },
      volume: { amount: terms.quantityGallons, unit: `gallons per ${terms.adjustmentPeriod.replaceAll("_", " ")}` },
      passThroughPercent: terms.passThroughPercent,
      amount: { value: roundedAmount, currency: "USD", period: terms.adjustmentPeriod },
      calculationInputs: "verified_clause_and_current_verified_observation",
      recoverability: "not_assessed",
      payingParty: payer,
    },
    missingInputs: [],
    explanation: aboveBaseline
      ? `The current verified price is ${Number((observation.value - terms.baselinePrice).toFixed(4))} USD per gallon above the contractual baseline. The explicit ${terms.passThroughPercent}% adjustment on ${terms.quantityGallons.toLocaleString("en-GB")} gallons for this ${terms.adjustmentPeriod.replaceAll("_", " ")} is ${roundedAmount.toLocaleString("en-GB", { style: "currency", currency: "USD" })}. This is a clause-derived adjustment for the stated period, not an annualized amount or forecast.`
      : `The current verified price is at or below the contractual baseline; the clause's stated increase-only formula produces no surcharge for this observation. No credit or price reduction is inferred.`,
    recommendation: {
      issue: aboveBaseline
        ? "The verified weekly reference is above the clause's adjustment baseline and the clause allocates an explicit adjustment to the stated paying party."
        : "The current reference does not exceed the contractual adjustment baseline; future price movement and contract duration remain relevant.",
      action: "Review the cited weekly adjustment against the supplier invoice and verify the covered gallons, period, and applicable recovery terms before settlement.",
      expectedCommercialBenefit: "Invoice-to-clause reconciliation may identify calculation errors or clarify the amount passed through; no recovery or savings is guaranteed.",
      supportingEvidenceIds: [mechanism.evidenceId, observation.id].filter(Boolean),
      limitations: [
        "The calculation covers only the explicit volume and adjustment period in the clause.",
        "No taxes, delivery differential, FX conversion, inventory timing, or broader operational fuel volume is inferred.",
        "The source observation is a regional spot reference and is used only because the verified clause names the same benchmark.",
        "No net recoverable or unprotected portfolio exposure is calculated without explicit counterparty allocation and offsetting contract terms.",
      ],
    },
  };
}

function assessProvision(provision, observationsById, asOf) {
  const mechanism = supportedMechanism(provision.evidence.excerpt);
  if (!mechanism) return null;
  mechanism.evidenceId = provision.evidence.evidenceId;
  const unresolved = mechanism.mechanism === "requires_review";
  const indicatorId = mechanism.category === "inflation"
    ? mechanism.indexationTerms.series?.indicatorId || null
    : mechanism.category === "fx"
    ? FX_INDICATOR_BY_CURRENCY[mechanism.currency]
    : mechanism.category === "interest" && mechanism.benchmark === "SOFR"
      ? "interest.us.sofr"
      : mechanism.category === "fuel"
        && mechanism.sentence.toLowerCase().includes("gulf coast")
        && mechanism.sentence.toLowerCase().includes("jet fuel")
        ? "fuel.jet.us.gulf_coast"
      : null;
  const observation = indicatorId ? observationsById.get(indicatorId) || null : null;
  const fuelExposure = mechanism.category === "fuel"
    ? deriveFuelPriceExposure(mechanism, observation)
    : null;
  const financingExposure = mechanism.category === "interest"
    ? deriveInterestRateExposure(mechanism, observation, provision.evidence)
    : null;
  const indexationExposure = mechanism.category === "inflation"
    ? deriveIndexationExposure(mechanism.indexationTerms, observation, provision.evidence, asOf)
    : null;
  const missingInputs = mechanism.category === "inflation" ? indexationExposure.missingInputs
    : mechanism.category === "fuel"
    ? fuelExposure.missingInputs
    : mechanism.category === "fx"
      ? [
        "organisation reporting currency",
        ...(mechanism.paymentAmount === null ? ["contractual payment amount"] : []),
        ...(mechanism.paymentDate === null ? ["exact payment date"] : []),
        "hedge status and treasury position",
      ]
      : financingExposure.missingInputs;

  let action;
  if (unresolved) {
    action = "Request reviewer confirmation of the contractual mechanism before treating this clause as externally sensitive.";
  } else if (indexationExposure) {
    action = indexationExposure.recommendation.action;
  } else if (mechanism.category === "fuel") {
    action = fuelExposure.recommendation.action;
  } else if (mechanism.category === "fx") {
    action = "Review the cited foreign-currency payment with treasury and confirm reporting currency, payment timing, and hedge status; no economic loss is inferred.";
  } else {
    action = financingExposure.recommendation.action;
  }

  return {
    id: `${provision.contractId}:${provision.documentVersionId}:${provision.clauseId}:${mechanism.category}:${provision.evidence.evidenceId}`,
    category: mechanism.category,
    organizationId: provision.organizationId,
    indicatorId,
    status: unresolved ? "requires_review" : "verified_contractual_relationship",
    mechanism: mechanism.mechanism,
    contractId: provision.contractId,
    contractTitle: provision.contractTitle,
    contractType: provision.contractType,
    analysisRunId: provision.analysisRunId,
    documentVersionId: provision.documentVersionId,
    clauseId: provision.clauseId,
    clauseNumber: provision.clauseNumber,
    clauseTitle: provision.clauseTitle,
    currency: mechanism.currency || null,
    contractualPayment: mechanism.category === "fx" ? {
      amount: mechanism.paymentAmount,
      currency: mechanism.currency,
      dueDate: mechanism.paymentDate,
    } : null,
    obligationId: provision.obligationId || null,
    obligationDescription: provision.obligationDescription || null,
    obligationReviewStatus: provision.obligationEvidence ? "verified" : null,
    obligationEvidence: provision.obligationEvidence,
    benchmark: mechanism.benchmark || null,
    contractualRateTerms: mechanism.category === "interest" ? {
      spreadBasisPoints: mechanism.spreadBasisPoints,
      resetFrequency: mechanism.resetFrequency,
    } : null,
    financingExposure,
    indexationExposure,
    observation: observation ? {
      ...observation,
      freshnessStatus: observation.freshnessStatus,
      use: indexationExposure?.status === "calculated"
        ? "explicit_contractual_benchmark_input"
        : mechanism.category === "fuel" && fuelExposure?.status === "calculated"
        ? "explicit_contractual_benchmark_input"
        : mechanism.category === "interest" && financingExposure?.status === "calculated"
          ? "explicit_contractual_benchmark_input"
        : mechanism.category === "fx" ? "informational_only" : "reference_rate_context_only",
      useAsContractualBenchmark: indexationExposure?.status === "calculated" || (
        mechanism.category === "fuel" && fuelExposure?.status === "calculated"
      ) || (
        mechanism.category === "interest"
        && financingExposure?.status === "calculated"
        && financingExposure.exposureClassification === "floating_rate"
      ),
    } : null,
    fuelExposure,
    calculation: {
      status: indexationExposure?.status === "calculated" || fuelExposure?.status === "calculated" || financingExposure?.status === "calculated"
        ? "calculated"
        : "not_calculated",
      amount: indexationExposure?.calculation ? { value: indexationExposure.calculation.incrementalCost, currency: indexationExposure.calculation.currency, period: indexationExposure.calculation.period }
        : fuelExposure?.calculation?.amount
        || financingExposure?.calculation?.annualizedInterestExpense
        || null,
      currency: indexationExposure?.calculation?.currency || fuelExposure?.calculation?.amount?.currency
        || financingExposure?.calculation?.annualizedInterestExpense?.currency
        || null,
      kind: "contractual_exposure",
      reason: indexationExposure?.explanation || fuelExposure?.explanation || financingExposure?.explanation || (unresolved
        ? "The cited evidence does not establish a sufficiently clear contractual mechanism."
        : observation && observation.freshnessStatus === "stale"
          ? "The latest verified observation is stale and cannot be treated as current."
          : "The required contractual calculation inputs are unavailable; no financial impact is inferred."),
      missingInputs,
    },
    recommendation: {
      title: indexationExposure ? "Review contractual price indexation" : mechanism.category === "fuel"
        ? "Review verified fuel-price adjustment"
        : mechanism.category === "fx"
        ? "Review documented foreign-currency payment context"
        : mechanism.category === "interest"
          ? "Review documented floating-rate mechanism"
          : "Confirm fuel adjustment methodology",
      action,
      uncertainty: mechanism.category === "fuel"
        ? "This is an advisory review prompt, not legal or financial advice. The clause-derived adjustment is not an invoice amount, settlement determination, or net exposure."
        : "This is an advisory review prompt, not legal or financial advice. Operion does not know the organization's hedge or treasury position.",
      basedOn: observation?.freshnessStatus === "current"
        ? "verified_observation_and_verified_clause"
        : "verified_clause",
      issue: indexationExposure?.recommendation.issue || fuelExposure?.recommendation.issue || financingExposure?.recommendation.issue || null,
      expectedCommercialBenefit: indexationExposure?.recommendation.expectedCommercialBenefit || fuelExposure?.recommendation.expectedCommercialBenefit
        || financingExposure?.recommendation.expectedCommercialBenefit
        || null,
      supportingEvidenceIds: indexationExposure?.recommendation.supportingEvidenceIds || fuelExposure?.recommendation.supportingEvidenceIds
        || financingExposure?.recommendation.supportingEvidenceIds
        || [],
      limitations: indexationExposure?.limitations || fuelExposure?.recommendation.limitations
        || financingExposure?.recommendation.limitations
        || [],
    },
    evidence: provision.evidence,
  };
}

export function deriveAviationFxReferenceSensitivity(assessment, scenarioQuotePerEur, organizationId) {
  const scopedOrganizationId = assertOrganizationScope(organizationId);
  if (!Number.isFinite(scenarioQuotePerEur) || scenarioQuotePerEur <= 0 || scenarioQuotePerEur > 1_000_000) {
    throw new TypeError("scenarioQuotePerEur must be a positive finite number no greater than 1000000");
  }

  const payment = assessment?.contractualPayment;
  const observation = assessment?.observation;
  const evidence = assessment?.evidence;
  const currency = payment?.currency;
  const expectedIndicatorId = FX_INDICATOR_BY_CURRENCY[currency];
  const hasEvidenceLocation = (
    typeof evidence?.sourceLocator === "string" && evidence.sourceLocator.trim().length > 0
  ) || (Number.isInteger(evidence?.pageNumber) && evidence.pageNumber > 0);
  if (
    assessment?.status !== "verified_contractual_relationship"
    || assessment.category !== "fx"
    || assessment.mechanism !== "explicit_foreign_currency_payment"
    || !Number.isFinite(payment?.amount)
    || payment.amount <= 0
    || !validDate(payment.dueDate)
    || !expectedIndicatorId
    || evidence?.reviewStatus !== "verified"
    || !evidence.evidenceId
    || typeof evidence.excerpt !== "string"
    || !evidence.excerpt.trim()
    || !hasEvidenceLocation
    || !assessment.contractId
    || !assessment.analysisRunId
    || !assessment.documentVersionId
    || !assessment.clauseId
  ) {
    return {
      status: "insufficient_evidence",
      reason: "A verified foreign-currency payment amount, due date, current-version clause citation, and evidence citation are required.",
    };
  }

  if (
    observation?.freshnessStatus !== "current"
    || observation.indicatorId !== expectedIndicatorId
    || observation.sourceId !== "ecb"
    || observation.dataQualityStatus !== "verified"
    || observation.recordType !== "published_observation"
    || observation.currency !== currency
    || observation.baseCurrency !== "EUR"
    || observation.quoteCurrency !== currency
    || observation.unit !== `${currency} per EUR`
    || observation.sourceReference !== `https://data-api.ecb.europa.eu/service/data/EXR/D.${currency}.EUR.SP00.A`
    || !Number.isFinite(observation.value)
    || observation.value <= 0
    || !validDate(observation.observationDate)
  ) {
    return {
      status: "insufficient_evidence",
      reason: "A current, verified ECB reference observation matching the contractual payment currency is unavailable.",
    };
  }

  const referenceEquivalent = payment.amount / observation.value;
  const scenarioEquivalent = payment.amount / scenarioQuotePerEur;
  const change = scenarioEquivalent - referenceEquivalent;
  const changePercent = (change / referenceEquivalent) * 100;
  if (
    !Number.isFinite(referenceEquivalent)
    || !Number.isFinite(scenarioEquivalent)
    || !Number.isFinite(change)
    || !Number.isFinite(changePercent)
  ) {
    return {
      status: "insufficient_evidence",
      reason: "The payment and exchange-rate inputs exceed the supported calculation range.",
    };
  }
  const round = (value) => Number(value.toFixed(2));
  const sensitivity = {
    status: "calculated",
    kind: "deterministic_fx_reference_sensitivity",
    notForecast: true,
    contractId: assessment.contractId,
    analysisRunId: assessment.analysisRunId,
    documentVersionId: assessment.documentVersionId,
    clauseId: assessment.clauseId,
    clauseNumber: assessment.clauseNumber,
    payment: {
      amount: payment.amount,
      currency,
      dueDate: payment.dueDate,
    },
    evidence,
    referenceObservation: {
      id: observation.id || null,
      indicatorId: observation.indicatorId,
      value: observation.value,
      unit: observation.unit,
      observationDate: observation.observationDate,
      retrievalTimestamp: observation.retrievalTimestamp || null,
      freshnessStatus: observation.freshnessStatus,
      sourceId: observation.sourceId,
      sourceName: observation.sourceName,
      sourceReference: observation.sourceReference,
      disclaimer: observation.sourceDisclaimer,
    },
    basisCurrency: "EUR",
    userAssumption: {
      quotePerEur: scenarioQuotePerEur,
      unit: `${currency} per EUR`,
      label: "User-entered scenario rate; not a forecast",
    },
    referenceEquivalent: {
      amount: round(referenceEquivalent),
      currency: "EUR",
    },
    scenarioEquivalent: {
      amount: round(scenarioEquivalent),
      currency: "EUR",
    },
    changeInReferenceEquivalent: {
      amount: round(change),
      currency: "EUR",
      percent: round(changePercent),
    },
    recommendation: "Review this payment's currency exposure, reporting currency, and hedge status with treasury. Confirm any applicable settlement rate independently.",
    limitations: [
      "EUR values are reference-rate equivalents for one cited payment, not the organization's reporting-currency amount or an actual settlement value.",
      "The ECB rate is informational and is not a transaction rate or contractual benchmark.",
      "The alternative rate is a user assumption. No future exchange rate, hedge, treasury position, probability, or payment loss is inferred.",
      "The result is not persisted as a forecast snapshot and does not change the contract assessment.",
    ],
  };
  sensitivity.exposureAssessment = createAviationContractualExposureAssessment({
    id: `${assessment.id}:fx-reference-sensitivity`,
    category: "fx_reference_sensitivity",
    status: sensitivity.status,
    organizationId: scopedOrganizationId,
    contractId: assessment.contractId,
    contractTitle: assessment.contractTitle,
    analysisRunId: assessment.analysisRunId,
    documentVersionId: assessment.documentVersionId,
    obligationId: assessment.obligationId || null,
    obligationDescription: assessment.obligationDescription || null,
    clauseId: assessment.clauseId,
    clauseNumber: assessment.clauseNumber,
    clauseTitle: assessment.clauseTitle,
    riskVariable: { category: "fx", indicatorId: observation.indicatorId, unit: observation.unit },
    methodology: {
      id: "phase64_deterministic_fx_reference_sensitivity",
      version: "phase64-fx-reference-sensitivity-v1",
      description: "Compares one evidenced foreign-currency payment using the current ECB reference and a user-entered scenario rate; neither is a transaction forecast.",
    },
    contractualFacts: [{
      type: "contractual_payment",
      ...sensitivity.payment,
      evidenceIds: [evidence.evidenceId],
    }],
    verifiedObservations: [sensitivity.referenceObservation],
    userAssumptions: [sensitivity.userAssumption],
    dataFreshness: {
      status: observation.freshnessStatus || "not_assessed",
      assessedAsOf: observation.retrievalTimestamp || observation.observationDate,
      latestObservationDate: observation.observationDate || null,
      ageDays: Number.isFinite(observation.ageDays) ? observation.ageDays : null,
      maxAgeDays: null,
      sourceName: observation.sourceName || null,
      sourceReference: observation.sourceReference || null,
    },
    missingInformation: [
      "Organization reporting currency",
      "Actual hedge and treasury position",
      "Applicable settlement rate and transaction costs",
    ],
    result: {
      operational: null,
      financial: [
        { kind: "reference_equivalent", ...sensitivity.referenceEquivalent },
        { kind: "user_assumption_equivalent", ...sensitivity.scenarioEquivalent },
        { kind: "change_in_reference_equivalent", ...sensitivity.changeInReferenceEquivalent },
      ],
      projection: null,
    },
    priority: {
      level: "review_treasury_context",
      basis: "A foreign-currency payment is documented, but customer reporting currency and treasury position are unknown.",
    },
    recommendation: {
      riskIdentified: `A documented ${currency} payment may have a different EUR reference equivalent under the user-entered rate.`,
      potentialConsequence: "The reference-equivalent difference is not an actual settlement difference, incurred loss, or hedge-adjusted exposure.",
      proposedAction: sensitivity.recommendation,
      expectedBenefit: "Treasury review may clarify the payment's actual settlement, reporting-currency, and hedge context; no avoided loss or savings is guaranteed.",
    },
    evidence: {
      contractual: [evidence],
      operational: [],
      external: observation.id ? [{
        evidenceId: observation.id,
        sourceName: observation.sourceName || null,
        sourceLocator: observation.sourceReference,
        excerpt: `${observation.value} ${observation.unit} observed ${observation.observationDate}`,
        observationDate: observation.observationDate,
        reviewStatus: "verified",
      }] : [],
      forecast: [],
    },
    assessmentAsOf: observation.observationDate,
    limitations: sensitivity.limitations,
  });
  return sensitivity;
}

export function deriveAviationFxScenarioComparisons(assessment, scenarios, organizationId) {
  const scopedOrganizationId = assertOrganizationScope(organizationId);
  if (!Array.isArray(scenarios) || scenarios.length < 1 || scenarios.length > 4) {
    throw new TypeError("scenarios must contain between one and four FX assumptions");
  }

  const createdAt = new Date().toISOString();
  return scenarios.map((scenario, index) => {
    const label = typeof scenario?.label === "string" ? scenario.label.trim() : "";
    if (!label || label.length > 80) {
      throw new TypeError("Each FX scenario requires a label of 1 to 80 characters");
    }

    const sensitivity = deriveAviationFxReferenceSensitivity(
      assessment,
      scenario?.scenarioQuotePerEur,
      scopedOrganizationId,
    );
    const scenarioId = randomUUID();
    if (sensitivity.status !== "calculated") {
      return {
        scenarioId,
        label,
        organizationId: scopedOrganizationId,
        status: sensitivity.status,
        reason: sensitivity.reason,
        createdAt,
      };
    }

    const change = sensitivity.changeInReferenceEquivalent;
    const payment = sensitivity.payment;
    const clauseLabel = sensitivity.clauseNumber
      ? `clause ${sensitivity.clauseNumber}`
      : `clause ${sensitivity.clauseId}`;
    return {
      scenarioId,
      label,
      organizationId: scopedOrganizationId,
      contractId: sensitivity.contractId,
      analysisRunId: sensitivity.analysisRunId,
      documentVersionId: sensitivity.documentVersionId,
      obligationId: assessment.obligationId || null,
      obligationDescription: assessment.obligationDescription || null,
      clauseId: sensitivity.clauseId,
      clauseNumber: sensitivity.clauseNumber || null,
      externalVariable: {
        category: "fx",
        indicatorId: sensitivity.referenceObservation.indicatorId,
        unit: sensitivity.referenceObservation.unit,
      },
      payment,
      baselineObservation: sensitivity.referenceObservation,
      assumption: sensitivity.userAssumption,
      methodology: sensitivity.exposureAssessment.methodology,
      baselineResult: sensitivity.referenceEquivalent,
      scenarioResult: sensitivity.scenarioEquivalent,
      absoluteDifference: {
        amount: Number(Math.abs(change.amount).toFixed(2)),
        currency: change.currency,
      },
      signedDifference: change,
      percentageDifference: change.percent,
      evidenceReferences: [
        {
          type: "contract_clause",
          evidenceId: sensitivity.evidence.evidenceId,
          clauseId: sensitivity.clauseId,
          documentVersionId: sensitivity.documentVersionId,
        },
        {
          type: "external_observation",
          evidenceId: sensitivity.referenceObservation.id || null,
          sourceId: sensitivity.referenceObservation.sourceId,
          observationDate: sensitivity.referenceObservation.observationDate,
          sourceReference: sensitivity.referenceObservation.sourceReference,
        },
      ],
      assumptions: [sensitivity.userAssumption],
      contractualImpactExplanation: `For the cited ${payment.amount.toLocaleString("en-GB")} ${payment.currency} payment due ${payment.dueDate} under ${clauseLabel}, the hypothetical ${sensitivity.userAssumption.unit} rate changes its EUR reference equivalent from ${sensitivity.referenceEquivalent.amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to ${sensitivity.scenarioEquivalent.amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. This is a reference comparison, not a transaction forecast or settlement amount.`,
      recommendation: {
        status: "recommendation_only",
        action: sensitivity.recommendation,
        performed: false,
        supportingEvidenceIds: [
          sensitivity.evidence.evidenceId,
          sensitivity.referenceObservation.id,
        ].filter(Boolean),
      },
      exposureAssessment: sensitivity.exposureAssessment,
      limitations: sensitivity.limitations,
      createdAt,
      notForecast: true,
      sequence: index + 1,
    };
  });
}

export function deriveAviationInterestRateScenarioComparisons(
  assessment,
  { principalAmount, scenarios } = {},
  organizationId,
) {
  const scopedOrganizationId = assertOrganizationScope(organizationId);
  if (!Number.isFinite(principalAmount) || principalAmount <= 0 || principalAmount > 1_000_000_000_000) {
    throw new TypeError("principalAmount must be positive and no greater than 1000000000000");
  }
  if (!Array.isArray(scenarios) || scenarios.length < 1 || scenarios.length > 4) {
    throw new TypeError("scenarios must contain between one and four interest-rate assumptions");
  }

  const createdAt = new Date().toISOString();
  const terms = assessment?.financingExposure?.terms;
  const observation = assessment?.observation;
  const evidence = assessment?.evidence;
  const evidenceHasLocation = Boolean(
    (typeof evidence?.sourceLocator === "string" && evidence.sourceLocator.trim())
    || (Number.isInteger(evidence?.pageNumber) && evidence.pageNumber > 0),
  );
  const eligible = assessment?.status === "verified_contractual_relationship"
    && assessment.category === "interest"
    && assessment.mechanism === "explicit_floating_reference_rate"
    && terms?.classification === "floating_rate"
    && terms.benchmark === "SOFR"
    && (!terms.principalCurrency || terms.principalCurrency === "USD")
    && Number.isFinite(terms.spreadBasisPoints)
    && terms.resetFrequency
    && assessment.contractId
    && assessment.analysisRunId
    && assessment.documentVersionId
    && assessment.clauseId
    && evidence?.reviewStatus === "verified"
    && evidence.evidenceId
    && typeof evidence.excerpt === "string"
    && evidence.excerpt.trim()
    && evidenceHasLocation
    && observation?.indicatorId === "interest.us.sofr"
    && observation.sourceId === "nyfed"
    && observation.dataQualityStatus === "verified"
    && observation.recordType === "published_observation"
    && observation.unit === "percent per annum"
    && observation.currency === "USD"
    && observation.freshnessStatus === "current"
    && Number.isFinite(observation.value)
    && observation.value >= 0
    && validDate(observation.observationDate);
  const principalCurrency = terms?.principalCurrency || "USD";
  const principalIsClauseFact = Number.isFinite(terms?.principalAmount)
    && terms.principalAmount === principalAmount
    && principalCurrency === "USD";

  return scenarios.map((scenario, index) => {
    const label = typeof scenario?.label === "string" ? scenario.label.trim() : "";
    const scenarioBenchmarkPercent = scenario?.scenarioBenchmarkPercent;
    if (!label || label.length > 80) {
      throw new TypeError("Each interest-rate scenario requires a label of 1 to 80 characters");
    }
    if (!Number.isFinite(scenarioBenchmarkPercent) || scenarioBenchmarkPercent < 0 || scenarioBenchmarkPercent > 100) {
      throw new TypeError("scenarioBenchmarkPercent must be a finite percentage from 0 to 100");
    }

    const scenarioId = randomUUID();
    if (!eligible) {
      return {
        scenarioId,
        label,
        organizationId: scopedOrganizationId,
        status: "insufficient_evidence",
        reason: "A verified current-version SOFR floating-rate clause with a current matching New York Fed observation, USD units, contractual spread, reset frequency and evidence citation is required.",
        createdAt,
      };
    }

    const baselineApplicableRate = applicableInterestRatePercent(observation.value, terms.spreadBasisPoints, terms);
    const scenarioApplicableRate = applicableInterestRatePercent(scenarioBenchmarkPercent, terms.spreadBasisPoints, terms);
    const baselineAnnualizedAmount = principalAmount * baselineApplicableRate / 100;
    const scenarioAnnualizedAmount = principalAmount * scenarioApplicableRate / 100;
    const signedDifference = scenarioAnnualizedAmount - baselineAnnualizedAmount;
    const percentageDifference = baselineAnnualizedAmount === 0
      ? null
      : (signedDifference / baselineAnnualizedAmount) * 100;
    if (
      !Number.isFinite(baselineAnnualizedAmount)
      || !Number.isFinite(scenarioAnnualizedAmount)
      || !Number.isFinite(signedDifference)
      || percentageDifference !== null && !Number.isFinite(percentageDifference)
      || !Number.isSafeInteger(Math.round(baselineAnnualizedAmount * 100))
      || !Number.isSafeInteger(Math.round(scenarioAnnualizedAmount * 100))
      || !Number.isSafeInteger(Math.round(Math.abs(signedDifference) * 100))
    ) {
      return {
        scenarioId,
        label,
        organizationId: scopedOrganizationId,
        status: "insufficient_evidence",
        reason: "The principal and rate inputs exceed the supported calculation range.",
        createdAt,
      };
    }

    const round = (value) => Number(value.toFixed(2));
    const principal = {
      amount: principalAmount,
      currency: principalCurrency,
      basis: principalIsClauseFact ? "verified_clause_fact" : "user_supplied_assumption",
      evidenceId: principalIsClauseFact ? evidence.evidenceId : null,
    };
    const baseline = {
      benchmarkPercent: observation.value,
      applicableRatePercent: Number(baselineApplicableRate.toFixed(6)),
      annualizedInterestExpense: {
        amount: round(baselineAnnualizedAmount),
        currency: principalCurrency,
        period: "year",
      },
    };
    const scenarioResult = {
      benchmarkPercent: scenarioBenchmarkPercent,
      applicableRatePercent: Number(scenarioApplicableRate.toFixed(6)),
      annualizedInterestExpense: {
        amount: round(scenarioAnnualizedAmount),
        currency: principalCurrency,
        period: "year",
      },
    };
    const difference = {
      amount: round(signedDifference),
      currency: principalCurrency,
      period: "year",
    };
    const clauseLabel = assessment.clauseNumber
      ? `clause ${assessment.clauseNumber}`
      : `clause ${assessment.clauseId}`;
    const rateProtection = [
      terms.floorRatePercent === null ? null : `floor ${terms.floorRatePercent}%`,
      terms.capRatePercent === null ? null : `cap ${terms.capRatePercent}%`,
    ].filter(Boolean).join(" and ") || "no explicit numerical cap or floor";
    const limitations = [
      "The comparison changes only the SOFR benchmark assumption; the contractual spread and numerical rate protections remain fixed.",
      "Amounts are simple annualized balance run-rates, not accrued or payable interest for a billing period.",
      "No amortization, compounding, day-count convention, fees, tax, refinancing, or payment schedule is inferred.",
      principal.basis === "user_supplied_assumption"
        ? "Outstanding principal is a user-supplied assumption and has not been verified against a lender statement or contract evidence."
        : "The clause-stated principal is used as the balance; no later repayment or amortization is modeled.",
      terms.hedgingTermsPresent
        ? "Hedging terms appear in the evidence but their amount, effectiveness and costs are not quantified; results show gross contractual interest, not hedge-adjusted exposure."
        : "No hedge position or offset is assumed.",
      "Alternative SOFR values are user assumptions, not market observations or forecasts; no probability or risk score is assigned.",
      "The comparison is not persisted as a forecast snapshot and does not change the contract assessment.",
    ];
    const action = "Review the next contractual repricing date, rate cap/floor and any hedge coverage; confirm the outstanding balance and lender calculation before financing decisions.";
    const comparison = {
      scenarioId,
      label,
      organizationId: scopedOrganizationId,
      status: "calculated",
      contractId: assessment.contractId,
      contractTitle: assessment.contractTitle,
      analysisRunId: assessment.analysisRunId,
      documentVersionId: assessment.documentVersionId,
      obligationId: assessment.obligationId || null,
      obligationDescription: assessment.obligationDescription || null,
      clauseId: assessment.clauseId,
      clauseNumber: assessment.clauseNumber || null,
      externalVariable: {
        category: "interest",
        indicatorId: observation.indicatorId,
        benchmark: "SOFR",
        unit: observation.unit,
        currency: "USD",
      },
      principal,
      contractualTerms: {
        spreadBasisPoints: terms.spreadBasisPoints,
        resetFrequency: terms.resetFrequency,
        capRatePercent: terms.capRatePercent,
        floorRatePercent: terms.floorRatePercent,
        hedgingTermsPresent: terms.hedgingTermsPresent,
      },
      baselineObservation: {
        id: observation.id || null,
        indicatorId: observation.indicatorId,
        value: observation.value,
        unit: observation.unit,
        currency: observation.currency,
        observationDate: observation.observationDate,
        retrievalTimestamp: observation.retrievalTimestamp || null,
        freshnessStatus: observation.freshnessStatus,
        sourceId: observation.sourceId,
        sourceName: observation.sourceName,
        sourceReference: observation.sourceReference,
      },
      assumption: {
        benchmarkPercent: scenarioBenchmarkPercent,
        unit: "% per annum",
        label: "User-entered SOFR assumption; not a forecast",
      },
      methodology: {
        id: "phase73_simple_annualized_financing_run_rate",
        version: "phase73-simple-annualized-financing-run-rate-v1",
        description: "Applies verified contractual spread and explicit cap/floor to the current verified SOFR and each user-entered SOFR assumption, then multiplies the resulting annual rate by the stated balance. No accrual or payment amount is inferred.",
      },
      baselineResult: baseline,
      scenarioResult,
      signedDifference: difference,
      absoluteDifference: {
        amount: round(Math.abs(signedDifference)),
        currency: principalCurrency,
        period: "year",
      },
      percentageDifference: percentageDifference === null ? null : round(percentageDifference),
      contractualImpactExplanation: `For the cited ${clauseLabel}, ${principal.currency} ${principal.amount.toLocaleString("en-GB")} principal at the verified ${observation.value}% SOFR baseline plus ${terms.spreadBasisPoints} basis points produces an annualized simple run-rate of ${principal.currency} ${baseline.annualizedInterestExpense.amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Under the illustrative ${scenarioBenchmarkPercent}% SOFR assumption, applying ${rateProtection} gives ${principal.currency} ${scenarioResult.annualizedInterestExpense.amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}; difference ${principal.currency} ${difference.amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per year. This is not a forecast or scheduled interest payment.`,
      recommendation: {
        status: "recommendation_only",
        issue: "A floating-rate provision links financing cost to SOFR and the contractual margin; scenario differences are assumption-driven.",
        action,
        expectedCommercialBenefit: "Review may clarify rate protection and upcoming repricing choices; no savings or avoided cost is guaranteed.",
        confidence: "contractual mechanism and benchmark observation verified; principal basis and scenario are separately identified",
        evidenceLimitations: limitations,
        performed: false,
        supportingEvidenceIds: [evidence.evidenceId, observation.id].filter(Boolean),
      },
      evidenceReferences: [
        {
          type: "contract_clause",
          evidenceId: evidence.evidenceId,
          clauseId: assessment.clauseId,
          documentVersionId: assessment.documentVersionId,
        },
        {
          type: "external_observation",
          evidenceId: observation.id || null,
          sourceId: observation.sourceId,
          observationDate: observation.observationDate,
          sourceReference: observation.sourceReference,
        },
        ...(principal.evidenceId ? [{
          type: "principal_clause_fact",
          evidenceId: principal.evidenceId,
          clauseId: assessment.clauseId,
          documentVersionId: assessment.documentVersionId,
        }] : []),
      ],
      createdAt,
      notForecast: true,
      sequence: index + 1,
      limitations,
    };
    comparison.exposureAssessment = createAviationContractualExposureAssessment({
      id: `${assessment.id}:interest-rate-scenario:${scenarioId}`,
      category: "interest_rate_scenario",
      status: "calculated",
      organizationId: scopedOrganizationId,
      contractId: assessment.contractId,
      contractTitle: assessment.contractTitle,
      analysisRunId: assessment.analysisRunId,
      documentVersionId: assessment.documentVersionId,
      obligationId: assessment.obligationId || null,
      obligationDescription: assessment.obligationDescription || null,
      clauseId: assessment.clauseId,
      clauseNumber: assessment.clauseNumber,
      clauseTitle: assessment.clauseTitle,
      riskVariable: { category: "interest", indicatorId: observation.indicatorId, benchmark: "SOFR", unit: observation.unit },
      methodology: comparison.methodology,
      contractualFacts: [
        {
          type: "outstanding_principal",
          amount: principal.amount,
          currency: principal.currency,
          basis: principal.basis,
          evidenceIds: principal.evidenceId ? [principal.evidenceId] : [],
        },
        {
          type: "contractual_spread",
          value: terms.spreadBasisPoints,
          unit: "basis points",
          evidenceIds: [evidence.evidenceId],
        },
        {
          type: "repricing_frequency",
          value: terms.resetFrequency,
          evidenceIds: [evidence.evidenceId],
        },
      ],
      verifiedObservations: [comparison.baselineObservation],
      userAssumptions: [comparison.assumption],
      dataFreshness: {
        status: observation.freshnessStatus || "not_assessed",
        assessedAsOf: observation.retrievalTimestamp || observation.observationDate,
        latestObservationDate: observation.observationDate,
        ageDays: Number.isFinite(observation.ageDays) ? observation.ageDays : null,
        maxAgeDays: 7,
        sourceName: observation.sourceName,
        sourceReference: observation.sourceReference,
      },
      missingInformation: [
        ...(principal.basis === "user_supplied_assumption" ? ["Verified lender statement or contract evidence for current outstanding principal"] : []),
        "Current amortization and repayment schedule",
        "Contractual day-count and compounding details for actual accrued interest",
        ...(terms.hedgingTermsPresent ? ["Hedge notional, effectiveness, cost and coverage period"] : ["Actual hedge and treasury position"]),
      ],
      result: {
        operational: null,
        financial: [
          { kind: "baseline_annualized_interest_run_rate", ...baseline.annualizedInterestExpense },
          { kind: "scenario_annualized_interest_run_rate", ...scenarioResult.annualizedInterestExpense },
          { kind: "annualized_difference", ...difference },
        ],
        projection: null,
      },
      priority: {
        level: "review_financing_terms",
        basis: "A verified floating-rate clause and matching current SOFR observation are compared with an explicit user assumption; no probability or severity score is inferred.",
      },
      recommendation: {
        riskIdentified: comparison.recommendation.issue,
        potentialConsequence: "A changed benchmark assumption changes the simple annualized run-rate on the stated principal, subject to the contractual spread and rate protections; this is not accrued or payable interest.",
        proposedAction: action,
        expectedBenefit: comparison.recommendation.expectedCommercialBenefit,
      },
      evidence: {
        contractual: [evidence],
        operational: [],
        external: [{
          evidenceId: observation.id,
          sourceName: observation.sourceName || null,
          sourceLocator: observation.sourceReference,
          excerpt: `${observation.value} ${observation.unit} observed ${observation.observationDate}`,
          observationDate: observation.observationDate,
          reviewStatus: "verified",
        }],
        forecast: [],
      },
      assessmentAsOf: observation.observationDate,
      limitations,
    });
    return comparison;
  });
}

function sourceStatus(indicatorId, observationsById, category) {
  const observation = observationsById.get(indicatorId);
  if (observation?.freshnessStatus === "current") return { status: "available", latest: observation };
  if (observation?.freshnessStatus === "stale") return { status: "stale", latest: observation };
  if (category === "fuel") {
    const fuelObservation = observationsById.get("fuel.jet.us.gulf_coast");
    if (fuelObservation?.freshnessStatus === "current") return { status: "available", latest: fuelObservation };
    if (fuelObservation?.freshnessStatus === "stale") return { status: "stale", latest: fuelObservation };
    return {
      status: "unavailable",
      sourceId: "eia",
      reason: "No terms-approved EIA jet-fuel ingestion has stored a verified observation; no fuel price is shown.",
    };
  }
  return { status: "missing", sourceId: INDICATOR_RULES[indicatorId]?.sourceId || null, reason: "No verified observation is stored." };
}

export function deriveAviationExternalRiskIntelligence({
  organizationId,
  contractId = null,
  analysisRunId = null,
  provisions = [],
  observations = [],
  asOf = new Date().toISOString().slice(0, 10),
  provisionsTruncated = false,
} = {}) {
  assertOrganizationScope(organizationId);
  if (!validDate(asOf)) throw new TypeError("asOf must be an ISO date");
  if (!Array.isArray(provisions) || !Array.isArray(observations)) {
    throw new TypeError("Provisions and observations must be arrays");
  }
  const observationsById = normalizeObservations(observations, asOf);
  const normalizedProvisions = provisions.map((row) => normalizeProvision(row, organizationId)).filter(Boolean);
  const assessments = normalizedProvisions
    .map((provision) => assessProvision(provision, observationsById, asOf))
    .filter(Boolean);
  const uniqueAssessments = [...new Map(assessments.map((item) => [item.id, item])).values()];
  const findings = uniqueAssessments.sort((left, right) => (
    left.category.localeCompare(right.category)
    || left.contractTitle.localeCompare(right.contractTitle)
    || String(left.clauseNumber || left.clauseId).localeCompare(String(right.clauseNumber || right.clauseId))
  ));
  const categorySummary = ["fuel", "fx", "interest", "inflation"].map((category) => {
    const items = findings.filter((item) => item.category === category && item.status === "verified_contractual_relationship");
    const indicatorIds = category === "fuel"
      ? ["fuel.jet.us.gulf_coast"]
      : category === "fx"
        ? [...new Set(items.map((item) => FX_INDICATOR_BY_CURRENCY[item.currency]).filter(Boolean))]
        : category === "inflation" ? [...new Set(items.map((item) => item.indicatorId).filter(Boolean))]
        : ["interest.us.sofr"];
    return {
      category,
      affectedContractCount: new Set(items.map((item) => item.contractId)).size,
      verifiedClauseCount: items.length,
      exposureAmounts: [],
      signalStatuses: indicatorIds.map((indicatorId) => sourceStatus(
        indicatorId,
        observationsById,
        category,
      )),
    };
  });
  return {
    asOf,
    organizationScope: "request_organization",
    coverage: {
      currentCompletedAviationRunsOnly: !analysisRunId,
      contractId,
      analysisRunId,
      verifiedCurrentVersionClausesOnly: true,
      provisionsTruncated,
      includedProvisions: normalizedProvisions.length,
    },
    observations: [...observationsById.values()].sort((left, right) => left.indicatorId.localeCompare(right.indicatorId)),
    historicalObservationCoverage: observationCoverage(observations, asOf),
    contractualAssessments: findings,
    categorySummary,
    recommendations: findings
      .filter((item) => item.status === "verified_contractual_relationship")
      .map((item) => ({
        id: `external-risk-review:${item.id}`,
        category: item.category,
        contractId: item.contractId,
        contractTitle: item.contractTitle,
        clauseId: item.clauseId,
        clauseNumber: item.clauseNumber,
        title: item.recommendation.title,
        action: item.recommendation.action,
        basis: item.recommendation.basedOn,
        calculationStatus: item.calculation.status,
        uncertainty: item.recommendation.uncertainty,
        evidence: item.evidence,
        observation: item.observation,
      })),
    portfolioAggregation: {
      amounts: [],
      currencyConversion: "not_performed",
      counterpartyConcentration: "not_supported",
      sharedAircraftAttribution: "not_inferred",
      explanation: "This assessment counts verified contractual relationships only. It does not aggregate financial amounts, convert currencies, infer hedge status, or infer counterparty or aircraft dependencies.",
    },
    sourcePolicy: {
      fuel: {
        ...sourceStatus("fuel.jet.us", observationsById, "fuel"),
        source: EXTERNAL_SIGNAL_SOURCES.eia,
      },
      fx: {
        source: EXTERNAL_SIGNAL_SOURCES.ecb,
        limitation: "ECB reference rates are informational and not intended for market transactions or as contractual benchmarks.",
      },
      interest: {
        source: EXTERNAL_SIGNAL_SOURCES.nyfed,
        limitation: "The New York Fed reference-rate terms require attribution and a source disclaimer; rates are context only unless the contract explicitly specifies the same benchmark.",
      },
    },
    limitations: [
      "Calculations are available only for explicit supported mechanisms and complete verified inputs; other assessments remain uncalculated.",
      "Inflation observations require platform-admin publication review and approved migration 029; the public-source refresh does not collect inflation.",
      "Fuel observations are unavailable until an authorized EIA API key and an approved jet-fuel series are provisioned.",
      "ECB exchange rates are informational only; no organization reporting currency, actual hedge, or treasury position is assumed.",
      "External reference rates are not substituted for the contractual benchmark unless the verified clause expressly names that benchmark.",
      "Only latest completed aviation analyses and verified current-version supporting clause evidence are included.",
    ],
  };
}

export async function readAviationExternalRiskIntelligence({
  organizationId,
  contractId = null,
  analysisRunId = null,
  repository = createExternalAviationObservationRepository(),
  asOf,
} = {}) {
  assertOrganizationScope(organizationId);
  if (contractId) assertResourceId(contractId, "contractId");
  if (analysisRunId) assertResourceId(analysisRunId, "analysisRunId");
  const [provisions, observations] = await Promise.all([
    repository.listVerifiedContractProvisions(organizationId, { contractId, analysisRunId }),
    repository.listRecentObservations(),
  ]);
  if (!Array.isArray(provisions) || !Array.isArray(observations)) {
    throw new TypeError("External risk repository returned an invalid result");
  }
  const provisionsTruncated = provisions.length > 2000;
  return deriveAviationExternalRiskIntelligence({
    organizationId,
    provisions: provisions.slice(0, 2000),
    observations,
    asOf,
    provisionsTruncated,
    contractId,
    analysisRunId,
  });
}

export async function refreshAviationExternalObservations({
  signalService = createExternalAviationSignalService(),
  repository = createExternalAviationObservationRepository(),
} = {}) {
  if (typeof signalService?.collectPublicObservations !== "function") {
    throw new TypeError("An external aviation signal service is required");
  }
  if (typeof repository?.insertObservations !== "function") {
    throw new TypeError("An external aviation observation repository is required");
  }

  const collection = await signalService.collectPublicObservations();
  if (
    !collection
    || !Array.isArray(collection.observations)
    || !collection.sources
    || !validTimestamp(collection.retrievedAt)
  ) {
    throw new TypeError("External signal service returned an invalid refresh result");
  }
  const observations = collection.observations;
  if (observations.some((item) => (
    item?.data_quality_status !== "verified"
    || item?.record_type !== "published_observation"
    || item?.retrieval_timestamp !== collection.retrievedAt
    || !validDate(item?.observation_date)
    || item.observation_date > collection.retrievedAt.slice(0, 10)
  ))) {
    throw new TypeError("External signal service returned an unverified or invalid observation");
  }

  const persistence = await repository.insertObservations(observations);
  if (!Number.isInteger(persistence?.inserted) || persistence.inserted < 0 || persistence.inserted > observations.length) {
    throw new TypeError("External observation repository returned an invalid insert count");
  }
  return {
    status: observations.length ? "completed" : "unavailable",
    retrievedAt: collection.retrievedAt,
    receivedCount: observations.length,
    insertedCount: persistence.inserted,
    duplicateCount: observations.length - persistence.inserted,
    sources: collection.sources,
    disclaimer: collection.disclaimer || "External observations are informational, not forecasts or transaction prices.",
  };
}
