import { isCalendarDate } from "./calendarDate.js";

export const AVIATION_CORE_VERSION = "aviation-core-v1";
const MAX_TOPIC_CITATIONS = 3;

// These are secondary, multi-label review topics, not persisted clause categories or legal conclusions.
export const AVIATION_CLAUSE_TAXONOMY = Object.freeze([
  { id: "payment", label: "Payment", pattern: /\b(payments?|invoices?|rent|fees?|surcharges?)\b/i, owner: "FINANCE", action: "Validate the payment amount, invoicing basis and due-date conditions." },
  { id: "termination", label: "Termination", pattern: /\b(terminat(?:e|ed|ion|ing)|default|cancellation)\b/i, owner: "LEGAL_CONTRACTS", action: "Check default triggers, cure rights and notice requirements before acting." },
  { id: "renewal", label: "Renewal", pattern: /\b(renewal|renew|extension|extend the term)\b/i, owner: "CONTRACT_OWNER", action: "Confirm the renewal decision window, notice method and pricing conditions." },
  { id: "liability", label: "Liability", pattern: /\b(liability|liable|limitation of liability)\b/i, owner: "LEGAL_CONTRACTS", action: "Review liability scope, caps, exclusions and prerequisites; do not treat an exposure as an admitted liability." },
  { id: "indemnity", label: "Indemnity", pattern: /\b(indemnity|indemnif(?:y|ies|ied|ying|ication)|hold harmless)\b/i, owner: "LEGAL_CONTRACTS", action: "Check covered claims, notice, defence control and exclusions before assessing indemnity exposure." },
  { id: "insurance", label: "Insurance", pattern: /\b(insurance|insured|coverage)\b/i, owner: "INSURANCE_RISK", action: "Confirm coverage limits, insured parties and required compliance evidence." },
  { id: "maintenance", label: "Maintenance", pattern: /\b(maintenance|repair|airworth(?:y|iness)|inspection)\b/i, owner: "TECHNICAL", action: "Turn supported maintenance and records requirements into an owner-reviewed compliance checklist." },
  { id: "delivery_redelivery", label: "Delivery / redelivery", pattern: /\b(delivery|redelivery|return conditions?)\b/i, owner: "TECHNICAL", action: "Confirm acceptance or return conditions, location, records and inspection responsibilities." },
  { id: "reserves", label: "Reserves", pattern: /\b(?:maintenance|engine|supplemental|repair) reserves?\b/i, owner: "FINANCE", action: "Validate reserve rates, utilisation basis and reimbursement conditions against the cited schedule." },
  { id: "sla", label: "Service levels / SLA", pattern: /\b(SLA|service levels?|dispatch reliability|turnaround time)\b/i, owner: "OPERATIONS", action: "Confirm measurement windows, service targets and exceptions before escalating a service failure." },
  { id: "performance", label: "Performance", pattern: /\b(performance|availability|reliability)\b/i, owner: "OPERATIONS", action: "Validate the performance metric, measurement evidence and contractual exceptions." },
  { id: "compensation", label: "Compensation", pattern: /\b(compensation|service credits?|liquidated damages|rebates?)\b/i, owner: "FINANCE", action: "Confirm the qualifying event, claim procedure and caps before seeking compensation." },
  { id: "force_majeure", label: "Force majeure", pattern: /\b(force majeure|acts? of god)\b/i, owner: "LEGAL_CONTRACTS", action: "Review qualifying events, notice, mitigation and suspension or termination effects." },
  { id: "governing_law", label: "Governing law", pattern: /\b(governing law|governed by the laws?)\b/i, owner: "LEGAL_CONTRACTS", action: "Confirm the governing legal framework with the responsible legal reviewer." },
  { id: "disputes", label: "Disputes", pattern: /\b(disputes?|arbitration|jurisdiction|dispute resolution)\b/i, owner: "LEGAL_CONTRACTS", action: "Check escalation, forum, arbitration and procedural notice requirements." },
  { id: "pricing", label: "Pricing adjustment", pattern: /\b(indexation|escalation|price adjustment|fuel surcharge)\b/i, owner: "FINANCE", action: "Validate the cited formula and each source input before calculating any adjustment." },
]);

function citation(source, matchedText = source.text) {
  return {
    evidenceId: source.evidenceId ?? null,
    clauseId: source.clauseId ?? null,
    clauseNumber: source.clauseNumber ?? null,
    pageNumber: source.pageNumber ?? null,
    sourceLocation: source.sourceLocation ?? null,
    charStart: source.charStart ?? null,
    charEnd: source.charEnd ?? null,
    evidenceText: matchedText,
    originalClauseText: source.text,
  };
}

