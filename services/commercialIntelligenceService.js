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
  return {
    companyId: required(input.companyId, "companyId", 100), name: optional(input.name, 240),
    roleTitle: required(input.roleTitle, "roleTitle", 240),
    roleCategory: choice(input.roleCategory, Object.keys(ROLE_APPROACHES).filter((role) => role !== "DEFAULT").concat(["COO", "HEAD_OF_OPERATIONS", "CONTRACTS_DIRECTOR", "COMMERCIAL_DIRECTOR", "RISK_DIRECTOR", "DIGITAL_TRANSFORMATION_DIRECTOR", "OTHER"]), "roleCategory"),
    linkedinUrl: optional(input.linkedinUrl, 500), email: optional(input.email, 320),
    relevanceReason: optional(input.relevanceReason), decisionScope: optional(input.decisionScope),
    confidence: confidence(input.confidence),
    verificationStatus: choice(input.verificationStatus, ["VERIFIED_FACT", "AI_INFERENCE", "UNVERIFIED_SIGNAL"], "verificationStatus", "UNVERIFIED_SIGNAL"),
    origin: choice(input.origin, ["MANUAL", "EXTERNAL_SOURCE", "AI_ENRICHED"], "origin", "MANUAL"),
  };
}

export function validateSignalInput(input = {}) {
  const signalTypes = ["FLEET_EXPANSION", "FLEET_RENEWAL", "AIRCRAFT_ACQUISITION", "AIRCRAFT_DISPOSAL", "NETWORK_EXPANSION", "MRO_EXPANSION", "SUPPLIER_RELATIONSHIP", "OUTSOURCING", "AIRPORT_OPERATION", "CONTRACT_ANNOUNCEMENT", "LEADERSHIP_CHANGE", "REGULATORY_DEVELOPMENT", "RESTRUCTURING", "FINANCING_ACTIVITY", "GEOGRAPHIC_EXPANSION", "OPERATIONAL_DISRUPTION", "PROCUREMENT_ACTIVITY", "OTHER"];
  return {
    companyId: required(input.companyId, "companyId", 100), signalType: choice(input.signalType, signalTypes, "signalType"),
    description: required(input.description, "description", 4000), signalDate: optional(input.signalDate, 20),
    confidence: confidence(input.confidence), relevance: optional(input.relevance),
    operionImplication: optional(input.operionImplication),
    verificationStatus: choice(input.verificationStatus, ["VERIFIED_FACT", "AI_INFERENCE", "UNVERIFIED_SIGNAL"], "verificationStatus", "UNVERIFIED_SIGNAL"),
    origin: choice(input.origin, ["MANUAL", "EXTERNAL_SOURCE", "AI_ENRICHED"], "origin", "MANUAL"),
  };
}

export function validateSourceInput(input = {}) {
  return {
    title: required(input.title, "title", 500), publisher: optional(input.publisher, 240),
    sourceUrl: optional(input.sourceUrl, 1000), publishedAt: optional(input.publishedAt, 50),
    excerpt: optional(input.excerpt, 5000),
    sourceType: choice(input.sourceType, ["COMPANY_WEBSITE", "NEWS", "REGULATORY", "PUBLIC_FILING", "INDUSTRY", "MANUAL_NOTE", "OTHER"], "sourceType"),
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
    ? `${signal.description} This ${String(signal.verification_status || "UNVERIFIED_SIGNAL").toLowerCase().replaceAll("_", " ")} may create additional contract complexity.`
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
    signal: signal ? { description: signal.description, type: signal.signal_type, date: signal.signal_date, verificationStatus: signal.verification_status } : null,
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
  return {
    companyId: required(input.companyId, "companyId", 100), signalId: optional(input.signalId, 100),
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