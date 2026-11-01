import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import test from "node:test";
import { applyOciFoundationMigration } from "../scripts/migrate-oci.js";
import { assertDedicatedOciDatabaseTarget, assertDedicatedOciSupabaseUrl } from "../config/ociProjectTarget.js";

const projectRef = "abcdefghijklmnopqrst";
const databaseUrl = `postgresql://postgres:example@db.${projectRef}.supabase.co:5432/postgres`;
const migrationPath = new URL("../supabase/migrations/022_oci_foundation.sql", import.meta.url);

function migrationClient({ existing, failMigration = false } = {}) {
  const queries = [];
  let ledger = existing || null;
  const client = {
    queries,
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (sql.includes("pg_try_advisory_lock")) return { rows: [{ locked: true }] };
      if (sql.includes("select checksum, status")) return { rows: ledger ? [ledger] : [] };
      if (sql.includes("insert into oci_internal.schema_migrations")) {
        ledger = { checksum: params[1], status: "applying" };
        return { rows: [] };
      }
      if (sql.startsWith("update oci_internal.schema_migrations")) {
        if (ledger) ledger.status = "applied";
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("pg_advisory_unlock")) return { rows: [{ pg_advisory_unlock: true }] };
      if (sql === "rollback") return { rows: [] };
      if (sql.includes("create table public.oci_user_roles") && failMigration) throw new Error("migration fixture failure");
      return { rows: [] };
    },
  };
  return client;
}

test("OCI migration is isolated from product schema and retains its own database controls", async () => {
  const sql = await fs.readFile(migrationPath, "utf8");
  assert.match(sql, /references auth\.users/);
  assert.doesNotMatch(sql, /platform_user_roles|organization_memberships|public\.contracts|public\.documents|public\.profiles/i);
  for (const table of ["oci_user_roles", "oci_audit_events", "oci_settings", "oci_records"]) {
    assert.match(sql, new RegExp(`create table public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(sql, /revoke all on public\.oci_records,public\.oci_settings,public\.oci_user_roles,public\.oci_audit_events from public,anon,authenticated/);
  assert.match(sql, /grant select,insert,update on public\.oci_records,public\.oci_settings to service_role/);
  assert.match(sql, /oci_records_audit after insert or update/);
  assert.match(sql, /oci_user_roles_audit after insert or update or delete/);
  assert.match(sql, /oci_accounts_active_identity_idx/);
  assert.match(sql, /oci_contacts_active_email_idx/);
});

test("OCI migration target requires an explicit dedicated project endpoint", () => {
  const url = assertDedicatedOciDatabaseTarget({
    target: "dedicated-oci",
    projectRef,
    databaseUrl,
  });
  assert.equal(url.hostname, `db.${projectRef}.supabase.co`);
  assert.throws(() => assertDedicatedOciDatabaseTarget({ target: "production", projectRef, databaseUrl }), /dedicated-oci/);
  assert.throws(() => assertDedicatedOciDatabaseTarget({
    target: "dedicated-oci",
    projectRef: "bcdefghijklmnopqrstu",
    databaseUrl,
  }), /does not match/);
  assert.throws(() => assertDedicatedOciDatabaseTarget({
    target: "dedicated-oci",
    projectRef,
    databaseUrl: "postgresql://postgres:example@db.otherprojectref12345.supabase.co:5432/postgres",
  }), /does not match/);
  assert.throws(() => assertDedicatedOciDatabaseTarget({
    target: "dedicated-oci",
    projectRef,
    databaseUrl: "https://example.test",
  }), /PostgreSQL/);
  assert.equal(assertDedicatedOciSupabaseUrl({
    target: "dedicated-oci",
    projectRef,
    supabaseUrl: `https://${projectRef}.supabase.co`,
  }).hostname, `${projectRef}.supabase.co`);
  assert.throws(() => assertDedicatedOciSupabaseUrl({
    target: "dedicated-oci",
    projectRef,
    supabaseUrl: "https://customerprojectref12345.supabase.co",
  }), /does not match/);
  for (const existingProjectRef of ["cvwalskmgniwtmqqbdvj", "amlpybvkzoegnxwuodyn"]) {
    assert.throws(() => assertDedicatedOciDatabaseTarget({
      target: "dedicated-oci",
      projectRef: existingProjectRef,
      databaseUrl: `postgresql://postgres@db.${existingProjectRef}.supabase.co:5432/postgres`,
    }), /existing Supabase project/);
    assert.throws(() => assertDedicatedOciSupabaseUrl({
      target: "dedicated-oci",
      projectRef: existingProjectRef,
      supabaseUrl: `https://${existingProjectRef}.supabase.co`,
    }), /existing Supabase project/);
  }
});

test("OCI migration runner records one checksum and safely no-ops on an exact repeat", async () => {
  const client = migrationClient();
  const sql = "begin; create table public.oci_user_roles(id uuid); commit;";
  const first = await applyOciFoundationMigration({ client, sql });
  assert.equal(first.applied, true);
  assert.equal(first.alreadyApplied, false);
  const migrationCalls = client.queries.filter(({ sql: query }) => query === sql).length;
  assert.equal(migrationCalls, 1);
  const second = await applyOciFoundationMigration({ client, sql });
  assert.equal(second.applied, false);
  assert.equal(second.alreadyApplied, true);
  assert.equal(client.queries.filter(({ sql: query }) => query === sql).length, 1);
});

test("OCI migration runner refuses modified or incomplete migration records", async () => {
  const checksum = createHash("sha256").update("applied").digest("hex");
  const mismatch = migrationClient({ existing: { checksum, status: "applied" } });
  await assert.rejects(applyOciFoundationMigration({ client: mismatch, sql: "different" }), /checksum differs/);
  const incomplete = migrationClient({ existing: { checksum: createHash("sha256").update("sql").digest("hex"), status: "applying" } });
  await assert.rejects(applyOciFoundationMigration({ client: incomplete, sql: "sql" }), /incomplete prior attempt/);
});

test("OCI migration failures roll back and leave an operator-review marker", async () => {
  const client = migrationClient({ failMigration: true });
  await assert.rejects(applyOciFoundationMigration({
    client,
    sql: "begin; create table public.oci_user_roles(id uuid); commit;",
  }), /migration fixture failure/);
  assert.ok(client.queries.some(({ sql }) => sql === "rollback"));
  assert.ok(client.queries.some(({ sql }) => sql.startsWith("insert into oci_internal.schema_migrations")));
  assert.ok(client.queries.some(({ sql }) => sql.includes("pg_advisory_unlock")));
});
