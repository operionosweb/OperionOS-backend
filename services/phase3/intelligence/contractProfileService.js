import { buildAviationContractCore } from "../../../domain/contractIntelligence/aviationContractCore.js";
import { isCalendarDate } from "../../../domain/contractIntelligence/calendarDate.js";

const AVIATION_CONTRACT_TYPES = Object.freeze([
  "AIRCRAFT_LEASE", "AIRCRAFT_PURCHASE", "MRO", "ENGINE_MAINTENANCE",
  "POWER_BY_HOUR", "COMPONENT_SUPPORT", "INSURANCE", "GROUND_HANDLING",
  "AIRPORT_SERVICES", "SUPPLIER", "FINANCING", "CONSULTING", "OTHER",
]);

const CLASSIFICATION_RULES = [
  { type: "AIRCRAFT_LEASE", decisive: [/\baircraft[\s-]+lease\b/i, /\blease\s+of\s+(?:(?:the|an?)\s+)?aircraft\b/i], supporting: ["lessor", "lessee", "monthly rent", "lease term", "redelivery"] },
  { type: "AIRCRAFT_PURCHASE", decisive: ["aircraft purchase", "aircraft purchase agreement"], supporting: ["purchase price", "seller", "buyer"] },
  { type: "ENGINE_MAINTENANCE", decisive: ["engine maintenance agreement", "engine maintenance contract"], supporting: ["shop visit", "engine serial"] },
  { type: "POWER_BY_HOUR", decisive: [
    /\bpower[\s-]+by[\s-]+(?:the[\s-]+)?hour[\s-]+(?:agreement|contract)\b/i,
    [/\bpbh[\s-]+(?:agreement|contract)\b/i, /\bflight[\s-]+hour[\s-]+rate\b/i],
  ], supporting: ["power by the hour", "flight hour rate", "cycle rate"] },
  { type: "COMPONENT_SUPPORT", decisive: ["component support agreement"], supporting: ["component support", "rotable", "replacement component"] },
  { type: "GROUND_HANDLING", decisive: ["ground handling agreement"], supporting: ["ground handling", "turnaround", "ramp services"] },
  { type: "AIRPORT_SERVICES", decisive: ["airport services agreement"], supporting: ["airport services", "airport operator", "landing charges"] },
  { type: "INSURANCE", decisive: [
    "aviation insurance agreement",
    [/\b(?:aviation|aircraft)[\s-]+hull(?:[\s-]+all[\s-]+risks?)?[\s-]+insurance[\s-]+(?:agreement|contract|policy)\b/i, /\binsured[\s-]+value\b/i],
    [/\b(?:aviation|aircraft)[\s-]+hull[\s-]+all[\s-]+risks?[\s-]+(?:agreement|contract|policy)\b/i, /\binsured[\s-]+value\b/i],
    [/\b(?:aviation|aircraft)[\s-]+hull[\s-]+insurance[\s-]+(?:agreement|contract|policy)\b/i, /\bagreed[\s-]+value\b/i],
  ], supporting: ["hull insurance", "liability insurance", "insured value"] },
  { type: "MRO", decisive: ["mro agreement", "mro provider", "maintenance repair and overhaul agreement"], supporting: ["maintenance repair and overhaul", "maintenance provider", "shop visit"] },
  { type: "FINANCING", decisive: ["aircraft financing agreement"], supporting: ["facility agreement", "lender", "borrower", "security interest"] },
  { type: "CONSULTING", decisive: ["aviation consulting agreement"], supporting: ["consulting services", "consultant", "professional services"] },
  { type: "SUPPLIER", decisive: ["supplier agreement", "supply agreement"], supporting: ["supplier", "purchase order"] },
];

function normalizeSource(clause) {
  const evidence = Array.isArray(clause.evidence) ? clause.evidence[0] : clause.evidence;
  return {
    clauseId: clause.id || null,
    clauseNumber: clause.clause_number || clause.clauseNumber || null,
    title: clause.title || null,
    text: String(clause.source_text || clause.text || ""),
    pageNumber: evidence?.page_number ?? clause.page_number ?? clause.pageStart ?? null,
    sourceLocation: evidence?.source_locator ?? clause.source_location ?? null,
    charStart: evidence?.char_start ?? null,
    charEnd: evidence?.char_end ?? null,
    evidenceId: evidence?.id || evidence?.evidence_id || clause.source_evidence_id || null,
  };
}

function evidenceFor(source, matchedText, confidence = 0.9) {
  return {
    evidenceId: source.evidenceId,
    clauseId: source.clauseId,
    clauseNumber: source.clauseNumber,
    pageNumber: source.pageNumber,
    sourceLocation: source.sourceLocation,
    evidenceText: matchedText || source.text,
    confidence,
  };
}

function sentenceForMatch(source, match) {
  const sentenceStart = source.text.lastIndexOf(".", match.index) + 1;
  const sentenceEnd = source.text.indexOf(".", match.index + match[0].length);
  return source.text.slice(sentenceStart, sentenceEnd < 0 ? undefined : sentenceEnd + 1).trim();
}

function findSupportedValue(sources, pattern, map = (match) => match[1]?.trim(), evidenceText = (match) => match[0]) {
  for (const source of sources) {
    const match = source.text.match(pattern);
    if (match) return { value: map(match, source), evidence: evidenceFor(source, evidenceText(match, source)) };
  }
  return { value: null, evidence: null };
}

function findAllSupportedValues(sources, pattern, map, evidenceText = (match) => match[0]) {
  const findings = [];
  const matcher = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  for (const source of sources) {
    for (const match of source.text.matchAll(matcher)) {
      findings.push({ value: map(match, source), evidence: evidenceFor(source, evidenceText(match, source)) });
    }
  }
  return findings;
}

function moneyValue(match, currencyIndex = 1, amountIndex = 2) {
  const amount = Number(String(match[amountIndex] || "").replaceAll(",", ""));
  return Number.isFinite(amount) ? { currency: match[currencyIndex].toUpperCase(), amount } : null;
}

function supportedFinding(result, extra = {}) {
  return result?.value !== null && result?.value !== undefined
    ? { value: result.value, evidence: result.evidence, ...extra }
    : null;
}

function toIsoDate(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/,$/, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return isCalendarDate(normalized) ? normalized : null;
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const dayFirst = normalized.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const monthFirst = normalized.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  const parts = dayFirst
    ? { day: Number(dayFirst[1]), month: months.indexOf(dayFirst[2].toLowerCase()), year: Number(dayFirst[3]) }
    : monthFirst
      ? { day: Number(monthFirst[2]), month: months.indexOf(monthFirst[1].toLowerCase()), year: Number(monthFirst[3]) }
      : null;
  if (!parts || parts.month < 0) return null;
  const parsed = new Date(Date.UTC(parts.year, parts.month, parts.day));
  if (parsed.getUTCFullYear() !== parts.year || parsed.getUTCMonth() !== parts.month || parsed.getUTCDate() !== parts.day) return null;
  return parsed.toISOString().slice(0, 10);
}

