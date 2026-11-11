import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createMattLiveRouter } from "../routes/mattLiveRoutes.js";
import { createMattLiveService } from "../services/mattLiveService.js";
import { createMattAnswerService } from "../services/mattAnswerService.js";
import { createMattSaasContext, createMattAccountRepository } from "../services/mattAccountContext.js";
import { createOrganizationMiddleware } from "../middleware/organizationMiddleware.js";
import { createAIGateway, createInMemoryIntelligenceStore } from "../services/ai/aiGateway.js";
import { createAnalysisRunRepository } from "../repositories/phase3/analysisRunRepository.js";
import { createClauseRepository } from "../repositories/phase3/clauseRepository.js";
import { createObligationRepository } from "../repositories/phase3/obligationRepository.js";
import { createDeadlineRepository } from "../repositories/phase3/deadlineRepository.js";
import { createEvidenceRepository } from "../repositories/phase3/evidenceRepository.js";
import { createSearchChunkRepository } from "../repositories/phase3/searchChunkRepository.js";
import { readAnalysisRunClauses, readAnalysisRunObligations, readAnalysisRunDeadlines, readAnalysisRunEvidence, searchAnalysisRun } from "../routes/analysisRunRoutes.js";
import { readMattDemoContext, MATT_DEMO_ORGANIZATION_ID } from "../services/mattDemoContext.js";
import { OPERION_PLATFORM_KNOWLEDGE } from "../shared/operionPlatformKnowledge.js";
import { preparedPlatformGuide } from "../shared/mattPreparedGuide.js";
import { DEMO_CONTRACTS } from "../shared/mattDemoContracts.js";

const uuid = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const tenants = [0, 1].map((index) => ({
  organizationId: uuid(100 + index), userId: uuid(200 + index), contractId: uuid(300 + index),
  runId: uuid(400 + index), versionId: uuid(500 + index), documentId: uuid(600 + index),
  evidenceId: uuid(700 + index), sentinel: index ? "BOREAL-SECRET-771900-EUR" : "ALPHA-SECRET-183200-USD",
  name: index ? "Boreal Fictional Owner" : "Alpha Fictional Lessor",
}));

