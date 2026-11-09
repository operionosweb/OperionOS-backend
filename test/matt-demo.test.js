import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createMattDemoRouter } from "../routes/mattDemoRoutes.js";
import { createMattLiveService } from "../services/mattLiveService.js";
import { createMattAnswerService } from "../services/mattAnswerService.js";
import { createAIGateway } from "../services/ai/aiGateway.js";
import { mattDemoConfiguration } from "../services/mattDemoConfiguration.js";
import { MATT_DEMO_ORGANIZATION_ID, readMattDemoContext, resolveMattDemoAnalysis } from "../services/mattDemoContext.js";
import { DEMO_CONTRACTS } from "../shared/mattDemoContracts.js";
import { createDemonstrationScenarios } from "../shared/globeScenarioData.js";

const demoOrigin = "https://demo.example.test", otherOrigin = "https://other.example.test";
const quiet = { error() {} };
const configured = { enabled: true, missing: [], origins: [demoOrigin, otherOrigin], maxSessions: 12, intelligenceBudget: 3000 };

async function fixture(run, { config = configured, modelBudget = 3000, providerFailure = false } = {}) {
  let time = Date.now(), creates = 0, ends = 0, speechCreates = 0, speechEnds = 0;
  const generated = [], sessions = [];
  const gateway = createAIGateway({ providers: { offline: { name: "offline", model: "fixture", async generate(request) {
    const input = JSON.parse(request.input);
    generated.push({ ...input, system: request.system });
    return { output: { answer: `Fictional Demo evidence with ${input.history.length} prior messages: ${input.context.evidence[0].excerpt.slice(0, 100)}`, established: true, evidence_ids: [input.context.evidence[0].id] } };
  } } } });
  gateway.setBudget(MATT_DEMO_ORGANIZATION_ID, { allocated: modelBudget });
  const generate = createMattAnswerService({ readContext: readMattDemoContext, gateway: { request: (request) => gateway.request({ ...request, provider: "offline" }) } });
  const service = createMattLiveService({
    provider: { async create() { creates++; if (providerFailure) throw Object.assign(new Error("Offline provider unavailable"), { code: "MATT_PROVIDER_FAILED", status: 502 }); return { conversationId: `room-${creates}`, url: "https://tavus.daily.co/offline", token: "scoped-offline-room-token" }; }, async end() { ends++; } },
    speechProvider: { async create() { speechCreates++; return { id: `speech-${speechCreates}`, sdp: "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n" }; }, async end() { speechEnds++; } },
    speechConfiguration: () => ({ provider: "openai-realtime", enabled: true, missing: [] }),
    configuration: () => config, allowedOrganization: (id) => id === MATT_DEMO_ORGANIZATION_ID,
    generateAnswer: generate, maxSessions: 1, now: () => time, logger: quiet,
    assertReadiness: async () => {
      if ((await gateway.getBudget(MATT_DEMO_ORGANIZATION_ID)).remaining < gateway.estimate("clause_interpretation", "")) throw Object.assign(new Error("Demo model budget exhausted"), { code: "MATT_DEMO_MODEL_BUDGET_REQUIRED", status: 409 });
    },
  });
  const create = service.create;
  service.create = async (input) => { const result = await create(input); sessions.push({ organizationId: input.organizationId, userId: input.userId, id: result.id }); return result; };
  const app = express();
  app.use("/api/demo/matt", createMattDemoRouter({ service, configuration: () => config, now: () => time, logger: quiet }));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/demo/matt`;
  async function request(path, { method = "GET", token, body, origin = demoOrigin, headers = {} } = {}) {
    const response = await fetch(`${url}${path}`, {
      method, headers: { ...(origin ? { Origin: origin } : {}), "Content-Type": "application/json", ...(token ? { "X-Matt-Demo-Token": token } : {}), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  async function access() {
    const result = await request("/access", { method: "POST", body: { consent: true } });
    assert.equal(result.status, 200);
    assert.match(result.body.token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(result.headers.get("cache-control"), "no-store");
    return result.body.token;
  }
  async function start(token) {
    const result = await request("/sessions", { method: "POST", token, body: { consent: true } });
    assert.equal(result.status, 200);
    return result.body.id;
  }
  try { await run({ request, access, start, generated, advance: (amount) => { time += amount; }, counts: () => ({ creates, ends, speechCreates, speechEnds }), gateway }); }
  finally {
    for (const session of sessions) {
      try { await service.end(session); }
      catch (error) { if (error.code !== "MATT_SESSION_NOT_FOUND") throw error; }
    }
    await new Promise((resolve) => server.close(resolve));
  }
}

test("prepared contract and Globe sources are shared, isolated, cloned and never customer analyses", async () => {
  for (const contract of DEMO_CONTRACTS) {
    const context = await readMattDemoContext({ organizationId: MATT_DEMO_ORGANIZATION_ID, analysisRunId: resolveMattDemoAnalysis(contract.id) });
    assert.equal(context.demonstration, true);
    assert.deepEqual(context.clauses, contract.clauses);
    assert.match(context.notice, /not an uploaded or executed contract/);
    if (contract.analysisStatus === "synthetic_template") {
      assert.deepEqual(context.evidence, []);
      assert.match(context.notice, /No contract-type analysis or evidence/);
    } else {
      assert.equal(context.evidence[0].excerpt, contract.evidence[0].excerpt);
      context.evidence[0].excerpt = "tampered";
      assert.notEqual((await readMattDemoContext({ organizationId: MATT_DEMO_ORGANIZATION_ID, analysisRunId: resolveMattDemoAnalysis(contract.id) })).evidence[0].excerpt, "tampered");
    }
  }
  for (const flight of createDemonstrationScenarios()) {
    const context = await readMattDemoContext({ organizationId: MATT_DEMO_ORGANIZATION_ID, analysisRunId: resolveMattDemoAnalysis(flight.id) });
    assert.equal(context.flight.id, flight.id);
    assert.deepEqual(context.clauses, flight.intelligence.clauses);
    assert.equal(context.evidence[0].id, flight.intelligence.contract.clause.id);
    assert.match(context.notice, /NOT LIVE/);
  }
  for (const alias of ["customer-contract", "../admin", "00000000-0000-4000-8000-000000000001", { id: "demo-aircraft-lease" }]) assert.throws(() => resolveMattDemoAnalysis(alias), { code: "MATT_DEMO_CONTEXT_DENIED" });
  await assert.rejects(readMattDemoContext({ organizationId: "customer-org", analysisRunId: resolveMattDemoAnalysis("demo-aircraft-lease") }), { code: "MATT_DEMO_CONTEXT_DENIED" });
});

test("Demo account context keeps distinct synthetic illustrations and excludes template evidence", async () => {
  const context = await readMattDemoContext({ organizationId: MATT_DEMO_ORGANIZATION_ID, contextMode: "account", pageId: "dashboard" });
  const prepared = DEMO_CONTRACTS.filter((contract) => contract.analysisStatus !== "synthetic_template");
  assert.deepEqual(context.analyses.map((analysis) => analysis.contractId), prepared.map((contract) => contract.id));
  assert.ok(context.analyses.some((analysis) => analysis.contractId === "demo-mro-agreement" && analysis.evidence.some((item) => /indexed share/i.test(item.excerpt))));
  assert.ok(context.analyses.some((analysis) => analysis.contractId === "demo-aircraft-financing"));
  assert.ok(context.coverage.every((item) => item.independentAnalysis === false));
  for (const template of DEMO_CONTRACTS.filter((contract) => contract.analysisStatus === "synthetic_template")) {
    assert.ok(!context.analyses.some((analysis) => analysis.contractId === template.id));
    assert.equal(context.coverage.find((item) => item.contractId === template.id).preparedAnalysisSource, null);
  }
  const originalExcerpt = context.analyses[0].evidence[0].excerpt;
  context.analyses[0].evidence[0].excerpt = "tampered";
  assert.equal((await readMattDemoContext({ organizationId: MATT_DEMO_ORGANIZATION_ID, contextMode: "account", pageId: "dashboard" })).analyses[0].evidence[0].excerpt, originalExcerpt);
});

test("Demo account and platform modes cross the actual shared HTTP and reasoning path without accepting foreign context", async () => {
  await fixture(async ({ request, access, start, generated }) => {
    const token = await access(), id = await start(token);
    for (const contextMode of ["account", "platform"]) {
      const body = { contextMode, pageId: "dashboard", question: contextMode === "account" ? "Which prepared contracts are available?" : "What is OCI?", confirmation: true };
      const response = await request(`/sessions/${id}/turns`, { method: "POST", token, body });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(generated.at(-1).context.demonstration, true);
      assert.deepEqual(generated.at(-1).history, []);
      assert.equal(generated.at(-1).context.pageId, "dashboard");
      assert.ok(generated.at(-1).context.platform.features.every((feature) => feature.path.startsWith("/demo/")));
      if (contextMode === "account") {
        assert.equal(generated.at(-1).context.contracts.length, DEMO_CONTRACTS.length);
        assert.equal(generated.at(-1).context.analyses.length, DEMO_CONTRACTS.filter((contract) => contract.analysisStatus !== "synthetic_template").length);
        assert.equal(generated.at(-1).context.coverage.filter((item) => item.independentAnalysis).length, 0, "Synthetic illustrations are never independent real-world analyses");
      } else assert.equal(generated.at(-1).context.contracts, undefined);
      const calls = generated.length;
      for (const attack of [{ analysisRunId: "foreign-contract" }, { flightId: "other-flight" }, { reportId: "other-report" }, { account: { organizationId: "foreign" } }, { contextMode: "vector" }]) {
        const denied = await request(`/sessions/${id}/turns`, { method: "POST", token, body: { ...body, ...attack } });
        assert.ok([400, 403].includes(denied.status), JSON.stringify(denied));
      }
      assert.equal(generated.length, calls);
    }
  });
});

test("Demo configuration requires every separate approval, exact origin, bounded allocation and fixed Demo allowlist", () => {
  const env = {
    MATT_LIVE_ENABLED: "true", MATT_LIVE_APPROVAL_ID: "offline", MATT_LIVE_ORGANIZATIONS: MATT_DEMO_ORGANIZATION_ID,
    TAVUS_API_KEY: "offline", TAVUS_MATT_ECHO_PAL_ID: "offline", TAVUS_MATT_FACE_ID: "offline", TAVUS_MATT_VOICE_ID: "offline",
    MATT_ECHO_PAL_APPROVED: "true", MATT_FIXED_VOICE_APPROVED: "true", MATT_DATA_PROCESSING_APPROVED: "true", MATT_BUDGET_APPROVED: "true",
    AI_PROVIDER: "mistral", MISTRAL_API_KEY: "offline", MATT_DEMO_APPROVAL_ID: "offline",
    MATT_DEMO_SINGLE_PROCESS_APPROVED: "true", MATT_DEMO_ALLOWED_ORIGINS: demoOrigin, MATT_DEMO_MAX_SESSIONS: "3", MATT_DEMO_INTELLIGENCE_BUDGET: "100",
  };
  assert.equal(mattDemoConfiguration(env).enabled, true);
  assert.equal(mattDemoConfiguration(env).allowed, true);
  assert.equal(mattDemoConfiguration(env).readiness, "configured");
  assert.equal(mattDemoConfiguration({ ...env, MATT_DEMO_ENABLED: "false" }).enabled, true, "obsolete Demo-only switch cannot disable approved shared-engine operation");
  for (const name of Object.keys(env).filter((key) => key.startsWith("MATT_DEMO_"))) {
    const missing = { ...env }; delete missing[name];
    assert.equal(mattDemoConfiguration(missing).enabled, false, name);
  }
  for (const origin of ["*", "https://demo.example.test/path", "http://public.example.test", "null"]) assert.equal(mattDemoConfiguration({ ...env, MATT_DEMO_ALLOWED_ORIGINS: origin }).enabled, false);
  assert.equal(mattDemoConfiguration({ ...env, MATT_DEMO_MAX_SESSIONS: "13" }).enabled, false);
  assert.equal(mattDemoConfiguration({ ...env, MATT_LIVE_ORGANIZATIONS: "customer-org" }).enabled, false);
});

test("unapproved configuration and missing/wrong origin create no paid sessions", async () => {
  await fixture(async (f) => {
    assert.equal((await f.request("/status", { origin: null })).status, 403);
    const denied = await f.request("/status", { origin: "https://attacker.example.test" });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.readiness, "security_rejected");
    const status = await f.request("/status");
    assert.equal(status.body.enabled, false);
    assert.equal(status.body.allowed, true);
    assert.equal(status.body.readiness, "configuration_incomplete");
    assert.match(status.body.message, /TAVUS_API_KEY/);
    assert.equal((await f.request("/access", { method: "POST", body: { consent: true } })).status, 503);
    assert.equal(f.counts().creates, 0);
  }, { config: { ...configured, enabled: false, missing: ["TAVUS_API_KEY"] } });
});

test("authorized Demo uses the shared real session/answer/gateway lifecycle with grounded follow-up history", async () => {
  await fixture(async (f) => {
    assert.equal((await f.request("/status", { origin: null, headers: { Referer: `${demoOrigin}/demo/matt` } })).status, 200, "same-origin browser GET uses its strict Referer origin");
    assert.equal((await f.request("/status")).body.readiness, "configured");
    assert.equal((await f.request("/sessions", { method: "POST", body: { consent: true } })).status, 401);
    const token = await f.access(), id = await f.start(token);
    for (let index = 0; index < 2; index++) {
      const answer = await f.request(`/sessions/${id}/turns`, { method: "POST", token, body: { analysisRunId: "demo-aircraft-lease", question: index ? "What evidence supports that?" : "Which return condition applies?", confirmation: true } });
      assert.equal(answer.status, 200);
      assert.equal(answer.body.assistant.source, "ai_gateway");
      assert.equal(answer.body.assistant.demonstration, true);
      assert.equal(answer.body.assistant.evidence[0].id, "ev-return");
      assert.ok(answer.body.assistant.reviewRecommendations.length);
      assert.ok(answer.body.turnId);
    }
    assert.deepEqual(f.generated.map((item) => item.history.length), [0, 2]);
    assert.match(f.generated[0].system, /entirely prepared fictional/);
    assert.equal((await f.request(`/sessions/${id}/interrupt`, { method: "POST", token })).status, 200);
    assert.equal((await f.request(`/sessions/${id}`, { method: "DELETE", token })).status, 200);
    assert.equal(f.counts().creates, 1);
    assert.equal(f.counts().ends, 1);
  });

});

test("configured Demo distinguishes a runtime provider failure from a Demo prohibition", async () => {
  await fixture(async (f) => {
    const status = await f.request("/status");
    assert.equal(status.body.allowed, true);
    assert.equal(status.body.readiness, "configured", "Configuration is not a provider health probe");
    const token = await f.access();
    const failure = await f.request("/sessions", { method: "POST", token, body: { consent: true } });
    assert.equal(failure.status, 502);
    assert.equal(failure.body.readiness, "provider_unavailable");
    assert.equal(failure.body.code, "MATT_PROVIDER_FAILED");
    assert.equal(f.generated.length, 0);
  }, { providerFailure: true });
});

test("tenant, account, customer analysis, foreign session, arbitrary source and admin attacks are rejected before reasoning", async () => {
  await fixture(async (f) => {
    const token = await f.access(), id = await f.start(token), other = await f.access();
    const turn = { analysisRunId: "demo-aircraft-lease", question: "Review this source", confirmation: true };
    for (const body of [{ ...turn, organizationId: "customer" }, { ...turn, tenantId: "customer" }, { ...turn, evidence: ["secret"] }, { ...turn, userId: "admin" }]) assert.equal((await f.request(`/sessions/${id}/turns`, { method: "POST", token, body })).status, 400);
    for (const alias of ["customer-run", "00000000-0000-4000-8000-000000000001", "../admin"]) assert.equal((await f.request(`/sessions/${id}/turns`, { method: "POST", token, body: { ...turn, analysisRunId: alias } })).status, 403);
    assert.equal((await f.request(`/sessions/${id}/turns?organizationId=customer`, { method: "POST", token, body: turn })).status, 400);
    for (const headers of [{ "x-org-id": "customer" }, { Authorization: "Bearer customer-token" }]) assert.equal((await f.request(`/sessions/${id}/turns`, { method: "POST", token, body: turn, headers })).status, 403);
    assert.equal((await f.request(`/sessions/${id}/turns`, { method: "POST", token: other, body: turn })).status, 404);
    assert.equal((await f.request(`/sessions/${id}/turns`, { method: "POST", token, origin: otherOrigin, body: turn })).status, 401);
    assert.equal((await f.request("/admin", { method: "POST", token })).status, 404);
    assert.equal(f.generated.length, 0);
    assert.equal(f.counts().creates, 1);
  });
});

test("selected Globe context cannot borrow the prepared lease and changing it resets the shared history", async () => {
  await fixture(async (f) => {
    const token = await f.access(), id = await f.start(token);
    for (const alias of ["ac-demo-001", "ac-demo-001", "ac-demo-002"]) {
      const response = await f.request(`/sessions/${id}/turns`, { method: "POST", token, body: { analysisRunId: alias, question: "What notice applies to this flight?", confirmation: true } });
      assert.equal(response.status, 200);
      assert.ok(response.body.assistant.evidence.every((item) => item.id.startsWith("illustrative-flight-contract-")));
    }
    assert.deepEqual(f.generated.map((item) => item.history.length), [0, 2, 0]);
    assert.deepEqual(f.generated.map((item) => item.context.flight.id), ["ac-demo-001", "ac-demo-001", "ac-demo-002"]);
    assert.ok(f.generated.every((item) => !JSON.stringify(item.context).includes("ev-return")));
  });
});

test("one-use authorizations, one concurrent room, start window and capability expiration are enforced", async () => {
  await fixture(async (f) => {
    const token = await f.access(), id = await f.start(token);
    assert.equal((await f.request("/sessions", { method: "POST", token, body: { consent: true } })).status, 409);
    const other = await f.access();
    assert.equal((await f.request("/sessions", { method: "POST", token: other, body: { consent: true } })).status, 409);
    assert.equal(f.counts().creates, 1);
    const late = await f.access();
    f.advance(60001);
    assert.equal((await f.request("/sessions", { method: "POST", token: late, body: { consent: true } })).status, 409);
    f.advance(1200000);
    assert.equal((await f.request(`/sessions/${id}/turns`, { method: "POST", token, body: { analysisRunId: "demo-aircraft-lease", question: "Review the evidence" } })).status, 401);
    assert.equal(f.generated.length, 0);
  });
});

test("ten bounded answers and three speech attempts are enforced while cleanup remains available", async () => {
  await fixture(async (f) => {
    const token = await f.access(), id = await f.start(token);
    for (let index = 0; index < 10; index++) assert.equal((await f.request(`/sessions/${id}/turns`, { method: "POST", token, body: { analysisRunId: "demo-aircraft-lease", question: `Review the return source ${index}`, confirmation: true } })).status, 200);
    assert.equal((await f.request(`/sessions/${id}/turns`, { method: "POST", token, body: { analysisRunId: "demo-aircraft-lease", question: "Another answer" } })).status, 429);
    for (let index = 0; index < 3; index++) {
      assert.equal((await f.request(`/sessions/${id}/speech`, { method: "POST", token, body: { consent: true, sdp: "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n" } })).status, 200);
      assert.equal((await f.request(`/sessions/${id}/speech`, { method: "DELETE", token })).status, 200);
    }
    assert.equal((await f.request(`/sessions/${id}/speech`, { method: "POST", token, body: { consent: true, sdp: "v=0\r\nm=audio 9\r\n" } })).status, 429);
    assert.equal(f.generated.length, 10);
    assert.equal(f.counts().speechCreates, 3);
    assert.equal(f.counts().speechEnds, 3);
    assert.equal((await f.request(`/sessions/${id}`, { method: "DELETE", token })).status, 200);
  });
});

test("global process allowance, per-peer allowance and request throttling fail closed without blocking termination", async () => {
  await fixture(async (f) => {
    const token = await f.access(), id = await f.start(token);
    await f.access(); await f.access();
    assert.equal((await f.request("/access", { method: "POST", body: { consent: true } })).status, 429);
    let response;
    for (let index = 0; index < 241; index++) response = await f.request("/status");
    assert.equal(response.status, 429);
    assert.ok(response.headers.get("retry-after"));
    assert.equal((await f.request(`/sessions/${id}`, { method: "DELETE", token })).status, 200);
  });
  await fixture(async (f) => {
    await f.access();
    assert.equal((await f.request("/status")).body.enabled, false);
    assert.equal((await f.request("/access", { method: "POST", body: { consent: true } })).status, 429);
  }, { config: { ...configured, maxSessions: 1 } });
});

test("budget exhaustion prevents avatar creation and oversized requests never reach a provider", async () => {
  await fixture(async (f) => {
    const token = await f.access();
    assert.equal((await f.request("/sessions", { method: "POST", token, body: { consent: true } })).status, 409);
    assert.equal(f.counts().creates, 0);
    assert.equal((await f.request("/access", { method: "POST", body: { consent: true, payload: "x".repeat(70000) } })).status, 413);
    assert.equal(f.generated.length, 0);
  }, { modelBudget: 0 });
});
