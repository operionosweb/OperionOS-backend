import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

import { createCommercialIntelligenceRouter } from "../routes/commercialIntelligenceRoutes.js";

async function withServer(app, callback) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function appWith(repository, authorizeWrite = (_req, _res, next) => next(), reasoningProvider = null) {
  const authenticate = (req, _res, next) => {
    req.user = { id: "internal-user", rbiProfileId: "COMMERCIAL" };
    next();
  };
  const authorizeRead = (req, _res, next) => {
    req.auth = { roles: ["SUPERADMIN"], permissions: ["commercial_intelligence:read", "commercial_intelligence:write"] };
    next();
  };
  return express().use(express.json()).use("/api/intelligence", createCommercialIntelligenceRouter({
    authenticate, authorizeRead, authorizeWrite, repository, reasoningProvider,
  }));
}

function memoryRepository() {
  const records = { companies: [], people: [], signals: [], opportunities: [], sources: [], links: [], actions: [], proposals: [], matches: [], decisions: [] };
  return {
    records,
    listCompanies: async () => records.companies,
    getCompany: async (id) => records.companies.find((item) => item.id === id) || null,
    createCompany: async (input) => { const item = { id: "company-1", ...input, aviation_segment: input.aviationSegment }; records.companies.push(item); return item; },
    listPeople: async (companyId) => records.people.filter((item) => !companyId || item.company_id === companyId),
    getPerson: async (id) => records.people.find((item) => item.id === id) || null,
    createPerson: async (input) => { const item = { id: "person-1", company_id: input.companyId, ...input }; records.people.push(item); return item; },
    listSignals: async (companyId) => records.signals.filter((item) => !companyId || item.company_id === companyId),
    getSignal: async (id) => records.signals.find((item) => item.id === id) || null,
    createSignal: async (input) => { const item = { id: "signal-1", company_id: input.companyId, ...input }; records.signals.push(item); return item; },
    updateSignalReviewStatus: async (id, status) => Object.assign(records.signals.find((item) => item.id === id), { review_status: status }),
    listOpportunities: async () => records.opportunities,
    getOpportunity: async (id) => records.opportunities.find((item) => item.id === id) || null,
    createOpportunity: async (input) => { const item = { id: "opportunity-1", company_id: input.companyId, ...input }; records.opportunities.push(item); return item; },
    updateOpportunity: async (id, input) => Object.assign(records.opportunities.find((item) => item.id === id), input),
    createSource: async (input) => { const item = {
      id: `source-${records.sources.length + 1}`, ...input,
      source_url: input.sourceUrl, normalized_url: input.normalizedUrl, domain: input.domain,
      original_url_hash: input.originalUrlHash, normalized_url_hash: input.normalizedUrlHash,
      content_hash: input.contentHash, duplicate_status: input.duplicateStatus,
      duplicate_of_source_id: input.duplicateOfSourceId, duplicate_reason: input.duplicateReason,
      review_status: "NEW", extraction_status: "NOT_REQUESTED",
    }; records.sources.push(item); return item; },
    getSource: async (id) => records.sources.find((item) => item.id === id) || null,
    findSourceDuplicateCandidates: async (input) => records.sources.filter((item) => (input.originalUrlHash && item.original_url_hash === input.originalUrlHash)
      || (input.normalizedUrlHash && item.normalized_url_hash === input.normalizedUrlHash)
      || (input.contentHash && item.content_hash === input.contentHash)
      || (input.domain && item.domain === input.domain)),
    listSourceReviewQueue: async (status) => records.sources.filter((item) => !status || item.review_status === status),
    updateSourceExtractionStatus: async (id, status) => Object.assign(records.sources.find((item) => item.id === id), { extraction_status: status }),
    reviewSource: async (id, input) => {
      const item = records.sources.find((source) => source.id === id);
      records.decisions.push({ subject_type: "SOURCE", subject_id: id, previous_status: item.review_status, new_status: input.reviewStatus, decision: input.decision, reason: input.reason });
      return Object.assign(item, { review_status: input.reviewStatus });
    },
    createAiProposal: async (input) => { const item = { id: `proposal-${records.proposals.length + 1}`, source_id: input.sourceId, proposal_type: input.proposalType, proposed_data: input.proposedData, evidence: input.evidence, confidence: input.confidence, status: "NEW" }; records.proposals.push(item); return item; },
    getAiProposal: async (id) => records.proposals.find((item) => item.id === id) || null,
    listAiProposals: async (status) => records.proposals.filter((item) => !status || item.status === status),
    reviewAiProposal: async (id, input, promotedEntityId) => {
      const item = records.proposals.find((proposal) => proposal.id === id);
      records.decisions.push({ subject_type: "AI_PROPOSAL", subject_id: id, previous_status: item.status, new_status: input.status, decision: input.decision });
      return Object.assign(item, { status: input.status, promoted_entity_id: promotedEntityId });
    },
    createEntityMatchProposal: async (input) => { const item = { id: `match-${records.matches.length + 1}`, source_id: input.sourceId, entity_type: input.entityType, candidate_entity_id: input.candidateEntityId, proposed_entity: input.proposedEntity, match_evidence: input.matchEvidence, confidence: input.confidence, status: input.status }; records.matches.push(item); return item; },
    getEntityMatchProposal: async (id) => records.matches.find((item) => item.id === id) || null,
    listEntityMatchProposals: async (status) => records.matches.filter((item) => !status || item.status === status),
    reviewEntityMatchProposal: async (id, input) => {
      const item = records.matches.find((match) => match.id === id);
      records.decisions.push({ subject_type: "ENTITY_MATCH", subject_id: id, previous_status: item.status, new_status: input.status, decision: input.decision });
      return Object.assign(item, { status: input.status });
    },
    listReviewDecisions: async (subjectType, subjectId) => records.decisions.filter((item) => item.subject_type === subjectType && item.subject_id === subjectId),
    linkSource: async (input) => { records.links.push(input); return input; },
    listSources: async (entityType, entityId) => records.links.filter((link) => link.entityType === entityType && link.entityId === entityId).map(() => records.sources[0]),
    listRecommendedActions: async (opportunityId) => records.actions.filter((item) => !opportunityId || item.opportunity_id === opportunityId),
    getRecommendedAction: async (id) => records.actions.find((item) => item.id === id) || null,
    createRecommendedAction: async (input) => {
      const item = { id: `action-${records.actions.length + 1}`, opportunity_id: input.opportunityId, evidence_source_id: input.evidenceSourceId, action_text: input.actionText, reason: input.reason, status: input.status, ...input };
      records.actions.push(item);
      return item;
    },
    updateRecommendedAction: async (id, status) => Object.assign(records.actions.find((item) => item.id === id), { status }),
  };
}

