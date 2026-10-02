import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  assertOpportunityTransition,
  buildEntityMatchProposal,
  buildGroundedOpportunityReasoning,
  classifySourceDuplicate,
  generateGroundedOpportunityReasoning,
  extractSignalFromSource,
  normalizeSourceUrl,
  prioritizeCommercialIntelligence,
  sourceFingerprint,
  validateCompanyInput,
  validateOpportunityInput,
  validatePersonInput,
  validateSignalInput,
  validateSourceInput,
  validateSourceReviewInput,
  validateRecommendedActionInput,
} from "../services/commercialIntelligenceService.js";
import { resolveUserIntelligenceContext } from "../services/phase3/intelligence/roleIntelligenceService.js";

const company = {
  id: "company-1",
  name: "Aero Lease",
  aviation_segment: "Aircraft Leasing",
  known_contract_categories: ["aircraft lease portfolio intelligence"],
  updated_at: "2026-09-30T00:00:00.000Z",
};

const signal = {
  id: "signal-1",
  description: "The company announced a fleet expansion.",
  signal_type: "FLEET_EXPANSION",
  signal_date: "2026-09-20",
  verification_status: "VERIFIED_FACT",
};

const verifiedSource = {
  id: "source-1",
  title: "Fleet announcement",
  verification_status: "VERIFIED_FACT",
  excerpt: "The company announced an additional aircraft order.",
};

