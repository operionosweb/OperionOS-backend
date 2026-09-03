import assert from "node:assert/strict";
import test from "node:test";

import {
  applyMigrations,
  applyMigrationsAfterEmptyCheck,
  assertDatabaseEmpty,
  getDatabaseEmptyState,
  inspectMigrationState,
} from "./phase3a-live-verification.js";

function createCatalogClient({ publicObjects = [], unexpectedSchemas = [], migrationHistory = [], bucket = false, users = 0 } = {}) {
  return {
    async query(sql) {
      if (sql.includes("from pg_class")) return { rows: publicObjects };
      if (sql.includes("from pg_namespace")) return { rows: unexpectedSchemas };
      if (sql.includes("from information_schema.tables")) return { rows: migrationHistory };
      if (sql.includes("from storage.buckets")) return { rows: bucket ? [{ id: "contract-documents" }] : [] };
      if (sql.includes("from auth.users")) return { rows: [{ count: users }] };
      throw new Error(`unexpected catalog query: ${sql}`);
    },
  };
}

test("Phase 3B migration harness safety helpers", async (suite) => {
  await suite.test("empty database assertion passes for an empty catalog", async () => {
    const state = await assertDatabaseEmpty(createCatalogClient());
    assert.equal(state.publicObjects.length, 0);
    assert.equal(state.migrationHistory.length, 0);
  });

  await suite.test("empty database assertion fails for application tables", async () => {
    const state = await getDatabaseEmptyState(createCatalogClient({ publicObjects: [{ object_name: "contracts" }] }));
    assert.equal(state.status, "DATABASE_NOT_EMPTY");
    await assert.rejects(
      () => assertDatabaseEmpty(createCatalogClient({ publicObjects: [{ object_name: "contracts" }] })),
      (error) => error.code === "DATABASE_NOT_EMPTY" && error.message.includes("contracts")
    );
  });

  await suite.test("empty database assertion fails for migration objects", async () => {
    await assert.rejects(
      () => assertDatabaseEmpty(createCatalogClient({ migrationHistory: [{ table_schema: "public", table_name: "schema_migrations" }] })),
      (error) => error.code === "DATABASE_NOT_EMPTY" && error.message.includes("schema_migrations")
    );
  });

  await suite.test("catalog failures produce DATABASE_CHECK_FAILED", async () => {
    const state = await getDatabaseEmptyState({ query: async () => { throw new Error("catalog unavailable"); } });
    assert.equal(state.status, "DATABASE_CHECK_FAILED");
  });

  await suite.test("migration state reports unknown history without inventing records", async () => {
    const state = await inspectMigrationState(createCatalogClient());
    assert.equal(state.migrationHistory.length, 0);
  });

  await suite.test("non-empty database stops before migration 001", async () => {
    let migrationStarted = false;
    const client = createCatalogClient({ publicObjects: [{ object_name: "contracts" }] });
    const originalQuery = client.query;
    client.query = async (sql) => {
      if (sql.includes("select 1")) migrationStarted = true;
      return originalQuery(sql);
    };

    const originalApplyMigrations = process.env.PHASE3_APPLY_MIGRATIONS;
    process.env.PHASE3_APPLY_MIGRATIONS = "1";
    try {
      await assert.rejects(() => applyMigrationsAfterEmptyCheck(client), /Database state DATABASE_NOT_EMPTY/);
    } finally {
      if (originalApplyMigrations === undefined) delete process.env.PHASE3_APPLY_MIGRATIONS;
      else process.env.PHASE3_APPLY_MIGRATIONS = originalApplyMigrations;
    }
    assert.equal(migrationStarted, false);
  });

  await suite.test("database emptiness assertion detects relevant Storage and Auth state", async () => {
    await assert.rejects(
      () => assertDatabaseEmpty(createCatalogClient({ bucket: true, users: 1 })),
      (error) => error.code === "DATABASE_NOT_EMPTY"
        && error.message.includes("contract-documents")
        && error.message.includes("auth users: 1")
    );
  });

  await suite.test("migration execution logs each migration success individually", async () => {
    const output = [];
    const client = { query: async () => ({ rows: [] }) };
    await applyMigrations(client, { requireEnabled: false, log: (message) => output.push(message) });
    assert.equal(output.filter((line) => line.includes("— START")).length, 16);
    assert.equal(output.filter((line) => line.includes("— PASS —")).length, 16);
  });

  await suite.test("migration failure is logged with a sanitized classification", async () => {
    const output = [];
    const queryError = new Error("secret connection string");
    queryError.code = "23505";
    await assert.rejects(
      () => applyMigrations({ query: async () => { throw queryError; } }, { requireEnabled: false, log: (message) => output.push(message), logError: (message) => output.push(message) }),
      /secret connection string/
    );
    assert.ok(output.some((line) => line.includes("— FAIL —") && line.includes("duplicate_constraint_or_unique_violation")));
    assert.equal(output.some((line) => line.includes("secret connection string")), false);
  });
});