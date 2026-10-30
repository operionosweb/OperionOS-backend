import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { chromium } from "@playwright/test";

const origin = process.env.CORPORATE_TEST_URL || "http://127.0.0.1:4175";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)) throw new Error("Offline UI tests require loopback");
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function createPage(width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
  await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.route("**/api/weather-maps/status", (route) => route.fulfill({ json: { configured: false } }));
  return { context, page };
}

for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
  test(`command centre controls, globe and records fit ${width}px`, async () => {
    const { context, page } = await createPage(width);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(`${origin}/demo/dashboard`, { waitUntil: "domcontentloaded" });
      await page.locator(".od-cesium-globe canvas").waitFor();
      await page.getByText("Layers, filters & legend", { exact: true }).click();
      await page.locator(".od-real-weather-layers summary").click();
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
      assert.ok(dimensions.content <= dimensions.viewport + 1, `${width}: ${dimensions.content}px content`);
      for (const region of ["Aviation Contract Intelligence Overview", "Priority Action Centre", "Contractual Financial Exposure", "Obligations and Critical Events", "Contract Portfolio and Supplier Dependencies", "External Risk Intelligence"]) {
        assert.equal(await page.getByRole("region", { name: region, exact: true }).count(), 1);
      }
      const canvas = await page.locator(".od-cesium-globe canvas").boundingBox();
      assert.ok(canvas.width > 180 && canvas.height >= 350, "Globe is useful rather than a tiny decoration");
      for (const selector of [".od-spatial-filter-grid select", ".od-command-filters input", ".od-command-area-nav button"]) {
        const boxes = await page.locator(selector).evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().toJSON()));
        assert.ok(boxes.every((box) => box.x >= 0 && box.x + box.width <= width + 1), `${selector}: controls fit the viewport`);
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

test("dashboard filters, review editing, financial evidence and obligation timing work together", async () => {
  const { context, page } = await createPage();
  try {
    await page.goto(`${origin}/demo/dashboard`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Contract", { exact: true }).selectOption("demo-aircraft-lease");
    const actions = page.getByRole("region", { name: "Priority Action Centre", exact: true });
    assert.equal(await actions.locator(".od-command-records > article").count(), 3);
    const action = actions.locator(".od-command-records > article").first();
    await action.getByText("Inspect supporting evidence", { exact: true }).click();
    assert.match(await action.locator("blockquote").innerText(), /airworthy condition/);
    await action.getByRole("button", { name: "Edit action review", exact: true }).click();
    await action.getByRole("button", { name: "Save review", exact: true }).click();
    await action.getByRole("alert").waitFor();
    await action.getByLabel("Responsible owner").fill("Demo contract reviewer");
    await action.getByLabel("Review status").selectOption("In review");
    await action.getByLabel("Notes / evidence reference").fill("Review prepared return conditions with the lessor.");
    await action.getByRole("button", { name: "Save review", exact: true }).click();
    assert.match(await action.innerText(), /Demo contract reviewer/);
    assert.match(await action.getByRole("status").innerText(), /No contract or external system was changed/);
    await action.getByRole("button", { name: "Edit action review", exact: true }).click();
    await action.getByLabel("Responsible owner").fill("Cancelled owner");
    await action.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.doesNotMatch(await action.innerText(), /Cancelled owner/);
    const exposure = page.getByRole("region", { name: "Contractual Financial Exposure", exact: true });
    assert.equal(await exposure.locator(".od-command-records > article").count(), 2);
    assert.match(await exposure.innerText(), /not validated liabilities/);
    const events = page.getByRole("region", { name: "Obligations and Critical Events", exact: true });
    await events.getByRole("button", { name: "Known absolute dates", exact: true }).click();
    assert.equal(await events.locator(".od-command-timeline article").count(), 1);
    assert.match(await events.innerText(), /31 Dec 2032/);
    await events.getByRole("button", { name: "Edit obligation review", exact: true }).click();
    await events.getByLabel("Responsible owner").fill("Demo technical records reviewer");
    await events.getByRole("button", { name: "Save review", exact: true }).click();
    assert.match(await events.innerText(), /Demo technical records reviewer/);
    await page.getByLabel("Search portfolio", { exact: true }).fill("NO SUCH CONTRACT");
    await page.getByText("No prepared contracts match these filters. Clear the filters to restore the portfolio.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Clear dashboard filters", exact: true }).click();
    assert.equal(await page.getByLabel("Search portfolio", { exact: true }).inputValue(), "");
  } finally { await context.close(); }
});

test("all globe routes have identical schema controls, composable filters and keyboard spatial selection", { timeout: 180000 }, async () => {
  const { context, page } = await createPage();
  let baseline;
  try {
    for (const route of ["/", "/product", "/demo/dashboard", "/demo/live-tracking"]) {
      await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
      await page.getByText("Layers, filters & legend", { exact: true }).click();
      const schema = await page.locator(".od-spatial-layer-grid label").allTextContents();
      if (!baseline) baseline = schema;
      assert.deepEqual(schema, baseline, `${route}: identical layers and availability`);
      const filters = page.locator(".od-spatial-filter-grid");
      await filters.getByLabel("Aircraft type", { exact: true }).selectOption("A320neo");
      await filters.getByLabel("Airline / operator", { exact: true }).selectOption("Skyward Airlines");
      assert.match(await page.locator(".od-dashboard-globe-footer").innerText(), /1 aircraft shown/);
      assert.equal(await page.locator(".od-dashboard-selected-heading h3").innerText(), "G-OPRA");
      await page.getByRole("button", { name: "Clear globe filters", exact: true }).click();
      assert.match(await page.locator(".od-dashboard-globe-footer").innerText(), /12 aircraft shown/);
      await page.locator(".od-spatial-layer-grid").getByText("Airports and aviation hubs", { exact: true }).click();
      await page.getByText("Browse visible spatial records (keyboard accessible)", { exact: true }).click();
      await page.locator(".od-spatial-object-list").getByRole("button", { name: "LHR · airports", exact: true }).click();
      await page.getByText("Airport on a prepared route. Route association does not establish an airport service agreement.", { exact: true }).waitFor();
      assert.ok(await page.getByRole("button", { name: "Close spatial record", exact: true }).isVisible());
      await page.getByRole("button", { name: "Close spatial record", exact: true }).click();
      if (route === "/demo/live-tracking") {
        assert.equal(await page.locator(".od-dependency-section").count(), 1, "Tracking dependency workspace remains available");
      }
    }
  } finally { await context.close(); }
});

for (const width of [1440, 390, 320]) {
  test(`aircraft clicks open an infocard inside every globe at ${width}px`, { timeout: 180000 }, async () => {
    const { context, page } = await createPage(width);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      for (const route of ["/", "/product", "/demo/dashboard", "/demo/live-tracking"]) {
        await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
        const globe = page.locator(".od-cesium-shell");
        const canvas = globe.locator("canvas");
        await canvas.waitFor();
        await page.waitForFunction(() => Number(document.querySelector(".od-cesium-globe")?.dataset.aircraftModelsReady) > 0);
        const popup = globe.getByRole("dialog", { name: "G-OPER", exact: true });
        await popup.waitFor();
        await popup.getByRole("button", { name: "Close aircraft infocard", exact: true }).click();
        assert.equal(await globe.getByRole("dialog").count(), 0);
        await canvas.scrollIntoViewIfNeeded();
        // The selected aircraft is centred by the real Cesium camera. Click its
        // rendered status silhouette, exercising actual model picking rather
        // than a React handler or a separate invisible selection marker.
        const position = await canvas.evaluate((element) => {
          const gl = element.getContext("webgl2") || element.getContext("webgl");
          const pixels = new Uint8Array(element.width * element.height * 4);
          gl.readPixels(0, 0, element.width, element.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          let best = null, distance = Infinity;
          for (let y = 0; y < element.height; y++) {
            for (let x = 0; x < element.width; x++) {
              const i = (y * element.width + x) * 4;
              if (Math.abs(pixels[i] - 76) > 5 || Math.abs(pixels[i + 1] - 209) > 5 || Math.abs(pixels[i + 2] - 140) > 5) continue;
              const next = (x - element.width / 2) ** 2 + (y - element.height / 2) ** 2;
              if (next < distance) { distance = next; best = { x: x * element.clientWidth / element.width, y: (element.height - y - 1) * element.clientHeight / element.height }; }
            }
          }
          return best;
        });
        assert.ok(position, `${route}: the actual selected aircraft marker is rendered`);
        await canvas.click({ position });
        await popup.waitFor();
        assert.equal(await globe.locator(".cesium-widget-errorPanel, .od-globe-control-error").count(), 0, "Models render without Cesium or asset errors");
        const bounds = await popup.boundingBox();
        const mapBounds = await globe.boundingBox();
        assert.ok(bounds.x >= mapBounds.x && bounds.y >= mapBounds.y, "Popup starts within the globe");
        assert.ok(bounds.x + bounds.width <= mapBounds.x + mapBounds.width + 1 && bounds.y + bounds.height <= mapBounds.y + mapBounds.height + 1, "Popup stays inside the globe on desktop/mobile");
        const controls = await globe.locator(".od-map-controls").boundingBox();
        if (width < 768) assert.ok(controls.y + controls.height <= bounds.y, "Full-width mobile popup leaves map controls accessible above it");
        else assert.ok(bounds.x + bounds.width <= controls.x, "Popup leaves map controls accessible");
        assert.equal(await page.locator(".od-dashboard-flight-inspector .od-dashboard-flight-details").count(), 0, "No duplicate infocard below the globe");
        assert.match(await popup.innerText(), /Skyward Airlines/);
        assert.match(await popup.getByRole("link").first().getAttribute("href"), /\/demo\/contracts\//);
        await popup.getByRole("button", { name: "Close aircraft infocard", exact: true }).focus();
        await page.keyboard.press("Escape");
        assert.equal(await globe.getByRole("dialog").count(), 0);
        await globe.getByRole("button", { name: "Explore the fleet", exact: true }).click();
        await page.locator(".od-dashboard-aircraft-list button").nth(1).click();
        await globe.getByRole("dialog", { name: "G-OPRA", exact: true }).waitFor();
        if (route === "/demo/dashboard" && width === 1440) {
          await page.getByRole("button", { name: "Full screen", exact: true }).click();
          await page.getByRole("button", { name: "Exit full screen", exact: true }).waitFor();
          assert.equal(await globe.getByRole("dialog").evaluate((element) => document.fullscreenElement?.contains(element)), true, "Popup remains inside fullscreen content");
          await page.getByRole("button", { name: "Exit full screen", exact: true }).click();
          await page.getByRole("button", { name: "Full screen", exact: true }).waitFor();
        }

        const dimensions = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
        assert.ok(dimensions.content <= dimensions.viewport + 1);
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

test("missing 3D asset is reported explicitly without breaking aircraft details", async () => {
  const { context, page } = await createPage();
  try {
    await page.route("**/models/operion-airliner.glb", (route) => route.fulfill({ status: 404, body: "Not found" }));
    await page.goto(`${origin}/demo/dashboard`, { waitUntil: "domcontentloaded" });
    await page.getByText("3D aircraft are unavailable. Select aircraft from the fleet list to inspect their details.", { exact: true }).waitFor();
    assert.equal(await page.locator(".od-cesium-globe").getAttribute("data-aircraft-models-ready"), "0");
    await page.getByRole("button", { name: "Explore the fleet", exact: true }).click();
    await page.locator(".od-dashboard-aircraft-list button").nth(1).click();
    await page.getByRole("dialog", { name: "G-OPRA", exact: true }).waitFor();
  } finally { await context.close(); }
});
