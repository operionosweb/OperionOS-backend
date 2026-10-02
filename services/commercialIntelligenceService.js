import crypto from "node:crypto";

import { classifyIntelligenceDomains } from "./phase3/intelligence/roleIntelligenceService.js";

export const AVIATION_SEGMENTS = Object.freeze([
  "Airline", "Aircraft Leasing", "MRO", "Airport", "Ground Handling",
  "Aviation Consultancy", "Aviation Services", "Aircraft Manufacturer",
  "Engine Manufacturer", "Aviation Supplier", "Other Aviation",
]);

export const OPPORTUNITY_STATUSES = Object.freeze([
  "IDENTIFIED", "QUALIFYING", "CONTACTED", "ENGAGED", "PILOT_DISCUSSION",
  "PILOT", "CUSTOMER", "DISQUALIFIED",
]);

export const INTELLIGENCE_REVIEW_STATUSES = Object.freeze([
  "NEW", "REVIEWED", "QUALIFIED", "DISMISSED", "ACTIONED",
]);

export const RECOMMENDED_ACTION_TYPES = Object.freeze([
  "RESEARCH_ORGANISATION", "MONITOR_SIGNAL", "IDENTIFY_DECISION_MAKER",
  "CONTACT_PERSON", "PREPARE_AVIATION_MESSAGE", "INVESTIGATE_CONTRACT_EXPOSURE",
  "FOLLOW_UP_LATER",
]);

export const SIGNAL_TYPES = Object.freeze([
  "FLEET_EXPANSION", "FLEET_RENEWAL", "AIRCRAFT_ACQUISITION", "AIRCRAFT_DISPOSAL",
  "NETWORK_EXPANSION", "MRO_EXPANSION", "SUPPLIER_RELATIONSHIP", "OUTSOURCING",
  "AIRPORT_OPERATION", "CONTRACT_ANNOUNCEMENT", "LEADERSHIP_CHANGE",
  "REGULATORY_DEVELOPMENT", "RESTRUCTURING", "FINANCING_ACTIVITY",
  "GEOGRAPHIC_EXPANSION", "OPERATIONAL_DISRUPTION", "PROCUREMENT_ACTIVITY",
  "PARTNERSHIP_ANNOUNCEMENT", "TECHNOLOGY_ADOPTION", "STRATEGIC_CHANGE", "OTHER",
]);

const STATUS_TRANSITIONS = Object.freeze({
  IDENTIFIED: new Set(["QUALIFYING", "DISQUALIFIED"]),
  QUALIFYING: new Set(["CONTACTED", "DISQUALIFIED"]),
  CONTACTED: new Set(["ENGAGED", "DISQUALIFIED"]),
  ENGAGED: new Set(["PILOT_DISCUSSION", "DISQUALIFIED"]),
  PILOT_DISCUSSION: new Set(["PILOT", "DISQUALIFIED"]),
  PILOT: new Set(["CUSTOMER", "DISQUALIFIED"]),
  CUSTOMER: new Set([]),
  DISQUALIFIED: new Set(["QUALIFYING"]),
});

const ROLE_APPROACHES = Object.freeze({
  CFO: {
    problem: "financial exposure, payment obligations, escalation, reserves, and termination cost",
    value: "evidence-backed visibility across contractual financial exposure",
    cta: "Compare one representative agreement against the finance team's current review workflow.",
  },
  GENERAL_COUNSEL: {
    problem: "contract risk, obligations, notice periods, compliance, and clause-level exposure",
    value: "traceable contract intelligence with source evidence for legal review",
    cta: "Review one representative agreement and its evidence-backed obligations and risks.",
  },
  HEAD_OF_LEGAL: {
    problem: "contract risk, obligations, notice periods, compliance, and clause-level exposure",
    value: "traceable contract intelligence with source evidence for legal review",
    cta: "Review one representative agreement and its evidence-backed obligations and risks.",
  },
  FLEET_DIRECTOR: {
    problem: "lease obligations, redelivery requirements, records, and fleet continuity",
    value: "aircraft-specific visibility across lease obligations and operational deadlines",
    cta: "Use one aircraft lease to test redelivery and obligation visibility.",
  },
  HEAD_OF_LEASING: {
    problem: "lease obligations, commercial terms, redelivery exposure, and portfolio continuity",
    value: "portfolio-ready intelligence grounded in each lease and its source evidence",
    cta: "Review a representative lease through an aircraft lease intelligence pilot.",
  },
  CPO: {
    problem: "supplier obligations, pricing, renewal, and commercial exposure",
    value: "structured supplier-contract obligations, deadlines, and risk visibility",
    cta: "Test one material supplier agreement against the procurement review process.",
  },
  HEAD_OF_PROCUREMENT: {
    problem: "supplier obligations, pricing, renewal, and commercial exposure",
    value: "structured supplier-contract obligations, deadlines, and risk visibility",
    cta: "Test one material supplier agreement against the procurement review process.",
  },
  CEO: {
    problem: "strategic contract exposure, operational continuity, and decision visibility",
    value: "executive visibility into evidence-backed contractual exposure and required actions",
    cta: "Review a focused aviation-contract pilot around one strategic decision area.",
  },
  DEFAULT: {
    problem: "contract obligations, deadlines, risk, and decision visibility",
    value: "evidence-backed aviation Contract Intelligence",
    cta: "Review one representative aviation agreement through a focused pilot.",
  },
});

