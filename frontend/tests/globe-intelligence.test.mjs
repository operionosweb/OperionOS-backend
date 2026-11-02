import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { chromium } from "@playwright/test";
import { decodeScreenshot, texturedPixelStats } from "./helpers/pngPixels.mjs";
import { createDemonstrationAircraft } from "../src/demo/globeIntelligenceData.js";

const origin = process.env.CORPORATE_TEST_URL || "http://127.0.0.1:4192";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)) throw new Error("Globe acceptance requires loopback");
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function fixture(width = 1440, solarTime = "2026-03-20T12:00:00Z") {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce", hasTouch: width < 900 });
  await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.route("**/api/weather-maps/status", (route) => route.fulfill({ json: { configured: false } }));
  const page = await context.newPage();
  if (solarTime) await page.clock.setFixedTime(new Date(solarTime));
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/demo/live-tracking`, { waitUntil: "domcontentloaded" });
  const consent = page.getByRole("button", { name: "Decline", exact: true });
  if (await consent.isVisible()) await consent.click();
  const shell = page.locator(".od-cesium-shell");
  await shell.locator("canvas").waitFor();
  await shell.scrollIntoViewIfNeeded();
  return { context, page, shell, errors };
}

async function openFleet(shell) {
  await shell.getByRole("button", { name: /Explore the fleet/ }).click();
  return shell.getByRole("dialog", { name: "Explore the fleet", exact: true });
}
async function fits(panel, shell) {
  const bounds = await panel.boundingBox(), globe = await shell.boundingBox();
  assert.ok(bounds.x >= globe.x - 1 && bounds.y >= globe.y - 1);
  assert.ok(bounds.x + bounds.width <= globe.x + globe.width + 1 && bounds.y + bounds.height <= globe.y + globe.height + 1);
  assert.equal(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), true);
}

function darkPixelRatio(png) {
  const { width, height, channels, pixels } = decodeScreenshot(png);
  let dark = 0;
  for (let x = 0; x < pixels.length; x += channels) if (Math.max(pixels[x], pixels[x + 1], pixels[x + 2]) < 30) dark++;
  return dark / (width * height);
}

test("UTC noon and midnight change actual geographic Earth lighting, not just a clock label", { timeout: 120000 }, async () => {
  const samples = [];
  for (const hour of ["12", "00"]) {
    const { context, page, errors } = await fixture(1440, `2026-03-20T${hour}:00:00Z`);
    try {
      await page.waitForFunction(() => Number(document.querySelector(".od-cesium-globe")?.dataset.aircraftModelsReady) === 20);
      await page.waitForLoadState("networkidle");
      const image = decodeScreenshot(await page.locator(".od-cesium-globe canvas").screenshot());
      let sum = 0, count = 0;
      for (let y = Math.floor(image.height * 0.35); y < image.height * 0.65; y++) {
        for (let x = Math.floor(image.width * 0.4); x < image.width * 0.6; x++) {
          const i = (y * image.width + x) * image.channels;
          sum += (image.pixels[i] + image.pixels[i + 1] + image.pixels[i + 2]) / 3;
          count++;
        }
      }
      samples.push(sum / count);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  console.log(`Earth central luminance: noon ${samples[0].toFixed(1)}, midnight ${samples[1].toFixed(1)}`);
  assert.ok(samples[0] - samples[1] > 20, "Geographic surface must visibly darken on its UTC night side");
  assert.ok(samples[1] > 10, "Night-side geography remains discernible");
});

test("blocked satellite detail retains real Earth and reports degradation without blocking access", { timeout: 60000 }, async () => {
  const { context, page, errors } = await fixture();
  try {
    await page.getByRole("button", { name: "Satellite", exact: true }).click();
    await page.locator(".od-globe-imagery-status").getByText("Detailed map imagery is unavailable. The geographic Earth base remains visible.", { exact: true }).waitFor();
    const pixels = texturedPixelStats(await page.locator(".od-cesium-globe canvas").screenshot());
    assert.ok(pixels.colors > 100 && pixels.colored > 0.4, `Geographic Earth remains visible: ${JSON.stringify(pixels)}`);
    assert.equal(await page.locator(".od-globe-unavailable").count(), 0);
    await page.getByRole("button", { name: "Standard", exact: true }).click();
    await page.locator(".od-globe-imagery-status").waitFor({ state: "hidden" });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test("all public and demo Globe entrypoints start unselected with twenty explicitly simulated flights", { timeout: 120000 }, async () => {
  const { context, page, errors } = await fixture();
  try {
    for (const path of ["/", "/product", "/demo/dashboard", "/demo/live-tracking"]) {
      await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
      const shell = page.locator(".od-cesium-shell");
      await shell.locator("canvas").waitFor();
      await page.waitForFunction(() => Number(document.querySelector(".od-cesium-globe")?.dataset.aircraftModelsReady) === 20);
      assert.equal(await shell.getByRole("dialog").count(), 0, "No visible dialog opens automatically");
      assert.equal(await shell.locator(".od-aircraft-popup").count(), 0);
      assert.equal(await shell.locator(".od-globe-alerts").count(), 0);
      await page.getByText("20 simulated flights shown", { exact: true }).waitFor();
      assert.ok(await page.getByText("ILLUSTRATIVE DEMONSTRATION DATA — NOT LIVE FLIGHT OR CONTRACT DATA.", { exact: true }).count());
      const fleet = await openFleet(shell);
      assert.equal(await fleet.locator(".od-dashboard-aircraft-list > button").count(), 20);
      await fleet.getByRole("button", { name: "Close fleet filters" }).click();
      const blackRatio = darkPixelRatio(await shell.screenshot());
      console.log(`Initial Globe ${path}: ${(blackRatio * 100).toFixed(2)}% near-black pixels`);
      assert.ok(blackRatio < 0.1, "Initial framing must not contain a large black region");
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test("fleet combinations, removable chips, counts, presets, explicit Global and reset match visible aircraft", async () => {
  const { context, page, shell, errors } = await fixture();
  try {
    const fleet = await openFleet(shell);
    await fleet.getByText("Combine detailed filters", { exact: true }).click();
    await fleet.getByLabel("Country", { exact: true }).selectOption("Spain");
    await fleet.getByLabel("Detailed flight status", { exact: true }).selectOption("Delayed");
    assert.equal(await fleet.locator(".od-dashboard-aircraft-list > button").count(), 2);
    assert.match(await fleet.locator(".od-dashboard-aircraft-list").innerText(), /SIM-006/);
    assert.match(await fleet.locator(".od-intelligence-active-filters").innerText(), /2 active filters/);
    await fleet.getByRole("button", { name: "Remove Country filter", exact: true }).click();
    assert.equal(await fleet.locator(".od-dashboard-aircraft-list > button").count(), 10);
    assert.equal(await fleet.getByLabel("Cancelled", { exact: true }).locator('option[value="Yes"]').count(), 0, "No cancellation fixture is invented");
    await fleet.getByLabel("Aircraft model", { exact: true }).selectOption("A350-1000");
    await fleet.getByText("No aircraft match these filters.", { exact: true }).waitFor();
    await fleet.getByRole("button", { name: "Clear fleet filters" }).click();
    assert.equal(await fleet.locator(".od-dashboard-aircraft-list > button").count(), 20);
    await fleet.getByLabel("Market context", { exact: true }).selectOption("Europe");
    assert.match(await fleet.locator(".od-intelligence-active-filters").innerText(), /1 active filters/);
    assert.equal(await fleet.locator(".od-dashboard-aircraft-list > button").count(), 11);
    await fleet.getByLabel("Market context", { exact: true }).selectOption("Global");
    assert.equal(await fleet.locator(".od-dashboard-aircraft-list > button").count(), 20);
    await fleet.getByRole("button", { name: "High exposure review", exact: true }).click();
    assert.equal(await fleet.locator(".od-dashboard-aircraft-list > button").count(), 1);
    await fleet.locator(".od-dashboard-aircraft-list > button").click();
    const card = shell.getByRole("dialog", { name: "SIM-010", exact: true });
    await card.waitFor();
    assert.match(await card.innerText(), /EUR 391/);
    await card.getByRole("button", { name: "Close aircraft infocard" }).click();
    const restored = await openFleet(shell);
    assert.equal(await restored.locator(".od-dashboard-aircraft-list > button").count(), 1);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test("every aircraft card renders its own flight, supplied details and exposure without borrowing another agreement", async () => {
  const { context, shell, errors } = await fixture();
  try {
    for (const [index, aircraft] of createDemonstrationAircraft().entries()) {
      const fleet = await openFleet(shell);
      await fleet.locator(".od-dashboard-aircraft-list > button").nth(index).click();
      const card = shell.getByRole("dialog", { name: aircraft.registration, exact: true });
      await card.waitFor();
      await card.getByText("Aircraft and flight details", { exact: true }).click();
      await card.locator(".od-dashboard-flight-facts").getByText(aircraft.flightNumber, { exact: true }).waitFor();
      assert.match(await card.innerText(), new RegExp(aircraft.flightNumber));
      assert.match(await card.innerText(), new RegExp(aircraft.intelligence.exposure.state));
      assert.equal(await card.locator(".od-dashboard-flight-facts").getByText(aircraft.scheduledArrival, { exact: true }).count() >= 1, true);
      await card.getByText("Contract evidence and obligations", { exact: true }).click();
      await card.getByText(`Deadline: ${aircraft.intelligence.contract.obligation?.deadline || "Not established"}`, { exact: true }).waitFor();
      assert.ok((await card.innerText()).includes(aircraft.intelligence.contract.clause?.source || "Insufficient evidence"));
      await card.getByRole("button", { name: "Inspect associated contract" }).click();
      const contract = shell.getByRole("dialog", { name: "Contextual contract inspection" });
      assert.ok((await contract.innerText()).includes(aircraft.intelligence.contract.id));
      await contract.getByRole("button", { name: "Return to aircraft" }).click();
      await card.getByRole("button", { name: "Close aircraft infocard" }).click();
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test("alerts select the correct aircraft, highlight the alert and inspect only its contextual agreement in place", async () => {
  const { context, page, shell, errors } = await fixture();
  try {
    await shell.getByRole("button", { name: /^Alerts / }).click();
    const alerts = shell.getByRole("dialog", { name: "Globe alerts", exact: true });
    await alerts.getByText("Combine detailed filters", { exact: true }).click();
    await alerts.getByLabel("Aircraft", { exact: true }).selectOption("SIM-010");
    await alerts.getByLabel("Alert category", { exact: true }).selectOption("Financial exposure");
    assert.equal(await alerts.locator(".od-intelligence-alert-list > button").count(), 1);
    await alerts.locator(".od-intelligence-alert-list > button").click();
    const card = shell.getByRole("dialog", { name: "SIM-010", exact: true });
    await card.waitFor();
    assert.match(await card.locator(".od-intelligence-selected-alert").innerText(), /Hypothetical scenario arithmetic — not confirmed/);
    const canvas = await shell.locator("canvas").elementHandle();
    await page.waitForFunction(() => Number(document.querySelector(".od-cesium-globe")?.dataset.aircraftModelsReady) === 20);
    await page.waitForLoadState("networkidle");
    const globePixels = await canvas.evaluate((element) => element.toDataURL());
    const cameraPose = await shell.locator(".od-cesium-globe").getAttribute("data-camera-pose");
    assert.equal(JSON.parse(cameraPose).length, 9, "Rendered camera position, direction and up vectors are available");
    const url = page.url();
    await card.getByRole("button", { name: "Inspect associated contract" }).click();
    const contract = shell.getByRole("dialog", { name: "Contextual contract inspection", exact: true });
    await contract.waitFor();
    assert.match(await contract.innerText(), /illustrative-flight-contract-10/);
    assert.match(await contract.innerText(), /EUR 391/);
    assert.match(await contract.innerText(), /invented for this demonstration/);
    assert.equal(page.url(), url);
    assert.equal(await shell.locator("canvas").evaluate((element, original) => element === original, canvas), true, "Renderer remains mounted during contract inspection");
    const nextPixels = await canvas.evaluate((element) => element.toDataURL());
    const originalImage = decodeScreenshot(Buffer.from(globePixels.split(",")[1], "base64"));
    const nextImage = decodeScreenshot(Buffer.from(nextPixels.split(",")[1], "base64"));
    assert.deepEqual([nextImage.width, nextImage.height, nextImage.channels], [originalImage.width, originalImage.height, originalImage.channels]);
    // Solar shading and progressive texture repaint can change pixels without moving the camera.
    const nextPose = JSON.parse(await shell.locator(".od-cesium-globe").getAttribute("data-camera-pose"));
    JSON.parse(cameraPose).forEach((value, index) => assert.ok(Math.abs(value - nextPose[index]) <= (index < 3 ? 1e-6 : 1e-12),
      "Contract inspection preserves position within one micrometre and orientation within floating-point precision"));
    assert.ok(texturedPixelStats(Buffer.from(nextPixels.split(",")[1], "base64")).colors > 100,
      "Geographic Earth remains textured while the contract is inspected");
    await contract.getByRole("button", { name: "Return to aircraft" }).press("Escape");
    await card.waitFor();
    assert.equal(await card.locator(".od-intelligence-selected-alert").count(), 1);
    assert.equal(await card.getByRole("button", { name: "Inspect associated contract" }).evaluate((element) => element === document.activeElement), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test("selected-flight Matt resolves a finding follow-up without borrowing another contract or changing flight facts", async () => {
  const { context, page, shell, errors } = await fixture();
  const aircraft = createDemonstrationAircraft()[1];
  try {
    const fleet = await openFleet(shell);
    await fleet.locator(".od-dashboard-aircraft-list > button").nth(1).click();
    const card = shell.getByRole("dialog", { name: aircraft.registration, exact: true });
    await card.getByRole("button", { name: "Ask Matt about this flight", exact: true }).click();
    const matt = page.getByRole("dialog", { name: "Matt contextual assistant", exact: true });
    await matt.locator(`[data-context="${aircraft.id}"]`).waitFor();
    await matt.getByRole("checkbox", { name: "Show response text", exact: true }).check();
    await matt.getByRole("button", { name: "Type a question", exact: true }).click();
    const input = matt.getByRole("textbox", { name: "Ask Matt", exact: true });
    await input.fill("Explain the associated contract");
    await matt.getByRole("button", { name: "Send", exact: true }).click();
    await matt.locator(".matt-answer").waitFor();
    assert.ok((await matt.locator(".matt-answer").innerText()).includes(aircraft.intelligence.contract.title));
    await input.fill("Explain the second finding and its potential financial exposure");
    await matt.getByRole("button", { name: "Send", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".matt-floating-panel .matt-findings")?.children.length === 1);
    assert.ok((await matt.locator(".matt-findings").innerText()).includes(aircraft.intelligence.contract.obligation.title));
    assert.match(await matt.locator(".matt-answer").innerText(), /fictional scenario/);
    await matt.getByText(/Supporting source evidence \(/).click();
    assert.ok((await matt.locator(".od-evidence").innerText()).includes(aircraft.intelligence.contract.clause.source));
    await matt.getByRole("button", { name: "Close Matt panel", exact: true }).click();
    assert.match(await card.innerText(), /SIM-002/);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
  test(`aircraft, contextual contract and alerts retain visible Globe and usable controls at ${width}px`, async () => {
    const { context, page, shell, errors } = await fixture(width);
    try {
      const fleet = await openFleet(shell);
      await fits(fleet, shell);
      await fleet.locator(".od-dashboard-aircraft-list > button").nth(1).click();
      const card = shell.getByRole("dialog", { name: "SIM-002", exact: true });
      await card.waitFor();
      await fits(card, shell);
      await card.getByRole("button", { name: "Inspect associated contract" }).click();
      const contract = shell.getByRole("dialog", { name: "Contextual contract inspection", exact: true });
      await fits(contract, shell);
      const panelBox = await contract.boundingBox(), globeBox = await shell.boundingBox();
      assert.ok(panelBox.height < globeBox.height && panelBox.width <= globeBox.width, "Globe remains visible behind panel");
      const controls = await shell.locator(".od-map-controls").boundingBox();
      assert.ok(panelBox.y >= controls.y + controls.height - 1 || panelBox.x + panelBox.width <= controls.x, "Map controls remain uncovered");
      await contract.getByRole("button", { name: "Return to aircraft" }).click();
      await card.getByRole("button", { name: "Close aircraft infocard" }).click();
      await shell.getByRole("button", { name: /^Alerts / }).click();
      const alerts = shell.getByRole("dialog", { name: "Globe alerts", exact: true });
      await fits(alerts, shell);
      await alerts.getByRole("button", { name: "Close globe alerts" }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}
