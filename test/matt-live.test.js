import test from "node:test";
import assert from "node:assert/strict";
import { createMattLiveService, mattLiveConfiguration } from "../services/mattLiveService.js";
import { createMattAnswerService } from "../services/mattAnswerService.js";
import { createTavusEchoProvider } from "../providers/tavusEchoProvider.js";
import { createAIGateway, createInMemoryIntelligenceStore, createMistralProvider, createOpenRouterProvider } from "../services/ai/aiGateway.js";

const organizationId = "10000000-0000-4000-8000-000000000001";
const analysisRunId = "20000000-0000-4000-8000-000000000001";
const source = { id: "source-one", excerpt: "The aircraft shall be returned airworthy.", source_locator: "Clause 22", page_number: 4 };
function fixture(generateAnswer = async () => ({ answer: "The aircraft must be returned airworthy.", established: true, findings: [], evidence: [source] })) {
  const calls = [];
  const service = createMattLiveService({
    provider: { async create() { calls.push("create"); return { conversationId: "remote", url: "https://tavus.daily.co/remote", token: "scoped-test-token" }; }, async end(id) { calls.push(`end:${id}`); } },
    generateAnswer, configuration: () => ({ enabled: true, missing: [] }), allowedOrganization: (id) => id === organizationId,
  });
  return { service, calls, scope: { organizationId, userId: "user", consent: true } };
}
test("live configuration fails closed without every external approval and credential", () => {
  const status = mattLiveConfiguration({});
  assert.equal(status.enabled, false);
  for (const name of ["TAVUS_API_KEY", "MATT_BUDGET_APPROVED", "MATT_DATA_PROCESSING_APPROVED", "TAVUS_MATT_VOICE_ID", "MATT_ECHO_PAL_APPROVED"]) assert.ok(status.missing.includes(name));
});
test("disabled or unapproved organizations never create a provider session", async () => {
  const f = fixture();
  await assert.rejects(f.service.create({ ...f.scope, organizationId: "other" }), { code: "MATT_NOT_CONFIGURED" });
  await assert.rejects(f.service.create({ ...f.scope, consent: false }), { code: "MATT_CONSENT_REQUIRED" });
  assert.deepEqual(f.calls, []);
});
test("sessions are private to both user and tenant, limited, and explicitly terminated", async () => {
  const f = fixture();
  const session = await f.service.create(f.scope);
  try {
    await assert.rejects(f.service.create(f.scope), { code: "MATT_SESSION_LIMIT" });
    await assert.rejects(f.service.ask({ ...f.scope, id: session.id, userId: "another", analysisRunId, question: "What is required?" }), { code: "MATT_SESSION_NOT_FOUND" });
    await assert.rejects(f.service.end({ ...f.scope, id: session.id, organizationId: "other" }), { code: "MATT_SESSION_NOT_FOUND" });
  } finally { await f.service.end({ ...f.scope, id: session.id }); }
  assert.deepEqual(f.calls, ["create", "end:remote"]);
});
test("actual turn service sends question and scoped follow-up history to orchestration", async () => {
  const requests = [];
  const f = fixture(async (request) => { requests.push(request); return { answer: "Supported answer." }; });
  const session = await f.service.create(f.scope);
  try {
    const first = await f.service.ask({ ...f.scope, id: session.id, analysisRunId, question: "What happens at return?" });
    await f.service.ask({ ...f.scope, id: session.id, analysisRunId, question: "Which evidence supports that?" });
    assert.equal(first.assistant.answer, "Supported answer.");
    assert.equal(requests[0].organizationId, organizationId);
    assert.equal(requests[0].question, "What happens at return?");
    assert.equal(requests[1].history[1].text, first.assistant.answer);
    await f.service.ask({ ...f.scope, id: session.id, analysisRunId: "different-run", question: "What is required?" });
    assert.deepEqual(requests[2].history, []);
  } finally { await f.service.end({ ...f.scope, id: session.id }); }
});
test("interruption aborts active generation and suppresses late response and history", async () => {
  let release, started;
  const ready = new Promise((resolve) => { started = resolve; });
  const f = fixture(async ({ signal }) => {
    started(signal);
    await new Promise((resolve) => { release = resolve; });
    return { answer: "A late response must not be spoken." };
  });
  const session = await f.service.create(f.scope);
  const pending = f.service.ask({ ...f.scope, id: session.id, analysisRunId, question: "What does this mean?" });
  const signal = await ready;
  f.service.interrupt({ ...f.scope, id: session.id });
  assert.equal(signal.aborted, true);
  release();
  await assert.rejects(pending, { name: "AbortError" });
  await f.service.end({ ...f.scope, id: session.id });
});
test("cancelled session creation terminates the late provider room", async () => {
  let release, started;
  const ready = new Promise((resolve) => { started = resolve; });
  const calls = [], controller = new AbortController();
  const service = createMattLiveService({
    provider: { create: () => new Promise((resolve) => { release = resolve; started(); }), end: async (id) => { calls.push(id); } },
    configuration: () => ({ enabled: true, missing: [] }), allowedOrganization: () => true,
    logger: { error() {} },
  });
  const pending = service.create({ organizationId, userId: "user", consent: true, signal: controller.signal });
  await ready;
  controller.abort();
  release({ conversationId: "late-room" });
  await assert.rejects(pending, { name: "AbortError" });
  assert.deepEqual(calls, ["late-room"]);
});
test("gateway answer generation uses authorized sources and rejects invented evidence IDs", async () => {
  const requests = [];
  const gateway = { request: async (request) => { requests.push(request); return { success: true, result: { answer: "Airworthy return is required.", established: true, evidence_ids: ["source-one"] } }; } };
  const readContext = async (scope) => { assert.equal(scope.organizationId, organizationId); assert.equal(scope.analysisRunId, analysisRunId); assert.equal(scope.contextMode, "analysis"); assert.equal(scope.pageId, "matt"); return { evidence: [source], clauses: [], obligations: [], deadlines: [], risks: [] }; };
  const answer = createMattAnswerService({ readContext, gateway });
  const result = await answer({ organizationId, userId: "user", analysisRunId, question: "Which condition applies?", history: [] });
  assert.equal(result.source, "ai_gateway");
  assert.deepEqual(result.evidence, [source]);
  assert.match(requests[0].input, /Which condition applies/);
  assert.equal(requests[0].operation, "clause_interpretation");
  gateway.request = async () => ({ success: true, result: { answer: "Invented", established: true, evidence_ids: ["other-tenant-source"] } });
  await assert.rejects(answer({ organizationId, analysisRunId, question: "Explain", history: [] }), { code: "MATT_INVALID_ANSWER" });
});
test("context authorization failure prevents any model invocation", async () => {
  let calls = 0;
  const answer = createMattAnswerService({ readContext: async () => { throw Object.assign(new Error("Not found"), { code: "ANALYSIS_RUN_NOT_FOUND" }); }, gateway: { request: async () => { calls++; } } });
  await assert.rejects(answer({ organizationId, analysisRunId, question: "Explain", history: [] }), { code: "ANALYSIS_RUN_NOT_FOUND" });
  assert.equal(calls, 0);
});
test("the existing gateway enforces budget and forwards cancellation to model providers", async () => {
  const seen = [], controller = new AbortController();
  const gateway = createAIGateway({ store: createInMemoryIntelligenceStore(), providers: { test: { generate: async (request) => { seen.push(request.signal); return { output: { answer: "Supported" } }; } } } });
  const request = { organizationId, operation: "clause_interpretation", input: "Synthetic only", provider: "test", signal: controller.signal };
  assert.equal((await gateway.request(request)).code, "INSUFFICIENT_INTELLIGENCE_BUDGET");
  assert.equal(seen.length, 0);
  gateway.setBudget(organizationId, { allocated: 100 });
  assert.equal((await gateway.request(request)).success, true);
  assert.equal(seen[0], controller.signal);
  controller.abort();
  await assert.rejects(gateway.request(request), { name: "AbortError" });
});
test("configured HTTP model providers forward AbortSignal without network calls", async () => {
  for (const createProvider of [createMistralProvider, createOpenRouterProvider]) {
    const controller = new AbortController();
    const provider = createProvider({ apiKey: "synthetic-only", http: { post: async (_url, _body, options) => {
      assert.equal(options.signal, controller.signal);
      return { data: { choices: [{ message: { content: "{}" } }] } };
    } } });
    await provider.generate({ input: "Synthetic", signal: controller.signal });
  }
});
test("real Tavus HTTP adapter checks fixed voice and creates bounded private unrecorded rooms", async () => {
  const requests = [];
  const provider = createTavusEchoProvider({ apiKey: "synthetic-only", palId: "approved-pal", faceId: "approved-face", voiceId: "approved-voice",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => url.includes("/pals/") ? { layers: { tts: { voice_id: "approved-voice" } } }
        : { conversation_id: "room", conversation_url: "https://tavus.daily.co/room", meeting_token: "scoped-only" } };
    },
  });
  const room = await provider.create();
  const body = JSON.parse(requests[1].options.body);
  assert.equal(body.require_auth, true);
  assert.equal(body.properties.enable_recording, false);
  assert.equal(body.properties.max_call_duration, 600);
  assert.equal(body.face_id, "approved-face");
  assert.equal(room.token, "scoped-only");
  assert.equal(JSON.stringify(room).includes("synthetic-only"), false);
  await provider.end(room.conversationId);
  assert.match(requests.at(-1).url, /\/room\/end$/);
});
test("provider fixed-voice mismatch is refused before room creation", async () => {
  let created = false;
  const provider = createTavusEchoProvider({ apiKey: "synthetic", palId: "pal", faceId: "face", voiceId: "voice",
    fetchImpl: async (url) => { if (!url.includes("/pals/")) created = true; return { ok: true, json: async () => ({ layers: { tts: { voice_id: "wrong" } } }) }; },
  });
  await assert.rejects(provider.create(), { code: "MATT_PAL_MISMATCH" });
  assert.equal(created, false);
});

