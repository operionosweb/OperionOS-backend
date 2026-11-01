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
  await build({ root, mode: "matt-offline", logLevel: "error" });
  server = await preview({ root, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); if (server) await new Promise((resolve) => server.httpServer.close(resolve)); });

async function fixture({ authenticated = false, denied = false, width = 1440, reducedMotion = false, mockVoice = false, role = "admin", contextError = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: reducedMotion ? "reduce" : "no-preference" });
  const requests = [], errors = [], media = [];
  const state = { denied, missingAnalysis: false, invalidAnswer: false, delay: 0 };
  if (authenticated) {
    const now = Math.floor(Date.now() / 1000);
    const user = { id: "00000000-0000-4000-8000-000000000001", email: "reviewer@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
    const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: user.id, exp: now + 3600, role: "authenticated", aal: "aal2" })).toString("base64url"), Buffer.from("offline-signature").toString("base64url")].join(".");
    await context.addInitScript(({ stored }) => {
      localStorage.setItem("sb-127-auth-token", JSON.stringify(stored));
      localStorage.setItem("operion.organizationId", "org-one");
    }, { stored: { access_token: token, refresh_token: "offline-refresh", token_type: "bearer", expires_at: now + 3600, expires_in: 3600, user } });
    state.user = user;
  }
  if (mockVoice) await context.addInitScript(() => {
    window.__mattSpeech = { starts: 0, cancels: 0, utterances: [], microphones: 0 };
    class Recognition { start() { window.__mattSpeech.microphones++; this.onstart?.(); this.onerror?.({ error: "not-allowed" }); this.onend?.(); } abort() {} }
    class Utterance { constructor(text) { this.text = text; } }
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: Recognition });
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: Utterance });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { getVoices: () => [{ voiceURI: "offline-local", name: "Offline voice", lang: "en-GB", localService: true }], addEventListener() {}, removeEventListener() {}, speak(utterance) { window.__mattSpeech.utterances.push(utterance); window.__mattSpeech.starts++; utterance.onstart?.(); }, cancel() { window.__mattSpeech.cancels++; } } });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.origin === authOrigin) {
      if (url.pathname.endsWith("/user")) return json(state.user || {}, authenticated ? 200 : 401);
      throw new Error(`Unexpected offline authentication operation: ${url.pathname}`);
    }
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith("/matt/")) media.push(url.pathname);
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const request = route.request();
    requests.push({ path: url.pathname, query: url.searchParams.get("q"), method: request.method(), org: request.headers()["x-org-id"], hasAuth: Boolean(request.headers().authorization), body: request.postData() ? request.postDataJSON() : null });
    if (url.pathname === "/api/platform/context") return json({ roles: ["user"], permissions: [] });
    if (url.pathname === "/api/foundation/organizations") return json({ organizations: [{ id: "org-one", name: "Offline tenant" }] });
    if (url.pathname === "/api/foundation/context") return contextError ? json({ error: "Role verification unavailable" }, 503) : json({ organization: { id: "org-one", role } });
    if (state.denied) return json({ error: "Contract access denied" }, 403);
    if (url.pathname === "/api/contracts") return json({ contracts: [{ id: "lease-one", title: "Offline authorized lease" }, { id: "lease-two", title: "Second authorized lease" }] });
    if (/\/contracts\/[^/]+\/documents$/.test(url.pathname)) return json({ documents: [{ id: url.pathname.includes("lease-two") ? "doc-two" : "doc-one" }] });
    if (/\/documents\/[^/]+\/versions$/.test(url.pathname)) return json({ versions: [{ analysis_run_id: state.missingAnalysis ? null : url.pathname.includes("doc-two") ? "run-two" : "run-one" }] });
    if (/\/analysis-runs\/[^/]+\/search$/.test(url.pathname)) return json({ results: [] });
    if (/\/analysis-runs\/[^/]+\/assistant$/.test(url.pathname)) {
      if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay));
      return json({ assistant: state.invalidAnswer ? {} : { established: true, source: "structured_intelligence", intelligenceConsumption: 0, answer: `Offline evidence response for ${url.pathname.includes("run-two") ? "second" : "first"} lease.`, findings: [{ id: "risk-1", type: "risk", label: "Maintenance records" }, { id: "risk-2", type: "risk", label: "Insurance continuity" }], evidence: [{ id: "evidence-1", excerpt: "The lessee shall maintain aircraft records.", source_locator: "Offline clause 14.3", confidence: 0.94 }] } });
    }
    return json({ error: "Unexpected mocked endpoint" }, 404);
  });
  return { context, page, requests, media, errors, state };
}

