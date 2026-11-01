import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { verifyOciIdentity, ociError } from "../middleware/ociAccessMiddleware.js";
import { createOciDatabaseConfig } from "../repositories/ociDatabase.js";
import { assertDedicatedOciDatabaseTarget } from "../config/ociProjectTarget.js";

export const OCI_FOUNDER_EMAIL = "meelis@operionos.com";

export async function provisionOciSuperAdmin({
  token,
  apply = false,
  verify = verifyOciIdentity,
  database,
}) {
  if (!token) throw ociError(400, "OCI_BOOTSTRAP_CONFIGURATION", "OCI_BOOTSTRAP_ACCESS_TOKEN is required.");
  const identity = await verify(token);
  if (!identity.emailVerified
    || identity.email?.trim().toLowerCase() !== OCI_FOUNDER_EMAIL
    || !identity.mfaVerified) {
    throw ociError(403, "OCI_BOOTSTRAP_IDENTITY", "The confirmed founder identity and a verified MFA session are required.");
  }
  if (!apply) return { verified: true, applied: false };
  if (!database) throw ociError(400, "OCI_BOOTSTRAP_CONFIGURATION", "A dedicated OCI database connection is required.");

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("select pg_advisory_xact_lock(hashtext('oci-initial-superadmin'))");
    const existing = await client.query("select user_id, status from public.oci_user_roles for update");
    if (existing.rows.length) {
      throw ociError(409, "OCI_BOOTSTRAP_CLOSED", "Initial provisioning is closed. Later role changes require the audited operator process.");
    }

    const granted = await client.query(`insert into public.oci_user_roles (user_id, role, status, created_by)
      values ($1, 'super_admin', 'active', $1) on conflict (user_id) do nothing returning user_id`, [identity.id]);
    if (granted.rows.length !== 1 || granted.rows[0].user_id !== identity.id) {
      throw ociError(409, "OCI_BOOTSTRAP_CLOSED", "Initial OCI provisioning is closed; role changes require the audited operator process.");
    }
    await client.query(`insert into public.oci_audit_events (actor_id, action, metadata)
      values ($1, 'INITIAL_SUPERADMIN_PROVISIONED', '{"method":"verified-founder-identity-and-mfa"}'::jsonb)`, [identity.id]);
    await client.query("COMMIT");
    return { verified: true, applied: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  dotenv.config();
  let database;
  try {
    const url = assertDedicatedOciDatabaseTarget({
      target: process.env.OCI_BOOTSTRAP_TARGET,
      projectRef: process.env.OCI_BOOTSTRAP_PROJECT_REF,
      databaseUrl: process.env.OCI_BOOTSTRAP_DATABASE_URL,
    });
    if (process.env.OCI_BOOTSTRAP_PROJECT_REF !== process.env.OCI_SUPABASE_PROJECT_REF) {
      throw new Error("OCI bootstrap Auth and database project references must match.");
    }
    database = new pg.Pool(createOciDatabaseConfig({
      OCI_DATABASE_TARGET: "dedicated-oci",
      OCI_SUPABASE_PROJECT_REF: process.env.OCI_BOOTSTRAP_PROJECT_REF,
      OCI_DATABASE_URL: url.toString(),
      OCI_DATABASE_CA: process.env.OCI_DATABASE_CA,
    }));
    const result = await provisionOciSuperAdmin({
      token: process.env.OCI_BOOTSTRAP_ACCESS_TOKEN,
      apply: process.argv.includes("--apply"),
      database,
    });
    console.log(result.applied
      ? "Verified OCI Super Admin provisioned and audited."
      : "Founder identity verified. No changes made; --apply is required to provision.");
  } catch (error) {
    console.error(error.code || "OCI_BOOTSTRAP_FAILED", "OCI provisioning did not complete.");
    process.exitCode = 1;
  } finally {
    if (database) await database.end();
  }
}
