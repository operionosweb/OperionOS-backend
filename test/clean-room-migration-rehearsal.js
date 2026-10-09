import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Pool } = pg;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const IMAGE = process.env.MIGRATION_REHEARSAL_IMAGE || "postgres:17-alpine";
const containerName = `operion-migration-rehearsal-${process.pid}-${Date.now()}`;
const databaseName = "operion_rehearsal";
const password = crypto.randomBytes(24).toString("hex");

const expectedTables = [
  "organizations",
  "organization_memberships",
  "contracts",
  "contract_versions",
  "contract_clauses",
  "contract_obligations",
  "audit_events",
  "documents",
  "document_versions",
  "document_version_extractions",
  "analysis_runs",
  "document_version_pages",
  "contract_parties",
  "intelligence_evidence",
  "clauses",
  "obligations",
  "deadlines",
  "risks",
  "recommendations",
  "contract_search_chunks",
  "clause_evidence",
  "obligation_evidence",
  "deadline_evidence",
  "risk_evidence",
  "recommendation_evidence",
  "party_evidence",
  "ai_intelligence_budgets",
  "ai_intelligence_jobs",
  "ai_intelligence_usage",
  "ai_intelligence_cache",
  "contract_sections",
  "contract_document_chunks",
  "contract_intelligence_analyses",
  "contract_document_pages",
  "aircraft",
  "aircraft_organization_relationships",
  "aviation_flights",
  "flight_positions",
  "aircraft_contract_relationships",
  "contract_intelligence_profiles",
  "platform_user_roles",
  "commercial_companies",
  "commercial_sources",
  "commercial_people",
  "commercial_signals",
  "commercial_opportunities",
  "commercial_evidence_links",
  "commercial_recommended_actions",
  "commercial_ai_proposals",
  "commercial_entity_match_proposals",
  "commercial_review_decisions",
];

const requiredTables = [
  "organizations",
  "organization_memberships",
  "platform_user_roles",
  "contracts",
  "documents",
  "document_versions",
  "document_version_extractions",
  "document_version_pages",
  "contract_document_pages",
  "contract_sections",
  "contract_document_chunks",
  "analysis_runs",
  "clauses",
  "obligations",
  "deadlines",
  "risks",
  "intelligence_evidence",
  "clause_evidence",
  "obligation_evidence",
  "deadline_evidence",
  "risk_evidence",
  "contract_search_chunks",
  "contract_parties",
  "party_evidence",
  "contract_intelligence_profiles",
  "ai_intelligence_budgets",
  "ai_intelligence_jobs",
  "ai_intelligence_usage",
  "ai_intelligence_cache",
  "audit_events",
  "aircraft",
  "aircraft_organization_relationships",
  "aircraft_contract_relationships",
  "contract_versions",
  "contract_clauses",
  "contract_obligations",
  "recommendations",
  "recommendation_evidence",
  "contract_intelligence_analyses",
];

const absentLegacyTables = [
  "contract_audit_log",
  "ai_extraction_logs",
  "usage_logs",
  "contract_chunks",
  "contract_embeddings",
  "contract_memory",
  "contract_comparisons",
  "contract_economics",
  "maintenance_reserves",
  "reserve_rules",
  "accrual_audit_log",
];

const requiredFunctions = [
  "is_organization_member",
  "prevent_contract_organization_change",
  "prevent_document_ownership_change",
  "prevent_document_version_change",
  "prevent_analysis_run_ownership_change",
  "prevent_phase3_result_update",
  "prevent_analysis_run_invalid_transition",
];

const immutableResultTables = [
  "document_version_pages",
  "contract_parties",
  "intelligence_evidence",
  "clauses",
  "obligations",
  "deadlines",
  "risks",
  "recommendations",
  "contract_search_chunks",
  "clause_evidence",
  "obligation_evidence",
  "deadline_evidence",
  "risk_evidence",
  "recommendation_evidence",
  "party_evidence",
];

const rlsTables = [
  "organizations",
  "organization_memberships",
  "contracts",
  "contract_versions",
  "contract_clauses",
  "contract_obligations",
  "audit_events",
  "documents",
  "document_versions",
  "document_version_extractions",
  "analysis_runs",
  "document_version_pages",
  "contract_parties",
  "intelligence_evidence",
  "clauses",
  "obligations",
  "deadlines",
  "risks",
  "recommendations",
  "contract_search_chunks",
  "clause_evidence",
  "obligation_evidence",
  "deadline_evidence",
  "risk_evidence",
  "recommendation_evidence",
  "party_evidence",
  "ai_intelligence_budgets",
  "ai_intelligence_jobs",
  "ai_intelligence_usage",
  "ai_intelligence_cache",
  "contract_sections",
  "contract_document_chunks",
  "contract_intelligence_analyses",
  "contract_document_pages",
  "aircraft",
  "aircraft_organization_relationships",
  "aviation_flights",
  "flight_positions",
  "aircraft_contract_relationships",
  "contract_intelligence_profiles",
  "platform_user_roles",
  "commercial_companies",
  "commercial_sources",
  "commercial_people",
  "commercial_signals",
  "commercial_opportunities",
  "commercial_evidence_links",
  "commercial_recommended_actions",
  "commercial_ai_proposals",
  "commercial_entity_match_proposals",
  "commercial_review_decisions",
];