function badRequest(message, code = "INVALID_COMMERCIAL_INTELLIGENCE_INPUT") {
  return Object.assign(new Error(message), { status: 400, code });
}

function required(value, field, max = 2000) {
  const normalized = String(value || "").trim();
  if (!normalized) throw badRequest(`${field} is required`);
  if (normalized.length > max) throw badRequest(`${field} exceeds ${max} characters`);
  return normalized;
}

function optional(value, max = 4000) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim();
  if (normalized.length > max) throw badRequest(`Value exceeds ${max} characters`);
  return normalized;
}

function choice(value, allowed, field, fallback = null) {
  const normalized = value || fallback;
  if (!allowed.includes(normalized)) throw badRequest(`${field} is not supported`);
  return normalized;
}

function list(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, 30) : [];
}

function confidence(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw badRequest("confidence must be between 0 and 1");
  return number;
}

const TRACKING_PARAMETERS = new Set([
  "fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid", "ref", "ref_src",
]);

function sha256(value) {
  return value ? crypto.createHash("sha256").update(value, "utf8").digest("hex") : null;
}

export function normalizeSourceUrl(value) {
  if (!value) return null;
  let parsed;
  try {
    parsed = new URL(String(value).trim());
  } catch {
    throw badRequest("sourceUrl must be a valid HTTP or HTTPS URL", "INVALID_SOURCE_URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw badRequest("sourceUrl must use HTTP or HTTPS", "INVALID_SOURCE_URL");
  parsed.protocol = "https:";
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";
  if (parsed.port === "443" || parsed.port === "80") parsed.port = "";
  parsed.pathname = parsed.pathname.replace(/\/{2,}/g, "/");
  if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  const retained = [...parsed.searchParams.entries()]
    .filter(([key]) => !key.toLowerCase().startsWith("utm_") && !TRACKING_PARAMETERS.has(key.toLowerCase()))
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue));
  parsed.search = "";
  for (const [key, parameterValue] of retained) parsed.searchParams.append(key, parameterValue);
  return parsed.toString();
}

export function sourceFingerprint({ sourceUrl = null, canonicalUrl = null, excerpt = null } = {}) {
  const normalizedUrl = normalizeSourceUrl(canonicalUrl || sourceUrl);
  const originalUrl = sourceUrl ? String(sourceUrl).trim() : null;
  const normalizedContent = excerpt ? String(excerpt).toLowerCase().replace(/\s+/g, " ").trim() : null;
  return {
    originalUrl,
    canonicalUrl: canonicalUrl ? String(canonicalUrl).trim() : null,
    normalizedUrl,
    domain: normalizedUrl ? new URL(normalizedUrl).hostname : null,
    originalUrlHash: sha256(originalUrl),
    normalizedUrlHash: sha256(normalizedUrl),
    contentHash: sha256(normalizedContent),
  };
}

function tokenSimilarity(left, right) {
  const tokens = (value) => new Set(String(value || "").toLowerCase().match(/[a-z0-9]+/g) || []);
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return intersection / new Set([...leftTokens, ...rightTokens]).size;
}