test("commercial schema is platform owned and inaccessible through authenticated table grants", async () => {
  const migration = `${await fs.readFile(new URL("../supabase/migrations/018_commercial_intelligence_mvp.sql", import.meta.url), "utf8")}\n${await fs.readFile(new URL("../supabase/migrations/020_superadmin_intelligence_core.sql", import.meta.url), "utf8")}\n${await fs.readFile(new URL("../supabase/migrations/021_supervised_source_ingestion.sql", import.meta.url), "utf8")}`;
  for (const table of ["commercial_companies", "commercial_people", "commercial_signals", "commercial_opportunities", "commercial_sources", "commercial_evidence_links", "commercial_recommended_actions", "commercial_ai_proposals", "commercial_entity_match_proposals", "commercial_review_decisions"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(migration, /revoke all[\s\S]+from anon, authenticated/i);
  assert.match(migration, /grant all[\s\S]+to service_role/i);
  assert.doesNotMatch(migration, /organization_id/i);
});

test("manual company, person, signal, opportunity, and source inputs are aviation bounded", () => {
  assert.equal(validateCompanyInput({ name: "Aero Lease Ltd", aviationSegment: "Aircraft Leasing" }).normalizedName, "aero lease");
  assert.equal(validatePersonInput({ companyId: "company-1", roleTitle: "Chief Financial Officer", roleCategory: "CFO" }).verificationStatus, "UNVERIFIED_SIGNAL");
  assert.equal(validateSignalInput({ companyId: "company-1", signalType: "FLEET_EXPANSION", title: "Fleet expansion", description: "Expansion announced" }).origin, "MANUAL");
  assert.equal(validateOpportunityInput({ companyId: "company-1", signalId: "signal-1", title: "Lease intelligence", opportunityType: "CONTRACT_INTELLIGENCE" }).status, "IDENTIFIED");
  assert.equal(validateSourceInput({ title: "Company announcement", sourceType: "COMPANY_WEBSITE" }).verificationStatus, "UNVERIFIED_SIGNAL");
  assert.throws(() => validateCompanyInput({ name: "Generic Co", aviationSegment: "Retail" }), /not supported/);
});

test("source URLs are normalized conservatively while meaningful parameters remain", () => {
  assert.equal(
    normalizeSourceUrl("http://EXAMPLE.com/news/fleet/?utm_source=email&aircraft=A320#details"),
    "https://example.com/news/fleet?aircraft=A320"
  );
  assert.equal(normalizeSourceUrl("https://example.com/a/?b=2&a=1"), "https://example.com/a?a=1&b=2");
  assert.throws(() => normalizeSourceUrl("javascript:alert(1)"), (error) => error.code === "INVALID_SOURCE_URL");
});

test("source duplicate detection distinguishes exact, normalized, and possible duplicates", () => {
  const exact = sourceFingerprint({ sourceUrl: "https://example.com/news" });
  assert.equal(classifySourceDuplicate({ ...exact, title: "Fleet news" }, [{ id: "source-1", original_url_hash: exact.originalUrlHash }]).status, "DUPLICATE");

  const normalized = sourceFingerprint({ sourceUrl: "http://example.com/news/?utm_source=email" });
  const existingNormalized = sourceFingerprint({ sourceUrl: "https://example.com/news" });
  const normalizedMatch = classifySourceDuplicate({ ...normalized, title: "Fleet news" }, [{ id: "source-2", normalized_url_hash: existingNormalized.normalizedUrlHash }]);
  assert.equal(normalizedMatch.status, "DUPLICATE");
  assert.match(normalizedMatch.reason, /Normalized/);

  const content = sourceFingerprint({ sourceUrl: "https://wire.example/item", excerpt: "The airline ordered twenty aircraft." });
  const possible = classifySourceDuplicate({ ...content, title: "Airline aircraft order" }, [{ id: "source-3", content_hash: content.contentHash }]);
  assert.equal(possible.status, "POSSIBLE_DUPLICATE");
  assert.equal(possible.duplicateOfSourceId, "source-3");
});

test("source quality metadata and review edits are explicit", () => {
  const source = validateSourceInput({
    title: "Regulatory filing", sourceType: "REGULATORY", publisher: "CAA",
    sourceUrl: "https://caa.example/filing", publishedAt: "2026-10-01",
    excerpt: "The filing records the operator certificate.",
  });
  assert.equal(source.domain, "caa.example");
  assert.equal(source.qualityConfidence, 1);
  assert.throws(() => validateSourceReviewInput({ decision: "EDIT" }), (error) => error.code === "REVIEW_CHANGES_REQUIRED");
  assert.deepEqual(validateSourceReviewInput({ decision: "EDIT", changes: { publisher: "CAA Ireland" } }).changes, { publisher: "CAA Ireland" });
});

test("entity resolution proposes evidence-aware matches without merging candidates", () => {
  const proposal = buildEntityMatchProposal({
    entityType: "COMPANY", sourceId: "source-1",
    proposedEntity: { name: "Aero Lease", website: "https://aero.example", country: "Ireland" },
    candidates: [{ id: "company-1", name: "Aero Lease Ltd", normalized_name: "aero lease", website: "https://aero.example", country: "Ireland" }],
  });
  assert.equal(proposal.candidateEntityId, "company-1");
  assert.equal(proposal.confidence, 1);
  assert.deepEqual(proposal.matchEvidence.map((item) => item.field), ["name", "website", "country"]);
  assert.equal(proposal.status, "NEW");
});

test("opportunity reasoning preserves evidence and explains priority factors", () => {
  const person = { name: "Taylor Example", role_title: "Chief Financial Officer", role_category: "CFO", verification_status: "VERIFIED_FACT" };
  const reasoning = buildGroundedOpportunityReasoning({ company, signal, person, sources: [verifiedSource] });

  assert.match(reasoning.whyCompany, /linked sources support/);
  assert.match(reasoning.whyNow, /fleet expansion/i);
  assert.match(reasoning.whyOperion, /financial exposure/i);
  assert.equal(reasoning.evidenceSourceIds[0], verifiedSource.id);
  assert.ok(reasoning.priorityReasons.includes("1 verified source"));
  assert.ok(reasoning.primaryNextAction);
  assert.doesNotMatch(reasoning.suggestedOutreach.linkedin, /revenue|guaranteed|met before/i);
});

test("missing evidence produces uncertainty instead of a fabricated trigger", () => {
  const reasoning = buildGroundedOpportunityReasoning({ company, signal, sources: [] });
  assert.match(reasoning.whyCompany, /requires external source validation/i);
  assert.match(reasoning.whyNow, /No source-backed timing trigger/i);
  assert.match(reasoning.primaryNextAction, /Validate a current company signal/i);
  assert.notEqual(reasoning.priority, "HIGH");
});

test("recommended approach changes for CFO and Legal contacts", () => {
  const cfo = buildGroundedOpportunityReasoning({ company, sources: [verifiedSource], person: { role_title: "CFO", role_category: "CFO" } });
  const legal = buildGroundedOpportunityReasoning({ company, sources: [verifiedSource], person: { role_title: "General Counsel", role_category: "GENERAL_COUNSEL" } });
  assert.match(cfo.recommendedApproach.keyProblem, /financial exposure/);
  assert.match(legal.recommendedApproach.keyProblem, /notice periods/);
  assert.notEqual(cfo.suggestedOutreach.linkedin, legal.suggestedOutreach.linkedin);
});

test("commercial prioritization reuses the centralized RBI profile", () => {
  const commercial = resolveUserIntelligenceContext({ platformRoles: ["SUPERADMIN"], rbiProfileId: "COMMERCIAL" });
  const product = resolveUserIntelligenceContext({ platformRoles: ["SUPERADMIN"], rbiProfileId: "PRODUCT" });
  const opportunities = [
    { id: "commercial", title: "Supplier renewal opportunity", description: "Commercial pricing negotiation", updated_at: "2026-09-01" },
    { id: "product", title: "Contract workflow pain", description: "Repeated operational workflow complexity", updated_at: "2026-09-01" },
  ];
  const commercialOrder = prioritizeCommercialIntelligence({ context: commercial, opportunities }).opportunities;
  const productOrder = prioritizeCommercialIntelligence({ context: product, opportunities }).opportunities;
  assert.equal(commercialOrder[0].rbi.profileId, "COMMERCIAL");
  assert.equal(productOrder[0].rbi.profileId, "PRODUCT");
  assert.deepEqual(new Set(commercialOrder.map(({ id }) => id)), new Set(productOrder.map(({ id }) => id)));
});

test("opportunity lifecycle allows only explicit forward transitions", () => {
  assert.equal(assertOpportunityTransition("IDENTIFIED", "QUALIFYING"), "QUALIFYING");
  assert.equal(assertOpportunityTransition("DISQUALIFIED", "QUALIFYING"), "QUALIFYING");
  assert.throws(() => assertOpportunityTransition("IDENTIFIED", "CUSTOMER"), (error) => error.code === "INVALID_OPPORTUNITY_STATUS_TRANSITION");
});

test("customer API modules do not import or query internal commercial records", async () => {
  const customerModules = await Promise.all([
    "routes/contractRoutes.js", "routes/analysisRunRoutes.js", "routes/foundationRoutes.js",
  ].map((file) => fs.readFile(new URL(`../${file}`, import.meta.url), "utf8")));
  for (const source of customerModules) {
    assert.doesNotMatch(source, /commercialIntelligenceRepository|commercial_(companies|people|signals|opportunities)/);
  }
});

test("AI reasoning is accepted only when every citation references stored evidence", async () => {
  const validProvider = { generate: async () => ({ output: JSON.stringify({
    whyCompany: "The stored company profile and announcement support further qualification.",
    whyNow: "The cited expansion announcement provides a current trigger.",
    whyOperion: "Operion can test the stated aircraft lease use case.",
    potentialContractUseCase: "Aircraft lease portfolio intelligence",
    evidenceSourceIds: ["source-1"],
  }) }) };
  const grounded = await generateGroundedOpportunityReasoning({ company, signal, sources: [verifiedSource], provider: validProvider });
  assert.equal(grounded.reasoningMethod, "AI_GROUNDED");
  assert.deepEqual(grounded.evidenceSourceIds, ["source-1"]);

  const inventedCitationProvider = { generate: async () => ({ output: JSON.stringify({
    whyCompany: "Unsupported", whyNow: "Unsupported", whyOperion: "Unsupported",
    potentialContractUseCase: "Unsupported", evidenceSourceIds: ["invented-source"],
  }) }) };
  const fallback = await generateGroundedOpportunityReasoning({ company, signal, sources: [verifiedSource], provider: inventedCitationProvider });
  assert.equal(fallback.reasoningMethod, "DETERMINISTIC");
  assert.doesNotMatch(fallback.whyCompany, /Unsupported/);
});

test("verified people, verified signals, opportunities, and actions require evidence", () => {
  assert.throws(() => validatePersonInput({ companyId: "company-1", roleTitle: "Fleet Director", roleCategory: "FLEET_DIRECTOR", verificationStatus: "VERIFIED_FACT" }), (error) => error.code === "VERIFIED_PERSON_SOURCE_REQUIRED");
  assert.throws(() => validateSignalInput({ companyId: "company-1", signalType: "FLEET_EXPANSION", title: "Fleet expansion", description: "Expansion announced", verificationStatus: "VERIFIED_FACT" }), (error) => error.code === "VERIFIED_SIGNAL_SOURCE_REQUIRED");
  assert.throws(() => validateOpportunityInput({ companyId: "company-1", title: "Lease intelligence", opportunityType: "CONTRACT_INTELLIGENCE" }), (error) => error.code === "OPPORTUNITY_EVIDENCE_REQUIRED");
  assert.throws(() => validateRecommendedActionInput({ opportunityId: "opportunity-1", actionType: "CONTACT_PERSON", actionText: "Contact procurement", reason: "Fleet expansion" }), /evidenceSourceId is required/);
  assert.equal(validateRecommendedActionInput({ opportunityId: "opportunity-1", actionType: "CONTACT_PERSON", actionText: "Contact procurement", reason: "Fleet expansion", evidenceSourceId: "source-1" }).status, "NEW");
});

test("AI signal extraction separates sourced fact from interpretation and requires the stored citation", async () => {
  const provider = { generate: async () => ({ output: JSON.stringify({
    signalType: "AIRCRAFT_ACQUISITION", title: "Twenty-aircraft order",
    extractedFact: "The airline announced an order for 20 aircraft.",
    aiInterpretation: "This may increase leasing, maintenance, and supplier contract activity.",
    relevance: "Fleet growth can increase contract volume.",
    operionImplication: "Investigate contract-management complexity.",
    confidence: 0.85, detectedDate: "2026-09-20", evidenceSourceId: "source-1",
  }) }) };
  const extracted = await extractSignalFromSource({ company, source: verifiedSource, provider });
  assert.equal(extracted.extractedFact, "The airline announced an order for 20 aircraft.");
  assert.match(extracted.aiInterpretation, /may increase/);
  assert.equal(extracted.sourceId, "source-1");
  assert.equal(extracted.origin, "AI_ENRICHED");
  assert.equal(extracted.reviewStatus, "NEW");

  const ungrounded = { generate: async () => ({ output: JSON.stringify({ ...extracted, evidenceSourceId: "invented-source" }) }) };
  await assert.rejects(() => extractSignalFromSource({ company, source: verifiedSource, provider: ungrounded }), (error) => error.code === "UNGROUNDED_SIGNAL_EXTRACTION");
});