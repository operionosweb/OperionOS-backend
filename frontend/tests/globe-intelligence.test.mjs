import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { chromium } from "@playwright/test";
import { inflateSync } from "node:zlib";
import { createDemonstrationAircraft } from "../src/demo/globeIntelligenceData.js";

const origin = process.env.CORPORATE_TEST_URL || "http://127.0.0.1:4192";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)) throw new Error("Globe acceptance requires loopback");
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function fixture(width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce", hasTouch: width < 900 });
  await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.route("**/api/weather-maps/status", (route) => route.fulfill({ json: { configured: false } }));
  const page = await context.newPage();
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
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  const channels = png[25] === 6 ? 4 : 3;
  assert.ok([2, 6].includes(png[25]) && png[24] === 8, "Screenshot is an 8-bit RGB/RGBA PNG");
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const size = png.readUInt32BE(offset), type = png.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") chunks.push(png.subarray(offset + 8, offset + 8 + size));
    offset += 12 + size;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * channels;
  let prior = Buffer.alloc(stride), dark = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? row[x - channels] : 0, up = prior[x], upperLeft = x >= channels ? prior[x - channels] : 0;
      const p = left + up - upperLeft;
      const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upperLeft);
      const prediction = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : pa <= pb && pa <= pc ? left : pb <= pc ? up : upperLeft;
      row[x] = (raw[y * (stride + 1) + 1 + x] + prediction) & 255;
    }
    for (let x = 0; x < stride; x += channels) if (Math.max(row[x], row[x + 1], row[x + 2]) < 30) dark++;
    prior = row;
  }
  return dark / (width * height);
}

test("all public and demo Globe entrypoints start unselected with ten explicitly fictional flights", { timeout: 120000 }, async () => {
  const { context, page, errors } = await fixture();
  try {
    for (const path of ["/", "/product", "/demo/dashboard", "/demo/live-tracking"]) {
      await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
      const shell = page.locator(".od-cesium-shell");
      await shell.locator("canvas").waitFor();
      await page.waitForFunction(() => Number(document.querySelector(".od-cesium-globe")?.dataset.aircraftModelsReady) === 10);
      assert.equal(await shell.getByRole("dialog").count(), 0, "No visible dialog opens automatically");
      assert.equal(await shell.locator(".od-aircraft-popup").count(), 0);
      assert.equal(await shell.locator(".od-globe-alerts").count(), 0);
      await page.getByText("10 aircraft shown", { exact: true }).waitFor();
      assert.ok(await page.getByText("ILLUSTRATIVE DEMONSTRATION DATA — NOT LIVE FLIGHT OR CONTRACT DATA.", { exact: true }).count());
      const fleet = await openFleet(shell);
      assert.equal(await fleet.locator(".od-dashboard-aircraft-list > button").count(), 10);
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
    assert.equal(await fleet.locator(".od-dashboard-aircraft-list > button").count(), 1);
    assert.match(await fleet.locator(".od-dashboard-aircraft-list").innerText(), /G-OPRA/);
    assert.match(await fleet.locator(".od-intelligence-active-filters").innerText(), /2 active filters/);
    await fleet.getByRole("button", { name: "Remove Country filter", exact: true }).click();
    assert.equal(await fleet.locator(".od-dashboard-aircraft-list > button").count(), 4);
    await fleet.getByLabel("Cancelled", { exact: true }).selectOption("Yes");
    await fleet.getByText("No aircraft match these filters.", { exact: true }).waitFor();
    await fleet.getByRole("button", { name: "Clear fleet filters" }).click();
    assert.equal(await fleet.locator(".od-dashboard-aircraft-list > button").count(), 10);
    await fleet.getByLabel("Market context", { exact: true }).selectOption("Global");
    assert.match(await fleet.locator(".od-intelligence-active-filters").innerText(), /1 active filters/);
    await fleet.getByRole("button", { name: "High exposure review", exact: true }).click();
    assert.equal(await fleet.locator(".od-dashboard-aircraft-list > button").count(), 1);
    await fleet.locator(".od-dashboard-aircraft-list > button").click();
    const card = shell.getByRole("dialog", { name: "DEMO-009", exact: true });
    await card.waitFor();
    assert.match(await card.innerText(), /EUR 350/);
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
    await alerts.getByLabel("Aircraft", { exact: true }).selectOption("DEMO-009");
    await alerts.getByLabel("Alert category", { exact: true }).selectOption("Financial exposure");
    assert.equal(await alerts.locator(".od-intelligence-alert-list > button").count(), 1);
    await alerts.locator(".od-intelligence-alert-list > button").click();
    const card = shell.getByRole("dialog", { name: "DEMO-009", exact: true });
    await card.waitFor();
    assert.match(await card.locator(".od-intelligence-selected-alert").innerText(), /Exposure quantified/);
    const canvas = await shell.locator("canvas").elementHandle();
    await page.waitForFunction(() => Number(document.querySelector(".od-cesium-globe")?.dataset.aircraftModelsReady) === 10);
    const globePixels = await canvas.evaluate((element) => element.toDataURL());
    const url = page.url();
    await card.getByRole("button", { name: "Inspect associated contract" }).click();
    const contract = shell.getByRole("dialog", { name: "Contextual contract inspection", exact: true });
    await contract.waitFor();
    assert.match(await contract.innerText(), /illustrative-flight-contract-9/);
    assert.match(await contract.innerText(), /EUR 350/);
    assert.match(await contract.innerText(), /before exclusions/);
    assert.equal(page.url(), url);
    assert.equal(await shell.locator("canvas").evaluate((element, original) => element === original, canvas), true, "Renderer remains mounted during contract inspection");
    assert.equal(await canvas.evaluate((element) => element.toDataURL()), globePixels, "Contract inspection preserves the actual camera/framing and simulation frame");
    await contract.getByRole("button", { name: "Return to aircraft" }).press("Escape");
    await card.waitFor();
    assert.equal(await card.locator(".od-intelligence-selected-alert").count(), 1);
    assert.equal(await card.getByRole("button", { name: "Inspect associated contract" }).evaluate((element) => element === document.activeElement), true);
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
      const card = shell.getByRole("dialog", { name: "G-OPRA", exact: true });
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
