import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { verifyOciIdentity, ociError } from "../middleware/ociAccessMiddleware.js";
import pool from "../repositories/ociDatabase.js";

export async function provisionOciSuperAdmin({ token, email, apply = false, verify = verifyOciIdentity, database = pool }) {
  if (!token || !email) throw ociError(400, "OCI_BOOTSTRAP_CONFIGURATION", "OCI_BOOTSTRAP_ACCESS_TOKEN and OCI_BOOTSTRAP_EMAIL are required.");
  const identity = await verify(token);
  if (identity.email.toLowerCase() !== email.trim().toLowerCase() || !identity.mfaVerified) {
    throw ociError(403, "OCI_BOOTSTRAP_IDENTITY", "The verified, MFA-authenticated identity must own the configured email.");
  }
  if (!apply) return { verified: true, applied: false };
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("select pg_advisory_xact_lock(hashtext('oci-initial-superadmin'))");
    const existing = await client.query("select user_id, status from public.oci_user_roles");
    if (existing.rows.some((row) => row.user_id !== identity.id || row.status !== "active")) {
      throw ociError(409, "OCI_BOOTSTRAP_CLOSED", "Initial provisioning is closed. Use an audited administrator-controlled process for later role changes.");
    }
    const platform = await client.query(
      "select status from public.platform_user_roles where user_id = $1 and role = 'SUPERADMIN' for update",
      [identity.id],
    );
    if (platform.rows.some((row) => row.status !== "active") || (existing.rows.length && !platform.rows.length)) {
      throw ociError(409, "OCI_BOOTSTRAP_CLOSED", "Initial provisioning cannot restore a removed or revoked platform assignment.");
    }
    if (existing.rows.length) {
      await client.query("COMMIT");
      return { verified: true, applied: false, alreadyProvisioned: true };
    }
    const granted = await client.query(`insert into public.platform_user_roles (user_id, role, status)
      values ($1, 'SUPERADMIN', 'active') on conflict (user_id, role)
      do update set updated_at = now() where platform_user_roles.status = 'active'
      returning status`, [identity.id]);
    if (granted.rows.length !== 1 || granted.rows[0].status !== "active") {
      throw ociError(409, "OCI_BOOTSTRAP_CLOSED", "Initial provisioning cannot restore revoked platform access.");
    }
    await client.query(`insert into public.oci_user_roles (user_id, role, status, created_by)
      values ($1, 'super_admin', 'active', $1) on conflict (user_id)
      do update set status = 'active', updated_at = now()`, [identity.id]);
    await client.query(`insert into public.oci_audit_events (actor_id, action, metadata)
      values ($1, 'INITIAL_SUPERADMIN_PROVISIONED', '{"method":"verified-provider-identity-and-mfa"}'::jsonb)`, [identity.id]);
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
  try {
    const result = await provisionOciSuperAdmin({
      token: process.env.OCI_BOOTSTRAP_ACCESS_TOKEN,
      email: process.env.OCI_BOOTSTRAP_EMAIL,
      apply: process.argv.includes("--apply"),
    });
    console.log(result.alreadyProvisioned ? "OCI Super Admin is already active. No role changes made." : result.applied ? "Verified OCI Super Admin provisioned and audited." : "Identity verified. No changes made; --apply is required to provision.");
  } catch (error) {
    console.error(error.code || "OCI_BOOTSTRAP_FAILED", "OCI provisioning did not complete.");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
