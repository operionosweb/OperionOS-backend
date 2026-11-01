import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const origin = process.env.CORPORATE_TEST_URL || "http://127.0.0.1:4175";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)) throw new Error("Offline tests require loopback");
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function createPage(width, touch = false) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce", hasTouch: touch, isMobile: touch });
  await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  await page.route("**/api/weather-maps/status", (route) => route.fulfill({ json: { configured: false } }));
  return { context, page };
}

for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
  test(`About story, exact founder photograph and CTAs fit ${width}px`, async () => {
    const { context, page } = await createPage(width);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(`${origin}/about`, { waitUntil: "domcontentloaded" });
      await page.locator("#corporate-main h1").waitFor();
      assert.equal(await page.locator("#corporate-main h1").count(), 1);
      assert.equal(await page.locator(".oaero-hero-visual").count(), 0, "Home-only aircraft hero is not duplicated");
      for (const heading of ["Contracts don't exist in isolation.", "From managing contracts to understanding their consequences.", "Meelis Paloson", "Understand today. Anticipate tomorrow."]) {
        await page.getByRole("heading", { name: heading, exact: true }).waitFor();
      }
      const photo = page.locator(".op-founder-grid img");
      await photo.scrollIntoViewIfNeeded();
      await photo.evaluate((image) => image.decode());
      const photoResponse = await page.request.get(new URL(await photo.getAttribute("src"), origin).href);
      assert.deepEqual(await photoResponse.body(), await readFile(new URL("../src/assets/brand/founder-meelis-paloson.jpg", import.meta.url)), "Supplied photograph is used unchanged");
      assert.equal(await photo.getAttribute("alt"), "Meelis Paloson, founder of Operion OS, speaking into a microphone at an event.");
      const photoBox = await photo.boundingBox(), biographyBox = await page.locator(".op-founder-story").boundingBox();
      if (width <= 900) assert.ok(photoBox.y + photoBox.height < biographyBox.y + 1, "Mobile photograph is above biography");
      else assert.ok(photoBox.x + photoBox.width < biographyBox.x, "Desktop photograph sits alongside biography");
      await page.getByText("Read the story behind Operion", { exact: true }).click();
      await page.getByText(/My entrepreneurial journey has also included founding Petinder/).waitFor();
      assert.match(await page.locator(".op-founder-more").innerText(), /NETT Digital School/);
      const linkedin = page.getByRole("link", { name: "Connect with Meelis on LinkedIn", exact: true });
      assert.equal(await linkedin.getAttribute("href"), "https://www.linkedin.com/in/meelispaloson");
      assert.deepEqual(await page.locator(".op-about-roadmap small").allTextContents(), ["Available foundation", "In development", "In development", "Strategic roadmap"]);
      assert.equal(await page.locator(".op-about-principles h3").count(), 6);
      assert.equal(await page.locator(".op-about-intelligence-path li").count(), 6);
      for (const [label, href] of [["Explore Operion", "/product"], ["Discuss Aviation Contract Intelligence", "/request-demo"]]) {
        assert.equal(await page.getByRole("link", { name: label, exact: true }).getAttribute("href"), href);
      }
      await page.locator(".op-about-cta").scrollIntoViewIfNeeded();
      const layout = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
      assert.ok(layout.content <= layout.viewport + 1, `No ${width}px horizontal overflow: ${layout.content}`);
      for (const element of await page.locator(".op-about-roadmap article, .op-about-intelligence-path li, .op-founder-story, .op-about-cta .op-btn").all()) {
        assert.ok(await element.evaluate((node) => node.scrollWidth <= node.clientWidth + 1), "Cards, biography and CTA text remain contained");
      }
      assert.match(await page.title(), /About Operion/);
      assert.match(await page.locator('meta[name="description"]').getAttribute("content"), /Meelis Paloson/);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

test("favicon and Apple touch icons are real square PNGs with valid served assets", async () => {
  const { context, page } = await createPage(390);
  try {
    await page.goto(`${origin}/about`);
    for (const [selector, size] of [['link[rel="icon"][sizes="48x48"]', 48], ['link[rel="icon"][sizes="192x192"]', 192], ['link[rel="apple-touch-icon"]', 180]]) {
      const href = await page.locator(selector).getAttribute("href");
      const response = await page.request.get(`${origin}${href}`);
      assert.equal(response.status(), 200);
      const bytes = await response.body();
      assert.equal(bytes.subarray(1, 4).toString(), "PNG");
      assert.equal(bytes.readUInt32BE(16), size);
      assert.equal(bytes.readUInt32BE(20), size);
    }
  } finally { await context.close(); }
});

for (const route of ["/", "/product", "/demo/dashboard", "/demo/live-tracking"]) {
  test(`real mobile one-finger drag and pinch work on ${route}`, { timeout: 120000 }, async () => {
    const { context, page } = await createPage(390, true);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
      const canvas = page.locator(".od-cesium-globe canvas");
      await canvas.waitFor();
      await canvas.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => Number(document.querySelector(".od-cesium-globe")?.dataset.aircraftModelsReady) === 20);
      await page.getByRole("button", { name: /^Explore the fleet/ }).click();
      await page.locator(".od-dashboard-aircraft-list button").nth(3).click();
      const close = page.getByRole("button", { name: "Close aircraft infocard", exact: true });
      await close.click();
      await canvas.scrollIntoViewIfNeeded();
      const aircraftPixel = await canvas.evaluate((element) => {
        return { x: element.clientWidth / 2, y: element.clientHeight / 2 };
      });
      await canvas.screenshot();
      await canvas.tap({ position: aircraftPixel });
      await page.getByRole("dialog", { name: "SIM-004", exact: true }).waitFor();
      await close.click();
      assert.equal(await canvas.getAttribute("data-touch-navigation"), "drag-pinch");
      assert.equal(await canvas.evaluate((element) => getComputedStyle(element).touchAction), "none");
      const cdp = await context.newCDPSession(page);
      const box = await canvas.boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height * .45;
      const scrollBefore = await page.evaluate(() => scrollY);
      const touch = (id, x, y) => ({ id, x, y, radiusX: 3, radiusY: 3, force: 1 });
      const start = await canvas.screenshot();
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touch(1, x, y)] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touch(1, x + 40, y + 20)] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      assert.notDeepEqual(await canvas.screenshot(), start, "One-finger drag rotates the actual globe");
      assert.equal(await page.locator(".od-aircraft-popup").count(), 0, "Dragging does not select a marker");
      const gestures = [
        [[x - 25, y], [x + 25, y], [x - 65, y], [x + 65, y], "pinch"],
      ];
      for (const [a, b, nextA, nextB, kind] of gestures) {
        const before = await canvas.screenshot();
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touch(1, ...a), touch(2, ...b)] });
        for (let step = 1; step <= 8; step++) {
          const interpolate = (start, end) => start.map((value, index) => value + (end[index] - value) * step / 8);
          await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touch(1, ...interpolate(a, nextA)), touch(2, ...interpolate(b, nextB))] });
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        assert.notDeepEqual(await canvas.screenshot(), before, `Two-finger ${kind} changes the actual WebGL globe`);
      }
      assert.equal(await page.evaluate(() => visualViewport.scale), 1, "Pinch zooms globe, not the browser viewport");
      assert.equal(await page.evaluate(() => scrollY), scrollBefore, "Globe gestures do not scroll the page");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Mobile globe page does not overflow");
      if (route === "/demo/dashboard") {
        await page.getByRole("button", { name: "Map", exact: true }).click();
        await canvas.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000); // Cesium's configured globe-to-map morph takes 800ms.
        const mapBox = await canvas.boundingBox(), mx = mapBox.x + mapBox.width / 2, my = mapBox.y + mapBox.height / 2;
        const mapBefore = await canvas.screenshot();
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touch(1, mx, my)] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touch(1, mx + 30, my + 30)] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        assert.notDeepEqual(await canvas.screenshot(), mapBefore, "One-finger pan also works in 2D map mode");
      }
      assert.equal(await page.locator(".cesium-widget-errorPanel, .od-globe-control-error").count(), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}
