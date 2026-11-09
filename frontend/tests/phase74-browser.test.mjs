import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "@playwright/test";

const dist = fileURLToPath(new URL("../dist", import.meta.url));
const origin = "http://phase74.test";
const contentTypes = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".html": "text/html", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2" };

// Serving built assets through interception avoids the unavailable loopback bridge.
// No production API, authenticated session, publication or database is exercised.
async function browserFixture(viewport) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    const pathname = decodeURIComponent(url.pathname);
    const relative = path.extname(pathname) ? pathname.slice(1) : "index.html";
    const filename = path.resolve(dist, relative);
    if (!filename.startsWith(dist + path.sep)) return route.abort();
    try {
      return await route.fulfill({ status: 200, body: await readFile(filename), contentType: contentTypes[path.extname(filename)] || "application/octet-stream" });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return route.fulfill({ status: 404, body: "Missing test asset" });
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return { browser, page, errors };
}

test("built Demo indexation supports editable assumptions and fails closed for blank input", async () => {
  const { browser, page, errors } = await browserFixture({ width: 1440, height: 1000 });
  try {
    await page.goto(`${origin}/demo/intelligence`);
    await page.getByRole("heading", { name: "Synthetic aviation MRO indexation" }).waitFor({ timeout: 5000 }).catch(async (error) => {
      throw new Error(`${error.message}\nPage errors: ${errors.join("; ")}\nBody: ${(await page.locator("body").innerText()).slice(0, 2000)}`);
    });
    const input = page.getByLabel("Synthetic alternative index level, not a forecast");
    await input.fill("306");
    await page.getByText(/Assumed index 306: USD 101,600 per year/).waitFor();
    await input.fill("330");
    await page.getByText(/Assumed index 330: USD 103,000 per year/).waitFor();
    await input.fill("");
    await page.getByText(/No comparison: A positive matching verified index observation/).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("built mobile MRO Workspace preserves evidence links and synthetic disclosure", async () => {
  const { browser, page, errors } = await browserFixture({ width: 390, height: 844 });
  try {
    await page.goto(`${origin}/demo/contracts/demo-mro-agreement/clauses`);
    await page.getByRole("heading", { name: "Annual CPI indexation", exact: true, level: 2 }).waitFor({ timeout: 5000 }).catch(async (error) => {
      throw new Error(`${error.message}\nPage errors: ${errors.join("; ")}\nBody: ${(await page.locator("body").innerText()).slice(0, 2000)}`);
    });
    await page.getByRole("button", { name: "Decline", exact: true }).click();
    await page.locator("article.od-finding-card").getByRole("button", { name: /View source evidence/ }).evaluate((element) => element.scrollIntoView({ block: "center" }));
    await page.locator("article.od-finding-card").getByRole("button", { name: /View source evidence/ }).click();
    await page.getByText(/CUUR0000SA0/).first().waitFor();
    assert.match(await page.locator("body").innerText(), /Synthetic|synthetic/);
    const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, width: document.documentElement.scrollWidth }));
    assert.ok(dimensions.width <= dimensions.viewport + 1, `mobile overflow: ${JSON.stringify(dimensions)}`);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
