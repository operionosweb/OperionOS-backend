import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium } from "@playwright/test";

const origin = process.env.CORPORATE_TEST_URL || "http://127.0.0.1:4175";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)) throw new Error("Responsive checks require loopback");
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function createPage(width, height = 1000, { touch = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce", hasTouch: touch });
  await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  await page.route("**/api/weather-maps/status", (route) => route.fulfill({ json: { configured: false } }));
  return { context, page };
}

async function assertPanelFits(panel, shell) {
  const bounds = await panel.boundingBox(), globe = await shell.boundingBox();
  assert.ok(bounds.x >= globe.x - 1 && bounds.y >= globe.y - 1);
  assert.ok(bounds.x + bounds.width <= globe.x + globe.width + 1);
  assert.ok(bounds.y + bounds.height <= globe.y + globe.height + 1);
  assert.equal(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), true, "Panel never scrolls horizontally");
}

for (const width of [320, 390, 768, 1440]) {
  test(`on-globe fleet search and infocards fit every surface at ${width}px`, { timeout: 180000 }, async () => {
    const { context, page } = await createPage(width);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      for (const route of ["/", "/product", "/demo/dashboard", "/demo/live-tracking"]) {
        await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
        const shell = page.locator(".od-cesium-shell");
        await shell.locator("canvas").waitFor();
        await shell.scrollIntoViewIfNeeded();
        const toggle = shell.getByRole("button", { name: "Explore the fleet", exact: true });
        await toggle.click();
        const fleet = shell.getByRole("dialog", { name: "Explore the fleet", exact: true });
        await fleet.waitFor();
        await assertPanelFits(fleet, shell);
        if (width <= 900) {
          for (const element of [shell, fleet]) {
            const bounds = await element.boundingBox();
            assert.ok(Math.abs(bounds.x - 2) <= .6 && Math.abs(bounds.x + bounds.width - (width - 2)) <= .6, "Globe and fleet popup have exactly 2px mobile gutters");
          }
        }
        assert.equal(await page.locator(".od-dashboard-flight-inspector").count(), 0, "No separate fleet section below globe");
        assert.equal(await fleet.getByLabel("Search fleet", { exact: true }).evaluate((element) => element === document.activeElement), true);
        await fleet.getByLabel("Search fleet", { exact: true }).fill("NO SUCH AIRCRAFT");
        await fleet.getByText("No aircraft match these filters.", { exact: true }).waitFor();
        assert.equal(await shell.locator("canvas").count(), 1, "Empty results preserve globe and filter access");
        await fleet.getByRole("button", { name: "Clear fleet filters", exact: true }).click();
        await fleet.getByLabel("Flight status", { exact: true }).selectOption("watch");
        const statuses = await fleet.locator(".od-dashboard-aircraft-list button > span:last-child").allTextContents();
        assert.ok(statuses.length > 0 && statuses.every((status) => status !== "On time"));
        await fleet.getByRole("button", { name: "Clear fleet filters", exact: true }).click();
        await fleet.locator(".od-dashboard-aircraft-list button").nth(1).click();
        const card = shell.getByRole("dialog", { name: "G-OPRA", exact: true });
        await card.waitFor();
        await assertPanelFits(card, shell);
        const controls = await shell.locator(".od-map-controls").boundingBox(), cardBox = await card.boundingBox();
        if (width <= 900) {
          assert.ok(Math.abs(cardBox.x - 2) <= .6 && Math.abs(cardBox.x + cardBox.width - (width - 2)) <= .6, "Aircraft popup fills mobile width with 2px gutters");
          assert.ok(controls.y + controls.height <= cardBox.y, "Full-width card leaves map controls available above it");
        } else assert.ok(cardBox.x + cardBox.width <= controls.x + 1, "Aircraft card leaves map controls available");
        await toggle.click();
        await fleet.getByLabel("Search fleet", { exact: true }).press("Escape");
        assert.equal(await toggle.getAttribute("aria-expanded"), "false");
        assert.equal(await toggle.evaluate((element) => element === document.activeElement), true);
        const layout = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
        assert.ok(layout.content <= layout.viewport + 1, `${route} has no horizontal page overflow`);
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

for (const width of [1024, 1280, 1366, 1440, 1920]) {
  test(`folded Workspace stays on one line without widening the navigation at ${width}px`, async () => {
    const { context, page } = await createPage(width);
    try {
      await page.goto(`${origin}/demo/contracts`, { waitUntil: "domcontentloaded" });
      await page.evaluate(() => document.fonts.ready);
      const measurement = await page.locator(".od-workspace-folded").evaluate((label) => {
        const range = document.createRange();
        range.selectNodeContents(label);
        const text = range.getBoundingClientRect();
        const bounds = label.getBoundingClientRect();
        const rail = label.closest(".od-sidebar");
        const style = getComputedStyle(label);
        const icons = [...rail.querySelectorAll(".od-nav-link svg")].map((icon) => icon.getBoundingClientRect());
        return {
          text: label.textContent, width: rail.getBoundingClientRect().width,
          fontSize: style.fontSize, whiteSpace: style.whiteSpace, lines: range.getClientRects().length,
          fits: text.left >= bounds.left && text.right <= bounds.right && text.top >= bounds.top && text.bottom <= bounds.bottom,
          insideRail: bounds.left >= rail.getBoundingClientRect().left && bounds.right <= rail.getBoundingClientRect().right,
          overflow: label.scrollWidth > label.clientWidth,
          collision: icons.some((icon) => text.left < icon.right && text.right > icon.left && text.top < icon.bottom && text.bottom > icon.top),
          iconWidths: icons.map((icon) => icon.width),
          pageOverflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.equal(measurement.text, "Workspace");
      assert.equal(measurement.width, 72);
      assert.equal(measurement.fontSize, "9px");
      assert.equal(measurement.whiteSpace, "nowrap");
      assert.equal(measurement.lines, 1);
      assert.equal(measurement.fits, true, "Full text fits vertically and horizontally");
      assert.equal(measurement.insideRail, true);
      assert.equal(measurement.overflow, false);
      assert.equal(measurement.collision, false, "Text never intersects navigation icons");
      assert.ok(measurement.iconWidths.length > 0 && measurement.iconWidths.every((size) => size === 17));
      assert.equal(measurement.pageOverflow, false);
      await page.locator(".od-sidebar").hover();
      await page.waitForFunction(() => document.querySelector(".od-sidebar").getBoundingClientRect().width === 258);
      assert.equal(await page.locator(".od-workspace-folded").isVisible(), false);
      assert.equal(await page.locator(".od-workspace-expanded").textContent(), "Contract workspace");
      assert.equal(await page.locator(".od-workspace-expanded").isVisible(), true);
    } finally { await context.close(); }
  });
}

test("mobile navigation retains the original workspace label and drawer behaviour", async () => {
  const { context, page } = await createPage(390, 844, { touch: true });
  try {
    await page.goto(`${origin}/demo/contracts`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    const sidebar = page.locator(".od-sidebar");
    assert.match(await sidebar.getAttribute("class"), /is-open/);
    assert.equal(await page.locator(".od-workspace-expanded").textContent(), "Contract workspace");
    assert.equal(await page.locator(".od-workspace-expanded").isVisible(), true);
    assert.equal(await page.locator(".od-workspace-folded").isVisible(), false);
    assert.equal(await sidebar.locator(".od-nav-link svg").first().evaluate((icon) => icon.getBoundingClientRect().width), 17);
    await sidebar.getByRole("button", { name: "Close navigation", exact: true }).click();
    assert.doesNotMatch(await sidebar.getAttribute("class"), /is-open/);
  } finally { await context.close(); }
});

test("desktop navigation folds, expands on hover and keyboard focus, and pins open", async () => {
  const { context, page } = await createPage(1440);
  try {
    await page.goto(`${origin}/demo/contracts`, { waitUntil: "domcontentloaded" });
    const sidebar = page.locator(".od-sidebar");
    const width = () => sidebar.evaluate((element) => element.getBoundingClientRect().width);
    assert.equal(await width(), 72);
    await sidebar.hover();
    await page.waitForFunction(() => document.querySelector(".od-sidebar").getBoundingClientRect().width === 258);
    assert.equal(await width(), 258);
    await page.locator(".od-page-header h1").hover();
    await page.waitForFunction(() => document.querySelector(".od-sidebar").getBoundingClientRect().width === 72);
    assert.equal(await width(), 72);
    await page.getByRole("link", { name: "Live Tracking", exact: true }).first().focus();
    await page.waitForFunction(() => document.querySelector(".od-sidebar").getBoundingClientRect().width === 258);
    assert.equal(await width(), 258, "Keyboard navigation expands rail");
    await page.getByRole("button", { name: "Pin navigation open", exact: true }).click();
    await page.locator(".od-search-trigger").focus();
    await page.locator(".od-page-header h1").hover();
    await page.waitForFunction(() => document.querySelector(".od-sidebar").getBoundingClientRect().width === 258);
    assert.equal(await width(), 258);
    assert.equal(await page.locator(".od-frame").evaluate((element) => parseFloat(getComputedStyle(element).marginLeft)), 258);
    await page.getByRole("button", { name: "Unpin navigation", exact: true }).click();
    await page.locator(".od-search-trigger").focus();
    await page.locator(".od-page-header h1").hover();
    await page.waitForFunction(() => document.querySelector(".od-sidebar").getBoundingClientRect().width === 72);
    assert.equal(await width(), 72);
  } finally { await context.close(); }
});

for (const width of [390, 1440]) {
  test(`aircraft canvas selection avoids GPU readback and long input handlers at ${width}px`, { timeout: 120000 }, async () => {
    const { context, page } = await createPage(width, 1000, { touch: width === 390 });
    try {
      await page.addInitScript(() => {
        window.aircraftPickReadbacks = 0;
        window.aircraftInputTimings = [];
        for (const type of [WebGLRenderingContext, WebGL2RenderingContext]) {
          const readPixels = type.prototype.readPixels;
          type.prototype.readPixels = function(...args) {
            window.aircraftPickReadbacks++;
            return readPixels.apply(this, args);
          };
        }
        new PerformanceObserver(list => {
          for (const event of list.getEntries()) {
            if (event.target?.tagName === "CANVAS" && ["pointerup", "mouseup", "click"].includes(event.name)) {
              window.aircraftInputTimings.push({ handler: event.processingEnd - event.processingStart, duration: event.duration });
            }
          }
        }).observe({ type: "event", durationThreshold: 16 });
      });
      await page.goto(`${origin}/demo/live-tracking`, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Decline", exact: true }).click();
      await page.waitForFunction(() => Number(document.querySelector(".od-cesium-globe")?.dataset.aircraftModelsReady) === 12);
      const canvas = page.locator(".od-cesium-globe canvas");
      await page.getByRole("button", { name: "Close aircraft infocard", exact: true }).click();
      await canvas.scrollIntoViewIfNeeded();
      const bounds = await canvas.boundingBox();
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.evaluate(() => { window.aircraftPickReadbacks = 0; window.aircraftInputTimings = []; });
      if (width === 390) await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      else await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.getByRole("dialog", { name: "G-OPER", exact: true }).waitFor();
      await page.waitForTimeout(200);
      const result = await page.evaluate(() => ({ readbacks: window.aircraftPickReadbacks, handlers: window.aircraftInputTimings }));
      assert.equal(result.readbacks, 0, "Selecting an aircraft must not render/read a GPU picking buffer");
      assert.ok(result.handlers.every(event => event.handler < 50), `Aircraft input handler exceeded 50ms: ${JSON.stringify(result.handlers)}`);
      assert.ok(result.handlers.every(event => event.duration < 200), `Aircraft interaction exceeded 200ms: ${JSON.stringify(result.handlers)}`);
    } finally { await context.close(); }
  });
}

for (const width of [320, 390, 1440]) {
  test(`tracking action text and relationship badges remain inside their boxes at ${width}px`, async () => {
    const { context, page } = await createPage(width);
    try {
      await page.goto(`${origin}/demo/live-tracking`, { waitUntil: "domcontentloaded" });
      await page.locator(".od-graph-node").first().waitFor();
      const overflowing = await page.locator(".od-graph-node .od-badge, .od-live-header-actions button, .od-globe-layer-controls button").evaluateAll((elements) =>
        elements.filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1).map((element) => element.textContent));
      assert.deepEqual(overflowing, []);
      const badgeFit = await page.locator(".od-graph-node .od-badge").evaluateAll((elements) => elements.every((badge) => {
        const inner = badge.getBoundingClientRect(), outer = badge.closest(".od-graph-node").getBoundingClientRect();
        return inner.x >= outer.x - 1 && inner.right <= outer.right + 1 && inner.bottom <= outer.bottom + 1;
      }));
      assert.equal(badgeFit, true, "Relationship status badges fit inside contract nodes");
      await page.getByRole("button", { name: "Filters", exact: true }).click();
      await page.getByRole("dialog", { name: "Explore the fleet", exact: true }).waitFor();
      if (width <= 900) {
        await page.getByRole("button", { name: "Open navigation", exact: true }).click();
        await page.getByRole("navigation", { name: "Demo navigation", exact: true }).getByRole("link", { name: "Contracts", exact: true }).click();
        await page.waitForURL("**/demo/contracts");
      }

    } finally { await context.close(); }
  });
}

for (const [width, height] of [[390, 844], [844, 390]]) {
  test(`fullscreen fleet filters and infocards fit ${width}x${height}`, async () => {
    const { context, page } = await createPage(width, height);
    try {
      await page.goto(`${origin}/demo/dashboard`, { waitUntil: "domcontentloaded" });
      const shell = page.locator(".od-cesium-shell");
      await shell.locator("canvas").waitFor();
      await page.getByRole("button", { name: "Full screen", exact: true }).click();
      await page.getByRole("button", { name: "Exit full screen", exact: true }).waitFor();
      const toggle = shell.getByRole("button", { name: "Explore the fleet", exact: true });
      await toggle.click();
      const fleet = shell.getByRole("dialog", { name: "Explore the fleet", exact: true });
      await assertPanelFits(fleet, shell);
      assert.ok((await shell.boundingBox()).height >= 180, "Fullscreen leaves a useful canvas in portrait and landscape");
      await fleet.locator(".od-dashboard-aircraft-list button").nth(1).click();
      await assertPanelFits(shell.getByRole("dialog", { name: "G-OPRA", exact: true }), shell);
      await page.getByRole("button", { name: "Exit full screen", exact: true }).click();
    } finally { await context.close(); }
  });
}
