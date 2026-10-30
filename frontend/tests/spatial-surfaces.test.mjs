import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { chromium } from "@playwright/test";
import { AIRCRAFT_CONTRACT_PARTS, aircraftPartId } from "../src/components/corporate/aircraftContractParts.js";

const origin = process.env.CORPORATE_TEST_URL || "http://127.0.0.1:4175";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)) throw new Error("Spatial checks require loopback");
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

const corporateRoutes = ["/", "/about", "/product", "/aviation", "/how-it-works", "/solutions", "/scenarios", "/enterprise", "/security", "/request-demo", "/login", "/privacy", "/legal", "/industries", "/resources", "/intelligence"];
const demoRoutes = ["/demo/dashboard", "/demo/contracts", "/demo/upload", "/demo/live-tracking", "/demo/intelligence", "/demo/organisation", "/demo/users", "/demo/settings",
  ...["overview", "clauses", "obligations", "deadlines", "risks", "evidence", "financial-impact", "assistant"].map((section) => `/demo/contracts/demo-aircraft-lease/${section}`)];
const surfaces = [
  ".oaero-hero-visual", ".oaero-layer", ".oaero-resource-grid article", ".oaero-sector-card",
  ".op-sales-capability-grid article", ".op-sales-flow article", ".op-sales-evolution article",
  ".op-about-roadmap article", ".op-about-principles > div", ".op-about-aviation-grid > div",
  ".op-about-intelligence-path li", ".op-founder-grid img", ".op-surface", ".op-solutions-segment",
  ".op-solutions-segment-image", ".op-security-grid > *", ".op-request-form", ".op-login-panel",
  ".op-core-plane", ".op-core-review", ".od-card", ".od-metric", ".od-portfolio", ".od-finding-card",
  ".od-evidence", ".od-command-overview", ".od-command-indicators > button", ".od-command-records > article",
  ".od-financial-metrics > article", ".od-contract-clause", ".od-dashboard-globe-panel", ".od-cesium-shell",
  ".op-consent", ".op-story-product-frame", ".od-intelligence-categories > a", ".od-contract-row",
].join(",");

async function createPage(width, { render = false, touch = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: touch, isMobile: touch, reducedMotion: "reduce" });
  await context.route("**/*", (route) => route.request().method() === "GET" && new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  if (!render) await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return /webgl/i.test(type) ? null : original.call(this, type, ...args); };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  await page.route("**/api/weather-maps/status", (route) => route.fulfill({ json: { configured: false } }));
  return { context, page };
}