async function post(baseUrl, path, body) {
  return fetch(`${baseUrl}/api/intelligence${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function patch(baseUrl, path, body) {
  return fetch(`${baseUrl}/api/intelligence${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("SUPERADMIN can manually create company, person, signal, opportunity, and source association", async () => {
  const repository = memoryRepository();
  await withServer(appWith(repository), async (baseUrl) => {
    assert.equal((await post(baseUrl, "/companies", { name: "Aero Lease", aviationSegment: "Aircraft Leasing" })).status, 201);
    assert.equal((await post(baseUrl, "/people", { companyId: "company-1", roleTitle: "Chief Financial Officer", roleCategory: "CFO" })).status, 201);
    assert.equal((await post(baseUrl, "/signals", { companyId: "company-1", signalType: "FLEET_EXPANSION", title: "Fleet expansion", description: "Expansion announcement" })).status, 201);
    assert.equal((await post(baseUrl, "/opportunities", { companyId: "company-1", signalId: "signal-1", keyPersonId: "person-1", title: "Lease intelligence", opportunityType: "CONTRACT_INTELLIGENCE" })).status, 201);
    assert.equal((await post(baseUrl, "/sources", { title: "Company announcement", sourceType: "COMPANY_WEBSITE", verificationStatus: "VERIFIED_FACT" })).status, 201);
    assert.equal((await post(baseUrl, "/sources/source-1/link", { entityType: "SIGNAL", entityId: "signal-1", claim: "Expansion announcement" })).status, 201);

    assert.equal(repository.records.companies.length, 1);
    assert.equal(repository.records.people.length, 1);
    assert.equal(repository.records.signals.length, 1);
    assert.equal(repository.records.opportunities.length, 1);
    assert.equal(repository.records.links[0].entityType, "SIGNAL");
  });
});

test("commercial writes require the platform write permission middleware", async () => {
  const repository = memoryRepository();
  const denyWrite = (_req, res) => res.status(403).json({ success: false, error: "Insufficient platform permissions" });
  await withServer(appWith(repository, denyWrite), async (baseUrl) => {
    const response = await post(baseUrl, "/companies", { name: "Aero Lease", aviationSegment: "Aircraft Leasing" });
    assert.equal(response.status, 403);
    assert.equal(repository.records.companies.length, 0);
  });
});

test("grounded reasoning endpoint retains source references and produces one primary action", async () => {
  const repository = memoryRepository();
  repository.records.companies.push({ id: "company-1", name: "Aero Lease", aviation_segment: "Aircraft Leasing", known_contract_categories: ["aircraft leases"] });
  repository.records.people.push({ id: "person-1", company_id: "company-1", role_title: "Chief Financial Officer", role_category: "CFO", verification_status: "VERIFIED_FACT" });
  repository.records.signals.push({ id: "signal-1", company_id: "company-1", description: "Expansion announcement", verification_status: "VERIFIED_FACT" });
  repository.records.opportunities.push({ id: "opportunity-1", company_id: "company-1", signal_id: "signal-1", key_person_id: "person-1", status: "IDENTIFIED" });
  repository.records.sources.push({ id: "source-1", verification_status: "VERIFIED_FACT", excerpt: "Expansion announcement" });
  repository.records.links.push({ entityType: "SIGNAL", entityId: "signal-1" });

  await withServer(appWith(repository), async (baseUrl) => {
    const response = await post(baseUrl, "/opportunities/opportunity-1/reason", {});
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.reasoning.evidenceSourceIds, ["source-1"]);
    assert.ok(body.reasoning.primaryNextAction);
    assert.equal(body.reasoning.rbiContext.profileId, "COMMERCIAL");
    assert.equal(body.action.evidenceSourceId, "source-1");
    assert.equal(body.action.reason, body.reasoning.whyNow);
    assert.equal(repository.records.actions.length, 1);
    assert.equal(repository.records.links.at(-1).entityType, "ACTION");
  });
});

test("a person cannot be presented as verified without a stored source", async () => {
  const repository = memoryRepository();
  repository.records.companies.push({ id: "company-1" });
  await withServer(appWith(repository), async (baseUrl) => {
    const rejected = await post(baseUrl, "/people", {
      companyId: "company-1", name: "Verified Person", roleTitle: "Fleet Director",
      roleCategory: "FLEET_DIRECTOR", verificationStatus: "VERIFIED_FACT",
    });
    assert.equal(rejected.status, 400);
    assert.equal(repository.records.people.length, 0);

    repository.records.sources.push({ id: "source-1", verification_status: "VERIFIED_FACT" });
    const accepted = await post(baseUrl, "/people", {
      companyId: "company-1", name: "Verified Person", roleTitle: "Fleet Director",
      roleCategory: "FLEET_DIRECTOR", verificationStatus: "VERIFIED_FACT",
      verificationSourceId: "source-1",
    });
    assert.equal(accepted.status, 201);
    assert.equal(repository.records.links[0].entityType, "PERSON");
  });
});

test("structured signals retain fact, interpretation, and source evidence", async () => {
  const repository = memoryRepository();
  repository.records.companies.push({ id: "company-1" });
  repository.records.sources.push({ id: "source-1", verification_status: "VERIFIED_FACT" });
  await withServer(appWith(repository), async (baseUrl) => {
    const response = await post(baseUrl, "/signals", {
      companyId: "company-1", signalType: "AIRCRAFT_ACQUISITION", title: "Aircraft order",
      description: "The airline announced an order for 20 aircraft.",
      extractedFact: "The airline announced an order for 20 aircraft.",
      aiInterpretation: "This may increase leasing, MRO, and supplier contract activity.",
      sourceId: "source-1", verificationStatus: "VERIFIED_FACT",
    });
    assert.equal(response.status, 201);
    assert.equal(repository.records.signals[0].extractedFact, "The airline announced an order for 20 aircraft.");
    assert.match(repository.records.signals[0].aiInterpretation, /may increase/);
    assert.equal(repository.records.links[0].sourceId, "source-1");
  });
});

test("opportunities cannot link a person or signal from another company", async () => {
  const repository = memoryRepository();
  repository.records.companies.push({ id: "company-1" }, { id: "company-2" });
  repository.records.people.push({ id: "person-2", company_id: "company-2" });
  await withServer(appWith(repository), async (baseUrl) => {
    const response = await post(baseUrl, "/opportunities", {
      companyId: "company-1", keyPersonId: "person-2", title: "Invalid link",
      opportunityType: "CONTRACT_INTELLIGENCE",
    });
    assert.equal(response.status, 400);
    assert.equal(repository.records.opportunities.length, 0);
  });
});

test("recommended actions retain reasoning and evidence through their status lifecycle", async () => {
  const repository = memoryRepository();
  repository.records.companies.push({ id: "company-1" });
  repository.records.opportunities.push({ id: "opportunity-1", company_id: "company-1" });
  repository.records.sources.push({ id: "source-1", verification_status: "VERIFIED_FACT" });
  await withServer(appWith(repository), async (baseUrl) => {
    const created = await post(baseUrl, "/actions", {
      opportunityId: "opportunity-1", actionType: "INVESTIGATE_CONTRACT_EXPOSURE",
      actionText: "Investigate supplier contract exposure",
      reason: "The verified fleet expansion may increase supplier complexity.",
      evidenceSourceId: "source-1", confidence: 0.8,
    });
    assert.equal(created.status, 201);
    const action = (await created.json()).action;
    assert.equal(action.evidenceSourceId, "source-1");
    assert.equal(repository.records.links[0].entityType, "ACTION");

    const updated = await patch(baseUrl, `/actions/${action.id}`, { status: "ACTIONED" });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).action.status, "ACTIONED");
  });
});