export function classifySourceDuplicate(source, candidates = []) {
  for (const candidate of candidates) {
    if (source.originalUrlHash && candidate.original_url_hash === source.originalUrlHash) {
      return { status: "DUPLICATE", duplicateOfSourceId: candidate.id, reason: "Exact source URL already exists", confidence: 1 };
    }
    if (source.normalizedUrlHash && candidate.normalized_url_hash === source.normalizedUrlHash) {
      return { status: "DUPLICATE", duplicateOfSourceId: candidate.id, reason: "Normalized source URL already exists", confidence: 1 };
    }
  }
  for (const candidate of candidates) {
    if (source.contentHash && candidate.content_hash === source.contentHash) {
      return { status: "POSSIBLE_DUPLICATE", duplicateOfSourceId: candidate.id, reason: "Source content matches an existing record", confidence: 0.95 };
    }
    const similarity = source.domain && candidate.domain === source.domain ? tokenSimilarity(source.title, candidate.title) : 0;
    if (similarity >= 0.8) {
      return { status: "POSSIBLE_DUPLICATE", duplicateOfSourceId: candidate.id, reason: "Title is highly similar to a source from the same domain", confidence: Number(similarity.toFixed(4)) };
    }
  }
  return { status: "UNIQUE", duplicateOfSourceId: null, reason: "No duplicate indicators found", confidence: null };
}

export function buildEntityMatchProposal({ entityType, proposedEntity = {}, candidates = [], sourceId }) {
  const type = choice(String(entityType || "").toUpperCase(), ["COMPANY", "PERSON"], "entityType");
  const evidenceFor = (candidate) => {
    const evidence = [];
    let score = 0;
    if (type === "COMPANY") {
      const proposedName = proposedEntity.name ? normalizeCompanyName(proposedEntity.name) : "";
      const candidateName = candidate.normalized_name || (candidate.name ? normalizeCompanyName(candidate.name) : "");
      if (proposedName && proposedName === candidateName) { score += 0.75; evidence.push({ field: "name", match: "EXACT_NORMALIZED" }); }
      const proposedDomain = proposedEntity.website ? sourceFingerprint({ sourceUrl: proposedEntity.website }).domain : null;
      const candidateDomain = candidate.website ? sourceFingerprint({ sourceUrl: candidate.website }).domain : null;
      if (proposedDomain && proposedDomain === candidateDomain) { score += 0.2; evidence.push({ field: "website", match: "SAME_DOMAIN" }); }
      if (proposedEntity.country && candidate.country && proposedEntity.country.toLowerCase() === candidate.country.toLowerCase()) {
        score += 0.05; evidence.push({ field: "country", match: "EXACT" });
      }
    } else {
      const proposedName = String(proposedEntity.name || "").toLowerCase().trim();
      const candidateName = String(candidate.name || "").toLowerCase().trim();
      if (proposedName && proposedName === candidateName) { score += 0.55; evidence.push({ field: "name", match: "EXACT" }); }
      const roleScore = tokenSimilarity(proposedEntity.roleTitle, candidate.role_title || candidate.roleTitle);
      if (roleScore >= 0.8) { score += 0.25; evidence.push({ field: "roleTitle", match: "HIGH_SIMILARITY", score: Number(roleScore.toFixed(4)) }); }
      if (proposedEntity.companyId && proposedEntity.companyId === (candidate.company_id || candidate.companyId)) {
        score += 0.2; evidence.push({ field: "companyId", match: "EXACT" });
      }
    }
    return { candidate, evidence, score: Math.min(score, 1) };
  };
  const best = candidates.map(evidenceFor).sort((left, right) => right.score - left.score)[0];
  return {
    sourceId: required(sourceId, "sourceId", 100), entityType: type,
    candidateEntityId: best?.score >= 0.5 ? best.candidate.id : null,
    proposedEntity, matchEvidence: best?.evidence || [], confidence: best?.score || 0,
    status: "NEW",
  };
}

export function validateSourceReviewInput(input = {}) {
  const decision = choice(String(input.decision || "").toUpperCase(), ["APPROVE", "REJECT", "DEFER", "EDIT", "VERIFY"], "decision");
  const statusByDecision = { APPROVE: "REVIEWED", REJECT: "REJECTED", DEFER: "DEFERRED", EDIT: "REVIEWED", VERIFY: "VERIFIED" };
  if (decision === "EDIT" && (!input.changes || !Object.keys(input.changes).length)) throw badRequest("changes are required for an edit decision", "REVIEW_CHANGES_REQUIRED");
  return { decision, reviewStatus: statusByDecision[decision], reason: optional(input.reason, 4000), changes: input.changes || {} };
}

