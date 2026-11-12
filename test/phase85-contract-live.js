import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateContractValidationConfig } from "./phase84-contract-validation.js";

const REQUIRED_CATEGORIES = ["summary", "clause", "obligation", "deadline", "financial_commitment", "risk", "recommendation"];
const TITLE = "Synthetic aircraft lease live validation";

function fail(code) {
  throw Object.assign(new Error(code), { code });
}

export function assertLiveFindings(profile, source, versionId) {
  const analysis = profile?.metadata?.aiAnalysis;
  if (analysis?.method !== "ai" || analysis.provider !== "azure_openai" || analysis.status !== "requires_review"
    || !Array.isArray(analysis.findings) || !analysis.findings.length) fail("AI_RESULT_REQUIRED");
  for (const finding of analysis.findings) {
    const evidence = finding.evidence;
    if (finding.reviewStatus !== "requires_review" || !evidence?.evidenceId
      || evidence.documentVersionId !== versionId || typeof evidence.evidenceText !== "string"
      || !evidence.evidenceText || !source.includes(evidence.evidenceText)) fail("SOURCE_EVIDENCE_INVALID");
  }
  const categories = new Set(analysis.findings.map((item) => item.category));
  if (REQUIRED_CATEGORIES.some((category) => !categories.has(category))) fail("AI_CATEGORIES_INCOMPLETE");
  return analysis.findings;
}

export function assertTenantDenials({ apiOther, apiAnonymous, databaseOther, storageOther }) {
  if (![403, 404].includes(apiOther) || apiAnonymous !== 401
    || databaseOther !== 0 || ![403, 404].includes(Number(storageOther))) fail("TENANT_ISOLATION_UNVERIFIED");
}

export function assertConfig(env) {
  const result = evaluateContractValidationConfig(env);
  const approvals = [...result.approvalsRequired];
  if (env.CONTRACT_TEST_DEPLOYMENT_LIMITS_VERIFIED !== "true") approvals.push("CONTRACT_TEST_DEPLOYMENT_LIMITS_VERIFIED");
  if (result.missing.length || approvals.length || result.errors.length) {
    throw Object.assign(new Error("CONFIGURATION_BLOCKED"), {
      code: "CONFIGURATION_BLOCKED", missing: result.missing, approvalsRequired: approvals, errors: result.errors,
    });
  }
}

async function request(base, route, { token, organizationId, method = "GET", body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (organizationId) headers["x-org-id"] = organizationId;
  if (body && !(body instanceof FormData)) headers["content-type"] = "application/json";
  const response = await fetch(`${base}${route}`, {
    method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000), redirect: "error",
  });
  const payload = await response.json();
  return { status: response.status, payload };
}

async function signIn(createClient, env, suffix) {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await client.auth.signInWithPassword({
    email: env[`CONTRACT_TEST_TENANT_${suffix}_EMAIL`],
    password: env[`CONTRACT_TEST_TENANT_${suffix}_PASSWORD`],
  });
  if (result.error || !result.data.session?.access_token || !result.data.user?.id) fail("TEST_USER_AUTH_FAILED");
  return { client, token: result.data.session.access_token, id: result.data.user.id, organizationId: env[`CONTRACT_TEST_TENANT_${suffix}_ID`] };
}

export async function createSyntheticPdf() {
  const { default: PDFDocument } = await import("pdfkit");
  const source = await fs.readFile(new URL("./fixtures/synthetic-aircraft-lease.txt", import.meta.url), "utf8");
  const fixedDate = new Date("2026-01-01T00:00:00Z");
  const document = new PDFDocument({ size: "LETTER", margin: 36, info: { CreationDate: fixedDate, ModDate: fixedDate } });
  const chunks = [];
  document.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    document.once("end", resolve);
    document.once("error", reject);
  });
  document.text(source);
  document.end();
  await done;
  return Buffer.concat(chunks);
}