test("provider room URL forgery is refused and the created room is terminated", async () => {
  const ended = [];
  const provider = createTavusEchoProvider({ apiKey: "synthetic", palId: "pal", faceId: "face", voiceId: "voice",
    fetchImpl: async (url) => {
      if (url.endsWith("/end")) ended.push(url);
      return { ok: true, json: async () => url.includes("/pals/") ? { layers: { tts: { voice_id: "voice" } } }
        : { conversation_id: "forged-room", conversation_url: "https://tavus.daily.co.attacker.test/room", meeting_token: "do-not-use" } };
    },
  });
  await assert.rejects(provider.create(), { code: "MATT_PROVIDER_FAILED" });
  assert.equal(ended.length, 1);
  assert.match(ended[0], /\/forged-room\/end$/);
});

test("unconfirmed provider cleanup keeps the owner blocked from creating another paid room", async () => {
  const service = createMattLiveService({
    provider: { create: async () => ({ conversationId: "room" }), end: async () => { throw new Error("Synthetic cleanup failure"); } },
    configuration: () => ({ enabled: true, missing: [] }), allowedOrganization: () => true,
  });
  const scope = { organizationId, userId: "user", consent: true };
  const session = await service.create(scope);
  await assert.rejects(service.end({ ...scope, id: session.id }), /cleanup failure/);
  await assert.rejects(service.create(scope), { code: "MATT_SESSION_LIMIT" });
});

