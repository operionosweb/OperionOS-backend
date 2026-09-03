import crypto from "node:crypto";
import dns from "node:dns/promises";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { answerContractQuestion } from "../services/phase3/intelligence/contractAssistantService.js";

const { Pool } = pg;
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TEST_ENV_FILE = path.join(ROOT, ".env.phase3-test.local");
const REQUIRED_MIGRATIONS = [
  "006_ai_intelligence_foundation.sql",
  "007_contract_intelligence_technical_foundation.sql",
  "008_contract_upload_docx.sql",
  "009_document_structure_pages.sql",
  "010_semantic_obligation_fields.sql",
  "011_deadline_temporal_intelligence.sql",
  "012_contract_risk_intelligence.sql",
  "013_nonproduction_validation_hardening.sql",
  "014_durable_ai_state_hardening.sql",
  "015_aviation_intelligence_foundation.sql",
  "016_contract_intelligence_core.sql",
];
const NONEMPTY_ADDITIVE_MIGRATIONS = new Set([
  "015_aviation_intelligence_foundation.sql",
  "016_contract_intelligence_core.sql",
]);

const MIGRATION_SENTINELS = Object.freeze({
  "006_ai_intelligence_foundation.sql": ["table", "ai_intelligence_cache"],
  "007_contract_intelligence_technical_foundation.sql": ["table", "contract_sections"],
  "008_contract_upload_docx.sql": ["semantic", "docx_ingestion"],
  "009_document_structure_pages.sql": ["table", "contract_document_pages"],
  "010_semantic_obligation_fields.sql": ["column", "obligations.modality"],
  "011_deadline_temporal_intelligence.sql": ["column", "deadlines.deadline_identity"],
  "012_contract_risk_intelligence.sql": ["column", "risks.risk_identity"],
  "013_nonproduction_validation_hardening.sql": ["policy", "ai_budget_member_select"],
  "014_durable_ai_state_hardening.sql": ["policy", "analysis_runs_member_select"],
  "015_aviation_intelligence_foundation.sql": ["table", "aircraft_contract_relationships"],
  "016_contract_intelligence_core.sql": ["table", "contract_intelligence_profiles"],
});

const RLS_TABLES = Object.freeze([
  "contracts", "documents", "document_versions", "document_version_extractions", "analysis_runs",
  "contract_sections", "contract_document_chunks", "contract_document_pages",
  "contract_intelligence_analyses", "document_version_pages", "contract_parties",
  "clauses", "obligations", "deadlines", "risks", "recommendations", "intelligence_evidence",
  "contract_search_chunks", "contract_clauses", "contract_obligations",
  "clause_evidence", "obligation_evidence", "deadline_evidence", "risk_evidence",
  "recommendation_evidence", "party_evidence",
  "ai_intelligence_budgets", "ai_intelligence_jobs", "ai_intelligence_usage",
  "ai_intelligence_cache",
  "aircraft", "aircraft_organization_relationships", "aviation_flights", "flight_positions",
  "aircraft_contract_relationships",
  "contract_intelligence_profiles",
]);

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function loadSafeConfig() {
  dotenv.config({ path: TEST_ENV_FILE, override: true, quiet: true });
  const required = [
    "PHASE3_SUPABASE_PROJECT_REF", "SUPABASE_URL", "SUPABASE_ANON_KEY",
    "SUPABASE_TEST_SERVICE_ROLE_KEY", "DATABASE_URL",
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) fail("TEST_CONFIGURATION_MISSING", `Missing test configuration: ${missing.join(", ")}`);
  if (process.env.PHASE3_DB_TEST_ENABLED !== "1") fail("LIVE_TEST_DISABLED", "PHASE3_DB_TEST_ENABLED must equal 1");
  if (process.env.PHASE3_DB_ENV !== "non-production-test") fail("PRODUCTION_GUARD", "PHASE3_DB_ENV must equal non-production-test");
  const allowNonemptyAdditiveMigrations = process.env.PHASE3_ALLOW_NONEMPTY_ADDITIVE_MIGRATIONS === "1";
  if (process.env.PHASE3_EMPTY_DATABASE !== "1" && !allowNonemptyAdditiveMigrations) {
    fail("DATABASE_GUARD", "PHASE3_EMPTY_DATABASE or PHASE3_ALLOW_NONEMPTY_ADDITIVE_MIGRATIONS must equal 1");
  }
  const projectRef = process.env.PHASE3_SUPABASE_PROJECT_REF;
  if (/(^|[-_])(prod|production)([-_]|$)/i.test(projectRef)) fail("PRODUCTION_GUARD", "Production-like project reference rejected");
  const supabaseUrl = new URL(process.env.SUPABASE_URL);
  const databaseUrl = new URL(process.env.DATABASE_URL);
  if (supabaseUrl.hostname.split(".")[0] !== projectRef) fail("PROJECT_MISMATCH", "SUPABASE_URL does not match PHASE3_SUPABASE_PROJECT_REF");
  if (!decodeURIComponent(databaseUrl.username).includes(projectRef)) fail("PROJECT_MISMATCH", "DATABASE_URL username is not scoped to the configured project");
  return {
    projectRef,
    supabaseUrl: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_TEST_SERVICE_ROLE_KEY,
    databaseUrl: process.env.DATABASE_URL,
    applyMigrations: process.env.PHASE3_APPLY_MIGRATIONS === "1",
    runIntegration: process.env.PHASE3_RUN_INTEGRATION === "1",
    allowNonemptyAdditiveMigrations,
  };
}

async function migrationFiles() {
  const directory = path.join(ROOT, "supabase", "migrations");
  const files = (await fs.readdir(directory)).filter((file) => /^\d{3}_.+[.]sql$/.test(file)).sort();
  for (const required of REQUIRED_MIGRATIONS) {
    if (!files.includes(required)) fail("MIGRATION_MISSING", `Required migration is missing: ${required}`);
  }
  const requiredOrder = files.filter((file) => REQUIRED_MIGRATIONS.includes(file));
  if (JSON.stringify(requiredOrder) !== JSON.stringify(REQUIRED_MIGRATIONS)) {
    fail("MIGRATION_ORDER_INVALID", "Migrations 006-016 are not ordered correctly");
  }
  return files;
}

export function hasDocxMigrationSemantics({ constraints = [], policies = [] } = {}) {
  const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const requiredConstraints = ["documents_mime_type_check", "document_versions_mime_type_check"];
  const constraintsSupportDocx = requiredConstraints.every((name) => {
    const definition = constraints.find((constraint) => constraint.conname === name)?.definition || "";
    return definition.includes("application/pdf") && definition.includes(docxMime);
  });
  const requiredPolicies = [
    ["contract_storage_member_read", "SELECT"],
    ["contract_storage_member_insert", "INSERT"],
    ["contract_storage_member_delete", "DELETE"],
  ];
  const policiesSupportDocx = requiredPolicies.every(([name, command]) => {
    const policy = policies.find((candidate) => candidate.schemaname === "storage"
      && candidate.tablename === "objects" && candidate.policyname === name && candidate.cmd === command);
    const predicate = `${policy?.qual || ""} ${policy?.with_check || ""}`;
    return predicate.includes("contract-documents")
      && predicate.includes("pdf")
      && predicate.includes("docx")
      && predicate.includes("is_organization_member");
  });
  return constraintsSupportDocx && policiesSupportDocx;
}