const bootstrapSql = `
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end
$$;

create schema auth;
create schema storage;

create table auth.users (
  id uuid primary key,
  email text
);

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table storage.objects (
  id uuid primary key,
  bucket_id text not null references storage.buckets(id) on delete cascade,
  name text not null
);

alter table storage.objects enable row level security;
`;

function docker(args, options = {}) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    stdio: options.capture === false ? "ignore" : ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function classifyMigrationError(error) {
  const code = error.code || "";
  if (code === "42P01" || code === "3F000" || code === "42704") return "missing_dependency";
  if (code === "42601") return "syntax";
  if (code.startsWith("23")) return "constraint";
  if (code === "42501") return "permissions";
  return "database";
}

function safeError(error) {
  return {
    code: error.code || null,
    classification: classifyMigrationError(error),
    message: error.message,
    detail: error.detail || null,
    hint: error.hint || null,
    position: error.position || null,
  };
}

async function waitForPostgres(pool) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await pool.query("select 1");
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastError;
}

async function migrationFiles() {
  const files = (await fs.readdir(MIGRATIONS_DIR))
    .filter((file) => /^\d{3}_.+[.]sql$/.test(file))
    .sort();
  assert.equal(files.length, 21, `Expected exactly 21 canonical migrations, found ${files.length}`);
  assert.deepEqual(
    files.map((file) => file.slice(0, 3)),
    Array.from({ length: 21 }, (_, index) => String(index + 1).padStart(3, "0")),
    "Canonical migrations are not ordered 001 through 021"
  );
  return files;
}

async function applyMigrations(pool, files) {
  const applied = [];
  for (const file of files) {
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("commit");
      applied.push(file);
      console.log(`MIGRATION PASS ${file}`);
    } catch (error) {
      try {
        await client.query("rollback");
      } catch {}
      const failure = safeError(error);
      console.error(`MIGRATION FAIL ${file} ${JSON.stringify(failure)}`);
      throw Object.assign(new Error(`Migration ${file} failed: ${failure.message}`), {
        migration: file,
        migrationFailure: failure,
        cause: error,
      });
    } finally {
      client.release();
    }
  }
  return applied;
}

async function rows(pool, sql, values = []) {
  return (await pool.query(sql, values)).rows;
}

function values(rowsToMap, key) {
  return new Set(rowsToMap.map((row) => row[key]));
}

