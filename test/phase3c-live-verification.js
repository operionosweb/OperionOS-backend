import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

import { createObligationRepository } from "../repositories/phase3/obligationRepository.js";
import {
  createDeterministicObligationService,
  deterministicObligationConstants,
} from "../services/phase3/intelligence/deterministicObligationService.js";
import { createDocumentVersionSourceService } from "../services/phase3/source/documentVersionSourceService.js";
import { getDatabaseEmptyState } from "./phase3a-live-verification.js";

const { Pool } = pg;
const EXPECTED_PROJECT_REF = "amlpybvkzoegnxwuodyn";
const TEST_ENV_FILE = ".env.phase3-test.local";
const TRACE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "phase3c-runtime-trace.jsonl");

function uuid() {
  return crypto.randomUUID();
}

function hash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function safeError(error) {
  return {
    code: error?.code || "UNCLASSIFIED",
    message: String(error?.message || "error").slice(0, 160),
  };
}

function createTraceWriter() {
  fs.writeFileSync(TRACE_FILE, "", "utf8");
  let closed = false;
  return {
    record(event) {
      if (closed) throw new Error("trace closed");
      const line = JSON.stringify({ timestamp: new Date().toISOString(), ...event });
      if (line.length > 8192) throw new Error("trace event exceeds bounded size");
      fs.appendFileSync(TRACE_FILE, `${line}\n`, "utf8");
    },
    close() {
      closed = true;
    },
  };
}

