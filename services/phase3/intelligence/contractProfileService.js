const AVIATION_CONTRACT_TYPES = Object.freeze([
  "AIRCRAFT_LEASE", "AIRCRAFT_PURCHASE", "MRO", "ENGINE_MAINTENANCE",
  "POWER_BY_HOUR", "COMPONENT_SUPPORT", "INSURANCE", "GROUND_HANDLING",
  "AIRPORT_SERVICES", "SUPPLIER", "FINANCING", "CONSULTING", "OTHER",
]);

const CLASSIFICATION_RULES = [
  ["AIRCRAFT_LEASE", ["aircraft lease", "lessor", "lessee", "redelivery", "rent"]],
  ["AIRCRAFT_PURCHASE", ["aircraft purchase", "purchase price", "seller", "buyer"]],
  ["ENGINE_MAINTENANCE", ["engine maintenance", "shop visit", "engine serial"]],
  ["POWER_BY_HOUR", ["power by the hour", "flight hour rate", "cycle rate"]],
  ["COMPONENT_SUPPORT", ["component support", "rotable", "replacement component"]],
  ["GROUND_HANDLING", ["ground handling", "turnaround", "ramp services"]],
  ["AIRPORT_SERVICES", ["airport services", "airport operator", "landing charges"]],
  ["INSURANCE", ["hull insurance", "liability insurance", "insured value"]],
  ["MRO", ["maintenance repair and overhaul", "mro", "maintenance provider"]],
  ["FINANCING", ["facility agreement", "lender", "borrower", "security interest"]],
  ["CONSULTING", ["consulting services", "consultant", "professional services"]],
  ["SUPPLIER", ["supply agreement", "supplier", "purchase order"]],
];