async function verifySchema(pool) {
  const publicTables = await rows(pool, `
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `);
  const tableSet = values(publicTables, "table_name");
  assert.deepEqual([...tableSet].sort(), [...expectedTables].sort(), "Public table inventory differs from the canonical 001-021 chain");
  assert.deepEqual(requiredTables.filter((table) => !tableSet.has(table)), [], "Required tables are missing");
  assert.deepEqual(absentLegacyTables.filter((table) => tableSet.has(table)), [], "A forbidden legacy table was created");

  const primaryKeys = await rows(pool, `
    select c.relname as table_name, con.conname
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and con.contype = 'p'
  `);
  const primaryKeyTables = values(primaryKeys, "table_name");
  assert.deepEqual(requiredTables.filter((table) => !primaryKeyTables.has(table)), [], "A required table is missing a primary key");

  const foreignKeys = await rows(pool, `
    select c.relname as table_name, con.conname, con.convalidated,
           rn.nspname as referenced_schema, rc.relname as referenced_table,
           pg_get_constraintdef(con.oid) as definition
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_class rc on rc.oid = con.confrelid
    join pg_namespace rn on rn.oid = rc.relnamespace
    where n.nspname = 'public' and con.contype = 'f'
    order by c.relname, con.conname
  `);
  assert.ok(foreignKeys.some((row) => row.referenced_schema === "auth" && row.referenced_table === "users"), "No public foreign key references auth.users");
  assert.ok(foreignKeys.some((row) => row.table_name === "aircraft_contract_relationships" && row.referenced_table === "aircraft"), "Aircraft relationship foreign key is missing");
  assert.ok(foreignKeys.some((row) => row.table_name === "aircraft_contract_relationships" && row.referenced_table === "contracts"), "Aircraft-contract foreign key is missing");

  const constraints = await rows(pool, `
    select c.relname as table_name, con.conname, con.contype, con.convalidated,
           pg_get_constraintdef(con.oid) as definition
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
    order by c.relname, con.conname
  `);
  const uniqueConstraints = constraints.filter((row) => row.contype === "u");
  assert.ok(uniqueConstraints.some((row) => row.table_name === "organization_memberships" && row.definition.includes("organization_id") && row.definition.includes("user_id")), "Organization membership uniqueness is missing");
  assert.ok(uniqueConstraints.some((row) => row.table_name === "clauses" && row.definition.includes("clause_identity")), "Clause identity uniqueness is missing");
  assert.ok(uniqueConstraints.some((row) => row.table_name === "obligations" && row.definition.includes("obligation_identity")), "Obligation identity uniqueness is missing");
  assert.ok(uniqueConstraints.some((row) => row.table_name === "contract_intelligence_profiles" && row.definition.includes("analysis_run_id")), "Contract profile run uniqueness is missing");

  const indexes = await rows(pool, `
    select schemaname, tablename, indexname, indexdef
    from pg_indexes
    where schemaname = 'public'
    order by tablename, indexname
  `);
  const indexSet = values(indexes, "indexname");
  for (const index of [
    "phase3_chunks_search_idx",
    "clauses_document_version_run_identity_key",
    "obligations_scope_identity_key",
    "deadlines_identity_scope_uidx",
    "risks_identity_scope_uidx",
    "ai_cache_identity_idx",
    "ai_jobs_active_request_uidx",
    "aircraft_contract_scope_idx",
    "contract_profiles_scope_idx",
  ]) {
    assert.ok(indexSet.has(index), `Expected index is missing: ${index}`);
  }

  const functions = await rows(pool, `
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  `);
  const functionSet = values(functions, "proname");
  assert.deepEqual(requiredFunctions.filter((name) => !functionSet.has(name)), [], "Required functions are missing");

  const triggers = await rows(pool, `
    select c.relname as table_name, t.tgname as trigger_name
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal
    order by c.relname, t.tgname
  `);
  const triggerKeys = new Set(triggers.map((row) => `${row.table_name}.${row.trigger_name}`));
  for (const key of [
    "contracts.prevent_contract_organization_change",
    "documents.prevent_document_ownership_change",
    "document_versions.prevent_document_version_change",
    "analysis_runs.prevent_analysis_run_ownership_change",
    "analysis_runs.prevent_analysis_run_invalid_transition",
    "contract_intelligence_profiles.prevent_contract_profile_update",
  ]) {
    assert.ok(triggerKeys.has(key), `Expected trigger is missing: ${key}`);
  }
  for (const table of immutableResultTables) {
    assert.ok(triggerKeys.has(`${table}.prevent_phase3_update`), `Immutable result trigger is missing from ${table}`);
  }

  const rls = await rows(pool, `
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  `);
  const rlsSet = values(rls, "table_name");
  assert.deepEqual(rlsTables.filter((table) => !rlsSet.has(table)), [], "RLS is missing from a protected table");

  const policies = await rows(pool, `
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
    order by schemaname, tablename, policyname
  `);
  const policyKeys = new Set(policies.map((row) => `${row.schemaname}.${row.tablename}.${row.policyname}`));
  for (const key of [
    "public.organizations.organizations_member_select",
    "public.organization_memberships.memberships_self_select",
    "public.contracts.contracts_member_select",
    "public.documents.documents_member_select",
    "public.document_versions.document_versions_member_select",
    "public.contract_intelligence_profiles.contract_profiles_member_select",
    "storage.objects.contract_storage_member_read",
  ]) {
    assert.ok(policyKeys.has(key), `Expected policy is missing: ${key}`);
  }
  assert.ok(!policyKeys.has("storage.objects.contract_storage_member_insert"), "Authenticated Storage insert policy should have been removed by migration 019");
  assert.ok(!policyKeys.has("storage.objects.contract_storage_member_delete"), "Authenticated Storage delete policy should have been removed by migration 019");

  const storagePolicy = policies.find((row) => row.schemaname === "storage" && row.tablename === "objects" && row.policyname === "contract_storage_member_read");
  assert.match(storagePolicy.qual, /contract-documents/);
  assert.match(storagePolicy.qual, /organizations/);
  assert.match(storagePolicy.qual, /documents/);
  assert.match(storagePolicy.qual, /versions/);
  assert.match(storagePolicy.qual, /source/);
  assert.match(storagePolicy.qual, /pdf/);
  assert.match(storagePolicy.qual, /docx/);
  assert.match(storagePolicy.qual, /is_organization_member/);

  const buckets = await rows(pool, "select id, name, public from storage.buckets where id = 'contract-documents'");
  assert.deepEqual(buckets, [{ id: "contract-documents", name: "contract-documents", public: false }], "The local Storage bucket metadata is missing or public");

  const generatedSearch = await rows(pool, `
    select data_type, udt_name, is_generated, generation_expression
    from information_schema.columns
    where table_schema = 'public' and table_name = 'contract_search_chunks' and column_name = 'search_vector'
  `);
  assert.equal(generatedSearch.length, 1, "Generated search_vector column is missing");
  assert.equal(generatedSearch[0].udt_name, "tsvector");
  assert.equal(generatedSearch[0].is_generated, "ALWAYS");

  const extensions = await rows(pool, "select extname from pg_extension order by extname");
  assert.ok(extensions.some((row) => row.extname === "pgcrypto"), "pgcrypto extension is missing");
  const vectorExtensionInstalled = extensions.some((row) => row.extname === "vector");

  const notValidConstraints = constraints
    .filter((row) => row.convalidated === false)
    .map((row) => ({ table: row.table_name, constraint: row.conname, definition: row.definition }));

  const budgetCount = Number((await rows(pool, "select count(*)::int as count from ai_intelligence_budgets"))[0].count);
  assert.equal(budgetCount, 0, "Clean migration rehearsal unexpectedly seeded AI budget rows");

  const compatibility = await rows(pool, `
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('contract_versions', 'contract_clauses', 'contract_obligations', 'clauses', 'obligations')
    order by table_name
  `);
  assert.equal(compatibility.length, 5, "Compatibility and canonical intelligence tables do not coexist");

  return {
    publicTableCount: publicTables.length,
    primaryKeyCount: primaryKeys.length,
    foreignKeyCount: foreignKeys.length,
    uniqueConstraintCount: uniqueConstraints.length,
    publicIndexCount: indexes.length,
    publicFunctionCount: functions.length,
    triggerCount: triggers.length,
    rlsTableCount: rls.length,
    policyCount: policies.length,
    authUserForeignKeyCount: foreignKeys.filter((row) => row.referenced_schema === "auth" && row.referenced_table === "users").length,
    notValidConstraints,
    aiBudgetRows: budgetCount,
    storage: {
      bucket: buckets[0],
      readPolicy: storagePolicy.policyname,
      authenticatedInsertPolicy: false,
      authenticatedDeletePolicy: false,
    },
    generatedSearch: generatedSearch[0],
    vectorExtensionInstalled,
    absentLegacyTables,
  };
}