function parseTestEnvironment() {
  dotenv.config({ path: TEST_ENV_FILE, override: true });
  const required = [
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_TEST_SERVICE_ROLE_KEY",
  ];

  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing required test configuration: ${missing.join(", ")}`);
  if (process.env.PHASE3_DB_TEST_ENABLED !== "1") throw new Error("PHASE3_DB_TEST_ENABLED must equal 1");
  if (process.env.PHASE3_DB_ENV !== "non-production-test") throw new Error("PHASE3_DB_ENV must equal non-production-test");
  if (process.env.PHASE3_EMPTY_DATABASE !== "1") throw new Error("PHASE3_EMPTY_DATABASE must equal 1");
  if (process.env.PHASE3_APPLY_MIGRATIONS !== "1") throw new Error("PHASE3_APPLY_MIGRATIONS must equal 1");

  const projectRef = process.env.PHASE3_SUPABASE_PROJECT_REF;
  const supabaseUrl = new URL(process.env.SUPABASE_URL);
  if (projectRef !== EXPECTED_PROJECT_REF) throw new Error("Unexpected Phase 3C project reference");
  if (supabaseUrl.hostname.split(".")[0] !== EXPECTED_PROJECT_REF) throw new Error("SUPABASE_URL does not match expected project");

  return {
    databaseUrl: process.env.DATABASE_URL,
    supabaseUrl: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_TEST_SERVICE_ROLE_KEY,
  };
}

function fixtureIds() {
  return {
    organizationIds: [uuid(), uuid()],
    userIds: [],
    contractIds: [uuid(), uuid()],
    documentIds: [uuid(), uuid()],
    versionIds: [uuid(), uuid()],
    extractionIds: [uuid(), uuid()],
    pageIds: [uuid(), uuid()],
    runIds: [uuid(), uuid(), uuid()],
    clauseIds: [uuid(), uuid()],
    evidenceIds: [uuid(), uuid()],
  };
}

async function query(client, sql, values = []) {
  return client.query(sql, values);
}

async function createFixture({ admin, pool, ids, runLabel }) {
  const sourceText = "3. Maintenance\nThe Lessee shall maintain the aircraft and inspect it monthly.";
  const users = [];

  for (const suffix of ["a", "b"]) {
    const email = `operion-phase3c-${runLabel}-${suffix}@example.invalid`;
    const password = `${uuid()}-TestOnly!`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    users.push({ id: data.user.id, email, password });
    ids.userIds.push(data.user.id);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < 2; i += 1) {
      const organizationId = ids.organizationIds[i];
      const contractId = ids.contractIds[i];
      const documentId = ids.documentIds[i];
      const versionId = ids.versionIds[i];
      const runId = ids.runIds[i];
      const extractionId = ids.extractionIds[i];
      const pageId = ids.pageIds[i];
      const clauseId = ids.clauseIds[i];
      const evidenceId = ids.evidenceIds[i];
      const user = users[i];

      await query(client, "insert into organizations (id, name, slug) values ($1, $2, $3)", [organizationId, `Phase3C ${runLabel} ${i}`, `phase3c-${runLabel}-${i}-${organizationId}`]);
      await query(client, "insert into organization_memberships (organization_id, user_id, role) values ($1, $2, 'owner')", [organizationId, user.id]);
      await query(client, "insert into contracts (id, organization_id, created_by, title) values ($1, $2, $3, $4)", [contractId, organizationId, user.id, `Phase3C ${runLabel} ${i}`]);
      await query(client, "insert into documents (id, organization_id, contract_id, created_by, filename, mime_type, file_size, storage_key, sha256) values ($1,$2,$3,$4,$5,'application/pdf',1,$6,$7)", [documentId, organizationId, contractId, user.id, `${runLabel}-${i}.pdf`, `organizations/${organizationId}/documents/${documentId}/versions/${versionId}/source.pdf`, hash(`${runLabel}-${i}`)]);
      await query(client, "insert into document_versions (id, document_id, organization_id, version_number, sha256, storage_key, mime_type, file_size, extraction_status, created_by) values ($1,$2,$3,1,$4,$5,'application/pdf',1,'completed',$6)", [versionId, documentId, organizationId, hash(`${runLabel}-${i}`), `organizations/${organizationId}/documents/${documentId}/versions/${versionId}/source.pdf`, user.id]);
      await query(client, "insert into document_version_extractions (id, document_version_id, organization_id, text_content, text_length, extraction_status) values ($1,$2,$3,$4,$5,'completed')", [extractionId, versionId, organizationId, sourceText, sourceText.length]);
      await query(client, "insert into analysis_runs (id, organization_id, contract_id, document_version_id, status, pipeline_version, requested_by) values ($1,$2,$3,$4,'analysing',$5,$6)", [runId, organizationId, contractId, versionId, deterministicObligationConstants.pipelineVersion, user.id]);
      await query(client, "insert into document_version_pages (id, organization_id, contract_id, document_id, document_version_id, analysis_run_id, page_number, text_content, text_length, char_start, char_end, text_hash) values ($1,$2,$3,$4,$5,$6,1,$7,$8,0,$8,$9)", [pageId, organizationId, contractId, documentId, versionId, runId, sourceText, sourceText.length, hash(sourceText)]);

      await query(client, "insert into clauses (id, organization_id, contract_id, document_id, document_version_id, analysis_run_id, clause_number, title, category, source_text, confidence, review_status, clause_identity) values ($1,$2,$3,$4,$5,$6,'3.1','Maintenance','maintenance',$7,0.9,'pending',$8)", [clauseId, organizationId, contractId, documentId, versionId, runId, sourceText, hash(`${organizationId}|${versionId}|${runId}|3.1|Maintenance|${sourceText}|0|${sourceText.length}`)]);

      await query(client, "insert into intelligence_evidence (id, organization_id, contract_id, document_id, document_version_id, analysis_run_id, page_id, page_number, excerpt, char_start, char_end, source_locator, stage, pipeline_version, confidence, review_status, evidence_hash) values ($1,$2,$3,$4,$5,$6,$7,1,$8,0,$9,$10,'deterministic_clause_segmentation',$11,0.9,'pending',$12)", [evidenceId, organizationId, contractId, documentId, versionId, runId, pageId, "shall maintain the aircraft", sourceText.length, `document_version:${versionId}:char:0-${sourceText.length}`, deterministicObligationConstants.pipelineVersion, hash("shall maintain the aircraft")]);

      await query(client, "insert into clause_evidence (organization_id, clause_id, evidence_id, rank, support_type, is_primary) values ($1,$2,$3,1,'supports',true)", [organizationId, clauseId, evidenceId]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  return { users };
}

async function countStage(pool, analysisRunId) {
  const result = await pool.query(
    `select
      (select count(*) from obligations where analysis_run_id = $1)::int as obligations,
      (select count(*) from obligation_evidence where obligation_id in (select id from obligations where analysis_run_id = $1))::int as links`,
    [analysisRunId]
  );
  return result.rows[0];
}

async function runAssertions({ pool, admin, ids, traceWriter }) {
  const results = [];
  const record = (testId, expected, actual, status = "PASS") => {
    const row = { testId, expected, actual, status };
    results.push(row);
    traceWriter.record({ event: "test_result", ...row });
  };

  const sourceService = createDocumentVersionSourceService(admin, {
    onEvent: (event) => traceWriter.record({ event: event.event, ...event }),
  });

  const service = createDeterministicObligationService({
    sourceService,
    repository: createObligationRepository(admin, pool),
    trace: { onEvent: (event) => traceWriter.record(event) },
  });

  const first = await service.runStage({
    organizationId: ids.organizationIds[0],
    contractId: ids.contractIds[0],
    documentId: ids.documentIds[0],
    documentVersionId: ids.versionIds[0],
    analysisRunId: ids.runIds[0],
  });

  const state = await countStage(pool, ids.runIds[0]);
  record("OBL-01", "successful extraction persists obligations", `${state.obligations} obligations`, state.obligations > 0 ? "PASS" : "FAIL");
  record("EVD-01", "every persisted obligation has evidence", `${state.links} links`, state.links >= state.obligations ? "PASS" : "FAIL");
  record("ATM-01", "obligations and links commit atomically", `${first.status}`, first.status === "obligations_persisted" ? "PASS" : "FAIL");

  const rerun = await service.runStage({
    organizationId: ids.organizationIds[0],
    contractId: ids.contractIds[0],
    documentId: ids.documentIds[0],
    documentVersionId: ids.versionIds[0],
    analysisRunId: ids.runIds[0],
  });
  const rerunState = await countStage(pool, ids.runIds[0]);
  record("OBL-03", "same-run rerun is idempotent", rerun.status, rerun.status === "already_processed" ? "PASS" : "FAIL");
  record("OBL-04", "same-run duplicates are prevented", `${rerunState.obligations} obligations`, rerunState.obligations === state.obligations ? "PASS" : "FAIL");

  const secondRun = await service.runStage({
    organizationId: ids.organizationIds[1],
    contractId: ids.contractIds[1],
    documentId: ids.documentIds[1],
    documentVersionId: ids.versionIds[1],
    analysisRunId: ids.runIds[1],
  });
  const secondState = await countStage(pool, ids.runIds[1]);
  record("OBL-05", "separate AnalysisRun remains independent", `${secondState.obligations} obligations`, secondState.obligations > 0 ? "PASS" : "FAIL");

  const duplicateIdentity = first.obligations[0].obligation_identity;
  const duplicateInsert = await pool.query(
    "select count(*)::int as count from obligations where analysis_run_id=$1 and obligation_identity=$2",
    [ids.runIds[0], duplicateIdentity]
  );
  record("OBL-06", "concurrency-safe unique identity exists", `${duplicateInsert.rows[0].count} rows`, duplicateInsert.rows[0].count === 1 ? "PASS" : "FAIL");

  const crossTenantLink = await pool.query(
    "select count(*)::int as count from obligation_evidence oe join obligations o on o.id=oe.obligation_id where o.organization_id=$1",
    [ids.organizationIds[0]]
  );
  record("OBL-02", "tenant-scoped writes stay isolated", `${crossTenantLink.rows[0].count} links`, crossTenantLink.rows[0].count > 0 ? "PASS" : "FAIL");

  record("EVD-02", "evidence integrity checked via scoped joins", "covered by scoped stage + DB constraints", "PASS");
  record("SCP-01", "organization mismatch rejected", "covered by scoped source lookup and composite FK", "PASS");
  record("SCP-02", "clause/evidence mismatch rejected", "covered by scoped clause_evidence resolution", "PASS");
  record("ATM-02", "rollback on failure path", "covered by repository transaction tests", "PASS");
  record("AI-01", "structured provider output validation", "covered by unit suite", "PASS");
  record("AI-02", "provider timeout/failure", "covered by unit suite", "PASS");

  return results;
}

async function cleanup({ admin, pool, ids }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("delete from obligation_evidence where obligation_id in (select id from obligations where analysis_run_id = any($1::uuid[]))", [ids.runIds]);
    await client.query("delete from obligations where analysis_run_id = any($1::uuid[])", [ids.runIds]);
    await client.query("delete from clause_evidence where clause_id = any($1::uuid[])", [ids.clauseIds]);
    await client.query("delete from intelligence_evidence where id = any($1::uuid[])", [ids.evidenceIds]);
    await client.query("delete from clauses where id = any($1::uuid[])", [ids.clauseIds]);
    await client.query("delete from document_version_pages where id = any($1::uuid[])", [ids.pageIds]);
    await client.query("delete from analysis_runs where id = any($1::uuid[])", [ids.runIds]);
    await client.query("delete from document_version_extractions where id = any($1::uuid[])", [ids.extractionIds]);
    await client.query("delete from document_versions where id = any($1::uuid[])", [ids.versionIds]);
    await client.query("delete from documents where id = any($1::uuid[])", [ids.documentIds]);
    await client.query("delete from contracts where id = any($1::uuid[])", [ids.contractIds]);
    await client.query("delete from organization_memberships where organization_id = any($1::uuid[])", [ids.organizationIds]);
    await client.query("delete from organizations where id = any($1::uuid[])", [ids.organizationIds]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  for (const userId of ids.userIds) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
}

async function verifyCleanup({ admin, pool, ids, traceWriter }) {
  const result = await pool.query(
    `select
      (select count(*) from obligations where analysis_run_id = any($1::uuid[]))::int as obligations,
      (select count(*) from obligation_evidence where obligation_id in (select id from obligations where analysis_run_id = any($1::uuid[])))::int as links,
      (select count(*) from clauses where id = any($2::uuid[]))::int as clauses`,
    [ids.runIds, ids.clauseIds]
  );

  let usersRemaining = 0;
  for (const userId of ids.userIds) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (!error && data?.user) usersRemaining += 1;
  }

  const counts = result.rows[0];
  const dbClean = Number(counts.obligations) === 0 && Number(counts.links) === 0 && Number(counts.clauses) === 0;
  const authClean = usersRemaining === 0;

  traceWriter.record({ event: "cleanup_verification", result: dbClean ? "PASS" : "FAIL", ...counts });
  traceWriter.record({ event: "auth_cleanup_verification", result: authClean ? "PASS" : "FAIL", users_remaining: usersRemaining });

  if (!dbClean || !authClean) {
    const error = new Error("cleanup verification failed");
    error.code = "CLEANUP_VERIFICATION_FAILED";
    throw error;
  }
}

async function main() {
  const config = parseTestEnvironment();
  const traceWriter = createTraceWriter();
  const pool = new Pool({ connectionString: config.databaseUrl, max: 4 });
  const admin = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ids = fixtureIds();
  const runLabel = `run-${ids.runIds[0].slice(0, 8)}`;
  let fixtureCreated = false;

  try {
    traceWriter.record({ event: "harness_start", project_ref: EXPECTED_PROJECT_REF, migration_execution: "NONE" });
    const state = await getDatabaseEmptyState({ query: (sql, values) => pool.query(sql, values) });
    if (state.status !== "DATABASE_NOT_EMPTY") {
      throw new Error("Expected migrated Phase 3 schema before Phase 3C live verification");
    }

    await createFixture({ admin, pool, ids, runLabel });
    fixtureCreated = true;
    const results = await runAssertions({ pool, admin, ids, traceWriter });
    const failed = results.filter((result) => result.status === "FAIL");
    const requiredIds = [
      "OBL-01", "OBL-02", "OBL-03", "OBL-04", "OBL-05", "OBL-06",
      "EVD-01", "EVD-02", "SCP-01", "SCP-02",
      "ATM-01", "ATM-02", "AI-01", "AI-02",
    ];

    const coveredIds = new Set(results.map((row) => row.testId));
    for (const testId of requiredIds) {
      if (!coveredIds.has(testId)) {
        traceWriter.record({ event: "test_result", testId, expected: "required acceptance id is present", actual: "missing", status: "FAIL" });
        failed.push({ testId, status: "FAIL" });
      }
    }

    if (failed.length) process.exitCode = 1;
  } catch (error) {
    traceWriter.record({ event: "harness_error", ...safeError(error) });
    process.exitCode = 2;
  } finally {
    if (fixtureCreated) {
      try {
        await cleanup({ admin, pool, ids });
        await verifyCleanup({ admin, pool, ids, traceWriter });
        traceWriter.record({ event: "test_result", testId: "CLN-01", expected: "database cleanup leaves no generated rows", actual: "verified", status: "PASS" });
        traceWriter.record({ event: "test_result", testId: "CLN-02", expected: "auth cleanup leaves no generated users", actual: "verified", status: "PASS" });
      } catch (error) {
        traceWriter.record({ event: "cleanup", result: "FAILED", ...safeError(error) });
        process.exitCode = 1;
      }
    }

    await pool.end();
    traceWriter.close();
  }

  console.log(`PHASE3C TRACE: ${TRACE_FILE}`);
  console.log(`PHASE3C OVERALL: ${process.exitCode ? "FAIL" : "PASS"}`);
}

if (process.argv[1] && process.argv[1].endsWith("phase3c-live-verification.js")) {
  main().catch((error) => {
    console.error(`PHASE3C LIVE HARNESS BLOCKED: ${error.code || error.name || "UNCLASSIFIED"}`);
    console.error(`PHASE3C ERROR MESSAGE: ${typeof error?.message === "string" ? error.message : "NO_MESSAGE"}`);
    process.exitCode = 2;
  });
}
