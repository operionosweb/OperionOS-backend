import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

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
after(async () => {
  await browser?.close();
  if (server) { server.httpServer.closeAllConnections(); await new Promise((resolve) => server.httpServer.close(resolve)); }
});

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

test("Globe selection, switching, closing, floating and expanded Matt keep only the current prepared aircraft", async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${origin}/demo/live-tracking`);
    await f.page.getByRole("button", { name: "Skip introduction", exact: true }).click();
    await f.page.getByRole("button", { name: "Close Matt panel", exact: true }).click();
    const decline = f.page.getByRole("button", { name: "Decline", exact: true });
    if (await decline.count()) await decline.click();
    const shell = f.page.locator(".od-cesium-shell");
    const choose = async (index) => {
      await f.page.locator(".matt-floating").getByRole("button", { name: "Ask Matt", exact: true }).focus();
      await f.page.mouse.move(1439, 0);
      await f.page.waitForFunction(() => !document.querySelector(".od-sidebar")?.classList.contains("is-expanded"));
      await shell.waitFor({ timeout: 10000 }).catch(async (error) => {
        throw new Error(JSON.stringify({ url: f.page.url(), errors: f.errors, body: (await f.page.locator("body").innerText()).slice(0, 1500) }), { cause: error });
      });
      await shell.getByRole("button", { name: /^Explore the fleet/ }).click();
      await shell.locator(".od-dashboard-aircraft-list button").nth(index).click();
    };
    await choose(0);
    assert.equal(await f.page.locator(".od-globe-spatial-infocard").evaluate((node) => getComputedStyle(node).borderRadius), "14px", "Aircraft infocard consumes the shared corporate card radius");
    await f.page.getByRole("main").getByRole("button", { name: "Ask Matt", exact: true }).click();
    await f.page.locator('.matt-floating-panel .matt-page[data-context="ac-demo-001"]').waitFor();
    await prepare(f.page);
    await ask(f.page, "What is the potential financial exposure?");
    assert.match(await f.page.locator(".matt-report").innerText(), /illustrative|fictional|prepared/i);
    await f.page.getByRole("button", { name: "Close Matt panel", exact: true }).click();
    await choose(1);
    await f.page.locator(".matt-floating").getByRole("button", { name: "Ask Matt", exact: true }).click();
    await f.page.locator('.matt-floating-panel .matt-page[data-context="ac-demo-002"]').waitFor();
    assert.equal(await f.page.locator(".matt-answer").count(), 0, "Previous aircraft answer is not carried over");
    await f.page.getByRole("link", { name: "Expand Matt", exact: true }).click();
    await f.page.waitForURL("**/demo/matt?flight=ac-demo-002&**");
    await f.page.locator('.matt-page[data-context="ac-demo-002"]').waitFor();
    assert.equal(new URL(f.page.url()).searchParams.get("flight"), "ac-demo-002");
    await f.page.getByRole("navigation", { name: "Demo navigation" }).getByRole("link", { name: "Live Tracking", exact: true }).press("Enter");
    await f.page.waitForURL("**/demo/live-tracking");
    await choose(0);
    await f.page.getByRole("button", { name: "Close aircraft infocard", exact: true }).click();
    await f.page.locator(".matt-floating").getByRole("button", { name: "Ask Matt", exact: true }).click();
    await f.page.locator(".matt-floating-panel .matt-page").waitFor();
    assert.notEqual(await f.page.locator(".matt-floating-panel .matt-page").getAttribute("data-context"), "ac-demo-001");
    await f.page.getByRole("button", { name: "Close Matt panel", exact: true }).click();
    await choose(1);
    await f.page.getByRole("navigation", { name: "Demo navigation" }).getByRole("link", { name: "Contracts", exact: true }).press("Enter");
    await f.page.waitForURL("**/demo/contracts");
    await f.page.locator(".matt-floating").getByRole("button", { name: "Ask Matt", exact: true }).click();
    await f.page.locator(".matt-floating-panel .matt-page").waitFor();
    assert.notEqual(await f.page.locator(".matt-floating-panel .matt-page").getAttribute("data-context"), "ac-demo-002");
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

test("prepared platform help explains Globe truth status and operational configuration boundaries", async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${origin}/demo/matt`);
    await f.page.getByRole("button", { name: "Skip introduction", exact: true }).click();
    await prepare(f.page);
    await f.page.getByRole("combobox", { name: "Question scope", exact: true }).selectOption("platform");
    await f.page.getByRole("checkbox", { name: "Show response text", exact: true }).check();
    await ask(f.page, "How does the Globe work?");
    assert.match(await f.page.locator(".matt-answer").innerText(), /not verified live telemetry/);
    await ask(f.page, "Which features are operational?");
    assert.match(await f.page.locator(".matt-answer").innerText(), /configuration_required/);
    assert.match(await f.page.locator(".matt-answer").innerText(), /future functionality as roadmap/);
    assert.match(await f.page.locator(".matt-answer").innerText(), /not a generated AI response/);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

