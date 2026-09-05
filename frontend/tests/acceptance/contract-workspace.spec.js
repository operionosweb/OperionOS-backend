import { expect, test } from "@playwright/test";

import { apiRequest, readAcceptanceState } from "./fixture-support.mjs";

let state;
const diagnostics = new WeakMap();

async function login(page, tenant) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(tenant.user.email);
  await page.getByPlaceholder("Password").fill(tenant.user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/app\/dashboard$/);
  await page.getByPlaceholder("Organization UUID").fill(tenant.organizationId);
  await page.getByRole("button", { name: "Continue" }).click();
}

async function selectRunAndOpenWorkspace(page, contract) {
  await page.evaluate(({ contractId, analysisRunId }) => {
    localStorage.setItem(`operion.activeAnalysisRunId.${contractId}`, analysisRunId);
  }, contract);
  await page.goto(`/app/contracts/${contract.contractId}`);
  await expect(page.getByText("Contract workspace", { exact: true })).toBeVisible();
}

async function openWorkspace(page, tenant, contract) {
  await login(page, tenant);
  await selectRunAndOpenWorkspace(page, contract);
}

test.beforeAll(async () => {
  state = await readAcceptanceState();
});

test.beforeEach(async ({ page }) => {
  const events = { consoleErrors: [], failedRequests: [] };
  diagnostics.set(page, events);
  page.on("console", (message) => { if (message.type() === "error") events.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => events.consoleErrors.push(error.message));
  page.on("requestfailed", (request) => events.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || "failed"}`));
});

test.afterEach(async ({ page }, testInfo) => {
  const events = diagnostics.get(page);
  await testInfo.attach("browser-diagnostics", { body: JSON.stringify({ url: page.url(), ...events }, null, 2), contentType: "application/json" });
  const unexpectedConsoleErrors = events.consoleErrors.filter((message) => (
    !events.allowNotFound || !message.includes("404 (Not Found)")
  ));
  const unexpectedFailedRequests = events.failedRequests.filter((message) => (
    !events.allowLogoutAbort || !message.includes("/auth/v1/logout") || !message.includes("ERR_ABORTED")
  ));
  expect(unexpectedConsoleErrors).toEqual([]);
  expect(unexpectedFailedRequests).toEqual([]);
});

test("unauthenticated users are redirected to login", async ({ page }) => {
  for (const path of ["/app", "/app/dashboard", "/app/contracts", "/app/upload", "/app/aviation", "/app/live-tracking", `/app/contracts/${state.contracts.completed.contractId}`]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in to Operion" }).first()).toBeVisible();
  }
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("registration handles confirmation-required accounts without creating a fake session", async ({ page }) => {
  await page.route("**/auth/v1/signup", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "00000000-0000-4000-8000-000000000001" }, session: null }),
    });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "Need an account? Sign up", exact: true }).click();
  await page.getByPlaceholder("Email").fill(`browser-signup-${Date.now()}@example.invalid`);
  await page.getByPlaceholder("Password").fill("Browser-Test-Only-Password!1");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page.getByText("Check your email to confirm your account, then sign in.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("public routes expose indexable canonical metadata and demo refresh", async ({ page }) => {
  for (const path of ["/", "/platform", "/solutions", "/industries/aviation", "/scenarios", "/enterprise", "/about", "/demo/dashboard"]) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow, max-image-preview:large");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://operionos.com${path === "/" ? "/" : path}`);
    const structuredData = await page.locator('script[type="application/ld+json"]').textContent();
    expect(() => JSON.parse(structuredData)).not.toThrow();
  }
  await page.reload();
  await expect(page).toHaveURL(/\/demo\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Good morning, John", exact: true })).toBeVisible();
});

test("public Financial Impact demo traces synthetic exposure to evidence and action value", async ({ page }) => {
  await page.goto("/demo/contracts/demo-aircraft-lease/financial-impact");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow, max-image-preview:large");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://operionos.com/demo/contracts/demo-aircraft-lease/financial-impact");
  await expect(page.getByRole("heading", { name: "Financial Impact", exact: true })).toBeVisible();
  await expect(page.getByText("Potential protected value", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("€920,000", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "WHY? View calculation" }).first().click();
  const financialDrawer = page.getByRole("dialog", { name: /Why Late aircraft return exposure/ });
  await expect(financialDrawer.getByRole("heading", { name: "Financial Impact Tree" })).toBeVisible();
  await expect(financialDrawer.locator(".od-impact-formula")).toHaveText("€85,000 synthetic daily late-return rate × 14 assumed days");
  await expect(financialDrawer.getByText("Potential protected value", { exact: true }).last()).toBeVisible();
  await financialDrawer.getByRole("button", { name: /Inspect source evidence/ }).click();
  await expect(page.getByRole("dialog", { name: "Evidence detail" })).toContainText("Section 22.4 - Late Return");
});

