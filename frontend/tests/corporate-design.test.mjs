import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium } from "@playwright/test";

const origin = process.env.CORPORATE_TEST_URL || "http://127.0.0.1:5173";
const target = new URL(origin);
if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) {
  throw new Error("Corporate UI checks require an explicit loopback frontend.");
}

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function createPage(width = 1440) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    reducedMotion: "reduce",
  });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol.startsWith("http") && url.origin !== target.origin) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  await page.route("**/api/weather-maps/status", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ configured: false }),
  }));
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(30000);
  return { context, page };
}

const routes = [
  "/", "/about", "/product", "/aviation", "/how-it-works", "/solutions",
  "/scenarios", "/enterprise", "/security", "/request-demo", "/login",
  "/privacy", "/legal", "/industries", "/resources", "/intelligence",
];

for (const width of [1440, 768, 390, 320]) {
  test(`all corporate routes render without page errors or horizontal overflow at ${width}px`, async () => {
    const { context, page } = await createPage(width);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      for (const route of routes) {
        await page.goto(`${target.origin}${route}`, { waitUntil: "domcontentloaded" });
        await page.locator("#corporate-main h1").waitFor();
        await page.locator(".op-corporate-footer").scrollIntoViewIfNeeded();
        const dimensions = await page.evaluate(() => ({
          viewport: innerWidth,
          content: document.documentElement.scrollWidth,
        }));
        assert.ok(dimensions.content <= dimensions.viewport + 1, `${route}: ${dimensions.content}px content exceeds ${width}px viewport`);
        assert.equal(await page.locator("#corporate-main h1").count(), 1, `${route}: one primary heading`);
        assert.equal(await page.locator(".op-corporate-shell").getAttribute("data-op-theme"), "light");
        assert.equal(await page.locator(".op-corporate-shell").evaluate((el) => getComputedStyle(el).getPropertyValue("--op-color-accent").trim()), "#0066f5");
        assert.equal(await page.locator(".oaero-hero, .oaero-simple-hero, .op-policy-hero, .op-login-hero").count(), 1, `${route}: shared corporate hero styling`);
        assert.equal(await page.locator(".oaero-hero-visual").count(), route === "/" ? 1 : 0, `${route}: 3D aircraft hero is Home-only`);
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

test("aircraft renders, supports view controls, and capability panels expand", async () => {
  const { context, page } = await createPage();
  try {
    await page.goto(target.origin);
    const aircraft = page.locator(".oaero-aircraft canvas");
    await aircraft.waitFor();
    const aircraftBox = await aircraft.boundingBox();
    const beforeOrbit = await aircraft.screenshot();
    await page.mouse.move(aircraftBox.x + aircraftBox.width / 2, aircraftBox.y + aircraftBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(aircraftBox.x + aircraftBox.width / 2 + 90, aircraftBox.y + aircraftBox.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    assert.notDeepEqual(await aircraft.screenshot(), beforeOrbit, "Dragging changes the aircraft view");
    const beforeZoom = await aircraft.screenshot();
    await page.getByRole("button", { name: "Zoom aircraft in", exact: true }).click();
    await page.waitForTimeout(100);
    assert.notDeepEqual(await aircraft.screenshot(), beforeZoom, "Zoom changes the rendered aircraft view");
    await page.getByRole("button", { name: "Rotate aircraft automatically", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Rotate aircraft automatically", exact: true }).getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "Reset aircraft view", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Rotate aircraft automatically", exact: true }).getAttribute("aria-pressed"), "false");
    await page.locator(".oaero-layer").nth(2).getByRole("button").click();
    assert.equal(await page.locator("#oaero-layer-2").isVisible(), true);
    assert.equal(await page.locator("#oaero-layer-0").isVisible(), false);
  } finally { await context.close(); }
});

test("Home cockpit follows its introduction and shares aircraft selection with Platform", async () => {
  const { context, page } = await createPage();
  try {
    await page.goto(target.origin);
    const section = page.locator("#executive-cockpit");
    const canvas = section.locator("canvas");
    await canvas.scrollIntoViewIfNeeded();
    const heading = await section.locator("#cockpit-preview-title").boundingBox();
    const cockpit = await section.locator(".od-dashboard-aviation").boundingBox();
    assert.ok(heading.y + heading.height < cockpit.y, "Cockpit is below the A real view introduction");
    await section.getByRole("button", { name: "Pause simulation", exact: true }).click();
    const original = await canvas.screenshot();
    for (const name of ["Clouds", "Weather", "Wind", "Routes"]) {
      const button = section.getByRole("button", { name, exact: true });
      const previous = await button.getAttribute("aria-pressed");
      await button.click();
      assert.notEqual(await button.getAttribute("aria-pressed"), previous);
    }
    await section.getByRole("button", { name: "Zoom in", exact: true }).click();
    await page.waitForTimeout(100);
    assert.notDeepEqual(await canvas.screenshot(), original);
    await section.getByRole("button", { name: "Delayed", exact: true }).click();
    assert.match(await section.locator(".od-dashboard-globe-footer").innerText(), /2 aircraft shown/);
    const flights = section.locator(".od-dashboard-aircraft-list").getByRole("button");
    await section.getByRole("button", { name: "Explore the fleet", exact: true }).click();
    assert.equal(await flights.count(), 2);
    await flights.nth(1).click();
    assert.equal(await section.locator(".od-dashboard-selected-heading h3").innerText(), "ZS-SXX");
    await section.getByRole("button", { name: "Diverted", exact: true }).click();
    assert.equal(await section.locator(".od-dashboard-selected-heading h3").innerText(), "VT-ANA");
    assert.match(await section.locator(".od-flight-contract-links a").first().getAttribute("href"), /\/demo\/contracts\/demo-ground-handling/);
    await section.getByRole("button", { name: "Company fleet", exact: true }).click();
    assert.match(await section.locator(".od-dashboard-globe-footer").innerText(), /2 aircraft shown/);
    await page.goto(`${target.origin}/product`);
    await page.locator("#executive-cockpit canvas").waitFor();
    assert.equal(await page.locator(".od-dashboard-aviation").count(), 1, "Platform reuses the shared flight operations");
  } finally { await context.close(); }
});

test("new corporate pages have distinct metadata and reachable resource links", async () => {
  const { context, page } = await createPage();
  try {
    for (const route of ["/resources", "/intelligence"]) {
      await page.goto(`${target.origin}${route}`);
      await page.locator(".oaero-hero h1").waitFor();
      assert.equal(await page.locator("link[rel='canonical']").getAttribute("href"), `https://operionos.com${route}`);
      assert.equal(await page.locator(".op-corporate-nav a[aria-current='page']").count(), 1);
      assert.ok(await page.locator(".oaero-resource-grid a").count() >= 2);
    }
  } finally { await context.close(); }
});

test("light corporate panels retain readable foreground contrast", async () => {
  const { context, page } = await createPage();
  const surfaces = [
    ["/", ".op-story-aviation h2, .op-story-exposure-result p, .op-story-action-path .is-action small, .op-story-final p"],
    ["/product", ".op-sales-section-dark h2, .op-sales-flow.is-dark h3, .op-sales-impact-example > div span"],
    ["/security", ".op-security-principles strong, .op-security-principles p"],
    ["/solutions", ".op-solutions-ecosystem-core span, .op-solutions-unified-engine small, .op-solutions-final h2, .op-solutions-final p"],
    ["/privacy", ".op-policy-hero > .op-container > p, .op-policy-meta dd"],
  ];
  try {
    for (const [route, selector] of surfaces) {
      await page.goto(`${target.origin}${route}`);
      await page.locator(selector).first().waitFor({ state: "attached" });
      const results = await page.locator(selector).evaluateAll((elements) => {
        const rgba = (value) => value.match(/[\d.]+/g).map(Number);
        const luminance = (color) => color.slice(0, 3).map((value) => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        }).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
        return elements.map((element) => {
          let ancestor = element;
          let background = [255, 255, 255];
          while (ancestor) {
            const color = rgba(getComputedStyle(ancestor).backgroundColor);
            if (color.length === 3 || color[3] === 1) { background = color; break; }
            ancestor = ancestor.parentElement;
          }
          const foregroundLight = luminance(rgba(getComputedStyle(element).color));
          const backgroundLight = luminance(background);
          return {
            text: element.textContent.trim().slice(0, 50),
            ratio: (Math.max(foregroundLight, backgroundLight) + 0.05) / (Math.min(foregroundLight, backgroundLight) + 0.05),
          };
        });
      });
      assert.ok(results.length > 0, `${route}: contrast targets exist`);
      for (const result of results) assert.ok(result.ratio >= 4.5, `${route}: "${result.text}" has ${result.ratio.toFixed(2)} contrast`);
    }
  } finally { await context.close(); }
});

test("mobile navigation opens, closes on Escape and follows corporate links", async () => {
  const { context, page } = await createPage(390);
  try {
    await page.goto(target.origin);
    const toggle = page.getByRole("button", { name: "Open navigation", exact: true });
    await toggle.click();
    assert.equal(await page.locator("#corporate-navigation-overlay").getAttribute("aria-hidden"), "false");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#corporate-navigation-overlay").getAttribute("aria-hidden"), "true");
    await toggle.click();
    await page.getByRole("navigation", { name: "Expanded corporate navigation" }).getByRole("link", { name: "About us", exact: true }).click();
    await page.waitForURL("**/about");
    assert.equal(await page.locator("#corporate-navigation-overlay").getAttribute("aria-hidden"), "true");
    assert.equal(await page.getByRole("link", { name: "Book Demo", exact: true }).isVisible(), true);
  } finally { await context.close(); }
});

test("existing scenario interactions and legacy corporate route aliases remain available", async () => {
  const { context, page } = await createPage(390);
  try {
    await page.goto(target.origin);
    await page.getByRole("tab", { name: "Combined shock", exact: true }).click();
    assert.equal(await page.locator(".op-story-scenario-gauge strong").innerText(), "€3.62M");
    await page.keyboard.press("Home");
    assert.equal(await page.locator(".op-story-scenario-gauge strong").innerText(), "€2.40M");
    for (const [alias, destination] of [
      ["/platform", "/product"], ["/industries/aviation", "/aviation"], ["/contact", "/request-demo"],
    ]) {
      await page.goto(`${target.origin}${alias}`);
      await page.waitForURL(`${target.origin}${destination}`);
      await page.locator("#corporate-main h1").waitFor();
    }
  } finally { await context.close(); }
});

test("unsupported WebGL exposes a clear fallback without hiding corporate content", async () => {
  const { context, page } = await createPage();
  try {
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return /webgl/i.test(type) ? null : original.call(this, type, ...args);
      };
    });
    await page.goto(target.origin);
    await page.locator(".oaero-aircraft-unavailable[role='status']").waitFor();
    assert.equal(await page.locator("#corporate-main h1").isVisible(), true);
    assert.equal(await page.locator(".oaero-hero-actions a").first().isVisible(), true);
    await page.locator(".od-globe-unavailable[role='status']").waitFor();
    await page.locator("#executive-cockpit").getByRole("button", { name: "Diverted", exact: true }).click();
    assert.equal(await page.locator(".od-dashboard-selected-heading h3").innerText(), "VT-ANA");
    assert.equal(await page.locator(".od-flight-contract-links a").first().isVisible(), true);
  } finally { await context.close(); }
});

test("demo request retains submission success and failure states without contacting services", async () => {
  const { context, page } = await createPage(390);
  try {
    await page.route("**/api/contact", (route) => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify({ success: true }),
    }));
    await page.goto(`${target.origin}/request-demo`);
    async function fillForm() {
      const form = page.locator(".op-request-form");
      await form.getByLabel("Name", { exact: true }).fill("Demo Reviewer");
      await form.getByLabel("Work email", { exact: true }).fill("reviewer@example.test");
      await form.getByLabel("Company", { exact: true }).fill("Example Aviation");
      await form.locator("select[name='role']").selectOption({ label: "Operations" });
      await form.locator("select[name='companyType']").selectOption({ label: "Airline" });
      await form.getByRole("button", { name: "Request a demo", exact: true }).click();
    }
    await fillForm();
    await page.locator(".op-request-status[role='status']").waitFor();
    await page.unroute("**/api/contact");
    await page.route("**/api/contact", (route) => route.fulfill({
      status: 500, contentType: "application/json", body: JSON.stringify({ error: "Test-only failure" }),
    }));
    await fillForm();
    await page.locator(".op-request-status[role='alert']").waitFor();
  } finally { await context.close(); }
});

