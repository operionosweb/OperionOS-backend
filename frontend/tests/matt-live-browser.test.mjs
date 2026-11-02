import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";
import { chromium } from "@playwright/test";

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
after(async () => { await browser?.close(); if (server) await new Promise((resolve) => server.httpServer.close(resolve)); });

async function fixture({ configured = true, requiresConfirmation = false, width = 1440, connect = true, captureFailure = null, blockAudio = false, manualTranscript = false, delayCapture = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  const user = { id: "00000000-0000-4000-8000-000000000001", email: "reviewer@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
  const now = Math.floor(Date.now() / 1000);
  const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"), Buffer.from(JSON.stringify({ sub: user.id, exp: now + 3600, role: "authenticated", aal: "aal2" })).toString("base64url"), Buffer.from("offline-signature").toString("base64url")].join(".");
  await context.addInitScript(({ stored, captureFailure, blockAudio, manualTranscript, delayCapture }) => {
    localStorage.setItem("sb-127-auth-token", JSON.stringify(stored));
    localStorage.setItem("operion.organizationId", "org-one");
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
  }, { stored: { access_token: token, refresh_token: "offline-refresh", token_type: "bearer", expires_at: now + 3600, expires_in: 3600, user }, captureFailure, blockAudio, manualTranscript, delayCapture });
  const page = await context.newPage(), requests = [], errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url()), request = route.request();
    const json = (body, status = 200) => route.fulfill({ json: body, status });
    if (url.origin === authOrigin) return url.pathname.endsWith("/user") ? json(user) : route.abort();
    if (url.origin !== origin) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const body = request.postData() ? request.postDataJSON() : null;
    requests.push({ path: url.pathname, method: request.method(), body, org: request.headers()["x-org-id"], hasAuth: Boolean(request.headers().authorization) });
    if (url.pathname === "/api/platform/context") return json({ roles: ["user"], permissions: [] });
    if (url.pathname === "/api/foundation/organizations") return json({ organizations: [{ id: "org-one", name: "Synthetic tenant" }] });
    if (url.pathname === "/api/foundation/context") return json({ organization: { id: "org-one", role: "admin" } });
    if (url.pathname === "/api/contracts") return json({ contracts: [{ id: "lease-one", title: "Synthetic authorized lease" }] });
    if (url.pathname.endsWith("/documents")) return json({ documents: [{ id: "doc-one" }] });
    if (url.pathname.endsWith("/versions")) return json({ versions: [{ analysis_run_id: "run-one" }] });
    if (url.pathname.endsWith("/search")) return json({ results: [] });
    if (url.pathname === "/api/matt/status") return json({ enabled: configured, message: "Synthetic provider configuration missing." });
    if (url.pathname === "/api/matt/sessions") return json({ id: "session-one", conversationId: "synthetic-room", url: "https://tavus.daily.co/synthetic-room", token: "scoped-token" });
    if (url.pathname.endsWith("/turns") && requiresConfirmation && body.confirmation !== true) return json({ code: "MATT_CONFIRMATION_REQUIRED", error: "Review and approve the estimate.", estimatedIntelligence: 75 }, 409);
    if (url.pathname.endsWith("/turns")) return json({ turnId: `turn-${requests.length}`, assistant: {
      answer: `Synthetic generated answer to: ${body.question}`, established: true, source: "ai_gateway", findings: [],
      evidence: [{ id: "evidence-one", excerpt: "The aircraft shall be returned airworthy.", source_locator: "Synthetic clause 22" }],
    } });
    if (url.pathname.endsWith("/interrupt") || request.method() === "DELETE") return json({ success: true });
    return json({ error: "Unexpected synthetic endpoint" }, 404);
  });
  await page.goto(`${origin}/app/matt?contract=lease-one`);
  const decline = page.getByRole("button", { name: "Decline", exact: true });
  if (await decline.count()) await decline.click();
  await page.getByRole("button", { name: "Skip introduction", exact: true }).click();
  if (!connect) return { page, context, requests, errors };
  await page.getByRole("checkbox", { name: /I am authorized to send questions/ }).check();
  await page.getByRole("button", { name: "Connect live Matt", exact: true }).click();
  return { page, context, requests, errors };
}
async function allowBrowserSpeech(page) {
  await page.getByText("Voice and privacy settings", { exact: true }).click();
  await page.getByRole("checkbox", { name: "I permit browser speech services for this visit", exact: true }).check();
}
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