export function validateProposalReviewInput(input = {}) {
  const decision = choice(String(input.decision || "").toUpperCase(), ["APPROVE", "REJECT", "DEFER", "EDIT"], "decision");
  const statusByDecision = { APPROVE: "APPROVED", REJECT: "REJECTED", DEFER: "DEFERRED", EDIT: "EDITED" };
  if (decision === "EDIT" && (!input.changes || !Object.keys(input.changes).length)) throw badRequest("changes are required for an edit decision", "REVIEW_CHANGES_REQUIRED");
  return { decision, status: statusByDecision[decision], reason: optional(input.reason, 4000), changes: input.changes || {} };
}

export function normalizeCompanyName(name) {
  return required(name, "name", 240).toLowerCase().replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(limited|ltd|incorporated|inc|corporation|corp|plc|llc)\b/g, " ").replace(/\s+/g, " ").trim();
}

export function validateCompanyInput(input = {}) {
  return {
    name: required(input.name, "name", 240),
    normalizedName: normalizeCompanyName(input.name),
    legalName: optional(input.legalName, 240), website: optional(input.website, 500),
    country: optional(input.country, 120), region: optional(input.region, 120),
    aviationSegment: choice(input.aviationSegment, AVIATION_SEGMENTS, "aviationSegment"),
    companyType: optional(input.companyType, 160), fleetInformation: optional(input.fleetInformation),
    aviationActivities: list(input.aviationActivities), knownContractCategories: list(input.knownContractCategories),
    operationalCharacteristics: list(input.operationalCharacteristics), likelyPainPoints: list(input.likelyPainPoints),
    operionRelevance: optional(input.operionRelevance), internalNotes: optional(input.internalNotes, 10000),
    origin: choice(input.origin, ["MANUAL", "EXTERNAL_SOURCE", "AI_ENRICHED"], "origin", "MANUAL"),
  };
}

export function validatePersonInput(input = {}) {
  const verificationStatus = choice(input.verificationStatus, ["VERIFIED_FACT", "AI_INFERENCE", "UNVERIFIED_SIGNAL"], "verificationStatus", "UNVERIFIED_SIGNAL");
  const verificationSourceId = optional(input.verificationSourceId, 100);
  if (verificationStatus === "VERIFIED_FACT" && !verificationSourceId) {
    throw badRequest("verificationSourceId is required for a verified person", "VERIFIED_PERSON_SOURCE_REQUIRED");
  }
  return {
    companyId: required(input.companyId, "companyId", 100), name: optional(input.name, 240),
    roleTitle: required(input.roleTitle, "roleTitle", 240),
    roleCategory: choice(input.roleCategory, Object.keys(ROLE_APPROACHES).filter((role) => role !== "DEFAULT").concat(["COO", "HEAD_OF_OPERATIONS", "CONTRACTS_DIRECTOR", "COMMERCIAL_DIRECTOR", "RISK_DIRECTOR", "DIGITAL_TRANSFORMATION_DIRECTOR", "OTHER"]), "roleCategory"),
    linkedinUrl: optional(input.linkedinUrl, 500), email: optional(input.email, 320),
    relevanceReason: optional(input.relevanceReason), decisionScope: optional(input.decisionScope),
    confidence: confidence(input.confidence),
    verificationStatus, verificationSourceId,
    origin: choice(input.origin, ["MANUAL", "EXTERNAL_SOURCE", "AI_ENRICHED"], "origin", "MANUAL"),
  };
}

export function validateSignalInput(input = {}) {
  const verificationStatus = choice(input.verificationStatus, ["VERIFIED_FACT", "AI_INFERENCE", "UNVERIFIED_SIGNAL"], "verificationStatus", "UNVERIFIED_SIGNAL");
  const sourceId = optional(input.sourceId, 100);
  if (verificationStatus === "VERIFIED_FACT" && !sourceId) {
    throw badRequest("sourceId is required for a verified signal", "VERIFIED_SIGNAL_SOURCE_REQUIRED");
  }
  return {
    companyId: required(input.companyId, "companyId", 100), signalType: choice(input.signalType, SIGNAL_TYPES, "signalType"),
    title: required(input.title, "title", 500), description: required(input.description, "description", 4000),
    extractedFact: required(input.extractedFact || input.description, "extractedFact", 4000),
    aiInterpretation: optional(input.aiInterpretation), signalDate: optional(input.signalDate, 20),
    confidence: confidence(input.confidence), relevance: optional(input.relevance),
    operionImplication: optional(input.operionImplication), sourceId,
    reviewStatus: choice(input.reviewStatus, INTELLIGENCE_REVIEW_STATUSES, "reviewStatus", "NEW"),
    verificationStatus,
    origin: choice(input.origin, ["MANUAL", "EXTERNAL_SOURCE", "AI_ENRICHED"], "origin", "MANUAL"),
  };
}

