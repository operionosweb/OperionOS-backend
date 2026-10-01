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

function appWith(repository, authorizeWrite = (_req, _res, next) => next()) {
  const authenticate = (req, _res, next) => {
    req.user = { id: "internal-user", rbiProfileId: "COMMERCIAL" };
    next();
  };
  const authorizeRead = (req, _res, next) => {
    req.auth = { roles: ["SUPERADMIN"], permissions: ["commercial_intelligence:read", "commercial_intelligence:write"] };
    next();
  };
  return express().use(express.json()).use("/api/intelligence", createCommercialIntelligenceRouter({
    authenticate, authorizeRead, authorizeWrite, repository,
  }));
}

function memoryRepository() {
  const records = { companies: [], people: [], signals: [], opportunities: [], sources: [], links: [] };
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
    listOpportunities: async () => records.opportunities,
    getOpportunity: async (id) => records.opportunities.find((item) => item.id === id) || null,
    createOpportunity: async (input) => { const item = { id: "opportunity-1", company_id: input.companyId, ...input }; records.opportunities.push(item); return item; },
    updateOpportunity: async (id, input) => Object.assign(records.opportunities.find((item) => item.id === id), input),
    createSource: async (input) => { const item = { id: "source-1", ...input }; records.sources.push(item); return item; },
    getSource: async (id) => records.sources.find((item) => item.id === id) || null,
    linkSource: async (input) => { records.links.push(input); return input; },
    listSources: async (entityType, entityId) => records.links.filter((link) => link.entityType === entityType && link.entityId === entityId).map(() => records.sources[0]),
  };
}

async function post(baseUrl, path, body) {
  return fetch(`${baseUrl}/api/intelligence${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("SUPERADMIN can manually create company, person, signal, opportunity, and source association", async () => {
  const repository = memoryRepository();
  await withServer(appWith(repository), async (baseUrl) => {
    assert.equal((await post(baseUrl, "/companies", { name: "Aero Lease", aviationSegment: "Aircraft Leasing" })).status, 201);
    assert.equal((await post(baseUrl, "/people", { companyId: "company-1", roleTitle: "Chief Financial Officer", roleCategory: "CFO" })).status, 201);
    assert.equal((await post(baseUrl, "/signals", { companyId: "company-1", signalType: "FLEET_EXPANSION", description: "Expansion announcement" })).status, 201);
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