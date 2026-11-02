import test from "node:test";
import assert from "node:assert/strict";
import { createOpenaiMattSpeechProvider, mattSpeechSessionConfiguration } from "../providers/openaiMattSpeechProvider.js";
import { mattSpeechConfiguration } from "../services/mattSpeechConfiguration.js";
import { createMattLiveService } from "../services/mattLiveService.js";
import { validateMattLocal } from "../scripts/validate-matt-local.js";

const sdp = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";
const scope = { organizationId: "org-one", userId: "user-one" };
function fixture(overrides = {}) {
  const calls = [];
  const service = createMattLiveService({
    provider: { create: async () => ({ conversationId: "avatar-room" }), end: async (id) => calls.push(["end-avatar", id]) },
    speechProvider: { create: async (offer) => { calls.push(["speech", offer]); return { id: "rtc_test", sdp }; }, end: async (id) => calls.push(["end-speech", id]) },
    speechConfiguration: () => ({ provider: "openai-realtime", enabled: true, missing: [] }),
    configuration: () => ({ enabled: true, missing: [] }), allowedOrganization: () => true,
    generateAnswer: async () => ({ answer: "Authorized answer." }), logger: { error() {} },
    ...overrides,
  });
  return { service, calls };
}
test("real-time audio requires every independent approval; the default remains browser speech", () => {
  assert.equal(mattSpeechConfiguration({}).provider, "browser");
  const env = { MATT_SPEECH_PROVIDER: "openai-realtime" };
  assert.deepEqual(mattSpeechConfiguration(env).missing, ["MATT_REALTIME_ENABLED", "MATT_REALTIME_APPROVAL_ID", "MATT_AUDIO_PROCESSING_APPROVED", "MATT_REALTIME_BUDGET_APPROVED", "OPENAI_API_KEY"]);
  const complete = { ...env, MATT_REALTIME_ENABLED: "true", MATT_REALTIME_APPROVAL_ID: "approved-local", MATT_AUDIO_PROCESSING_APPROVED: "true", MATT_REALTIME_BUDGET_APPROVED: "true", OPENAI_API_KEY: "not-a-real-secret" };
  assert.equal(mattSpeechConfiguration(complete).enabled, true);
  assert.equal(JSON.stringify(validateMattLocal(complete)).includes(complete.OPENAI_API_KEY), false);
  assert.equal(mattSpeechConfiguration({ MATT_SPEECH_PROVIDER: "unsupported" }).enabled, false);
});
test("actual HTTP adapter uses documented SDP calls, server-only credentials and no autonomous answer", async () => {
  const seen = [];
  const provider = createOpenaiMattSpeechProvider({ apiKey: "test-secret", fetchImpl: async (url, options) => {
    seen.push({ url, options });
    return url.endsWith("/hangup") ? new Response(null, { status: 200 }) : new Response(sdp, { status: 201, headers: { Location: "/v1/realtime/calls/rtc_test" } });
  } });
  const session = await provider.create(sdp);
  assert.deepEqual(session, { id: "rtc_test", sdp });
  assert.equal(seen[0].url, "https://api.openai.com/v1/realtime/calls");
  assert.equal(seen[0].options.body.get("sdp"), sdp);
  const config = JSON.parse(seen[0].options.body.get("session"));
  assert.deepEqual(config, mattSpeechSessionConfiguration());
  assert.deepEqual(config.output_modalities, ["text"]);
  assert.equal(config.audio.input.turn_detection.create_response, false);
  assert.equal(config.audio.input.turn_detection.interrupt_response, false);
  assert.deepEqual(config.tools, []);
  await provider.end(session.id);
  assert.equal(seen[1].url, "https://api.openai.com/v1/realtime/calls/rtc_test/hangup");
  assert.equal(JSON.stringify(session).includes("test-secret"), false);
});
test("malformed remote SDP is terminated and provider error bodies are never exposed", async () => {
  let ended = false;
  const provider = createOpenaiMattSpeechProvider({ apiKey: "test", fetchImpl: async (url) => {
    if (url.endsWith("/hangup")) { ended = true; return new Response(null, { status: 200 }); }
    return new Response("invalid answer with private details", { status: 201, headers: { location: "/v1/realtime/calls/rtc_test" } });
  } });
  await assert.rejects(provider.create(sdp), { code: "MATT_SPEECH_INVALID_SDP" });
  assert.equal(ended, true);
  const refused = createOpenaiMattSpeechProvider({ apiKey: "test", fetchImpl: async () => new Response("private provider error", { status: 403 }) });
  await assert.rejects(refused.create(sdp), (error) => error.code === "MATT_SPEECH_PROVIDER_FAILED" && !error.message.includes("private"));
});
test("speech sessions bind tenant/user, consent, single connection and the parent avatar lifetime", async () => {
  const f = fixture();
  const parent = await f.service.create({ ...scope, consent: true });
  const args = { ...scope, id: parent.id, sdp, consent: true };
  await assert.rejects(f.service.openSpeech({ ...args, userId: "other" }), { code: "MATT_SESSION_NOT_FOUND" });
  await assert.rejects(f.service.openSpeech({ ...args, organizationId: "other" }), { code: "MATT_SESSION_NOT_FOUND" });
  await assert.rejects(f.service.openSpeech({ ...args, consent: false }), { code: "MATT_SPEECH_CONSENT_REQUIRED" });
  await assert.rejects(f.service.openSpeech({ ...args, sdp: `${sdp}m=video` }), { code: "MATT_SPEECH_INVALID_SDP" });
  const result = await f.service.openSpeech(args);
  assert.equal(result.sdp, sdp);
  assert.equal(result.expiresAt, parent.expiresAt);
  assert.equal(result.id, undefined);
  await assert.rejects(f.service.openSpeech(args), { code: "MATT_SPEECH_SESSION_LIMIT" });
  await f.service.end(args);
  assert.ok(f.calls.some(([kind]) => kind === "end-speech"));
  assert.ok(f.calls.some(([kind]) => kind === "end-avatar"));
});
test("blocked audio approval or organization prevents any speech-provider access", async () => {
  for (const overrides of [
    { speechConfiguration: () => ({ provider: "openai-realtime", enabled: false, missing: ["MATT_AUDIO_PROCESSING_APPROVED"] }) },
    { allowedOrganization: () => false },
  ]) {
    const f = fixture(overrides);
    if (overrides.allowedOrganization) {
      await assert.rejects(f.service.openSpeech({ ...scope, id: "none", consent: true, sdp }), { code: "MATT_NOT_CONFIGURED" });
    } else {
      const parent = await f.service.create({ ...scope, consent: true });
      await assert.rejects(f.service.openSpeech({ ...scope, id: parent.id, consent: true, sdp }), { code: "MATT_SPEECH_NOT_CONFIGURED" });
      await f.service.end({ ...scope, id: parent.id });
    }
    assert.equal(f.calls.some(([kind]) => kind === "speech"), false);
  }
});
test("late speech creation is terminated after browser cancellation, then a later connection is possible", async () => {
  let release, ended = 0;
  const f = fixture({ speechProvider: { create: () => new Promise((resolve) => { release = resolve; }), end: async () => { ended++; } } });
  const parent = await f.service.create({ ...scope, consent: true });
  const abort = new AbortController();
  const pending = f.service.openSpeech({ ...scope, id: parent.id, consent: true, sdp, signal: abort.signal });
  await new Promise((resolve) => setImmediate(resolve));
  abort.abort();
  release({ id: "rtc_late", sdp });
  await assert.rejects(pending, { code: "MATT_SPEECH_CANCELLED" });
  assert.equal(ended, 1);
  await f.service.end({ ...scope, id: parent.id });
});
test("parent termination waits for pending speech creation and cleans both providers", async () => {
  let release, ended = 0;
  const f = fixture({ speechProvider: { create: () => new Promise((resolve) => { release = resolve; }), end: async () => { ended++; } } });
  const parent = await f.service.create({ ...scope, consent: true });
  const pending = f.service.openSpeech({ ...scope, id: parent.id, consent: true, sdp });
  const observed = assert.rejects(pending, { code: "MATT_SPEECH_CANCELLED" });
  await new Promise((resolve) => setImmediate(resolve));
  const closing = f.service.end({ ...scope, id: parent.id });
  release({ id: "rtc_late", sdp });
  await Promise.all([observed, closing]);
  assert.equal(ended, 1);
});
test("uncertain speech creation retains owner lock even after avatar termination", async () => {
  const f = fixture({ speechProvider: { create: async () => { throw Object.assign(new Error("uncertain"), { code: "MATT_SPEECH_CREATION_UNCERTAIN", uncertain: true }); }, end: async () => {} } });
  const parent = await f.service.create({ ...scope, consent: true });
  const args = { ...scope, id: parent.id, consent: true, sdp };
  await assert.rejects(f.service.openSpeech(args), { code: "MATT_SPEECH_CREATION_UNCERTAIN" });
  await assert.rejects(f.service.end(args), { code: "MATT_SPEECH_CLEANUP_UNCERTAIN" });
  await assert.rejects(f.service.create({ ...scope, consent: true }), { code: "MATT_SESSION_LIMIT" });
  assert.ok(f.calls.some(([kind]) => kind === "end-avatar"));
});
test("spoken interruption waits for Operion cancellation before permitting the next answer", async () => {
  let release, started;
  const entered = new Promise((resolve) => { started = resolve; });
  const f = fixture({ generateAnswer: async ({ signal }) => {
    started();
    await new Promise((resolve) => { release = resolve; });
    signal.throwIfAborted();
    return { answer: "Must not survive interruption." };
  } });
  const parent = await f.service.create({ ...scope, consent: true });
  const args = { ...scope, id: parent.id };
  const answering = f.service.ask({ ...args, analysisRunId: "run", question: "Which obligation?" });
  const rejected = assert.rejects(answering, { name: "AbortError" });
  await entered;
  let interrupted = false;
  const interruption = f.service.interrupt(args).then(() => { interrupted = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(interrupted, false);
  release();
  await Promise.all([rejected, interruption]);
  assert.equal(interrupted, true);
  await f.service.end(args);
});
test("late cleanup identifies its own speech connection and cannot close a replacement", async () => {
  const f = fixture();
  const parent = await f.service.create({ ...scope, consent: true });
  const args = { ...scope, id: parent.id, sdp, consent: true };
  const first = await f.service.openSpeech(args);
  await f.service.endSpeech({ ...args, connectionId: first.connectionId });
  const second = await f.service.openSpeech(args);
  assert.notEqual(first.connectionId, second.connectionId);
  await f.service.endSpeech({ ...args, connectionId: first.connectionId });
  assert.equal(f.calls.filter(([kind]) => kind === "end-speech").length, 1);
  await assert.rejects(f.service.openSpeech(args), { code: "MATT_SPEECH_SESSION_LIMIT" });
  await f.service.end(args);
  assert.equal(f.calls.filter(([kind]) => kind === "end-speech").length, 2);
});
