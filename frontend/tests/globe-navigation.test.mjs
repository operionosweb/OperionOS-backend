import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const origin = process.env.CORPORATE_TEST_URL || "http://127.0.0.1:4175";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)) throw new Error("Navigation checks require loopback");
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
  test(`native drag, pinch, release, reset, controls and page scrolling work at ${width}px`, { timeout: 240000 }, async () => {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: true, isMobile: width <= 900, reducedMotion: "reduce" });
    await context.route("**/*", (route) => route.request().method() === "GET" && new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await page.route("**/api/weather-maps/status", (route) => route.fulfill({ json: { configured: false } }));
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(`${origin}/demo/live-tracking`, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Decline", exact: true }).click();
      const canvas = page.locator(".od-cesium-globe canvas");
      const cameraPose = async () => {
        await canvas.screenshot();
        const pose = JSON.parse(await page.locator(".od-cesium-globe").getAttribute("data-camera-pose"));
        return JSON.stringify(pose.map((value) => Number(value.toFixed(9))));
      };
      await canvas.waitFor();
      await canvas.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => Number(document.querySelector(".od-cesium-globe")?.dataset.aircraftModelsReady) === 20);
      assert.equal(await page.locator(".od-aircraft-popup").count(), 0, "No flight is selected automatically");
      const reset = page.getByRole("button", { name: "Reset view", exact: true });
      await reset.click();
      await canvas.scrollIntoViewIfNeeded();
      const baseline = await cameraPose();
      const cdp = await context.newCDPSession(page);
      const box = await canvas.boundingBox();
      const x = box.x + box.width * .5, y = box.y + box.height * .45;
      const touch = (id, x, y) => ({ id, x, y, radiusX: 3, radiusY: 3, force: 1 });
      const dispatch = (type, touchPoints) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
      const scroll = await page.evaluate(() => scrollY);
      for (let attempt = 0; attempt < 2; attempt++) {
        const before = await cameraPose();
        await dispatch("touchStart", [touch(1, x, y)]);
        for (let step = 1; step <= 8; step++) await dispatch("touchMove", [touch(1, x + step * 5, y + step * 2)]);
        await dispatch("touchEnd", []);
        const released = await cameraPose();
        assert.notDeepEqual(released, before, "One finger rotates");
        await page.waitForTimeout(150);
        assert.equal(await cameraPose(), released, "Release stops without a jump or residual gesture");
        assert.equal(await page.locator(".od-aircraft-popup").count(), 0, "Drag never selects");
      }
      const beforePinch = await cameraPose();
      await dispatch("touchStart", [touch(1, x - 25, y), touch(2, x + 25, y)]);
      for (let step = 1; step <= 8; step++) await dispatch("touchMove", [touch(1, x - 25 - step * 4, y), touch(2, x + 25 + step * 4, y)]);
      await dispatch("touchEnd", []);
      assert.notEqual(await cameraPose(), beforePinch, "Pinch out zooms in");
      const beforeZoomOut = await cameraPose();
      await dispatch("touchStart", [touch(1, x - 57, y), touch(2, x + 57, y)]);
      for (let step = 1; step <= 8; step++) await dispatch("touchMove", [touch(1, x - 57 + step * 4, y), touch(2, x + 57 - step * 4, y)]);
      await dispatch("touchEnd", []);
      assert.notEqual(await cameraPose(), beforeZoomOut, "Pinch in zooms out");
      assert.equal(await page.evaluate(() => scrollY), scroll, "Active gestures do not scroll the page");
      assert.equal(await page.evaluate(() => visualViewport.scale), 1, "Pinch does not zoom the browser");
      await reset.click();
      assert.equal(await cameraPose(), baseline, "Reset restores the same level overview");
      const zoom = page.getByRole("button", { name: "Zoom in", exact: true });
      const target = await zoom.boundingBox();
      if (width <= 900) assert.ok(target.width >= 44 && target.height >= 44, "Comfortable mobile camera targets");
      await zoom.click();
      assert.notEqual(await cameraPose(), baseline, "Existing zoom control works");
      await reset.click();
      const shell = page.locator(".od-cesium-shell");
      await shell.getByRole("button", { name: /^Explore the fleet/ }).click();
      await shell.locator(".od-dashboard-aircraft-list button").first().click();
      await shell.getByRole("dialog", { name: "SIM-001", exact: true }).waitFor();
      await page.getByRole("button", { name: "Close aircraft infocard", exact: true }).click();
      if (width >= 1024) {
        await reset.click();
        const beforeMouse = await cameraPose();
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 70, y + 20, { steps: 8 });
        await page.mouse.up();
        assert.notEqual(await cameraPose(), beforeMouse, "Desktop mouse orbit remains intact");
        const beforeWheel = await cameraPose();
        await page.mouse.wheel(0, -150);
        await page.waitForTimeout(300);
        assert.notEqual(await cameraPose(), beforeWheel, "Desktop wheel zoom remains intact");
      }
      // Start on the surrounding content, not on the canvas or a fixed control.
      await page.locator(".od-page-header").scrollIntoViewIfNeeded();
      const header = await page.locator(".od-page-header").boundingBox();
      const sx = header.x + header.width * .5, sy = header.y + Math.min(header.height * .6, 100);
      const beforeScroll = await page.evaluate(() => scrollY);
      await dispatch("touchStart", [touch(1, sx, sy)]);
      for (let step = 1; step <= 8; step++) await dispatch("touchMove", [touch(1, sx, sy - step * 8)]);
      await dispatch("touchEnd", []);
      await page.waitForTimeout(150);
      assert.notEqual(await page.evaluate(() => scrollY), beforeScroll, "Normal page scroll works outside globe");
      assert.equal(new URL(page.url()).pathname, "/demo/live-tracking", "Gestures cannot navigate away");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []);
      assert.equal(await page.locator(".cesium-widget-errorPanel, .od-globe-control-error").count(), 0);
    } finally { await context.close(); }
  });
}

test("public, Demo and authenticated globes use the same authoritative touch handler", async () => {
  for (const file of ["../src/components/demoRedesign/CesiumFlightGlobe.jsx", "../src/components/aviation/ProductionFlightGlobe.jsx"]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(source, /attachGlobeTouchControls\(viewer, selectAtPosition\)/);
    assert.match(source, /aria-label="Reset view"/);
  }
});
