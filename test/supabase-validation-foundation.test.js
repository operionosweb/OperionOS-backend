import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { hasDocxMigrationSemantics } from "./supabase-validation.js";

const read = (file) => fs.readFile(file, "utf8");

test("Supabase validation is isolated from the unit test command", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  assert.equal(packageJson.scripts.test, "node --test test/*.test.js");
  assert.equal(packageJson.scripts["test:supabase"], "node test/supabase-validation.js");
});

test("live harness requires explicit non-production identity and project matching", async () => {
  const harness = await read("test/supabase-validation.js");
  assert.match(harness, /PHASE3_DB_TEST_ENABLED/);
  assert.match(harness, /PHASE3_RUN_INTEGRATION/);
  assert.match(harness, /PHASE3_EMPTY_DATABASE/);
  assert.match(harness, /TARGET_NOT_EMPTY/);
  assert.match(harness, /non-production-test/);
  assert.match(harness, /Production-like project reference rejected/);
  assert.match(harness, /DATABASE_URL username is not scoped/);
  assert.doesNotMatch(harness, /SUPABASE_TEST_SERVICE_ROLE_KEY\s*=\s*[A-Za-z0-9]/);
});

test("preflight is read-only and checks API, PostgreSQL, identity, and migration readiness", async () => {
  const harness = await read("test/supabase-validation.js");
  assert.match(harness, /resolveEndpoint\(apiUrl\.hostname, "API"\)/);
  assert.match(harness, /auth\/v1\/health/);
  assert.match(harness, /resolveEndpoint\(databaseUrl\.hostname, "POSTGRES"\)/);
  assert.match(harness, /probeTcp\(databaseUrl\.hostname, databasePort\)/);
  assert.match(harness, /current_database\(\).*current_user/);
  assert.match(harness, /migrationReadiness\(before, config\.applyMigrations\)/);
  const preflightBranch = harness.slice(harness.indexOf("if (preflightOnly)"), harness.indexOf("const applied = await applyMissingMigrations"));
  assert.doesNotMatch(preflightBranch, /(insert|update|delete|applyMissingMigrations|runIntegration)\s*\(/i);
});

test("migration-only mode rechecks emptiness, verifies schema, and skips fixture integration", async () => {
  const harness = await read("test/supabase-validation.js");
  assert.match(harness, /process\.argv\.includes\("--migrate-only"\)/);
  assert.match(harness, /preMigrationCounts[\s\S]*TARGET_NOT_EMPTY[\s\S]*applyMissingMigrations/);
  const migrationOnlyBranch = harness.slice(harness.indexOf("if (migrateOnly)"), harness.indexOf("const integration = await runIntegration"));
  assert.match(migrationOnlyBranch, /MIGRATION_VALIDATION_PASS/);
  assert.doesNotMatch(migrationOnlyBranch, /runIntegration\s*\(/);
});

test("migration validation covers canonical migrations 006 through 014 in order", async () => {
  const harness = await read("test/supabase-validation.js");
  const positions = Array.from({ length: 9 }, (_, index) => harness.indexOf(`\"${String(index + 6).padStart(3, "0")}`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((left, right) => left - right), positions);
});

test("hardening migration makes AI and structure tables read-only to authenticated members", async () => {
  const migration = `${await read("supabase/migrations/013_nonproduction_validation_hardening.sql")}\n${await read("supabase/migrations/014_durable_ai_state_hardening.sql")}`;
  for (const table of [
    "ai_intelligence_budgets", "ai_intelligence_jobs", "ai_intelligence_usage", "ai_intelligence_cache",
    "contract_sections", "contract_document_chunks", "contract_intelligence_analyses", "contract_document_pages",
    "analysis_runs", "document_version_extractions", "contract_clauses", "contract_obligations",
  ]) {
    assert.match(migration, new RegExp(`on public\\.${table}\\s+for select to authenticated`, "i"));
  }
  assert.doesNotMatch(migration, /for all/i);
  assert.doesNotMatch(migration, /for (insert|update|delete)/i);
});

test("migration 014 uses the legacy indirect ownership paths for clauses and obligations", async () => {
  const migration = await read("supabase/migrations/014_durable_ai_state_hardening.sql");
  const clausePolicy = migration.slice(migration.indexOf("create policy clauses_member_select"), migration.indexOf("drop policy if exists obligations_member_access"));
  const obligationPolicy = migration.slice(migration.indexOf("create policy obligations_member_select"));

  assert.match(clausePolicy, /from public\.contract_versions v[\s\S]*join public\.contracts c on c\.id = v\.contract_id[\s\S]*v\.id = contract_version_id[\s\S]*is_organization_member\(c\.organization_id\)/i);
  assert.doesNotMatch(clausePolicy, /is_organization_member\(organization_id\)/i);
  assert.match(obligationPolicy, /from public\.contract_clauses cc[\s\S]*join public\.contract_versions v on v\.id = cc\.contract_version_id[\s\S]*join public\.contracts c on c\.id = v\.contract_id[\s\S]*cc\.id = contract_clause_id[\s\S]*is_organization_member\(c\.organization_id\)/i);
  assert.doesNotMatch(obligationPolicy, /is_organization_member\(organization_id\)/i);
});

test("migration 014 keeps direct ownership for tables that contain organization_id", async () => {
  const migration = await read("supabase/migrations/014_durable_ai_state_hardening.sql");
  for (const policy of ["analysis_runs_member_select", "document_extractions_member_select"]) {
    const start = migration.indexOf(`create policy ${policy}`);
    const end = migration.indexOf("drop policy", start);
    assert.match(migration.slice(start, end < 0 ? undefined : end), /is_organization_member\(organization_id\)/i);
  }
});

test("legacy ownership predicates allow same-tenant reads and deny cross-tenant reads", () => {
  const canReadClause = ({ memberOrganizations, clause, versions, contracts }) => {
    const version = versions.find(({ id }) => id === clause.contract_version_id);
    const contract = contracts.find(({ id }) => id === version?.contract_id);
    return memberOrganizations.includes(contract?.organization_id);
  };
  const canReadObligation = ({ obligation, clauses, ...context }) => {
    const clause = clauses.find(({ id }) => id === obligation.contract_clause_id);
    return clause ? canReadClause({ clause, ...context }) : false;
  };
  const context = {
    versions: [{ id: "version-a", contract_id: "contract-a" }],
    contracts: [{ id: "contract-a", organization_id: "organization-a" }],
    clauses: [{ id: "clause-a", contract_version_id: "version-a" }],
  };

  assert.equal(canReadClause({ ...context, memberOrganizations: ["organization-a"], clause: context.clauses[0] }), true);
  assert.equal(canReadClause({ ...context, memberOrganizations: ["organization-b"], clause: context.clauses[0] }), false);
  assert.equal(canReadObligation({ ...context, memberOrganizations: ["organization-a"], obligation: { contract_clause_id: "clause-a" } }), true);
  assert.equal(canReadObligation({ ...context, memberOrganizations: ["organization-b"], obligation: { contract_clause_id: "clause-a" } }), false);
});

test("live schema validation covers every server-owned intelligence table", async () => {
  const harness = await read("test/supabase-validation.js");
  for (const table of [
    "document_version_extractions", "analysis_runs", "contract_intelligence_analyses",
    "document_version_pages", "contract_parties", "intelligence_evidence", "clauses",
    "obligations", "deadlines", "risks", "recommendations", "contract_search_chunks",
    "contract_clauses", "contract_obligations", "clause_evidence", "obligation_evidence",
    "deadline_evidence", "risk_evidence", "recommendation_evidence", "party_evidence",
    "ai_intelligence_budgets", "ai_intelligence_jobs", "ai_intelligence_usage", "ai_intelligence_cache",
  ]) {
    assert.match(harness, new RegExp(`serverOwnedTables[\\s\\S]*[\"']${table}[\"']`, "i"));
  }
});

test("live integration exercises legacy indirect ownership and write denial", async () => {
  const harness = await read("test/supabase-validation.js");
  assert.match(harness, /insert into contract_versions/);
  assert.match(harness, /insert into contract_clauses/);
  assert.match(harness, /insert into contract_obligations/);
  assert.match(harness, /\["contract_clauses", ids\.legacyClauses\[tenant\], ids\.legacyClauses\[other\]\]/);
  assert.match(harness, /\["contract_obligations", ids\.legacyObligations\[tenant\], ids\.legacyObligations\[other\]\]/);
  assert.match(harness, /\["contract_clauses", "id", ids\.legacyClauses\[0\]/);
  assert.match(harness, /\["contract_obligations", "id", ids\.legacyObligations\[0\]/);
});

test("live integration verifies assistant evidence grounding and tenant isolation", async () => {
  const harness = await read("test/supabase-validation.js");
  assert.match(harness, /ASSISTANT-EVIDENCE-GROUNDING/);
  assert.match(harness, /assistant\.established && assistant\.evidence\.length > 0/);
  assert.match(harness, /ASSISTANT-CROSS-TENANT/);
  assert.match(harness, /!crossTenant\.established && crossTenantRows\.rowCount === 0/);
});

test("service-role credentials are absent from frontend source", async () => {
  const files = [
    "frontend/.env.example",
    "frontend/src/lib/apiClient.js",
    "frontend/src/lib/contractsApi.js",
  ];
  for (const file of files) {
    const contents = await read(file);
    assert.doesNotMatch(contents, /SUPABASE_(TEST_)?SERVICE_ROLE_KEY/);
  }
});

test("AI persistence schema is organization scoped and cache identity includes organization", async () => {
  const migration = `${await read("supabase/migrations/006_ai_intelligence_foundation.sql")}\n${await read("supabase/migrations/014_durable_ai_state_hardening.sql")}`;
  for (const table of ["budgets", "jobs", "usage", "cache"]) {
    assert.match(migration, new RegExp(`ai_intelligence_${table}`));
  }
  assert.match(migration, /ai_cache_identity_idx[\s\S]*organization_id[\s\S]*document_hash[\s\S]*operation_type[\s\S]*analysis_version/i);
  assert.match(migration, /ai_cache_identity_idx[\s\S]*prompt_version[\s\S]*provider[\s\S]*model/i);
  assert.match(migration, /ai_jobs_active_request_uidx[\s\S]*organization_id[\s\S]*request_key[\s\S]*processing/i);
  assert.match(migration, /enable row level security/gi);
});

test("storage policies keep PDF and DOCX sources private and organization scoped", async () => {
  const foundation = await read("supabase/migrations/002_secure_document_ingestion.sql");
  const docx = await read("supabase/migrations/008_contract_upload_docx.sql");
  assert.match(foundation, /values \('contract-documents', 'contract-documents', false\)/i);
  assert.match(docx, /source\[\.\]\(pdf\|docx\)/i);
  assert.match(docx, /is_organization_member\(split_part\(name, '\/', 2\)::uuid\)/i);
  assert.doesNotMatch(docx, /public\s*=\s*true/i);
});

test("deadline and risk migrations preserve business days and prohibit probability", async () => {
  const deadlines = await read("supabase/migrations/011_deadline_temporal_intelligence.sql");
  const risks = await read("supabase/migrations/012_contract_risk_intelligence.sql");
  assert.match(deadlines, /'business_days'/);
  assert.match(deadlines, /deadlines_source_evidence_fk/);
  assert.match(deadlines, /deadlines_identity_scope_uidx/);
  assert.match(risks, /risks_probability_absent_check check \(probability is null\)/i);
  assert.match(risks, /risks_identity_scope_uidx/);
  assert.match(risks, /affected_obligation_ids/);
  assert.match(risks, /affected_deadline_ids/);
});

test("clean database migration executor includes migrations 001 through 014", async () => {
  const executor = await read("test/phase3a-live-verification.js");
  const positions = Array.from({ length: 14 }, (_, index) => executor.indexOf(`\"${String(index + 1).padStart(3, "0")}`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((left, right) => left - right), positions);
});

test("migration 008 detection distinguishes PDF-only migration 002 from DOCX-aware semantics", () => {
  const pdfOnly = {
    constraints: [
      { conname: "documents_mime_type_check", definition: "CHECK (mime_type = 'application/pdf')" },
      { conname: "document_versions_mime_type_check", definition: "CHECK (mime_type = 'application/pdf')" },
    ],
    policies: [
      { schemaname: "storage", tablename: "objects", policyname: "contract_storage_member_read", cmd: "SELECT", qual: "contract-documents source.pdf is_organization_member" },
      { schemaname: "storage", tablename: "objects", policyname: "contract_storage_member_insert", cmd: "INSERT", with_check: "contract-documents source.pdf is_organization_member" },
      { schemaname: "storage", tablename: "objects", policyname: "contract_storage_member_delete", cmd: "DELETE", qual: "contract-documents source.pdf is_organization_member" },
    ],
  };
  assert.equal(hasDocxMigrationSemantics(pdfOnly), false);

  const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const pdfAndDocx = {
    constraints: pdfOnly.constraints.map((constraint) => ({ ...constraint, definition: `CHECK (mime_type in ('application/pdf', '${docxMime}'))` })),
    policies: pdfOnly.policies.map((policy) => ({
      ...policy,
      qual: policy.qual?.replace("source.pdf", "source.(pdf|docx)"),
      with_check: policy.with_check?.replace("source.pdf", "source.(pdf|docx)"),
    })),
  };
  assert.equal(hasDocxMigrationSemantics(pdfAndDocx), true);
});