test("demo reuses grounded lease evidence, supports follow-ups and rejects unestablished fuel exposure", async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${origin}/demo/matt`);
    await f.page.getByRole("button", { name: "What are the key obligations?", exact: true }).click();
    await f.page.locator(".matt-answer").waitFor();
    assert.ok(await f.page.locator(".matt-findings li").count() > 0);
    await f.page.getByText(/Supporting source evidence \(/).click();
    assert.ok(await f.page.locator(".matt-report blockquote").count() > 0);
    assert.equal(await f.page.locator(".matt-page").getAttribute("data-state"), "SUCCESS");
    const currentHref = f.page.url();
    await f.page.getByRole("button", { name: "Explain the second finding", exact: true }).click();
    await f.page.getByRole("button", { name: "Send", exact: true }).click();
    await f.page.getByText("Conversation (4 messages, this visit only)", { exact: true }).waitFor();
    assert.equal(f.page.url(), currentHref);
    await f.page.getByRole("textbox", { name: "Ask Matt", exact: true }).fill("What is our fuel price exposure?");
    await f.page.getByRole("button", { name: "Send", exact: true }).click();
    await f.page.getByText("Not established. Do not infer that a clause, exposure or obligation exists.", { exact: true }).waitFor();
    assert.equal(await f.page.locator(".matt-findings li").count(), 0);
    assert.equal(f.requests.length, 0, "Demo never queries customer APIs");
    assert.ok(!f.media.includes("/matt/reference.mp4"), "No initial video download");
    assert.deepEqual(f.errors, []);
    await f.page.getByRole("button", { name: "Clear conversation", exact: true }).click();
    assert.equal(await f.page.locator(".matt-answer").count(), 0);
  } finally { await f.context.close(); }
});

for (const width of [320, 390, 768, 1024, 1440, 1920]) {
  test(`Matt is usable without horizontal overflow at ${width}px`, async () => {
    const f = await fixture({ width, reducedMotion: width === 390 });
    try {
      await f.page.goto(`${origin}/demo/matt`);
      await f.page.getByRole("heading", { name: "Let's look at what matters.", exact: true }).waitFor();
      await f.page.getByRole("button", { name: "What are the key obligations?", exact: true }).click();
      await f.page.locator(".matt-answer").waitFor();
      assert.ok(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Page has no horizontal overflow");
      assert.equal(await f.page.locator(".oa-overlay").count(), 0, "No competing assistant overlay");
      assert.ok(await f.page.locator(".matt-character img").evaluate((image) => image.complete && image.naturalWidth > 0));
      if (width === 390) {
        assert.equal(await f.page.locator(".matt-character img").evaluate((image) => getComputedStyle(image).animationName), "none");
        assert.equal(await f.page.getByRole("checkbox", { name: /Enable speaking video/ }).isDisabled(), true);
      }
      assert.deepEqual(f.errors, []);
    } finally { await f.context.close(); }
  });
}

test("authenticated route scopes existing endpoints, supports follow-ups and ignores interrupted results", async () => {
  const f = await fixture({ authenticated: true });
  try {
    await f.page.goto(`${origin}/app/matt?contract=lease-one`);
    await f.page.getByRole("heading", { name: "Let's look at what matters.", exact: true }).waitFor().catch(async () => {
      throw new Error(`Matt entry diagnostic: ${f.page.url()}; ${await f.page.locator("main").innerText()}; requests=${JSON.stringify(f.requests)}; errors=${JSON.stringify(f.errors)}`);
    });
    await f.page.getByRole("combobox", { name: "Contract context" }).selectOption("lease-one");
    await f.page.getByRole("textbox", { name: "Ask Matt", exact: true }).fill("Review maintenance risks");
    await f.page.getByRole("button", { name: "Send", exact: true }).click();
    await f.page.getByText("Offline evidence response for first lease.", { exact: true }).waitFor();
    assert.deepEqual(f.requests.filter((item) => /\/documents|\/versions|\/search|\/assistant/.test(item.path)).map((item) => item.path), ["/api/contracts/lease-one/documents", "/api/documents/doc-one/versions", "/api/analysis-runs/run-one/search", "/api/analysis-runs/run-one/assistant"]);
    assert.ok(f.requests.filter((item) => /^\/api\/(contracts|documents|analysis-runs|foundation\/context)/.test(item.path)).every((item) => item.org === "org-one" && item.hasAuth));
    await f.page.getByRole("button", { name: "Explain the second finding", exact: true }).click();
    await f.page.getByRole("button", { name: "Send", exact: true }).click();
    await f.page.getByText("Conversation (4 messages, this visit only)", { exact: true }).waitFor();
    assert.match(f.requests.filter((item) => item.path.endsWith("/assistant")).at(-1).body.question, /risk: Insurance continuity/);
    f.state.delay = 500;
    await f.page.getByRole("textbox", { name: "Ask Matt", exact: true }).fill("Another maintenance question");
    await f.page.getByRole("button", { name: "Send", exact: true }).click();
    await f.page.waitForRequest("**/run-one/assistant");
    await f.page.getByRole("combobox", { name: "Contract context" }).selectOption("lease-two");
    await f.page.waitForTimeout(600);
    assert.equal(await f.page.locator(".matt-answer").count(), 0, "Late result cannot populate new contract");
    f.state.delay = 0;
    f.state.missingAnalysis = true;
    await f.page.getByRole("textbox", { name: "Ask Matt", exact: true }).fill("Review maintenance risks");
    await f.page.getByRole("button", { name: "Send", exact: true }).click();
    await f.page.getByRole("alert").filter({ hasText: "no analysis run" }).waitFor();
    assert.ok(!f.requests.some((item) => /process|analyze|upload|extract/.test(item.path)));
    f.state.missingAnalysis = false; f.state.invalidAnswer = true;
    await f.page.getByRole("button", { name: "Send", exact: true }).isDisabled();
    await f.page.getByRole("textbox", { name: "Ask Matt", exact: true }).fill("Review the same risk");
    await f.page.getByRole("button", { name: "Send", exact: true }).click();
    await f.page.getByRole("alert").filter({ hasText: "invalid response" }).waitFor();
    f.state.invalidAnswer = false; f.state.denied = true;
    await f.page.getByRole("textbox", { name: "Ask Matt", exact: true }).fill("Review an insurance risk");
    await f.page.getByRole("button", { name: "Send", exact: true }).click();
    await f.page.getByRole("alert").filter({ hasText: "Contract access denied" }).waitFor();
    assert.equal(await f.page.locator(".matt-answer").count(), 0);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

test("unauthenticated Matt route does not request contract data", async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${origin}/app/matt`);
    await f.page.waitForURL("**/login**");
    assert.ok(!f.requests.some((item) => item.path.startsWith("/api/contracts")));
  } finally { await f.context.close(); }
});