function classifyContract(sources) {
  const candidates = CLASSIFICATION_RULES.map(({ type, decisive, supporting }) => {
    // An array is a corroborated rule: every pattern must have source evidence.
    const evidenceForTerms = (terms) => terms.map((term) => {
      const patterns = Array.isArray(term) ? term : [term];
      const evidence = patterns.map((pattern) => {
        const expression = typeof pattern === "string"
          ? new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
          : pattern;
        const source = sources.find((item) => expression.test(`${item.title || ""}\n${item.text}`));
        if (!source) return null;
        const match = `${source.title || ""}\n${source.text}`.match(expression);
        return evidenceFor(source, typeof pattern === "string" ? pattern : match[0]);
      });
      return evidence.every(Boolean) ? evidence : null;
    }).filter(Boolean);
    const decisiveEvidence = evidenceForTerms(decisive);
    const supportingEvidence = evidenceForTerms(supporting);
    return {
      type,
      decisiveScore: decisiveEvidence.length,
      supportingScore: supportingEvidence.length,
      score: decisiveEvidence.length + supportingEvidence.length,
      evidence: [...decisiveEvidence.flat(), ...supportingEvidence.flat()],
    };
  }).filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.type.localeCompare(right.type));
  const decisiveCandidates = candidates.filter((candidate) => candidate.decisiveScore > 0);
  const confirmed = decisiveCandidates.length === 1 ? decisiveCandidates[0] : null;
  const totalDecisiveScore = decisiveCandidates.reduce((total, candidate) => total + candidate.decisiveScore, 0);
  const confidence = totalDecisiveScore
    ? (confirmed?.decisiveScore || Math.max(...decisiveCandidates.map((candidate) => candidate.decisiveScore))) / totalDecisiveScore
    : 0;

  return {
    type: confirmed?.type || "OTHER",
    status: confirmed ? "confirmed" : "requires_review",
    confidence,
    evidence: confirmed?.evidence || candidates.flatMap((candidate) => candidate.evidence),
    candidates,
  };
}