export function validateSourceInput(input = {}) {
  const fingerprint = sourceFingerprint(input);
  const sourceType = choice(input.sourceType, ["COMPANY_WEBSITE", "NEWS", "REGULATORY", "PUBLIC_FILING", "INDUSTRY", "MANUAL_NOTE", "OTHER"], "sourceType");
  const qualityConfidence = Math.min(1,
    (fingerprint.normalizedUrl ? 0.25 : 0)
    + (input.publisher ? 0.15 : 0)
    + (input.publishedAt ? 0.15 : 0)
    + (input.excerpt ? 0.25 : 0)
    + (["REGULATORY", "PUBLIC_FILING", "COMPANY_WEBSITE"].includes(sourceType) ? 0.2 : 0.1));
  return {
    title: required(input.title, "title", 500), publisher: optional(input.publisher, 240),
    sourceUrl: optional(input.sourceUrl, 1000), canonicalUrl: optional(input.canonicalUrl, 1000),
    normalizedUrl: fingerprint.normalizedUrl, domain: fingerprint.domain,
    originalUrlHash: fingerprint.originalUrlHash, normalizedUrlHash: fingerprint.normalizedUrlHash,
    contentHash: fingerprint.contentHash, publishedAt: optional(input.publishedAt, 50),
    excerpt: optional(input.excerpt, 5000),
    sourceType, qualityConfidence,
    verificationStatus: choice(input.verificationStatus, ["VERIFIED_FACT", "AI_INFERENCE", "UNVERIFIED_SIGNAL"], "verificationStatus", "UNVERIFIED_SIGNAL"),
  };
}

function roleApproach(person = {}) {
  return ROLE_APPROACHES[person.role_category || person.roleCategory] || ROLE_APPROACHES.DEFAULT;
}

export function buildGroundedOpportunityReasoning({ company, signal = null, person = null, sources = [], rbiProfile = null }) {
  if (!company) throw badRequest("A company is required for opportunity reasoning");
  const verifiedSources = sources.filter((source) => source.verification_status === "VERIFIED_FACT");
  const hasSignalEvidence = Boolean(signal && sources.length);
  const approach = roleApproach(person || {});
  const companyName = company.name;
  const segment = company.aviation_segment || "aviation";
  const useCase = company.known_contract_categories?.[0] || (segment === "Aircraft Leasing" ? "aircraft lease portfolio intelligence" : "aviation contract intelligence");
  const whyCompany = verifiedSources.length
    ? `${companyName} is recorded as ${segment}; the linked sources support evaluating its contract-intelligence needs.`
    : `${companyName} is recorded internally as ${segment}. This profile requires external source validation before outreach.`;
  const whyNow = hasSignalEvidence
    ? `${signal.extracted_fact || signal.description} This ${String(signal.verification_status || "UNVERIFIED_SIGNAL").toLowerCase().replaceAll("_", " ")} may create additional contract complexity.`
    : "No source-backed timing trigger is established. Validate a current business signal before treating this as time-sensitive.";
  const whyPerson = person
    ? `${person.name || person.role_title} is a likely relevant contact because the role may influence ${approach.problem}. Decision authority is not confirmed without supporting evidence.`
    : "No individual is established. Research the role responsible for the relevant contract decision before outreach.";
  const priorityReasons = [
    AVIATION_SEGMENTS.includes(segment) ? `Strong aviation fit: ${segment}` : null,
    hasSignalEvidence ? "A dated business signal has linked evidence" : null,
    verifiedSources.length ? `${verifiedSources.length} verified source${verifiedSources.length === 1 ? "" : "s"}` : "Evidence validation is still required",
    person ? `A likely relevant ${person.role_title} is identified` : null,
    company.known_contract_categories?.length ? "A relevant contract category is identified" : null,
  ].filter(Boolean);
  const positiveFactors = priorityReasons.filter((reason) => !/required|still/i.test(reason)).length;
  const priority = positiveFactors >= 4 ? "HIGH" : positiveFactors >= 2 ? "MEDIUM" : "LOW";
  const angle = `Discuss ${approach.problem} in the context of ${useCase}.`;
  const message = `Hello${person?.name ? ` ${person.name}` : ""}, I am researching how ${segment.toLowerCase()} teams manage ${approach.problem}. Operion turns aviation agreements into evidence-backed obligations, deadlines, risks, and decision-ready actions. ${approach.cta}`;

  return {
    whyCompany, whyNow,
    whyOperion: `Operion can provide ${approach.value} for the potential use case: ${useCase}.`,
    potentialContractUseCase: useCase, whyPerson,
    recommendedApproach: {
      recommendedPerson: person?.name || person?.role_title || "Relevant contract decision owner not yet identified",
      certainty: person?.verification_status === "VERIFIED_FACT" ? "VERIFIED_ROLE" : "LIKELY_RELEVANT_CONTACT",
      reason: whyPerson, approachAngle: angle, keyProblem: approach.problem,
      valueProposition: approach.value, suggestedCta: approach.cta,
    },
    suggestedOutreach: {
      linkedin: message.slice(0, 500),
      email: `${message}\n\nThe first step would be a focused review using one representative agreement, with every finding linked to its source.`,
      executiveIntroduction: `Operion provides ${approach.value} for aviation teams.`,
      followUp: "Share one source-backed use case or representative agreement for a focused review.",
    },
    primaryNextAction: hasSignalEvidence ? (person ? `Validate ${person.role_title} responsibility and prepare a role-specific approach` : "Identify the relevant contract decision owner") : "Validate a current company signal with an external source",
    secondaryAction: hasSignalEvidence ? `Prepare a ${useCase} demonstration` : null,
    priority, priorityReasons,
    reasoningMethod: "DETERMINISTIC",
    evidenceSourceIds: sources.map((source) => source.id),
    rbiContext: rbiProfile ? { profileId: rbiProfile.roleId, focus: rbiProfile.summaryPrompt } : null,
  };
}