test("authenticated app root, shell routes, and direct refresh are coherent", async ({ page }) => {
  await login(page, state.tenants[0]);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Good morning" })).toBeVisible();

  for (const [path, heading] of [
    ["/app/dashboard", "Good morning"],
    ["/app/contracts", "Contracts"],
    ["/app/upload", "Bring a contract into Operion"],
    ["/app/aviation", "What Operion understands"],
    ["/app/live-tracking", "Live Tracking"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow, noarchive, nosnippet");
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}$`));
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }

  await page.goto("/app/intelligence");
  await expect(page).toHaveURL(/\/app\/aviation$/);
});

test("authenticated upload handles rejection, processing, success, and duplicate detection", async ({ page }) => {
  diagnostics.get(page).allowNotFound = true;
  await login(page, state.tenants[0]);
  await page.goto("/app/upload");
  const fileInput = page.locator('input[type="file"]');

  await fileInput.setInputFiles(state.unsupportedFilePath);
  await expect(page.getByText("Unsupported file type. Please upload a PDF or DOCX document.", { exact: true })).toBeVisible();

  await fileInput.setInputFiles(state.uploadFilePath);
  await page.getByRole("button", { name: "Upload contract", exact: true }).click();
  await page.waitForURL(/\/app\/contracts\/[0-9a-f-]+$/);
  await expect(page.getByText("Contract workspace", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Process contract", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contract profile", exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("G-BROW", { exact: false }).first()).toBeVisible();

  await page.goto("/app/upload");
  await fileInput.setInputFiles(state.uploadFilePath);
  await page.getByRole("button", { name: "Upload contract", exact: true }).click();
  await expect(page.getByText("This document has already been uploaded.", { exact: true })).toBeVisible();
});

test("logout returns to login and protected routes remain protected", async ({ page }) => {
  diagnostics.get(page).allowLogoutAbort = true;
  await login(page, state.tenants[0]);
  const logoutResponse = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/auth/v1/logout"));
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  expect((await logoutResponse).ok()).toBe(true);
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("completed aviation intelligence is visible and grounded", async ({ page }) => {
  await openWorkspace(page, state.tenants[0], state.contracts.completed);
  await expect(page.getByRole("heading", { name: "Contract profile" })).toBeVisible();
  await expect(page.getByText("Synthetic Aviation Leasing Ltd.", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("G-PWA1", { exact: false }).first()).toBeVisible();
  for (const heading of ["Clauses", "Obligations", "Deadlines", "Risks", "Aircraft and supplier relationships", "Financial Impact", "Evidence", "Recommended actions"]) {
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await expect(page.getByText("leased under", { exact: true })).toBeVisible();
  await expect(page.getByText("G-NOEV", { exact: false })).toBeVisible();
  await expect(page.getByText("Evidence unavailable", { exact: true }).last()).toBeDisabled();
  await expect(page.getByText("No recommended actions generated", { exact: true })).toHaveCount(0);
});

test("search and assistant remain scoped to the authenticated contract", async ({ page }) => {
  await openWorkspace(page, state.tenants[0], state.contracts.completed);
  await page.getByLabel("Contract text").fill("maintenance");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText(/maintain the Aircraft/i).first()).toBeVisible();

  await page.getByLabel("Question").fill("Who is responsible for maintenance?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("Evidence-backed answer", { exact: true })).toBeVisible();
  await expect(page.getByText(/Lessee/i).last()).toBeVisible();
});

test("partial and empty-risk analyses remain explicit", async ({ page }) => {
  diagnostics.get(page).allowNotFound = true;
  await openWorkspace(page, state.tenants[0], state.contracts.partial);
  await expect(page.getByText("No obligations were returned for this analysis run.", { exact: true })).toBeVisible();
  await expect(page.getByText("No obligations available", { exact: true })).toBeVisible();
  await expect(page.getByText("No material contractual risks identified", { exact: true })).toBeVisible();
  await expect(page.getByText("Recommendations unavailable", { exact: true })).toBeVisible();

  await selectRunAndOpenWorkspace(page, state.contracts.emptyRisk);
  await expect(page.getByRole("heading", { name: "Contract profile", exact: true })).toBeVisible();
  await expect(page.getByText("No material contractual risks identified", { exact: true })).toBeVisible();
  await expect(page.getByText("No recommended actions generated", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Obligations", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deadlines", exact: true })).toBeVisible();
});

test("analysis APIs and browser access reject the unrelated tenant", async ({ page }) => {
  const tenantB = state.tenants[1];
  const runId = state.contracts.completed.analysisRunId;
  for (const route of ["", "/profile", "/relationships", "/financial-impact", "/search?q=maintenance"]) {
    const response = await apiRequest(`/api/analysis-runs/${runId}${route}`, { token: tenantB.token, organizationId: tenantB.organizationId });
    expect(response.status).toBe(404);
  }
  const assistant = await apiRequest(`/api/analysis-runs/${runId}/assistant`, { token: tenantB.token, organizationId: tenantB.organizationId, method: "POST", body: { question: "Who maintains the aircraft?" } });
  expect(assistant.status).toBe(404);
  const membershipDenied = await apiRequest(`/api/analysis-runs/${runId}`, { token: tenantB.token, organizationId: state.tenants[0].organizationId });
  expect(membershipDenied.status).toBe(403);

  await login(page, tenantB);
  diagnostics.get(page).allowNotFound = true;
  await page.goto(`/app/contracts/${state.contracts.completed.contractId}`);
  await expect(page.getByRole("alert")).toHaveText("Contract not found");
  await expect(page.getByText(state.contracts.completed.title, { exact: true })).toHaveCount(0);
});

test("completed workflow remains usable at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page, state.tenants[0], state.contracts.completed);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("button", { name: "Close navigation" }).last()).toBeVisible();
  await page.getByRole("button", { name: "Close navigation" }).last().click();
  await page.getByRole("heading", { name: "Recommended actions" }).scrollIntoViewIfNeeded();
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    overflowingElements: [...document.querySelectorAll("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === "string" ? element.className : "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        };
      })
      .filter((element) => element.right > document.documentElement.clientWidth + 1 || element.width > document.documentElement.clientWidth + 1)
      .slice(0, 20),
    clippedControls: [...document.querySelectorAll("button, input, select")]
      .filter((element) => element.offsetParent !== null)
      .filter((element) => !element.closest(".op-product-sidebar:not(.is-open)"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.right <= document.documentElement.clientWidth + 1 && rect.left >= -1) return false;
        let ancestor = element.parentElement;
        while (ancestor && ancestor !== document.body) {
          const overflowX = getComputedStyle(ancestor).overflowX;
          if (["auto", "scroll"].includes(overflowX) && ancestor.scrollWidth > ancestor.clientWidth) return false;
          ancestor = ancestor.parentElement;
        }
        return true;
      }).map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === "string" ? element.className : "",
          label: element.getAttribute("aria-label") || element.textContent || element.getAttribute("placeholder"),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        };
      }),
  }));
  expect(layout.documentWidth, JSON.stringify(layout.overflowingElements, null, 2)).toBeLessThanOrEqual(layout.viewport);
  expect(layout.clippedControls).toEqual([]);
  await expect(page.getByText("G-PWA1", { exact: false }).first()).toBeVisible();
});

test("Financial Impact demo and calculation drawer remain usable at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/contracts/demo-aircraft-lease/financial-impact");
  await page.getByRole("button", { name: "WHY? View calculation" }).first().click();
  await expect(page.getByRole("dialog", { name: /Why Late aircraft return exposure/ })).toBeVisible();
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    clippedControls: [...document.querySelectorAll("button, input, select")]
      .filter((element) => element.offsetParent !== null)
      .filter((element) => !element.closest(".od-sidebar:not(.is-open)"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
      })
      .map((element) => element.getAttribute("aria-label") || element.textContent),
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewport);
  expect(layout.clippedControls).toEqual([]);
});