const FORMULA = /^(?:formula:\s*)?adjusted fuel surcharge\s*=\s*base fuel surcharge\s*[*×]\s*\(\s*current fuel price\s*\/\s*baseline fuel price\s*\)\s*\.?$/i;
const BASE = /^base fuel surcharge:\s*(USD|EUR|GBP)\s+(\d+(?:\.\d{1,2})?)\s+per flight\s*\.?$/i;
const BASELINE = /^baseline fuel price:\s*(USD|EUR|GBP)\s+(\d+(?:\.\d{1,6})?)\s+per (litre|liter|gallon|kg)\s*\.?$/i;
const REFERENCE = /^fuel price reference:\s*([A-Za-z0-9][A-Za-z0-9 ()/&._-]{1,119})$/i;
const FREQUENCY = /^adjustment frequency:\s*(monthly|quarterly|annually|per flight)\s*\.?$/i;
const unitOf = (unit) => unit === "liter" ? "litre" : unit;

function parseFuelMechanism(source, index) {
  const evidence = [citation(source)];
  const missingConditions = [];
  const fields = {};
  const lines = source.text.split(/\r\n|\n|\r/).map((line) => line.trim()).filter(Boolean);
  // Only the actual structural heading may be omitted; all remaining text must be understood.
  if (/^(?:fuel (?:surcharge|price)(?: adjustment)?|pricing(?: adjustment)?|fuel adjustment)$/i.test(source.title || "")
    && lines[0]?.replace(/^(?:(?:article|section)\s+)?\d+(?:\.\d+)*[.)]?\s+/i, "").toLowerCase() === source.title.toLowerCase()) lines.shift();
  let unknownText = false;
  for (const line of lines) {
    const definition = [
      ["formula", FORMULA], ["base", BASE], ["baseline", BASELINE],
      ["reference", REFERENCE], ["frequency", FREQUENCY],
    ].map(([key, pattern]) => ({ key, match: line.match(pattern) })).find((item) => item.match);
    if (!definition) { unknownText = true; continue; }
    if (fields[definition.key]) missingConditions.push(`Conflicting or repeated ${definition.key} definition.`);
    fields[definition.key] = definition.match;
  }
  for (const key of ["formula", "base", "baseline", "reference", "frequency"]) {
    if (!fields[key]) missingConditions.push(`${key} not established within this clause.`);
  }
  if (unknownText) missingConditions.push("Additional text, conditions or cross-references are not supported by this bounded parser.");
  const baseAmount = fields.base ? Number(fields.base[2]) : null;
  const baselinePrice = fields.baseline ? Number(fields.baseline[2]) : null;
  if (baseAmount !== null && (!Number.isFinite(baseAmount) || baseAmount <= 0)) missingConditions.push("Base surcharge must be finite and positive.");
  if (baselinePrice !== null && (!Number.isFinite(baselinePrice) || baselinePrice <= 0)) missingConditions.push("Baseline fuel price must be finite and positive.");
  if (fields.base && fields.baseline && fields.base[1].toUpperCase() !== fields.baseline[1].toUpperCase()) missingConditions.push("Currency conversion is not supported.");
  return {
    id: `fuel:${source.clauseId || index}`,
    variable: "fuel_price",
    status: missingConditions.length ? "requires_review" : "supported",
    interpretation: "Narrow deterministic parsing of an explicit ratio mechanism; not a confirmed invoice or liability.",
    formula: fields.formula ? "base_surcharge * (current_fuel_price / baseline_fuel_price)" : null,
    baseSurcharge: fields.base ? { amount: baseAmount, currency: fields.base[1].toUpperCase(), unit: "flight" } : null,
    baselineFuelPrice: fields.baseline ? { amount: baselinePrice, currency: fields.baseline[1].toUpperCase(), unit: unitOf(fields.baseline[3].toLowerCase()) } : null,
    reference: fields.reference?.[1] ?? null,
    adjustmentFrequency: fields.frequency?.[1].toLowerCase() ?? null,
    applicableDate: null,
    missingConditions,
    evidence,
  };
}

