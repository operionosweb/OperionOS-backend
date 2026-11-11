import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "@playwright/test";
import { build } from "esbuild";

const resolveDir = fileURLToPath(new URL("..", import.meta.url));

async function navigationBundle(pageName, requestFails) {
  const result = await build({
    stdin: {
      contents: `
        import React, { useState } from "react";
        import { createRoot } from "react-dom/client";
        import { MemoryRouter, Routes, Route } from "react-router-dom";
        import CommercialIntelligence from "./src/routes/CommercialIntelligence";
        function App() {
          const [open, setOpen] = useState(true);
          return <MemoryRouter initialEntries={["/records/local-fixture"]}>
            <button onClick={() => setOpen(!open)}>
              {open ? "Leave Commercial Intelligence" : "Return to Commercial Intelligence"}
            </button>
            {open ? <Routes><Route
              path=${JSON.stringify(pageName === "opportunity" ? "/records/:opportunityId" : "/records/:companyId")}
              element={<CommercialIntelligence page=${JSON.stringify(pageName)} />}
            /></Routes> : <h1>Navigation destination</h1>}
          </MemoryRouter>;
        }
        createRoot(document.getElementById("root")).render(<App />);
      `,
      loader: "jsx",
      resolveDir,
    },
    bundle: true,
    platform: "browser",
    format: "iife",
    write: false,
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{
      name: "isolated-commercial-api",
      setup(plugin) {
        plugin.onLoad({ filter: /[\\/]lib[\\/]apiClient\.js$/ }, () => ({
          contents: `
            export async function apiRequest(path) {
              if (path === "/api/intelligence/dashboard") return {
                profile: { summaryPrompt: "Local navigation fixture only" },
                priorityOpportunities: [], newSignals: [], companiesToReview: [],
                recommendedActions: [], recentPeople: [], reviewQueue: []
              };
              if (${JSON.stringify(requestFails)}) throw new Error("Commercial fixture unavailable");
              if (path === "/api/intelligence/companies/local-fixture") return {
                company: { id: "local-fixture", name: "Local fixture company" },
                people: [], signals: [], opportunities: [], sources: []
              };
              if (path === "/api/intelligence/opportunities/local-fixture") return {
                opportunity: { id: "local-fixture", title: "Local fixture opportunity", status: "IDENTIFIED" },
                actions: [], sources: []
              };
              if (path === "/api/intelligence/sources/review") return { sources: [] };
              if (path === "/api/intelligence/proposals") return { proposals: [] };
              if (path === "/api/intelligence/entity-matches") return { matches: [] };
              throw new Error("Unexpected test API path: " + path);
            }
          `,
          loader: "js",
        }));
      },
    }],
  });
  return result.outputFiles[0].text;
}

for (const pageName of ["overview", "company", "opportunity"]) {
  for (const requestFails of [false, true]) {
    test(`Commercial Intelligence ${pageName} unmounts and remounts when request ${requestFails ? "fails" : "loads"}`, async () => {
      const script = await navigationBundle(pageName, requestFails);
      const browser = await chromium.launch({ headless: true });
      try {
        const context = await browser.newContext();
        await context.route("**/*", (route) => route.abort());
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.setContent('<div id="root"></div>');
        await page.addScriptTag({ content: script });
        const heading = { overview: "Evidence quality queue", company: "Local fixture company", opportunity: "Local fixture opportunity" }[pageName];
        const waitForContent = () => requestFails
          ? page.getByText("Commercial fixture unavailable", { exact: true }).waitFor()
          : page.getByRole("heading", { name: heading, exact: true }).waitFor();
        await waitForContent();
        await page.getByRole("button", { name: "Leave Commercial Intelligence", exact: true }).click();
        await page.getByRole("heading", { name: "Navigation destination" }).waitFor({ timeout: 3000 });
        assert.deepEqual(errors, []);
        await page.getByRole("button", { name: "Return to Commercial Intelligence", exact: true }).click();
        await waitForContent();
        assert.deepEqual(errors, []);
      } finally {
        await browser.close();
      }
    });
  }
}
