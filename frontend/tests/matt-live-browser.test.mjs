import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";
import { chromium } from "@playwright/test";
import { createDemonstrationScenarios } from "../../shared/globeScenarioData.js";
import express from "express";
import { createServer } from "node:http";
import { createMattDemoRouter } from "../../routes/mattDemoRoutes.js";
import { createMattLiveService } from "../../services/mattLiveService.js";
import { createMattAnswerService } from "../../services/mattAnswerService.js";
import { createAIGateway } from "../../services/ai/aiGateway.js";
import { MATT_DEMO_ORGANIZATION_ID, readMattDemoContext } from "../../services/mattDemoContext.js";
import { createMattLiveRouter } from "../../routes/mattLiveRoutes.js";
import { createUserAuthMiddleware } from "../../middleware/userAuthMiddleware.js";
import { createOrganizationMiddleware } from "../../middleware/organizationMiddleware.js";
import { mkdir } from "node:fs/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const authOrigin = "http://127.0.0.1:59998";
process.env.VITE_SUPABASE_URL = authOrigin;
process.env.VITE_SUPABASE_ANON_KEY = "offline-matt-test";
process.env.VITE_API_BASE_URL = "";
let browser, server, origin;
before(async () => {
  await build({ root, mode: "matt-offline", resolve: { alias: { "@daily-co/daily-js": path.join(root, "tests", "fixtures", "daily-synthetic.js") } }, logLevel: "error" });
  server = await preview({ root, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: process.env.MATT_TEST_BROWSER || undefined, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
});
after(async () => {
  await browser?.close();
  if (server) { server.httpServer.closeAllConnections(); await new Promise((resolve) => server.httpServer.close(resolve)); }
});

async function fixture({ demo = false, flightId = null, configured = true, requiresConfirmation = false, width = 1440, deviceScaleFactor = 1, connect = true, captureFailure = null, blockAudio = false, manualTranscript = false, delayCapture = false, realtime = false, speechApproved = true, idleTimeoutMs, organizationId = "org-one", secondOrganizationId, analysisRunId = "run-one" } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor });
  const user = { id: "00000000-0000-4000-8000-000000000001", email: "reviewer@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
  const now = Math.floor(Date.now() / 1000);
  const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"), Buffer.from(JSON.stringify({ sub: user.id, exp: now + 3600, role: "authenticated", aal: "aal2" })).toString("base64url"), Buffer.from("offline-signature").toString("base64url")].join(".");
  await context.addInitScript(({ stored, captureFailure, blockAudio, manualTranscript, delayCapture, organizationId, secondOrganizationId }) => {
    localStorage.setItem("sb-127-auth-token", JSON.stringify(stored));
    if (![organizationId, secondOrganizationId].filter(Boolean).includes(localStorage.getItem("operion.organizationId"))) localStorage.setItem("operion.organizationId", organizationId);
    localStorage.setItem("operion.consent", "declined");
    window.__speechOutputs = 0;
    window.__captureCalls = 0; window.__capturedTracks = [];
    window.__captureFailure = captureFailure; window.__blockAudio = blockAudio;
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      window.__captureCalls++;
      if (window.__captureFailure) throw new DOMException("Synthetic permission/device failure", window.__captureFailure);
      const stream = await capture(constraints);
      window.__capturedTracks.push(...stream.getTracks());
      if (delayCapture) await new Promise((resolve) => { window.__releaseCapture = resolve; });
      return stream;
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.srcObject && window.__blockAudio) return Promise.reject(new DOMException("Synthetic autoplay denial", "NotAllowedError"));
      return play.call(this);
    };
    class Recognition {
      start(track) {
        window.__recognizedTrack = track; window.__recognition = this; this.onstart?.();
        if (!manualTranscript) setTimeout(() => { this.onresult?.({ results: [{ isFinal: true, 0: { transcript: "Which return condition applies?" } }] }); this.onend?.(); }, 30);
      }
      abort() {}
    }
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: Recognition });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { getVoices: () => [], addEventListener() {}, removeEventListener() {}, cancel() {}, speak() { window.__speechOutputs++; } } });
  }, { stored: { access_token: token, refresh_token: "offline-refresh", token_type: "bearer", expires_at: now + 3600, expires_in: 3600, user }, captureFailure, blockAudio, manualTranscript, delayCapture, organizationId, secondOrganizationId });
  const page = await context.newPage(), requests = [], errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url()), request = route.request();
    const json = (body, status = 200) => route.fulfill({ json: body, status });
    if (url.origin === authOrigin) return url.pathname.endsWith("/user") ? json(user) : route.abort();
    if (url.origin !== origin) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const body = request.postData() ? request.postDataJSON() : null;
    requests.push({ path: url.pathname, method: request.method(), body, org: request.headers()["x-org-id"], hasAuth: Boolean(request.headers().authorization), hasDemoToken: Boolean(request.headers()["x-matt-demo-token"]) });
    if (url.pathname === "/api/platform/context") return json({ roles: ["user"], permissions: [] });
    if (url.pathname === "/api/foundation/organizations") return json({ organizations: [{ id: organizationId, name: "Synthetic tenant" }, ...(secondOrganizationId ? [{ id: secondOrganizationId, name: "Second synthetic tenant" }] : [])] });
    if (url.pathname === "/api/foundation/context") return json({ organization: { id: request.headers()["x-org-id"], role: "admin" } });
    if (url.pathname === "/api/contracts") return json({ contracts: [{ id: "lease-one", title: "Synthetic authorized lease" }] });
    if (url.pathname.endsWith("/documents")) return json({ documents: [{ id: "doc-one" }] });
    if (url.pathname.endsWith("/versions")) return json({ versions: [{ analysis_run_id: analysisRunId }] });
    if (url.pathname.endsWith("/search")) return json({ results: [] });
    const mattBase = demo ? "/api/demo/matt" : "/api/matt";
    if (url.pathname === `${mattBase}/status`) return json({ enabled: configured, message: "Synthetic provider configuration missing.",
      ...(realtime ? { speech: { provider: "openai-realtime", enabled: speechApproved, missing: speechApproved ? [] : ["MATT_AUDIO_PROCESSING_APPROVED"] } } : {}) });
    if (url.pathname === "/api/demo/matt/access") return json({ token: "a".repeat(43), expiresAt: new Date(Date.now() + 1200000).toISOString() });
    if (url.pathname === `${mattBase}/sessions`) return json({ id: "session-one", conversationId: "synthetic-room", url: "https://tavus.daily.co/synthetic-room", token: "scoped-token", ...(idleTimeoutMs ? { idleTimeoutMs, expiresAt: new Date(Date.now() + 600000).toISOString() } : {}) });
    if (url.pathname.endsWith("/speech") && request.method() === "POST") {
      const answer = await page.evaluate(async (sdp) => {
        const receiver = new RTCPeerConnection();
        window.__speechReceiver = receiver;
        receiver.ontrack = (event) => { window.__receivedSpeechTrack = event.track; };
        receiver.ondatachannel = (event) => { window.__speechChannel = event.channel; };
        await receiver.setRemoteDescription({ type: "offer", sdp });
        await receiver.setLocalDescription(await receiver.createAnswer());
        if (receiver.iceGatheringState !== "complete") await new Promise((resolve) => {
          receiver.addEventListener("icegatheringstatechange", () => { if (receiver.iceGatheringState === "complete") resolve(); });
        });
        return receiver.localDescription.sdp;
      }, body.sdp);
      return json({ sdp: answer, connectionId: "11111111-1111-4111-8111-111111111111", expiresAt: new Date(Date.now() + 590000).toISOString() });
    }
    if (url.pathname.endsWith("/speech") && request.method() === "DELETE") {
      await page.evaluate(() => { window.__speechReceiver?.close(); });
      return json({ success: true });
    }
    if (url.pathname.endsWith("/turns") && requiresConfirmation && body.confirmation !== true) return json({ code: "MATT_CONFIRMATION_REQUIRED", error: "Review and approve the estimate.", estimatedIntelligence: 75 }, 409);
    if (url.pathname.endsWith("/turns")) return json({ turnId: `turn-${requests.length}`, assistant: {
      answer: `Synthetic generated answer to: ${body.question}`, established: true, source: "ai_gateway", findings: [],
      evidence: [{ id: "evidence-one", excerpt: "The aircraft shall be returned airworthy.", source_locator: "Synthetic clause 22" }],
    } });
    if (url.pathname.endsWith("/interrupt") || request.method() === "DELETE") return json({ success: true });
    return json({ error: "Unexpected synthetic endpoint" }, 404);
  });
  await page.goto(`${origin}${demo ? `/demo/matt?${flightId ? `flight=${flightId}` : "contract=demo-aircraft-lease"}` : "/app/matt?contract=lease-one"}`);
  const decline = page.getByRole("button", { name: "Decline", exact: true });
  if (await decline.count()) await decline.click();
  await page.getByRole("button", { name: "Skip introduction", exact: true }).click();
  if (!connect) return { page, context, requests, errors };
  await page.getByRole("checkbox", { name: demo ? /I approve sending my non-confidential questions/ : /I am authorized to send questions/ }).check();
  await page.getByRole("button", { name: "Connect live Matt", exact: true }).click();
  return { page, context, requests, errors };
}
async function allowBrowserSpeech(page) {
  await page.getByText("Voice and privacy settings", { exact: true }).click();
  await page.getByRole("checkbox", { name: "I permit browser speech services for this visit", exact: true }).check();
}
for (const boundary of ["membership", "permission"]) {
  test(`actual SaaS UI and HTTP server clear displayed answers/reports after ${boundary} revocation, reject replay and isolate restored/switching sessions`, async () => {
    const orgA = "10000000-0000-4000-8000-000000000101", orgB = "10000000-0000-4000-8000-000000000202";
    const canaries = { [orgA]: "ALPINE-UI-LEASE-731904-USD-PRIVATE", [orgB]: "BALTIC-UI-LEASE-918273-EUR-PRIVATE" };
    const analysisRunId = "30000000-0000-4000-8000-000000000101";
    const f = await fixture({ connect: false, organizationId: orgA, secondOrganizationId: orgB, analysisRunId });
    let revoked = false, clock = Date.now(), counter = 0;
    const created = new Map(), ended = new Set(), inputs = [], responses = [], logs = [];
    const service = createMattLiveService({
      now: () => clock, configuration: () => ({ enabled: true, missing: [] }), allowedOrganization: (id) => Boolean(canaries[id]),
      provider: {
        async create() { const conversationId = `ui-room-${++counter}`; return { conversationId, url: `https://tavus.daily.co/${conversationId}`, token: "scoped-token" }; },
        async end(id) { ended.add(id); },
      },
      generateAnswer: createMattAnswerService({
        readContext: async ({ organizationId }) => ({ evidence: [{ id: `source:${organizationId}`, excerpt: canaries[organizationId] }] }),
        gateway: { async request(request) {
          const input = JSON.parse(request.input); inputs.push(input);
          return { success: true, result: { answer: input.context.evidence[0].excerpt, established: true, evidence_ids: [input.context.evidence[0].id] } };
        } },
      }),
    });
    const create = service.create;
    service.create = async (input) => { const result = await create(input); created.set(result.id, { ...input, id: result.id, conversationId: result.conversationId }); return result; };
    const app = express(); app.use(express.json());
    app.use("/api/matt", createMattLiveRouter({
      service,
      authenticate: createUserAuthMiddleware(async (token) => {
        const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
        if (claims.sub !== "00000000-0000-4000-8000-000000000001") throw new Error("Unknown synthetic principal");
        return { id: claims.sub };
      }),
      membership: createOrganizationMiddleware(async (_sql, [organizationId]) => ({
        rows: !canaries[organizationId] || (revoked && boundary === "membership") ? []
          : [{ id: organizationId, name: "Synthetic approved account", role: revoked ? "revoked" : "admin" }],
      })),
      logger: { error(...args) { logs.push(args); } },
    }));
    const backend = createServer(app);
    await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
    await f.context.route(/\/api\/matt(?:\/|$)/, async (route) => {
      const request = route.request(), path = new URL(request.url()).pathname;
      const response = await route.fetch({ url: `http://127.0.0.1:${backend.address().port}${path}`, headers: request.headers() });
      responses.push({ path, status: response.status() });
      await route.fulfill({ response });
    });
    const connect = async () => {
      await f.page.getByRole("button", { name: /^(Mute Matt audio|Connect live Matt)$/ }).first().waitFor();
      if (await f.page.getByRole("button", { name: "Mute Matt audio", exact: true }).count()) return [...created.values()].at(-1);
      await f.page.getByRole("checkbox", { name: /I am authorized to send questions/ }).check();
      await f.page.getByRole("button", { name: "Connect live Matt", exact: true }).click();
      await f.page.getByRole("button", { name: "Mute Matt audio", exact: true }).waitFor();
      return [...created.values()].at(-1);
    };
    const ask = async () => {
      const completed = f.page.waitForResponse((response) => response.url().endsWith("/turns") && response.request().method() === "POST" && response.status() === 200);
      await f.page.getByRole("button", { name: "What are the key obligations?", exact: true }).click();
      await completed;
      await f.page.locator(".matt-report > article").waitFor();
    };
    const replay = (id, organizationId = orgA) => f.page.evaluate(async ({ id, organizationId }) => {
      const session = JSON.parse(localStorage.getItem("sb-127-auth-token"));
      const response = await fetch(`/api/matt/sessions/${id}/turns`, { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, "x-org-id": organizationId },
        body: JSON.stringify({ analysisRunId: "30000000-0000-4000-8000-000000000101", question: "Can this old session be reused?" }) });
      return { status: response.status, text: await response.text() };
    }, { id, organizationId });
    try {
      const first = await connect();
      await ask();
      await f.page.getByRole("checkbox", { name: "Show response text", exact: true }).check();
      assert.equal(await f.page.locator(".matt-answer").innerText(), canaries[orgA]);
      const revokedReport = await f.page.getByRole("link", { name: "OPEN FULL REPORT", exact: true }).getAttribute("href");
      await f.page.getByRole("link", { name: "OPEN FULL REPORT", exact: true }).click();
      await f.page.locator(".matt-full-report").waitFor();
      assert.ok((await f.page.locator(".matt-full-report").innerText()).includes(canaries[orgA]));
      await f.page.getByRole("link", { name: "Return to Matt and conversation", exact: true }).click();
      // Use the active room if report navigation retained it, otherwise reconnect deliberately.
      const activeBeforeRevocation = await connect();
      await ask();
      const beforeRevocationCalls = inputs.length;
      assert.ok(!JSON.stringify(inputs.at(-1)).includes(canaries[orgB]));
      await f.page.waitForFunction(() => window.__daily.sent.some((item) => item.event_type === "conversation.echo"));
      revoked = true;
      await f.page.getByRole("button", { name: "What are the key obligations?", exact: true }).click();
      await f.page.waitForFunction(() => window.__daily.destroyed);
      assert.ok(responses.some((item) => /\/(?:turns|interrupt)$/.test(item.path) && item.status === 403));
      assert.ok(ended.has(activeBeforeRevocation.conversationId));
      assert.equal(inputs.length, beforeRevocationCalls, "Denied request cannot reach the answer generator");
      assert.equal(await f.page.locator(".matt-answer, .matt-report article").count(), 0);
      assert.ok(!(await f.page.locator("body").innerText()).includes(canaries[orgA]));
      await f.page.goBack();
      await f.page.locator(".matt-full-report").waitFor();
      assert.equal(new URL(f.page.url()).pathname, new URL(revokedReport, origin).pathname);
      assert.equal(await f.page.locator(".matt-full-report article").count(), 0);
      assert.ok(!(await f.page.locator("body").innerText()).includes(canaries[orgA]));
      await f.page.getByRole("link", { name: "Return to Matt and conversation", exact: true }).click();
      revoked = false;
      assert.equal((await replay(first.id)).status, 404);
      assert.equal((await replay(activeBeforeRevocation.id)).status, 404);
      const second = await connect();
      assert.notEqual(second.id, first.id);
      await ask();
      assert.deepEqual(inputs.at(-1).history, []);
      clock += 600001;
      assert.equal((await replay(second.id)).status, 409);
      await f.page.getByRole("button", { name: "What are the key obligations?", exact: true }).click();
      await f.page.waitForFunction(() => window.__daily.destroyed);
      assert.equal(await f.page.locator(".matt-report article").count(), 0);
      const third = await connect();
      assert.notEqual(third.id, second.id);
      await ask();
      const report = await f.page.getByRole("link", { name: "OPEN FULL REPORT", exact: true }).getAttribute("href");
      await f.page.getByRole("button", { name: "Disconnect live Matt", exact: true }).click();
      await f.page.waitForFunction(() => window.__daily.destroyed);
      await f.page.goto(`${origin}/demo/dashboard`);
      assert.ok(!(await f.page.locator("body").innerText()).includes(canaries[orgA]));
      await f.page.evaluate((id) => localStorage.setItem("operion.organizationId", id), orgB);
      await f.page.goto(`${origin}/app/matt?contract=lease-one`);
      await f.page.getByRole("button", { name: "Connect live Matt", exact: true }).waitFor();
      assert.equal((await replay(third.id, orgB)).status, 404);
      await connect(); await ask();
      assert.ok(JSON.stringify(inputs.at(-1)).includes(canaries[orgB]));
      assert.ok(!JSON.stringify(inputs.at(-1)).includes(canaries[orgA]));
      await f.page.goto(`${origin}${report}`);
      await f.page.locator(".matt-full-report").waitFor();
      assert.ok(!(await f.page.locator("body").innerText()).includes(canaries[orgA]));
      assert.ok(logs.every((entry) => Object.values(canaries).every((marker) => !JSON.stringify(entry).includes(marker))));
      assert.deepEqual(f.errors, []);
    } catch (error) {
      console.error("Synthetic UI integration diagnostics", JSON.stringify({ responses, logs, body: await f.page.locator("body").innerText() }));
      throw error;
    } finally {
      revoked = false;
      await f.context.close();
      for (const input of created.values()) await service.revoke(input);
      backend.closeAllConnections();
      await new Promise((resolve) => backend.close(resolve));
    }
  });
}
test("native browser HTTP enforces tenant, token, provider-session and Demo boundaries, including pending-turn revocation", async () => {
  const f = await fixture({ demo: true, connect: false });
  const tenants = [
    { org: "10000000-0000-4000-8000-000000000101", user: "20000000-0000-4000-8000-000000000101", token: "offline-a", run: "30000000-0000-4000-8000-000000000101", canary: "ALPINE-PRIVATE-731904-CLAUSE-SUPPLIER-AOG" },
    { org: "10000000-0000-4000-8000-000000000202", user: "20000000-0000-4000-8000-000000000202", token: "offline-b", run: "30000000-0000-4000-8000-000000000202", canary: "BALTIC-PRIVATE-918273-CLAUSE-SUPPLIER-ENGINE" },
  ];
  for (const [index, tenant] of tenants.entries()) tenant.canaries = {
    company: index ? "BALTIC-FICTIONAL-OWNER" : "ALPINE-FICTIONAL-LESSOR",
    contract: index ? "LEASE-BALTIC-202" : "LEASE-ALPINE-101",
    amount: index ? "EUR 918273" : "USD 731904",
    clause: tenant.canary,
    supplier: index ? "BALTIC-SYNTHETIC-MRO" : "ALPINE-SYNTHETIC-MRO",
    operational: index ? "BALTIC-ENGINE-RETURN-FINDING" : "ALPINE-AOG-RETURN-FINDING",
  };
  const inputs = [], creates = [], ended = [], active = new Map(), logs = [];
  let expired = false, revoked = false, revision = 0, release, entered;
  const started = new Promise((resolve) => { entered = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  const gateway = createAIGateway({ providers: { offline: { name: "offline", model: "fixture", async generate(request) {
    const input = JSON.parse(request.input); inputs.push(input);
    if (input.question === "Hold for revocation") { entered(); await gate; }
    return { output: { answer: input.context.evidence[0].excerpt, established: true, evidence_ids: [input.context.evidence[0].id] } };
  } } } });
  for (const t of tenants) await gateway.setBudget(t.org, { allocated: 2000 });
  await gateway.setBudget(MATT_DEMO_ORGANIZATION_ID, { allocated: 2000 });
  const config = { enabled: true, missing: [], origins: [origin], maxSessions: 6, intelligenceBudget: 2000 };
  const makeService = (demo) => {
    const service = createMattLiveService({
      configuration: () => config, allowedOrganization: (id) => demo ? id === MATT_DEMO_ORGANIZATION_ID : tenants.some((t) => t.org === id),
      provider: { async create() { const room = `${demo ? "demo" : "saas"}-room-${creates.length}`; creates.push(room); return { conversationId: room, url: "https://tavus.daily.co/offline", token: "offline-room-token" }; }, async end(id) { ended.push(id); } },
      generateAnswer: createMattAnswerService({ readContext: demo ? readMattDemoContext : async ({ organizationId, analysisRunId }) => {
        const t = tenants.find((item) => item.org === organizationId);
        if (analysisRunId && analysisRunId !== t.run) throw Object.assign(new Error("Analysis run not found"), { code: "ANALYSIS_RUN_NOT_FOUND", status: 404 });
        return { evidence: [{ id: `source-${t.user}`, excerpt: `${Object.values(t.canaries).join("; ")} revision ${revision}` }], clauses: [], obligations: [], deadlines: [], risks: [] };
      }, gateway: { request: (request) => gateway.request({ ...request, provider: "offline" }) } }),
      logger: { error(...args) { logs.push(args); } },
    });
    const create = service.create, end = service.end, revoke = service.revoke;
    service.create = async (input) => { const result = await create(input); active.set(result.id, { service, ...input, id: result.id }); return result; };
    service.end = async (input) => { await end(input); active.delete(input.id); };
    service.revoke = async (input) => {
      await revoke(input);
      for (const [id, entry] of active) if (entry.service === service && entry.organizationId === input.organizationId && entry.userId === input.userId) active.delete(id);
    };
    return service;
  };
  const saas = makeService(false), demo = makeService(true);
  const app = express(); app.use(express.json());
  app.use("/api/matt", createMattLiveRouter({ service: saas,
    authenticate: createUserAuthMiddleware(async (token) => {
      const t = tenants.find((item) => item.token === token);
      if (!t || expired) throw new Error("Expired fictional token");
      return { id: t.user };
    }),
    membership: createOrganizationMiddleware(async (_sql, [org, user]) => ({
      rows: !revoked && tenants.some((t) => t.user === user) && tenants.some((t) => t.org === org)
        ? [{ id: org, name: "Fictional account", role: "admin" }] : [],
    })), logger: { error(...args) { logs.push(args); } },
  }));
  app.use("/api/demo/matt", createMattDemoRouter({ service: demo, configuration: () => config, logger: { error(...args) { logs.push(args); } } }));
  const backend = createServer(app);
  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  await f.context.route(/\/api\/(?:demo\/)?matt(?:\/|$)/, async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const response = await route.fetch({ url: `http://127.0.0.1:${backend.address().port}${path}`, headers: { ...request.headers(), origin } });
    await route.fulfill({ response });
  });
  const call = (path, body, t = tenants[0], headers = {}) => f.page.evaluate(async ({ path, body, token, org, headers }) => {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}`, "x-org-id": org } : {}), ...headers }, body: JSON.stringify(body) });
    return { status: response.status, text: await response.text() };
  }, { path, body, token: t?.token, org: t?.org, headers });
  try {
    const sessions = [];
    for (const t of tenants) {
      const created = await call("/api/matt/sessions", { consent: true }, t);
      assert.equal(created.status, 200, created.text);
      sessions.push(JSON.parse(created.text));
    }
    for (const [index, t] of tenants.entries()) {
      const other = tenants[1 - index], session = sessions[index];
      const turn = { contextMode: "account", question: "Show my evidence", confirmation: true };
      for (let repeat = 0; repeat < 2; repeat++) {
        const result = await call(`/api/matt/sessions/${session.id}/turns`, { ...turn, organizationId: other.org }, t);
        assert.equal(result.status, 200);
        for (const marker of Object.values(t.canaries)) assert.ok(result.text.includes(marker));
        for (const marker of Object.values(other.canaries)) {
          assert.ok(!result.text.includes(marker));
          assert.ok(!JSON.stringify(inputs.at(-1)).includes(marker));
        }
      }
      const count = inputs.length;
      for (const id of [sessions[1 - index].id, sessions[1 - index].conversationId, session.conversationId]) {
        assert.equal((await call(`/api/matt/sessions/${id}/turns`, turn, t)).status, 404);
      }
      assert.equal((await call(`/api/matt/sessions/${session.id}/turns`, turn, { ...t, org: other.org })).status, 404, "Switching to another valid membership cannot reuse the old room");
      assert.equal((await call(`/api/matt/sessions/${session.id}/turns`, { analysisRunId: other.run, question: "Read a foreign run", confirmation: true }, t)).status, 404);
      assert.equal(inputs.length, count, "Rejected identifiers never reach the injected model");
    }
    revision++;
    const fresh = await call(`/api/matt/sessions/${sessions[0].id}/turns`, { contextMode: "account", question: "Show my evidence", confirmation: true });
    assert.match(fresh.text, /revision 1/, "Account source retrieval is fresh even for a repeated question");
    const access = await call("/api/demo/matt/access", { consent: true }, null);
    const capability = JSON.parse(access.text).token;
    const demoHeaders = { "X-Matt-Demo-Token": capability };
    const demoSession = JSON.parse((await call("/api/demo/matt/sessions", { consent: true }, null, demoHeaders)).text);
    for (const id of [sessions[0].id, sessions[0].conversationId]) assert.equal((await call(`/api/demo/matt/sessions/${id}/turns`, { question: "Read SaaS" }, null, demoHeaders)).status, 404);
    assert.equal((await call(`/api/matt/sessions/${demoSession.id}/turns`, { contextMode: "account", question: "Read Demo" })).status, 404);
    assert.equal((await call(`/api/matt/sessions/${demoSession.id}/turns`, { question: "Use Demo token" }, null, demoHeaders)).status, 401);
    assert.equal((await call("/api/demo/matt/access", { consent: true })).status, 403);
    const demoTurn = await call(`/api/demo/matt/sessions/${demoSession.id}/turns`, { analysisRunId: "ac-demo-001", question: "Show this flight source", confirmation: true }, null, demoHeaders);
    assert.equal(demoTurn.status, 200);
    assert.ok(tenants.every((t) => Object.values(t.canaries).every((marker) => !JSON.stringify(inputs.at(-1)).includes(marker))));
    expired = true;
    const count = inputs.length;
    assert.equal((await call(`/api/matt/sessions/${sessions[0].id}/turns`, { contextMode: "account", question: "Expired access" })).status, 401);
    assert.equal(inputs.length, count);
    expired = false;
    const pending = call(`/api/matt/sessions/${sessions[0].id}/turns`, { contextMode: "account", question: "Hold for revocation", confirmation: true });
    await started; revoked = true; release();
    const denied = await pending;
    assert.equal(denied.status, 403);
    assert.ok(!denied.text.includes(tenants[0].canary));
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(ended.includes(sessions[0].conversationId));
    assert.ok(!active.has(sessions[0].id));
    revoked = false;
    const reconnect = await call("/api/matt/sessions", { consent: true });
    assert.equal(reconnect.status, 200);
    const restored = JSON.parse(reconnect.text);
    assert.notEqual(restored.id, sessions[0].id);
    assert.equal((await call(`/api/matt/sessions/${sessions[0].id}/turns`, { contextMode: "account", question: "Reuse stale room" })).status, 404);
    assert.equal((await call(`/api/matt/sessions/${restored.id}/turns`, { contextMode: "account", question: "Fresh conversation", confirmation: true })).status, 200);
    assert.deepEqual(inputs.at(-1).history, []);
    revoked = true;
    const beforeDenial = inputs.length;
    assert.equal((await call(`/api/matt/sessions/${restored.id}/turns`, { contextMode: "account", question: "New request after revocation" })).status, 403);
    assert.equal(inputs.length, beforeDenial);
    assert.ok(ended.includes(restored.conversationId));
    assert.ok(!ended.includes(sessions[1].conversationId), "Revocation must not terminate another tenant's room");
    revoked = false;
    assert.equal((await call(`/api/matt/sessions/${restored.id}/turns`, { contextMode: "account", question: "Restored access cannot revive history" })).status, 404);
    assert.equal(inputs.length, beforeDenial);
    assert.ok(logs.every((entry) => tenants.every((t) => Object.values(t.canaries).every((marker) => !JSON.stringify(entry).includes(marker)))));
    assert.deepEqual(f.errors, []);
  } finally {
    release();
    await f.context.close();
    for (const { service, ...input } of active.values()) await service.end(input);
    backend.closeAllConnections();
    await new Promise((resolve) => backend.close(resolve));
  }
});
for (const demo of [false, true]) {
  test(`${demo ? "Demo" : "SaaS"} account/guide questions use the same live transport without claiming a selected contract`, async () => {
    const f = await fixture({ demo, connect: false });
    try {
      for (const contextMode of ["account", "platform"]) {
        await f.page.getByRole("combobox", { name: "Question scope", exact: true }).selectOption(contextMode);
        await f.page.getByRole("checkbox", { name: demo ? /I approve sending my non-confidential questions/ : /I am authorized to send questions/ }).check();
        await f.page.getByRole("button", { name: "Connect live Matt", exact: true }).click();
        await f.page.getByRole("button", { name: "Mute Matt audio", exact: true }).waitFor();
        if (!await f.page.getByRole("textbox", { name: "Ask Matt", exact: true }).isVisible()) await f.page.getByRole("button", { name: "Type a question", exact: true }).click();
        await f.page.getByRole("textbox", { name: "Ask Matt", exact: true }).fill(contextMode === "account" ? "Which leases are available to my account?" : "What is OCI?");
        await f.page.getByRole("button", { name: "Send", exact: true }).click();
        await f.page.waitForFunction(() => document.querySelector(".matt-page")?.dataset.state === "PRESENTING");
        const request = f.requests.filter((item) => item.path.endsWith("/turns")).at(-1);
        assert.equal(request.body.contextMode, contextMode);
        assert.equal(request.body.analysisRunId, undefined);
        assert.equal(request.body.pageId, "matt");
        assert.equal(request.hasDemoToken, demo);
        assert.equal(request.hasAuth, !demo);
        const disconnect = f.page.getByRole("button", { name: "Disconnect live Matt", exact: true });
        assert.equal(await disconnect.count(), 1, JSON.stringify({
          contextMode, errors: await f.page.locator(".matt-error").allTextContents(),
          environment: await f.page.locator(".matt-environment").innerText(),
          state: await f.page.locator(".matt-page").getAttribute("data-state"),
          requests: f.requests.filter((item) => item.path.includes("/matt/")),
        }));
        await disconnect.click();
      }
      assert.deepEqual(f.errors, []);
    } finally { await f.context.close(); }
  });
}
test("idle expiration visibly disconnects generated media and terminates the browser session", async () => {
  const f = await fixture({ idleTimeoutMs: 1200 });
  try {
    await f.page.getByText("Matt disconnected after inactivity or the session time limit. Reconnect with authorization to continue.", { exact: true }).waitFor();
    assert.equal(await f.page.evaluate(() => window.__daily.destroyed), true);
    assert.equal(await f.page.locator(".matt-character video[src]").count(), 0);
    assert.ok(f.requests.some((item) => item.method === "DELETE" && item.path === "/api/matt/sessions/session-one"));
  } finally { await f.context.close(); }
});
test("native device API capture begins only on click; LISTENING waits for captured-track recognition", async () => {
  const f = await fixture({ manualTranscript: true, delayCapture: true });
  try {
    assert.equal(await f.page.evaluate(() => window.__captureCalls), 0);
    await allowBrowserSpeech(f.page);
    await f.page.getByRole("button", { name: "Microphone", exact: true }).click();
    await f.page.waitForFunction(() => window.__releaseCapture);
    assert.equal(await f.page.locator("[data-microphone-state]").getAttribute("data-microphone-state"), "REQUESTING");
    assert.notEqual(await f.page.locator(".matt-page").getAttribute("data-state"), "LISTENING");
    await f.page.evaluate(() => window.__releaseCapture());
    await f.page.getByRole("button", { name: "Stop microphone", exact: true }).waitFor();
    assert.equal(await f.page.evaluate(() => window.__recognizedTrack === window.__capturedTracks[0] && window.__recognizedTrack.readyState === "live"), true);
    await f.page.getByRole("button", { name: "Stop microphone", exact: true }).click();
    assert.equal(await f.page.evaluate(() => window.__capturedTracks.every((track) => track.readyState === "ended")), true);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
for (const [captureFailure, state] of [["NotAllowedError", "DENIED"], ["NotFoundError", "DEVICE_NOT_FOUND"], ["NotReadableError", "DEVICE_BUSY"]]) {
  test(`microphone ${state} is visible and retry acquires a real browser track`, async () => {
    const f = await fixture({ captureFailure, manualTranscript: true });
    try {
      await allowBrowserSpeech(f.page);
      await f.page.getByRole("button", { name: "Microphone", exact: true }).click();
      await f.page.locator(`[data-microphone-state="${state}"]`).waitFor();
      assert.equal(await f.page.evaluate(() => Boolean(window.__recognizedTrack)), false);
      await f.page.evaluate(() => { window.__captureFailure = null; });
      await f.page.getByRole("button", { name: "Microphone", exact: true }).click();
      await f.page.getByRole("button", { name: "Stop microphone", exact: true }).waitFor();
      assert.equal(await f.page.evaluate(() => window.__captureCalls), 2);
      await f.page.getByRole("button", { name: "Disconnect live Matt", exact: true }).click();
      await f.page.waitForFunction(() => window.__daily.destroyed);
      assert.equal(await f.page.evaluate(() => window.__capturedTracks.every((track) => track.readyState === "ended")), true);
      assert.deepEqual(f.errors, []);
    } finally { await f.context.close(); }
  });
}
test("blocked audio is recoverable without room teardown; follow-up, mute and interruption retain the output lifecycle", async () => {
  const f = await fixture({ blockAudio: true });
  try {
    await f.page.getByRole("alert").filter({ hasText: /browser blocked live audio/ }).waitFor();
    assert.equal(await f.page.evaluate(() => window.__daily.destroyed), false);
    await f.page.evaluate(() => { window.__blockAudio = false; });
    await f.page.getByRole("button", { name: "Enable Matt audio", exact: true }).click();
    await f.page.getByRole("button", { name: "Mute Matt audio", exact: true }).waitFor();
    await f.page.getByRole("button", { name: "What are the key obligations?", exact: true }).click();
    await f.page.waitForFunction(() => document.querySelector(".matt-environment").dataset.state === "SPEAKING");
    assert.equal(await f.page.locator(".matt-character video").evaluate((video) => !video.paused && !video.muted && video.volume === 1), true);
    const syntheticSignal = await f.page.locator(".matt-character video").evaluate(async (video) => {
      const context = new AudioContext();
      await context.resume();
      const source = context.createMediaStreamSource(video.srcObject), analyser = context.createAnalyser(), silentSink = context.createGain();
      silentSink.gain.value = 0;
      source.connect(analyser); analyser.connect(silentSink); silentSink.connect(context.destination);
      const samples = new Float32Array(analyser.fftSize);
      let nonSilent = false;
      for (let attempt = 0; attempt < 50 && !nonSilent; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        analyser.getFloatTimeDomainData(samples);
        nonSilent = samples.some((sample) => Math.abs(sample) > 0.001);
      }
      source.disconnect(); await context.close();
      return nonSilent;
    });
    assert.equal(syntheticSignal, true, "A non-silent synthetic tone reaches the attached remote track; this does not verify physical speaker output or provider speech");
    await f.page.getByRole("button", { name: "Mute Matt audio", exact: true }).click();
    await f.page.getByRole("button", { name: "Review the maintenance risks", exact: true }).click();
    await f.page.waitForFunction(() => window.__daily.sent.filter((message) => message.event_type === "conversation.echo").length === 2);
    assert.equal(await f.page.locator(".matt-character video").evaluate((video) => video.muted), true);
    assert.notEqual(await f.page.locator(".matt-environment").getAttribute("data-state"), "SPEAKING");
    await f.page.getByRole("button", { name: "Enable Matt audio", exact: true }).click();
    await f.page.getByRole("button", { name: "Interrupt / stop", exact: true }).click();
    assert.equal(await f.page.locator(".matt-character video").evaluate((video) => video.muted && video.paused), true);
    assert.equal(f.requests.filter((item) => item.path === "/api/matt/sessions").length, 1);
    assert.equal(await f.page.evaluate(() => window.__speechOutputs), 0);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
test("track replacement cannot undo mute or interruption and a later answer resumes only intended playback", async () => {
  const f = await fixture();
  try {
    await f.page.getByRole("button", { name: "Mute Matt audio", exact: true }).waitFor();
    await f.page.getByRole("button", { name: "Mute Matt audio", exact: true }).click();
    await f.page.evaluate(() => window.__dailyReplaceTracks());
    assert.equal(await f.page.locator(".matt-character video").evaluate((video) => video.muted), true);
    await f.page.evaluate(() => window.__dailyNetwork("interrupted"));
    await f.page.waitForFunction(() => document.querySelector(".matt-environment").dataset.state === "RECONNECTING");
    await f.page.evaluate(() => window.__dailyNetwork("connected"));
    await f.page.waitForFunction(() => document.querySelector(".matt-environment").dataset.state === "READY");
    assert.equal(await f.page.locator(".matt-character video").evaluate((video) => video.muted && !video.paused), true);
    await f.page.getByRole("button", { name: "Enable Matt audio", exact: true }).click();
    await f.page.getByRole("button", { name: "What are the key obligations?", exact: true }).click();
    await f.page.waitForFunction(() => document.querySelector(".matt-environment").dataset.state === "SPEAKING");
    await f.page.getByRole("button", { name: "Interrupt / stop", exact: true }).click();
    await f.page.evaluate(() => window.__dailyReplaceTracks());
    assert.equal(await f.page.locator(".matt-character video").evaluate((video) => video.muted && video.paused), true);
    await f.page.getByRole("button", { name: "Review the maintenance risks", exact: true }).click();
    await f.page.waitForFunction(() => document.querySelector(".matt-environment").dataset.state === "SPEAKING");
    assert.equal(await f.page.locator(".matt-character video").evaluate((video) => !video.muted && !video.paused), true);
    await f.page.evaluate(() => window.__dailyNetwork("interrupted"));
    await f.page.waitForFunction(() => document.querySelector(".matt-environment").dataset.state === "RECONNECTING");
    assert.equal(await f.page.locator(".matt-character video").evaluate((video) => video.muted && video.paused), true);
    await f.page.evaluate(() => window.__dailyNetwork("connected"));
    await f.page.waitForFunction(() => document.querySelector(".matt-environment").dataset.state === "SPEAKING");
    assert.equal(await f.page.locator(".matt-character video").evaluate((video) => !video.muted && !video.paused), true);
    assert.equal(f.requests.filter((item) => item.path === "/api/matt/sessions").length, 1);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
test("interrupt while native capture is pending never leaves a late-granted microphone running", async () => {
  const f = await fixture({ manualTranscript: true, delayCapture: true });
  try {
    await allowBrowserSpeech(f.page);
    await f.page.getByRole("button", { name: "Microphone", exact: true }).click();
    await f.page.waitForFunction(() => window.__releaseCapture);
    await f.page.getByRole("button", { name: "Interrupt / stop", exact: true }).click();
    await f.page.evaluate(() => window.__releaseCapture());
    await f.page.waitForFunction(() => window.__capturedTracks.every((track) => track.readyState === "ended"));
    assert.equal(await f.page.evaluate(() => Boolean(window.__recognizedTrack)), false);
    assert.notEqual(await f.page.locator(".matt-environment").getAttribute("data-state"), "LISTENING");
    assert.equal(await f.page.getByRole("button", { name: "Microphone", exact: true }).isEnabled(), true);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
for (const width of [320, 390, 1440]) {
  test(`live consent panel and connection control remain usable at ${width}px`, async () => {
    const f = await fixture({ width, connect: false });
    try {
      const panel = f.page.locator(".matt-live-unavailable");
      assert.equal(await panel.evaluate((element) => {
        element.scrollTop = 0;
        const bounds = element.getBoundingClientRect();
        return element.scrollWidth <= element.clientWidth + 1
          && element.querySelector("h2").getBoundingClientRect().top >= bounds.top;
      }), true, "The heading and all connection content must remain reachable without horizontal overflow");
      await f.page.getByRole("checkbox", { name: /I am authorized to send questions/ }).check();
      const button = f.page.getByRole("button", { name: "Connect live Matt", exact: true });
      await button.scrollIntoViewIfNeeded();
      assert.equal(await button.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.height >= 44 && bounds.left >= 0 && bounds.right <= innerWidth
          && document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)?.closest("button") === element;
      }), true, "Connect must be an unobstructed touch-size control");
      assert.equal(f.requests.some((request) => request.path === "/api/matt/sessions"), false);
      assert.deepEqual(f.errors, []);
    } finally { await f.context.close(); }
  });
}
for (const width of [390, 1440]) {
  test(`84317 authenticated shared intelligence layout and synthetic live answer at ${width}px`, async () => {
    const f = await fixture({ width });
    try {
      await f.page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
      await f.page.getByRole("button", { name: "Mute Matt audio", exact: true }).waitFor();
      await f.page.evaluate(() => window.scrollTo(0, 0));
      const question = await f.page.locator(".matt-question-panel button").first().boundingBox();
      assert.ok(question.y + question.height <= (width < 600 ? 844 : 900), "Authenticated ready-state suggestions do not require scrolling");
      assert.match(await f.page.locator(".matt-page").evaluate((node) => getComputedStyle(node).fontFamily), /sans-serif/);
      await f.page.getByRole("button", { name: "Type a question", exact: true }).click();
      await f.page.getByRole("textbox", { name: "Ask Matt", exact: true }).fill("Which return condition applies?");
      await f.page.getByRole("button", { name: "Send", exact: true }).click();
      await f.page.locator(".matt-answer").waitFor();
      assert.equal(await f.page.locator(".matt-report > .op-infocard").count(), 1);
      if (width > 1000) {
        const stage = await f.page.locator(".matt-environment").boundingBox(), answer = await f.page.locator(".matt-report").boundingBox();
        assert.ok(answer.x >= stage.x + stage.width, "Authenticated answer uses the same right panel as Demo");
      }
      assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (process.env.MATT_SCREENSHOT_DIR) {
        await mkdir(process.env.MATT_SCREENSHOT_DIR, { recursive: true });
        await f.page.evaluate(() => window.scrollTo(0, 0));
        await f.page.screenshot({ path: path.join(process.env.MATT_SCREENSHOT_DIR, `84317-saas-synthetic-${width}.png`), fullPage: true, animations: "disabled" });
      }
      await f.page.getByRole("button", { name: "Disconnect live Matt", exact: true }).click();
      await f.page.waitForFunction(() => window.__daily.destroyed === true);
      assert.deepEqual(f.errors, []);
    } finally { await f.context.close(); }
  });
}

test("the actual Demo UI crosses the actual local HTTP capability/router/context/gateway chain; only model and avatar output are injected", async () => {
  const f = await fixture({ demo: true, connect: false });
  const inputs = [], http = [], active = new Map();
  let roomEnded = false;
  const gateway = createAIGateway({ providers: { offline: { name: "offline", model: "fixture", async generate(request) {
    const input = JSON.parse(request.input); inputs.push(input);
    return { output: { answer: `Prepared fictional lease: ${input.context.evidence[0].excerpt}`, established: true, evidence_ids: [input.context.evidence[0].id] } };
  } } } });
  gateway.setBudget(MATT_DEMO_ORGANIZATION_ID, { allocated: 1000 });
  const configuration = () => ({ enabled: true, missing: [], origins: [origin], maxSessions: 3, intelligenceBudget: 1000 });
  const service = createMattLiveService({
    provider: { async create() { return { conversationId: "synthetic-room", url: "https://tavus.daily.co/synthetic-room", token: "scoped-token" }; }, async end() { roomEnded = true; } },
    configuration, speechConfiguration: () => ({ provider: "browser", enabled: true, missing: [] }),
    allowedOrganization: (id) => id === MATT_DEMO_ORGANIZATION_ID, maxSessions: 1,
    generateAnswer: createMattAnswerService({ readContext: readMattDemoContext, gateway: { request: (request) => gateway.request({ ...request, provider: "offline" }) } }),
  });
  const create = service.create, end = service.end;
  service.create = async (input) => { const result = await create(input); active.set(result.id, { ...input, id: result.id }); return result; };
  service.end = async (input) => { await end(input); active.delete(input.id); };
  const app = express(); app.use("/api/demo/matt", createMattDemoRouter({ service, configuration, logger: { error() {} } }));
  const backend = createServer(app);
  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const backendOrigin = `http://127.0.0.1:${backend.address().port}`;
  await f.page.route("**/api/demo/matt/**", async (route) => {
    const request = route.request(), url = new URL(request.url());
    const observed = { path: url.pathname, method: request.method(), headers: request.headers() };
    http.push(observed);
    const response = await route.fetch({ url: `${backendOrigin}${url.pathname}${url.search}` });
    observed.status = response.status();
    await route.fulfill({ response });
  });
  try {
    await f.page.getByRole("checkbox", { name: /I approve sending my non-confidential questions/ }).check();
    await f.page.getByRole("button", { name: "Connect live Matt", exact: true }).click();
    await f.page.getByRole("button", { name: "Mute Matt audio", exact: true }).waitFor();
    await allowBrowserSpeech(f.page);
    await f.page.getByRole("button", { name: "Microphone", exact: true }).click();
    await f.page.waitForFunction(() => window.__daily.sent.some((item) => item.event_type === "conversation.echo"));
    assert.equal(inputs.length, 1);
    assert.equal(inputs[0].context.contract.id, "demo-aircraft-lease");
    assert.equal(inputs[0].context.evidence[0].id, "ev-return");
    await f.page.getByRole("button", { name: "Type a question", exact: true }).click();
    await f.page.getByRole("textbox", { name: "Ask Matt", exact: true }).fill("What evidence supports that?");
    await f.page.getByRole("button", { name: "Send", exact: true }).click();
    await f.page.waitForFunction(() => window.__daily.sent.filter((item) => item.event_type === "conversation.echo").length === 2 || document.querySelector(".matt-error")?.textContent);
    assert.equal(await f.page.evaluate(() => window.__daily.sent.filter((item) => item.event_type === "conversation.echo").length), 2,
      JSON.stringify({ requests: http.map(({ path, method, status }) => ({ path, method, status })), error: await f.page.locator(".matt-error").allTextContents() }));
    assert.equal(inputs[1].history.length, 2);
    assert.equal(http.filter((item) => item.path.endsWith("/access")).length, 1);
    assert.ok(http.filter((item) => item.path.includes("/sessions")).every((item) => item.headers["x-matt-demo-token"] && !item.headers.authorization && !item.headers["x-org-id"]));
    await f.page.getByRole("button", { name: "Disconnect live Matt", exact: true }).click();
    await f.page.waitForFunction(() => window.__daily.destroyed);
    assert.equal(roomEnded, true);
    assert.equal(active.size, 0);
    assert.deepEqual(f.errors, []);
  } finally {
    await f.context.close();
    for (const input of active.values()) await service.end(input);
    await new Promise((resolve) => backend.close(resolve));
  }
});
test("synthetic transport exercises actual Matt voice submit, generated response delivery, follow-up, interruption and cleanup", async () => {
  const f = await fixture();
  try {
    await f.page.waitForFunction(() => document.querySelector(".matt-character video")?.srcObject?.getAudioTracks().length === 1);
    await f.page.getByText("Voice and privacy settings", { exact: true }).click();
    await f.page.getByRole("checkbox", { name: "I permit browser speech services for this visit", exact: true }).check();
    await f.page.getByRole("button", { name: "Microphone", exact: true }).click();
    await f.page.waitForFunction(() => window.__daily.sent.some((message) => message.event_type === "conversation.echo"));
    const turn = f.requests.find((item) => item.path.endsWith("/turns"));
    assert.equal(turn.body.question, "Which return condition applies?");
    assert.equal(await f.page.evaluate(() => window.__recognizedTrack instanceof MediaStreamTrack && window.__recognizedTrack.kind === "audio"), true);
    assert.equal(turn.body.analysisRunId, "run-one");
    assert.equal(turn.org, "org-one");
    assert.equal(turn.hasAuth, true);
    const echo = await f.page.evaluate(() => window.__daily.sent.find((message) => message.event_type === "conversation.echo"));
    assert.equal(echo.properties.text, `Synthetic generated answer to: ${turn.body.question}`);
    await f.page.getByRole("checkbox", { name: "Show response text", exact: true }).check();
    await f.page.getByRole("button", { name: "Type a question", exact: true }).click();
    await f.page.getByRole("textbox", { name: "Ask Matt", exact: true }).fill("What does that mean?");
    await f.page.getByRole("button", { name: "Send", exact: true }).click();
    await f.page.waitForFunction(() => window.__daily.sent.filter((message) => message.event_type === "conversation.echo").length === 2);
    assert.equal(f.requests.filter((item) => item.path === "/api/matt/sessions").length, 1);
    assert.equal(await f.page.locator("video source, .matt-character img").count(), 0);
    assert.equal(await f.page.evaluate(() => window.__speechOutputs), 0);
    assert.equal(await f.page.evaluate(() => window.__captureCalls), 1, "Follow-ups do not acquire a second microphone");
    assert.equal(await f.page.evaluate(() => window.__capturedTracks.every((track) => track.readyState === "live" && !track.enabled)), true);
    await f.page.getByRole("button", { name: "Interrupt / stop", exact: true }).click();
    await f.page.waitForFunction(() => window.__daily.sent.some((message) => message.event_type === "conversation.interrupt"));
    assert.equal(await f.page.locator(".matt-character video").evaluate((video) => video.muted), true);
    await f.page.locator('a[href="/app/contracts"]').first().click();
    await f.page.waitForFunction(() => window.__daily.destroyed);
    assert.equal(await f.page.evaluate(() => window.__capturedTracks.every((track) => track.readyState === "ended")), true);
    assert.ok(f.requests.some((item) => item.path === "/api/matt/sessions/session-one" && item.method === "DELETE"));
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
test("not-configured provider is reported without creating a room or restoring introduction footage", async () => {
  const f = await fixture({ configured: false });
  try {
    await f.page.getByText("Synthetic provider configuration missing.", { exact: true }).waitFor();
    assert.equal(f.requests.filter((item) => item.path === "/api/matt/sessions").length, 0);
    assert.equal(await f.page.locator(".matt-character video, .matt-character img").count(), 0);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
test("a revoked turn closes the browser transport without sending the denied answer to Echo", async () => {
  const f = await fixture();
  try {
    await f.page.getByRole("button", { name: "Mute Matt audio", exact: true }).waitFor();
    await f.context.route("**/api/matt/sessions/session-one/turns", (route) => route.fulfill({ status: 403, json: { error: "Membership revoked" } }));
    await f.page.getByRole("button", { name: "What are the key obligations?", exact: true }).click();
    await f.page.waitForFunction(() => window.__daily.destroyed);
    assert.equal(await f.page.evaluate(() => window.__daily.sent.filter((item) => item.event_type === "conversation.echo").length), 0);
    assert.equal(await f.page.locator(".matt-character video").count(), 0);
    assert.ok(f.requests.some((item) => item.method === "DELETE"));
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
test("synthetic provider failure terminates the real UI lifecycle without prerecorded fallback", async () => {
  const f = await fixture();
  try {
    await f.page.waitForFunction(() => document.querySelector(".matt-character video")?.srcObject);
    await f.page.evaluate(() => window.__dailyFail());
    await f.page.getByRole("heading", { name: "Live Matt unavailable" }).waitFor();
    assert.equal(await f.page.locator(".matt-character video, .matt-character img").count(), 0);
    await f.page.waitForFunction(() => window.__daily.destroyed);
    assert.ok(f.requests.some((item) => item.method === "DELETE"));
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

test("the real UI requires explicit generation cost approval and supports consent withdrawal", async () => {
  const f = await fixture({ requiresConfirmation: true });
  try {
    await f.page.waitForFunction(() => document.querySelector(".matt-character video")?.srcObject);
    await f.page.getByRole("button", { name: "What are the key obligations?", exact: true }).click();
    await f.page.getByRole("button", { name: "Approve estimated generation", exact: true }).waitFor();
    assert.equal(await f.page.evaluate(() => window.__daily.sent.filter((message) => message.event_type === "conversation.echo").length), 0);
    await f.page.getByRole("button", { name: "Approve estimated generation", exact: true }).click();
    await f.page.waitForFunction(() => window.__daily.sent.some((message) => message.event_type === "conversation.echo"));
    assert.equal(f.requests.filter((item) => item.path.endsWith("/turns")).at(-1).body.confirmation, true);
    await f.page.getByText("Voice and privacy settings", { exact: true }).click();
    await f.page.getByRole("button", { name: "Disconnect live Matt", exact: true }).click();
    await f.page.waitForFunction(() => window.__daily.destroyed);
    assert.equal(await f.page.locator(".matt-character video").count(), 0);
    assert.equal(await f.page.getByRole("checkbox", { name: /I am authorized to send questions/ }).isChecked(), false);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
for (const demo of [false, true]) {
test(`${demo ? "Demo" : "SaaS"} real-time mode sends actual synthetic microphone RTP to a loopback peer, then routes final speech through Operion and the avatar`, async () => {
  const f = await fixture({ realtime: true, demo });
  try {
    await f.page.getByRole("button", { name: "Mute Matt audio", exact: true }).waitFor();
    assert.equal(await f.page.evaluate(() => window.__captureCalls), 0);
    await f.page.getByText("Voice and privacy settings", { exact: true }).click();
    await f.page.getByRole("checkbox", { name: "I permit the approved real-time audio processor for this visit", exact: true }).check();
    await f.page.getByRole("button", { name: "Microphone", exact: true }).click();
    await f.page.waitForFunction(() => window.__speechChannel?.readyState === "open" && document.querySelector(".matt-environment").dataset.state === "LISTENING");
    assert.equal(await f.page.evaluate(() => window.__receivedSpeechTrack?.readyState), "live");
    assert.equal(await f.page.evaluate(() => Boolean(window.__recognizedTrack)), false, "No browser SpeechRecognition fallback");
    await f.page.evaluate(() => {
      window.__speechChannel.send(JSON.stringify({ type: "input_audio_buffer.speech_started", item_id: "one" }));
      window.__speechChannel.send(JSON.stringify({ type: "conversation.item.input_audio_transcription.completed", item_id: "one", transcript: "Which return condition applies?" }));
    });
    await f.page.waitForFunction(() => document.querySelector(".matt-environment").dataset.state === "SPEAKING");
    assert.ok(f.requests.some((request) => request.path.endsWith("/turns") && request.body.question === "Which return condition applies?" && request.body.analysisRunId === (demo ? "demo-aircraft-lease" : "run-one") && (demo ? request.hasDemoToken && !request.hasAuth && !request.org : request.hasAuth)));
    assert.equal(await f.page.evaluate(() => window.__captureCalls), 1);
    await f.page.evaluate(() => window.__speechChannel.send(JSON.stringify({ type: "input_audio_buffer.speech_started", item_id: "two" })));
    await f.page.waitForFunction(() => document.querySelector(".matt-character video").paused && document.querySelector(".matt-character video").muted);
    await f.page.evaluate(() => window.__speechChannel.send(JSON.stringify({ type: "conversation.item.input_audio_transcription.completed", item_id: "two", transcript: "What evidence supports that?" })));
    await f.page.waitForFunction(() => window.__daily.sent.filter((message) => message.event_type === "conversation.echo").length === 2);
    assert.equal(f.requests.filter((request) => request.path.endsWith("/speech") && request.method === "POST").length, 1);
    assert.equal(await f.page.evaluate(() => window.__capturedTracks[0].enabled), true);
    await f.page.getByRole("checkbox", { name: "I permit the approved real-time audio processor for this visit", exact: true }).uncheck();
    await f.page.waitForFunction(() => window.__capturedTracks.every((track) => track.readyState === "ended"));
    await f.page.waitForFunction(() => window.__speechReceiver.connectionState === "closed");
    assert.equal(await f.page.evaluate(() => window.__speechOutputs), 0);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
}
test("selected but unapproved real-time audio blocks connection rather than falling back to browser speech", async () => {
  const f = await fixture({ realtime: true, speechApproved: false });
  try {
    await f.page.getByText("Real-time microphone processing is blocked pending explicit provider, privacy and spending approvals.", { exact: true }).waitFor();
    assert.equal(f.requests.some((request) => request.path === "/api/matt/sessions"), false);
    assert.equal(await f.page.evaluate(() => window.__captureCalls), 0);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

test("unconfigured Demo exposes the same connect flow and reports provider configuration without creating a session", async () => {
  const f = await fixture({ demo: true, configured: false });
  try {
    await f.page.getByText("Synthetic provider configuration missing.", { exact: true }).waitFor();
    assert.equal(f.requests.some((request) => request.path.endsWith("/sessions") || request.path.endsWith("/access")), false);
    assert.equal(await f.page.evaluate(() => window.__captureCalls), 0);
    assert.equal(await f.page.getByRole("button", { name: "Connect live Matt", exact: true }).isEnabled(), true);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

test("Demo Globe uses captured browser audio and the shared live answer path with only the selected prepared flight ID", async () => {
  const f = await fixture({ demo: true, flightId: "ac-demo-002" });
  try {
    await f.page.getByRole("button", { name: "Mute Matt audio", exact: true }).waitFor();
    await allowBrowserSpeech(f.page);
    await f.page.getByRole("button", { name: "Microphone", exact: true }).click();
    await f.page.waitForFunction(() => window.__daily.sent.some((item) => item.event_type === "conversation.echo"));
    const turn = f.requests.find((item) => item.path.endsWith("/turns"));
    assert.equal(turn.body.analysisRunId, "ac-demo-002");
    assert.equal(turn.hasDemoToken, true);
    assert.equal(turn.hasAuth, false);
    assert.equal(turn.org, undefined);
    assert.equal(await f.page.locator(".matt-page").getAttribute("data-context"), "ac-demo-002");
    assert.equal(await f.page.evaluate(() => window.__recognizedTrack === window.__capturedTracks[0]), true);
    assert.ok(f.requests.some((item) => item.path === "/api/demo/matt/access"));
    assert.equal(f.requests.some((item) => item.path.startsWith("/api/matt/") || item.path.startsWith("/api/contracts")), false);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

for (const width of [320, 390, 1440]) {
  test(`SaaS approved portrait is loaded, circular, accessible and opens the same page's authorized context at ${width}px`, async () => {
    const f = await fixture({ connect: false, width });
    try {
      await f.page.goto(`${origin}/app/dashboard?contract=lease-one`);
      const before = f.page.url(), trigger = f.page.getByRole("button", { name: "Ask Matt", exact: true });
      await trigger.waitFor();
      const image = trigger.locator("img");
      await image.evaluate((element) => element.decode());
      assert.equal(await image.evaluate((element) => {
        const crop = element.parentElement, bounds = crop.getBoundingClientRect(), style = getComputedStyle(crop);
        const button = element.closest("button").getBoundingClientRect();
        return element.complete && element.naturalWidth === 758 && element.naturalHeight === 503
          && element.getAttribute("src") === "/matt/executive-office.jpg" && style.borderRadius === "50%"
          && bounds.width === bounds.height && getComputedStyle(element).objectFit === "cover"
          && button.left >= 0 && button.right <= innerWidth && button.bottom <= innerHeight;
      }), true);
      await trigger.click();
      await f.page.locator(".matt-floating-panel [data-experience='unified-matt'][data-context='lease-one']").waitFor();
      assert.equal(f.page.url(), before);
      assert.deepEqual(f.errors, []);
    } finally { await f.context.close(); }
  });
  test(`Matt's circular identity opens the shared contract/Globe assistant with preserved context at ${width}px`, async () => {
    const f = await fixture({ demo: true, connect: false, width, deviceScaleFactor: width === 320 ? 3 : width === 390 ? 2 : 1 });
    try {
      await f.page.goto(`${origin}/demo/contracts/demo-mro-agreement/overview`);
      const trigger = f.page.getByRole("button", { name: "Ask Matt", exact: true });
      await trigger.waitFor();
      const portrait = trigger.locator(".matt-floating-portrait");
      assert.equal(await portrait.evaluate((element) => {
        const bounds = element.getBoundingClientRect(), image = element.querySelector("img"), style = getComputedStyle(element);
        const button = element.closest("button").getBoundingClientRect();
        return bounds.width === bounds.height && style.borderRadius === "50%" && style.overflow === "hidden"
          && image.complete && image.naturalWidth >= bounds.width * devicePixelRatio && image.src.endsWith("/matt/executive-office.jpg")
          && button.left >= 0 && button.right <= innerWidth && button.top >= 0 && button.bottom <= innerHeight;
      }), true);
      await trigger.focus(); await f.page.keyboard.press("Enter");
      const assistant = f.page.locator(".matt-floating-panel [data-experience='unified-matt']");
      await assistant.waitFor();
      assert.equal(await assistant.getAttribute("data-context"), "demo-mro-agreement");
      await f.page.getByRole("link", { name: "Expand Matt", exact: true }).click();
      await f.page.locator(".matt-page[data-context='demo-mro-agreement']").waitFor();
      await f.page.goto(`${origin}/demo/dashboard`);
      await f.page.getByRole("button", { name: "Ask Matt", exact: true }).waitFor();
      await f.page.evaluate((flight) => window.dispatchEvent(new CustomEvent("operion:assistant", { detail: { flight } })), createDemonstrationScenarios()[1]);
      await f.page.locator(".matt-floating-panel .matt-page[data-context='ac-demo-002']").waitFor();
      assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await f.page.getByRole("link", { name: "Expand Matt", exact: true }).click();
      await f.page.locator(".matt-page[data-context='ac-demo-002']").waitFor();
      assert.deepEqual(f.errors, []);
    } finally { await f.context.close(); }
  });
}