function normalizeSource(clause, index) {
  const evidence = Array.isArray(clause.evidence) ? clause.evidence[0] : clause.evidence;
  return {
    clauseId: clause.id || null,
    clauseNumber: clause.clause_number || clause.clauseNumber || null,
    title: clause.title || null,
    text: String(clause.source_text || clause.text || ""),
    pageNumber: evidence?.page_number || clause.page_number || clause.pageStart || null,
    sourceLocation: evidence?.source_locator || clause.source_location || `clause:${clause.clause_number || clause.clauseNumber || index + 1}`,
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

function findSupportedValue(sources, pattern, map = (match) => match[1]?.trim()) {
  for (const source of sources) {
    const match = source.text.match(pattern);
    if (match) return { value: map(match), evidence: evidenceFor(source, match[0]) };
  }
  return { value: null, evidence: null };
}

function findAllSupportedValues(sources, pattern, map) {
  const findings = [];
  for (const source of sources) {
    const match = source.text.match(pattern);
    if (match) findings.push({ value: map(match, source), evidence: evidenceFor(source, match[0]) });
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
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
  const text = sources.map((source) => `${source.title || ""}\n${source.text}`).join("\n").toLowerCase();
  const ranked = CLASSIFICATION_RULES.map(([type, terms]) => {
    const matchedTerms = terms.filter((term) => text.includes(term));
    return { type, matchedTerms, score: matchedTerms.length };
  }).sort((left, right) => right.score - left.score);
  const winner = ranked[0];
  if (!winner?.score) return { type: "OTHER", confidence: 0.2, evidence: [] };
  const evidence = sources
    .filter((source) => winner.matchedTerms.some((term) => source.text.toLowerCase().includes(term)))
    .slice(0, 3)
    .map((source) => evidenceFor(source, source.text, Math.min(0.98, 0.55 + winner.score * 0.1)));
  return { type: winner.type, confidence: Math.min(0.98, 0.55 + winner.score * 0.1), evidence };
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
    ["ENGINE_IDENTIFIER", /(?:engine serial number|esn)\s*[:#]?\s*([A-Z0-9-]{2,24})/i],
  ];
  return definitions.flatMap(([type, pattern]) => {
    const match = findSupportedValue(sources, pattern);
    return match.value ? [{ type, value: match.value.toUpperCase(), evidence: match.evidence }] : [];
  });
}

function extractAsset(sources) {
  const field = (pattern) => supportedFinding(findSupportedValue(sources, pattern));
  return {
    manufacturer: field(/(?:aircraft\s+)?manufacturer\s*[:#]?\s*([^.;\n]+)/i),
    model: field(/(?:aircraft\s+)?model\s*[:#]?\s*([A-Z0-9-]{2,30})/i),
    aircraftType: field(/aircraft\s+type\s*[:#]?\s*([A-Z0-9-]{2,30})/i),
    registration: field(/(?:aircraft\s+)?(?:registration|tail number)\s*[:#]?\s*([A-Z0-9-]{3,12})/i),
    serialNumber: field(/(?:manufacturer(?:'s)? serial number|aircraft msn|msn)\s*[:#]?\s*([A-Z0-9-]{2,20})/i),
    deliveryDate: field(/delivery\s+date\s*[:]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i),
    currentOperator: field(/current\s+operator\s*[:#]?\s*([^.;\n]+)/i),
  };
}

function extractCommercialTerms(sources) {
  const baseRentResult = findSupportedValue(sources, /\b(monthly|quarterly|annual(?:ly)?)\s+(?:base\s+)?rent\s+of\s+(USD|EUR|GBP|AED|JPY|CHF|CAD|AUD)\s*([\d,]+(?:\.\d+)?)/i,
    (match) => ({ ...moneyValue(match, 2, 3), frequency: match[1].toLowerCase().startsWith("annual") ? "annual" : match[1].toLowerCase() }));
  const securityResult = findSupportedValue(sources, /\bsecurity deposit\s+of\s+(USD|EUR|GBP|AED|JPY|CHF|CAD|AUD)\s*([\d,]+(?:\.\d+)?)/i, (match) => moneyValue(match));
  const escalationResult = findSupportedValue(sources, /\b(?:rent|base rent)[^.]{0,80}?increase\s+by\s+([\d.]+)\s*(?:percent|%)([^.]*)/i,
    (match) => ({ ratePercent: Number(match[1]), formula: match[0].trim() }));
  const commencementResult = findSupportedValue(sources, /\brent\s+shall\s+commence\s+(?:on|upon)\s+([^.;]+)/i);
  const reserveResults = findAllSupportedValues(sources,
    /\b(airframe|engine|landing gear|apu|auxiliary power unit)\s+maintenance reserve\s+of\s+(USD|EUR|GBP|AED|JPY|CHF|CAD|AUD)\s*([\d,]+(?:\.\d+)?)\s+per\s+(flight hour|flight cycle|cycle|calendar month)/i,
    (match) => ({ reserveType: "maintenance_reserve", coveredComponent: match[1].toLowerCase(), rate: { ...moneyValue(match, 2, 3), unit: match[4].toLowerCase().replaceAll(" ", "_") } }));
  const fees = findAllSupportedValues(sources, /\b(?:fee|charge)\s+of\s+(USD|EUR|GBP|AED|JPY|CHF|CAD|AUD)\s*([\d,]+(?:\.\d+)?)/i, (match) => moneyValue(match));
  return {
    baseRent: baseRentResult.value ? { ...baseRentResult.value, evidence: baseRentResult.evidence } : null,
    rentCommencement: supportedFinding(commencementResult),
    rentEscalation: escalationResult.value ? { ...escalationResult.value, evidence: escalationResult.evidence } : null,
    securityDeposit: securityResult.value ? { ...securityResult.value, evidence: securityResult.evidence } : null,
    letterOfCredit: supportedFinding(findSupportedValue(sources, /\bletter of credit\b[^.;]*/i, (match) => match[0].trim())),
    maintenanceReserves: reserveResults.map((item) => ({ ...item.value, paymentFrequency: /\bmonthly\b/i.test(item.evidence.evidenceText) ? "monthly" : null, reimbursementMechanics: /reimburse[^.]*|paid invoices?[^.]*/i.exec(item.evidence.evidenceText)?.[0] || null, endOfLeaseTreatment: /unclaimed reserves?[^.]*/i.exec(item.evidence.evidenceText)?.[0] || null, evidence: item.evidence })),
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
  const returnLocation = supportedFinding(findSupportedValue(sources, /\breturn\s+the\s+aircraft\s+to\s+(.+?)(?=\s+in\s+an?\s+|[,.;])/i));
  const requirements = requirementFindings(sources, [
    ["aircraft_condition", /\b(?:airworthy condition|free of liens)\b[^.;]*/i, true],
    ["engine_condition", /\beach engine\b[^.;]*/i, true],
    ["llp", /\b(?:life limited part|LLP)s?\b[^.;]*/i, true],
    ["maintenance_status", /\bcurrent maintenance status\b[^.;]*/i, true],
    ["technical_records", /\b(?:complete technical records|missing records)\b[^.;]*/i, true],
    ["inspection", /\b(?:inspect|inspection)\b[^.;]*/i],
    ["cleaning_configuration", /\b(?:clean|configuration)\b[^.;]*/i],
    ["paint_livery", /\b(?:painted|paint|livery)\b[^.;]*/i],
    ["missing_parts", /\b(?:all installed parts|missing parts)\b[^.;]*/i],
    ["compensation", /\b(?:at the lessee['’]s cost|compensation|adjustment)\b[^.;]*/i, true],
  ]);
  return { returnLocation, requirements };
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
  const options = findAllSupportedValues(sources, /\b(?:may\s+)?extend\s+the\s+term\s+for\s+(\d+)\s+(months?|years?)[^.]*?(\d+)\s+(business\s+)?days?['’]?\s+(?:written\s+)?notice[^.]*/i,
    (match) => ({ extensionTerm: { amount: Number(match[1]), unit: match[2].toLowerCase() }, noticePeriod: { amount: Number(match[3]), unit: match[4] ? "business_days" : "days" }, pricing: /rent[^.]*agreed by the parties/i.test(match[0]) ? "To be agreed by the parties" : null }));
  return { options: options.map((item) => ({ ...item.value, evidence: item.evidence })) };
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
  const fields = classification.type === "AIRCRAFT_LEASE" ? Object.keys(LEASE_MISSING_CHECKLIST) : ["contractNumber", "parties", "term", "governingLaw"];
  return fields.filter((field) => !present[field]).map((field) => {
    const [label, whyItMatters] = LEASE_MISSING_CHECKLIST[field];
    return { field, status: "not_established", what: `${label} not established from the contract.`, whyItMatters, basis: "No evidence-backed value was extracted from the analysed contract text.", recommendedReview: `Confirm the ${label.toLowerCase()} in the source agreement or related schedule.`, evidence: [] };
  });
}

function operationalRecommendation(risk) {
  const source = `${risk.risk_type || ""} ${risk.title || ""}`.toLowerCase();
  if (/redelivery|return|maintenance|record/.test(source)) return { action: "Assign the lease return and technical team to convert the cited requirements into a tracked compliance checklist.", owner: "LEASE_RETURN_TECHNICAL", priority: "high" };
  if (/insurance/.test(source)) return { action: "Assign insurance compliance ownership and monitor the cited coverage and evidence deadlines.", owner: "INSURANCE_RISK", priority: "high" };
  if (/payment|rent|escalat|financial|reserve/.test(source)) return { action: "Assign finance to validate the cited payment mechanics and establish recurring exposure monitoring.", owner: "FINANCE", priority: "high" };
  if (/terminat|default|cure/.test(source)) return { action: "Assign legal and contract operations to monitor the cited default, cure, and notice conditions.", owner: "LEGAL_CONTRACTS", priority: "high" };
  return { action: "Assign the relevant contract owner to resolve the evidence-backed exposure and record the mitigation decision.", owner: "CONTRACT_OWNER", priority: risk.severity === "critical" ? "critical" : "medium" };
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
  const expirationDate = findSupportedValue(sources, /(?:expiration|expiry|termination)\s+date\s*[:]?[\s]*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i, (match) => toIsoDate(match[1]));
  const renewalDate = findSupportedValue(sources, /renewal\s+date\s*[:]?[\s]*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i, (match) => toIsoDate(match[1]));
  const governingLaw = findSupportedValue(sources, /governed by (?:and construed in accordance with )?the laws? of\s+([^.;\n]+)/i);
  const jurisdiction = findSupportedValue(sources, /courts? of\s+([^.;\n]+?)\s+(?:shall\s+)?have\s+(?:exclusive\s+)?jurisdiction/i);
  const currency = findSupportedValue(sources, /\b(USD|EUR|GBP|AED|JPY|CHF|CAD|AUD)\b/i, (match) => match[1].toUpperCase());
  const autoRenewal = findSupportedValue(sources, /(?:automatically renew|automatic renewal|auto-renew)/i, () => true);
  const parties = extractParties(sources);
  const classification = classifyContract(sources);
  const aircraftIdentifiers = extractIdentifiers(sources);
  const asset = extractAsset(sources);
  if (asset.deliveryDate) asset.deliveryDate.value = toIsoDate(asset.deliveryDate.value);
  const commercialTerms = extractCommercialTerms(sources);
  const redelivery = extractRedelivery(sources);
  const insurance = extractInsurance(sources);
  const defaultTermination = extractDefaultTermination(sources);
  const renewalExtension = extractRenewalExtension(sources);
  const commencementDate = commercialTerms.rentCommencement?.value && /delivery date/i.test(commercialTerms.rentCommencement.value) && asset.deliveryDate?.value
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
  };
  const missing = buildMissingTerms({ classification, metadata, asset, commercialTerms, redelivery, insurance, defaultTermination, renewalExtension, deadlines });
  metadata.leaseIntelligence = { asset, commercialTerms, redelivery, insurance, defaultTermination, renewalExtension };
  const namedParties = parties.parties.map((party) => `${party.name} (${party.role})`).join(" and ");
  const rentLabel = commercialTerms.baseRent ? `${commercialTerms.baseRent.currency} ${commercialTerms.baseRent.amount.toLocaleString("en-GB")} ${commercialTerms.baseRent.frequency}` : "financial commitment not established from the contract";
  const executiveSummary = [
    title.value || "The uploaded document",
    namedParties ? `is an evidence-supported ${classification.type.replaceAll("_", " ").toLowerCase()} between ${namedParties}` : `is classified as ${classification.type.replaceAll("_", " ").toLowerCase()}`,
    aircraftIdentifiers.length ? `and identifies ${aircraftIdentifiers.map((item) => `${item.type}: ${item.value}`).join(", ")}.` : ".",
    `Key financial commitment: ${rentLabel}.`,
    missing.length ? `${missing.length} material area${missing.length === 1 ? "" : "s"} could not be established and require review.` : "The aircraft lease checklist has evidence-backed coverage across its material areas.",
  ].join(" ");
  const recommendations = risks.slice(0, 8).map((risk) => {
    const operation = operationalRecommendation(risk);
    return {
      riskId: risk.id || null,
      title: `Address ${String(risk.title || risk.risk_category || "contract exposure").toLowerCase()}`,
      action: risk.recommendation || operation.action,
      reason: risk.rationale || risk.description || "The evidence-backed finding may affect contractual performance.",
      suggestedOwner: operation.owner,
      priority: operation.priority,
      triggerDeadline: risk.condition || deadlines.find((item) => risk.affected_deadline_ids?.includes(item.id))?.timing_expression || null,
      disclaimer: "Operational review recommendation; not legal advice.",
      evidence: risk.evidence || [],
    };
  });
  if (redelivery.requirements.length && !recommendations.some((item) => item.suggestedOwner === "LEASE_RETURN_TECHNICAL")) {
    recommendations.push({ riskId: null, title: "Create a redelivery compliance plan", action: "Assign the lease return and technical team to convert the cited redelivery conditions into a tracked compliance checklist.", reason: "The agreement states multiple aircraft, engine, records, and inspection requirements for return.", suggestedOwner: "LEASE_RETURN_TECHNICAL", priority: "high", triggerDeadline: metadata.expirationDate, disclaimer: "Operational review recommendation; not legal advice.", evidence: redelivery.requirements.flatMap((item) => [item.evidence]).slice(0, 4) });
  }
  if (commercialTerms.rentEscalation && !recommendations.some((item) => item.title.includes("escalation"))) {
    recommendations.push({ riskId: null, title: "Monitor contractual rent escalation", action: "Assign finance to maintain the contractual escalation inputs and calculate each adjustment from the cited formula.", reason: "The lease contains an express rent adjustment mechanism.", suggestedOwner: "FINANCE", priority: "high", triggerDeadline: "Each contractual escalation date", disclaimer: "Operational review recommendation; not legal advice.", evidence: [commercialTerms.rentEscalation.evidence] });
  }
  metadata.executiveSynthesis = {
    contractAtAGlance: {
      contractType: classification.type,
      parties: parties.parties,
      aircraft: aircraftIdentifiers,
      term: { commencementDate: metadata.commencementDate, expirationDate: metadata.expirationDate },
      keyFinancialCommitment: commercialTerms.baseRent || null,
    },
    materialExposures: risks.slice(0, 5).map((risk) => ({ id: risk.id || null, title: risk.title || risk.risk_category, consequence: risk.consequence || null, evidence: risk.evidence || [] })),
    criticalDates: deadlines.slice(0, 5).map((deadline) => ({ id: deadline.id || null, type: deadline.deadline_type, date: deadline.absolute_date || null, trigger: deadline.timing_expression || deadline.trigger_expression || null, evidence: deadline.evidence || [] })),
    keyRisks: risks.slice(0, 5).map((risk) => compactFinding(risk, "risk")),
    recommendedActions: recommendations.slice(0, 5),
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
    recommendations,
    evidenceClaims: claims,
    confidence: supportedConfidences.length ? supportedConfidences.reduce((sum, value) => sum + value, 0) / supportedConfidences.length : 0.2,
  };
}

export { AVIATION_CONTRACT_TYPES };