function extractParties(sources) {
  const parties = [];
  const evidence = [];
  const pairedPatterns = [
    /(?:by\s+and\s+)?between\s+([^\n,(]+?)(?:,?\s+as|\s*\((?:the\s+)?["']?)\s*lessor["']?\)?\s+and\s+([^\n,(]+?)(?:,?\s+as|\s*\((?:the\s+)?["']?)\s*lessee["']?\)?/i,
    /([^\n,;()]+?)\s*\((?:the\s+)?["']?lessor["']?\)\s+and\s+([^\n,;()]+?)\s*\((?:the\s+)?["']?lessee["']?\)/i,
  ];
  for (const source of sources) {
    const pair = pairedPatterns.map((pattern) => source.text.match(pattern)).find(Boolean);
    if (!pair) continue;
    parties.push(
      { name: pair[1].trim(), role: "LESSOR", type: "ORGANIZATION" },
      { name: pair[2].trim(), role: "LESSEE", type: "ORGANIZATION" }
    );
    evidence.push(evidenceFor(source, pair[0]));
    break;
  }
  const rolePattern = /^\s*([^\n:;()]{2,100}?)\s*(?:,\s+as\s+|\s*\((?:the\s+)?["']?)(guarantor|owner|manager|maintenance provider)["']?\)?\s*[,.;]?\s*$/gim;
  for (const source of sources) {
    for (const match of source.text.matchAll(rolePattern)) {
      const name = match[1].trim();
      if (/\b(law firm|counsel|advisor|broker|witness)\b/i.test(name)) continue;
      parties.push({ name, role: match[2].toUpperCase().replaceAll(" ", "_"), type: "ORGANIZATION" });
      evidence.push(evidenceFor(source, match[0]));
    }
  }
  const unique = [...new Map(parties.map((party) => [`${party.role}:${party.name.toLowerCase()}`, party])).values()];
  return { parties: unique, evidence };
}

function extractIdentifiers(sources) {
  const definitions = [
    ["AIRCRAFT_REGISTRATION", /(?:aircraft\s+)?(?:registration|tail number)\s*[:#]?\s*([A-Z0-9-]{3,12})/i],
    ["AIRCRAFT_MSN", /(?:manufacturer(?:'s)? serial number|aircraft msn|msn)\s*[:#]?\s*([A-Z0-9-]{2,20})/i],
  ];
  const identifiers = definitions.flatMap(([type, pattern]) =>
    findAllSupportedValues(sources, pattern, (match) => match[1].toUpperCase())
      .map((item) => ({ type, value: item.value, evidence: item.evidence }))
  );
  const uniqueAircraftIdentifiers = [...new Map(
    identifiers.map((identifier) => [`${identifier.type}:${identifier.value}`, identifier])
  ).values()];
  return [
    ...uniqueAircraftIdentifiers,
    ...findAllSupportedValues(sources, /(?:engine\s+serial\s+number|esn)\s*[:#]?\s*([A-Z0-9-]{2,24})/i, (match) => match[1].toUpperCase())
      .map((item) => ({ type: "ENGINE_IDENTIFIER", value: item.value, evidence: item.evidence })),
  ];
}

function extractAsset(sources, aircraftIdentifiers) {
  const field = (pattern) => supportedFinding(findSupportedValue(sources, pattern));
  const uniqueIdentifier = (type) => {
    const identifiers = aircraftIdentifiers.filter((identifier) => identifier.type === type);
    return new Set(identifiers.map((identifier) => identifier.value)).size === 1
      ? { value: identifiers[0].value, evidence: identifiers[0].evidence }
      : null;
  };
  return {
    manufacturer: field(/(?:aircraft\s+)?manufacturer\s*[:#]?\s*([^.;\n]+)/i),
    model: field(/(?:aircraft\s+)?model\s*[:#]?\s*([A-Z0-9-]{2,30})/i),
    aircraftType: field(/aircraft\s+type\s*[:#]?\s*([A-Z0-9-]{2,30})/i),
    registration: uniqueIdentifier("AIRCRAFT_REGISTRATION"),
    serialNumber: uniqueIdentifier("AIRCRAFT_MSN"),
    deliveryDate: field(/delivery\s+date\s*[:]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i),
    currentOperator: field(/current\s+operator\s*[:#]?\s*([^.;\n]+)/i),
  };
}

function extractCommercialTerms(sources) {
  const baseRentCandidates = findAllSupportedValues(sources,
    /\b(monthly|quarterly|annual(?:ly)?)\s+(?:base\s+)?rent\s+of\s+(USD|EUR|GBP|AED|JPY|CHF|CAD|AUD)\s*([\d,]+(?:\.\d+)?)/i,
    (match) => ({ ...moneyValue(match, 2, 3), frequency: match[1].toLowerCase().startsWith("annual") ? "annual" : match[1].toLowerCase() }));
  const uniqueBaseRents = new Map(baseRentCandidates.map((candidate) => [
    `${candidate.value?.amount}:${candidate.value?.currency}:${candidate.value?.frequency}`,
    candidate,
  ]));
  const baseRentConflict = uniqueBaseRents.size > 1;
  const baseRentResult = {
    value: baseRentConflict ? null : baseRentCandidates[0]?.value || null,
    evidence: baseRentConflict ? null : baseRentCandidates[0]?.evidence || null,
  };
  const securityResult = findSupportedValue(sources, /\bsecurity deposit\s+of\s+(USD|EUR|GBP|AED|JPY|CHF|CAD|AUD)\s*([\d,]+(?:\.\d+)?)/i, (match) => moneyValue(match));
  const indexedEscalationCandidates = findAllSupportedValues(sources,
    /(?=[^.;\n]{0,240}\b(?:CPI|consumer price index|inflation|interest rate|SOFR|EURIBOR|foreign exchange|exchange rate|FX)\b)(?=[^.;\n]{0,240}\b(?:adjust|increase|escalat|index|vary|review)\w*\b)[^.;\n]+[.;]?/i,
    (match) => {
      const formula = match[0].trim();
      const formulaType = /\b(?:CPI|consumer price index|inflation)\b/i.test(formula) ? "cpi_index"
        : /\b(?:interest rate|SOFR|EURIBOR)\b/i.test(formula) ? "interest_rate_index"
          : "foreign_exchange_index";
      const annual = /\b(?:annually|per annum|each year|every year|yearly|each anniversary|every anniversary)\b/i.test(formula);
      return {
        ratePercent: null,
        formula,
        formulaType,
        frequency: annual ? "annual" : null,
        recurrenceRule: annual ? formula : null,
      };
    });
  const fixedEscalationCandidates = findAllSupportedValues(sources, /\b(?:rent|base rent)[^.]{0,80}?increase\s+by\s+([\d.]+)\s*(?:percent|%)([^.]*)/i,
    (match, source) => {
      const sentence = sentenceForMatch(source, match);
      const annual = /\b(?:annually|per annum|each year|every year|yearly|each anniversary|every anniversary)\b/i.test(sentence);
      return {
        ratePercent: Number(match[1]),
        formula: sentence,
        formulaType: "fixed_percentage",
        frequency: annual ? "annual" : null,
        recurrenceRule: annual ? sentence : null,
      };
    },
    (match, source) => sentenceForMatch(source, match));
  const escalationCandidates = [...indexedEscalationCandidates, ...fixedEscalationCandidates];
  const uniqueEscalations = new Map(escalationCandidates.map((candidate) => {
    const value = candidate.value || {};
    const key = [
      value.formulaType,
      value.ratePercent,
      value.frequency,
      value.recurrenceRule?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    ].join(":");
    return [key, candidate];
  }));
  const escalationConflict = uniqueEscalations.size > 1;
  const escalationResult = escalationConflict
    ? {
      value: {
        ratePercent: null,
        formulaType: "conflicting",
        formula: "Conflicting rent adjustment mechanisms were found; human review is required.",
        frequency: null,
        conflictCandidates: [...uniqueEscalations.values()].map((item) => item.value),
      },
      evidence: null,
    }
    : uniqueEscalations.values().next().value || { value: null, evidence: null };
  const financialTermConflicts = [
    ...(baseRentConflict ? [{
      field: "base_rent",
      description: "Multiple incompatible base-rent amounts or frequencies were found.",
      candidates: [...uniqueBaseRents.values()],
    }] : []),
    ...(escalationConflict ? [{
      field: "rent_escalation",
      description: "Multiple incompatible fixed or indexed rent-adjustment terms were found.",
      candidates: [...uniqueEscalations.values()],
    }] : []),
  ];
  const commencementResult = findSupportedValue(sources, /\brent\s+shall\s+commence\s+(?:on|upon)\s+([^.;]+)/i);
  const reserveResults = findAllSupportedValues(sources,
    /\b(airframe|engine|landing gear|apu|auxiliary power unit)\s+maintenance reserve\s+of\s+(USD|EUR|GBP|AED|JPY|CHF|CAD|AUD)\s*([\d,]+(?:\.\d+)?)\s+per\s+(flight hour|flight cycle|cycle|calendar month)(?:\s+(monthly|quarterly|annually))?/i,
    (match, source) => {
      const reimbursement = source.text.match(/\breimbursement\s+requires?\b[^.;]*/i);
      const endOfLease = source.text.match(/\bunclaimed\s+reserves?\b[^.;]*/i);
      return {
        reserveType: "maintenance_reserve",
        coveredComponent: match[1].toLowerCase(),
        rate: { ...moneyValue(match, 2, 3), unit: match[4].toLowerCase().replaceAll(" ", "_") },
        paymentFrequency: match[5]?.toLowerCase() || null,
        paymentFrequencyEvidence: match[5] ? evidenceFor(source, match[0]) : null,
        reimbursementMechanics: reimbursement?.[0] || null,
        reimbursementEvidence: reimbursement ? evidenceFor(source, reimbursement[0]) : null,
        endOfLeaseTreatment: endOfLease?.[0] || null,
        endOfLeaseTreatmentEvidence: endOfLease ? evidenceFor(source, endOfLease[0]) : null,
      };
    });
  const fees = findAllSupportedValues(sources, /\b(?:fee|charge)\s+of\s+(USD|EUR|GBP|AED|JPY|CHF|CAD|AUD)\s*([\d,]+(?:\.\d+)?)/i, (match) => moneyValue(match));
  return {
    baseRent: baseRentResult.value ? { ...baseRentResult.value, evidence: baseRentResult.evidence } : null,
    rentCommencement: supportedFinding(commencementResult),
    rentEscalation: escalationResult.value ? {
      ...escalationResult.value,
      evidence: escalationResult.evidence,
      evidenceCandidates: escalationConflict ? [...uniqueEscalations.values()].map((item) => item.evidence) : [],
    } : null,
    financialTermConflicts,
    securityDeposit: securityResult.value ? { ...securityResult.value, evidence: securityResult.evidence } : null,
    letterOfCredit: supportedFinding(findSupportedValue(sources, /\bletter of credit\b[^.;]*/i, (match) => match[0].trim())),
    maintenanceReserves: reserveResults.map((item) => ({ ...item.value, evidence: item.evidence })),
    paymentDates: findAllSupportedValues(sources, /\b(?:on|by)\s+the\s+([^.;]*?(?:business day|day)[^.;]*)/i, (match) => match[1].trim()).map((item) => ({ value: item.value, evidence: item.evidence })),
    latePayment: supportedFinding(findSupportedValue(sources, /\blate payment\b[^.;]*/i, (match) => match[0].trim())),
    fees: fees.map((item) => ({ ...item.value, evidence: item.evidence })),
    taxObligations: findAllSupportedValues(sources, /\b(?:tax|taxes|withholding tax)\b[^.;]*/i, (match) => match[0].trim()).map((item) => ({ value: item.value, evidence: item.evidence })),
  };
}

function requirementFindings(sources, patterns) {
  return patterns.flatMap(([category, pattern, important = false]) => {
    const result = findSupportedValue(sources, pattern, (match) => match[0].trim());
    return result.value ? [{ category, requirement: result.value, important, evidence: result.evidence }] : [];
  });
}

function extractRedelivery(sources) {
  const returnSources = sources.filter((source) => (
    /\b(?:redeliver(?:y|ed|ing)|return conditions?|return(?:ing)? the aircraft|aircraft shall be returned)\b/i
      .test(`${source.title || ""}\n${source.text}`)
  ));
  const locationCandidates = findAllSupportedValues(
    returnSources,
    /\breturn\s+the\s+aircraft\s+to\s+(.+?)(?=\s+in\s+an?\s+|[,.;])/i,
    (match) => match[1].trim()
  );
  const locationsByValue = new Map();
  for (const candidate of locationCandidates) {
    const key = candidate.value.toLowerCase();
    const existing = locationsByValue.get(key);
    if (existing) existing.evidence.push(candidate.evidence);
    else locationsByValue.set(key, { value: candidate.value, evidence: [candidate.evidence] });
  }
  const candidates = [...locationsByValue.values()];
  const returnLocation = {
    value: candidates.length === 1 ? candidates[0].value : null,
    evidence: candidates.length === 1 ? candidates[0].evidence[0] : null,
    status: candidates.length > 1 ? "conflicting" : candidates.length === 1 ? "explicit" : "not_established",
    candidates,
  };
  const definitions = [
    ["aircraft_condition", /\b(?:airworthy condition|free of liens|aircraft condition)\b[^.;]*/i, true],
    ["engine_condition", /\b(?:each engine|engine condition|engines? shall)\b[^.;]*/i, true],
    ["apu_condition", /\b(?:APU|auxiliary power unit)\b[^.;]*/i, true],
    ["landing_gear_condition", /\blanding gear\b[^.;]*/i, true],
    ["llp", /\b(?:life limited part|LLP)s?\b[^.;]*/i, true],
    ["maintenance_status", /\b(?:current maintenance status|outstanding maintenance|maintenance programme|maintenance program)\b[^.;]*/i, true],
    ["technical_records", /\b(?:complete technical records|technical records|maintenance records|missing records)\b[^.;]*/i, true],
    ["airworthiness_documentation", /\b(?:airworthiness documentation|airworthiness records|certificate of airworthiness)\b[^.;]*/i, true],
    ["modifications_repairs", /\b(?:modifications?|repairs?)\b[^.;]*/i],
    ["damage_defects", /\b(?:damage|defects?)\b[^.;]*/i, true],
    ["inspection_acceptance", /\b(?:inspect(?:ion)?|acceptance condition|accept the aircraft)\b[^.;]*/i],
    ["cleaning_configuration", /\b(?:clean|configuration)\b[^.;]*/i],
    ["paint_livery", /\b(?:painted|paint|livery)\b[^.;]*/i],
    ["missing_parts", /\b(?:all installed parts|missing parts)\b[^.;]*/i],
    ["preparation_notice", /\b(?:notice|prepar(?:e|ation)|prior to redelivery|before redelivery)\b[^.;]*/i],
    ["compensation", /\b(?:at the lessee['’]s cost|compensation|adjustment)\b[^.;]*/i, true],
  ];
  const requirements = definitions.flatMap(([category, pattern, important = false]) =>
    findAllSupportedValues(returnSources, pattern, (match) => match[0].trim())
      .map((item) => ({
        category,
        requirement: item.value,
        important,
        evidence: item.evidence,
      }))
  );
  const uniqueRequirements = [...new Map(requirements.map((item) => [
    `${item.category}:${item.evidence.clauseId || ""}:${item.requirement.toLowerCase()}`,
    item,
  ])).values()];
  return { returnLocation, requirements: uniqueRequirements };
}

function extractInsurance(sources) {
  const requirements = requirementFindings(sources, [
    ["hull", /\bhull(?: all risks)? insurance\b[^.;]*/i, true],
    ["liability", /\b(?:aviation )?liability insurance\b[^.;]*/i, true],
    ["additional_insured", /\badditional insureds?\b[^.;]*/i],
    ["waiver", /\bwaiver of subrogation\b[^.;]*/i],
    ["certificate", /\b(?:certificate|renewal evidence)\b[^.;]*/i],
  ]).map((item) => {
    const amountMatch = item.requirement.match(/(USD|EUR|GBP|AED|JPY|CHF|CAD|AUD)\s*([\d,]+(?:\.\d+)?)/i);
    return { ...item, minimumCoverage: amountMatch ? moneyValue(amountMatch) : null };
  });
  return { requirements };
}

function extractDefaultTermination(sources) {
  const definitions = [
    ["payment_default", /\bfailure to pay\b[^.;]*/i],
    ["insurance_default", /\bfailure to maintain insurance\b[^.;]*/i],
    ["insolvency", /\binsolvency\b[^.;]*/i],
    ["maintenance_default", /\bmaterial breach of the maintenance obligations\b[^.;]*/i],
  ];
  return {
    events: requirementFindings(sources, definitions.map(([type, pattern]) => [type, pattern, true])).map(({ category, ...item }) => ({ type: category, ...item })),
    terminationRights: requirementFindings(sources, [["termination", /\bmay terminate\b[^.;]*/i, true]]),
    remedies: requirementFindings(sources, [["repossession", /\bmay repossess\b[^.;]*/i, true]]),
  };
}

function extractRenewalExtension(sources) {
  const options = findAllSupportedValues(sources, /\b(?:may\s+)?extend\s+the\s+term\s+for\s+(\d+)\s+(months?|years?)[^.]*?(\d+)\s+(?:(business|calendar)\s+)?days?['’]?\s+(?:written\s+)?notice[^.]*/i,
    (match) => {
      const noticeAnchor = match[0].match(/\b(?:before|prior to)\s+(?:the\s+)?(?:expiration|expiry) date\b/i);
      return {
        extensionTerm: { amount: Number(match[1]), unit: match[2].toLowerCase() },
        noticePeriod: {
          amount: Number(match[3]),
          unit: match[4]?.toLowerCase() === "business" ? "business_days" : "days",
          calendarType: match[4]?.toLowerCase() || null,
          anchorReference: noticeAnchor ? "expiration date" : null,
          expression: match[0],
        },
        pricing: /rent[^.]*agreed by the parties/i.test(match[0]) ? "To be agreed by the parties" : null,
      };
    });
  return { options: options.map((item) => ({ ...item.value, evidence: item.evidence })) };
}

function extractExpirationDate(sources) {
  const candidates = findAllSupportedValues(
    sources,
    /(?:\b(?:expiration|expiry)\s+date\s*[:]?[\s]*|\b(?:lease\s+)?term\s+(?:expires|ends)\s+(?:on\s+)?)(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i,
    (match) => toIsoDate(match[1])
  );
  const values = new Set(candidates.map((item) => item.value).filter(Boolean));
  const hasInvalidDate = candidates.some((item) => !item.value);
  const conflicting = values.size > 1 || (hasInvalidDate && values.size > 0);
  const status = conflicting ? "conflicting"
    : hasInvalidDate ? "invalid"
      : values.size ? "explicit" : "missing";
  const selected = !conflicting && !hasInvalidDate ? candidates.find((item) => item.value) : null;

  return {
    value: selected?.value || null,
    evidence: selected?.evidence || null,
    provenance: {
      status,
      candidates: candidates.map((item) => ({ value: item.value, evidence: item.evidence })),
      reason: conflicting
        ? "Multiple incompatible expiry values were found; verify the controlling provision."
        : hasInvalidDate ? "An expiry date was stated but could not be normalized safely." : null,
    },
  };
}

function buildLifecycleRelationships({ renewalExtension, expirationDate, deadlines }) {
  return renewalExtension.options.map((option) => {
    const optionClauseId = option.evidence?.clauseId || null;
    const deadline = deadlines.find((item) => (
      optionClauseId
      && item.source_clause_id === optionClauseId
      && String(item.anchor_reference || "").toLowerCase() === "expiration date"
    )) || null;
    const expirationSource = expirationDate.evidence;
    const expiryConflict = expirationDate.provenance.status === "conflicting" || expirationDate.provenance.status === "invalid";
    const unqualifiedDayCalculation = Boolean(
      deadline?.absolute_date
      && option.noticePeriod.unit === "days"
      && !option.noticePeriod.calendarType
    );
    const calculationUnavailable = Boolean(deadline && !deadline.absolute_date && deadline.metadata?.calculation?.reason);
    const status = expiryConflict || unqualifiedDayCalculation || calculationUnavailable ? "requires_review"
      : deadline?.status || (option.noticePeriod.anchorReference
        ? expirationDate.value ? "deadline_not_materialized" : "awaiting_expiry_date"
        : "notice_anchor_not_established");

    return {
      type: "extension_option_notice_deadline",
      status,
      exerciseStatus: "not_established",
      extensionTerm: option.extensionTerm,
      noticePeriod: option.noticePeriod,
      expirationDate: expirationDate.value,
      noticeDeadline: deadline?.absolute_date || null,
      deadlineStatus: deadline?.status || null,
      calculation: deadline?.metadata?.calculation || null,
      calculationBasis: deadline?.metadata?.calculation?.method || null,
      uncertainty: expiryConflict
        ? expirationDate.provenance.reason
        : unqualifiedDayCalculation
          ? "The clause says days without an explicit calendar-day basis; the parser used calendar-day arithmetic. Verify the contract's definitions and notice-counting rules."
        : deadline?.ambiguity || deadline?.metadata?.calculation?.reason || (!option.noticePeriod.anchorReference
          ? "The notice provision does not identify the lease expiry as its trigger."
          : !expirationDate.value
            ? "The lease expiry date is not established, so no absolute notice date can be calculated."
            : deadline?.status === "ambiguous"
              ? "The notice deadline is ambiguous; no absolute date is asserted."
              : deadline ? null : "No matching notice deadline was materialized for this option."),
      sourceReferences: [
        { type: "extension_option", clauseId: optionClauseId },
        ...(expirationSource?.clauseId ? [{ type: "lease_expiry", clauseId: expirationSource.clauseId }] : []),
        ...(deadline?.id ? [{ type: "deadline", id: deadline.id }] : []),
      ],
      evidence: [option.evidence, expirationSource].filter(Boolean),
    };
  });
}

const LEASE_MISSING_CHECKLIST = Object.freeze({
  contractNumber: ["Contract number", "A stable agreement reference is needed for contract operations and reconciliation."],
  aircraftIdentification: ["Aircraft identification", "An uncertain asset scope can undermine operational and return planning."],
  parties: ["Contractual parties", "Unclear party roles make ownership and accountability difficult to establish."],
  term: ["Lease term", "Term uncertainty prevents reliable deadline and exposure planning."],
  rent: ["Base rent", "The primary payment commitment cannot be monitored or quantified."],
  escalation: ["Rent escalation", "Future rent changes cannot be forecast from the contract."],
  security: ["Security arrangements", "Deposit or credit-support exposure cannot be established."],
  maintenanceReserves: ["Maintenance reserves", "Maintenance cash obligations and reimbursement rights cannot be established."],
  insurance: ["Insurance requirements", "Required coverage and compliance evidence cannot be monitored."],
  redelivery: ["Redelivery requirements", "Return planning cannot be converted into an operational checklist."],
  termination: ["Termination and default", "Default triggers, cure rights, and remedies cannot be planned."],
  renewal: ["Renewal or extension", "Decision windows and continued-use rights cannot be established."],
  governingLaw: ["Governing law", "The governing legal framework is not established."],
  notices: ["Notice requirements", "Contractual communications and decision deadlines may be missed."],
});

const GENERAL_MISSING_CHECKLIST = Object.freeze({
  contractNumber: ["Contract number", "A stable agreement reference is needed for contract operations and reconciliation."],
  parties: ["Contractual parties", "Unclear party roles make ownership and accountability difficult to establish."],
  term: ["Contract term", "Term uncertainty prevents reliable deadline and exposure planning."],
  governingLaw: ["Governing law", "The governing legal framework is not established."],
});

function buildMissingTerms({ classification, metadata, asset, commercialTerms, redelivery, insurance, defaultTermination, renewalExtension, deadlines }) {
  const present = {
    contractNumber: Boolean(metadata.contractNumber),
    aircraftIdentification: Boolean(asset.registration || asset.serialNumber), parties: metadata.parties.length >= 2,
    term: Boolean(metadata.expirationDate), rent: Boolean(commercialTerms.baseRent), escalation: Boolean(commercialTerms.rentEscalation),
    security: Boolean(commercialTerms.securityDeposit || commercialTerms.letterOfCredit), maintenanceReserves: commercialTerms.maintenanceReserves.length > 0,
    insurance: insurance.requirements.length > 0, redelivery: redelivery.requirements.length > 0,
    termination: defaultTermination.terminationRights.length > 0, renewal: renewalExtension.options.length > 0,
    governingLaw: Boolean(metadata.governingLaw), notices: deadlines.length > 0,
  };
  const isConfirmedLease = classification.status === "confirmed" && classification.type === "AIRCRAFT_LEASE";
  const checklist = isConfirmedLease ? LEASE_MISSING_CHECKLIST : GENERAL_MISSING_CHECKLIST;
  const fields = Object.keys(checklist);
  return fields.filter((field) => !present[field]).map((field) => {
    const [label, whyItMatters] = checklist[field];
    return { field, status: "not_established", what: `${label} not established from the contract.`, whyItMatters, basis: "No evidence-backed value was extracted from the analysed contract text.", recommendedReview: `Confirm the ${label.toLowerCase()} in the source agreement or related schedule.`, evidence: [] };
  });
}

function operationalRecommendation(risk, isConfirmedLease) {
  const source = `${risk.risk_type || ""} ${risk.title || ""}`.toLowerCase();
  if (isConfirmedLease && /redelivery|return|maintenance|record/.test(source)) return { action: "Assign the lease return and technical team to convert the cited requirements into a tracked compliance checklist.", owner: "LEASE_RETURN_TECHNICAL", priority: "high" };
  if (/insurance/.test(source)) return { action: "Assign insurance compliance ownership and monitor the cited coverage and evidence deadlines.", owner: "INSURANCE_RISK", priority: "high" };
  if (/payment|rent|escalat|financial|reserve/.test(source)) return { action: "Assign finance to validate the cited payment mechanics and establish recurring exposure monitoring.", owner: "FINANCE", priority: "high" };
  if (/terminat|default|cure/.test(source)) return { action: "Assign legal and contract operations to monitor the cited default, cure, and notice conditions.", owner: "LEGAL_CONTRACTS", priority: "high" };
  return { action: "Assign the relevant contract owner to resolve the evidence-backed exposure and record the mitigation decision.", owner: "CONTRACT_OWNER", priority: risk.severity === "critical" ? "critical" : "medium" };
}

function recommendationCategory(recommendation) {
  const source = `${recommendation.title || ""} ${recommendation.action || ""} ${recommendation.suggestedOwner || ""}`.toLowerCase();
  if (/\b(negotiate|renegotiate|amend|redline)\b/.test(source)) return "negotiation_intelligence";
  if (/\b(payment|rent|escalat|financial|reserve|finance|cpi|interest rate|foreign exchange)\b/.test(source)) return "commercial_protection";
  if (/\b(deadline|notice|renewal|extension|overdue|due date)\b/.test(source)) return "deadline_obligation_management";
  if (/\b(aircraft|lease|mro|maintenance|redelivery|return|insurance|delivery|acceptance|ground handling|service level)\b/.test(source)) return "operational_protection";
  return "contractual_protection";
}

function normalizedExcerpt(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function recommendationEvidence(items, sources) {
  const sourcesByClause = new Map();
  const sourcesByEvidence = new Map();
  for (const source of sources) {
    if (source.clauseId) sourcesByClause.set(source.clauseId, [...(sourcesByClause.get(source.clauseId) || []), source]);
    if (source.evidenceId) sourcesByEvidence.set(source.evidenceId, [...(sourcesByEvidence.get(source.evidenceId) || []), source]);
  }

  return [...new Map((Array.isArray(items) ? items : []).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    if (String(item.reviewStatus || item.review_status || "").toLowerCase() === "rejected") return [];
    const clauseMatches = item.clauseId ? sourcesByClause.get(item.clauseId) || [] : [];
    const evidenceMatches = item.evidenceId ? sourcesByEvidence.get(item.evidenceId) || [] : [];
    if (clauseMatches.length > 1 || evidenceMatches.length > 1) return [];
    const clauseSource = clauseMatches[0] || null;
    const evidenceSource = evidenceMatches[0] || null;
    if (clauseSource && evidenceSource && clauseSource.clauseId !== evidenceSource.clauseId) return [];
    const source = clauseSource || evidenceSource;
    if (!source?.clauseId || !source.text.trim()) return [];
    const excerpt = item.evidenceText || item.excerpt || item.source?.excerpt || source.text;
    if (!normalizedExcerpt(excerpt) || !normalizedExcerpt(source.text).includes(normalizedExcerpt(excerpt))) return [];
    return [[`${source.clauseId}:${normalizedExcerpt(excerpt)}`, {
      evidenceId: item.evidenceId || source.evidenceId,
      clauseId: source.clauseId,
      clauseNumber: source.clauseNumber,
      pageNumber: item.pageNumber || item.source?.page_number || source.pageNumber,
      sourceLocation: item.sourceLocation || item.source?.source_locator || source.sourceLocation,
      evidenceText: excerpt,
      confidence: item.confidence ?? null,
      reviewStatus: item.reviewStatus || item.review_status || null,
      ambiguityReason: item.ambiguityReason || item.ambiguity_reason || null,
    }]];
  })).values()];
}

function enrichRecommendation(recommendation, sources) {
  const evidence = recommendationEvidence(recommendation.evidence, sources);
  if (!evidence.length) return null;
  const confidences = evidence.map((item) => Number(item.confidence))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 1);
  const allConfidenceKnown = confidences.length === evidence.length;
  const lowConfidence = confidences.some((value) => value < 0.85);
  const evidenceNeedsHumanReview = evidence.some((item) => (
    item.reviewStatus && item.reviewStatus !== "verified"
  ) || item.ambiguityReason);
  let evidenceSufficiency = "source_linked_unverified";
  if (lowConfidence) evidenceSufficiency = "low_confidence_review_required";
  else if (evidenceNeedsHumanReview) evidenceSufficiency = "human_review_required";
  else if (!allConfidenceKnown) evidenceSufficiency = "confidence_not_established";
  else if (evidence.every((item) => item.reviewStatus === "verified")) evidenceSufficiency = "verified_source_support";
  const missingInformation = Array.isArray(recommendation.missingInformation)
    ? recommendation.missingInformation.filter((item) => typeof item === "string" && item.trim())
    : [];
  if ((lowConfidence || evidence.some((item) => item.ambiguityReason))
    && !missingInformation.some((item) => /source|clause|context/i.test(item))) {
    missingInformation.push("Verify the cited source and surrounding contractual context before acting.");
  }
  return {
    ...recommendation,
    category: recommendationCategory(recommendation),
    observedFacts: evidence.map((item) => item.evidenceText),
    interpretation: recommendation.reason || null,
    potentialImpact: typeof recommendation.potentialImpact === "string" && recommendation.potentialImpact.trim()
      ? recommendation.potentialImpact
      : null,
    evidenceConfidence: allConfidenceKnown ? Math.min(...confidences) : null,
    evidenceSufficiency,
    missingInformation,
    evidence,
  };
}

function compactFinding(item, fallbackType) {
  return {
    id: item.id || null,
    title: item.title || item.description || fallbackType,
    type: item.risk_category || item.deadline_type || item.obligation_type || fallbackType,
    confidence: Number(item.confidence ?? 0),
    evidence: item.evidence || [],
  };
}

export function buildContractProfile({ clauses = [], obligations = [], deadlines = [], risks = [] } = {}) {
  const sources = clauses.map(normalizeSource).filter((source) => source.text.trim());
  if (!sources.length) {
    const error = new Error("Clause source text is required for contract profiling");
    error.code = "SOURCE_TEXT_UNAVAILABLE";
    error.status = 422;
    throw error;
  }

  const title = findSupportedValue(sources, /^\s*([^\n]{3,120}(?:agreement|contract))\s*$/im);
  const contractNumber = findSupportedValue(sources, /(?:contract|agreement)\s*(?:number|no\.?|#)\s*[:#]?\s*([A-Z0-9][A-Z0-9._/-]{2,30})/i);
  const effectiveDate = findSupportedValue(sources, /effective\s+(?:as\s+of|date)?\s*[:]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i, (match) => toIsoDate(match[1]));
  const executionDate = findSupportedValue(sources, /(?:execution|signed)\s+date\s*[:]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i, (match) => toIsoDate(match[1]));
  const expirationDate = extractExpirationDate(sources);
  const renewalDate = findSupportedValue(sources, /renewal\s+date\s*[:]?[\s]*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i, (match) => toIsoDate(match[1]));
  const governingLaw = findSupportedValue(sources, /governed by (?:and construed in accordance with )?the laws? of\s+([^.;\n]+)/i);
  const jurisdiction = findSupportedValue(sources, /courts? of\s+([^.;\n]+?)\s+(?:shall\s+)?have\s+(?:exclusive\s+)?jurisdiction/i);
  const currency = findSupportedValue(sources, /\b(USD|EUR|GBP|AED|JPY|CHF|CAD|AUD)\b/i, (match) => match[1].toUpperCase());
  const autoRenewal = findSupportedValue(sources, /(?:automatically renew|automatic renewal|auto-renew)/i, () => true);
  const parties = extractParties(sources);
  const classification = classifyContract(sources);
  const aircraftIdentifiers = extractIdentifiers(sources);
  const asset = extractAsset(sources, aircraftIdentifiers);
  const conflictingAssetIdentifiers = ["AIRCRAFT_REGISTRATION", "AIRCRAFT_MSN"]
    .map((type) => ({
      type,
      candidates: aircraftIdentifiers.filter((identifier) => identifier.type === type),
    }))
    .filter(({ candidates }) => new Set(candidates.map((candidate) => candidate.value)).size > 1);
  if (asset.deliveryDate) asset.deliveryDate.value = toIsoDate(asset.deliveryDate.value);
  const commercialTerms = extractCommercialTerms(sources);
  const redelivery = extractRedelivery(sources);
  const insurance = extractInsurance(sources);
  const defaultTermination = extractDefaultTermination(sources);
  const renewalExtension = extractRenewalExtension(sources);
  const isConfirmedLease = classification.status === "confirmed" && classification.type === "AIRCRAFT_LEASE";
  const lifecycleRelationships = isConfirmedLease
    ? buildLifecycleRelationships({ renewalExtension, expirationDate, deadlines })
    : [];
  const commencementDateIsDerived = Boolean(commercialTerms.rentCommencement?.value && /delivery date/i.test(commercialTerms.rentCommencement.value) && asset.deliveryDate?.value);
  const commencementDate = commencementDateIsDerived
    ? { value: asset.deliveryDate.value, evidence: commercialTerms.rentCommencement.evidence }
    : findSupportedValue(sources, /(?:lease )?commencement\s+date\s*[:]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i, (match) => toIsoDate(match[1]));
  const metadataFields = { title, contractNumber, effectiveDate, executionDate, commencementDate, expirationDate, renewalDate, governingLaw, jurisdiction, currency, autoRenewal };
  const claims = Object.entries(metadataFields)
    .filter(([, field]) => field.value !== null)
    .map(([field, value]) => ({ field, value: value.value, evidence: value.evidence }));
  if (parties.parties.length) claims.push({ field: "parties", value: parties.parties, evidence: parties.evidence[0] });
  claims.push({ field: "contractType", value: classification.type, evidence: classification.evidence });
  aircraftIdentifiers.forEach((identifier) => claims.push({ field: identifier.type, value: identifier.value, evidence: identifier.evidence }));

  const metadata = {
    name: title.value,
    contractNumber: contractNumber.value,
    contractType: classification.type,
    effectiveDate: effectiveDate.value,
    executionDate: executionDate.value,
    commencementDate: commencementDate.value,
    expirationDate: expirationDate.value,
    renewalDate: renewalDate.value,
    autoRenewal: autoRenewal.value,
    governingLaw: governingLaw.value,
    jurisdiction: jurisdiction.value,
    currency: currency.value,
    parties: parties.parties,
    contractStatus: null,
    assetIdentificationReview: {
      status: conflictingAssetIdentifiers.length
        ? "requires_review"
        : aircraftIdentifiers.some((identifier) => ["AIRCRAFT_REGISTRATION", "AIRCRAFT_MSN"].includes(identifier.type))
          ? "unambiguous"
          : "not_established",
      conflicts: conflictingAssetIdentifiers,
    },
    factProvenance: {
      commencementDate: {
        status: commencementDateIsDerived ? "derived" : commencementDate.value ? "explicit" : "missing",
        derivation: commencementDateIsDerived
          ? "Resolved the rent commencement reference to the contract's stated Delivery Date."
          : null,
        evidence: commencementDateIsDerived
          ? [commercialTerms.rentCommencement.evidence, asset.deliveryDate.evidence].filter(Boolean)
          : commencementDate.evidence ? [commencementDate.evidence] : [],
      },
      expirationDate: {
        ...expirationDate.provenance,
        evidence: expirationDate.provenance.candidates.map((candidate) => candidate.evidence),
      },
    },
  };
  const missing = buildMissingTerms({ classification, metadata, asset, commercialTerms, redelivery, insurance, defaultTermination, renewalExtension, deadlines });
  metadata.leaseIntelligence = isConfirmedLease
    ? { asset, commercialTerms, redelivery, insurance, defaultTermination, renewalExtension, lifecycleRelationships }
    : null;
  const { recommendations: aviationRecommendations, ...aviationCore } = buildAviationContractCore(sources);
  metadata.aviationCore = aviationCore;
  const namedParties = parties.parties.map((party) => `${party.name} (${party.role})`).join(" and ");
  const rentLabel = commercialTerms.baseRent ? `${commercialTerms.baseRent.currency} ${commercialTerms.baseRent.amount.toLocaleString("en-GB")} ${commercialTerms.baseRent.frequency}` : "financial commitment not established from the contract";
  const executiveSummary = [
    title.value || "The uploaded document",
    namedParties ? `is an evidence-supported ${classification.type.replaceAll("_", " ").toLowerCase()} between ${namedParties}` : `is classified as ${classification.type.replaceAll("_", " ").toLowerCase()}`,
    aircraftIdentifiers.length ? `and identifies ${aircraftIdentifiers.map((item) => `${item.type}: ${item.value}`).join(", ")}.` : ".",
    `Key financial commitment: ${rentLabel}.`,
    classification.status === "requires_review"
      ? "Contract type requires human review; type-specific checklists are withheld."
      : missing.length
        ? `${missing.length} material area${missing.length === 1 ? "" : "s"} could not be established and require review.`
        : isConfirmedLease
          ? "The aircraft lease checklist has evidence-backed coverage across its material areas."
          : "The available contract profile is evidence-backed across its established material areas.",
  ].join(" ");
  const recommendations = risks.slice(0, 8).map((risk) => {
    const operation = operationalRecommendation(risk, isConfirmedLease);
    return {
      riskId: risk.id || null,
      title: `Address ${String(risk.title || risk.risk_category || "contract exposure").toLowerCase()}`,
      action: risk.recommendation || operation.action,
      reason: risk.rationale || risk.description || "The evidence-backed finding may affect contractual performance.",
      potentialImpact: typeof risk.consequence === "string" ? risk.consequence : null,
      missingInformation: risk.missing_information || risk.missingInformation || [],
      suggestedOwner: operation.owner,
      priority: operation.priority,
      triggerDeadline: risk.condition || deadlines.find((item) => risk.affected_deadline_ids?.includes(item.id))?.timing_expression || null,
      disclaimer: "Operational review recommendation; not legal advice.",
      evidence: risk.evidence || [],
    };
  });
  lifecycleRelationships.forEach((relationship) => {
    recommendations.push({
      riskId: null,
      title: "Review the aircraft lease extension option",
      action: "Confirm the commercial decision on exercising this option and, if proceeding, validate the cited notice date and service requirements.",
      reason: "The agreement contains a conditional extension right; the available evidence does not establish that the option has been exercised.",
      suggestedOwner: "LEASE_COMMERCIAL",
      priority: relationship.noticeDeadline ? "high" : "medium",
      triggerDeadline: relationship.noticeDeadline || relationship.noticePeriod.expression || null,
      deadlineStatus: relationship.deadlineStatus || relationship.status,
      deadlineCalculation: relationship.calculation,
      disclaimer: "Operational review recommendation; not legal advice.",
      evidence: relationship.evidence,
    });
  });
  if (isConfirmedLease && redelivery.requirements.length && !recommendations.some((item) => item.suggestedOwner === "LEASE_RETURN_TECHNICAL")) {
    recommendations.push({ riskId: null, title: "Create a redelivery compliance plan", action: "Assign the lease return and technical team to convert the cited redelivery conditions into a tracked compliance checklist.", reason: "The agreement states multiple aircraft, engine, records, and inspection requirements for return.", suggestedOwner: "LEASE_RETURN_TECHNICAL", priority: "high", triggerDeadline: metadata.expirationDate, disclaimer: "Operational review recommendation; not legal advice.", evidence: redelivery.requirements.flatMap((item) => [item.evidence]).slice(0, 4) });
  }
  if (commercialTerms.rentEscalation && !recommendations.some((item) => item.title.includes("escalation"))) {
    recommendations.push({ riskId: null, title: "Monitor contractual rent escalation", action: "Assign finance to maintain the contractual escalation inputs and calculate each adjustment from the cited formula.", reason: isConfirmedLease ? "The lease contains an express rent adjustment mechanism." : "The cited text contains an express rent adjustment mechanism.", suggestedOwner: "FINANCE", priority: "high", triggerDeadline: "Each contractual escalation date", disclaimer: "Operational review recommendation; not legal advice.", evidence: [commercialTerms.rentEscalation.evidence] });
  }
  recommendations.push(...aviationRecommendations);
  const evidenceGroundedRecommendations = recommendations
    .map((item) => enrichRecommendation(item, sources))
    .filter(Boolean);
  metadata.executiveSynthesis = {
    contractAtAGlance: {
      contractType: classification.type,
      parties: parties.parties,
      aircraft: aircraftIdentifiers,
      term: { commencementDate: metadata.commencementDate, expirationDate: metadata.expirationDate },
      keyFinancialCommitment: commercialTerms.baseRent || null,
    },
    materialExposures: risks.slice(0, 5).map((risk) => ({ id: risk.id || null, title: risk.title || risk.risk_category, consequence: risk.consequence || null, evidence: risk.evidence || [] })),
    criticalDates: [
      ...deadlines.slice(0, 5).map((deadline) => ({ id: deadline.id || null, type: deadline.deadline_type, date: deadline.absolute_date || null, trigger: deadline.timing_expression || deadline.trigger_expression || null, evidence: deadline.evidence || [] })),
      ...lifecycleRelationships.filter((relationship) => relationship.noticeDeadline).map((relationship) => ({
        id: null,
        type: "extension_notice",
        date: relationship.noticeDeadline,
        trigger: relationship.noticePeriod.expression,
        evidence: relationship.evidence,
        calculation: relationship.calculation,
      })),
    ].slice(0, 5),
    keyRisks: risks.slice(0, 5).map((risk) => compactFinding(risk, "risk")),
    recommendedActions: evidenceGroundedRecommendations.slice(0, 5),
  };
  const commercialSummary = [
    commercialTerms.baseRent && { type: "base_rent", title: "Base rent", value: { amount: commercialTerms.baseRent.amount, currency: commercialTerms.baseRent.currency, frequency: commercialTerms.baseRent.frequency }, evidence: commercialTerms.baseRent.evidence },
    commercialTerms.securityDeposit && { type: "security_deposit", title: "Security deposit", value: { amount: commercialTerms.securityDeposit.amount, currency: commercialTerms.securityDeposit.currency }, evidence: commercialTerms.securityDeposit.evidence },
    commercialTerms.rentEscalation && { type: "rent_escalation", title: "Rent escalation", value: { ratePercent: commercialTerms.rentEscalation.ratePercent, formula: commercialTerms.rentEscalation.formula }, evidence: commercialTerms.rentEscalation.evidence },
    ...commercialTerms.maintenanceReserves.map((item) => ({ type: "maintenance_reserve", title: `${item.coveredComponent} maintenance reserve`, value: item, evidence: item.evidence })),
  ].filter(Boolean);
  const supportedConfidences = claims.flatMap((claim) => Array.isArray(claim.evidence) ? claim.evidence.map((item) => item.confidence) : [claim.evidence?.confidence]).filter(Number.isFinite);

  return {
    metadata,
    classification,
    aircraftIdentifiers,
    asset,
    commercialTerms,
    redelivery,
    insurance,
    defaultTermination,
    renewalExtension,
    summary: {
      executiveSummary,
      keyCommercialTerms: commercialSummary,
      keyOperationalTerms: [...redelivery.requirements, ...insurance.requirements].slice(0, 12),
      keyObligations: obligations.slice(0, 8).map((item) => compactFinding(item, "obligation")),
      keyDeadlines: deadlines.slice(0, 8).map((item) => compactFinding(item, "deadline")),
      keyRisks: risks.slice(0, 8).map((item) => compactFinding(item, "risk")),
      unusualOrMissingTerms: missing,
    },
    recommendations: evidenceGroundedRecommendations,
    evidenceClaims: claims,
    confidence: supportedConfidences.length ? supportedConfidences.reduce((sum, value) => sum + value, 0) / supportedConfidences.length : 0.2,
  };
}

export { AVIATION_CONTRACT_TYPES };