for (const width of [1440, 1024, 768, 390, 320]) {
  test(`demo cockpit keeps the globe full-width and information below it at ${width}px`, async () => {
    const { context, page } = await createPage(width);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(`${target.origin}/demo/dashboard`);
      const workspace = page.locator(".od-dashboard-globe-layout");
      const globe = page.locator(".od-dashboard-globe-panel");
      await globe.locator("canvas").waitFor();
      const workspaceBox = await workspace.boundingBox();
      const globeBox = await globe.boundingBox();
      assert.ok(Math.abs(workspaceBox.width - globeBox.width) <= 2, "Globe fills the workspace width");
      assert.ok(globeBox.height >= 400, "Globe has a substantial viewing area");
      const controlsBox = await globe.locator(".od-map-controls").boundingBox();
      assert.ok(controlsBox.x >= globeBox.x && controlsBox.x + controlsBox.width <= globeBox.x + globeBox.width, "View controls stay inside the globe horizontally");
      assert.ok(controlsBox.y >= globeBox.y && controlsBox.y + controlsBox.height <= globeBox.y + globeBox.height, "View controls stay inside the globe vertically");
      for (const selector of [".od-dashboard-flight-stats-wrap", ".od-command-sections"]) {
        const box = await page.locator(selector).boundingBox();
        assert.ok(box.y >= globeBox.y + globeBox.height - 1, `${selector} stays below the globe`);
      }
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
      assert.ok(dimensions.content <= dimensions.viewport + 1, "Cockpit does not overflow horizontally");
      assert.equal(await page.locator(".od-dashboard-flight-stat").count(), 4);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

test("demo cockpit fleet selection, filters and globe layers remain interactive", async () => {
  const { context, page } = await createPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(`${target.origin}/demo/dashboard`);
    const cockpit = page.locator(".od-dashboard-aviation");
    await cockpit.locator("canvas").waitFor();
    await cockpit.locator("canvas").scrollIntoViewIfNeeded();
    await cockpit.locator('.od-cesium-globe[data-aircraft-models-ready="12"]').waitFor({ timeout: 30000 });
    const initial = await cockpit.locator(".od-dashboard-selected-heading h3").innerText();
    await cockpit.getByRole("button", { name: "Explore the fleet", exact: true }).click();
    await cockpit.locator(".od-dashboard-aircraft-list button").nth(1).click({ timeout: 30000 });
    assert.notEqual(await cockpit.locator(".od-dashboard-selected-heading h3").innerText(), initial);
    for (const name of ["Company fleet", "Operational watch", "All flights"]) {
      await cockpit.getByRole("button", { name, exact: true }).click();
      assert.equal(await cockpit.getByRole("button", { name, exact: true }).getAttribute("aria-pressed"), "true");
      await cockpit.locator("canvas").waitFor();
    }
    for (const name of ["Map", "Weather", "Globe"]) {
      await cockpit.getByRole("button", { name, exact: true }).click();
      assert.equal(await cockpit.getByRole("button", { name, exact: true }).getAttribute("aria-pressed"), "true");
    }
    await cockpit.getByRole("button", { name: "Satellite", exact: true }).click();
    await cockpit.getByRole("button", { name: "Standard", exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test("Home video spans the viewport and aviation sectors form an orderly six-card grid", async () => {
  const { context, page } = await createPage();
  try {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(target.origin);
      const video = await page.locator(".op-story-product-frame").boundingBox();
      const gutter = width <= 900 ? 2 : 0;
      assert.ok(Math.abs(video.x - gutter) <= 1 && Math.abs(video.width - (width - gutter * 2)) <= 1, "Video fills the screen with only the required mobile gutters");
      const cards = page.locator(".oaero-sector-card");
      assert.equal(await cards.count(), 6);
      const boxes = await cards.evaluateAll((elements) => elements.map((el) => {
        const { x, y, width, height } = el.getBoundingClientRect();
        return { x, y, width, height };
      }));
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          assert.ok(a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1, "Sector cards never overlap");
        }
      }
    }
  } finally { await context.close(); }
});

for (const width of [320, 390, 768]) {
  test(`mobile menu exposes every desktop navigation link in a scrollable viewport at ${width}px`, async () => {
    const { context, page } = await createPage(width);
    try {
      await page.goto(target.origin);
      const destinations = await page.locator(".op-corporate-nav a").evaluateAll((links) => links.map((a) => ({ label: a.textContent, path: new URL(a.href).pathname })));
      for (const { label, path } of destinations) {
        await page.getByRole("button", { name: "Open navigation", exact: true }).click();
        const menu = page.getByRole("dialog", { name: "Corporate menu", exact: true });
        const bounds = await menu.boundingBox();
        assert.ok(bounds.height > 700 && bounds.y + bounds.height <= 1001, "Menu fills the visible area below the header");
        await menu.getByRole("navigation").getByRole("link", { name: label, exact: true }).click();
        await page.waitForURL(`${target.origin}${path}`);
        assert.equal(await page.locator("#corporate-navigation-overlay").getAttribute("aria-hidden"), "true");
      }
      await page.getByRole("button", { name: "Open navigation", exact: true }).click();
      await page.getByRole("button", { name: "Close menu", exact: true }).click();
      assert.equal(await page.getByRole("button", { name: "Open navigation", exact: true }).evaluate((el) => el === document.activeElement), true);
    } finally { await context.close(); }
  });
}

for (const route of ["/product", "/demo/dashboard"]) {
  test(`${route} provides the same globe features, searchable synthetic fleet and honest provider availability`, async () => {
    const { context, page } = await createPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(`${target.origin}${route}`);
      const cockpit = page.locator(".od-dashboard-aviation");
      await cockpit.locator("canvas").waitFor();
      for (const label of ["Globe", "Map", "Weather", "Clouds", "Wind", "Routes", "Satellite", "Pause simulation", "Zoom in", "Zoom out", "Reset view", "Full screen"]) {
        assert.equal(await cockpit.getByRole("button", { name: label, exact: true }).count(), 1);
      }

      const search = cockpit.getByRole("searchbox", { name: "Search fleet", exact: true });
      for (const [query, registration] of [["g opra", "G-OPRA"], ["AIC131", "VT-ANA"], ["AV091", "N712AV"], ["76c712", "9V-NEO"]]) {
        await cockpit.getByRole("button", { name: "Explore the fleet", exact: true }).click();
        await search.fill(query);
        await cockpit.locator(".od-dashboard-aircraft-list button").first().click();
        assert.equal(await cockpit.locator(".od-dashboard-selected-heading h3").innerText(), registration);
        assert.match(await cockpit.locator(".od-dashboard-globe-footer").innerText(), /1 aircraft shown/);
        assert.equal(await cockpit.getByText("Aircraft photo unavailable", { exact: true }).count(), 1);
      }
      await cockpit.getByRole("button", { name: "Explore the fleet", exact: true }).click();
      await search.fill("NO-MATCH");
      await cockpit.getByText("No aircraft match these filters.", { exact: true }).waitFor();
      await search.fill("");
      assert.equal(await search.inputValue(), "");
      assert.match(await cockpit.locator(".od-dashboard-globe-footer").innerText(), /12 aircraft shown/);
      assert.equal(await cockpit.getByRole("button", { name: "Turbulence unavailable", exact: true }).isDisabled(), true);
      assert.match(await cockpit.locator(".od-provider-notice").innerText(), /Live flights unavailable/);
      assert.equal(await cockpit.getByRole("link", { name: "View Turbli turbulence forecasts (external)", exact: true }).getAttribute("href"), "https://turbli.com/maps/interactive-turbulence-map/");
      assert.equal(await cockpit.getByRole("link", { name: "Search live flights on Flightradar24 (external)", exact: true }).getAttribute("href"), "https://www.flightradar24.com/");
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

test("all demo page titles stay between 24px and 28px on desktop and mobile", { timeout: 120000 }, async () => {
  const { context, page } = await createPage();
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return /webgl/i.test(type) ? null : original.call(this, type, ...args);
    };
  });
  try {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of ["/demo/dashboard", "/demo/contracts", "/demo/upload", "/demo/live-tracking", "/demo/intelligence", "/demo/organisation", "/demo/users", "/demo/settings"]) {
        await page.goto(`${target.origin}${route}`, { waitUntil: "domcontentloaded" });
        const title = page.locator(".od-page-header h1");
        await title.waitFor();
        const size = await title.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
        assert.ok(size >= 24 && size <= 28, `${route} at ${width}px: ${size}px title`);
      }
    }
  } finally { await context.close(); }
});

test("Xweather layers are individually selectable on every shared Cesium globe without client credentials", { timeout: 180000 }, async () => {
  const { context, page } = await createPage();
  const requests = [];
  try {
    const tile = Buffer.from(await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#0077cc";
      ctx.fillRect(0, 0, 256, 256);
      return canvas.toDataURL("image/png").split(",")[1];
    }), "base64");
    await page.route("**/api/weather-maps/status", (route) => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify({ configured: true }),
    }));
    await page.route("**/api/weather-maps/tiles/**", (route) => {
      requests.push(new URL(route.request().url()).pathname);
      return route.fulfill({ status: 200, contentType: "image/png", body: tile });
    });
    for (const route of ["/product", "/demo/dashboard", "/demo/live-tracking"]) {
      await page.goto(`${target.origin}${route}`, { waitUntil: "domcontentloaded" });
      await page.locator(".od-cesium-globe canvas").scrollIntoViewIfNeeded();
      await page.locator('.od-cesium-globe[data-aircraft-models-ready="12"]').waitFor({ timeout: 30000 });
      await page.locator(".od-real-weather-layers summary").click();
      const filters = page.getByRole("region", { name: "Provider weather layer filters" });
      for (const label of ["Radar (regional coverage)", "Satellite / clouds (GeoColor)", "Surface wind speed (10 m)", "Administrative boundaries"]) {
        const button = filters.getByRole("button", { name: label, exact: true });
        await button.click({ timeout: 20000 });
        assert.equal(await button.getAttribute("aria-pressed"), "true", `${route}: ${label}`);
      }
      await filters.getByRole("button", { name: "Radar (regional coverage)", exact: true }).click({ timeout: 20000 });
      assert.equal(await filters.getByRole("button", { name: "Radar (regional coverage)", exact: true }).getAttribute("aria-pressed"), "false");
      assert.equal(await filters.getByRole("button", { name: "Surface wind speed (10 m)", exact: true }).getAttribute("aria-pressed"), "true");
      await page.waitForTimeout(300);
    }
    assert.ok(requests.some((url) => url.includes("/wind-speeds/")), "Wind imagery uses the credential-free proxy");
    assert.ok(requests.every((url) => !url.includes("secret")), "No credential is put in client tile requests");
  } finally { await context.close(); }
});

