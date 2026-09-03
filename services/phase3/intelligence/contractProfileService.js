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
  const result = findSupportedValue(
    sources,
    /between\s+([^\n(]+?)\s*\((?:the\s+)?["']?lessor["']?\)\s+and\s+([^\n(]+?)\s*\((?:the\s+)?["']?lessee["']?\)/i,
    (match) => [
      { name: match[1].trim(), role: "LESSOR", type: "ORGANIZATION" },
      { name: match[2].trim(), role: "LESSEE", type: "ORGANIZATION" },
    ]
  );
  return { parties: result.value || [], evidence: result.evidence };
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
  const expirationDate = findSupportedValue(sources, /(?:expiration|expiry|termination)\s+date\s*[:]?[\s]*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i, (match) => toIsoDate(match[1]));
  const renewalDate = findSupportedValue(sources, /renewal\s+date\s*[:]?[\s]*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i, (match) => toIsoDate(match[1]));
  const governingLaw = findSupportedValue(sources, /governed by (?:and construed in accordance with )?the laws? of\s+([^.;\n]+)/i);
  const currency = findSupportedValue(sources, /\b(USD|EUR|GBP|AED|JPY|CHF|CAD|AUD)\b/i, (match) => match[1].toUpperCase());
  const autoRenewal = findSupportedValue(sources, /(?:automatically renew|automatic renewal|auto-renew)/i, () => true);
  const parties = extractParties(sources);
  const classification = classifyContract(sources);
  const aircraftIdentifiers = extractIdentifiers(sources);
  const metadataFields = { title, contractNumber, effectiveDate, expirationDate, renewalDate, governingLaw, currency, autoRenewal };
  const claims = Object.entries(metadataFields)
    .filter(([, field]) => field.value !== null)
    .map(([field, value]) => ({ field, value: value.value, evidence: value.evidence }));
  if (parties.parties.length) claims.push({ field: "parties", value: parties.parties, evidence: parties.evidence });
  claims.push({ field: "contractType", value: classification.type, evidence: classification.evidence });
  aircraftIdentifiers.forEach((identifier) => claims.push({ field: identifier.type, value: identifier.value, evidence: identifier.evidence }));

  const metadata = {
    name: title.value,
    contractNumber: contractNumber.value,
    contractType: classification.type,
    effectiveDate: effectiveDate.value,
    expirationDate: expirationDate.value,
    renewalDate: renewalDate.value,
    autoRenewal: autoRenewal.value,
    governingLaw: governingLaw.value,
    currency: currency.value,
    parties: parties.parties,
  };
  const missing = Object.entries(metadata).filter(([, value]) => value === null || Array.isArray(value) && !value.length).map(([field]) => field);
  const namedParties = parties.parties.map((party) => `${party.name} (${party.role})`).join(" and ");
  const executiveSummary = [
    title.value || "The uploaded document",
    namedParties ? `is an evidence-supported ${classification.type.replaceAll("_", " ").toLowerCase()} between ${namedParties}` : `is classified as ${classification.type.replaceAll("_", " ").toLowerCase()}`,
    aircraftIdentifiers.length ? `and identifies ${aircraftIdentifiers.map((item) => `${item.type}: ${item.value}`).join(", ")}.` : ".",
  ].join(" ");
  const recommendations = risks.slice(0, 5).map((risk) => ({
    riskId: risk.id || null,
    title: `Potential ${String(risk.title || risk.risk_category || "contract issue").toLowerCase()}`,
    action: risk.recommendation || "Review the cited clause and confirm the responsible operational owner.",
    disclaimer: "Operational review recommendation; not legal advice.",
    evidence: risk.evidence || [],
  }));
  const supportedConfidences = claims.flatMap((claim) => Array.isArray(claim.evidence) ? claim.evidence.map((item) => item.confidence) : [claim.evidence?.confidence]).filter(Number.isFinite);

  return {
    metadata,
    classification,
    aircraftIdentifiers,
    summary: {
      executiveSummary,
      keyCommercialTerms: sources.filter((source) => /rent|payment|price|fee|currency/i.test(`${source.title} ${source.text}`)).slice(0, 5).map((source) => ({ title: source.title, evidence: evidenceFor(source) })),
      keyOperationalTerms: sources.filter((source) => /maintenance|insurance|return|report|airworth|compliance/i.test(`${source.title} ${source.text}`)).slice(0, 8).map((source) => ({ title: source.title, evidence: evidenceFor(source) })),
      keyObligations: obligations.slice(0, 8).map((item) => compactFinding(item, "obligation")),
      keyDeadlines: deadlines.slice(0, 8).map((item) => compactFinding(item, "deadline")),
      keyRisks: risks.slice(0, 8).map((item) => compactFinding(item, "risk")),
      unusualOrMissingTerms: missing.map((field) => ({ field, status: "not_established" })),
    },
    recommendations,
    evidenceClaims: claims,
    confidence: supportedConfidences.length ? supportedConfidences.reduce((sum, value) => sum + value, 0) / supportedConfidences.length : 0.2,
  };
}

export { AVIATION_CONTRACT_TYPES };