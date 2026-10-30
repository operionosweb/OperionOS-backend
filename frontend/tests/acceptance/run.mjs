import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { frontendRoot, loadAcceptanceEnvironment } from "./environment.mjs";
import { assertAcceptanceExecutionAllowed } from "./safety.mjs";

const frontendLauncher = path.join(frontendRoot, "tests", "acceptance", "start-frontend.mjs");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: frontendRoot, env: process.env, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)));
  });
}

try {
  assertAcceptanceExecutionAllowed();
  const playwrightCli = fileURLToPath(import.meta.resolve("@playwright/test/cli"));
  loadAcceptanceEnvironment();
  await run(process.execPath, [frontendLauncher, "--build"]);
  await run(process.execPath, [playwrightCli, "test", "--config", "tests/acceptance/playwright.config.js"]);
} catch (error) {
  console.error(`Authenticated acceptance failed: ${error.message}`);
  process.exitCode = 1;
}