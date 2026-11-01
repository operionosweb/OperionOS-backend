import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { createOciDatabaseConfig } from "../repositories/ociDatabase.js";
import { assertDedicatedOciDatabaseTarget, assertDedicatedOciSupabaseUrl } from "../config/ociProjectTarget.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OCI_MIGRATION = "022_oci_foundation.sql";
const LOCK_NAME = "operion-oci-foundation-migration";

export async function applyOciFoundationMigration({ client, sql }) {
  const checksum = createHash("sha256").update(sql).digest("hex");
  const lock = await client.query("select pg_try_advisory_lock(hashtext($1)) as locked", [LOCK_NAME]);
  if (lock.rows[0]?.locked !== true) throw new Error("Another OCI migration runner holds the migration lock.");

  try {
    await client.query("create schema if not exists oci_internal");
    await client.query("revoke all on schema oci_internal from public, anon, authenticated");
    await client.query(`create table if not exists oci_internal.schema_migrations (
      version text primary key,
      checksum text not null,
      status text not null check (status in ('applying', 'applied')),
      started_at timestamptz not null default now(),
      applied_at timestamptz
    )`);
    await client.query("revoke all on oci_internal.schema_migrations from public, anon, authenticated");

    const recorded = await client.query(
      "select checksum, status from oci_internal.schema_migrations where version = $1 for update",
      [OCI_MIGRATION],
    );
    if (recorded.rows.length) {
      const [entry] = recorded.rows;
      if (entry.checksum !== checksum) throw new Error("Recorded OCI migration checksum differs from the checked-in migration.");
      if (entry.status === "applied") return { applied: false, alreadyApplied: true, checksum };
      throw new Error("OCI migration has an incomplete prior attempt; inspect the database before recovery.");
    }

    await client.query(
      "insert into oci_internal.schema_migrations (version, checksum, status) values ($1, $2, 'applying')",
      [OCI_MIGRATION, checksum],
    );
    try {
      await client.query(sql);
    } catch (error) {
      try {
        await client.query("rollback");
      } catch {
        throw new Error("OCI migration failed and rollback could not be confirmed; inspect the database before recovery.");
      }
      throw error;
    }
    const finalized = await client.query(
      "update oci_internal.schema_migrations set status = 'applied', applied_at = now() where version = $1 and checksum = $2 and status = 'applying'",
      [OCI_MIGRATION, checksum],
    );
    if (finalized.rowCount !== 1) {
      throw new Error("OCI migration completed but its checksum ledger could not be finalized; inspect the database before recovery.");
    }
    return { applied: true, alreadyApplied: false, checksum };
  } finally {
    await client.query("select pg_advisory_unlock(hashtext($1))", [LOCK_NAME]);
  }
}

async function main() {
  dotenv.config();
  if (!process.argv.includes("--apply")) {
    console.log("No migration applied. Set the dedicated OCI target and pass --apply after isolated rehearsal and approval.");
    return;
  }

  const url = assertDedicatedOciDatabaseTarget({
    target: process.env.OCI_MIGRATION_TARGET,
    projectRef: process.env.OCI_MIGRATION_PROJECT_REF,
    databaseUrl: process.env.OCI_MIGRATION_DATABASE_URL,
  });
  assertDedicatedOciSupabaseUrl({
    target: process.env.OCI_MIGRATION_TARGET,
    projectRef: process.env.OCI_MIGRATION_PROJECT_REF,
    supabaseUrl: process.env.OCI_SUPABASE_URL,
  });
  if (process.env.OCI_MIGRATION_PROJECT_REF !== process.env.OCI_SUPABASE_PROJECT_REF) {
    throw new Error("OCI migration Auth and database project references must match.");
  }
  const sql = await fs.readFile(path.join(ROOT, "supabase", "migrations", OCI_MIGRATION), "utf8");
  const config = createOciDatabaseConfig({
    OCI_DATABASE_TARGET: "dedicated-oci",
    OCI_SUPABASE_PROJECT_REF: process.env.OCI_MIGRATION_PROJECT_REF,
    OCI_DATABASE_URL: url.toString(),
    OCI_DATABASE_CA: process.env.OCI_DATABASE_CA,
  });
  const pool = new pg.Pool(config);
  let client;
  try {
    client = await pool.connect();
    const result = await applyOciFoundationMigration({ client, sql });
    console.log(result.alreadyApplied
      ? "OCI foundation migration is already applied with the expected checksum."
      : "OCI foundation migration applied and recorded.");
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("OCI_MIGRATION_FAILED", error.message);
    process.exitCode = 1;
  });
}
