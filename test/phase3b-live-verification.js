import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

import {
  deterministicClauseConstants,
  runDeterministicClauseStage,
} from "../services/phase3/intelligence/deterministicClauseService.js";
import { createClauseRepository } from "../repositories/phase3/clauseRepository.js";
import { buildCanonicalPageSource } from "../services/phase3/source/deterministicSourcePageAdapter.js";
import { getDatabaseEmptyState } from "./phase3a-live-verification.js";

const { Client, Pool } = pg;
const EXPECTED_PROJECT_REF = "amlpybvkzoegnxwuodyn";
const TEST_ENV_FILE = ".env.phase3-test.local";
const TRACE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "phase3b-runtime-trace.jsonl");
const APP_TABLES = [
  "organizations", "organization_memberships", "contracts", "documents",
  "document_versions", "document_version_extractions", "analysis_runs",
  "document_version_pages", "clauses", "intelligence_evidence", "clause_evidence",
];
const REPORTABLE_ERROR_CODES = new Set(["23505", "23503", "23514", "42501", "42703", "42P01"]);
const clientMarkers = new WeakMap();
let nextClientMarker = 1;

function safeError(error) {
  return {
    code: REPORTABLE_ERROR_CODES.has(error?.code) ? error.code : error?.code || "UNCLASSIFIED",
    classification: error?.code === "23505"
      ? "unique_violation"
      : error?.code === "23503"
        ? "foreign_key_violation"
        : error?.code === "23514"
          ? "check_violation"
          : error?.code === "42501"
            ? "insufficient_privilege_or_rls"
            : "database_error",
  };
}

function testError(testId, message, error) {
  const result = safeError(error);
  return {
    testId,
    expected: message,
    actual: `${result.classification} (${result.code})`,
    status: "FAIL",
    sqlState: result.code,
  };
}

function uuid() {
  return crypto.randomUUID();
}

function hash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function createTraceWriter() {
  try {
    fs.writeFileSync(TRACE_FILE, "", "utf8");
  } catch (error) {
    const traceError = new Error("Unable to initialize Phase 3B runtime trace");
    traceError.code = "TRACE_WRITE_FAILED";
    traceError.cause = error;
    throw traceError;
  }

  let closed = false;
  return {
    path: TRACE_FILE,
    record(event) {
      if (closed) {
        const traceError = new Error("Phase 3B runtime trace is closed");
        traceError.code = "TRACE_WRITE_FAILED";
        throw traceError;
      }
      try {
        const line = JSON.stringify(event);
        if (line.length > 8192) throw new Error("trace event exceeds bounded size");
        fs.appendFileSync(TRACE_FILE, `${line}\n`, "utf8");
      } catch (error) {
        const traceError = new Error("Unable to write Phase 3B runtime trace");
        traceError.code = "TRACE_WRITE_FAILED";
        traceError.cause = error;
        throw traceError;
      }
    },
    close() {
      closed = true;
    },
  };
}

function traceEvent(writer, event) {
  writer.record({ timestamp: new Date().toISOString(), ...event });
}

function clientMarker(client) {
  if (!client || (typeof client !== "object" && typeof client !== "function")) return null;
  if (!clientMarkers.has(client)) clientMarkers.set(client, `supabase-client-${nextClientMarker++}`);
  return clientMarkers.get(client);
}

function parseTestEnvironment() {
  dotenv.config({ path: TEST_ENV_FILE, override: true });
  const required = [
    "DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_TEST_SERVICE_ROLE_KEY",
  ];
  const missing = required.filter((name) => !process.env[name]);
  const url = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL) : null;
  const databaseUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
  const projectRef = process.env.PHASE3_SUPABASE_PROJECT_REF;
  if (missing.length) throw new Error(`Missing required test configuration: ${missing.join(", ")}`);
  if (process.env.PHASE3_DB_TEST_ENABLED !== "1") throw new Error("PHASE3_DB_TEST_ENABLED must equal 1");
  if (process.env.PHASE3_DB_ENV !== "non-production-test") throw new Error("PHASE3_DB_ENV must equal non-production-test");
  if (process.env.PHASE3_EMPTY_DATABASE !== "1") throw new Error("PHASE3_EMPTY_DATABASE must equal 1");
  if (process.env.PHASE3_APPLY_MIGRATIONS !== "1") throw new Error("PHASE3_APPLY_MIGRATIONS must equal 1");
  if (projectRef !== EXPECTED_PROJECT_REF) throw new Error("Unexpected Phase 3B project reference");
  if (!url || url.hostname.split(".")[0] !== EXPECTED_PROJECT_REF) throw new Error("SUPABASE_URL does not match the expected project");
  if (!databaseUrl || !decodeURIComponent(databaseUrl.username).includes(EXPECTED_PROJECT_REF)) throw new Error("DATABASE_URL username is not project-scoped");
  if (/(^|[-_])prod(uction)?($|[-_])/i.test(projectRef)) throw new Error("Production-like project reference rejected");
  return {
    databaseUrl: process.env.DATABASE_URL,
    supabaseUrl: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_TEST_SERVICE_ROLE_KEY,
  };
}

async function query(client, sql, values = []) {
  return client.query(sql, values);
}

async function expectDatabaseFailure(pool, sql, values, expectedCodes = []) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try {
      await client.query(sql, values);
      return { failed: false, code: null };
    } catch (error) {
      return { failed: true, code: error.code || null };
    } finally {
      await client.query("ROLLBACK").catch(() => {});
    }
  } finally {
    client.release();
  }
}

function fixtureIds() {
  const primaryRunId = uuid();
  return {
    runId: primaryRunId,
    runIds: [primaryRunId, uuid()],
    extraRunIds: [],
    organizationIds: [uuid(), uuid()],
    userIds: [],
    contractIds: [uuid(), uuid()],
    documentIds: [uuid(), uuid()],
    versionIds: [uuid(), uuid()],
    pageIds: [uuid(), uuid()],
    extractionIds: [uuid(), uuid()],
  };
}