function database() {
  const tables = {}, queries = [];
  for (const tenant of tenants) {
    const common = { organization_id: tenant.organizationId, contract_id: tenant.contractId, document_id: tenant.documentId, document_version_id: tenant.versionId, analysis_run_id: tenant.runId, created_at: "2026-11-02" };
    const add = (table, row) => { (tables[table] ||= []).push(row); };
    add("contracts", { id: tenant.contractId, organization_id: tenant.organizationId, title: `${tenant.name} lease`, status: "active" });
    add("analysis_runs", { id: tenant.runId, ...common, status: "completed" });
    add("document_versions", { id: tenant.versionId, organization_id: tenant.organizationId, document_id: tenant.documentId });
    add("clauses", { id: uuid(800 + tenants.indexOf(tenant)), ...common, title: tenant.sentinel, source_text: tenant.sentinel, clause_number: "22.4" });
    add("obligations", { id: uuid(900 + tenants.indexOf(tenant)), ...common, description: tenant.sentinel, source_evidence_id: tenant.evidenceId });
    add("deadlines", { id: uuid(1000 + tenants.indexOf(tenant)), ...common, timing_expression: "10 days after shop visit", source_evidence_id: tenant.evidenceId });
    add("intelligence_evidence", { id: tenant.evidenceId, ...common, excerpt: tenant.sentinel, source_locator: `${tenant.name} clause 22.4` });
    add("contract_search_chunks", { id: uuid(1100 + tenants.indexOf(tenant)), ...common, text_content: tenant.sentinel });
  }
  const client = {
    from(table) {
      const filters = [], sorts = [];
      let maximum = Infinity, one = false;
      const builder = {
        select(columns) {
          if (table === "contracts") assert.equal(columns, "id, organization_id, title, status", "Contract schema uses title, not a document filename");
          return this;
        },
        eq(key, value) { filters.push([key, value]); return this; },
        in(key, values) { filters.push([key, values]); return this; },
        order(key, options) { sorts.push([key, options?.ascending !== false]); return this; },
        limit(value) { maximum = value; return this; },
        textSearch(_key, query) { filters.push(["text_content", { query }]); return this; },
        maybeSingle() { one = true; return this; },
        then(resolve, reject) {
          queries.push({ table, filters: structuredClone(filters) });
          let data = (tables[table] || []).filter((row) => filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : value?.query ? row[key]?.includes(value.query) : row[key] === value));
          for (const [key, ascending] of [...sorts].reverse()) data = data.toSorted((a, b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1));
          data = structuredClone(data.slice(0, maximum));
          return Promise.resolve({ data: one ? data[0] || null : data, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
    rpc() { throw new Error("Unscoped vector/RPC retrieval must not be used by Matt"); },
  };
  const runRepository = createAnalysisRunRepository(client);
  const version = async (id, organizationId) => (await client.from("document_versions").select("*").eq("id", id).eq("organization_id", organizationId).maybeSingle()).data;
  const readAnalysis = async (scope) => {
    const settings = { ...scope, analysisRunRepository: runRepository, documentVersionResolver: version };
    const [clauses, obligations, deadlines, evidence] = await Promise.all([
      readAnalysisRunClauses({ ...settings, clauseRepository: createClauseRepository(client) }),
      readAnalysisRunObligations({ ...settings, obligationRepository: createObligationRepository(client) }),
      readAnalysisRunDeadlines({ ...settings, deadlineRepository: createDeadlineRepository(client) }),
      readAnalysisRunEvidence({ ...settings, evidenceRepository: createEvidenceRepository(client) }),
    ]);
    return { clauses, obligations, deadlines, evidence, risks: [] };
  };
  return { client, tables, queries, runRepository, readAnalysis, readContext: createMattSaasContext({ readAnalysis, repository: createMattAccountRepository(client) }) };
}
const account = (tenant) => ({ organizationId: tenant.organizationId, userId: tenant.userId, name: tenant.name, permissions: ["organization:read", "contract:read"] });

test("two distinct tenants: real scoped repositories prevent direct/guessed analysis, document, evidence and text-search disclosure both ways", async () => {
  const db = database();
  for (const [index, tenant] of tenants.entries()) {
    const other = tenants[1 - index];
    const own = await db.readContext({ ...tenant, analysisRunId: tenant.runId, account: account(tenant) });
    assert.ok(JSON.stringify(own).includes(tenant.sentinel));
    assert.ok(!JSON.stringify(own).includes(other.sentinel));
    for (const identifier of [other.runId, other.documentId, other.versionId, other.evidenceId, other.contractId]) {
      await assert.rejects(db.readContext({ ...tenant, analysisRunId: identifier, account: account(tenant) }), { code: "ANALYSIS_RUN_NOT_FOUND" });
    }
    const search = (analysisRunId, query) => searchAnalysisRun({ organizationId: tenant.organizationId, analysisRunId, query, analysisRunRepository: db.runRepository, searchRepository: createSearchChunkRepository(db.client) });
    assert.deepEqual(await search(tenant.runId, other.sentinel), []);
    assert.equal((await search(tenant.runId, tenant.sentinel)).length, 1);
    await assert.rejects(search(other.runId, other.sentinel), { code: "ANALYSIS_RUN_NOT_FOUND" });
    const overview = await db.readContext({ ...tenant, contextMode: "account", account: account(tenant) });
    assert.equal(overview.contracts.length, 1);
    assert.equal(overview.analyses[0].contractId, tenant.contractId);
    assert.ok(!JSON.stringify(overview).includes(other.name));
  }
  assert.ok(db.queries.every((query) => query.filters.some(([key]) => key === "organization_id")), "Every actual repository query is tenant-scoped before retrieval");
});

test("account source mismatches, permission loss, oversize catalog and unknown flight/report/page scopes fail before model invocation", async () => {
  const db = database(), tenant = tenants[0], read = db.readContext;
  for (const changed of [null, { ...account(tenant), organizationId: tenants[1].organizationId }, { ...account(tenant), permissions: [] }, { ...account(tenant), userId: tenants[1].userId }]) {
    await assert.rejects(read({ ...tenant, contextMode: "account", account: changed }), { code: "MATT_ACCOUNT_DENIED" });
  }
  for (const contextMode of ["flight", "report", "admin", "vector"]) await assert.rejects(read({ ...tenant, contextMode, account: account(tenant) }), { code: "MATT_CONTEXT_DENIED" });
  await assert.rejects(read({ ...tenant, contextMode: "platform", analysisRunId: tenants[1].runId, account: account(tenant) }), { code: "MATT_CONTEXT_DENIED" });
  await assert.rejects(read({ ...tenant, contextMode: "platform", pageId: "../../customer", account: account(tenant) }), { code: "MATT_CONTEXT_DENIED" });
  for (let index = 0; index < 51; index++) db.tables.contracts.push({ id: uuid(2000 + index), organization_id: tenant.organizationId, title: "Fictional bounded record" });
  await assert.rejects(read({ ...tenant, contextMode: "account", account: account(tenant) }), { code: "MATT_CONTEXT_TOO_LARGE" });
  const bad = createMattAccountRepository({ from() {
    const result = { select() { return this; }, eq() { return this; }, order() { return this; }, limit: async () => ({ data: [{ organization_id: tenants[1].organizationId }] }) };
    return result;
  } });
  await assert.rejects(bad.listContracts(tenant.organizationId), { code: "MATT_ACCOUNT_SCOPE_FAILED" });
  const history = database();
  for (let index = 0; index < 201; index++) history.tables.analysis_runs.push({ id: uuid(5000 + index), organization_id: tenant.organizationId, contract_id: tenant.contractId, status: "completed", created_at: "2026-11-02" });
  await assert.rejects(history.readContext({ ...tenant, contextMode: "account", account: account(tenant) }), { code: "MATT_CONTEXT_TOO_LARGE" });
});

test("shared session/history, account refresh, gateway cache/jobs and provider context never mix tenants or owners", async () => {
  const db = database(), seen = [], store = createInMemoryIntelligenceStore();
  const gateway = createAIGateway({ store, providers: { offline: { name: "offline", model: "fixture", async generate(request) {
    const input = JSON.parse(request.input); seen.push(input);
    const source = input.context.evidence.find((item) => item.id === "account:catalog") || input.context.evidence[0];
    return { output: { answer: source.excerpt, established: true, evidence_ids: [source.id] } };
  } } } });
  for (const tenant of tenants) gateway.setBudget(tenant.organizationId, { allocated: 3000 });
  const generate = createMattAnswerService({ readContext: db.readContext, gateway: { request: (request) => gateway.request({ ...request, provider: "offline" }) } });
  const created = [];
  const service = createMattLiveService({ provider: { async create(...args) { assert.deepEqual(args, [], "Avatar creation never receives organization context or shared customer history"); created.push(true); return { conversationId: uuid(3000 + created.length) }; }, async end() {} },
    configuration: () => ({ enabled: true, missing: [] }), allowedOrganization: () => true, generateAnswer: generate });
  const sessions = [];
  try {
    for (const tenant of tenants) sessions.push(await service.create({ ...tenant, consent: true }));
    for (const [index, tenant] of tenants.entries()) {
      const other = tenants[1 - index], input = { ...tenant, id: sessions[index].id, analysisRunId: tenant.runId, account: account(tenant), question: "What are our return obligations?", confirmation: true };
      const result = await service.ask(input);
      assert.ok(!JSON.stringify(result).includes(other.sentinel), "The only answer eligible for avatar echo contains no other tenant's source marker");
      const count = seen.length;
      await assert.rejects(service.ask({ ...input, analysisRunId: other.runId }), { code: "ANALYSIS_RUN_NOT_FOUND" });
      assert.equal(seen.length, count, "Foreign source never reaches model");
      await assert.rejects(service.ask({ ...input, id: sessions[1 - index].id }), { code: "MATT_SESSION_NOT_FOUND" });
      await assert.rejects(service.ask({ ...input, userId: uuid(250) }), { code: "MATT_SESSION_NOT_FOUND" });
      await service.ask({ ...input, question: "What evidence supports that?" });
      assert.equal(seen.at(-1).history.length, 2);
      assert.ok(!JSON.stringify(seen.at(-1)).includes(other.sentinel));
      await service.ask({ ...input, analysisRunId: undefined, contextMode: "platform", question: "What is OCI?" });
      assert.deepEqual(seen.at(-1).history, []);
      assert.equal(seen.at(-1).context.clauses, undefined);
      await service.ask({ ...input, analysisRunId: undefined, contextMode: "account", question: "Which contracts are available?" });
      assert.ok(!JSON.stringify(seen.at(-1)).includes(other.name));
      db.tables.contracts.find((row) => row.id === tenant.contractId).title = `${tenant.name} UPDATED`;
      await service.ask({ ...input, analysisRunId: undefined, contextMode: "account", question: "Refresh the account catalog" });
      assert.match(seen.at(-1).context.contracts[0].title, /UPDATED$/, "Every accepted turn refreshes the authorized catalog rather than relying on stale history");
    }
    const question = { operation: "clause_interpretation", provider: "offline", input: JSON.stringify({ context: { evidence: [{ id: "shared-id", excerpt: "Identical public text" }] } }) };
    const before = seen.length;
    const first = await gateway.request({ ...question, organizationId: tenants[0].organizationId });
    await gateway.request({ ...question, organizationId: tenants[1].organizationId });
    assert.equal(seen.length, before + 2, "Identical inputs cannot cross tenant cache keys");
    assert.ok(gateway.getJob(tenants[0].organizationId, first.job.id));
    assert.equal(gateway.getJob(tenants[1].organizationId, first.job.id), null, "A foreign job ID cannot disclose another organization's result");
    const after = seen.length;
    await gateway.request({ ...question, organizationId: tenants[0].organizationId });
    assert.equal(seen.length, after, "Own scoped cache remains functional");
    const tenant = tenants[0], newUser = uuid(250);
    const input = { ...tenant, analysisRunId: tenant.runId, account: account(tenant), question: "Explain the return clause", history: [], confirmation: true };
    const ownerCount = seen.length;
    await generate(input);
    await generate({ ...input, userId: newUser, account: { ...account(tenant), userId: newUser } });
    assert.equal(seen.length, ownerCount + 2, "Different authorized users do not reuse private answer context from a shared owner");
    const authorizedCalls = seen.length;
    await assert.rejects(generate({ ...input, account: { ...account(tenant), permissions: [] } }), { code: "MATT_ACCOUNT_DENIED" });
    assert.equal(seen.length, authorizedCalls, "Revoked source access is checked before any previously populated cache is considered");
  } finally { for (const [index, session] of sessions.entries()) await service.end({ ...tenants[index], id: session.id }); }
});

test("actual HTTP membership checks reject modified tenant IDs and Super Admin before retrieval, and refresh permissions each turn", async () => {
  const db = database(), seen = [], created = [], sessions = [];
  const service = createMattLiveService({
    provider: { async create() { created.push(true); return { conversationId: uuid(4000 + created.length) }; }, async end() {} },
    configuration: () => ({ enabled: true, missing: [] }), allowedOrganization: () => true,
    generateAnswer: createMattAnswerService({ readContext: db.readContext, gateway: { async request(request) {
      seen.push(JSON.parse(request.input)); return { success: true, result: { answer: "Fictional owned source", established: true, evidence_ids: [seen.at(-1).context.evidence[0].id] } };
    } } }),
  });
  let revoked = false;
  const membership = createOrganizationMiddleware(async (_sql, [organizationId, userId]) => ({ rows: tenants.filter((tenant) => !revoked && tenant.organizationId === organizationId && tenant.userId === userId).map((tenant) => ({ id: tenant.organizationId, name: tenant.name, role: "admin" })) }));
  const app = express(); app.use(express.json());
  app.use("/api/matt", createMattLiveRouter({ service, membership, authenticate: (req, res, next) => {
    const tenant = tenants.find((item) => req.headers["x-test-user"] === item.userId);
    if (!tenant && req.headers["x-test-user"] !== "platform-admin") return res.sendStatus(401);
    req.user = { id: tenant?.userId || "platform-admin" }; req.auth = { role: "SUPERADMIN" }; next();
  }, logger: { error() {} } }));
  const server = createServer(app); await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const request = async (tenant, path, body, organizationId = tenant.organizationId) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/matt${path}`, { method: "POST", headers: { "Content-Type": "application/json", "x-test-user": tenant.userId, "x-org-id": organizationId }, body: JSON.stringify(body) });
    return { status: response.status, text: await response.text() };
  };
  try {
    for (const [index, tenant] of tenants.entries()) {
      assert.equal((await request(tenant, "/sessions", { consent: true }, tenants[1 - index].organizationId)).status, 403);
      const response = await request(tenant, "/sessions", { consent: true });
      const session = JSON.parse(response.text); sessions.push({ ...tenant, id: session.id });
      assert.equal((await request(tenant, `/sessions/${session.id}/turns`, { contextMode: "account", question: "Which leases can I see?", account: account(tenants[1 - index]), organizationId: tenants[1 - index].organizationId })).status, 200);
      assert.equal(seen.at(-1).context.account.name, tenant.name);
      assert.ok(!JSON.stringify(seen.at(-1)).includes(tenants[1 - index].name));
      const denied = await request(tenant, `/sessions/${session.id}/turns`, { analysisRunId: tenants[1 - index].runId, question: "Retrieve that lease" });
      assert.equal(denied.status, 404); assert.ok(!denied.text.includes(tenants[1 - index].name));
    }
    assert.equal((await request({ userId: "platform-admin", organizationId: tenants[0].organizationId }, "/sessions", { consent: true })).status, 403);
    revoked = true;
    assert.equal((await request(tenants[0], `/sessions/${sessions[0].id}/turns`, { contextMode: "account", question: "Retrieve account" })).status, 403);
    revoked = false;
    assert.equal((await request(tenants[0], `/sessions/${sessions[0].id}/turns`, { contextMode: "account", question: "Retrieve account" })).status, 404);
  } finally {
    try { for (const session of sessions) await service.revoke(session); }
    finally { await new Promise((resolve) => server.close(resolve)); }
  }
});

test("reviewed platform knowledge distinguishes configuration, Demo and roadmap; account/guide reads never fall back to customer sources", async () => {
  assert.deepEqual(new Set(OPERION_PLATFORM_KNOWLEDGE.map((item) => item.status)), new Set(["implemented", "configuration_required", "demo_only", "roadmap"]));
  for (const item of OPERION_PLATFORM_KNOWLEDGE) {
    assert.ok(item.sources.length && item.permission && item.workflow && item.description);
    for (const source of item.sources) await readFile(new URL(`../${source}`, import.meta.url));
  }
  assert.match(preparedPlatformGuide("How can I upload and analyze a contract?").answer, /configuration_required/);
  assert.match(preparedPlatformGuide("Is scenario simulation predictive risk available?").answer, /roadmap/);
  const context = await readMattDemoContext({ organizationId: MATT_DEMO_ORGANIZATION_ID, contextMode: "account" });
  assert.deepEqual(context.contracts.map(({ id }) => id), DEMO_CONTRACTS.map(({ id }) => id));
  assert.ok(!JSON.stringify(context).includes(tenants[0].sentinel));
  await assert.rejects(readMattDemoContext({ organizationId: tenants[0].organizationId, contextMode: "platform" }), { code: "MATT_DEMO_CONTEXT_DENIED" });
  await assert.rejects(readMattDemoContext({ organizationId: MATT_DEMO_ORGANIZATION_ID, contextMode: "account", analysisRunId: tenants[0].runId }), { code: "MATT_CONTEXT_DENIED" });
});

test("Matt has no semantic/vector or remote-report fallback; unavailable routes cannot bypass source authorization", async () => {
  for (const path of ["routes/mattLiveRoutes.js", "routes/mattDemoRoutes.js", "services/mattAnswerService.js", "services/mattAccountContext.js", "services/mattDemoContext.js"]) {
    const code = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.doesNotMatch(code, /vectorMemoryService|generateEmbedding|match_documents|\.rpc\(|fetch\(/, path);
  }
});

test("idle session termination cleans the provider and blocks further turns without another room", async () => {
  let ends = 0;
  const service = createMattLiveService({ provider: { async create() { return { conversationId: "idle-fixture" }; }, async end() { ends++; } },
    idleMs: 20, configuration: () => ({ enabled: true, missing: [] }), allowedOrganization: () => true, generateAnswer: async () => { throw new Error("must not run"); } });
  const session = await service.create({ ...tenants[0], consent: true });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(ends, 1);
  await assert.rejects(service.ask({ ...tenants[0], id: session.id, question: "After idle" }), { code: "MATT_SESSION_NOT_FOUND" });
});