export async function generateGroundedOpportunityReasoning({ company, signal = null, person = null, sources = [], rbiProfile = null, provider = null }) {
  const deterministic = buildGroundedOpportunityReasoning({ company, signal, person, sources, rbiProfile });
  if (!provider || !sources.length) return deterministic;
  const sourceIds = new Set(sources.map((source) => source.id));
  const facts = {
    company: { name: company.name, aviationSegment: company.aviation_segment, fleetInformation: company.fleet_information, contractCategories: company.known_contract_categories || [] },
    signal: signal ? { fact: signal.extracted_fact || signal.description, type: signal.signal_type, date: signal.signal_date, verificationStatus: signal.verification_status } : null,
    person: person ? { name: person.name, roleTitle: person.role_title, roleCategory: person.role_category, verificationStatus: person.verification_status } : null,
    sources: sources.map((source) => ({ id: source.id, title: source.title, excerpt: source.excerpt, verificationStatus: source.verification_status })),
    rbi: rbiProfile ? { profileId: rbiProfile.roleId, focus: rbiProfile.summaryPrompt } : null,
  };
  try {
    const response = await provider.generate({
      structured: true,
      temperature: 0.1,
      system: "Return JSON only. Reason exclusively from the supplied facts and sources. Do not invent people, initiatives, contracts, relationships, or numbers. Each claim must cite one or more supplied source IDs.",
      input: JSON.stringify({
        task: "Explain why this company, why now, why Operion, and the potential contract use case.",
        requiredShape: { whyCompany: "string", whyNow: "string", whyOperion: "string", potentialContractUseCase: "string", evidenceSourceIds: ["source-id"] },
        facts,
      }),
    });
    const candidate = typeof response?.output === "string" ? JSON.parse(response.output.replace(/^```json\s*/i, "").replace(/\s*```$/, "")) : response?.output;
    const cited = Array.isArray(candidate?.evidenceSourceIds) ? candidate.evidenceSourceIds : [];
    const citationsValid = cited.length > 0 && cited.every((id) => sourceIds.has(id));
    const fieldsValid = ["whyCompany", "whyNow", "whyOperion", "potentialContractUseCase"].every((field) => typeof candidate?.[field] === "string" && candidate[field].trim());
    if (!citationsValid || !fieldsValid) return deterministic;
    return {
      ...deterministic,
      whyCompany: candidate.whyCompany.trim(),
      whyNow: candidate.whyNow.trim(),
      whyOperion: candidate.whyOperion.trim(),
      potentialContractUseCase: candidate.potentialContractUseCase.trim(),
      reasoningMethod: "AI_GROUNDED",
      evidenceSourceIds: [...new Set(cited)],
    };
  } catch {
    return deterministic;
  }
}

