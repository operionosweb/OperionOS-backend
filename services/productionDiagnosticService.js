import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import pool from "../db.js";
import ociDatabase from "../repositories/ociDatabase.js";
import { isVerifiedDatabaseConnection } from "../config/databaseTls.js";

const version = createRequire(import.meta.url)("../package.json").version;
const tables = ["platform_user_roles", "analysis_runs", "clauses", "obligations", "deadlines", "risks",
  "ai_intelligence_usage", "blog_posts", "blog_media", "blog_post_audit", "blog_slug_redirects"];
const blogTables = ["blog_posts", "blog_media", "blog_post_audit", "blog_slug_redirects"];
const ociTables = ["oci_user_roles", "oci_audit_events", "oci_settings", "oci_records"];

function connectionIdentity(client) {
  const host = String(client.host || "").toLowerCase();
  const direct = /^db\.([a-z0-9]{20})\.supabase\.co$/.exec(host);
  const pooler = /^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(host);
  const user = /^postgres\.([a-z0-9]{20})$/.exec(client.user || "");
  return {
    hostnameFingerprint: host ? createHash("sha256").update(host).digest("hex").slice(0, 16) : null,
    connectionType: direct ? "supabase_direct" : pooler ? "supabase_pooler" : "other",
    projectIdentifier: direct?.[1] || (pooler ? user?.[1] : null) || null,
  };
}

async function tableAvailability(client, names) {
  const result = await client.query(
    "select name, exists(select 1 from pg_class where oid=to_regclass('public.' || name) and relkind in ('r','p')) as available from unnest($1::text[]) as name",
    [names],
  );
  return Object.fromEntries(result.rows.map(row => [row.name, row.available === true]));
}

export function createProductionDiagnosticService({ database = pool, oci = ociDatabase, env = process.env } = {}) {
  return async function diagnostics() {
    const result = {
      applicationVersion: version,
      deploymentCommit: /^[a-f0-9]{7,40}$/i.test(env.RENDER_GIT_COMMIT || "") ? env.RENDER_GIT_COMMIT : null,
      environment: ["production", "staging", "development", "test"].includes(env.NODE_ENV) ? env.NODE_ENV : "unknown",
      authenticationProvider: "current_session_verified",
      database: { connectivity: "unavailable", tls: "unverified" },
      schema: { status: "unverified", migrationVersion: null, requiredTables: null },
      blog: { status: "unverified" },
      oci: { status: "unverified" },
    };
    let client;
    try {
      client = await database.connect();
      result.database = { connectivity: "connected", tls: "unverified", ...connectionIdentity(client) };
      if (isVerifiedDatabaseConnection(client)) {
        result.database.tls = "verified";
        const requiredTables = await tableAvailability(client, tables);
        const ledger = await client.query("select to_regclass('supabase_migrations.schema_migrations') is not null as present");
        let migrationVersion = null;
        if (ledger.rows[0]?.present) {
          const migrations = await client.query("select max(version) as version from supabase_migrations.schema_migrations");
          const value = migrations.rows[0]?.version;
          if (typeof value === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(value)) migrationVersion = value;
        }
        result.schema = { status: ledger.rows[0]?.present ? "ledger_read" : "ledger_absent", migrationVersion, requiredTables };
        result.blog.status = blogTables.every(name => requiredTables[name]) ? "tables_present_service_unverified" : "required_tables_missing";
      } else {
        console.error("production_diagnostic_database_tls_unverified");
      }
    } catch {
      console.error("production_diagnostic_database_unavailable");
      if (result.database.connectivity === "connected") result.schema.status = "query_failed";
    } finally {
      if (client) client.release();
    }

    let ociClient;
    try {
      ociClient = await oci.connect();
      if (!isVerifiedDatabaseConnection(ociClient)) {
        result.oci.status = "tls_unverified";
        console.error("production_diagnostic_oci_tls_unverified");
      } else {
        const requiredTables = await tableAvailability(ociClient, ociTables);
        result.oci = {
          status: ociTables.every(name => requiredTables[name]) ? "tables_present_service_unverified" : "required_tables_missing",
          requiredTables,
        };
      }
    } catch {
      result.oci.status = "unavailable";
      console.error("production_diagnostic_oci_unavailable");
    } finally {
      if (ociClient) ociClient.release();
    }
    return result;
  };
}
