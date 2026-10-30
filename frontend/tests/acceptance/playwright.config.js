import { acceptanceRoot, frontendRoot, loadAcceptanceEnvironment, repositoryRoot } from "./environment.mjs";
import { assertAcceptanceExecutionAllowed } from "./safety.mjs";

assertAcceptanceExecutionAllowed();
const { defineConfig } = await import("@playwright/test");
loadAcceptanceEnvironment();

export default defineConfig({
  testDir: acceptanceRoot,
  testMatch: "contract-workspace.spec.js",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  globalSetup: `${acceptanceRoot}/global-setup.mjs`,
  globalTeardown: `${acceptanceRoot}/global-teardown.mjs`,
  outputDir: `${repositoryRoot}/test-results/contract-workspace/artifacts`,
  reporter: [["list"], ["html", { outputFolder: `${repositoryRoot}/playwright-report`, open: "never" }]],
  use: {
    baseURL: process.env.CONTRACT_ACCEPTANCE_WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/acceptance/start-backend.mjs",
      cwd: frontendRoot,
      url: `${process.env.CONTRACT_ACCEPTANCE_API_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "node tests/acceptance/start-frontend.mjs",
      cwd: frontendRoot,
      url: process.env.CONTRACT_ACCEPTANCE_WEB_URL,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});