export function prioritizeCommercialIntelligence({ context, companies = [], signals = [], opportunities = [] }) {
  const profile = context?.rbiProfile;
  const prioritize = (items) => items.map((item, index) => {
    const domains = classifyIntelligenceDomains(item);
    const domainPosition = Math.min(...domains.map((domain) => profile?.intelligenceDomains.indexOf(domain) ?? -1).filter((position) => position >= 0), 99);
    const recency = Date.parse(item.signal_date || item.updated_at || item.created_at || 0) || 0;
    return { item, index, domainPosition, recency, domains };
  }).sort((left, right) => left.domainPosition - right.domainPosition || right.recency - left.recency || left.index - right.index)
    .map(({ item, domains }) => ({ ...item, rbi: { profileId: profile?.roleId || "DEFAULT", domains } }));
  return { companies: prioritize(companies), signals: prioritize(signals), opportunities: prioritize(opportunities) };
}

export function assertOpportunityTransition(current, next) {
  if (current === next) return next;
  if (!STATUS_TRANSITIONS[current]?.has(next)) throw badRequest(`Opportunity cannot transition from ${current} to ${next}`, "INVALID_OPPORTUNITY_STATUS_TRANSITION");
  return next;
}

export function validateOpportunityInput(input = {}) {
  const signalId = optional(input.signalId, 100);
  const primarySourceId = optional(input.primarySourceId, 100);
  if (!signalId && !primarySourceId) {
    throw badRequest("An opportunity requires a supporting signal or primary source", "OPPORTUNITY_EVIDENCE_REQUIRED");
  }
  return {
    companyId: required(input.companyId, "companyId", 100), signalId, primarySourceId,
    keyPersonId: optional(input.keyPersonId, 100), title: required(input.title, "title", 500),
    opportunityType: choice(input.opportunityType, ["CONTRACT_INTELLIGENCE", "CONTRACT_RISK", "CONTRACT_COMPLIANCE", "CONTRACT_RENEWAL", "SUPPLIER_RISK", "AVIATION_OPERATIONAL_RISK", "PREDICTIVE_CONTRACT_INTELLIGENCE", "OTHER"], "opportunityType"),
    aviationSegment: optional(input.aviationSegment, 120), potentialContractUseCase: optional(input.potentialContractUseCase),
    whyCompany: optional(input.whyCompany), whyNow: optional(input.whyNow), whyOperion: optional(input.whyOperion),
    whyPerson: optional(input.whyPerson), valueHypothesis: optional(input.valueHypothesis),
    recommendedApproach: input.recommendedApproach || {}, suggestedOutreach: input.suggestedOutreach || {},
    primaryNextAction: optional(input.primaryNextAction), secondaryAction: optional(input.secondaryAction),
    status: choice(input.status, OPPORTUNITY_STATUSES, "status", "IDENTIFIED"),
    priority: choice(input.priority, ["HIGH", "MEDIUM", "LOW"], "priority", "MEDIUM"),
    priorityReasons: list(input.priorityReasons),
    reasoningMethod: choice(input.reasoningMethod, ["DETERMINISTIC", "AI_GROUNDED", "MANUAL"], "reasoningMethod", "MANUAL"),
    origin: choice(input.origin, ["MANUAL", "EXTERNAL_SOURCE", "AI_ENRICHED"], "origin", "MANUAL"),
  };
}

export function validateRecommendedActionInput(input = {}) {
  return {
    opportunityId: required(input.opportunityId, "opportunityId", 100),
    personId: optional(input.personId, 100),
    actionType: choice(input.actionType, RECOMMENDED_ACTION_TYPES, "actionType"),
    actionText: required(input.actionText, "actionText", 1000),
    reason: required(input.reason, "reason", 4000),
    evidenceSourceId: required(input.evidenceSourceId, "evidenceSourceId", 100),
    confidence: confidence(input.confidence),
    status: choice(input.status, INTELLIGENCE_REVIEW_STATUSES, "status", "NEW"),
    reasoningMethod: choice(input.reasoningMethod, ["DETERMINISTIC", "AI_GROUNDED", "MANUAL"], "reasoningMethod", "MANUAL"),
  };
}

export function validateIntelligenceReviewStatus(status) {
  return choice(status, INTELLIGENCE_REVIEW_STATUSES, "status");
}