for (const width of [320, 360, 390, 430, 600, 767, 768, 844, 900]) {
  test(`all Corporate and Demo cards, images and globe frames have exact 2px mobile gutters at ${width}px`, { timeout: 120000 }, async () => {
    const { context, page } = await createPage(width);
    const errors = [];
    const layoutErrors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      for (const route of [...corporateRoutes, ...demoRoutes]) {
        await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
        await page.locator("h1").first().waitFor();
        if (route === "/demo/dashboard" || route === "/demo/live-tracking" || route === "/" || route === "/product") await page.locator(".od-dashboard-globe-panel").waitFor();
        const layout = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
        if (layout.content > layout.viewport + 1) layoutErrors.push(`${route} has ${layout.content}px content at ${width}px`);
        const boxes = await page.locator(surfaces).evaluateAll((elements) => elements.filter((element) => element.getClientRects().length).map((element) => {
          const bounds = element.getBoundingClientRect();
          return { name: element.className || element.parentElement.className, left: bounds.left, right: bounds.right };
        }));
        for (const box of boxes) {
          if (Math.abs(box.left - 2) > .6 || Math.abs(box.right - (width - 2)) > .6) layoutErrors.push(`${route} ${box.name}: edges ${box.left}, ${box.right}; expected 2, ${width - 2}`);
        }
      }
      assert.deepEqual(layoutErrors, []);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

test("the Core Idea is a depth-layered interactive contract-to-context experience, not a live forecasting claim", async () => {
  const { context, page } = await createPage(1440);
  try {
    await page.goto(origin);
    const stage = page.locator(".op-core-stage");
    await stage.scrollIntoViewIfNeeded();
    assert.equal(await stage.evaluate((element) => getComputedStyle(element).perspective), "1200px");
    for (const [label, contract, consequence] of [
      ["Maintenance", "Engine maintenance agreement", "Aircraft availability may be affected"],
      ["Fuel", "Fuel supply agreement", "Procurement costs may change"],
      ["Aircraft lease", "Aircraft operating lease", "Return condition can create exposure"],
    ]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      assert.equal(await page.locator(".op-core-source > strong").innerText(), contract);
      assert.equal(await page.locator(".op-core-review h3").innerText(), consequence);
      assert.match(await page.locator(".op-core-note").innerText(), /not live events/);
    }
  } finally { await context.close(); }
});

for (const width of [320, 390, 1440]) {
  test(`3D aircraft parts open useful, scrollable contract popups at ${width}px`, { timeout: 90000 }, async () => {
    const { context, page } = await createPage(width, { render: true, touch: width < 768 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(origin);
      const canvas = page.locator(".oaero-aircraft-canvas canvas");
      await canvas.waitFor();
      await canvas.scrollIntoViewIfNeeded();
      if (width === 1440) {
        const bounds = await canvas.boundingBox();
        const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 40, y, { steps: 4 });
        await page.mouse.move(x, y, { steps: 4 });
        await page.mouse.up();
        assert.equal(await page.locator(".oaero-part-inspector").count(), 0, "Orbiting back to the start is not a part click");
      }
      for (const part of AIRCRAFT_CONTRACT_PARTS) {
        const trigger = page.getByRole("group", { name: "Explore aircraft contracts by part" }).getByRole("button", { name: new RegExp(part.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
        await trigger.click();
        const popup = page.getByRole("dialog", { name: part.label, exact: true });
        await popup.waitFor();
        assert.match(await popup.innerText(), /Typical relationships only, not findings/);
        assert.equal(await popup.locator("li").count(), 3);
        assert.equal(await popup.locator(".oaero-part-contracts").innerText(), part.contracts);
        assert.equal(await popup.getByRole("link").getAttribute("href"), "/demo/contracts");
        assert.ok(await popup.evaluate((element) => element.scrollWidth <= element.clientWidth + 1));
        if (width < 768) {
          const bounds = await popup.boundingBox();
          assert.ok(Math.abs(bounds.x - 2) <= 1 && Math.abs(bounds.x + bounds.width - (width - 2)) <= 1, "Part information uses full mobile width");
        }
        await popup.press("Escape");
        assert.equal(await popup.count(), 0);
        assert.equal(await trigger.evaluate((element) => element === document.activeElement), true);
      }
      await canvas.scrollIntoViewIfNeeded();
      const hotspot = page.locator('.oaero-aircraft-hotspots button[data-part="engines"]');
      await hotspot.waitFor();
      await hotspot.click();
      await page.getByRole("dialog", { name: "Engines", exact: true }).waitFor();
      await page.getByRole("button", { name: "Close aircraft part information", exact: true }).click();
      // Remove only the HTML hotspots to exercise picking the actual mesh beneath them.
      const anchor = await page.locator('.oaero-aircraft-hotspots button[data-part="airframe"]').boundingBox();
      assert.ok(anchor);
      await page.addStyleTag({ content: ".oaero-aircraft-hotspots { visibility: hidden; }" });
      if (width < 768) await page.touchscreen.tap(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2);
      else await page.mouse.click(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2);
      await page.getByRole("dialog", { name: "Airframe & cabin", exact: true }).waitFor();
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

test("all aircraft contract regions resolve from mesh ancestry without guessing contract findings", () => {
  assert.equal(new Set(AIRCRAFT_CONTRACT_PARTS.map((part) => part.id)).size, 5);
  for (const part of AIRCRAFT_CONTRACT_PARTS) {
    assert.equal(aircraftPartId({ userData: {}, parent: { userData: { contractPart: part.id } } }), part.id);
    assert.equal(part.checks.length, 3);
  }
  assert.equal(aircraftPartId({ userData: {} }), null);
});

test("mobile evidence drawers remain full-width, scrollable and dismissible", async () => {
  const { context, page } = await createPage(320);
  try {
    await page.goto(`${origin}/demo/contracts/demo-aircraft-lease/clauses`);
    await page.getByRole("button", { name: "Decline", exact: true }).click();
    for (const width of [320, 390, 844, 900]) {
      await page.setViewportSize({ width, height: 600 });
      await page.getByRole("button", { name: "View source evidence", exact: true }).first().click();
      const drawer = page.getByRole("dialog", { name: "Evidence detail" });
      const bounds = await drawer.boundingBox();
      assert.ok(Math.abs(bounds.x - 2) <= .6 && Math.abs(bounds.x + bounds.width - (width - 2)) <= .6);
      assert.ok(await drawer.evaluate((element) => element.scrollWidth <= element.clientWidth + 1 && getComputedStyle(element).overflowY === "auto"));
      await drawer.getByRole("button", { name: "Close evidence", exact: true }).click();
      assert.equal(await drawer.count(), 0);
    }
  } finally { await context.close(); }
});

test("authenticated workspace CSS uses the same mobile gutters without logging in or contacting production APIs", async () => {
  const { context, page } = await createPage(390);
  try {
    await page.goto(`${origin}/about`);
    await page.locator("h1").waitFor();
    const styles = await page.locator('link[rel="stylesheet"]').evaluateAll((elements) => elements.map((element) => element.outerHTML).join(""));
    await page.setContent(`<head>${styles}</head><body><div class="op-product-shell"><div class="op-product-frame"><main class="op-product-main">
      <div class="op-metric-grid"><article class="op-metric-card">Metric</article><article class="op-metric-card">Metric</article></div>
      <div class="op-dashboard-grid"><section class="op-intelligence-panel"><div class="op-contract-list"><a class="op-contract-card">Contract</a></div></section><section class="op-intelligence-panel">Intelligence</section></div>
      <section class="op-upload-stage">Upload</section><section class="op-honest-boundary">Provider availability</section>
    </main></div></div></body>`);
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".op-product-main")).paddingLeft === "2px");
    for (const width of [320, 390, 844, 900]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const element of await page.locator(".op-metric-card, .op-intelligence-panel, .op-contract-card, .op-upload-stage, .op-honest-boundary").all()) {
        const bounds = await element.boundingBox();
        assert.ok(Math.abs(bounds.x - 2) <= .6 && Math.abs(bounds.x + bounds.width - (width - 2)) <= .6, `${await element.getAttribute("class")} at ${width}px: ${JSON.stringify(bounds)}`);
      }
    }
  } finally { await context.close(); }
});