test("verified roles without contract permission cannot enter Matt", async () => {
  const f = await fixture({ authenticated: true, role: "unrecognized-role" });
  try {
    await f.page.goto(`${origin}/app/matt`);
    await f.page.waitForURL("**/app/contracts");
    assert.equal(await f.page.locator(".matt-page").count(), 0);
    assert.ok(!f.requests.some((item) => /\/analysis-runs|\/documents/.test(item.path)));
  } finally { await f.context.close(); }
});

test("organization role lookup failures are explicit and cannot request Matt contract data", async () => {
  const f = await fixture({ authenticated: true, contextError: true });
  try {
    await f.page.goto(`${origin}/app/matt`);
    await f.page.getByText("Role verification unavailable", { exact: true }).waitFor();
    assert.equal(await f.page.locator(".matt-page").count(), 0);
    assert.ok(!f.requests.some((item) => item.path.startsWith("/api/contracts")));
  } finally { await f.context.close(); }
});

test("voice is explicit and mocked speaking footage stops immediately on interruption", async () => {
  const f = await fixture({ mockVoice: true });
  try {
    await f.page.goto(`${origin}/demo/matt`);
    await f.page.getByRole("button", { name: "What are the key obligations?", exact: true }).click();
    await f.page.locator(".matt-answer").waitFor();
    await f.page.getByRole("button", { name: "Microphone", exact: true }).click();
    await f.page.getByRole("alert").filter({ hasText: "privacy notice" }).waitFor();
    assert.equal(await f.page.evaluate(() => window.__mattSpeech.microphones), 0);
    await f.page.getByText("Voice and privacy settings", { exact: true }).click();
    await f.page.getByRole("checkbox", { name: "I permit browser speech services for this visit", exact: true }).check();
    await f.page.getByRole("button", { name: "Microphone", exact: true }).click();
    await f.page.getByRole("alert").filter({ hasText: "denied" }).waitFor();
    assert.equal(await f.page.evaluate(() => window.__mattSpeech.microphones), 1);
    await f.page.getByRole("checkbox", { name: /Enable speaking video/ }).check();
    assert.ok(!f.media.includes("/matt/reference.mp4"));
    const motionRequest = f.page.waitForRequest("**/matt/reference.mp4");
    await f.page.getByRole("button", { name: "Read answer", exact: true }).click();
    await f.page.locator(".matt-page[data-state='SPEAKING']").waitFor();
    await motionRequest;
    await f.page.locator(".matt-character video.is-speaking").waitFor();
    await f.page.getByRole("button", { name: "Interrupt / stop speaking", exact: true }).click();
    await f.page.locator(".matt-page[data-state='INTERRUPTED']").waitFor();
    assert.equal(await f.page.locator("video").evaluate((video) => video.paused), true);
    assert.ok(await f.page.evaluate(() => window.__mattSpeech.cancels) > 0);
    assert.equal(await f.page.locator(".matt-answer").count(), 1);
    await f.page.keyboard.press("Tab");
    assert.ok(await f.page.evaluate(() => document.activeElement !== document.body));
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
