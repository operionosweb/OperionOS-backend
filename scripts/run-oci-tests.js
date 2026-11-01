import { spawnSync } from "node:child_process";
import { join } from "node:path";

const result = spawnSync(process.execPath, [
  "--test", "--test-reporter=spec",
  join("test", "oci-access.test.js"), join("test", "oci-workflows.test.js"), join("test", "oci-deployment.test.js"),
  join("test", "oci-geography.test.js"), join("test", "oci-migration-target.test.js"),
], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: "", SUPABASE_URL: "", SUPABASE_ANON_KEY: "", MISTRAL_API_KEY: "",
    OCI_DATABASE_URL: "", OCI_SUPABASE_URL: "", OCI_SUPABASE_ANON_KEY: "",
    OCI_DATABASE_TARGET: "", OCI_SUPABASE_PROJECT_REF: "",
    OCI_MIGRATION_TARGET: "", OCI_MIGRATION_PROJECT_REF: "", OCI_MIGRATION_DATABASE_URL: "",
    OCI_BOOTSTRAP_TARGET: "", OCI_BOOTSTRAP_PROJECT_REF: "", OCI_BOOTSTRAP_DATABASE_URL: "",
    OCI_BOOTSTRAP_ACCESS_TOKEN: "", OCI_DATABASE_CA: "",
  },
});
if (result.error) {
  console.error("OCI offline test process could not start.");
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