test("model budget readiness is checked before incurring avatar room cost", async () => {
  let created = false;
  const service = createMattLiveService({
    provider: { create: async () => { created = true; } },
    assertReadiness: async () => { throw Object.assign(new Error("No model budget"), { code: "MATT_MODEL_BUDGET_REQUIRED" }); },
    configuration: () => ({ enabled: true, missing: [] }), allowedOrganization: () => true,
  });
  await assert.rejects(service.create({ organizationId, userId: "user", consent: true }), { code: "MATT_MODEL_BUDGET_REQUIRED" });
  assert.equal(created, false);
});

test("large authorized context requires explicit cost confirmation before the actual gateway model path", async () => {
  let calls = 0;
  const gateway = createAIGateway({ store: createInMemoryIntelligenceStore(), providers: {
    test: { generate: async () => { calls++; return { output: { answer: "The source describes airworthy return.", established: true, evidence_ids: [source.id] } }; } },
  } });
  gateway.setBudget(organizationId, { allocated: 200 });
  const answer = createMattAnswerService({ readContext: async () => ({ evidence: [{ ...source, excerpt: "Authorized source text. ".repeat(1300) }] }),
    gateway: { request: (request) => gateway.request({ ...request, provider: "test" }) },
  });
  const request = { organizationId, userId: "user", analysisRunId, question: "What is the return condition?", history: [] };
  await assert.rejects(answer(request), (error) => error.code === "MATT_CONFIRMATION_REQUIRED" && error.estimatedIntelligence >= 50);
  assert.equal(calls, 0);
  assert.equal((await answer({ ...request, confirmation: true })).established, true);
  assert.equal(calls, 1);
});