test("skipped introduction stays dismissed across findings, workspace floating and expanded Matt", async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${origin}/demo/matt`);
    await f.page.getByRole("button", { name: "Skip introduction", exact: true }).click();
    await prepare(f.page);
    await ask(f.page, "What are the key obligations?");
    await f.page.getByRole("button", { name: "Close findings panel", exact: true }).click();
    await f.page.getByRole("button", { name: /^Inspect findings/ }).click();
    await f.page.getByRole("link", { name: "Open existing contract workspace", exact: true }).click();
    await f.page.locator(".matt-floating").getByRole("button", { name: "Ask Matt", exact: true }).click();
    await f.page.getByRole("heading", { name: "Live Matt unavailable", exact: true }).waitFor();
    assert.equal(await f.page.locator(".matt-character video, .matt-character img").count(), 0);
    await f.page.getByRole("link", { name: "Expand Matt", exact: true }).click();
    await f.page.getByRole("heading", { name: "Live Matt unavailable", exact: true }).waitFor();
    assert.equal(await f.page.locator(".matt-character video, .matt-character img").count(), 0);
    assert.equal(f.requests.length, 0, "Demo never calls a live provider or tenant API");
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

test("Demo has one Ask Matt navigation entry and folded Admin fits one line", async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${origin}/demo/contracts/demo-aircraft-lease/overview`);
    const nav = f.page.getByRole("navigation", { name: "Demo navigation" });
    await nav.getByRole("link", { name: "Ask Matt", exact: true }).waitFor();
    assert.equal(await nav.getByRole("link", { name: "Ask Matt", exact: true }).count(), 1);
    assert.equal(await nav.locator('a[href*="/matt"]').count(), 1, "No assistant duplicate under Workspaces");
    assert.equal(await nav.getByRole("link", { name: "Ask Matt", exact: true }).evaluate((link) => {
      let heading = link.previousElementSibling;
      while (heading && !heading.matches(".od-nav-label")) heading = heading.previousElementSibling;
      return heading?.textContent;
    }), "Main");
    for (const width of [320, 390, 768]) {
      await f.page.setViewportSize({ width, height: 1000 });
      await f.page.getByRole("button", { name: "Open navigation", exact: true }).click();
      assert.equal(await nav.getByRole("link", { name: "Ask Matt", exact: true }).count(), 1);
      assert.equal(await nav.locator('a[href*="/matt"]').count(), 1);
      await f.page.locator(".od-brand").getByRole("button", { name: "Close navigation", exact: true }).click();
      assert.ok(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await f.page.locator(".matt-floating").getByRole("button", { name: "Ask Matt", exact: true }).focus();
    for (const width of [1024, 1280, 1440, 1920]) {
      await f.page.setViewportSize({ width, height: 1000 });
      await f.page.mouse.move(width - 1, 0);
      await f.page.waitForFunction(() => {
        const sidebar = document.querySelector(".od-sidebar");
        return sidebar && !sidebar.classList.contains("is-expanded") && sidebar.getBoundingClientRect().width === 72;
      });

      const measurement = await f.page.locator(".od-admin-label").evaluate((label) => {
        const range = document.createRange();
        range.selectNodeContents(label);
        const bounds = label.getBoundingClientRect(), text = range.getBoundingClientRect();
        return { lines: range.getClientRects().length, rail: label.closest(".od-sidebar").getBoundingClientRect().width,
          fits: text.left >= bounds.left && text.right <= bounds.right,
          whiteSpace: getComputedStyle(label).whiteSpace, visible: text.height > 0 };
      });
      assert.equal(measurement.rail, 72);
      assert.equal(measurement.lines, 1);
      assert.equal(measurement.whiteSpace, "nowrap");
      assert.ok(measurement.fits && measurement.visible);
    }
    await nav.getByRole("link", { name: "Ask Matt", exact: true }).click();
    await f.page.locator(".matt-environment").waitFor();
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

for (const width of [320, 390, 1440]) {
  test(`platform guide has honest prepared answers, source evidence and separate report state at ${width}px`, async () => {
    const f = await fixture(width);
    try {
      await f.page.goto(`${origin}/demo/matt`);
      await f.page.getByRole("button", { name: "Skip introduction", exact: true }).click();
      await prepare(f.page);
      await f.page.getByRole("combobox", { name: "Question scope", exact: true }).selectOption("platform");
      await f.page.waitForFunction(() => document.querySelector(".matt-page")?.dataset.questionScope === "platform" && document.querySelector(".matt-studio-toolbar input")?.checked === true);
      await f.page.getByRole("checkbox", { name: "Show response text", exact: true }).check();
      await ask(f.page, "How do I upload a contract?");
      await f.page.getByText(/Prepared platform guide, not a generated AI response/).first().waitFor();
      assert.match(await f.page.locator(".matt-answer").innerText(), /configuration_required/);
      assert.equal(await f.page.locator(".matt-page").evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await f.page.getByRole("link", { name: "OPEN FULL REPORT", exact: true }).click();
      await f.page.locator(".matt-full-report").waitFor();
      assert.equal(new URL(f.page.url()).searchParams.get("scope"), "platform");
      await f.page.getByText(/Prepared platform guide, not a generated AI response/).first().waitFor();
      assert.equal(await f.page.locator(".matt-full-report .od-evidence").count() > 0, true);
      await f.page.getByRole("link", { name: "Return to Matt and conversation", exact: true }).click();
      await f.page.getByRole("combobox", { name: "Question scope", exact: true }).selectOption("analysis");
      await f.page.locator('.matt-page[data-question-scope="analysis"]').waitFor();
      assert.equal(await f.page.getByText(/Prepared platform guide, not a generated AI response/).count(), 0, "A guide is never presented as contract evidence");
      assert.equal(f.requests.length, 0);
      assert.deepEqual(f.errors, []);
    } finally { await f.context.close(); }
  });
}

const visualDirectory = process.env.MATT_SCREENSHOT_DIR;
for (const [width, height] of [[320, 780], [390, 844], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]]) {
  test(`84317 adjacent questions, native response cards and keyboard-safe layout at ${width}x${height}`, async () => {
    const f = await fixture(width);
    try {
      await f.page.setViewportSize({ width, height });
      await f.page.goto(`${origin}/demo/matt`);
      await f.page.locator(".matt-question-panel button").first().waitFor();
      const decline = f.page.getByRole("button", { name: "Decline", exact: true });
      if (await decline.count()) await decline.click();
      await f.page.waitForFunction(() => document.querySelector("video")?.readyState >= 2);
      await f.page.evaluate(() => window.scrollTo(0, 0));
      const measure = () => f.page.evaluate(() => {
        const rect = (selector) => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
        };
        const nav = document.querySelector(".od-bottom-nav")?.getBoundingClientRect();
        return { stage: rect(".matt-environment"), questions: rect(".matt-question-panel"), controls: rect(".matt-composer"),
          overflow: document.documentElement.scrollWidth > innerWidth, height: innerHeight,
          usableBottom: nav?.height ? Math.min(nav.top, innerHeight) : innerHeight };
      });
      const firstEntry = await measure();
      const firstQuestion = await f.page.locator(".matt-question-panel button").first().boundingBox();
      assert.ok(firstQuestion.y + firstQuestion.height <= firstEntry.usableBottom, "The first suggested question is wholly above fixed navigation on first entry");
      assert.equal(await f.page.locator(".matt-question-panel button").first().evaluate((button) => {
        const b = button.getBoundingClientRect();
        return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)?.closest("button") === button;
      }), true, "The visible first question can actually receive a pointer, not just pass a viewport box check");
      assert.equal(firstEntry.overflow, false);
      if (width > 1000) {
        assert.ok(firstEntry.questions.x >= firstEntry.stage.right, "Desktop questions are beside, never below, Matt");
        assert.ok(Math.abs(firstEntry.questions.y - firstEntry.stage.y) < 30, "Columns begin together");
        assert.ok(firstEntry.questions.bottom < height, "All starter questions visible before any scroll");
      } else {
        assert.ok(firstEntry.questions.y >= firstEntry.controls.bottom, "Mobile order is video, controls, suggestions");
        assert.ok(firstEntry.questions.y - firstEntry.controls.bottom < 100, "No context/status wall before suggestions");
      }
      if (visualDirectory) {
        await mkdir(visualDirectory, { recursive: true });
        await f.page.screenshot({ path: path.join(visualDirectory, `84317-introduction-${width}.png`), fullPage: true, animations: "disabled" });
      }
      await f.page.getByRole("button", { name: "Do not show introduction again", exact: true }).click();
      await f.page.evaluate(() => window.scrollTo(0, 0));
      const ready = await measure();
      assert.ok(ready.questions.y < height - 44, "First suggestion reachable in initial ready viewport");
      const readyQuestion = await f.page.locator(".matt-question-panel button").first().boundingBox();
      assert.ok(readyQuestion.y + readyQuestion.height <= ready.usableBottom, "Ready-state question is fully above navigation before scrolling");
      await f.page.locator(".matt-question-panel button").first().click();
      await f.page.locator(".matt-answer").waitFor();
      const card = f.page.locator(".matt-report > .op-infocard");
      assert.equal(await card.count(), 1);
      if (width > 1000) {
        const result = await card.boundingBox();
        assert.ok(result.x >= firstEntry.stage.right, "Answer belongs to right intelligence panel");
      }
      assert.match(await card.innerText(), /Recommended review action/);
      await f.page.getByText(/Supporting source evidence \(/).click();
      const styles = await f.page.locator(".matt-response-card, .matt-report .od-evidence").evaluateAll((nodes) => nodes.map((node) => {
        const s = getComputedStyle(node);
        return { radius: s.borderRadius, shadow: s.boxShadow, font: s.fontFamily };
      }));
      assert.ok(styles.length > 1);
      assert.ok(styles.every((style) => style.radius === "14px" && style.shadow === styles[0].shadow), "Evidence and responses use the same infocard tokens");
      const smallTargets = await f.page.locator(".matt-studio button, .matt-studio summary").evaluateAll((nodes) => nodes.filter((n) => n.getBoundingClientRect().width > 0 && n.getBoundingClientRect().height < 44).map((n) => n.textContent));
      assert.deepEqual(smallTargets, []);
      if (visualDirectory) {
        await f.page.evaluate(() => window.scrollTo(0, 0));
        await f.page.screenshot({ path: path.join(visualDirectory, `84317-answer-${width}.png`), fullPage: true, animations: "disabled" });
        await writeFile(path.join(visualDirectory, `84317-geometry-${width}.json`), JSON.stringify({ firstEntry, ready, styles }, null, 2));
      }
      await f.page.getByRole("button", { name: "Type a question", exact: true }).click();
      await f.page.getByRole("textbox", { name: "Ask Matt", exact: true }).focus();
      if (width < 600) await f.page.setViewportSize({ width, height: 480 });
      await f.page.getByRole("textbox", { name: "Ask Matt", exact: true }).fill("Which deadlines require trigger dates?");
      await f.page.getByRole("button", { name: "Send", exact: true }).click();
      await f.page.locator(".matt-answer").waitFor();
      assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(f.errors, []);
    } finally { await f.context.close(); }
  });
}

test("84317 first platform visit offers optional approved introduction and persists disable on reload", async () => {
  const f = await fixture(390);
  try {
    await f.page.goto(`${origin}/demo/dashboard`);
    const panel = f.page.getByRole("dialog", { name: "Matt contextual assistant", exact: true });
    await panel.waitFor();
    assert.equal(await panel.locator("video source").getAttribute("src"), "/matt/reference.mp4");
    await panel.getByRole("button", { name: "Do not show introduction again", exact: true }).click();
    await panel.getByRole("button", { name: "Close Matt panel", exact: true }).click();
    await f.page.reload();
    await f.page.locator(".matt-floating-trigger[aria-expanded='false']").waitFor();
    await f.page.locator(".matt-floating-trigger").click();
    assert.equal(await panel.locator("video").count(), 0);
    assert.equal(await panel.locator(".matt-environment").getAttribute("data-intro-outcome"), "intro_disabled");
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

test("84317 existing clause, obligation, deadline, risk, exposure and evidence cards share surface tokens", async () => {
  const f = await fixture();
  try {
    await f.page.addInitScript(() => localStorage.setItem("operion:matt:intro:demo", "intro_disabled"));
    for (const section of ["clauses", "obligations", "deadlines", "risks", "financial-impact", "evidence"]) {
      await f.page.goto(`${origin}/demo/contracts/demo-aircraft-lease/${section}`);
      const cards = f.page.locator(".od-main .od-finding-card, .od-main .od-financial-card, .od-main .od-evidence");
      await cards.first().waitFor();
      const styles = await cards.evaluateAll((nodes) => nodes.map((node) => {
        const s = getComputedStyle(node);
        return { radius: s.borderRadius, shadow: s.boxShadow, expected: getComputedStyle(document.documentElement).getPropertyValue("--op-card-radius").trim() };
      }));
      assert.ok(styles.every((s) => s.radius === s.expected && s.shadow !== "none"), `${section} uses shared surface tokens without changing evidence/data`);
    }
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

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
    await f.page.locator(".matt-floating").getByRole("button", { name: "Ask Matt", exact: true }).click();
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
      await f.page.locator(".matt-floating").getByRole("button", { name: "Ask Matt", exact: true }).click();
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
