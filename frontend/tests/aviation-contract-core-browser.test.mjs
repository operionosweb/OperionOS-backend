import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";
import { chromium } from "@playwright/test";
import { buildAviationContractCore } from "../../domain/contractIntelligence/aviationContractCore.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, ".aviation-core-browser-dist");
const authOrigin = "http://127.0.0.1:59997";
process.env.VITE_SUPABASE_URL = authOrigin;
process.env.VITE_SUPABASE_ANON_KEY = "offline-aviation-core-test";
process.env.VITE_API_BASE_URL = "";
let browser, server, origin;

before(async () => {
  await build({ root, mode: "aviation-core-offline", logLevel: "error", build: { outDir, emptyOutDir: true } });
  server = await preview({ root, build: { outDir }, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  try {
    await browser?.close();
  } finally {
    try {
      if (server) await new Promise((resolve) => server.httpServer.close(resolve));
    } finally {
      await fs.rm(outDir, { recursive: true, force: true });
    }
  }
});

const text = `1 FUEL SURCHARGE
Base fuel surcharge: USD 1000 per flight
Baseline fuel price: USD 0.80 per litre
Fuel price reference: Example Jet A-1 Index
Adjustment frequency: monthly
Adjusted fuel surcharge = Base fuel surcharge * (Current fuel price / Baseline fuel price).`;
const source = {
  text, title: "FUEL SURCHARGE", clauseId: "clause-fuel", clauseNumber: "1",
  evidenceId: "evidence-fuel", pageNumber: 3, sourceLocation: `page:3:char:0-${text.length}`,
};

async function fixture({ width = 1440, mechanism = "supported" } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
  const now = Math.floor(Date.now() / 1000);
  const user = { id: "00000000-0000-4000-8000-000000000001", email: "core-reviewer@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-11-01T00:00:00Z" };
  const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: user.id, exp: now + 3600, role: "authenticated", aal: "aal2" })).toString("base64url"), Buffer.from("offline-signature").toString("base64url")].join(".");
  await context.addInitScript(({ stored }) => {
    localStorage.setItem("sb-127-auth-token", JSON.stringify(stored));
    localStorage.setItem("operion.organizationId", "org-core");
  }, { stored: { access_token: token, refresh_token: "offline-refresh", token_type: "bearer", expires_at: now + 3600, expires_in: 3600, user } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const requests = [], errors = [], unexpected = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const parsedCore = mechanism === "missing" ? null : buildAviationContractCore([{ ...source, text: mechanism === "unsupported" ? `${text}\nSubject to approval and a 10% cap.` : text }]);
  const { recommendations = [], ...coreMetadata } = parsedCore || {};
  const core = parsedCore ? coreMetadata : null;
  const evidence = { id: source.evidenceId, excerpt: text, page_number: 3, source_locator: source.sourceLocation };
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.origin === authOrigin) {
      if (url.pathname.endsWith("/user") && request.method() === "GET") return json(user);
      unexpected.push(`${request.method()} ${url.pathname}`);
      return json({ error: "Unexpected offline auth operation" }, 403);
    }
    if (url.origin !== origin) { unexpected.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
    if (!url.pathname.startsWith("/api/")) return route.continue();
    requests.push({ path: url.pathname, method: request.method(), org: request.headers()["x-org-id"], hasAuth: Boolean(request.headers().authorization) });
    if (request.method() !== "GET") return json({ error: "No mutations allowed in this fixture" }, 405);
    if (url.pathname === "/api/platform/context") return json({ roles: ["user"], permissions: [] });
    if (url.pathname === "/api/foundation/organizations") return json({ organizations: [{ id: "org-core", name: "Offline aviation reviewer" }] });
    if (url.pathname === "/api/foundation/context") return json({ organization: { id: "org-core", role: "viewer" } });
    if (url.pathname === "/api/contracts/contract-fuel") return json({ contract: { id: "contract-fuel", title: "Synthetic fuel pricing contract", status: "active", created_at: "2026-11-01T00:00:00Z" } });
    if (url.pathname === "/api/contracts/contract-fuel/documents") return json({ documents: [{ id: "doc-fuel", filename: "synthetic-fuel.pdf", status: "ready" }] });
    if (url.pathname === "/api/documents/doc-fuel/versions") return json({ versions: [{ id: "version-fuel", analysis_run_id: "run-fuel" }] });
    if (url.pathname === "/api/documents/doc-fuel/structure") return json({ pages: [], sections: [], chunks: [] });
    if (url.pathname === "/api/analysis-runs/run-fuel") return json({ analysisRun: { id: "run-fuel", status: "completed", document_version_id: "version-fuel" } });
    const layer = url.pathname.replace("/api/analysis-runs/run-fuel/", "");
    if (layer === "profile") return json({ profile: {
      metadata: { name: "Synthetic fuel pricing contract", contractType: "OTHER", parties: [], aviationCore: core },
      classification: { type: "OTHER", status: "requires_review", confidence: 0 },
      executive_summary: "Synthetic contract evidence; no verified market data or confirmed liability.",
      recommendations, aircraft_identifiers: [], evidence_claims: [],
      key_commercial_terms: [], key_operational_terms: [], unusual_or_missing_terms: [],
    } });
    if (layer === "clauses") return json({ clauses: [{ id: "clause-fuel", clause_number: "1", title: source.title, source_text: text, category: "commercial/payment", confidence: 0.85, review_status: "pending", evidence: [evidence] }] });
    if (["obligations", "deadlines", "risks", "relationships"].includes(layer)) return json({ [layer]: [] });
    if (layer === "evidence") return json({ evidence: [evidence] });
    if (layer === "financial-impact") return json({ financialImpact: { status: "empty" } });
    if (layer === "role-intelligence") return json({ intelligence: null });
    if (layer === "obligations/estimate") return json({ success: true, analysisRunId: "run-fuel", estimatedIntelligence: null, budget: null });
    unexpected.push(`${request.method()} ${url.pathname}`);
    return json({ error: "Unexpected mocked endpoint" }, 404);
  });
  return { context, page, requests, errors, unexpected };
}