export async function extractSignalFromSource({ company, source, provider }) {
  if (!company || !source) throw badRequest("A company and stored source are required for signal extraction");
  if (!provider) throw Object.assign(new Error("Signal extraction provider is unavailable"), { status: 503, code: "INTELLIGENCE_PROVIDER_UNAVAILABLE" });
  const response = await provider.generate({
    structured: true,
    temperature: 0.1,
    system: "Return JSON only. Extract only facts explicitly present in the supplied source. Keep interpretation separate. Do not invent people, quantities, dates, relationships, or events. Cite the supplied source ID.",
    input: JSON.stringify({
      task: "Extract one commercially relevant aviation signal for Operion review, or classify it as OTHER if no narrower type applies.",
      allowedSignalTypes: SIGNAL_TYPES,
      requiredShape: {
        signalType: "allowed signal type", title: "concise title", extractedFact: "fact stated by source",
        aiInterpretation: "uncertain implication using may/could language", relevance: "why this matters",
        operionImplication: "potential contract-intelligence relevance", confidence: 0.0,
        detectedDate: "YYYY-MM-DD or null", evidenceSourceId: source.id,
      },
      company: { id: company.id, name: company.name, aviationSegment: company.aviation_segment },
      source: { id: source.id, title: source.title, publisher: source.publisher, publishedAt: source.published_at, excerpt: source.excerpt, url: source.source_url },
    }),
  });
  const candidate = typeof response?.output === "string" ? JSON.parse(response.output.replace(/^```json\s*/i, "").replace(/\s*```$/, "")) : response?.output;
  if (candidate?.evidenceSourceId !== source.id) throw badRequest("AI signal extraction did not cite the stored source", "UNGROUNDED_SIGNAL_EXTRACTION");
  return validateSignalInput({
    companyId: company.id,
    signalType: candidate.signalType,
    title: candidate.title,
    description: candidate.extractedFact,
    extractedFact: candidate.extractedFact,
    aiInterpretation: candidate.aiInterpretation,
    signalDate: candidate.detectedDate,
    confidence: candidate.confidence,
    relevance: candidate.relevance,
    operionImplication: candidate.operionImplication,
    sourceId: source.id,
    reviewStatus: "NEW",
    verificationStatus: "AI_INFERENCE",
    origin: "AI_ENRICHED",
  });
}

export async function extractSourceIntelligenceProposals({ source, company = null, provider }) {
  if (!source) throw badRequest("A stored source is required for extraction");
  if (!provider) throw Object.assign(new Error("Source extraction provider is unavailable"), { status: 503, code: "INTELLIGENCE_PROVIDER_UNAVAILABLE" });
  const response = await provider.generate({
    structured: true,
    temperature: 0.1,
    system: "Return JSON only. Extract only facts explicitly present in the supplied source. Separate facts from interpretation. Do not invent people, companies, dates, quantities, relationships, or events. Every proposal must cite the supplied evidenceSourceId.",
    input: JSON.stringify({
      task: "Propose aviation companies, people, and commercial signals for human review. Empty arrays are valid.",
      allowedSignalTypes: SIGNAL_TYPES,
      requiredShape: {
        companies: [{ name: "string", aviationSegment: "allowed segment", fact: "source fact", confidence: 0, evidenceSourceId: source.id }],
        people: [{ name: "string or null", roleTitle: "string", roleCategory: "string", companyName: "string", fact: "source fact", confidence: 0, evidenceSourceId: source.id }],
        signals: [{ signalType: "allowed type", title: "string", extractedFact: "source fact", aiInterpretation: "uncertain implication", confidence: 0, detectedDate: "YYYY-MM-DD or null", evidenceSourceId: source.id }],
      },
      knownCompany: company ? { id: company.id, name: company.name, aviationSegment: company.aviation_segment } : null,
      source: { id: source.id, title: source.title, publisher: source.publisher, publishedAt: source.published_at, excerpt: source.excerpt, url: source.source_url },
    }),
  });
  const candidate = typeof response?.output === "string" ? JSON.parse(response.output.replace(/^```json\s*/i, "").replace(/\s*```$/, "")) : response?.output;
  const proposalGroups = [["COMPANY", candidate?.companies], ["PERSON", candidate?.people], ["SIGNAL", candidate?.signals]];
  const proposals = [];
  for (const [proposalType, items] of proposalGroups) {
    for (const item of Array.isArray(items) ? items : []) {
      if (item?.evidenceSourceId !== source.id) throw badRequest("AI extraction cited evidence outside the stored source", "UNGROUNDED_SOURCE_EXTRACTION");
      proposals.push({
        sourceId: source.id,
        proposalType,
        proposedData: { ...item, companyId: item.companyId || company?.id || null, origin: "AI_ENRICHED" },
        evidence: [{ sourceId: source.id, fact: required(item.fact || item.extractedFact, "fact", 4000) }],
        confidence: confidence(item.confidence),
      });
    }
  }
  return proposals;
}