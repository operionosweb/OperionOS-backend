import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

dotenv.config({ path: ".env.phase3-test.local", override: true, quiet: true });

const API_URL = process.env.CONTRACT_E2E_API_URL || "http://127.0.0.1:10001";
const PDF_PATH = process.env.CONTRACT_E2E_PDF_PATH
  || path.join(process.env.LOCALAPPDATA || "", "Temp", "operion-synthetic-aircraft-lease.pdf");
const DOCX_PATH = path.resolve("test/fixtures/step9-aircraft-lease.docx");
const BUCKET = process.env.CONTRACT_DOCUMENT_BUCKET || "contract-documents";
const runLabel = `deployment-e2e-${Date.now()}-${randomUUID().slice(0, 8)}`;
const created = { users: [], organizations: [], aircraft: [], storageKeys: [] };
const checks = [];
const staleRunLabel = process.env.CONTRACT_E2E_CLEANUP_RUN_LABEL || null;

function requireEnvironment() {
  const required = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_TEST_SERVICE_ROLE_KEY"];
  const missing = required.filter((name) => !process.env[name]);
  assert.deepEqual(missing, [], `Missing target configuration: ${missing.join(", ")}`);
  assert.equal(process.env.PHASE3_DB_TEST_ENABLED, "1", "Live target testing is not enabled");
  assert.equal(process.env.PHASE3_DB_ENV, "non-production-test", "Refusing a production-like database target");
  const projectRef = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
  assert.doesNotMatch(projectRef, /(^|[-_])(prod|production)($|[-_])/i, "Production-like project rejected");
}

function record(name, details = {}) {
  checks.push({ name, status: "PASS", ...details });
}