async function resolveEndpoint(hostname, label) {
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses.length) fail(`${label}_DNS_FAILED`, `${label} hostname did not resolve: ${hostname}`);
    return [...new Set(addresses.map((entry) => entry.address))];
  } catch (error) {
    if (error.code?.endsWith("_DNS_FAILED")) throw error;
    fail(`${label}_DNS_FAILED`, `${label} hostname did not resolve: ${hostname} (${error.code || error.name})`);
  }
}

async function probeTcp(hostname, port) {
  await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: hostname, port });
    const finish = (error) => {
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };
    socket.setTimeout(5000, () => finish(Object.assign(new Error("TCP connection timed out"), { code: "ETIMEDOUT" })));
    socket.once("connect", () => finish());
    socket.once("error", finish);
  }).catch((error) => fail("POSTGRES_TCP_FAILED", `PostgreSQL TCP connection failed for ${hostname}:${port} (${error.code || error.name})`));
}

async function verifyConnectivity(config) {
  const apiUrl = new URL(config.supabaseUrl);
  const databaseUrl = new URL(config.databaseUrl);
  const apiAddresses = await resolveEndpoint(apiUrl.hostname, "API");
  let apiStatus;
  try {
    const response = await fetch(new URL("/auth/v1/health", apiUrl), { redirect: "manual", signal: AbortSignal.timeout(5000) });
    apiStatus = response.status;
  } catch (error) {
    fail("API_UNREACHABLE", `Supabase API is unreachable at ${apiUrl.hostname} (${error.cause?.code || error.code || error.name})`);
  }
  const databaseAddresses = await resolveEndpoint(databaseUrl.hostname, "POSTGRES");
  const databasePort = Number(databaseUrl.port || 5432);
  await probeTcp(databaseUrl.hostname, databasePort);
  return {
    api: { hostname: apiUrl.hostname, addresses: apiAddresses, status: apiStatus },
    database: { hostname: databaseUrl.hostname, addresses: databaseAddresses, port: databasePort },
  };
}

async function readSentinels(pool) {
  const [tables, columns, constraints, policies] = await Promise.all([
    pool.query("select table_name from information_schema.tables where table_schema = 'public'"),
    pool.query("select table_name, column_name from information_schema.columns where table_schema = 'public'"),
    pool.query("select conname, pg_get_constraintdef(pg_constraint.oid) as definition from pg_constraint join pg_namespace on pg_namespace.oid = pg_constraint.connamespace where nspname = 'public'"),
    pool.query("select schemaname, tablename, policyname, cmd, qual, with_check from pg_policies where schemaname in ('public', 'storage')"),
  ]);
  const tableSet = new Set(tables.rows.map((row) => row.table_name));
  const columnSet = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const constraintSet = new Set(constraints.rows.map((row) => row.conname));
  const policySet = new Set(policies.rows.map((row) => row.policyname));
  const semanticSet = new Set(hasDocxMigrationSemantics({ constraints: constraints.rows, policies: policies.rows }) ? ["docx_ingestion"] : []);
  return Object.fromEntries(Object.entries(MIGRATION_SENTINELS).map(([migration, [kind, name]]) => [
    migration,
    kind === "table" ? tableSet.has(name)
      : kind === "column" ? columnSet.has(name)
        : kind === "constraint" ? constraintSet.has(name)
          : kind === "policy" ? policySet.has(name)
            : semanticSet.has(name),
  ]));
}

async function applyMissingMigrations(pool, sentinels) {
  const missing = REQUIRED_MIGRATIONS.filter((migration) => !sentinels[migration]);
  if (!missing.length) return [];
  if (!process.env.PHASE3_APPLY_MIGRATIONS || process.env.PHASE3_APPLY_MIGRATIONS !== "1") {
    fail("MIGRATIONS_NOT_APPLIED", `Missing migrations: ${missing.join(", ")}`);
  }
  const firstMissing = REQUIRED_MIGRATIONS.indexOf(missing[0]);
  if (REQUIRED_MIGRATIONS.slice(firstMissing).some((migration) => sentinels[migration])) {
    fail("PARTIAL_MIGRATION_STATE", "A later migration exists while an earlier migration is missing");
  }
  for (const migration of missing) {
    const sql = await fs.readFile(path.join(ROOT, "supabase", "migrations", migration), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      error.code = error.code || "MIGRATION_FAILED";
      throw error;
    } finally {
      client.release();
    }
  }
  return missing;
}

export async function assertNonemptyMigrationPlan(migrations, readMigration = async (migration) => fs.readFile(path.join(ROOT, "supabase", "migrations", migration), "utf8")) {
  const unsupported = migrations.filter((migration) => !NONEMPTY_ADDITIVE_MIGRATIONS.has(migration));
  if (unsupported.length) fail("NONEMPTY_MIGRATION_NOT_ALLOWED", `Non-empty migration plan is not allowlisted: ${unsupported.join(", ")}`);
  for (const migration of migrations) {
    const sql = await readMigration(migration);
    if (/\b(drop\s+(table|column)|truncate|delete\s+from|update\s+\w+\s+set)\b/i.test(sql)) {
      fail("DESTRUCTIVE_MIGRATION_REJECTED", `Non-empty migration contains a prohibited destructive statement: ${migration}`);
    }
  }
}

function migrationReadiness(sentinels, applyMigrations) {
  const missing = REQUIRED_MIGRATIONS.filter((migration) => !sentinels[migration]);
  if (!missing.length) return { state: "current", missing, applyEnabled: applyMigrations };
  const firstMissing = REQUIRED_MIGRATIONS.indexOf(missing[0]);
  if (REQUIRED_MIGRATIONS.slice(firstMissing).some((migration) => sentinels[migration])) {
    fail("PARTIAL_MIGRATION_STATE", "A later migration exists while an earlier migration is missing");
  }
  if (!applyMigrations) fail("MIGRATIONS_NOT_APPLIED", `Missing migrations and PHASE3_APPLY_MIGRATIONS is disabled: ${missing.join(", ")}`);
  return { state: "contiguous_suffix_ready", missing, applyEnabled: true };
}