test("dashboard exposes recent people and intelligence requiring review", async () => {
  const repository = memoryRepository();
  repository.records.companies.push({ id: "company-1", name: "Aero Lease", intelligence_status: "RESEARCHING" });
  repository.records.people.push({ id: "person-1", company_id: "company-1", name: "Verified Person", role_title: "Fleet Director" });
  repository.records.signals.push({ id: "signal-1", company_id: "company-1", title: "Fleet expansion", review_status: "NEW" });
  repository.records.opportunities.push({ id: "opportunity-1", company_id: "company-1", title: "Lease intelligence", status: "IDENTIFIED" });
  repository.records.actions.push({ id: "action-1", opportunity_id: "opportunity-1", action_text: "Review fleet contracts", status: "NEW" });
  await withServer(appWith(repository), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/intelligence/dashboard`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.recentPeople[0].id, "person-1");
    assert.deepEqual(new Set(body.reviewQueue.map((item) => item.kind)), new Set(["SIGNAL", "ACTION"]));

    const reviewed = await patch(baseUrl, "/signals/signal-1", { status: "REVIEWED" });
    assert.equal(reviewed.status, 200);
    assert.equal((await reviewed.json()).signal.review_status, "REVIEWED");
  });
});

test("AI extraction creates a reviewable proposal and promotes it only after approval", async () => {
  const repository = memoryRepository();
  repository.records.companies.push({ id: "company-1", name: "Aero Lease", aviation_segment: "Aircraft Leasing" });
  repository.records.sources.push({ id: "source-1", title: "Fleet announcement", excerpt: "The airline ordered 20 aircraft." });
  const provider = { generate: async () => ({ output: JSON.stringify({
    signalType: "AIRCRAFT_ACQUISITION", title: "Twenty-aircraft order",
    extractedFact: "The airline ordered 20 aircraft.",
    aiInterpretation: "This may increase aviation contract activity.",
    relevance: "Fleet expansion can add contract volume.",
    operionImplication: "Investigate leasing and supplier agreements.",
    confidence: 0.85, detectedDate: null, evidenceSourceId: "source-1",
  }) }) };
  await withServer(appWith(repository, (_req, _res, next) => next(), provider), async (baseUrl) => {
    const response = await post(baseUrl, "/signals/extract", { companyId: "company-1", sourceId: "source-1" });
    assert.equal(response.status, 201);
    const proposal = (await response.json()).proposal;
    assert.equal(repository.records.signals.length, 0);
    assert.equal(proposal.status, "NEW");
    assert.equal(proposal.proposed_data.extractedFact, "The airline ordered 20 aircraft.");

    const edited = await patch(baseUrl, `/proposals/${proposal.id}`, { decision: "EDIT", changes: { title: "Reviewed aircraft order" } });
    assert.equal(edited.status, 200);
    assert.equal((await edited.json()).proposal.status, "EDITED");

    const approved = await patch(baseUrl, `/proposals/${proposal.id}`, { decision: "APPROVE" });
    assert.equal(approved.status, 200);
    assert.equal(repository.records.signals[0].reviewStatus, "NEW");
    assert.equal(repository.records.links[0].sourceId, "source-1");
    assert.equal(repository.records.decisions.length, 2);
    assert.equal(repository.records.decisions[0].subject_type, "AI_PROPOSAL");
  });
});

test("source ingestion preserves the original URL and reports normalized duplicates", async () => {
  const repository = memoryRepository();
  await withServer(appWith(repository), async (baseUrl) => {
    const first = await post(baseUrl, "/sources", {
      title: "Fleet announcement", sourceType: "NEWS",
      sourceUrl: "https://EXAMPLE.com/news/fleet?aircraft=A320",
      excerpt: "The airline announced a fleet expansion.",
    });
    assert.equal(first.status, 201);
    const firstSource = (await first.json()).source;
    assert.equal(firstSource.source_url, "https://EXAMPLE.com/news/fleet?aircraft=A320");
    assert.equal(firstSource.normalized_url, "https://example.com/news/fleet?aircraft=A320");
    assert.equal(firstSource.duplicate_status, "UNIQUE");

    const duplicate = await post(baseUrl, "/sources", {
      title: "Fleet announcement", sourceType: "NEWS",
      sourceUrl: "http://example.com/news/fleet/?utm_source=email&aircraft=A320#section",
      excerpt: "A different excerpt prevents content matching from deciding the result.",
    });
    assert.equal(duplicate.status, 201);
    const duplicateSource = (await duplicate.json()).source;
    assert.equal(duplicateSource.duplicate_status, "DUPLICATE");
    assert.equal(duplicateSource.duplicate_of_source_id, firstSource.id);
    assert.match(duplicateSource.duplicate_reason, /Normalized source URL/);
  });
});

test("matching content is retained as a possible duplicate without automatic merging", async () => {
  const repository = memoryRepository();
  await withServer(appWith(repository), async (baseUrl) => {
    await post(baseUrl, "/sources", { title: "Original report", sourceType: "INDUSTRY", sourceUrl: "https://one.example/report", excerpt: "Twenty aircraft were ordered." });
    const response = await post(baseUrl, "/sources", { title: "Syndicated report", sourceType: "NEWS", sourceUrl: "https://two.example/story", excerpt: "Twenty aircraft were ordered." });
    const source = (await response.json()).source;
    assert.equal(source.duplicate_status, "POSSIBLE_DUPLICATE");
    assert.equal(repository.records.sources.length, 2);
    assert.match(source.duplicate_reason, /content matches/);
  });
});

test("source review decisions update state and remain available in audit history", async () => {
  const repository = memoryRepository();
  repository.records.sources.push({ id: "source-1", title: "Regulatory filing", review_status: "NEW" });
  await withServer(appWith(repository), async (baseUrl) => {
    const reviewed = await patch(baseUrl, "/sources/source-1/review", { decision: "VERIFY", reason: "Publisher and filing date confirmed" });
    assert.equal(reviewed.status, 200);
    assert.equal((await reviewed.json()).source.review_status, "VERIFIED");

    const audit = await fetch(`${baseUrl}/api/intelligence/audit/SOURCE/source-1`);
    assert.equal(audit.status, 200);
    const decisions = (await audit.json()).decisions;
    assert.equal(decisions[0].previous_status, "NEW");
    assert.equal(decisions[0].decision, "VERIFY");
  });
});

test("multi-entity AI extraction stores grounded proposals and rejects foreign citations", async () => {
  const repository = memoryRepository();
  repository.records.sources.push({ id: "source-1", title: "Company update", excerpt: "Aero Lease appointed a Fleet Director and ordered aircraft." });
  const groundedProvider = { generate: async () => ({ output: JSON.stringify({
    companies: [{ name: "Aero Lease", aviationSegment: "Aircraft Leasing", fact: "Aero Lease published the update.", confidence: 0.9, evidenceSourceId: "source-1" }],
    people: [{ name: "Taylor Example", roleTitle: "Fleet Director", roleCategory: "FLEET_DIRECTOR", companyName: "Aero Lease", fact: "Taylor Example was appointed Fleet Director.", confidence: 0.8, evidenceSourceId: "source-1" }],
    signals: [{ signalType: "AIRCRAFT_ACQUISITION", title: "Aircraft order", extractedFact: "Aero Lease ordered aircraft.", aiInterpretation: "This may increase contract activity.", confidence: 0.8, detectedDate: null, evidenceSourceId: "source-1" }],
  }) }) };
  await withServer(appWith(repository, (_req, _res, next) => next(), groundedProvider), async (baseUrl) => {
    const response = await post(baseUrl, "/sources/source-1/extract", {});
    assert.equal(response.status, 201);
    assert.deepEqual((await response.json()).proposals.map((item) => item.proposal_type), ["COMPANY", "PERSON", "SIGNAL"]);
    assert.equal(repository.records.signals.length, 0);
    assert.equal(repository.records.sources[0].extraction_status, "SUCCEEDED");
  });

  const ungroundedRepository = memoryRepository();
  ungroundedRepository.records.sources.push({ id: "source-1", title: "Company update", excerpt: "Aero Lease ordered aircraft." });
  const ungroundedProvider = { generate: async () => ({ output: JSON.stringify({ companies: [], people: [], signals: [{ signalType: "OTHER", title: "Claim", extractedFact: "Claim", confidence: 0.5, evidenceSourceId: "source-elsewhere" }] }) }) };
  await withServer(appWith(ungroundedRepository, (_req, _res, next) => next(), ungroundedProvider), async (baseUrl) => {
    const response = await post(baseUrl, "/sources/source-1/extract", {});
    assert.equal(response.status, 400);
    assert.equal(ungroundedRepository.records.proposals.length, 0);
    assert.equal(ungroundedRepository.records.sources[0].extraction_status, "FAILED");
  });
});

test("entity matching records evidence and approval links the candidate without merging", async () => {
  const repository = memoryRepository();
  repository.records.sources.push({ id: "source-1", title: "Company profile" });
  repository.records.companies.push({ id: "company-1", name: "Aero Lease Ltd", normalized_name: "aero lease", website: "https://aerolease.example", country: "Ireland" });
  await withServer(appWith(repository), async (baseUrl) => {
    const response = await post(baseUrl, "/entity-matches", {
      sourceId: "source-1", entityType: "COMPANY",
      proposedEntity: { name: "Aero Lease", website: "https://www.aerolease.example", country: "Ireland" },
    });
    assert.equal(response.status, 201);
    const match = (await response.json()).match;
    assert.equal(match.candidate_entity_id, "company-1");
    assert.ok(match.match_evidence.some((item) => item.field === "name"));

    const approved = await patch(baseUrl, `/entity-matches/${match.id}`, { decision: "APPROVE", reason: "Name and country confirmed" });
    assert.equal(approved.status, 200);
    assert.equal(repository.records.companies.length, 1);
    assert.equal(repository.records.links[0].entityId, "company-1");
    assert.equal(repository.records.decisions.at(-1).subject_type, "ENTITY_MATCH");
  });
});