export function buildAviationContractCore(sources = []) {
  const topics = AVIATION_CLAUSE_TAXONOMY.map(({ id, label, pattern }) => {
    const matched = sources.filter((source) => pattern.test(source.text));
    const evidence = matched.slice(0, MAX_TOPIC_CITATIONS).map((source) => citation(source));
    return { id, label, status: evidence.length ? "identified_for_review" : "not_established", identifiedClauseCount: matched.length, evidence };
  });
  const fuelSources = sources.filter((source) => /\bfuel\b/i.test(source.text) && /\b(surcharge|adjust(?:ed|ment)?|indexation)\b/i.test(source.text));
  const fuelMechanisms = fuelSources.length > 1 ? [{
    id: "fuel:multiple", variable: "fuel_price", status: "requires_review",
    interpretation: "Cross-clause pricing applicability is not established.",
    formula: null, baseSurcharge: null, baselineFuelPrice: null, reference: null,
    adjustmentFrequency: null, applicableDate: null, candidateClauseCount: fuelSources.length,
    missingConditions: ["Multiple fuel-related clauses were identified; cross-clause applicability and conflicting conditions require review."],
    evidence: fuelSources.slice(0, MAX_TOPIC_CITATIONS).map((source) => citation(source)),
  }] : fuelSources.map(parseFuelMechanism);
  const recommendations = topics.filter((topic) => topic.evidence.length).map((topic) => {
    const rule = AVIATION_CLAUSE_TAXONOMY.find((item) => item.id === topic.id);
    return {
      topicId: topic.id, title: `Review ${topic.label.toLowerCase()} mechanics`,
      action: rule.action,
      reason: `The cited original text mentions ${topic.label.toLowerCase()}; keyword identification does not establish applicability, enforceability or a breach.`,
      suggestedOwner: rule.owner, priority: "medium", triggerDeadline: null,
      basis: "interpretation", disclaimer: "Operational review suggestion; not an extracted obligation or legal advice.",
      evidence: topic.evidence,
    };
  });
  for (const mechanism of fuelMechanisms) {
    recommendations.push({
      topicId: "fuel_price", title: mechanism.status === "supported" ? "Validate fuel adjustment inputs" : "Resolve fuel pricing conditions",
      action: mechanism.status === "supported" ? "Finance should verify the contractual reference, input provenance and adjustment timing before using the formula." : "Finance should review the cited clause and resolve missing or unsupported pricing conditions before quantifying an adjustment.",
      reason: mechanism.status === "supported" ? "A ratio formula and its contractual base inputs were parsed; no current market value or applicable invoice date is established." : mechanism.missingConditions.join(" "),
      suggestedOwner: "FINANCE", priority: "high", triggerDeadline: null, basis: "interpretation",
      disclaimer: "No live feed, forecast, invoice, confirmed liability or savings claim.", evidence: mechanism.evidence,
    });
  }
  return { version: AVIATION_CORE_VERSION, topics, fuelMechanisms, recommendations, marketFeedStatus: "not_connected" };
}

/**
 * @typedef {{kind: "fuel_price", origin: "hypothetical"|"user_supplied", value: number,
 * currency: string, unit: "litre"|"gallon"|"kg", reference: string,
 * asOf: string, sourceLabel: string}} FuelPriceInput
 */

/** @param {object} mechanism @param {FuelPriceInput} input */
export function evaluateFuelPriceScenario(mechanism, input) {
  const issues = [];
  if (mechanism?.status !== "supported" || mechanism?.formula !== "base_surcharge * (current_fuel_price / baseline_fuel_price)"
    || !mechanism.evidence?.some((item) => item.originalClauseText)) issues.push("An evidence-linked supported pricing mechanism is required.");
  if (input?.kind !== "fuel_price" || !["hypothetical", "user_supplied"].includes(input?.origin)) issues.push("Choose an explicit hypothetical or user-supplied fuel-price input.");
  if (typeof input?.value !== "number" || !Number.isFinite(input.value) || input.value <= 0) issues.push("Fuel price must be a finite positive number.");
  if (!isCalendarDate(input?.asOf)) issues.push("A valid input observation/scenario date is required.");
  if (typeof input?.sourceLabel !== "string" || !input.sourceLabel.trim() || input.sourceLabel.length > 200) issues.push("A source label or hypothetical assumption is required (maximum 200 characters).");
  const baseline = mechanism?.baselineFuelPrice;
  const base = mechanism?.baseSurcharge;
  if (!Number.isFinite(base?.amount) || base.amount <= 0 || !Number.isFinite(baseline?.amount) || baseline.amount <= 0
    || base?.currency !== baseline?.currency) issues.push("Contractual base inputs are incomplete or inconsistent.");
  if (input?.currency !== baseline?.currency || input?.unit !== baseline?.unit || input?.reference !== mechanism?.reference) issues.push("Input currency, unit and reference must match the cited contractual baseline; no conversion or index substitution is supported.");
  if (mechanism?.missingConditions?.length) issues.push("Resolve the mechanism's missing conditions before calculating.");
  if (issues.length) return { status: "not_computable", basis: "scenario", issues, amount: null, delta: null, evidence: mechanism?.evidence || [] };
  const amount = base.amount * (input.value / baseline.amount);
  if (!Number.isFinite(amount) || !Number.isFinite(amount - base.amount)) return { status: "not_computable", basis: "scenario", issues: ["Calculation exceeded numeric limits."], amount: null, delta: null, evidence: mechanism.evidence };
  return {
    status: "computed", basis: "scenario", amount, delta: amount - base.amount,
    currency: base.currency, unit: base.unit, input: { ...input }, evidence: mechanism.evidence,
    calculation: `${base.amount} * (${input.value} / ${baseline.amount})`,
    issues: [], applicableDate: null,
    limitations: ["Input provenance is user-declared, not independently verified.", "The input date is not an established contractual adjustment date.", "No market feed, forecast, FX conversion, invoice, confirmed liability or guaranteed savings."],
  };
}
