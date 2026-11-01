import test, { before, after } from "node:test";
import assert from "node:assert/strict";
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
  await build({ root, mode: "matt-studio-preview", logLevel: "error" });
  server = await preview({ root, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); if (server) await new Promise((resolve) => server.httpServer.close(resolve)); });

async function fixture(width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: width === 390 ? "reduce" : "no-preference" });
  await context.addInitScript(() => {
    window.__voice = { microphones: 0, speech: 0, aborted: 0 };
    class Recognition {
      start() { window.__recognition = this; window.__voice.microphones++; this.onstart?.(); }
      abort() { window.__voice.aborted++; }
    }
    class Utterance { constructor(text) { this.text = text; } }
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: Recognition });
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: Utterance });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      getVoices: () => [], addEventListener() {}, removeEventListener() {},
      speak() { window.__voice.speech++; }, cancel() {},
    } });
  });
  const page = await context.newPage(), requests = [], errors = [];
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || url.pathname.startsWith("/api/")) { requests.push(url.pathname); return route.abort(); }
    if (url.pathname.endsWith(".mp4")) requests.push(url.pathname);
    return route.continue();
  });
  await page.goto(`${origin}/demo/matt?studio=1`);
  await page.getByRole("button", { name: "What are the key obligations?", exact: true }).waitFor();
  const decline = page.getByRole("button", { name: "Decline", exact: true });
  if (await decline.count()) await decline.click();
  return { context, page, requests, errors };
}

for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
  test(`studio stage and findings remain usable at ${width}px`, async () => {
    const f = await fixture(width);
    try {
      assert.equal(await f.page.locator(".matt-page").getAttribute("data-experience"), "unified-matt");
      assert.equal(await f.page.locator("video").count(), 0);
      assert.equal(await f.page.getByRole("textbox", { name: "Ask Matt", exact: true }).count(), 0);
      await f.page.getByRole("button", { name: "What are the key obligations?", exact: true }).click();
      await f.page.waitForFunction(() => document.querySelector(".matt-page")?.dataset.state === "PRESENTING");
      assert.equal(await f.page.locator(".matt-answer").count(), 0);
      assert.equal(await f.page.locator(".matt-report").isVisible(), true, "Result panel opens without leaving Matt");
      assert.equal(await f.page.locator(".matt-findings li").count(), 4);
      await f.page.getByText(/Supporting source evidence \(/).click();
      assert.equal(await f.page.locator(".matt-report .od-evidence").count(), 4);
      if (width <= 768) {
        const bounds = await f.page.locator(".matt-studio-notice, .matt-environment, .matt-composer, .matt-report, .matt-proposal-card, .matt-proposal-status, .matt-report .od-evidence").evaluateAll((cards) => cards.map((card) => {
          const rect = card.getBoundingClientRect();
          return { left: rect.left, right: innerWidth - rect.right, name: card.className };
        }));
        for (const card of bounds) {
          assert.ok(Math.abs(card.left - 2) < 1, `${card.name}: exact Demo left gutter, got ${card.left}`);
          assert.ok(Math.abs(card.right - 2) < 1, `${card.name}: exact Demo right gutter, got ${card.right}`);
        }
      }
      const geometry = await f.page.evaluate(() => {
        const stage = document.querySelector(".matt-environment").getBoundingClientRect();
        const layout = document.querySelector(".matt-layout").getBoundingClientRect();
        const dock = document.querySelector(".matt-composer").getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth, ratio: stage.width / layout.width, height: stage.height,
          dockGap: dock.top - stage.bottom, dockBottom: dock.bottom, stageBottom: stage.bottom,
          undersized: [...document.querySelectorAll(".matt-studio button, .matt-studio summary")].filter((el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height < 44).map((el) => el.textContent) };
      });
      assert.equal(geometry.overflow, false);
      assert.ok(geometry.ratio >= (width >= 1024 ? 0.65 : 0.95), "Matt remains dominant when the proposal rail is open");
      assert.ok(geometry.height >= 360);
      if (width >= 1024) assert.ok(geometry.dockBottom <= geometry.stageBottom, "Desktop primary controls dock inside scene");
      else assert.ok(geometry.dockGap >= 0 && geometry.dockGap <= 60, "Mobile primary controls follow scene without a report/context wall");
      assert.deepEqual(geometry.undersized, []);
      assert.equal(await f.page.locator(".matt-character img").evaluate((image) => getComputedStyle(image).animationName), "none");
      if (process.env.MATT_SCREENSHOT_DIR && [390, 1440].includes(width)) {
        await f.page.locator(".matt-proposal").scrollIntoViewIfNeeded();
        await f.page.screenshot({ path: path.join(process.env.MATT_SCREENSHOT_DIR, `matt-proposal-${width}.png`), fullPage: true, animations: "disabled" });
        await f.page.getByRole("button", { name: "Close findings panel", exact: true }).click();
        await f.page.evaluate(() => { window.scrollTo({ top: 0, behavior: "instant" }); });
        await f.page.screenshot({ path: path.join(process.env.MATT_SCREENSHOT_DIR, `matt-studio-${width}.png`), fullPage: true, animations: "disabled" });
      }
      assert.deepEqual(f.errors, []);
      assert.deepEqual(f.requests, [], "No customer APIs, external hosts or generic footage");
      assert.equal(await f.page.evaluate(() => window.__voice.speech), 0);
    } finally { await f.context.close(); }
  });

  test(`proposal separates findings, suggestions and unavailable actions at ${width}px; review uses existing contract scope`, async () => {
    const f = await fixture(width);
    try {
      assert.equal(await f.page.locator(".matt-proposal").count(), 0, "No fabricated proposal before a result");
      await f.page.getByRole("button", { name: "Review the maintenance risks", exact: true }).click();
      await f.page.getByRole("region", { name: "Contract review proposal", exact: true }).waitFor();
      const proposal = f.page.locator(".matt-proposal");
      if (width <= 768) assert.ok(await f.page.locator(".matt-report").evaluate((panel) => panel.clientHeight <= innerHeight * 0.75 + 2), "Mobile proposal sheet bounds vertical page growth");
      assert.match(await proposal.textContent(), /not a generated mitigation proposal/);
      assert.match(await proposal.textContent(), /not AI-generated or approved actions/);
      assert.match(await proposal.textContent(), /No notice has been sent or approved/);
      assert.equal(await proposal.getByRole("button", { name: /Transmit|DocuSign|PDF|Notary/ }).count(), 0);
      assert.match(await proposal.getByRole("link", { name: "Review contract evidence", exact: true }).getAttribute("href"), /^\/demo\/contracts\/[^/]+\/evidence$/);
      await proposal.getByRole("button", { name: "Clarify first finding", exact: true }).click();
      await f.page.getByRole("button", { name: "Send", exact: true }).click();
      await f.page.waitForFunction(() => document.querySelector(".matt-page")?.dataset.state === "PRESENTING");
      assert.equal(await f.page.locator(".matt-answer").count(), 0, "Proposal remains available with response text off");
      await f.page.getByRole("button", { name: "Hide proposal", exact: true }).click();
      assert.equal(await f.page.locator(".matt-report").isVisible(), false);
      await f.page.getByRole("button", { name: "Open proposal", exact: true }).click();
      await proposal.getByRole("link", { name: "Review contract evidence", exact: true }).click();
      await f.page.waitForURL(/\/demo\/contracts\/[^/]+\/evidence/);
      assert.deepEqual(f.requests, []);
      assert.deepEqual(f.errors, []);
    } finally { await f.context.close(); }
  });
}