for (const width of [1440, 390]) {
  test(`actual ContractWorkspace fuel flow at ${width}px stays local, explicit and evidence-linked`, async () => {
    const f = await fixture({ width });
    try {
      await f.page.goto(`${origin}/app/contracts/contract-fuel`);
      const core = f.page.locator('section[aria-label="Aviation contract core"]');
      await core.getByRole("heading", { name: "Aviation review coverage" }).waitFor();
      const fuel = core.locator("article").filter({ has: f.page.getByRole("heading", { name: /Fuel-price adjustment/ }) });
      const price = fuel.getByRole("spinbutton", { name: "Fuel price (USD / litre)" });
      const date = fuel.getByLabel("Observation / scenario date (not an invoice date)");
      const calculate = fuel.getByRole("button", { name: "Calculate labelled scenario" });
      await price.fill("1.2");
      await date.fill("2026-11-01");
      await fuel.getByLabel("Assumption description").fill("Hypothetical sensitivity, not a live quote");
      await calculate.click();
      await fuel.getByText(/Scenario only:/).waitFor();
      assert.match(await fuel.locator('[role="status"]').innerText(), /1,500\.00/);
      assert.match(await fuel.locator('[role="status"]').innerText(), /500\.00/);
      assert.match(await fuel.locator('[role="status"]').innerText(), /hypothetical/);
      assert.match(await fuel.innerText(), /No live market feed/);

      await price.fill("-1");
      assert.equal(await fuel.locator('[role="status"]').count(), 0);
      await calculate.click();
      assert.equal(await price.evaluate((element) => element.validity.rangeUnderflow), true);
      assert.equal(await fuel.locator('[role="status"]').count(), 0);

      await fuel.getByLabel("Input provenance").selectOption("user_supplied");
      await price.fill("1.2");
      await fuel.getByLabel("Source label for the stated contractual reference").fill("");
      await calculate.click();
      assert.equal(await fuel.locator('[role="status"]').count(), 0);
      await fuel.getByLabel("Source label for the stated contractual reference").fill("User-supplied index observation, not verified");
      await calculate.click();
      await fuel.getByText(/Scenario only:/).waitFor();
      assert.match(await fuel.locator('[role="status"]').innerText(), /user supplied/);
      assert.match(await fuel.locator('[role="status"]').innerText(), /not independently verified/);
      assert.match(await fuel.locator('[role="status"]').innerText(), /No market feed, forecast, FX conversion, invoice, confirmed liability/);

      await fuel.getByRole("button", { name: "View evidence (1)", exact: true }).click();
      assert.equal(await fuel.locator("blockquote p").textContent(), text);
      assert.equal(await fuel.locator("blockquote p").innerText(), text);
      assert.equal(await fuel.locator("blockquote p").evaluate((element) => getComputedStyle(element).whiteSpace), "pre-wrap");
      assert.match(await fuel.innerText(), /Page 3/);
      await fuel.getByRole("link", { name: "Clause 1", exact: true }).click();
      assert.equal(new URL(f.page.url()).hash, "#clause-clause-fuel");
      await f.page.locator("#clause-clause-fuel").waitFor();
      const sizes = await f.page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      assert.ok(sizes.document <= sizes.viewport + 1, JSON.stringify(sizes));
      assert.ok(f.requests.every((request) => request.method === "GET"));
      assert.ok(f.requests.filter((request) => request.path.includes("/analysis-runs/")).every((request) => request.org === "org-core" && request.hasAuth));
      assert.deepEqual(f.errors, []);
      assert.deepEqual(f.unexpected, []);
    } finally { await f.context.close(); }
  });
}

for (const mechanism of ["unsupported", "missing"]) {
  test(`actual ContractWorkspace exposes no calculation for ${mechanism} pricing evidence`, async () => {
    const f = await fixture({ mechanism });
    try {
      await f.page.goto(`${origin}/app/contracts/contract-fuel`);
      if (mechanism === "unsupported") {
        await f.page.getByRole("heading", { name: /Fuel-price adjustment · requires review/ }).waitFor();
        assert.match(await f.page.locator('section[aria-label="Aviation contract core"]').innerText(), /conditions or cross-references are not supported/);
      } else await f.page.getByText(/Aviation topic coverage and fuel pricing were not produced/).waitFor();
      assert.equal(await f.page.getByRole("button", { name: "Calculate labelled scenario" }).count(), 0);
      assert.ok(f.requests.every((request) => request.method === "GET"));
      assert.deepEqual(f.errors, []);
      assert.deepEqual(f.unexpected, []);
    } finally { await f.context.close(); }
  });
}