async function apiRequest(route, { token, organizationId, method = "GET", body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (organizationId) headers["x-org-id"] = organizationId;
  if (body && !(body instanceof FormData)) headers["content-type"] = "application/json";
  const heartbeat = setInterval(() => {
    console.log(JSON.stringify({ event: "request_pending", method, route }));
  }, 250);
  let response;
  try {
    response = await fetch(`${API_URL}${route}`, {
      method,
      headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
  } finally {
    clearInterval(heartbeat);
  }
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  return { status: response.status, payload };
}

async function createTenant({ admin, pool, suffix }) {
  const user = {
    email: `${runLabel}-${suffix}@example.invalid`,
    password: `${randomUUID()}-TestOnly!`,
  };
  const auth = await admin.auth.admin.createUser({ ...user, email_confirm: true });
  if (auth.error) throw auth.error;
  user.id = auth.data.user.id;
  created.users.push(user.id);

  const organizationId = randomUUID();
  await pool.query(
    "insert into organizations (id, name, slug) values ($1, $2, $3)",
    [organizationId, `Contract deployment E2E ${suffix}`, `${runLabel}-${suffix}`]
  );
  created.organizations.push(organizationId);
  await pool.query(
    "insert into organization_memberships (organization_id, user_id, role) values ($1, $2, 'owner')",
    [organizationId, user.id]
  );

  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const session = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (session.error) throw session.error;
  return { organizationId, user, token: session.data.session.access_token };
}

async function seedAircraft(pool, organizationId) {
  const aircraftId = randomUUID();
  await pool.query(
    `insert into aircraft (id, registration, serial_number, manufacturer, model, data_source)
     values ($1, 'G-SYN1', '98765', 'Synthetic', 'E2E', $2)`,
    [aircraftId, runLabel]
  );
  created.aircraft.push(aircraftId);
  await pool.query(
    `insert into aircraft_organization_relationships
       (organization_id, aircraft_id, relationship_type, source_reference)
     values ($1, $2, 'leases', $3)`,
    [organizationId, aircraftId, runLabel]
  );
  return aircraftId;
}

async function upload({ filePath, mimeType, tenant, title }) {
  const buffer = await fs.readFile(filePath);
  console.log(JSON.stringify({ event: "upload_started", filename: path.basename(filePath), bytes: buffer.length }));
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), path.basename(filePath));
  form.append("title", title);
  const response = await apiRequest("/api/contracts/upload", {
    token: tenant.token,
    organizationId: tenant.organizationId,
    method: "POST",
    body: form,
  });
  console.log(JSON.stringify({ event: "upload_response", filename: path.basename(filePath), status: response.status, payload: response.payload }));
  assert.equal(response.status, 201, `Upload failed: ${JSON.stringify(response.payload)}`);
  assert.equal(response.payload.status, "ready");
  assert.ok(response.payload.textLength > 0);
  const extension = path.extname(filePath).slice(1).toLowerCase();
  created.storageKeys.push(
    `organizations/${tenant.organizationId}/documents/${response.payload.documentId}/versions/${response.payload.documentVersionId}/source.${extension}`
  );
  return response.payload;
}

async function processAndRead(tenant, uploadResult) {
  const route = `/api/analysis-runs/${uploadResult.analysisRunId}`;
  const scope = { token: tenant.token, organizationId: tenant.organizationId };
  console.log(JSON.stringify({ event: "processing_started", analysisRunId: uploadResult.analysisRunId }));
  const processed = await apiRequest(`${route}/process`, { ...scope, method: "POST" });
  if (processed.status !== 201) {
    console.error(JSON.stringify({ event: "processing_failure", analysisRunId: uploadResult.analysisRunId, response: processed }, null, 2));
  }
  assert.equal(processed.status, 201, JSON.stringify(processed.payload));
  assert.equal(processed.payload.status, "completed");
  console.log(JSON.stringify({ event: "processing_completed", counts: processed.payload.counts }));

  const endpoints = ["profile", "clauses", "obligations", "deadlines", "risks", "evidence"];
  const output = {};
  for (const endpoint of endpoints) {
    const response = await apiRequest(`${route}/${endpoint}`, scope);
    assert.equal(response.status, 200, `${endpoint}: ${JSON.stringify(response.payload)}`);
    output[endpoint] = response.payload[endpoint];
    console.log(JSON.stringify({ event: "read_completed", endpoint }));
  }
  assert.ok(output.profile);
  console.log(JSON.stringify({ event: "profile_identifiers", identifiers: output.profile.aircraft_identifiers }));
  assert.ok(output.clauses.length > 0);
  assert.ok(output.evidence.length > 0);

  console.log(JSON.stringify({ event: "search_started" }));
  const search = await apiRequest(`${route}/search?q=maintenance`, scope);
  assert.equal(search.status, 200, JSON.stringify(search.payload));
  assert.ok(search.payload.results.length > 0);
  console.log(JSON.stringify({ event: "search_completed", results: search.payload.results.length }));

  console.log(JSON.stringify({ event: "grounded_assistant_started" }));
  const grounded = await apiRequest(`${route}/assistant`, {
    ...scope,
    method: "POST",
    body: { question: "What maintenance obligations are established?" },
  });
  assert.equal(grounded.status, 200);
  assert.equal(grounded.payload.assistant.established, true);
  assert.ok(grounded.payload.assistant.evidence.length > 0);
  console.log(JSON.stringify({ event: "grounded_assistant_completed" }));

  console.log(JSON.stringify({ event: "refusal_assistant_started" }));
  const refusal = await apiRequest(`${route}/assistant`, {
    ...scope,
    method: "POST",
    body: { question: "What is the weather on Neptune?" },
  });
  console.log(JSON.stringify({ event: "refusal_assistant_response", assistant: refusal.payload?.assistant }));
  assert.equal(refusal.status, 200);
  assert.equal(refusal.payload.assistant.established, false);
  assert.deepEqual(refusal.payload.assistant.evidence, []);
  console.log(JSON.stringify({ event: "refusal_assistant_completed" }));

  console.log(JSON.stringify({ event: "idempotency_started" }));
  const repeated = await apiRequest(`${route}/process`, { ...scope, method: "POST" });
  assert.equal(repeated.status, 200);
  assert.equal(repeated.payload.status, "already_processed");
  console.log(JSON.stringify({ event: "idempotency_completed" }));
  return { ...output, search: search.payload.results, assistant: grounded.payload.assistant };
}

async function cleanup({ admin, pool }) {
  for (const storageKey of created.storageKeys) {
    const removal = await admin.storage.from(BUCKET).remove([storageKey]);
    if (removal.error) console.warn(`Storage cleanup warning: ${removal.error.message}`);
  }
  if (created.organizations.length) {
    await pool.query("delete from aircraft_contract_relationships where organization_id = any($1::uuid[])", [created.organizations]);
    await pool.query("update contracts set source_document_id = null where organization_id = any($1::uuid[])", [created.organizations]);
    await pool.query("delete from contracts where organization_id = any($1::uuid[])", [created.organizations]);
    await pool.query("delete from organizations where id = any($1::uuid[])", [created.organizations]);
  }
  if (created.aircraft.length) {
    await pool.query("delete from aircraft where id = any($1::uuid[])", [created.aircraft]);
  }
  for (const userId of created.users) {
    const deletion = await admin.auth.admin.deleteUser(userId);
    if (deletion.error) throw deletion.error;
  }
}

async function cleanupStaleFixture({ admin, pool, label }) {
  assert.match(label, /^deployment-e2e-\d+-[0-9a-f]{8}$/i, "Invalid stale fixture label");
  const organizations = await pool.query(
    "select id from organizations where slug like $1",
    [`${label}-%`]
  );
  const organizationIds = organizations.rows.map((row) => row.id);
  if (!organizationIds.length) return;
  const documents = await pool.query(
    "select storage_key from documents where organization_id = any($1::uuid[])",
    [organizationIds]
  );
  for (const { storage_key: storageKey } of documents.rows) {
    const removal = await admin.storage.from(BUCKET).remove([storageKey]);
    if (removal.error) console.warn(`Storage cleanup warning: ${removal.error.message}`);
  }
  const users = await pool.query(
    "select user_id from organization_memberships where organization_id = any($1::uuid[])",
    [organizationIds]
  );
  const aircraft = await pool.query(
    `select aircraft_id from aircraft_organization_relationships
     where organization_id = any($1::uuid[])`,
    [organizationIds]
  );
  await pool.query("delete from aircraft_contract_relationships where organization_id = any($1::uuid[])", [organizationIds]);
  await pool.query("update contracts set source_document_id = null where organization_id = any($1::uuid[])", [organizationIds]);
  await pool.query("delete from contracts where organization_id = any($1::uuid[])", [organizationIds]);
  await pool.query("delete from organizations where id = any($1::uuid[])", [organizationIds]);
  if (aircraft.rows.length) {
    await pool.query("delete from aircraft where id = any($1::uuid[])", [aircraft.rows.map((row) => row.aircraft_id)]);
  }
  for (const { user_id: userId } of users.rows) {
    const deletion = await admin.auth.admin.deleteUser(userId);
    if (deletion.error && deletion.error.status !== 404) throw deletion.error;
  }
  record("stale_fixture_cleanup", { label, organizationsRemoved: organizationIds.length });
}

async function cleanupInterruptedFixtures({ admin, pool }) {
  const result = await pool.query(
    `select substring(slug from '^(deployment-e2e-[0-9]+-[0-9a-f]{8})-[ab]$') as label
       from organizations
      where slug ~ '^deployment-e2e-[0-9]+-[0-9a-f]{8}-[ab]$'
      group by label`
  );
  for (const row of result.rows) {
    if (row.label) await cleanupStaleFixture({ admin, pool, label: row.label });
  }
}

async function main() {
  requireEnvironment();
  await Promise.all([fs.access(PDF_PATH), fs.access(DOCX_PATH)]);
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_TEST_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  let completed = false;
  try {
    if (staleRunLabel) await cleanupStaleFixture({ admin, pool, label: staleRunLabel });
    await cleanupInterruptedFixtures({ admin, pool });
    if (process.argv.includes("--cleanup-only")) {
      const remaining = await pool.query(
        "select count(*)::int as count from organizations where slug ~ '^deployment-e2e-[0-9]+-[0-9a-f]{8}-[ab]$'"
      );
      assert.equal(remaining.rows[0].count, 0);
      console.log(JSON.stringify({ cleanupOnly: true, generatedOrganizationsRemaining: 0, checks }, null, 2));
      return;
    }
    const health = await apiRequest("/api/health");
    assert.equal(health.status, 200);
    record("backend_health", { service: health.payload.service });

    const tenantA = await createTenant({ admin, pool, suffix: "a" });
    const tenantB = await createTenant({ admin, pool, suffix: "b" });
    const aircraftId = await seedAircraft(pool, tenantA.organizationId);

    const pdf = await upload({
      filePath: PDF_PATH,
      mimeType: "application/pdf",
      tenant: tenantA,
      title: "Synthetic Aircraft Lease PDF",
    });
    record("pdf_ingestion", { pageCount: pdf.pageCount, textLength: pdf.textLength });
    const pdfIntelligence = await processAndRead(tenantA, pdf);
    record("pdf_intelligence", {
      clauses: pdfIntelligence.clauses.length,
      obligations: pdfIntelligence.obligations.length,
      deadlines: pdfIntelligence.deadlines.length,
      risks: pdfIntelligence.risks.length,
      evidence: pdfIntelligence.evidence.length,
      searchResults: pdfIntelligence.search.length,
    });
    const pdfAircraft = await apiRequest(`/api/aviation/aircraft/${aircraftId}/intelligence`, {
      token: tenantA.token,
      organizationId: tenantA.organizationId,
    });
    console.log(JSON.stringify({ event: "pdf_aircraft_intelligence", response: pdfAircraft }));

    const docx = await upload({
      filePath: DOCX_PATH,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      tenant: tenantA,
      title: "Synthetic Aircraft Lease DOCX",
    });
    record("docx_ingestion", { pageCount: docx.pageCount, textLength: docx.textLength });
    const docxIntelligence = await processAndRead(tenantA, docx);
    record("docx_intelligence", {
      clauses: docxIntelligence.clauses.length,
      obligations: docxIntelligence.obligations.length,
      deadlines: docxIntelligence.deadlines.length,
      risks: docxIntelligence.risks.length,
      evidence: docxIntelligence.evidence.length,
    });

    const crossTenant = await apiRequest(`/api/analysis-runs/${pdf.analysisRunId}`, {
      token: tenantB.token,
      organizationId: tenantA.organizationId,
    });
    assert.equal(crossTenant.status, 403);
    record("cross_tenant_api_denial", { httpStatus: crossTenant.status });

    const aircraft = await apiRequest(`/api/aviation/aircraft/${aircraftId}/intelligence`, {
      token: tenantA.token,
      organizationId: tenantA.organizationId,
    });
    assert.equal(aircraft.status, 200, JSON.stringify(aircraft.payload));
    assert.ok(aircraft.payload.intelligence.contracts.length > 0);
    assert.ok(aircraft.payload.intelligence.impact.contracts > 0);
    record("aircraft_contract_link", { aircraftId });
    completed = true;
  } finally {
    console.log(JSON.stringify({ event: "cleanup_started" }));
    await cleanup({ admin, pool });
    const remaining = await pool.query(
      "select count(*)::int as count from organizations where id = any($1::uuid[])",
      [created.organizations]
    );
    assert.equal(remaining.rows[0].count, 0);
    record("fixture_cleanup", { organizationsRemoved: created.organizations.length, usersRemoved: created.users.length });
    await pool.end();
    console.log(JSON.stringify({ event: "cleanup_completed" }));
  }

  assert.equal(completed, true);
  console.log(JSON.stringify({ runLabel, apiUrl: API_URL, checks }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(JSON.stringify({ runLabel, checks, error: { name: error.name, message: error.message, code: error.code } }, null, 2));
  process.exitCode = 1;
}