import express from "express";

import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import {
  PLATFORM_PERMISSIONS,
  requirePlatformPermission,
} from "../middleware/superAdminMiddleware.js";
import { createCommercialIntelligenceRepository } from "../repositories/commercialIntelligenceRepository.js";
import {
  assertOpportunityTransition,
  buildEntityMatchProposal,
  classifySourceDuplicate,
  extractSignalFromSource,
  extractSourceIntelligenceProposals,
  generateGroundedOpportunityReasoning,
  prioritizeCommercialIntelligence,
  validateCompanyInput,
  validateOpportunityInput,
  validatePersonInput,
  validateRecommendedActionInput,
  validateSignalInput,
  validateSourceInput,
  validateIntelligenceReviewStatus,
  validateProposalReviewInput,
  validateSourceReviewInput,
} from "../services/commercialIntelligenceService.js";
import { resolveUserIntelligenceContext } from "../services/phase3/intelligence/roleIntelligenceService.js";
import { createMistralProvider } from "../services/ai/aiGateway.js";

function commercialError(error) {
  if (error?.code === "23505") return { status: 409, body: { success: false, error: "An equivalent record already exists", code: "COMMERCIAL_RECORD_CONFLICT" } };
  if (error?.code === "23503") return { status: 400, body: { success: false, error: "A referenced commercial intelligence record does not exist", code: "INVALID_COMMERCIAL_REFERENCE" } };
  return {
    status: error?.status || 500,
    body: {
      success: false,
      error: error?.status && error.status < 500 ? error.message : "Commercial Intelligence request failed",
      code: error?.code || "COMMERCIAL_INTELLIGENCE_REQUEST_FAILED",
    },
  };
}

function handle(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      const safe = commercialError(error);
      res.status(safe.status).json(safe.body);
    }
  };
}

function contextFor(req) {
  return resolveUserIntelligenceContext({
    userId: req.user.id,
    platformRoles: req.auth.roles || [],
    permissions: req.auth.permissions || [],
    rbiProfileId: req.user.rbiProfileId,
  });
}

async function sourcesForReasoning(repository, { companyId, signalId, personId, opportunityId = null }) {
  const requests = [repository.listSources("COMPANY", companyId)];
  if (signalId) requests.push(repository.listSources("SIGNAL", signalId));
  if (personId) requests.push(repository.listSources("PERSON", personId));
  if (opportunityId) requests.push(repository.listSources("OPPORTUNITY", opportunityId));
  const groups = await Promise.all(requests);
  return [...new Map(groups.flat().map((source) => [source.id, source])).values()];
}