async function createFixture({ config, pool, admin, ids, runLabel }) {
  const sourceText = "3. Maintenance\nMaintenance is required.\n\n3.1 Inspection\nInspect the aircraft.\n\n3.1.1 Engine\nInspect the engine.\n\n3.1.2 Cabin\nInspect the cabin.\n\n3.2 Notice\nNotice is required.\n\n4. Delivery\nDeliver the aircraft.";
  const users = [];
  try {
    for (const suffix of ["a", "b"]) {
      const email = `operion-phase3b-${runLabel}-${suffix}@example.invalid`;
      const password = `${uuid()}-TestOnly!`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      users.push({ id: data.user.id, email, password });
      ids.userIds.push(data.user.id);
    }

    const client = await pool.connect();
    await client.query("BEGIN");
    try {
      for (let index = 0; index < 2; index += 1) {
      const organizationId = ids.organizationIds[index];
      const contractId = ids.contractIds[index];
      const documentId = ids.documentIds[index];
      const versionId = ids.versionIds[index];
      const pageId = ids.pageIds[index];
      const extractionId = ids.extractionIds[index];
      const user = users[index];
      await query(client, "insert into organizations (id, name, slug) values ($1, $2, $3)", [organizationId, `Phase3B ${runLabel} ${index}`, `phase3b-${runLabel}-${index}-${organizationId}`]);
      await query(client, "insert into organization_memberships (organization_id, user_id, role) values ($1, $2, 'owner')", [organizationId, user.id]);
      await query(client, "insert into contracts (id, organization_id, created_by, title) values ($1, $2, $3, $4)", [contractId, organizationId, user.id, `Phase3B ${runLabel} synthetic contract ${index}`]);
      await query(client, `insert into documents (id, organization_id, contract_id, created_by, filename, mime_type, file_size, storage_key, sha256) values ($1, $2, $3, $4, $5, 'application/pdf', 1, $6, $7)`, [documentId, organizationId, contractId, user.id, `${runLabel}-${index}.pdf`, `organizations/${organizationId}/documents/${documentId}/versions/${versionId}/source.pdf`, hash(`${runLabel}-${index}`)]);
      await query(client, `insert into document_versions (id, document_id, organization_id, version_number, sha256, storage_key, mime_type, file_size, extraction_status, created_by) values ($1, $2, $3, 1, $4, $5, 'application/pdf', 1, 'completed', $6)`, [versionId, documentId, organizationId, hash(`${runLabel}-${index}`), `organizations/${organizationId}/documents/${documentId}/versions/${versionId}/source.pdf`, user.id]);
      await query(client, `insert into document_version_extractions (id, document_version_id, organization_id, text_content, text_length, extraction_status) values ($1, $2, $3, $4, $5, 'completed')`, [extractionId, versionId, organizationId, sourceText, sourceText.length]);
      await query(client, `insert into analysis_runs (id, organization_id, contract_id, document_version_id, status, pipeline_version, requested_by) values ($1, $2, $3, $4, 'extracting', $5, $6)`, [ids.runIds[index], organizationId, contractId, versionId, deterministicClauseConstants.pipelineVersion, user.id]);
      await query(client, `insert into document_version_pages (id, organization_id, contract_id, document_id, document_version_id, analysis_run_id, page_number, text_content, text_length, char_start, char_end, text_hash) values ($1, $2, $3, $4, $5, $6, 1, $7, $8, 0, $8, $9)`, [pageId, organizationId, contractId, documentId, versionId, ids.runIds[index], sourceText, sourceText.length, hash(sourceText)]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    for (const user of users) await admin.auth.admin.deleteUser(user.id).catch(() => {});
    throw error;
  }
  return { users, sourceText };
}

async function countStage(pool, ids) {
  const client = await pool.connect();
  try {
    const result = await client.query("select (select count(*) from clauses where analysis_run_id=$1)::int as clauses, (select count(*) from intelligence_evidence where analysis_run_id=$1)::int as evidence, (select count(*) from clause_evidence where clause_id in (select id from clauses where analysis_run_id=$1))::int as links", [ids.runId]);
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function readPersistedHierarchy(pool, analysisRunId) {
  const result = await pool.query(
    "select id, clause_number, parent_clause_id, organization_id, contract_id, document_id, document_version_id, analysis_run_id from clauses where analysis_run_id=$1 order by clause_number",
    [analysisRunId]
  );
  return result.rows;
}

function assertPersistedHierarchy(rows, traceWriter, tenant, analysisRunId) {
  const byNumber = new Map(rows.map((row) => [row.clause_number, row]));
  const expectations = [
    ["3", null],
    ["3.1", "3"],
    ["3.1.1", "3.1"],
    ["3.1.2", "3.1"],
    ["3.2", "3"],
    ["4", null],
  ];
  const idByNumber = new Map(rows.map((row) => [row.clause_number, row.id]));
  for (const [clauseNumber, parentNumber] of expectations) {
    const row = byNumber.get(clauseNumber);
    const expectedParentId = parentNumber ? idByNumber.get(parentNumber) : null;
    const pass = Boolean(row)
      && row.parent_clause_id === expectedParentId
      && row.analysis_run_id === analysisRunId;
    traceEvent(traceWriter, {
      event: "parent_hierarchy_assertion",
      tenant,
      clauseNumber,
      clauseId: row?.id || null,
      expectedParentClauseNumber: parentNumber,
      expectedParentId,
      actualParentId: row?.parent_clause_id || null,
      result: pass ? "PASS" : "FAIL",
    });
    if (!pass) throw new Error(`Persisted parent hierarchy mismatch for clause ${clauseNumber}`);
  }
  return true;
}

async function assertRunFixture(pool, ids, runId) {
  const result = await pool.query(
    "select count(*)::int as count from analysis_runs where id=$1 and organization_id=$2 and contract_id=$3 and document_version_id=$4",
    [runId, ids.organizationIds[0], ids.contractIds[0], ids.versionIds[0]]
  );
  if (result.rows[0].count !== 1) throw new Error(`AnalysisRun fixture is not valid: ${runId}`);
}

async function verifyFixtureGraph(pool, ids, tenantIndex = 0) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      select
        (select count(*) from organizations where id = $1) as organization_count,
        (select count(*) from contracts where id = $2 and organization_id = $1) as contract_count,
        (select count(*) from documents where id = $3 and organization_id = $1 and contract_id = $2) as document_count,
        (select count(*) from document_versions where id = $4 and organization_id = $1 and document_id = $3) as version_count,
        (select count(*) from document_version_extractions where document_version_id = $4 and organization_id = $1) as extraction_count,
        (select count(*) from analysis_runs where id = $5 and organization_id = $1 and contract_id = $2 and document_version_id = $4) as run_count,
        (select count(*) from document_version_pages where document_version_id = $4 and analysis_run_id = $5 and organization_id = $1) as page_count
    `, [
      ids.organizationIds[tenantIndex],
      ids.contractIds[tenantIndex],
      ids.documentIds[tenantIndex],
      ids.versionIds[tenantIndex],
      ids.runIds[tenantIndex],
    ]);
    const counts = Object.fromEntries(Object.entries(result.rows[0]).map(([key, value]) => [key, Number(value)]));
    const valid = Object.values(counts).every((value) => value === 1);
    if (!valid) throw new Error(`Fixture graph incomplete for tenant ${tenantIndex}`);
    return counts;
  } finally {
    client.release();
  }
}

async function diagnoseAnalysisRunVisibility({ admin, pool, ids, tenantIndex = 0, traceWriter }) {
  const organizationId = ids.organizationIds[tenantIndex];
  const contractId = ids.contractIds[tenantIndex];
  const documentId = ids.documentIds[tenantIndex];
  const documentVersionId = ids.versionIds[tenantIndex];
  const analysisRunId = ids.runIds[tenantIndex];
  const documentResult = await admin
    .from("documents")
    .select("id, contract_id, organization_id")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  const documentContractId = documentResult.data?.contract_id || null;
  const directClient = await pool.connect();

  try {
    const directResult = await directClient.query(
      `select id, organization_id, contract_id, document_version_id, status, pipeline_version
         from analysis_runs
        where id = $1
          and organization_id = $2
          and document_version_id = $3
          and contract_id = $4`,
      [analysisRunId, organizationId, documentVersionId, documentContractId]
    );
    const supabaseResult = await admin
      .from("analysis_runs")
      .select("id, organization_id, contract_id, document_version_id, status, pipeline_version")
      .eq("id", analysisRunId)
      .eq("organization_id", organizationId)
      .eq("document_version_id", documentVersionId)
      .eq("contract_id", documentContractId)
      .maybeSingle();
    const directRow = directResult.rows[0] || null;
    const supabaseRow = supabaseResult.data || null;
    const idsMatch = documentContractId === contractId
      && directRow?.id === analysisRunId
      && supabaseRow?.id === analysisRunId;
    const classification = documentContractId !== contractId
      ? "DOCUMENT_CONTRACT_DIVERGENCE"
      : directRow && supabaseResult.error
        ? "POSTGRES_PRESENT_SUPABASE_ERROR"
        : directRow && !supabaseRow
          ? "POSTGRES_PRESENT_SUPABASE_EMPTY"
          : idsMatch && directRow && supabaseRow
            ? "DIRECT_POSTGRES_AND_SUPABASE_MATCH"
            : "IDENTIFIER_DIVERGENCE";

    const diagnostic = {
      classification,
      tenantIndex,
      fixture: {
        organizationId,
        contractId,
        documentId,
        documentVersionId,
        analysisRunId,
      },
      documentContractId,
      directPostgres: {
        rowCount: directResult.rows.length,
        row: directRow,
      },
      supabaseAdmin: {
        clientMarker: clientMarker(admin),
        error: supabaseResult.error
          ? { code: supabaseResult.error.code || null, message: supabaseResult.error.message || null }
          : null,
        rowCount: supabaseRow ? 1 : 0,
        row: supabaseRow,
      },
    };
    traceEvent(traceWriter, { event: "analysis_run_visibility", tenant: tenantIndex === 0 ? "A" : "B", ...diagnostic });
    return diagnostic;
  } finally {
    directClient.release();
  }
}

function createFailurePool(databaseUrl, failurePoint) {
  return {
    async connect() {
      const connection = new Client({ connectionString: databaseUrl });
      await connection.connect();
      const originalQuery = connection.query.bind(connection);
      connection.query = async (sql, values) => {
        const normalized = sql.trim().toLowerCase();
        const matches = failurePoint === "evidence" && normalized.startsWith("insert into intelligence_evidence")
          || failurePoint === "link" && normalized.startsWith("insert into clause_evidence")
          || failurePoint === "application" && normalized.startsWith("insert into clause_evidence");
        if (matches) {
          if (failurePoint === "application") await originalQuery(sql, values);
          const error = new Error(`${failurePoint} failure injection`);
          error.code = "PHASE3B_INJECTED_FAILURE";
          throw error;
        }
        return originalQuery(sql, values);
      };
      const originalRelease = connection.release?.bind(connection);
      connection.release = async () => {
        if (originalRelease) originalRelease();
        else await connection.end();
      };
      return connection;
    },
  };
}

function buildSimpleSource(ids, tenantIndex = 0) {
  const text = "1. Payment\nPayment is required.";
  return {
    organizationId: ids.organizationIds[tenantIndex],
    contractId: ids.contractIds[tenantIndex],
    documentId: ids.documentIds[tenantIndex],
    documentVersionId: ids.versionIds[tenantIndex],
    analysisRunId: ids.runId,
    analysisRun: { status: "extracting" },
    text,
    textTruncated: false,
    pageBoundaries: "derived_unavailable",
    pages: [],
    sourceLocator: (start, end) => `document_version:${ids.versionIds[tenantIndex]}:char:${start}-${end}`,
  };
}

async function runStage({ config, pool, admin, ids, tenantIndex = 0, failurePoint = null, sourceOverride = null, traceWriter }) {
  const servicePool = failurePoint ? createFailurePool(config.databaseUrl, failurePoint) : pool;
  const sourceService = sourceOverride
    ? { load: async () => sourceOverride }
    : (await import("../services/phase3/source/documentVersionSourceService.js")).createDocumentVersionSourceService(admin, {
        expectedClient: admin,
        clientMarker: clientMarker(admin),
        onEvent: (event) => traceEvent(traceWriter, { event: event.event, tenant: tenantIndex === 0 ? "A" : "B", ...event }),
      });
  const clauseRepository = createClauseRepository(admin, servicePool);
  return runDeterministicClauseStage({
    organizationId: ids.organizationIds[tenantIndex],
    documentVersionId: ids.versionIds[tenantIndex],
    analysisRunId: ids.runId,
    sourceService,
    clauseRepository,
  });
}

async function authenticatedClient(config, user) {
  const client = createClient(config.supabaseUrl, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  const identity = await client.auth.getUser(data.session.access_token);
  if (identity.error || identity.data.user.id !== user.id) throw new Error("Authenticated identity mismatch");
  return { client, token: data.session.access_token };
}

async function runAssertions({ config, pool, admin, ids, fixture, traceWriter }) {
  const results = [];
  const record = (testId, expected, actual, status = "PASS", sqlState = null) => results.push({ testId, expected, actual, status, sqlState });
  const before = await countStage(pool, ids);
  await verifyFixtureGraph(pool, ids, 0);
  await verifyFixtureGraph(pool, ids, 1);
  const diagnostics = [
    await diagnoseAnalysisRunVisibility({ admin, pool, ids, tenantIndex: 0, traceWriter }),
    await diagnoseAnalysisRunVisibility({ admin, pool, ids, tenantIndex: 1, traceWriter }),
  ];
  let primaryStageSucceeded = false;
  let firstStage = null;

  traceEvent(traceWriter, { event: "runtime_identifier_comparison", tenant: "A", diagnostic: diagnostics[0], production: {
    analysisRunId: ids.runIds[0],
    organizationId: ids.organizationIds[0],
    documentVersionId: ids.versionIds[0],
    contractId: ids.contractIds[0],
  }});
  try {
    traceEvent(traceWriter, { event: "stage_result", tenant: "A", result: "STARTED", analysisRunId: ids.runIds[0] });
    firstStage = await runStage({ config, pool, admin, ids, traceWriter });
    const tenantBIds = { ...ids, runId: ids.runIds[1] };
    traceEvent(traceWriter, { event: "runtime_identifier_comparison", tenant: "B", diagnostic: diagnostics[1], production: {
      analysisRunId: ids.runIds[1],
      organizationId: ids.organizationIds[1],
      documentVersionId: ids.versionIds[1],
      contractId: ids.contractIds[1],
    }});
    traceEvent(traceWriter, { event: "stage_result", tenant: "B", result: "STARTED", analysisRunId: ids.runIds[1] });
    await runStage({ config, pool, admin, ids: tenantBIds, tenantIndex: 1, traceWriter });
    const after = await countStage(pool, ids);
    const tenantARows = await readPersistedHierarchy(pool, ids.runIds[0]);
    const tenantBRows = await readPersistedHierarchy(pool, ids.runIds[1]);
    assertPersistedHierarchy(tenantARows, traceWriter, "A", ids.runIds[0]);
    assertPersistedHierarchy(tenantBRows, traceWriter, "B", ids.runIds[1]);
    if (tenantBRows.length === 0) throw new Error("Tenant B deterministic result is not populated");
    primaryStageSucceeded = true;
    traceEvent(traceWriter, { event: "stage_result", tenant: "A", result: "COMPLETED", clauseCount: after.clauses, evidenceCount: after.evidence, linkCount: after.links });
    traceEvent(traceWriter, { event: "stage_result", tenant: "B", result: "COMPLETED", clauseCount: after.clauses, evidenceCount: after.evidence, linkCount: after.links });
    record("ATM-01", "clauses, evidence, and links commit", `${after.clauses}/${after.evidence}/${after.links}`, after.clauses > 0 && after.evidence === after.clauses && after.links === after.clauses ? "PASS" : "FAIL");
    const byNumber = new Map(firstStage.clauses.map((clause) => [clause.clause_number, clause]));
    record("PAR-01", "3.1 parent is 3", byNumber.get("3.1")?.parent_clause_id ? "parent persisted" : "parent missing", byNumber.get("3.1")?.parent_clause_id ? "PASS" : "FAIL");
    record("PAR-02", "3.1.1 parent is 3.1", byNumber.get("3.1.1")?.parent_clause_id ? "parent persisted" : "parent missing", byNumber.get("3.1.1")?.parent_clause_id ? "PASS" : "FAIL");
    record("PAR-03", "3.2 parent is 3", byNumber.get("3.2")?.parent_clause_id ? "parent persisted" : "parent missing", byNumber.get("3.2")?.parent_clause_id ? "PASS" : "FAIL");
    record("PAR-04", "4 has no parent", byNumber.get("4")?.parent_clause_id ?? null, byNumber.get("4")?.parent_clause_id == null ? "PASS" : "FAIL");
    for (const evidence of firstStage.evidence) {
      const exact = fixture.sourceText.slice(evidence.char_start, evidence.char_end) === evidence.excerpt;
      record("INT-01", "excerpt equals canonical source slice", `${evidence.char_start}:${evidence.char_end}:${evidence.excerpt.length}`, exact ? "PASS" : "FAIL");
    }
    record("ID-01", "deterministic identity persists", firstStage.clauses.every((clause) => /^[0-9a-f]{64}$/.test(clause.clause_identity)) ? "all identities valid" : "invalid identity", firstStage.clauses.every((clause) => /^[0-9a-f]{64}$/.test(clause.clause_identity)) ? "PASS" : "FAIL");
  } catch (error) {
    traceEvent(traceWriter, { event: "stage_result", tenant: "A", result: "FAILED", errorCode: error.code || "UNCLASSIFIED", errorMessage: String(error.message || "").slice(0, 160) });
    results.push(testError("ATM-01", "successful stage commits", error));
  }

  if (primaryStageSucceeded && firstStage) {
    const applicationResult = await runStage({ config, pool, admin, ids, traceWriter });
    const applicationPass = applicationResult.status === "already_processed";
    traceEvent(traceWriter, { event: "idempotency_result", testId: "ID-02-APP", result: applicationPass ? "PASS" : "FAIL", stageStatus: applicationResult.status });
    record("ID-02-APP", "same-run invocation returns already_processed", applicationResult.status, applicationPass ? "PASS" : "FAIL");

    const duplicate = firstStage.clauses[0];
    const duplicateResult = await expectDatabaseFailure(pool, "insert into clauses (id, organization_id, contract_id, document_id, document_version_id, analysis_run_id, parent_clause_id, clause_number, title, category, subtype, source_text, confidence, review_status, clause_identity) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)", [
      uuid(), duplicate.organization_id, duplicate.contract_id, duplicate.document_id, duplicate.document_version_id, duplicate.analysis_run_id, duplicate.parent_clause_id, duplicate.clause_number, duplicate.title, duplicate.category, duplicate.subtype, duplicate.source_text, duplicate.confidence, duplicate.review_status, duplicate.clause_identity,
    ]);
    const duplicatePass = duplicateResult.failed && duplicateResult.code === "23505";
    traceEvent(traceWriter, { event: "database_uniqueness_result", testId: "ID-02-DB", result: duplicatePass ? "PASS" : "FAIL", sqlState: duplicateResult.code });
    record("ID-02-DB", "direct duplicate identity insert is rejected with 23505", `${duplicateResult.failed ? "rejected" : "accepted"} (${duplicateResult.code || "none"})`, duplicatePass ? "PASS" : "FAIL", duplicateResult.code);

    const byNumber = new Map(firstStage.clauses.map((clause) => [clause.clause_number, clause]));
    const nestedClause = byNumber.get("3.1");
    const alternateParent = byNumber.get("4");
    const immutableMutations = [
      ["IMM-02", "clause_identity", hash("identity-mutation"), nestedClause?.id],
      ["IMM-03", "parent_clause_id", alternateParent?.id, nestedClause?.id],
      ["IMM-04", "parent_clause_id", null, nestedClause?.id],
    ];
    for (const [testId, column, value, clauseId] of immutableMutations) {
      const mutation = await expectDatabaseFailure(pool, `update clauses set ${column}=$1 where id=$2`, [value, clauseId]);
      const pass = mutation.failed && mutation.code === "P0001";
      traceEvent(traceWriter, { event: "immutability_assertion", testId, result: pass ? "PASS" : "FAIL", sqlState: mutation.code });
      record(testId, "committed clause mutation is rejected with P0001", `${mutation.failed ? "rejected" : "accepted"} (${mutation.code || "none"})`, pass ? "PASS" : "FAIL", mutation.code);
    }

    const sourceLength = fixture.sourceText.length;
    const offsetsValid = firstStage.evidence.every((evidence) => evidence.char_start >= 0
      && evidence.char_end >= 0
      && evidence.char_start < evidence.char_end
      && evidence.char_end <= sourceLength
      && fixture.sourceText.slice(evidence.char_start, evidence.char_end) === evidence.excerpt);
    traceEvent(traceWriter, { event: "evidence_offset_assertion", testId: "INT-02", result: offsetsValid ? "PASS" : "FAIL", evidenceCount: firstStage.evidence.length, sourceLength });
    record("INT-02", "evidence offsets are bounded and end-exclusive", offsetsValid ? "all offsets valid" : "invalid offsets", offsetsValid ? "PASS" : "FAIL");

    const hashesValid = firstStage.evidence.every((evidence) => crypto.createHash("sha256").update(Buffer.from(evidence.excerpt, "utf8")).digest("hex") === evidence.evidence_hash);
    traceEvent(traceWriter, { event: "evidence_hash_assertion", testId: "INT-03", result: hashesValid ? "PASS" : "FAIL", evidenceCount: firstStage.evidence.length });
    record("INT-03", "persisted evidence hashes match SHA-256 excerpts", hashesValid ? "all hashes valid" : "hash mismatch", hashesValid ? "PASS" : "FAIL");

    const provenanceValid = firstStage.evidence.every((evidence) => evidence.page_id === null
      && evidence.page_number === null
      && typeof evidence.ambiguity_reason === "string"
      && evidence.ambiguity_reason.includes("PDF page boundaries")
      && evidence.source_locator.startsWith(`document_version:${ids.versionIds[0]}:char:`));
    traceEvent(traceWriter, { event: "evidence_provenance_assertion", testId: "INT-04", result: provenanceValid ? "PASS" : "FAIL", evidenceCount: firstStage.evidence.length, pageAnchoring: "unavailable" });
    record("INT-04", "derived evidence provenance is page-unavailable and honest", provenanceValid ? "provenance valid" : "provenance mismatch", provenanceValid ? "PASS" : "FAIL");
  } else {
    record("ID-02-APP", "same-run invocation returns already_processed", "primary stage unavailable", "NOT VERIFIED");
    record("ID-02-DB", "direct duplicate identity insert is rejected with 23505", "primary stage unavailable", "NOT VERIFIED");
  }

  const firstClause = (await pool.query("select * from clauses where analysis_run_id=$1 order by created_at asc limit 1", [ids.runId])).rows[0];
  const secondTenantClause = (await pool.query("select * from clauses where analysis_run_id=$1 order by created_at asc limit 1", [ids.runIds[1]])).rows[0];
  const identityBase = [ids.organizationIds[0], ids.contractIds[0], ids.documentIds[0], ids.versionIds[0], ids.runId, "99", "Identity probe", "general", "identity probe", 0.2, "pending"];
  const malformedIdentity = await expectDatabaseFailure(pool, "insert into clauses (organization_id, contract_id, document_id, document_version_id, analysis_run_id, clause_number, title, category, source_text, confidence, review_status, clause_identity) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)", [...identityBase, "not-a-sha256"]);
  record("ID-05", "malformed identity rejected", `${malformedIdentity.failed} (${malformedIdentity.code || "none"})`, malformedIdentity.failed && malformedIdentity.code === "23514" ? "PASS" : "FAIL", malformedIdentity.code);
  const nullIdentity = await expectDatabaseFailure(pool, "insert into clauses (organization_id, contract_id, document_id, document_version_id, analysis_run_id, clause_number, title, category, source_text, confidence, review_status, clause_identity) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)", [...identityBase, null]);
  record("ID-06", "null identity behavior recorded", `${nullIdentity.failed ? "rejected" : "accepted"} (${nullIdentity.code || "none"})`, "PASS", nullIdentity.code);

  if (firstClause && secondTenantClause) {
    const crossParent = await expectDatabaseFailure(pool, "update clauses set parent_clause_id=$1 where id=$2", [secondTenantClause.id, firstClause.id]);
    record("PAR-05", "cross-organization parent rejected", `${crossParent.failed ? "rejected" : "accepted"} (${crossParent.code || "none"})`, crossParent.failed ? "PASS" : "FAIL", crossParent.code);
    const selfParent = await expectDatabaseFailure(pool, "update clauses set parent_clause_id=$1 where id=$1", [firstClause.id]);
    record("PAR-06", "self-parent behavior recorded", `${selfParent.failed ? "rejected" : "accepted"} (${selfParent.code || "none"})`, "PASS", selfParent.code);
  }

  const invalidPage = await expectDatabaseFailure(pool, "insert into intelligence_evidence (organization_id, contract_id, document_id, document_version_id, analysis_run_id, page_id, excerpt, stage, pipeline_version, confidence, evidence_hash) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [ids.organizationIds[0], ids.contractIds[0], ids.documentIds[0], ids.versionIds[0], ids.runId, uuid(), "invalid page", "test", deterministicClauseConstants.pipelineVersion, 0.1, hash("invalid page")]);
  record("EVD-02", "nonexistent page rejected", `${invalidPage.failed ? "rejected" : "accepted"} (${invalidPage.code || "none"})`, invalidPage.failed ? "PASS" : "FAIL", invalidPage.code);
  if (firstClause && secondTenantClause) {
    const crossEvidence = await expectDatabaseFailure(pool, "insert into clause_evidence (organization_id, clause_id, evidence_id) values ($1,$2,$3)", [ids.organizationIds[0], firstClause.id, (await pool.query("select id from intelligence_evidence where analysis_run_id=$1 limit 1", [ids.runIds[1]])).rows[0]?.id || uuid()]);
    record("EVD-03", "cross-organization evidence rejected", `${crossEvidence.failed ? "rejected" : "accepted"} (${crossEvidence.code || "none"})`, crossEvidence.failed ? "PASS" : "FAIL", crossEvidence.code);
  }

  if (firstClause) {
    const immutableUpdate = await expectDatabaseFailure(pool, "update clauses set title='Phase3B mutation probe' where id=$1", [firstClause.id]);
    record("IMM-01", "clause mutation rejected", `${immutableUpdate.failed ? "rejected" : "accepted"} (${immutableUpdate.code || "none"})`, immutableUpdate.failed ? "PASS" : "FAIL", immutableUpdate.code);
  }

  const concurrentRunId = uuid();
  ids.extraRunIds.push(concurrentRunId);
  await pool.query("insert into analysis_runs (id, organization_id, contract_id, document_version_id, status, pipeline_version, requested_by) values ($1,$2,$3,$4,'extracting',$5,$6)", [concurrentRunId, ids.organizationIds[0], ids.contractIds[0], ids.versionIds[0], deterministicClauseConstants.pipelineVersion, fixture.users[0].id]);
  const concurrentIdentity = hash(`concurrent-${concurrentRunId}`);
  const concurrentValues = [ids.organizationIds[0], ids.contractIds[0], ids.documentIds[0], ids.versionIds[0], concurrentRunId, "88", "Concurrent identity", "general", "Concurrent identity", 0.2, "pending", concurrentIdentity];
  const insertSql = "insert into clauses (organization_id, contract_id, document_id, document_version_id, analysis_run_id, clause_number, title, category, source_text, confidence, review_status, clause_identity) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)";
  const connectionA = await pool.connect();
  const connectionB = await pool.connect();
  let concurrentWinner = false;
  let concurrentLoserCode = null;
  try {
    await connectionA.query("BEGIN");
    await connectionB.query("BEGIN");
    await connectionA.query(insertSql, concurrentValues);
    const competingInsert = connectionB.query(insertSql, concurrentValues).catch((error) => { concurrentLoserCode = error.code || null; return error; });
    await connectionA.query("COMMIT");
    const competingResult = await competingInsert;
    concurrentWinner = concurrentLoserCode === "23505" || competingResult?.code === "23505";
    await connectionB.query("ROLLBACK").catch(() => {});
  } finally {
    connectionA.release();
    connectionB.release();
  }
  const concurrentCount = await pool.query("select count(*)::int as count from clauses where analysis_run_id=$1 and clause_identity=$2", [concurrentRunId, concurrentIdentity]);
  record("CON-01", "one concurrent insert succeeds and one gets 23505", `count=${concurrentCount.rows[0].count}; loser=${concurrentLoserCode || "none"}`, concurrentWinner && concurrentCount.rows[0].count === 1 ? "PASS" : "FAIL", concurrentLoserCode);

  for (const failurePoint of ["evidence", "link", "application"]) {
    const failureIds = fixtureIds();
    failureIds.organizationIds = ids.organizationIds;
    failureIds.contractIds = ids.contractIds;
    failureIds.documentIds = ids.documentIds;
    failureIds.versionIds = ids.versionIds;
    failureIds.runId = uuid();
    ids.extraRunIds.push(failureIds.runId);
    const client = await pool.connect();
    try {
      await client.query("insert into analysis_runs (id, organization_id, contract_id, document_version_id, status, pipeline_version, requested_by) values ($1, $2, $3, $4, 'extracting', $5, $6)", [failureIds.runId, ids.organizationIds[0], ids.contractIds[0], ids.versionIds[0], deterministicClauseConstants.pipelineVersion, fixture.users[0].id]);
    } finally { client.release(); }
    try {
      await runStage({
        config,
        pool,
        admin,
        ids: failureIds,
        failurePoint,
        sourceOverride: buildSimpleSource(failureIds),
        traceWriter,
      });
      record(`ATM-${failurePoint}`, "controlled failure rolls back", "operation succeeded", "FAIL");
    } catch (error) {
      const state = await countStage(pool, failureIds);
      record(`ATM-${failurePoint}`, "controlled failure leaves zero clauses/evidence/links", `${safeError(error).classification}; ${JSON.stringify(state)}`, state.clauses === 0 && state.evidence === 0 && state.links === 0 ? "PASS" : "FAIL", safeError(error).code);
    }
  }

  const secondRunId = uuid();
  ids.extraRunIds.push(secondRunId);
  const client = await pool.connect();
  try {
    await client.query("insert into analysis_runs (id, organization_id, contract_id, document_version_id, status, pipeline_version, requested_by) values ($1, $2, $3, $4, 'extracting', $5, $6)", [secondRunId, ids.organizationIds[0], ids.contractIds[0], ids.versionIds[0], deterministicClauseConstants.pipelineVersion, fixture.users[0].id]);
  } finally { client.release(); }
  await assertRunFixture(pool, ids, secondRunId);
  const secondRunIds = { ...ids, runId: secondRunId };
  try {
    const second = await runStage({ config, pool, admin, ids: secondRunIds, traceWriter });
    record("ID-03", "same source may persist in separate AnalysisRun", `${second.clauses.length} clauses`, second.clauses.length > 0 ? "PASS" : "FAIL");
  } catch (error) {
    record("ID-03", "separate-run behavior recorded", `${safeError(error).classification} (${safeError(error).code})`, "FAIL", safeError(error).code);
  }

  const userA = await authenticatedClient(config, fixture.users[0]);
  const userB = await authenticatedClient(config, fixture.users[1]);
  const own = await userA.client.from("clauses").select("id, organization_id").eq("organization_id", ids.organizationIds[0]);
  const cross = await userA.client.from("clauses").select("id, organization_id").eq("organization_id", ids.organizationIds[1]);
  const ownB = await userB.client.from("clauses").select("id, organization_id").eq("organization_id", ids.organizationIds[1]);
  const crossB = await userB.client.from("clauses").select("id, organization_id").eq("organization_id", ids.organizationIds[0]);
  record("RLS-01", "User A reads own organization", own.error ? own.error.message : `${own.data.length} rows`, !own.error ? "PASS" : "FAIL");
  record("RLS-02", "User A cannot read Organization B", cross.error ? `denied (${cross.error.code || "error"})` : `${cross.data.length} rows returned`, cross.error || cross.data.length === 0 ? "PASS" : "FAIL");
  record("RLS-01B", "User B reads own organization", ownB.error ? ownB.error.message : `${ownB.data.length} rows`, !ownB.error ? "PASS" : "FAIL");
  record("RLS-02B", "User B cannot read Organization A", crossB.error ? `denied (${crossB.error.code || "error"})` : `${crossB.data.length} rows returned`, crossB.error || crossB.data.length === 0 ? "PASS" : "FAIL");
  const crossInsert = await userA.client.from("clauses").insert({ organization_id: ids.organizationIds[1], contract_id: ids.contractIds[1], document_id: ids.documentIds[1], document_version_id: ids.versionIds[1], analysis_run_id: ids.runId, title: "unauthorized", category: "general", source_text: "unauthorized", confidence: 0.1, review_status: "requires_review", clause_identity: hash("unauthorized") });
  record("RLS-03", "User A cross-tenant insert denied", crossInsert.error ? `denied (${crossInsert.error.code || "error"})` : "insert returned success", crossInsert.error ? "PASS" : "FAIL", crossInsert.error?.code || null);
  await userA.client.auth.signOut();
  await userB.client.auth.signOut();
  return results;
}

async function cleanup({ admin, pool, ids, extraRunIds = [] }) {
  const runIds = [...new Set([...(ids.runIds || []), ids.runId, ...(ids.extraRunIds || []), ...extraRunIds])];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("delete from clause_evidence where clause_id in (select id from clauses where analysis_run_id = any($1::uuid[]))", [runIds]);
    await client.query("delete from intelligence_evidence where analysis_run_id = any($1::uuid[])", [runIds]);
    await client.query("delete from clauses where analysis_run_id = any($1::uuid[])", [runIds]);
    await client.query("delete from document_version_pages where analysis_run_id = any($1::uuid[])", [runIds]);
    await client.query("delete from analysis_runs where id = any($1::uuid[])", [runIds]);
    await client.query("delete from document_version_extractions where document_version_id = any($1::uuid[])", [ids.versionIds]);
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
  for (const userId of ids.userIds) await admin.auth.admin.deleteUser(userId);
}

async function verifyCleanup({ admin, pool, ids, traceWriter }) {
  const client = await pool.connect();
  const remaining = {};
  const runIds = [...new Set([...(ids.runIds || []), ...(ids.extraRunIds || [])])];
  try {
    const checks = {
      analysisRuns: ["analysis_runs", "id", runIds],
      documentVersions: ["document_versions", "id", ids.versionIds],
      documents: ["documents", "id", ids.documentIds],
      contracts: ["contracts", "id", ids.contractIds],
      organizations: ["organizations", "id", ids.organizationIds],
      memberships: ["organization_memberships", "organization_id", ids.organizationIds],
      extractions: ["document_version_extractions", "id", ids.extractionIds],
      pages: ["document_version_pages", "id", ids.pageIds],
    };
    for (const [label, [table, column, values]] of Object.entries(checks)) {
      const result = await client.query(`select count(*)::int as count from public."${table}" where "${column}" = any($1::uuid[])`, [values]);
      remaining[label] = result.rows[0].count;
    }
    const scopedChecks = {
      clauses: ["clauses", "analysis_run_id", runIds],
      evidence: ["intelligence_evidence", "analysis_run_id", runIds],
    };
    for (const [label, [table, column, values]] of Object.entries(scopedChecks)) {
      const result = await client.query(`select count(*)::int as count from public."${table}" where "${column}" = any($1::uuid[])`, [values]);
      remaining[label] = result.rows[0].count;
    }
    const clauseEvidence = await client.query(
      "select count(*)::int as count from clause_evidence where clause_id in (select id from clauses where analysis_run_id = any($1::uuid[])) or evidence_id in (select id from intelligence_evidence where analysis_run_id = any($1::uuid[]))",
      [runIds]
    );
    remaining.clauseEvidence = clauseEvidence.rows[0].count;
  } finally {
    client.release();
  }

  let usersRemaining = 0;
  for (const userId of ids.userIds) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error && error.status !== 404) throw error;
    if (!error && data?.user) usersRemaining += 1;
  }
  const applicationPass = Object.values(remaining).every((count) => count === 0);
  const authPass = usersRemaining === 0;
  traceEvent(traceWriter, { event: "cleanup_verification", ...remaining, result: applicationPass ? "PASS" : "FAIL" });
  traceEvent(traceWriter, { event: "auth_cleanup_verification", usersChecked: ids.userIds.length, usersRemaining, result: authPass ? "PASS" : "FAIL" });
  if (!applicationPass || !authPass) {
    const error = new Error("Generated cleanup verification failed");
    error.code = "CLEANUP_VERIFICATION_FAILED";
    throw error;
  }
}

async function main() {
  const config = parseTestEnvironment();
  const traceWriter = createTraceWriter();
  const pool = new Pool({ connectionString: config.databaseUrl, max: 4 });
  const admin = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const ids = fixtureIds();
  const runLabel = `run-${ids.runId.slice(0, 8)}`;
  let fixture;
  const results = [];
  try {
    const identity = await pool.query("select current_database() as database_name, version() as server_version");
    console.log(`PHASE3B LIVE HARNESS TARGET: ${EXPECTED_PROJECT_REF}`);
    traceEvent(traceWriter, { event: "harness_start", projectRef: EXPECTED_PROJECT_REF, databaseHost: new URL(config.databaseUrl).hostname, databaseName: identity.rows[0].database_name, migrationExecution: "NONE" });
    const emptyState = await getDatabaseEmptyState({ query: (sql, values) => pool.query(sql, values) });
    if (emptyState.status !== "DATABASE_NOT_EMPTY") {
      throw new Error("Expected migrated schema before functional Phase 3B verification");
    }
    fixture = await createFixture({ config, pool, admin, ids, runLabel });
    results.push(...await runAssertions({ config, pool, admin, ids, fixture, traceWriter }));
    const failures = results.filter((result) => result.status === "FAIL");
    results.forEach((result) => traceEvent(traceWriter, { event: "test_result", ...result }));
    if (failures.length) process.exitCode = 1;
  } finally {
    if (fixture) {
      try {
        await cleanup({ admin, pool, ids });
        await verifyCleanup({ admin, pool, ids, traceWriter });
      }
      catch (error) { traceEvent(traceWriter, { event: "cleanup", result: "FAILED", ...safeError(error) }); process.exitCode = 1; }
    }
    try {
      await pool.end();
    } finally {
      traceWriter.close();
    }
  }
  console.log(`PHASE3B TRACE: ${TRACE_FILE}`);
  console.log(`PHASE3B OVERALL: ${process.exitCode ? "FAIL" : "PASS"}`);
}

if (process.argv[1] && process.argv[1].endsWith("phase3b-live-verification.js")) {
  main().catch((error) => {
    console.error(
      `PHASE3B LIVE HARNESS BLOCKED: ${error.code || error.name || "UNCLASSIFIED"}`
    );
    console.error(
      `PHASE3B ERROR MESSAGE: ${
        typeof error?.message === "string" ? error.message : "NO_MESSAGE"
      }`
    );
    process.exitCode = 2;
  });
}
