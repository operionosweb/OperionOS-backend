import express from "express";

import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import {
  PLATFORM_PERMISSIONS,
  requirePlatformPermission,
} from "../middleware/superAdminMiddleware.js";
import { createCommercialIntelligenceRepository } from "../repositories/commercialIntelligenceRepository.js";
import {
  assertOpportunityTransition,
  generateGroundedOpportunityReasoning,
  prioritizeCommercialIntelligence,
  validateCompanyInput,
  validateOpportunityInput,
  validatePersonInput,
  validateSignalInput,
  validateSourceInput,
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
    const [companies, signals, opportunities] = await Promise.all([
      repository.listCompanies(), repository.listSignals(), repository.listOpportunities(),
    ]);
    const prioritized = prioritizeCommercialIntelligence({ context: contextFor(req), companies, signals, opportunities });
    res.json({
      success: true,
      profile: contextFor(req).rbiProfile,
      priorityOpportunities: prioritized.opportunities.filter((item) => !["CUSTOMER", "DISQUALIFIED"].includes(item.status)).slice(0, 6),
      newSignals: prioritized.signals.slice(0, 6),
      companiesToReview: prioritized.companies.filter((item) => item.intelligence_status !== "ARCHIVED").slice(0, 6),
      recommendedActions: prioritized.opportunities.filter((item) => item.primary_next_action).slice(0, 6).map((item) => ({ opportunityId: item.id, title: item.title, action: item.primary_next_action })),
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
    const person = await repository.createPerson(validatePersonInput(req.body), req.user.id);
    res.status(201).json({ success: true, person });
  }));

  router.get("/signals", handle(async (req, res) => {
    const signals = await repository.listSignals(req.query.companyId || null);
    res.json({ success: true, signals: prioritizeCommercialIntelligence({ context: contextFor(req), signals }).signals });
  }));

  router.post("/signals", authorizeWrite, handle(async (req, res) => {
    const signal = await repository.createSignal(validateSignalInput(req.body), req.user.id);
    res.status(201).json({ success: true, signal });
  }));

  router.get("/opportunities", handle(async (req, res) => {
    const opportunities = await repository.listOpportunities();
    res.json({ success: true, opportunities: prioritizeCommercialIntelligence({ context: contextFor(req), opportunities }).opportunities });
  }));

  router.post("/opportunities", authorizeWrite, handle(async (req, res) => {
    const input = validateOpportunityInput(req.body);
    const [company, signal, person] = await Promise.all([
      repository.getCompany(input.companyId),
      input.signalId ? repository.getSignal(input.signalId) : null,
      input.keyPersonId ? repository.getPerson(input.keyPersonId) : null,
    ]);
    if (!company) throw Object.assign(new Error("Company not found"), { status: 404, code: "COMMERCIAL_COMPANY_NOT_FOUND" });
    if (input.signalId && (!signal || signal.company_id !== input.companyId)) throw Object.assign(new Error("Signal does not belong to the selected company"), { status: 400, code: "INVALID_COMMERCIAL_REFERENCE" });
    if (input.keyPersonId && (!person || person.company_id !== input.companyId)) throw Object.assign(new Error("Person does not belong to the selected company"), { status: 400, code: "INVALID_COMMERCIAL_REFERENCE" });
    const opportunity = await repository.createOpportunity(input, req.user.id);
    res.status(201).json({ success: true, opportunity });
  }));

  router.get("/opportunities/:id", handle(async (req, res) => {
    const opportunity = await repository.getOpportunity(req.params.id);
    if (!opportunity) throw Object.assign(new Error("Opportunity not found"), { status: 404, code: "COMMERCIAL_OPPORTUNITY_NOT_FOUND" });
    const sources = await sourcesForReasoning(repository, {
      companyId: opportunity.company_id, signalId: opportunity.signal_id,
      personId: opportunity.key_person_id, opportunityId: opportunity.id,
    });
    res.json({ success: true, opportunity, sources });
  }));

  router.patch("/opportunities/:id", authorizeWrite, handle(async (req, res) => {
    const existing = await repository.getOpportunity(req.params.id);
    if (!existing) throw Object.assign(new Error("Opportunity not found"), { status: 404, code: "COMMERCIAL_OPPORTUNITY_NOT_FOUND" });
    if (req.body.status) assertOpportunityTransition(existing.status, req.body.status);
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
    res.json({ success: true, opportunity: updated, reasoning, sources });
  }));

  router.post("/sources", authorizeWrite, handle(async (req, res) => {
    const source = await repository.createSource(validateSourceInput(req.body), req.user.id);
    res.status(201).json({ success: true, source });
  }));

  router.post("/sources/:id/link", authorizeWrite, handle(async (req, res) => {
    const entityType = String(req.body.entityType || "").toUpperCase();
    if (!["COMPANY", "PERSON", "SIGNAL", "OPPORTUNITY"].includes(entityType)) throw Object.assign(new Error("Unsupported evidence entity type"), { status: 400, code: "INVALID_EVIDENCE_ENTITY_TYPE" });
    const findEntity = {
      COMPANY: repository.getCompany,
      PERSON: repository.getPerson,
      SIGNAL: repository.getSignal,
      OPPORTUNITY: repository.getOpportunity,
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