test("weather configuration and tile failures remain explicit without synthetic success fallbacks", { timeout: 60000 }, async () => {
  const { context, page } = await createPage();
  let tileRequests = 0;
  try {
    await page.route("**/api/weather-maps/tiles/**", (route) => {
      tileRequests++;
      return route.fulfill({ status: 502, json: { error: "Provider unavailable" } });
    });
    await page.goto(`${target.origin}/demo/dashboard`, { waitUntil: "domcontentloaded" });
    await page.locator(".od-real-weather-layers summary").click();
    const filters = page.getByRole("region", { name: "Provider weather layer filters" });
    assert.equal(await filters.getByRole("button", { name: "Radar (regional coverage)", exact: true }).isDisabled(), true);
    assert.equal(tileRequests, 0, "Disabled integration does not request billable imagery");
    await page.route("**/api/weather-maps/status", (route) => route.fulfill({ json: { configured: true } }));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".od-real-weather-layers summary").click();
    const radar = filters.getByRole("button", { name: "Radar (regional coverage)", exact: true });
    await radar.click();
    await filters.getByRole("alert").waitFor();
    assert.match(await filters.getByRole("alert").innerText(), /Weather imagery failed/);
    assert.equal(await radar.getAttribute("aria-pressed"), "false", "Failed imagery is not represented as an active data layer");
    assert.ok(tileRequests > 0);
  } finally { await context.close(); }
});
