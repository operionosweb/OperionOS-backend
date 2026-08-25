import dotenv from "dotenv";
import pg from "pg";

import {
  getDatabaseEmptyState,
  loadSafeConfig,
} from "./phase3a-live-verification.js";

dotenv.config({ path: ".env.phase3-test.local" });

function printSafeEnvironment(config) {
  console.log("Environment");
  console.log(`PROJECT REF: ${process.env.PHASE3_SUPABASE_PROJECT_REF}`);
  console.log(`PHASE3_DB_TEST_ENABLED: ${process.env.PHASE3_DB_TEST_ENABLED === "1" ? "PASS" : "FAIL"}`);
  console.log(`PHASE3_DB_ENV: ${process.env.PHASE3_DB_ENV === "non-production-test" ? "PASS" : "FAIL"}`);
  console.log(`PHASE3_EMPTY_DATABASE: ${process.env.PHASE3_EMPTY_DATABASE === "1" ? "PASS" : "FAIL"}`);
  console.log(`PHASE3_APPLY_MIGRATIONS: ${process.env.PHASE3_APPLY_MIGRATIONS === "1" ? "PASS" : "FAIL"}`);
  console.log(`REQUIRED CREDENTIALS: ${config ? "PRESENT" : "NOT VERIFIED"}`);
}

async function main() {
  const config = loadSafeConfig();
  printSafeEnvironment(config);

  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();
  try {
    const state = await getDatabaseEmptyState(client);
    console.log("PostgreSQL");
    console.log(`APPLICATION OBJECT COUNT: ${state.publicObjects.length}`);
    console.log(`UNEXPECTED SCHEMA COUNT: ${state.unexpectedSchemas.length}`);
    console.log(`MIGRATION HISTORY: ${state.migrationHistory === "UNKNOWN" ? "UNKNOWN / NOT REPOSITORY CONTROLLED" : "PRESENT"}`);
    console.log("Supabase");
    console.log(`CONTRACT-DOCUMENTS BUCKET: ${state.contractDocumentBucket.length ? "PRESENT" : "ABSENT"}`);
    console.log(`AUTH USER COUNT: ${state.authUserCount}`);

    if (state.status === "DATABASE_EMPTY") {
      console.log("DATABASE ACTUALLY EMPTY: PASS");
      return;
    }

    if (state.status === "DATABASE_NOT_EMPTY") {
      console.log(`DATABASE ACTUALLY EMPTY: FAIL — ${state.reasons.join("; ")}`);
      process.exitCode = 2;
      return;
    }

    console.log("DATABASE STATE UNKNOWN");
    process.exitCode = 2;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith("phase3b-clean-state-verification.js")) {
  main().catch((error) => {
    console.error(`DATABASE STATE UNKNOWN — ${error.code || "preflight_failed"}`);
    process.exitCode = 2;
  });
}
