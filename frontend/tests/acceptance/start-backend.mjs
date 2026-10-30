import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadAcceptanceEnvironment } from "./environment.mjs";
import { assertAcceptanceExecutionAllowed } from "./safety.mjs";

assertAcceptanceExecutionAllowed();
loadAcceptanceEnvironment();
process.env.PORT = new URL(process.env.CONTRACT_ACCEPTANCE_API_URL).port || "10001";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const emptyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "operion-acceptance-backend-"));
const originalDirectory = process.cwd();
process.on("exit", () => {
  process.chdir(originalDirectory);
  fs.rmdirSync(emptyDirectory);
});
process.chdir(emptyDirectory);
await import("../../../index.js");