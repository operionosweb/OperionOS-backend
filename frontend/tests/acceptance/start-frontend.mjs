import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { frontendRoot, loadAcceptanceEnvironment } from "./environment.mjs";
import { assertAcceptanceExecutionAllowed } from "./safety.mjs";

assertAcceptanceExecutionAllowed();
const { build, preview } = await import("vite");
loadAcceptanceEnvironment();
const emptyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "operion-acceptance-frontend-"));
process.on("exit", () => fs.rmdirSync(emptyDirectory));
const config = { root: frontendRoot, envDir: emptyDirectory };

if (process.argv.includes("--build")) {
  await build(config);
} else {
  await preview({ ...config, preview: { host: "127.0.0.1", port: 4174, strictPort: true } });
}