async function verifySchema(pool) {
  const sentinels = await readSentinels(pool);
  const missing = Object.entries(sentinels).filter(([, present]) => !present).map(([migration]) => migration);
  if (missing.length) fail("SCHEMA_INCOMPLETE", `Migration sentinels missing after application: ${missing.join(", ")}`);

  const rls = await pool.query(
    "select relname, relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where nspname = 'public' and relname = any($1)",
    [RLS_TABLES]
  );
  const rlsByTable = new Map(rls.rows.map((row) => [row.relname, row.relrowsecurity]));
  const unprotected = RLS_TABLES.filter((table) => rlsByTable.get(table) !== true);
  if (unprotected.length) fail("RLS_NOT_ENABLED", `RLS is not enabled for: ${unprotected.join(", ")}`);

  const policies = await pool.query(
    "select schemaname, tablename, policyname, cmd, roles, qual, with_check from pg_policies where (schemaname = 'public' and tablename = any($1)) or (schemaname = 'storage' and tablename = 'objects') order by schemaname, tablename, policyname",
    [RLS_TABLES]
  );
  const policyTables = new Set(policies.rows.filter((row) => row.schemaname === "public").map((row) => row.tablename));
  const missingPolicies = RLS_TABLES.filter((table) => !policyTables.has(table));
  if (missingPolicies.length) fail("RLS_POLICY_MISSING", `No RLS policy exists for: ${missingPolicies.join(", ")}`);
  const serverOwnedTables = [
    "document_version_extractions", "analysis_runs",
    "ai_intelligence_budgets", "ai_intelligence_jobs", "ai_intelligence_usage", "ai_intelligence_cache",
    "contract_sections", "contract_document_chunks", "contract_intelligence_analyses", "contract_document_pages",
    "document_version_pages", "contract_parties", "intelligence_evidence",
    "clauses", "obligations", "deadlines", "risks", "recommendations", "contract_search_chunks",
    "contract_clauses", "contract_obligations", "clause_evidence", "obligation_evidence",
    "deadline_evidence", "risk_evidence", "recommendation_evidence", "party_evidence",
    "aircraft", "aircraft_organization_relationships", "aviation_flights", "flight_positions",
    "aircraft_contract_relationships",
    "contract_intelligence_profiles",
  ];
  const broadServerOwnedPolicies = policies.rows.filter((policy) => policy.schemaname === "public"
    && serverOwnedTables.includes(policy.tablename) && policy.cmd !== "SELECT");
  if (broadServerOwnedPolicies.length) {
    fail("SERVER_OWNED_WRITE_POLICY", `Authenticated write policies exist for server-owned tables: ${[...new Set(broadServerOwnedPolicies.map((policy) => policy.tablename))].join(", ")}`);
  }
  const storagePolicies = policies.rows.filter((row) => row.schemaname === "storage" && row.tablename === "objects");
  for (const operation of ["SELECT", "INSERT", "DELETE"]) {
    if (!storagePolicies.some((policy) => policy.cmd === operation && `${policy.qual || ""} ${policy.with_check || ""}`.includes("is_organization_member"))) {
      fail("STORAGE_POLICY_MISSING", `Organization-scoped storage ${operation} policy is missing`);
    }
  }

  const constraints = await pool.query(
    "select conname, contype, conrelid::regclass::text as table_name, pg_get_constraintdef(pg_constraint.oid) as definition from pg_constraint join pg_namespace on pg_namespace.oid = pg_constraint.connamespace where nspname = 'public'"
  );
  const constraintNames = new Set(constraints.rows.map((row) => row.conname));
  const requiredConstraints = [
    "documents_contract_organization_fk", "document_versions_document_organization_fk",
    "analysis_runs_contract_organization_fk", "analysis_runs_document_version_organization_fk",
    "deadlines_source_clause_fk", "deadlines_source_evidence_fk",
    "risks_probability_absent_check", "risks_contract_category_check",
    "contracts_source_document_fk", "aircraft_contract_source_evidence_fk",
  ];
  const absentConstraints = requiredConstraints.filter((name) => !constraintNames.has(name));
  if (absentConstraints.length) fail("CONSTRAINT_MISSING", `Required constraints are missing: ${absentConstraints.join(", ")}`);

  const indexes = await pool.query("select indexname from pg_indexes where schemaname = 'public'");
  const indexNames = new Set(indexes.rows.map((row) => row.indexname));
  const requiredIndexes = [
    "ai_cache_identity_idx", "ai_jobs_active_request_uidx", "contract_sections_version_order_idx", "contract_document_pages_version_idx",
    "deadlines_identity_scope_uidx", "risks_identity_scope_uidx",
    "contract_profiles_scope_idx", "contract_number_scope_idx", "aircraft_contract_identifier_idx",
    "phase3_chunks_scope_idx", "phase3_chunks_search_idx",
  ];
  const absentIndexes = requiredIndexes.filter((name) => !indexNames.has(name));
  if (absentIndexes.length) fail("INDEX_MISSING", `Required indexes are missing: ${absentIndexes.join(", ")}`);

  const requiredColumns = {
    contracts: ["contract_number", "contract_type_confidence", "renewal_date", "auto_renewal", "governing_law", "currency", "source_document_id", "metadata_confidence"],
    contract_intelligence_profiles: ["organization_id", "contract_id", "document_id", "document_version_id", "analysis_run_id", "metadata", "classification", "executive_summary", "evidence_claims", "confidence"],
    aircraft_contract_relationships: ["source_identifier", "source_evidence_id"],
  };
  const columnRows = await pool.query(
    "select table_name, column_name from information_schema.columns where table_schema = 'public' and table_name = any($1)",
    [Object.keys(requiredColumns)]
  );
  const columnSet = new Set(columnRows.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missingColumns = Object.entries(requiredColumns).flatMap(([table, columns]) => columns.filter((column) => !columnSet.has(`${table}.${column}`)).map((column) => `${table}.${column}`));
  if (missingColumns.length) fail("COLUMN_MISSING", `Contract intelligence columns are missing: ${missingColumns.join(", ")}`);

  const profileRunUnique = constraints.rows.some((constraint) => constraint.table_name === "contract_intelligence_profiles"
    && constraint.contype === "u"
    && /organization_id, analysis_run_id/i.test(constraint.definition));
  if (!profileRunUnique) fail("IDEMPOTENCY_CONSTRAINT_MISSING", "Contract profile tenant/run uniqueness constraint is missing");

  const triggers = await pool.query("select trigger_name from information_schema.triggers where event_object_schema = 'public' and event_object_table = 'contract_intelligence_profiles'");
  if (!triggers.rows.some((row) => row.trigger_name === "prevent_contract_profile_update")) {
    fail("IMMUTABILITY_TRIGGER_MISSING", "Contract profile immutability trigger is missing");
  }
  return { policyCount: policies.rows.length, rlsTableCount: RLS_TABLES.length, verifiedContractIntelligenceColumns: columnSet.size, profileImmutable: true };
}

async function targetCounts(pool) {
  const result = await pool.query(`
    select
      (select count(*) from public.organizations)::int as organizations,
      (select count(*) from auth.users)::int as users,
      (select count(*) from public.contracts)::int as contracts,
      (select count(*) from storage.objects where bucket_id = 'contract-documents')::int as storage_objects
  `);
  return result.rows[0];
}

function uuid() {
  return crypto.randomUUID();
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

async function expectDatabaseFailure(pool, sql, values, codes = ["23503", "23505", "23514", "P0001"]) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try {
      await client.query(sql, values);
      await client.query("ROLLBACK");
      return { pass: false, code: null };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      return { pass: codes.includes(error.code), code: error.code || null };
    }
  } finally {
    client.release();
  }
}

