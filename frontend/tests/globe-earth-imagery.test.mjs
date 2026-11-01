import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";
import { chromium } from "@playwright/test";
import { texturedPixelStats } from "./helpers/pngPixels.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.VITE_SUPABASE_URL = "http://127.0.0.1:59998";
process.env.VITE_SUPABASE_ANON_KEY = "offline-globe-test";
process.env.VITE_API_BASE_URL = "";
let browser, server, origin;
before(async () => {
  await build({ root, mode: "globe-offline", logLevel: "error" });
  server = await preview({ root, preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); if (server) await new Promise((resolve) => server.httpServer.close(resolve)); });

async function earthPixels(page) {
  return texturedPixelStats(await page.locator(".od-cesium-globe canvas").screenshot({ timeout: 30000 }));
}

for (const width of [390, 1440]) {
  test(`real Earth renders on public/demo surfaces with all external imagery blocked at ${width}px`, { timeout: 180000 }, async () => {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    const page = await context.newPage(), errors = [], tiles = [];
    await page.clock.setFixedTime(new Date("2026-03-20T12:00:00Z"));
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.url().includes("/NaturalEarthII/") && response.url().endsWith(".jpg")) tiles.push(response.status());
    });
    await context.addInitScript(() => { localStorage.setItem("operion.consent", "declined"); });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/weather-maps/status") return route.fulfill({ json: { configured: false } });
      return url.origin === origin ? route.continue() : route.abort();
    });
    try {
      for (const route of ["/", "/product", "/demo/dashboard", "/demo/live-tracking"]) {
        console.log(`Checking Earth rendering: ${width}px ${route}`);
        await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
        await page.locator(".od-cesium-globe canvas").waitFor({ timeout: 30000 });
        await page.locator(".od-cesium-globe").scrollIntoViewIfNeeded();
        const decline = page.getByRole("button", { name: "Decline", exact: true });
        if (await decline.count()) await decline.click();
        let pixels;
        for (let attempt = 0; attempt < 20; attempt++) {
          pixels = await earthPixels(page);
          if (pixels.colors > 100 && pixels.colored > 0.4) break;
          await page.waitForTimeout(250);
        }
        assert.ok(pixels.colors > 100 && pixels.colored > 0.4, `${route}: textured geographic Earth, not blank pale background: ${JSON.stringify(pixels)}`);
        assert.ok(tiles.length > 0 && tiles.every((status) => status === 200), "Bundled Earth tiles load successfully");
        assert.equal(await page.locator(".od-globe-unavailable").count(), 0);
        assert.equal(await page.locator(".od-globe-imagery-status").count(), 0, "Default globe does not depend on blocked remote tiles");
        if (process.env.MATT_SCREENSHOT_DIR && route === "/demo/dashboard") {
          await page.locator(".od-cesium-globe").screenshot({ path: path.join(process.env.MATT_SCREENSHOT_DIR, `globe-earth-${width}.png`) });
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}