export function createCommercialIntelligenceRouter({
  authenticate = authenticateUser,
  authorize = null,
  authorizeRead = authorize || requirePlatformPermission(PLATFORM_PERMISSIONS.COMMERCIAL_INTELLIGENCE_READ),
  authorizeWrite = requirePlatformPermission(PLATFORM_PERMISSIONS.COMMERCIAL_INTELLIGENCE_WRITE),
  repository = createCommercialIntelligenceRepository(),
  reasoningProvider = process.env.MISTRAL_API_KEY ? createMistralProvider() : null,
} = {}) {
  const router = express.Router();
  router.use(authenticate, authorizeRead);

  router.get("/access", (req, res) => {
    const context = contextFor(req);
    res.json({
      success: true,
      boundary: "commercial_intelligence",
      available: true,
      intelligenceContext: context,
    });
  });

  router.get("/dashboard", handle(async (req, res) => {
    const [companies, signals, opportunities, people, actions] = await Promise.all([
      repository.listCompanies(), repository.listSignals(), repository.listOpportunities(),
      repository.listPeople(), repository.listRecommendedActions(),
    ]);
    const prioritized = prioritizeCommercialIntelligence({ context: contextFor(req), companies, signals, opportunities });
    res.json({
      success: true,
      profile: contextFor(req).rbiProfile,
      priorityOpportunities: prioritized.opportunities.filter((item) => !["CUSTOMER", "DISQUALIFIED"].includes(item.status)).slice(0, 6),
      newSignals: prioritized.signals.slice(0, 6),
      companiesToReview: prioritized.companies.filter((item) => item.intelligence_status !== "ARCHIVED").slice(0, 6),
      recommendedActions: actions.filter((item) => !["ACTIONED", "DISMISSED"].includes(item.status)).slice(0, 6),
      recentPeople: people.slice(0, 6),
      reviewQueue: [
        ...prioritized.signals.filter((item) => item.review_status === "NEW").map((item) => ({ id: item.id, kind: "SIGNAL", title: item.title, companyId: item.company_id, companyName: item.company_name })),
        ...actions.filter((item) => item.status === "NEW").map((item) => ({ id: item.id, kind: "ACTION", title: item.action_text, companyName: item.company_name, opportunityId: item.opportunity_id })),
      ].slice(0, 8),
      recentlyUpdated: prioritized.opportunities.slice().sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at)).slice(0, 6),
    });
  }));

  router.get("/companies", handle(async (req, res) => {
    const companies = await repository.listCompanies();
    const prioritized = prioritizeCommercialIntelligence({ context: contextFor(req), companies });
    res.json({ success: true, companies: prioritized.companies });
  }));

  router.post("/companies", authorizeWrite, handle(async (req, res) => {
    const company = await repository.createCompany(validateCompanyInput(req.body), req.user.id);
    res.status(201).json({ success: true, company });
  }));

  router.get("/companies/:id", handle(async (req, res) => {
    const company = await repository.getCompany(req.params.id);
    if (!company) throw Object.assign(new Error("Company not found"), { status: 404, code: "COMMERCIAL_COMPANY_NOT_FOUND" });
    const [people, signals, opportunities, sources] = await Promise.all([
      repository.listPeople(company.id), repository.listSignals(company.id), repository.listOpportunities(), repository.listSources("COMPANY", company.id),
    ]);
    const prioritized = prioritizeCommercialIntelligence({ context: contextFor(req), companies: [company], signals, opportunities: opportunities.filter((item) => item.company_id === company.id) });
    res.json({ success: true, company: prioritized.companies[0], people, signals: prioritized.signals, opportunities: prioritized.opportunities, sources });
  }));

  router.get("/people", handle(async (req, res) => {
    res.json({ success: true, people: await repository.listPeople(req.query.companyId || null) });
  }));

  router.post("/people", authorizeWrite, handle(async (req, res) => {
    const input = validatePersonInput(req.body);
    const [company, source] = await Promise.all([
      repository.getCompany(input.companyId),
      input.verificationSourceId ? repository.getSource(input.verificationSourceId) : null,
    ]);
    if (!company) throw Object.assign(new Error("Company not found"), { status: 404, code: "COMMERCIAL_COMPANY_NOT_FOUND" });
    if (input.verificationSourceId && !source) throw Object.assign(new Error("Verification source not found"), { status: 400, code: "INVALID_COMMERCIAL_REFERENCE" });
    const person = await repository.createPerson(input, req.user.id);
    if (input.verificationSourceId) await repository.linkSource({ sourceId: input.verificationSourceId, entityType: "PERSON", entityId: person.id, claim: input.relevanceReason || input.roleTitle, supportType: "SUPPORTS" });
    res.status(201).json({ success: true, person });
  }));

  router.get("/signals", handle(async (req, res) => {
    const signals = await repository.listSignals(req.query.companyId || null);
    res.json({ success: true, signals: prioritizeCommercialIntelligence({ context: contextFor(req), signals }).signals });
  }));

  router.post("/signals", authorizeWrite, handle(async (req, res) => {
    const input = validateSignalInput(req.body);
    const [company, source] = await Promise.all([
      repository.getCompany(input.companyId), input.sourceId ? repository.getSource(input.sourceId) : null,
    ]);
    if (!company) throw Object.assign(new Error("Company not found"), { status: 404, code: "COMMERCIAL_COMPANY_NOT_FOUND" });
    if (input.sourceId && !source) throw Object.assign(new Error("Signal source not found"), { status: 400, code: "INVALID_COMMERCIAL_REFERENCE" });
    const signal = await repository.createSignal(input, req.user.id);
    if (input.sourceId) await repository.linkSource({ sourceId: input.sourceId, entityType: "SIGNAL", entityId: signal.id, claim: input.extractedFact, supportType: "SUPPORTS" });
    res.status(201).json({ success: true, signal });
  }));

  router.post("/signals/extract", authorizeWrite, handle(async (req, res) => {
    const [company, source] = await Promise.all([
      repository.getCompany(req.body.companyId), repository.getSource(req.body.sourceId),
    ]);
    if (!company || !source) throw Object.assign(new Error("Company or source not found"), { status: 400, code: "INVALID_COMMERCIAL_REFERENCE" });
    const input = await extractSignalFromSource({ company, source, provider: reasoningProvider });
    const proposal = await repository.createAiProposal({
      sourceId: source.id, proposalType: "SIGNAL", proposedData: input,
      evidence: [{ sourceId: source.id, fact: input.extractedFact }], confidence: input.confidence,
    }, req.user.id);
    res.status(201).json({ success: true, proposal });
  }));

  router.patch("/signals/:id", authorizeWrite, handle(async (req, res) => {
    const status = validateIntelligenceReviewStatus(req.body.status);
    const signal = await repository.getSignal(req.params.id);
    if (!signal) throw Object.assign(new Error("Signal not found"), { status: 404, code: "COMMERCIAL_SIGNAL_NOT_FOUND" });
    res.json({ success: true, signal: await repository.updateSignalReviewStatus(req.params.id, status) });
  }));

  router.get("/opportunities", handle(async (req, res) => {
    const opportunities = await repository.listOpportunities();
    res.json({ success: true, opportunities: prioritizeCommercialIntelligence({ context: contextFor(req), opportunities }).opportunities });
  }));

  router.post("/opportunities", authorizeWrite, handle(async (req, res) => {
    const input = validateOpportunityInput(req.body);
    const [company, signal, person, source] = await Promise.all([
      repository.getCompany(input.companyId),
      input.signalId ? repository.getSignal(input.signalId) : null,
      input.keyPersonId ? repository.getPerson(input.keyPersonId) : null,
      input.primarySourceId ? repository.getSource(input.primarySourceId) : null,
    ]);
    if (!company) throw Object.assign(new Error("Company not found"), { status: 404, code: "COMMERCIAL_COMPANY_NOT_FOUND" });
    if (input.signalId && (!signal || signal.company_id !== input.companyId)) throw Object.assign(new Error("Signal does not belong to the selected company"), { status: 400, code: "INVALID_COMMERCIAL_REFERENCE" });
    if (input.keyPersonId && (!person || person.company_id !== input.companyId)) throw Object.assign(new Error("Person does not belong to the selected company"), { status: 400, code: "INVALID_COMMERCIAL_REFERENCE" });
    if (input.primarySourceId && !source) throw Object.assign(new Error("Primary source not found"), { status: 400, code: "INVALID_COMMERCIAL_REFERENCE" });
    const opportunity = await repository.createOpportunity(input, req.user.id);
    if (input.primarySourceId) await repository.linkSource({ sourceId: input.primarySourceId, entityType: "OPPORTUNITY", entityId: opportunity.id, claim: input.whyNow || input.title, supportType: "SUPPORTS" });
    res.status(201).json({ success: true, opportunity });
  }));

  router.get("/opportunities/:id", handle(async (req, res) => {
    const opportunity = await repository.getOpportunity(req.params.id);
    if (!opportunity) throw Object.assign(new Error("Opportunity not found"), { status: 404, code: "COMMERCIAL_OPPORTUNITY_NOT_FOUND" });
    const [sources, actions] = await Promise.all([sourcesForReasoning(repository, {
      companyId: opportunity.company_id, signalId: opportunity.signal_id,
      personId: opportunity.key_person_id, opportunityId: opportunity.id,
    }), repository.listRecommendedActions(opportunity.id)]);
    res.json({ success: true, opportunity, sources, actions });
  }));

  router.patch("/opportunities/:id", authorizeWrite, handle(async (req, res) => {
    const existing = await repository.getOpportunity(req.params.id);
    if (!existing) throw Object.assign(new Error("Opportunity not found"), { status: 404, code: "COMMERCIAL_OPPORTUNITY_NOT_FOUND" });
    if (req.body.status) assertOpportunityTransition(existing.status, req.body.status);
    if (req.body.keyPersonId) {
      const person = await repository.getPerson(req.body.keyPersonId);
      if (!person || person.company_id !== existing.company_id) throw Object.assign(new Error("Person does not belong to the selected company"), { status: 400, code: "INVALID_COMMERCIAL_REFERENCE" });
    }
    const opportunity = await repository.updateOpportunity(req.params.id, {
      keyPersonId: req.body.keyPersonId || null, status: req.body.status || null,
      priority: req.body.priority || null, priorityReasons: req.body.priorityReasons || null,
      primaryNextAction: req.body.primaryNextAction || null, secondaryAction: req.body.secondaryAction || null,
      markReviewed: Boolean(req.body.markReviewed),
    });
    res.json({ success: true, opportunity });
  }));

  router.post("/opportunities/:id/reason", authorizeWrite, handle(async (req, res) => {
    const opportunity = await repository.getOpportunity(req.params.id);
    if (!opportunity) throw Object.assign(new Error("Opportunity not found"), { status: 404, code: "COMMERCIAL_OPPORTUNITY_NOT_FOUND" });
    const [company, signal, people, sources] = await Promise.all([
      repository.getCompany(opportunity.company_id),
      opportunity.signal_id ? repository.getSignal(opportunity.signal_id) : null,
      repository.listPeople(opportunity.company_id),
      sourcesForReasoning(repository, { companyId: opportunity.company_id, signalId: opportunity.signal_id, personId: opportunity.key_person_id, opportunityId: opportunity.id }),
    ]);
    const person = people.find((item) => item.id === opportunity.key_person_id) || null;
    const reasoning = await generateGroundedOpportunityReasoning({ company, signal, person, sources, rbiProfile: contextFor(req).rbiProfile, provider: reasoningProvider });
    const updated = await repository.updateOpportunity(opportunity.id, reasoning);
    const evidenceSourceId = reasoning.evidenceSourceIds[0] || null;
    const action = evidenceSourceId ? await repository.createRecommendedAction(validateRecommendedActionInput({
      opportunityId: opportunity.id,
      personId: opportunity.key_person_id,
      evidenceSourceId,
      actionType: person ? "CONTACT_PERSON" : "IDENTIFY_DECISION_MAKER",
      actionText: reasoning.primaryNextAction,
      reason: reasoning.whyNow,
      confidence: sources.find((source) => source.id === evidenceSourceId)?.verification_status === "VERIFIED_FACT" ? 0.8 : 0.5,
      reasoningMethod: reasoning.reasoningMethod,
    }), req.user.id) : null;
    if (action) await repository.linkSource({ sourceId: evidenceSourceId, entityType: "ACTION", entityId: action.id, claim: action.reason, supportType: "SUPPORTS" });
    res.json({ success: true, opportunity: updated, reasoning, sources, action });
  }));

  router.get("/actions", handle(async (req, res) => {
    res.json({ success: true, actions: await repository.listRecommendedActions(req.query.opportunityId || null) });
  }));

  router.post("/actions", authorizeWrite, handle(async (req, res) => {
    const input = validateRecommendedActionInput(req.body);
    const [opportunity, person, source] = await Promise.all([
      repository.getOpportunity(input.opportunityId),
      input.personId ? repository.getPerson(input.personId) : null,
      repository.getSource(input.evidenceSourceId),
    ]);
    if (!opportunity || !source) throw Object.assign(new Error("Opportunity or evidence source not found"), { status: 400, code: "INVALID_COMMERCIAL_REFERENCE" });
    if (input.personId && (!person || person.company_id !== opportunity.company_id)) throw Object.assign(new Error("Person does not belong to the opportunity company"), { status: 400, code: "INVALID_COMMERCIAL_REFERENCE" });
    const action = await repository.createRecommendedAction(input, req.user.id);
    await repository.linkSource({ sourceId: input.evidenceSourceId, entityType: "ACTION", entityId: action.id, claim: input.reason, supportType: "SUPPORTS" });
    res.status(201).json({ success: true, action });
  }));

  router.patch("/actions/:id", authorizeWrite, handle(async (req, res) => {
    const status = validateIntelligenceReviewStatus(req.body.status);
    const existing = await repository.getRecommendedAction(req.params.id);
    if (!existing) throw Object.assign(new Error("Recommended action not found"), { status: 404, code: "COMMERCIAL_ACTION_NOT_FOUND" });
    res.json({ success: true, action: await repository.updateRecommendedAction(req.params.id, status) });
  }));

  router.post("/sources", authorizeWrite, handle(async (req, res) => {
    const input = validateSourceInput(req.body);
    const candidates = await repository.findSourceDuplicateCandidates(input);
    const duplicate = classifySourceDuplicate(input, candidates);
    const source = await repository.createSource({
      ...input,
      duplicateStatus: duplicate.status,
      duplicateOfSourceId: duplicate.duplicateOfSourceId,
      duplicateReason: duplicate.reason,
      duplicateConfidence: duplicate.confidence,
    }, req.user.id);
    res.status(201).json({ success: true, source });
  }));

  router.get("/sources/review", handle(async (req, res) => {
    res.json({ success: true, sources: await repository.listSourceReviewQueue(req.query.status || null) });
  }));

  router.patch("/sources/:id/review", authorizeWrite, handle(async (req, res) => {
    const existing = await repository.getSource(req.params.id);
    if (!existing) throw Object.assign(new Error("Source not found"), { status: 404, code: "COMMERCIAL_SOURCE_NOT_FOUND" });
    const review = validateSourceReviewInput(req.body);
    if (review.decision === "EDIT") {
      const revised = validateSourceInput({
        title: existing.title, publisher: existing.publisher, sourceUrl: existing.source_url,
        canonicalUrl: existing.canonical_url, publishedAt: existing.published_at,
        excerpt: existing.excerpt, sourceType: existing.source_type,
        verificationStatus: existing.verification_status, ...review.changes,
      });
      const candidates = (await repository.findSourceDuplicateCandidates(revised)).filter((candidate) => candidate.id !== existing.id);
      const duplicate = classifySourceDuplicate(revised, candidates);
      review.changes = { ...revised, duplicateStatus: duplicate.status, duplicateOfSourceId: duplicate.duplicateOfSourceId, duplicateReason: duplicate.reason, duplicateConfidence: duplicate.confidence };
    }
    const source = await repository.reviewSource(req.params.id, review, req.user.id);
    res.json({ success: true, source });
  }));

  router.post("/sources/:id/extract", authorizeWrite, handle(async (req, res) => {
    const [source, company] = await Promise.all([
      repository.getSource(req.params.id), req.body.companyId ? repository.getCompany(req.body.companyId) : null,
    ]);
    if (!source || (req.body.companyId && !company)) throw Object.assign(new Error("Source or company not found"), { status: 400, code: "INVALID_COMMERCIAL_REFERENCE" });
    await repository.updateSourceExtractionStatus(source.id, "PENDING");
    try {
      const proposals = await extractSourceIntelligenceProposals({ source, company, provider: reasoningProvider });
      const created = await Promise.all(proposals.map((proposal) => repository.createAiProposal(proposal, req.user.id)));
      await repository.updateSourceExtractionStatus(source.id, "SUCCEEDED");
      res.status(201).json({ success: true, proposals: created });
    } catch (error) {
      await repository.updateSourceExtractionStatus(source.id, "FAILED");
      throw error;
    }
  }));

  router.get("/proposals", handle(async (req, res) => {
    res.json({ success: true, proposals: await repository.listAiProposals(req.query.status || null) });
  }));

  router.patch("/proposals/:id", authorizeWrite, handle(async (req, res) => {
    const proposal = await repository.getAiProposal(req.params.id);
    if (!proposal) throw Object.assign(new Error("AI proposal not found"), { status: 404, code: "COMMERCIAL_PROPOSAL_NOT_FOUND" });
    if (!["NEW", "EDITED", "DEFERRED"].includes(proposal.status)) throw Object.assign(new Error("AI proposal has already been reviewed"), { status: 409, code: "COMMERCIAL_PROPOSAL_ALREADY_REVIEWED" });
    const review = validateProposalReviewInput(req.body);
    let promoted = null;
    if (review.decision === "APPROVE") {
      const data = { ...proposal.proposed_data, ...review.changes };
      if (proposal.proposal_type === "SIGNAL") {
        const input = validateSignalInput({ ...data, sourceId: proposal.source_id, reviewStatus: "NEW", verificationStatus: "AI_INFERENCE" });
        promoted = await repository.createSignal(input, req.user.id);
        await repository.linkSource({ sourceId: proposal.source_id, entityType: "SIGNAL", entityId: promoted.id, claim: input.extractedFact, supportType: "SUPPORTS" });
      } else if (proposal.proposal_type === "COMPANY") {
        promoted = await repository.createCompany(validateCompanyInput(data), req.user.id);
        await repository.linkSource({ sourceId: proposal.source_id, entityType: "COMPANY", entityId: promoted.id, claim: data.fact || data.name, supportType: "SUPPORTS" });
      } else {
        const input = validatePersonInput({ ...data, verificationStatus: "AI_INFERENCE" });
        const company = await repository.getCompany(input.companyId);
        if (!company) throw Object.assign(new Error("Proposal requires a valid company before approval"), { status: 400, code: "PROPOSAL_COMPANY_REQUIRED" });
        promoted = await repository.createPerson(input, req.user.id);
        await repository.linkSource({ sourceId: proposal.source_id, entityType: "PERSON", entityId: promoted.id, claim: data.fact || input.roleTitle, supportType: "SUPPORTS" });
      }
    }
    const reviewed = await repository.reviewAiProposal(proposal.id, review, promoted?.id || null, req.user.id);
    res.json({ success: true, proposal: reviewed, promoted });
  }));

  router.get("/entity-matches", handle(async (req, res) => {
    res.json({ success: true, matches: await repository.listEntityMatchProposals(req.query.status || null) });
  }));

  router.post("/entity-matches", authorizeWrite, handle(async (req, res) => {
    const entityType = String(req.body.entityType || "").toUpperCase();
    const source = await repository.getSource(req.body.sourceId);
    if (!source) throw Object.assign(new Error("Source not found"), { status: 400, code: "INVALID_COMMERCIAL_REFERENCE" });
    const candidates = entityType === "COMPANY"
      ? await repository.listCompanies()
      : await repository.listPeople(req.body.proposedEntity?.companyId || null);
    const input = buildEntityMatchProposal({ entityType, proposedEntity: req.body.proposedEntity, candidates, sourceId: source.id });
    res.status(201).json({ success: true, match: await repository.createEntityMatchProposal(input, req.user.id) });
  }));

  router.patch("/entity-matches/:id", authorizeWrite, handle(async (req, res) => {
    const match = await repository.getEntityMatchProposal(req.params.id);
    if (!match) throw Object.assign(new Error("Entity match proposal not found"), { status: 404, code: "COMMERCIAL_MATCH_NOT_FOUND" });
    if (!["NEW", "DEFERRED"].includes(match.status)) throw Object.assign(new Error("Entity match has already been reviewed"), { status: 409, code: "COMMERCIAL_MATCH_ALREADY_REVIEWED" });
    const review = validateProposalReviewInput(req.body);
    if (review.decision === "EDIT") throw Object.assign(new Error("Entity matches support approve, reject, or defer"), { status: 400, code: "INVALID_MATCH_DECISION" });
    if (review.decision === "APPROVE") {
      if (!match.candidate_entity_id) throw Object.assign(new Error("A candidate entity is required to approve a match"), { status: 400, code: "MATCH_CANDIDATE_REQUIRED" });
      await repository.linkSource({ sourceId: match.source_id, entityType: match.entity_type, entityId: match.candidate_entity_id, claim: "Reviewed entity match", supportType: "CONTEXT" });
    }
    res.json({ success: true, match: await repository.reviewEntityMatchProposal(match.id, review, req.user.id) });
  }));

  router.get("/audit/:subjectType/:subjectId", handle(async (req, res) => {
    const subjectType = String(req.params.subjectType || "").toUpperCase();
    if (!["SOURCE", "AI_PROPOSAL", "ENTITY_MATCH"].includes(subjectType)) throw Object.assign(new Error("Unsupported audit subject"), { status: 400, code: "INVALID_AUDIT_SUBJECT" });
    res.json({ success: true, decisions: await repository.listReviewDecisions(subjectType, req.params.subjectId) });
  }));

  router.post("/sources/:id/link", authorizeWrite, handle(async (req, res) => {
    const entityType = String(req.body.entityType || "").toUpperCase();
    if (!["COMPANY", "PERSON", "SIGNAL", "OPPORTUNITY", "ACTION"].includes(entityType)) throw Object.assign(new Error("Unsupported evidence entity type"), { status: 400, code: "INVALID_EVIDENCE_ENTITY_TYPE" });
    const findEntity = {
      COMPANY: repository.getCompany,
      PERSON: repository.getPerson,
      SIGNAL: repository.getSignal,
      OPPORTUNITY: repository.getOpportunity,
      ACTION: repository.getRecommendedAction,
    }[entityType];
    const [source, entity] = await Promise.all([repository.getSource(req.params.id), findEntity(req.body.entityId)]);
    if (!source || !entity) throw Object.assign(new Error("Evidence source or target record not found"), { status: 404, code: "COMMERCIAL_EVIDENCE_TARGET_NOT_FOUND" });
    const link = await repository.linkSource({
      sourceId: req.params.id, entityType, entityId: req.body.entityId,
      claim: req.body.claim || null, supportType: req.body.supportType || "SUPPORTS",
    });
    res.status(201).json({ success: true, link });
  }));

  return router;
}

export default createCommercialIntelligenceRouter();