async function main() {
  let pool;
  let containerStarted = false;
  const report = {
    result: "FAIL",
    image: IMAGE,
    migrationsApplied: [],
    firstFailingMigration: null,
    failure: null,
    schema: null,
  };

  try {
    docker(["image", "inspect", IMAGE]);
    docker([
      "run",
      "--detach",
      "--rm",
      "--pull=never",
      "--name",
      containerName,
      "--env",
      `POSTGRES_PASSWORD=${password}`,
      "--env",
      `POSTGRES_DB=${databaseName}`,
      "--publish",
      "127.0.0.1::5432",
      IMAGE,
    ]);
    containerStarted = true;

    const portOutput = docker(["port", containerName, "5432/tcp"]);
    const port = Number(portOutput.match(/:(\d+)\s*$/)?.[1]);
    assert.ok(Number.isInteger(port) && port > 0, `Could not determine local PostgreSQL port from: ${portOutput}`);

    pool = new Pool({
      host: "127.0.0.1",
      port,
      database: databaseName,
      user: "postgres",
      password,
      max: 4,
    });
    await waitForPostgres(pool);
    await pool.query(bootstrapSql);

    const files = await migrationFiles();
    try {
      report.migrationsApplied = await applyMigrations(pool, files);
    } catch (error) {
      report.firstFailingMigration = error.migration;
      report.failure = error.migrationFailure || safeError(error);
      throw error;
    }

    report.schema = await verifySchema(pool);
    report.result = "PASS";
    console.log(`REHEARSAL REPORT ${JSON.stringify(report, null, 2)}`);
  } catch (error) {
    if (!report.failure) report.failure = safeError(error);
    console.error(`REHEARSAL REPORT ${JSON.stringify(report, null, 2)}`);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end().catch(() => {});
    if (containerStarted) {
      try {
        docker(["rm", "--force", containerName], { capture: false });
      } catch {}
    }
  }
}

await main();
