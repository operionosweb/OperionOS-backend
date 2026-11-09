export const INDEXATION_METHOD = "phase74-explicit-index-ratio-v1";

// Exact series identities prevent substitution across geography, baskets, and rebasing.
export const INFLATION_SERIES = Object.freeze({
  CUUR0000SA0: Object.freeze({
    name: "US CPI-U all items, US city average, not seasonally adjusted",
    indicatorId: "inflation.us.cpi.cuur0000sa0",
    sourceId: "bls",
    sourceName: "US Bureau of Labor Statistics",
    sourceReference: "https://data.bls.gov/timeseries/CUUR0000SA0",
    unit: "index 1982-84=100",
    geography: "United States",
    currency: "USD",
    cadence: "monthly",
    maxAgeDays: 75,
  }),
  "HICP.EA20.CP00.I15": Object.freeze({
    name: "Eurostat HICP, euro area 20, all items, 2015=100",
    indicatorId: "inflation.ea20.hicp.cp00.i15",
    sourceId: "eurostat",
    sourceName: "Eurostat",
    sourceReference: "https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_midx/default/table",
    unit: "index 2015=100",
    geography: "Euro area 20",
    currency: "EUR",
    cadence: "monthly",
    maxAgeDays: 75,
  }),
});

export function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function month(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ""));
}

export function parseIndexationTerms(excerpt) {
  const text = String(excerpt || "");
  if (!/\b(?:indexation|indexed|CPI|HICP|inflation|escalation|fixed[- ]price|labour.cost|labor.cost|material.cost)\b/i.test(text)) return null;
  const number = (expression) => {
    const match = text.match(expression);
    return match ? Number(match[1].replaceAll(",", "")) : null;
  };
  const seriesId = text.match(/\bindex series:\s*([A-Z0-9.]+)/i)?.[1]?.toUpperCase().replace(/\.+$/, "") || null;
  const series = INFLATION_SERIES[seriesId] || null;
  const fixed = /\b(?:price (?:is|shall remain) fixed|fixed[- ]price arrangement)\b/i.test(text);
  const fixedEscalationPercent = number(/\bfixed annual escalation (?:of|is)\s*(\d+(?:\.\d+)?)\s*%/i);
  const baselinePrice = text.match(/\bbaseline price:\s*(USD|EUR|GBP)\s*([\d,]+(?:\.\d+)?)\s+per\s+(month|quarter|year)\b/i);
  const baselineIndex = text.match(/\bindex baseline:\s*(\d+(?:\.\d+)?)\s+for\s+(\d{4}-\d{2})\b/i);
  const referencePeriod = text.match(/\bobservation period:\s*(\d{4}-\d{2})\b/i)?.[1] || null;
  const indexedSharePercent = number(/\bindexed share:\s*(\d+(?:\.\d+)?)\s*%/i);
  const capPercent = number(/\badjustment cap:\s*(-?\d+(?:\.\d+)?)\s*%/i);
  const floorPercent = number(/\badjustment floor:\s*(-?\d+(?:\.\d+)?)\s*%/i);
  const thresholdPercent = number(/\badjustment applies only when absolute index change exceeds\s*(\d+(?:\.\d+)?)\s*%/i);
  const normalized = text.toLowerCase().replaceAll("×", "*").replace(/\s+/g, "");
  const formulaSupported = normalized.includes("adjustmentformula:baselineprice*(1+indexedshare*(currentindex/baselineindex-1))");
  const terms = {
    classification: fixed ? "fixed_price" : fixedEscalationPercent !== null ? "fixed_escalation"
      : series && formulaSupported ? indexedSharePercent < 100 ? "partially_indexed" : "indexed_price" : "unsupported_requires_review",
    indexType: /\bHICP\b/i.test(text) ? "HICP" : /\bCPI\b/i.test(text) ? "CPI"
      : /\b(?:labour|labor).cost\b/i.test(text) ? "labour_cost" : /\b(?:PPI|producer.price|material.cost)\b/i.test(text) ? "producer_or_material_cost" : null,
    seriesId, series, fixedEscalationPercent,
    baselinePrice: baselinePrice ? Number(baselinePrice[2].replaceAll(",", "")) : null,
    currency: baselinePrice?.[1]?.toUpperCase() || null,
    pricePeriod: baselinePrice?.[3]?.toLowerCase() || null,
    baselineIndex: baselineIndex ? Number(baselineIndex[1]) : null,
    baselinePeriod: baselineIndex?.[2] || null,
    referencePeriod, indexedSharePercent, capPercent, floorPercent, thresholdPercent,
    protection: capPercent === null ? "uncapped" : "capped",
    adjustmentFrequency: /\badjustment frequency:\s*annual\b/i.test(text) ? "annual" : null,
    adjustmentDate: text.match(/\badjustment date:\s*(\d{4}-\d{2}-\d{2})\b/i)?.[1] || null,
    noticeDays: number(/\bnotice:\s*(\d+)\s+days before adjustment\b/i),
    retroactive: /\bretroactive adjustments (?:apply|permitted)\b/i.test(text) ? "mentioned_requires_review" : "not_established",
    substitution: /\bindex substitution\b/i.test(text) ? "mentioned_requires_review" : "not_established",
    recoverability: /\b(?:customer|lessee|airline) shall pay the (?:revised|adjusted) price\b/i.test(text)
      ? "customer_contractual_charge_only" : "not_established",
    formulaSupported,
  };
  const missing = [];
  if (seriesId === "CUUR0000SA0" && terms.indexType === "HICP"
    || seriesId === "HICP.EA20.CP00.I15" && terms.indexType === "CPI") missing.push("Reviewer resolution of contradictory index family and series identity");
  if ((text.match(/\bindex series:/gi) || []).length > 1
    || (text.match(/\bbaseline price:/gi) || []).length > 1
    || (text.match(/\badjustment formula:/gi) || []).length > 1) missing.push("A single unambiguous contractual index, baseline price and formula");
  if (fixed && (seriesId || fixedEscalationPercent !== null || /\b(?:indexed|CPI|HICP|inflation[- ]linked)\b/i.test(text))) {
    missing.push("Reviewer resolution of conflicting fixed-price and escalation terms");
  }
  if (!fixed) {
    if (!(terms.baselinePrice > 0) || terms.baselinePrice > 1e12) missing.push("Explicit positive baseline price, currency and payment period");
    if (!terms.adjustmentFrequency) missing.push("Explicit annual adjustment frequency");
    if (!isIsoDate(terms.adjustmentDate)) missing.push("Valid contractual adjustment date");
    if (terms.retroactive !== "not_established" || terms.substitution !== "not_established") missing.push("Reviewer resolution of retroactivity or index substitution");
    if (fixedEscalationPercent === null) {
      if (!series) missing.push("Exact supported contractual index series, geography and base");
      if (!formulaSupported) missing.push("Explicit supported index-ratio formula");
      if (!(terms.baselineIndex > 0) || !month(terms.baselinePeriod) || !month(referencePeriod)) missing.push("Positive contractual index baseline and valid baseline/reference months");
      if (!Number.isFinite(indexedSharePercent) || indexedSharePercent <= 0 || indexedSharePercent > 100) missing.push("Explicit indexed share from above 0% to 100%");
      if (month(terms.baselinePeriod) && month(referencePeriod)) {
        const [by, bm] = terms.baselinePeriod.split("-").map(Number);
        const [ry, rm] = referencePeriod.split("-").map(Number);
        if ((ry - by) * 12 + rm - bm !== 12) missing.push("Annual comparison months exactly twelve months apart");
      }
      if (isIsoDate(terms.adjustmentDate) && month(referencePeriod) && referencePeriod >= terms.adjustmentDate.slice(0, 7)) missing.push("Adjustment date after the contractual reference month");
    }
    if (fixedEscalationPercent !== null && (fixedEscalationPercent < 0 || fixedEscalationPercent > 100)) missing.push("Fixed escalation within the supported range");
    if (fixedEscalationPercent !== null && seriesId) missing.push("Reviewer resolution of mixed fixed and indexed escalation");
    if (/\b(?:cap|floor|threshold)\b/i.test(text)
      && !/\badjustment (?:cap|floor):|\badjustment applies only when absolute index change exceeds/i.test(text)) missing.push("Explicit adjustment protection basis");
    if (/\bcap\b/i.test(text) && capPercent === null) missing.push("Quantified adjustment cap");
    if (/\bfloor\b/i.test(text) && floorPercent === null) missing.push("Quantified adjustment floor");
    if (/\bthreshold\b/i.test(text) && thresholdPercent === null) missing.push("Explicit absolute-index-change threshold mechanism");
    if ([capPercent, floorPercent].some((value) => value !== null && (value < -100 || value > 100))
      || (capPercent !== null && floorPercent !== null && floorPercent > capPercent)) missing.push("Consistent adjustment cap and floor");
  }
  return { ...terms, missingInputs: [...new Set(missing)] };
}