function fixtureIds() {
  return {
    organizations: [uuid(), uuid()],
    contracts: [uuid(), uuid()],
    legacyVersions: [uuid(), uuid()],
    legacyClauses: [uuid(), uuid()],
    legacyObligations: [uuid(), uuid()],
    documents: [uuid(), uuid()],
    versions: [[uuid(), uuid()], [uuid()]],
    runs: [[uuid(), uuid()], [uuid()]],
    sections: [uuid(), uuid()],
    chunks: [uuid(), uuid()],
    pages: [uuid(), uuid()],
    evidence: [uuid(), uuid()],
    clauses: [uuid(), uuid()],
    obligations: [uuid(), uuid()],
    deadlines: [uuid(), uuid()],
    risks: [uuid(), uuid()],
    jobs: [uuid(), uuid()],
    usage: [uuid(), uuid()],
    cache: [uuid(), uuid()],
    users: [],
    storagePaths: [],
  };
}

async function createUsers(admin, ids) {
  const users = [];
  for (const tenant of ["a", "b"]) {
    const email = `operion-step75-${uuid()}-${tenant}@example.invalid`;
    const password = `${uuid()}-TestOnly!`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    users.push({ id: data.user.id, email, password });
    ids.users.push(data.user.id);
  }
  return users;
}