export async function runLiveValidation() {
  const env = process.env;
  assertConfig(env);
  env.CONTRACT_AI_MAX_INPUT_BYTES = "12000";
  const [{ default: express }, { createClient }, { default: pool }, { isVerifiedDatabaseConnection },
    { verifySchema }, { default: contractRoutes }, { default: analysisRunRoutes }] = await Promise.all([
    import("express"), import("@supabase/supabase-js"), import("../db.js"), import("../config/databaseTls.js"),
    import("./supabase-validation.js"), import("../routes/contractRoutes.js"), import("../routes/analysisRunRoutes.js"),
  ]);
  let server;
  const report = { status: "BLOCKED", stage: "database", aiAttempted: false, genuineAI: false, workspace: "UNVERIFIED", runId: randomUUID() };
  try {
    const connection = await pool.connect();
    try {
      if (!isVerifiedDatabaseConnection(connection)) fail("DATABASE_TLS_UNVERIFIED");
    } finally { connection.release(); }
    await verifySchema(pool);
    report.stage = "private_storage";
    const admin = createClient(env.SUPABASE_URL, env.SUPABASE_TEST_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const bucket = await admin.storage.getBucket("contract-documents");
    if (bucket.error || bucket.data?.public !== false || (env.DOCUMENT_STORAGE_BUCKET && env.DOCUMENT_STORAGE_BUCKET !== "contract-documents")) fail("PRIVATE_STORAGE_UNVERIFIED");
    report.stage = "test_tenants";
    const [a, b] = await Promise.all([signIn(createClient, env, "A"), signIn(createClient, env, "B")]);
    if (a.id === b.id) fail("DISTINCT_TEST_USERS_REQUIRED");
    const memberships = await pool.query(
      "select organization_id, user_id from organization_memberships where user_id = any($1::uuid[]) and status = 'active'",
      [[a.id, b.id]],
    );
    if (memberships.rows.length !== 2
      || !memberships.rows.some((row) => row.organization_id === a.organizationId && row.user_id === a.id)
      || !memberships.rows.some((row) => row.organization_id === b.organizationId && row.user_id === b.id)) fail("TEST_TENANTS_UNVERIFIED");
    const budget = await pool.query(
      "select allocated_intelligence, consumed_intelligence, reserved_intelligence, hard_limit from ai_intelligence_budgets where organization_id = $1",
      [a.organizationId],
    );
    if (!budget.rows[0] || budget.rows[0].hard_limit !== true
      || Number(budget.rows[0].allocated_intelligence) <= Number(budget.rows[0].consumed_intelligence) + Number(budget.rows[0].reserved_intelligence)) fail("TEST_BUDGET_UNAVAILABLE");
    const previous = await pool.query("select id from contracts where organization_id = $1 and title = $2", [a.organizationId, TITLE]);
    if (previous.rows.length) fail("PRIOR_VALIDATION_REQUIRES_REVIEW");

    report.stage = "synthetic_upload";
    const app = express();
    app.use(express.json({ limit: "64kb" }));
    app.use("/api/contracts", contractRoutes);
    app.use("/api/analysis-runs", analysisRunRoutes);
    server = await new Promise((resolve, reject) => {
      const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
      instance.once("error", reject);
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const bytes = await createSyntheticPdf();
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "application/pdf" }), "synthetic-aircraft-lease.pdf");
    form.append("title", TITLE);
    const uploaded = await request(base, "/api/contracts/upload", { token: a.token, organizationId: a.organizationId, method: "POST", body: form });
    if (uploaded.status !== 201 || uploaded.payload.status !== "ready" || !uploaded.payload.analysisRunId) fail("SYNTHETIC_UPLOAD_FAILED");
    const { analysisRunId, documentVersionId, documentId } = uploaded.payload;
    report.analysisRunId = analysisRunId;
    const sourceRow = await pool.query(
      "select text_content from document_version_extractions where organization_id = $1 and document_version_id = $2 and extraction_status = 'completed'",
      [a.organizationId, documentVersionId],
    );
    const source = sourceRow.rows[0]?.text_content;
    if (typeof source !== "string" || !source.includes("SYNTHETIC AIRCRAFT LEASE AGREEMENT")) fail("SYNTHETIC_SOURCE_INVALID");
    report.stage = "storage_and_tenant_isolation";
    const objectKey = `organizations/${a.organizationId}/documents/${documentId}/versions/${documentVersionId}/source.pdf`;
    const ownObject = await a.client.storage.from("contract-documents").download(objectKey);
    if (ownObject.error || !ownObject.data) fail("OWN_STORAGE_ACCESS_FAILED");
    const foreignObject = await b.client.storage.from("contract-documents").download(objectKey);
    if (!foreignObject.error) fail("TENANT_ISOLATION_UNVERIFIED");
    const ownDocument = await a.client.from("documents").select("id").eq("id", documentId);
    const foreignDocument = await b.client.from("documents").select("id").eq("id", documentId);
    if (ownDocument.error || ownDocument.data.length !== 1 || foreignDocument.error) fail("RLS_QUERY_FAILED");
    const foreignRun = await request(base, `/api/analysis-runs/${analysisRunId}`, { token: b.token, organizationId: b.organizationId });
    const anonymousRun = await request(base, `/api/analysis-runs/${analysisRunId}`);
    assertTenantDenials({
      apiOther: foreignRun.status, apiAnonymous: anonymousRun.status, databaseOther: foreignDocument.data.length,
      storageOther: foreignObject.error.statusCode || foreignObject.error.status,
    });
    const before = await pool.query("select id from ai_intelligence_jobs where organization_id = $1 and user_id = $2 and operation_type = 'full_contract_analysis'", [a.organizationId, a.id]);
    const knownJobs = new Set(before.rows.map((row) => row.id));
    report.aiAttempted = true;
    report.stage = "ai_processing";
    const processed = await request(base, `/api/analysis-runs/${analysisRunId}/process`, {
      token: a.token, organizationId: a.organizationId, method: "POST", body: { useAI: true, confirmAIBudget: true },
    });
    if (processed.status !== 201 || processed.payload.status !== "completed") fail("AI_PROCESSING_FAILED");
    const jobs = await pool.query(
      "select id, status, provider, technical_usage from ai_intelligence_jobs where organization_id = $1 and user_id = $2 and operation_type = 'full_contract_analysis'",
      [a.organizationId, a.id],
    );
    const newJobs = jobs.rows.filter((row) => !knownJobs.has(row.id));
    if (newJobs.length !== 1 || newJobs[0].status !== "completed" || newJobs[0].provider !== "azure_openai"
      || !Number.isSafeInteger(newJobs[0].technical_usage?.prompt_tokens)
      || !Number.isSafeInteger(newJobs[0].technical_usage?.completion_tokens)) fail("GENUINE_AI_JOB_UNVERIFIED");
    report.genuineAI = true;
    report.usage = newJobs[0].technical_usage;
    report.stage = "results_and_persistence";
    const profile = await request(base, `/api/analysis-runs/${analysisRunId}/profile`, { token: a.token, organizationId: a.organizationId });
    if (profile.status !== 200) fail("PROFILE_RETRIEVAL_FAILED");
    const findings = assertLiveFindings(profile.payload.profile, source, documentVersionId);
    const persisted = await pool.query(
      "select metadata from contract_intelligence_profiles where organization_id = $1 and analysis_run_id = $2",
      [a.organizationId, analysisRunId],
    );
    if (persisted.rows.length !== 1 || JSON.stringify(persisted.rows[0].metadata?.aiAnalysis) !== JSON.stringify(profile.payload.profile.metadata.aiAnalysis)) fail("AI_PERSISTENCE_UNVERIFIED");
    const ownProfile = await a.client.from("contract_intelligence_profiles").select("id").eq("analysis_run_id", analysisRunId);
    const foreignProfile = await b.client.from("contract_intelligence_profiles").select("id").eq("analysis_run_id", analysisRunId);
    if (ownProfile.error || ownProfile.data.length !== 1 || foreignProfile.error) fail("RLS_QUERY_FAILED");
    const foreignApi = await request(base, `/api/analysis-runs/${analysisRunId}/profile`, { token: b.token, organizationId: b.organizationId });
    const anonymousApi = await request(base, `/api/analysis-runs/${analysisRunId}/profile`);
    assertTenantDenials({
      apiOther: foreignApi.status, apiAnonymous: anonymousApi.status,
      databaseOther: foreignProfile.data.length,
      storageOther: foreignObject.error.statusCode || foreignObject.error.status,
    });
    report.stage = "deduplication";
    const repeated = await request(base, `/api/analysis-runs/${analysisRunId}/process`, {
      token: a.token, organizationId: a.organizationId, method: "POST", body: { useAI: true, confirmAIBudget: true },
    });
    if (repeated.status !== 200 || repeated.payload.status !== "already_processed") fail("REQUEST_DEDUPLICATION_UNVERIFIED");
    const after = await pool.query("select id from ai_intelligence_jobs where organization_id = $1 and user_id = $2 and operation_type = 'full_contract_analysis'", [a.organizationId, a.id]);
    if (after.rows.length !== jobs.rows.length) fail("DUPLICATE_AI_JOB");
    return { ...report, stage: "complete", status: "PASS", persistence: "VERIFIED", storage: "VERIFIED", tenantIsolation: "VERIFIED",
      inputTokenLimit: "OPERATOR_ATTESTED_NOT_INDEPENDENTLY_VERIFIED", findings };
  } catch (error) {
    const code = typeof error.code === "string" && /^[A-Z0-9_]{1,64}$/.test(error.code) ? error.code : "LIVE_VALIDATION_FAILED";
    return { ...report, status: "BLOCKED", code, message: report.aiAttempted ? "AI usage may have been charged; inspect usage before any retry." : "Validation stopped before an AI request." };
  } finally {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  }
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const original = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  for (const key of Object.keys(original)) console[key] = () => {};
  let report;
  try {
    report = await runLiveValidation();
  } catch (error) {
    report = {
      status: "BLOCKED", code: error.code === "CONFIGURATION_BLOCKED" ? error.code : "LIVE_VALIDATION_FAILED",
      missing: error.missing || [], approvalsRequired: error.approvalsRequired || [], errors: error.errors || [],
    };
  } finally {
    Object.assign(console, original);
  }
  console.log(JSON.stringify(report));
  if (report.status !== "PASS") process.exitCode = 2;
}
