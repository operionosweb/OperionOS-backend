import { spawnSync } from "node:child_process";
import { join } from "node:path";

const result = spawnSync(process.execPath, [
  "--test", "--test-reporter=spec",
  join("test", "oci-access.test.js"), join("test", "oci-workflows.test.js"), join("test", "oci-deployment.test.js"),
], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: "", SUPABASE_URL: "", SUPABASE_ANON_KEY: "", MISTRAL_API_KEY: "" },
});
if (result.error) {
  console.error("OCI offline test process could not start.");
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