async function createFixture(pool, users, ids) {
  const client = await pool.connect();
  const text = [
    "Aircraft Lease Agreement",
    "The Lessee shall maintain the Aircraft and notify damage within five Business Days.",
    "Late payment incurs a fee of EUR 100,000.",
  ].join("\n");
  try {
    await client.query("BEGIN");
    for (let tenant = 0; tenant < 2; tenant += 1) {
      const organizationId = ids.organizations[tenant];
      const contractId = ids.contracts[tenant];
      const documentId = ids.documents[tenant];
      const versionId = ids.versions[tenant][0];
      const runId = ids.runs[tenant][0];
      const storageKey = `organizations/${organizationId}/documents/${documentId}/versions/${versionId}/source.pdf`;
      await client.query("insert into organizations (id, name, slug) values ($1,$2,$3)", [organizationId, `Step 7.5 Tenant ${tenant}`, `step75-${organizationId}`]);
      await client.query("insert into organization_memberships (organization_id, user_id, role) values ($1,$2,'owner')", [organizationId, users[tenant].id]);
      await client.query("insert into contracts (id, organization_id, created_by, title) values ($1,$2,$3,$4)", [contractId, organizationId, users[tenant].id, `Synthetic aircraft lease ${tenant}`]);
      await client.query("insert into contract_versions (id, contract_id, version_number, storage_path, content_hash, created_by) values ($1,$2,1,$3,$4,$5)", [ids.legacyVersions[tenant], contractId, `legacy/${ids.legacyVersions[tenant]}.txt`, hash(`legacy-version-${tenant}`), users[tenant].id]);
      await client.query("insert into contract_clauses (id, contract_version_id, clause_number, title, body) values ($1,$2,'1','Legacy Maintenance',$3)", [ids.legacyClauses[tenant], ids.legacyVersions[tenant], text]);
      await client.query("insert into contract_obligations (id, contract_clause_id, owner, description) values ($1,$2,'Lessee',$3)", [ids.legacyObligations[tenant], ids.legacyClauses[tenant], "Maintain the Aircraft."]);
      await client.query("insert into documents (id, organization_id, contract_id, created_by, filename, mime_type, file_size, storage_key, sha256) values ($1,$2,$3,$4,$5,'application/pdf',$6,$7,$8)", [documentId, organizationId, contractId, users[tenant].id, `lease-${tenant}.pdf`, text.length, storageKey, hash(text)]);
      await client.query("insert into document_versions (id, document_id, organization_id, contract_id, version_number, sha256, storage_key, mime_type, file_size, extraction_status, created_by, processing_status) values ($1,$2,$3,$4,1,$5,$6,'application/pdf',$7,'completed',$8,'processed')", [versionId, documentId, organizationId, contractId, hash(text), storageKey, text.length, users[tenant].id]);
      await client.query("insert into analysis_runs (id, organization_id, contract_id, document_version_id, status, pipeline_version, requested_by) values ($1,$2,$3,$4,'extracting','step75-validation',$5)", [runId, organizationId, contractId, versionId, users[tenant].id]);
      await client.query("insert into contract_sections (id, organization_id, contract_id, document_id, document_version_id, heading, section_order, source_text) values ($1,$2,$3,$4,$5,'Maintenance',0,$6)", [ids.sections[tenant], organizationId, contractId, documentId, versionId, text]);
      await client.query("insert into contract_document_chunks (id, organization_id, contract_id, document_id, document_version_id, section_id, page_number, chunk_order, source_text, content_hash) values ($1,$2,$3,$4,$5,$6,1,0,$7,$8)", [ids.chunks[tenant], organizationId, contractId, documentId, versionId, ids.sections[tenant], text, hash(text)]);
      await client.query("insert into contract_document_pages (id, organization_id, contract_id, document_id, document_version_id, page_number, text_content, text_length, char_start, char_end, text_hash) values ($1,$2,$3,$4,$5,1,$6,$7,0,$7,$8)", [ids.pages[tenant], organizationId, contractId, documentId, versionId, text, text.length, hash(text)]);
      await client.query("insert into intelligence_evidence (id, organization_id, contract_id, document_id, document_version_id, analysis_run_id, page_number, excerpt, char_start, char_end, source_locator, stage, pipeline_version, confidence, evidence_hash) values ($1,$2,$3,$4,$5,$6,1,$7,0,$8,$9,'clause','step75-validation',0.99,$10)", [ids.evidence[tenant], organizationId, contractId, documentId, versionId, runId, text, text.length, `page:1:char:0-${text.length}`, hash(text)]);
      await client.query("insert into clauses (id, organization_id, contract_id, document_id, document_version_id, analysis_run_id, clause_number, title, category, source_text, confidence, review_status, clause_identity) values ($1,$2,$3,$4,$5,$6,'1','Maintenance','maintenance',$7,0.99,'pending',$8)", [ids.clauses[tenant], organizationId, contractId, documentId, versionId, runId, text, hash(`clause-${tenant}`)]);
      await client.query("insert into clause_evidence (organization_id, clause_id, evidence_id, rank, support_type, is_primary) values ($1,$2,$3,1,'supports',true)", [organizationId, ids.clauses[tenant], ids.evidence[tenant]]);
      await client.query("insert into obligations (id, organization_id, contract_id, document_id, document_version_id, analysis_run_id, clause_id, description, obligation_type, priority, status, confidence, review_status, actor, action, object, timing_expression, modality, obligation_identity) values ($1,$2,$3,$4,$5,$6,$7,$8,'maintenance','high','identified',0.98,'pending','Lessee','maintain','Aircraft','within five Business Days','mandatory',$9)", [ids.obligations[tenant], organizationId, contractId, documentId, versionId, runId, ids.clauses[tenant], "Maintain the Aircraft and notify damage within five Business Days.", hash(`obligation-${tenant}`)]);
      await client.query("insert into obligation_evidence (organization_id, obligation_id, evidence_id, rank, support_type, is_primary) values ($1,$2,$3,1,'supports',true)", [organizationId, ids.obligations[tenant], ids.evidence[tenant]]);
      await client.query("insert into deadlines (id, organization_id, contract_id, document_id, document_version_id, analysis_run_id, obligation_id, source_clause_id, source_evidence_id, deadline_type, original_expression, timing_expression, structured_timing, trigger_type, trigger_expression, amount, unit, calendar_type, direction, computability, confidence, status, review_status, deadline_identity) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'relative',$10,$10,$11,'event','damage',5,'business_days','business','after','relative_event',0.98,'awaiting_trigger','pending',$12)", [ids.deadlines[tenant], organizationId, contractId, documentId, versionId, runId, ids.obligations[tenant], ids.clauses[tenant], ids.evidence[tenant], "within five Business Days after damage", JSON.stringify({ amount: 5, unit: "business_days" }), hash(`deadline-${tenant}`)]);
      await client.query("insert into deadline_evidence (organization_id, deadline_id, evidence_id, rank, support_type, is_primary) values ($1,$2,$3,1,'supports',true)", [organizationId, ids.deadlines[tenant], ids.evidence[tenant]]);
      await client.query("insert into risks (id, organization_id, contract_id, document_id, document_version_id, analysis_run_id, clause_id, risk_category, risk_type, title, description, rationale, severity, probability, impact, exposure, explanation, confidence, source_type, source_references, financial_exposure, consequence, affected_obligation_ids, affected_deadline_ids, status, risk_version, metadata, risk_identity, review_status) values ($1,$2,$3,$4,$5,$6,$7,'financial','penalty_exposure','Explicit payment consequence','EUR 100,000 late fee','The contract states a quantified late fee.','high',null,'Payment may become due.','EUR 100,000','The contract states a quantified late fee.',0.99,'multiple',$8,$9,'Payment may become due.',$10,$11,'identified','step75-validation','{}'::jsonb,$12,'pending')", [ids.risks[tenant], organizationId, contractId, documentId, versionId, runId, ids.clauses[tenant], JSON.stringify([{ source_type: "clause", source_id: ids.clauses[tenant] }]), JSON.stringify({ type: "quantified", currency: "EUR", amount: 100000 }), [ids.obligations[tenant]], [ids.deadlines[tenant]], hash(`risk-${tenant}`)]);
      await client.query("insert into risk_evidence (organization_id, risk_id, evidence_id, rank, support_type, is_primary) values ($1,$2,$3,1,'supports',true)", [organizationId, ids.risks[tenant], ids.evidence[tenant]]);
      await client.query("insert into ai_intelligence_budgets (organization_id, billing_period_start, billing_period_end, allocated_intelligence, consumed_intelligence, reserved_intelligence) values ($1,current_date,current_date + 30,1000,$2,0)", [organizationId, tenant * 10]);
      await client.query("insert into ai_intelligence_jobs (id, organization_id, user_id, contract_id, document_version_id, operation_type, status, estimated_intelligence, actual_intelligence, provider, model) values ($1,$2,$3,$4,$5,'risk_reasoning','completed',35,35,'mistral','test-mistral')", [ids.jobs[tenant], organizationId, users[tenant].id, contractId, versionId]);
      await client.query("insert into ai_intelligence_usage (id, organization_id, job_id, user_id, operation_type, estimated_intelligence, actual_intelligence, provider, model) values ($1,$2,$3,$4,'risk_reasoning',35,35,'mistral','test-mistral')", [ids.usage[tenant], organizationId, ids.jobs[tenant], users[tenant].id]);
      await client.query("insert into ai_intelligence_cache (id, organization_id, document_hash, operation_type, analysis_version, prompt_version, provider, model, result) values ($1,$2,$3,'risk_reasoning','step75-validation','risk-v1','mistral','test-mistral',$4)", [ids.cache[tenant], organizationId, hash(text), JSON.stringify({ risk_id: ids.risks[tenant] })]);
    }

    const versionId = ids.versions[0][1];
    const runId = ids.runs[0][1];
    const versionText = `${text}\nVersion 2 removes the late fee.`;
    const storageKey = `organizations/${ids.organizations[0]}/documents/${ids.documents[0]}/versions/${versionId}/source.pdf`;
    await client.query("insert into document_versions (id, document_id, organization_id, contract_id, version_number, sha256, storage_key, mime_type, file_size, extraction_status, created_by, processing_status) values ($1,$2,$3,$4,2,$5,$6,'application/pdf',$7,'completed',$8,'processed')", [versionId, ids.documents[0], ids.organizations[0], ids.contracts[0], hash(versionText), storageKey, versionText.length, users[0].id]);
    await client.query("insert into analysis_runs (id, organization_id, contract_id, document_version_id, status, pipeline_version, requested_by) values ($1,$2,$3,$4,'completed','step75-validation',$5)", [runId, ids.organizations[0], ids.contracts[0], versionId, users[0].id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  return { text };
}

async function authenticatedClient(config, user) {
  const client = createClient(config.supabaseUrl, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return client;
}

function testRecorder() {
  const results = [];
  return {
    results,
    check(id, pass, detail) {
      results.push({ id, status: pass ? "PASS" : "FAIL", detail });
    },
  };
}

async function verifyRls({ config, users, ids, record }) {
  const clients = [await authenticatedClient(config, users[0]), await authenticatedClient(config, users[1])];
  const tables = [
    "contracts", "documents", "document_versions", "analysis_runs", "contract_sections",
    "contract_document_chunks", "contract_document_pages", "clauses", "obligations", "deadlines",
    "risks", "intelligence_evidence", "clause_evidence", "obligation_evidence", "deadline_evidence",
    "risk_evidence", "ai_intelligence_budgets", "ai_intelligence_jobs", "ai_intelligence_usage", "ai_intelligence_cache",
  ];
  try {
    for (let tenant = 0; tenant < 2; tenant += 1) {
      const other = tenant === 0 ? 1 : 0;
      for (const table of tables) {
        const own = await clients[tenant].from(table).select("organization_id").eq("organization_id", ids.organizations[tenant]);
        const cross = await clients[tenant].from(table).select("organization_id").eq("organization_id", ids.organizations[other]);
        record.check(`RLS-${tenant}-${table}`, !own.error && own.data.length > 0 && !cross.error && cross.data.length === 0, `own=${own.data?.length ?? "error"}; cross=${cross.data?.length ?? "error"}`);
      }
      for (const [table, ownId, crossId] of [
        ["contract_clauses", ids.legacyClauses[tenant], ids.legacyClauses[other]],
        ["contract_obligations", ids.legacyObligations[tenant], ids.legacyObligations[other]],
      ]) {
        const own = await clients[tenant].from(table).select("id").eq("id", ownId);
        const cross = await clients[tenant].from(table).select("id").eq("id", crossId);
        record.check(`RLS-${tenant}-${table}`, !own.error && own.data.length === 1 && !cross.error && cross.data.length === 0, `own=${own.data?.length ?? "error"}; cross=${cross.data?.length ?? "error"}`);
      }
      const tampering = [
        ["contracts", ids.contracts[other]], ["documents", ids.documents[other]],
        ["document_versions", ids.versions[other][0]], ["clauses", ids.clauses[other]], ["risks", ids.risks[other]],
      ];
      for (const [table, id] of tampering) {
        const result = await clients[tenant].from(table).select("id").eq("id", id);
        record.check(`ID-TAMPER-${tenant}-${table}`, !result.error && result.data.length === 0, `rows=${result.data?.length ?? "error"}`);
      }
    }
    const serverOwnedWrites = [
      ["ai_intelligence_budgets", "organization_id", ids.organizations[0], { allocated_intelligence: 999999 }],
      ["ai_intelligence_jobs", "id", ids.jobs[0], { status: "cancelled" }],
      ["ai_intelligence_cache", "id", ids.cache[0], { result: { tampered: true } }],
      ["analysis_runs", "id", ids.runs[0][0], { status: "failed" }],
      ["contract_sections", "id", ids.sections[0], { heading: "Tampered" }],
      ["contract_document_pages", "id", ids.pages[0], { page_number: 999 }],
      ["clauses", "id", ids.clauses[0], { title: "Tampered" }],
      ["obligations", "id", ids.obligations[0], { description: "Tampered" }],
      ["contract_clauses", "id", ids.legacyClauses[0], { title: "Tampered" }],
      ["contract_obligations", "id", ids.legacyObligations[0], { description: "Tampered" }],
    ];
    for (const [table, column, id, values] of serverOwnedWrites) {
      const write = await clients[0].from(table).update(values).eq(column, id).select();
      record.check(`RLS-SERVER-WRITE-${table}`, Boolean(write.error) || write.data.length === 0, write.error?.code || `rows=${write.data.length}`);
    }
  } finally {
    await Promise.all(clients.map((client) => client.auth.signOut()));
  }
}

async function verifyStorage({ config, admin, users, ids, record }) {
  const clients = [await authenticatedClient(config, users[0]), await authenticatedClient(config, users[1])];
  const anonymous = createClient(config.supabaseUrl, config.anonKey, { auth: { persistSession: false } });
  try {
    const extensions = ["pdf", "docx"];
    for (const extension of extensions) {
      const path = `organizations/${ids.organizations[0]}/documents/${ids.documents[0]}/versions/${ids.versions[0][0]}/source.${extension}`;
      ids.storagePaths.push(path);
      const upload = await clients[0].storage.from("contract-documents").upload(path, new Uint8Array([37, 80, 68, 70]), { contentType: extension === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true });
      record.check(`STORAGE-UPLOAD-${extension}`, !upload.error, upload.error?.message || "uploaded");
      const own = await clients[0].storage.from("contract-documents").download(path);
      const cross = await clients[1].storage.from("contract-documents").download(path);
      const unauthenticated = await anonymous.storage.from("contract-documents").download(path);
      record.check(`STORAGE-OWN-${extension}`, !own.error, own.error?.message || "downloaded");
      record.check(`STORAGE-CROSS-${extension}`, Boolean(cross.error), cross.error?.message || "unexpected access");
      record.check(`STORAGE-ANON-${extension}`, Boolean(unauthenticated.error), unauthenticated.error?.message || "unexpected access");
    }
    const crossList = await clients[1].storage.from("contract-documents").list(`organizations/${ids.organizations[0]}`);
    record.check("STORAGE-CROSS-LIST", Boolean(crossList.error) || crossList.data.length === 0, crossList.error?.message || `rows=${crossList.data.length}`);
  } finally {
    await Promise.all(clients.map((client) => client.auth.signOut()));
    if (ids.storagePaths.length) await admin.storage.from("contract-documents").remove(ids.storagePaths);
  }
}

async function verifyIntegrity({ pool, ids, record }) {
  const crossEvidence = await expectDatabaseFailure(pool,
    "insert into risk_evidence (organization_id, risk_id, evidence_id, rank, support_type, is_primary) values ($1,$2,$3,1,'supports',true)",
    [ids.organizations[0], ids.risks[0], ids.evidence[1]], ["23503"]);
  record.check("EVIDENCE-CROSS-TENANT", crossEvidence.pass, crossEvidence.code || "accepted");

  const badDeadline = await expectDatabaseFailure(pool,
    "insert into deadline_evidence (organization_id, deadline_id, evidence_id) values ($1,$2,$3)",
    [ids.organizations[0], uuid(), ids.evidence[0]], ["23503"]);
  record.check("EVIDENCE-ORPHAN", badDeadline.pass, badDeadline.code || "accepted");

  const businessDay = await pool.query("select unit, calendar_type from deadlines where id=$1", [ids.deadlines[0]]);
  record.check("DEADLINE-BUSINESS-DAY", businessDay.rows[0]?.unit === "business_days" && businessDay.rows[0]?.calendar_type === "business", JSON.stringify(businessDay.rows[0]));

  const risk = await pool.query("select probability, financial_exposure, affected_obligation_ids, affected_deadline_ids from risks where id=$1", [ids.risks[0]]);
  record.check("RISK-CONSERVATIVE-FINANCIAL", risk.rows[0]?.probability === null && Number(risk.rows[0]?.financial_exposure?.amount) === 100000, JSON.stringify(risk.rows[0]?.financial_exposure));

  const versionCounts = await pool.query("select document_version_id, count(*)::int from clauses where contract_id=$1 group by document_version_id", [ids.contracts[0]]);
  record.check("VERSION-ISOLATION", versionCounts.rows.length === 1 && versionCounts.rows[0].document_version_id === ids.versions[0][0], JSON.stringify(versionCounts.rows));

  const duplicateClause = await expectDatabaseFailure(pool,
    "insert into clauses (organization_id, contract_id, document_id, document_version_id, analysis_run_id, clause_number, title, category, source_text, confidence, review_status, clause_identity) select organization_id, contract_id, document_id, document_version_id, analysis_run_id, '99', title, category, source_text, confidence, review_status, clause_identity from clauses where id=$1",
    [ids.clauses[0]], ["23505"]);
  record.check("IDEMPOTENCY-CLAUSE", duplicateClause.pass, duplicateClause.code || "accepted");

  const duplicateDeadline = await expectDatabaseFailure(pool,
    "insert into deadlines (organization_id, contract_id, document_id, document_version_id, analysis_run_id, obligation_id, source_clause_id, source_evidence_id, deadline_type, original_expression, timing_expression, structured_timing, computability, confidence, status, review_status, deadline_identity) select organization_id, contract_id, document_id, document_version_id, analysis_run_id, obligation_id, source_clause_id, source_evidence_id, deadline_type, original_expression, timing_expression, structured_timing, computability, confidence, status, review_status, deadline_identity from deadlines where id=$1",
    [ids.deadlines[0]], ["23505"]);
  record.check("IDEMPOTENCY-DEADLINE", duplicateDeadline.pass, duplicateDeadline.code || "accepted");

  const rollbackIdentity = hash(`rollback-${uuid()}`);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try {
      await client.query("insert into risks (organization_id, contract_id, document_id, document_version_id, analysis_run_id, clause_id, risk_category, risk_type, title, description, rationale, severity, probability, explanation, confidence, source_type, risk_identity, review_status) values ($1,$2,$3,$4,$5,$6,'timing','short_notice_period','Rollback probe','Rollback probe','Rollback probe','low',null,'Rollback probe',0.8,'clause',$7,'pending')", [ids.organizations[0], ids.contracts[0], ids.documents[0], ids.versions[0][0], ids.runs[0][0], ids.clauses[0], rollbackIdentity]);
      await client.query("insert into risk_evidence (organization_id, risk_id, evidence_id) values ($1,$2,$3)", [ids.organizations[0], uuid(), ids.evidence[0]]);
      await client.query("COMMIT");
    } catch {
      await client.query("ROLLBACK");
    }
  } finally {
    client.release();
  }
  const rollbackCount = await pool.query("select count(*)::int as count from risks where risk_identity=$1", [rollbackIdentity]);
  record.check("TRANSACTION-RISK-ROLLBACK", rollbackCount.rows[0].count === 0, `rows=${rollbackCount.rows[0].count}`);

  const concurrentIdentity = hash(`concurrent-${uuid()}`);
  const concurrentSql = "insert into risks (organization_id, contract_id, document_id, document_version_id, analysis_run_id, clause_id, risk_category, risk_type, title, description, rationale, severity, probability, explanation, confidence, source_type, risk_identity, review_status) values ($1,$2,$3,$4,$5,$6,'timing','short_notice_period','Concurrent probe','Concurrent probe','Concurrent probe','low',null,'Concurrent probe',0.8,'clause',$7,'pending') on conflict (organization_id, analysis_run_id, risk_identity) do nothing returning id";
  const values = [ids.organizations[0], ids.contracts[0], ids.documents[0], ids.versions[0][0], ids.runs[0][0], ids.clauses[0], concurrentIdentity];
  const concurrent = await Promise.all([pool.query(concurrentSql, values), pool.query(concurrentSql, values)]);
  record.check("CONCURRENCY-RISK", concurrent.reduce((sum, result) => sum + result.rowCount, 0) === 1, `inserted=${concurrent.reduce((sum, result) => sum + result.rowCount, 0)}`);

  const cascadeClient = await pool.connect();
  try {
    await cascadeClient.query("BEGIN");
    await cascadeClient.query("delete from contracts where id=$1", [ids.contracts[1]]);
    const cascade = await cascadeClient.query("select (select count(*) from documents where contract_id=$1)::int documents, (select count(*) from clauses where contract_id=$1)::int clauses, (select count(*) from risks where contract_id=$1)::int risks", [ids.contracts[1]]);
    record.check("CASCADE-CONTRACT", Object.values(cascade.rows[0]).every((count) => Number(count) === 0), JSON.stringify(cascade.rows[0]));
    await cascadeClient.query("ROLLBACK");
  } finally {
    cascadeClient.release();
  }
}

async function verifyAnalysisAndAi({ pool, ids, users, record }) {
  const runId = uuid();
  await pool.query("insert into analysis_runs (id, organization_id, contract_id, document_version_id, status, pipeline_version, requested_by) values ($1,$2,$3,$4,'queued','step75-lifecycle',$5)", [runId, ids.organizations[0], ids.contracts[0], ids.versions[0][0], users[0].id]);
  for (const status of ["processing", "extracting", "analysing", "indexing", "completed"]) {
    await pool.query("update analysis_runs set status=$1 where id=$2", [status, runId]);
  }
  const terminalUpdate = await expectDatabaseFailure(pool, "update analysis_runs set status='processing' where id=$1", [runId], ["P0001"]);
  record.check("ANALYSIS-LIFECYCLE", terminalUpdate.pass, terminalUpdate.code || "terminal update accepted");

  const budgetRows = await pool.query("select organization_id, allocated_intelligence, consumed_intelligence from ai_intelligence_budgets where organization_id=any($1::uuid[])", [ids.organizations]);
  record.check("AI-BUDGET-PERSISTENCE", budgetRows.rows.length === 2, `rows=${budgetRows.rows.length}`);
  const cacheRows = await pool.query("select organization_id, document_hash from ai_intelligence_cache where organization_id=any($1::uuid[])", [ids.organizations]);
  record.check("AI-CACHE-ORG-IDENTITY", cacheRows.rows.length === 2 && cacheRows.rows[0].organization_id !== cacheRows.rows[1].organization_id, `rows=${cacheRows.rows.length}`);
  const usage = await pool.query("select count(*)::int count from ai_intelligence_usage where organization_id=any($1::uuid[])", [ids.organizations]);
  record.check("AI-USAGE-PERSISTENCE", usage.rows[0].count === 2, `rows=${usage.rows[0].count}`);

  const assistantScope = [ids.organizations[0], ids.runs[0][0]];
  const [assistantClauses, assistantObligations, assistantDeadlines, assistantRisks, assistantEvidence] = await Promise.all([
    pool.query("select * from clauses where organization_id=$1 and analysis_run_id=$2", assistantScope),
    pool.query("select * from obligations where organization_id=$1 and analysis_run_id=$2", assistantScope),
    pool.query("select * from deadlines where organization_id=$1 and analysis_run_id=$2", assistantScope),
    pool.query("select * from risks where organization_id=$1 and analysis_run_id=$2", assistantScope),
    pool.query("select id, excerpt, page_number, char_start, char_end, source_locator, confidence from intelligence_evidence where organization_id=$1 and analysis_run_id=$2", assistantScope),
  ]);
  const assistant = answerContractQuestion({
    question: "What penalty applies if payment is late?",
    clauses: assistantClauses.rows,
    obligations: assistantObligations.rows,
    deadlines: assistantDeadlines.rows,
    risks: assistantRisks.rows,
    evidence: assistantEvidence.rows,
  });
  record.check("ASSISTANT-EVIDENCE-GROUNDING", assistant.established && assistant.evidence.length > 0 && assistant.intelligenceConsumption === 0, `established=${assistant.established}; evidence=${assistant.evidence.length}`);

  const crossScope = [ids.organizations[0], ids.runs[1][0]];
  const crossTenantRows = await pool.query("select id from intelligence_evidence where organization_id=$1 and analysis_run_id=$2", crossScope);
  const crossTenant = answerContractQuestion({ question: "What penalty applies if payment is late?", evidence: crossTenantRows.rows });
  record.check("ASSISTANT-CROSS-TENANT", !crossTenant.established && crossTenantRows.rowCount === 0, `established=${crossTenant.established}; rows=${crossTenantRows.rowCount}`);
}

async function measureQueries(pool, ids) {
  const operations = {
    contract: ["select id from contracts where organization_id=$1 and id=$2", [ids.organizations[0], ids.contracts[0]]],
    version: ["select id from document_versions where organization_id=$1 and id=$2", [ids.organizations[0], ids.versions[0][0]]],
    structure: ["select id from contract_document_chunks where organization_id=$1 and document_version_id=$2 order by chunk_order", [ids.organizations[0], ids.versions[0][0]]],
    clause: ["select id from clauses where organization_id=$1 and analysis_run_id=$2", [ids.organizations[0], ids.runs[0][0]]],
    obligation: ["select id from obligations where organization_id=$1 and analysis_run_id=$2", [ids.organizations[0], ids.runs[0][0]]],
    deadline: ["select id from deadlines where organization_id=$1 and analysis_run_id=$2", [ids.organizations[0], ids.runs[0][0]]],
    risk: ["select id from risks where organization_id=$1 and analysis_run_id=$2", [ids.organizations[0], ids.runs[0][0]]],
    evidence: ["select id from intelligence_evidence where organization_id=$1 and analysis_run_id=$2", [ids.organizations[0], ids.runs[0][0]]],
  };
  const timings = {};
  for (const [name, [sql, values]] of Object.entries(operations)) {
    const started = performance.now();
    const result = await pool.query(sql, values);
    timings[name] = { durationMs: Number((performance.now() - started).toFixed(3)), rows: result.rowCount };
  }
  return timings;
}

async function cleanup({ pool, admin, ids }) {
  if (ids.storagePaths.length) await admin.storage.from("contract-documents").remove(ids.storagePaths).catch(() => {});
  for (const contractId of ids.contracts) await pool.query("delete from contracts where id=$1", [contractId]).catch(() => {});
  await pool.query("delete from organization_memberships where organization_id=any($1::uuid[])", [ids.organizations]).catch(() => {});
  await pool.query("delete from organizations where id=any($1::uuid[])", [ids.organizations]).catch(() => {});
  for (const userId of ids.users) await admin.auth.admin.deleteUser(userId).catch(() => {});
}

async function runIntegration(config, pool) {
  const admin = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const ids = fixtureIds();
  const { results, check } = testRecorder();
  let users = [];
  try {
    users = await createUsers(admin, ids);
    await createFixture(pool, users, ids);
    await verifyRls({ config, users, ids, record: { check } });
    await verifyStorage({ config, admin, users, ids, record: { check } });
    await verifyIntegrity({ pool, ids, record: { check } });
    await verifyAnalysisAndAi({ pool, ids, users, record: { check } });
    const performance = await measureQueries(pool, ids);
    const failures = results.filter((result) => result.status === "FAIL");
    return { results, performance, failures };
  } finally {
    await cleanup({ pool, admin, ids });
  }
}

async function main() {
  const config = loadSafeConfig();
  const preflightOnly = process.argv.includes("--preflight-only");
  const migrateOnly = process.argv.includes("--migrate-only");
  if (!preflightOnly && !migrateOnly && !config.runIntegration) {
    fail("FIXTURE_WRITES_DISABLED", "PHASE3_RUN_INTEGRATION must equal 1 for synthetic fixture writes");
  }
  const files = await migrationFiles();
  const connectivity = await verifyConnectivity(config);
  const pool = new Pool({ connectionString: config.databaseUrl, max: 4 });
  try {
    const identityResult = await pool.query("select current_database() as database_name, current_user as database_user");
    const identity = identityResult.rows[0];
    const before = await readSentinels(pool);
    const readiness = migrationReadiness(before, config.applyMigrations);
    const preMigrationCounts = await targetCounts(pool);
    if (preflightOnly) {
      console.log(JSON.stringify({
        status: "PREFLIGHT_PASS",
        projectRef: config.projectRef,
        connectivity,
        databaseIdentity: identity,
        migrationFiles: files.filter((file) => REQUIRED_MIGRATIONS.includes(file)),
        migrationReadiness: readiness,
        counts: preMigrationCounts,
      }, null, 2));
      return;
    }
    const targetIsEmpty = Object.values(preMigrationCounts).every((count) => Number(count) === 0);
    if (!targetIsEmpty) {
      if (!config.allowNonemptyAdditiveMigrations) {
        fail("TARGET_NOT_EMPTY", "Migration execution on this target requires PHASE3_ALLOW_NONEMPTY_ADDITIVE_MIGRATIONS=1");
      }
      await assertNonemptyMigrationPlan(readiness.missing);
    }
    const applied = await applyMissingMigrations(pool, before);
    const schema = await verifySchema(pool);
    const counts = await targetCounts(pool);
    if (!targetIsEmpty && JSON.stringify(counts) !== JSON.stringify(preMigrationCounts)) {
      fail("TARGET_DATA_COUNTS_CHANGED", "Additive migration changed protected target record counts");
    }
    if (migrateOnly) {
      console.log(JSON.stringify({
        status: "MIGRATION_VALIDATION_PASS",
        projectRef: config.projectRef,
        connectivity,
        databaseIdentity: identity,
        migrationFiles: files.filter((file) => REQUIRED_MIGRATIONS.includes(file)),
        migrationsApplied: applied,
        migrationMode: targetIsEmpty ? "empty_database" : "nonempty_additive",
        schema,
        counts,
      }, null, 2));
      return;
    }
    const integration = await runIntegration(config, pool);
    if (integration?.failures.length) fail("INTEGRATION_FAILURE", `${integration.failures.length} live validation checks failed`);
    console.log(JSON.stringify({
      status: "LIVE_VALIDATION_PASS",
      projectRef: config.projectRef,
      connectivity,
      databaseIdentity: identity,
      migrationFiles: files.filter((file) => REQUIRED_MIGRATIONS.includes(file)),
      migrationsApplied: applied,
      schema,
      counts,
      integration,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(JSON.stringify({ status: "BLOCKED", code: error.code || "VALIDATION_FAILED", message: error.message }, null, 2));
    process.exitCode = 2;
  });
}