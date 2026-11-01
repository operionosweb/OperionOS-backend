import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.VITE_SUPABASE_URL = "http://127.0.0.1:59998";
process.env.VITE_SUPABASE_ANON_KEY = "offline-matt-test";
process.env.VITE_API_BASE_URL = "";
let browser, server, origin;
before(async () => {
  await build({ root, mode: "matt-offline", logLevel: "error" });
  server = await preview({ root, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); if (server) await new Promise((resolve) => server.httpServer.close(resolve)); });

async function fixture(width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
  await context.addInitScript(() => localStorage.setItem("operion.consent", "declined"));
  const page = await context.newPage(), errors = [], requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/weather-maps/status") return route.fulfill({ json: { configured: false } });
    if (url.origin !== origin || url.pathname.startsWith("/api/")) { requests.push(url.pathname); return route.abort(); }
    return route.continue();
  });
  return { context, page, errors, requests };
}
async function prepare(page) {
  await page.locator(".matt-studio").waitFor();
  const decline = page.getByRole("button", { name: "Decline", exact: true });
  if (await decline.count()) await decline.click();
  await page.getByRole("checkbox", { name: "Show response text", exact: true }).check();
  await page.getByRole("button", { name: "Type a question", exact: true }).click();
}
async function ask(page, question) {
  await page.getByRole("textbox", { name: "Ask Matt", exact: true }).fill(question);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.locator(".matt-page[data-state='PRESENTING']").waitFor();
}

test("Matt retains the original workspace's supported intelligence categories with evidence and limitations", async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${origin}/demo/matt`);
    await prepare(f.page);
    for (const question of [
      "What are my biggest contract risks?", "Which contracts need attention before renewal?",
      "Where is the largest modeled exposure?", "What commitments are due soon?",
      "Where does the contract mention termination?", "Where are the biggest intelligence gaps?",
      "What should I act on first?", "Which vendor is exposed?", "Compare termination language",
      "Show compliance requirements", "Show observed performance", "Summarise this contract",
    ]) {
      await ask(f.page, question);
      assert.ok((await f.page.locator(".matt-answer").textContent()).length > 25);
      assert.ok(await f.page.locator(".matt-findings li").count() > 0, question);
    }
    await ask(f.page, "What is our fuel price exposure?");
    assert.equal(await f.page.locator(".matt-findings li").count(), 0, "No unrelated financial answer substituted");
    assert.match(await f.page.locator(".matt-report").innerText(), /Not established/);
    assert.deepEqual(f.errors, []);
    assert.deepEqual(f.requests, []);
  } finally { await f.context.close(); }
});

test("main, workspace, floating Matt and full response report share one contract conversation", async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${origin}/demo/matt?contract=demo-aircraft-lease`);
    await prepare(f.page);
    await ask(f.page, "What are the key obligations?");
    const answer = await f.page.locator(".matt-answer").textContent();
    const pageUrl = f.page.url();
    await f.page.getByText(/Supporting source evidence \(/).click();
    assert.equal(f.page.url(), pageUrl, "Evidence remains in contextual panel");
    await f.page.getByRole("link", { name: "OPEN FULL REPORT", exact: true }).click();
    await f.page.waitForURL("**/matt/report?**");
    assert.match(await f.page.locator(".matt-full-report").innerText(), /Maintain insurance/);
    await f.page.getByRole("link", { name: "Return to Matt and conversation", exact: true }).click();
    assert.equal(await f.page.locator(".matt-answer").textContent(), answer);
    await f.page.getByRole("link", { name: "Open existing contract workspace", exact: true }).click();
    await f.page.waitForURL("**/demo/contracts/demo-aircraft-lease/evidence");
    await f.page.getByRole("button", { name: "Open Matt assistant", exact: true }).click();
    const popup = f.page.getByRole("dialog", { name: "Matt contextual assistant", exact: true });
    assert.equal(await popup.locator(".matt-answer").textContent(), answer);
    await popup.getByRole("link", { name: "Expand Matt", exact: true }).click();
    assert.equal(await f.page.locator(".matt-answer").textContent(), answer);
    assert.match(await f.page.locator(".matt-history").textContent(), /2 messages/);
    await f.page.getByRole("combobox", { name: "Contract context", exact: true }).selectOption("");
    assert.equal(await f.page.locator(".matt-findings li").count(), 0, "Changing context does not expose previous scope");
    await f.page.getByRole("combobox", { name: "Contract context", exact: true }).selectOption("demo-aircraft-lease");
    assert.equal(await f.page.locator(".matt-answer").textContent(), answer, "Returning to the same scope retains its conversation");
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

for (const width of [320, 390, 768, 1440]) {
  test(`workspace and floating Matt retain responsive Demo bounds at ${width}px`, async () => {
    const f = await fixture(width);
    try {
      await f.page.goto(`${origin}/demo/contracts/demo-aircraft-lease/overview`);
      await f.page.locator(".matt-environment").waitFor();
      const decline = f.page.getByRole("button", { name: "Decline", exact: true });
      if (await decline.count()) await decline.click();
      assert.ok(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await f.page.getByRole("button", { name: "Open Matt assistant", exact: true }).click();
      const popup = f.page.getByRole("dialog", { name: "Matt contextual assistant", exact: true });
      const bounds = await popup.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
      assert.ok(await popup.locator(".matt-environment").isVisible());
      assert.ok(await popup.getByRole("button", { name: "Microphone", exact: true }).isVisible());
      const ids = await f.page.locator("[id]").evaluateAll((elements) => elements.map((element) => element.id).filter((id) => id.startsWith("matt-")));
      assert.equal(new Set(ids).size, ids.length, "Multiple entry points do not duplicate control IDs");
      await popup.getByRole("button", { name: "Close Matt panel", exact: true }).click();
      assert.equal(await popup.count(), 0);
      assert.deepEqual(f.errors, []);
      assert.deepEqual(f.requests, []);
    } finally { await f.context.close(); }
  });
}