test("response visibility preserves answer, context, evidence and follow-up history", async () => {
  const f = await fixture();
  try {
    await f.page.getByRole("button", { name: "What are the key obligations?", exact: true }).click();
    await f.page.waitForFunction(() => document.querySelector(".matt-page")?.dataset.state === "PRESENTING");
    const checkbox = f.page.getByRole("checkbox", { name: "Show response text", exact: true });
    await checkbox.check();
    const answer = await f.page.locator(".matt-answer").textContent();
    const selected = await f.page.getByRole("combobox", { name: "Contract context", exact: true }).inputValue();
    await checkbox.uncheck();
    assert.equal(await f.page.locator(".matt-answer").count(), 0);
    assert.equal(await f.page.locator(".matt-history").count(), 0);
    assert.equal(await f.page.locator(".matt-findings li").count(), 4);
    assert.equal(await f.page.getByRole("combobox", { name: "Contract context", exact: true }).inputValue(), selected);
    await checkbox.check();
    assert.equal(await f.page.locator(".matt-answer").textContent(), answer);
    await f.page.getByRole("button", { name: "Explain the second finding", exact: true }).click();
    assert.match(await f.page.getByRole("textbox", { name: "Ask Matt", exact: true }).inputValue(), /second finding/);
    await f.page.getByRole("button", { name: "Send", exact: true }).click();
    await f.page.getByText("Conversation (4 messages, this visit only)", { exact: true }).waitFor();
    await f.page.getByRole("textbox", { name: "Ask Matt", exact: true }).fill("What is our fuel price exposure?");
    await f.page.getByRole("button", { name: "Send", exact: true }).click();
    await f.page.getByText("Not established. Do not infer that a clause, exposure or obligation exists.", { exact: true }).waitFor();
    assert.equal(await f.page.locator(".matt-findings li").count(), 0);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

test("microphone requires consent, opens transcript review and interruption stops recognition without TTS", async () => {
  const f = await fixture();
  try {
    await f.page.getByRole("button", { name: "Microphone", exact: true }).click();
    await f.page.getByRole("alert").filter({ hasText: /acknowledge/ }).waitFor();
    assert.equal(await f.page.evaluate(() => window.__voice.microphones), 0);
    await f.page.getByText("Voice and privacy settings", { exact: true }).click();
    await f.page.getByRole("checkbox", { name: "I permit browser speech services for this visit", exact: true }).check();
    await f.page.getByRole("button", { name: "Microphone", exact: true }).click();
    await f.page.waitForFunction(() => document.querySelector(".matt-page")?.dataset.state === "LISTENING");
    await f.page.evaluate(() => {
      const result = [{ transcript: "Review the maintenance risks" }];
      result.isFinal = true;
      window.__recognition.onresult({ resultIndex: 0, results: [result] });
    });
    assert.equal(await f.page.getByRole("textbox", { name: "Ask Matt", exact: true }).inputValue(), "Review the maintenance risks");
    await f.page.getByRole("button", { name: "Interrupt / stop speaking", exact: true }).click();
    assert.equal(await f.page.locator(".matt-page").getAttribute("data-state"), "INTERRUPTED");
    assert.equal(await f.page.evaluate(() => window.__voice.speech), 0);
    assert.ok(await f.page.evaluate(() => window.__voice.aborted) > 0);
    assert.equal(await f.page.locator("video").count(), 0);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

test("studio query cannot bypass authenticated route protection", async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${origin}/app/matt?studio=1`);
    await f.page.waitForURL(/\/login/);
    assert.equal(await f.page.locator(".matt-studio").count(), 0);
  } finally { await f.context.close(); }
});