export function calculateIndexation(terms, currentIndex = null) {
  const missingInputs = [...terms.missingInputs];
  if (terms.classification === "fixed_price") {
    return { status: missingInputs.length ? "not_calculated" : "fixed_price", calculation: null, missingInputs };
  }
  if (terms.fixedEscalationPercent === null && (!Number.isFinite(currentIndex) || currentIndex <= 0 || currentIndex > 1e6)) missingInputs.push("A positive matching verified index observation");
  if (missingInputs.length) return { status: "not_calculated", calculation: null, missingInputs: [...new Set(missingInputs)] };
  const indexChangePercent = terms.fixedEscalationPercent === null ? (currentIndex / terms.baselineIndex - 1) * 100 : null;
  const thresholdMet = terms.thresholdPercent === null || Math.abs(indexChangePercent) > terms.thresholdPercent;
  let adjustmentPercent = terms.fixedEscalationPercent ?? (thresholdMet ? indexChangePercent * terms.indexedSharePercent / 100 : 0);
  if (thresholdMet) {
    if (terms.floorPercent !== null) adjustmentPercent = Math.max(adjustmentPercent, terms.floorPercent);
    if (terms.capPercent !== null) adjustmentPercent = Math.min(adjustmentPercent, terms.capPercent);
  }
  const revised = terms.baselinePrice * (1 + adjustmentPercent / 100);
  if (!Number.isSafeInteger(Math.round(revised * 100)) || revised < 0) return { status: "not_calculated", calculation: null, missingInputs: ["A revised price within the supported numeric range"] };
  const revisedPrice = Number(revised.toFixed(2));
  return {
    status: "calculated", missingInputs: [],
    calculation: {
      methodology: INDEXATION_METHOD,
      baselinePrice: terms.baselinePrice, currency: terms.currency, period: terms.pricePeriod,
      baselineIndex: terms.baselineIndex, baselinePeriod: terms.baselinePeriod,
      currentIndex, referencePeriod: terms.referencePeriod,
      indexedSharePercent: terms.indexedSharePercent,
      indexChangePercent: indexChangePercent === null ? null : Number(indexChangePercent.toFixed(6)),
      adjustmentPercent: Number(adjustmentPercent.toFixed(6)),
      thresholdMet, capPercent: terms.capPercent, floorPercent: terms.floorPercent,
      revisedPrice, incrementalCost: Number((revisedPrice - terms.baselinePrice).toFixed(2)),
      adjustmentDate: terms.adjustmentDate,
      recoverability: terms.recoverability,
    },
  };
}
