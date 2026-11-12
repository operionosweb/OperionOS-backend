import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { verifySchema } from "./clean-room-migration-rehearsal.js";
import { createAnalysisRunRepository } from "../repositories/phase3/analysisRunRepository.js";
import { createPostgresIntelligenceStore } from "../services/ai/postgresIntelligenceStore.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = process.env.PHASE88_PG_BIN;
const temporaryRoot = process.env.PHASE88_PG_TMPDIR;
if (!bin || !temporaryRoot || process.env.PHASE88_DISPOSABLE_DATABASE !== "yes") {
  throw new Error("Set PHASE88_PG_BIN, PHASE88_PG_TMPDIR and PHASE88_DISPOSABLE_DATABASE=yes for a disposable loopback rehearsal");
}

const run = (name, args) => execFileSync(path.join(bin, name), args, { stdio: "ignore" });
const id = () => crypto.randomUUID();
const checks = [];
const beginFence = (connection, fence, organizationId, analysisRunId) =>
  connection.query("select public.begin_analysis_fenced_write_v2($1,$2,$3,$4,$5,$6)",
    [organizationId, analysisRunId, fence.workerId, fence.executionId, fence.generation, fence.token]);
const temp = await fs.mkdtemp(path.join(temporaryRoot, "phase88-pg-"));
const data = path.join(temp, "data");
const log = path.join(temp, "postgres.log");
let started = false;
let pool;
try {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const port = listener.address().port;
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  run("initdb.exe", ["-D", data, "-U", "postgres", "-A", "trust", "--encoding=UTF8", "--no-locale"]);
  run("pg_ctl.exe", ["start", "-D", data, "-l", log, "-o", `-h 127.0.0.1 -p ${port}`, "-w", "-t", "30"]);
  started = true;
  pool = new pg.Pool({ host: "127.0.0.1", port, user: "postgres", database: "postgres", max: 5 });
  await pool.query(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
  `);
  const stubServices = `
    create schema auth;
    create schema storage;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table storage.buckets (id text primary key, name text not null, public boolean not null default false);
    create table storage.objects (id uuid primary key, bucket_id text not null references storage.buckets(id), name text not null);
    alter table storage.objects enable row level security;
  `;
  await pool.query(stubServices);
  const directory = path.join(root, "supabase", "migrations");
  const migrations = (await fs.readdir(directory)).filter((name) => /^\d{3}_.+\.sql$/.test(name)).sort();
  assert.deepEqual(migrations.map((name) => name.slice(0, 3)),
    Array.from({ length: 35 }, (_, index) => String(index + 1).padStart(3, "0")));
  for (const migration of migrations) {
    try {
      await pool.query(await fs.readFile(path.join(directory, migration), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${migration} failed (${error.code || "unknown"})`, { cause: error });
    }
  }
  checks.push("migrations 001-035");
  await verifySchema(pool);
  checks.push("complete clean-room schema inventory");

  await pool.query("create database phase90_upgrade");
  const upgrade = new pg.Pool({ host: "127.0.0.1", port, user: "postgres", database: "phase90_upgrade", max: 1 });
  try {
    await upgrade.query(stubServices);
    for (const migration of migrations.slice(0, -2)) {
      await upgrade.query(await fs.readFile(path.join(directory, migration), "utf8"));
    }
    const upgradeUser = id(), upgradeOrg = id(), upgradeRun = id();
    await upgrade.query("insert into auth.users(id,email) values ($1,'upgrade@example.test')", [upgradeUser]);
    await upgrade.query("insert into public.organizations(id,name,slug) values ($1,'Upgrade',$2)", [upgradeOrg, `upgrade-${id()}`]);
    await upgrade.query("insert into public.organization_memberships(organization_id,user_id) values ($1,$2)", [upgradeOrg, upgradeUser]);
    const reserved = (await upgrade.query("select public.reserve_contract_upload($1,$2,null,null,$3,$4,'Upgrade','upgrade.pdf','application/pdf',10,$5,1,'contract-documents') as result",
      [upgradeOrg, upgradeUser, id(), id(), "9".repeat(64)])).rows[0].result;
    await upgrade.query("insert into public.analysis_runs(id,organization_id,contract_id,document_version_id,status,pipeline_version,requested_by) values ($1,$2,$3,$4,'awaiting_ingestion','synthetic',$5)",
      [upgradeRun, upgradeOrg, reserved.contract_id, reserved.version_id, upgradeUser]);
    const beforeUpgrade = (await upgrade.query("select id,organization_id,contract_id,document_version_id,status from public.analysis_runs where id=$1", [upgradeRun])).rows[0];
    const upgradeWithOwner = await upgrade.connect();
    try {
      await upgradeWithOwner.query("begin");
      await upgradeWithOwner.query("alter table public.analysis_write_fences disable trigger prevent_analysis_fence_activation");
      await upgradeWithOwner.query(`insert into public.analysis_write_fences
        (organization_id,analysis_run_id,worker_id,generation,token_hash,expires_at)
        values ($1,$2,$3,1,$4,clock_timestamp()+interval '10 minutes')`, [upgradeOrg, upgradeRun, id(), "1".repeat(64)]);
      await upgradeWithOwner.query("alter table public.analysis_write_fences enable trigger prevent_analysis_fence_activation");
      await assert.rejects(upgradeWithOwner.query(await fs.readFile(path.join(directory, migrations.at(-2)), "utf8")), /ANALYSIS_FENCE_UPGRADE_REQUIRES_REVIEW/);
      await upgradeWithOwner.query("rollback");
    } finally { upgradeWithOwner.release(); }
    await upgrade.query(await fs.readFile(path.join(directory, migrations.at(-2)), "utf8"));
    await upgrade.query(await fs.readFile(path.join(directory, migrations.at(-1)), "utf8"));
    assert.deepEqual((await upgrade.query("select id,organization_id,contract_id,document_version_id,status from public.analysis_runs where id=$1", [upgradeRun])).rows[0], beforeUpgrade);
    assert.equal((await upgrade.query("select count(*)::int as n from public.analysis_write_fences")).rows[0].n, 0);
    assert.equal((await upgrade.query("select state from public.contract_upload_journal where id=$1", [reserved.journal_id])).rows[0].state, "reserved");
    await verifySchema(upgrade);
  } finally { await upgrade.end(); }
  checks.push("upgrade through 035 preserves existing data and rejects nonempty 033 fences");
  const userA = id();
  const userB = id();
  const orgA = id();
  const orgB = id();
  await pool.query("insert into auth.users(id,email) values ($1,'a@example.test'),($2,'b@example.test')", [userA, userB]);
  await pool.query("insert into public.organizations(id,name,slug) values ($1,'A',$2),($3,'B',$4)", [orgA, `a-${id()}`, orgB, `b-${id()}`]);
  await pool.query("insert into public.organization_memberships(organization_id,user_id) values ($1,$2),($3,$4)", [orgA, userA, orgB, userB]);

  const reserve = (organization, user, hash, contract = null, document = null, pageCount = 1) =>
    pool.query("select public.reserve_contract_upload($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) as result",
      [organization, user, contract, document, document || id(), id(), "Synthetic", "synthetic.pdf",
        "application/pdf", 10, hash, pageCount, "contract-documents"]);
  const before = await pool.query("select count(*)::int as n from public.contracts");
  await assert.rejects(reserve(orgA, userA, "a".repeat(64), null, null, 0), { code: "23514" });
  assert.equal((await pool.query("select count(*)::int as n from public.contracts")).rows[0].n, before.rows[0].n);
  assert.equal((await pool.query("select count(*)::int as n from public.contract_upload_journal")).rows[0].n, 0);
  checks.push("reservation rollback");

  const attempts = await Promise.allSettled([reserve(orgA, userA, "b".repeat(64)), reserve(orgA, userA, "b".repeat(64))]);
  assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === "rejected" && attempt.reason.code === "23505").length, 1);
  const first = attempts.find((attempt) => attempt.status === "fulfilled").value.rows[0].result;
  assert.equal((await pool.query("select count(*)::int as n from public.contracts")).rows[0].n, before.rows[0].n + 1);
  checks.push("concurrent duplicate reservations");

  await assert.rejects(reserve(orgA, userB, "c".repeat(64)), { code: "42501" });
  await assert.rejects(reserve(orgB, userB, "c".repeat(64), first.contract_id, first.document_id));
  const second = (await reserve(orgA, userA, "d".repeat(64), first.contract_id, first.document_id)).rows[0].result;
  assert.equal(second.version_number, 2);
  const otherTenant = (await reserve(orgB, userB, "b".repeat(64))).rows[0].result;
  assert.notEqual(otherTenant.contract_id, first.contract_id);
  checks.push("membership, tenant scope and existing-document version");

  const transition = (state, next, runId = null) =>
    pool.query("select public.transition_contract_upload($1,$2,$3,$4,$5)", [orgA, first.journal_id, state, next, runId]);
  await assert.rejects(transition("reserved", "ready", id()));
  await transition("reserved", "transferring");
  await transition("transferring", "stored");
  const runId = id();
  await assert.rejects(pool.query("insert into public.analysis_runs(id,organization_id,contract_id,document_version_id,status,pipeline_version,requested_by) values ($1,$2,$3,$4,'queued','synthetic',$5)",
    [id(), orgA, first.contract_id, first.version_id, userA]));
  await pool.query("insert into public.analysis_runs(id,organization_id,contract_id,document_version_id,status,pipeline_version,requested_by) values ($1,$2,$3,$4,'awaiting_ingestion','synthetic',$5)",
    [runId, orgA, first.contract_id, first.version_id, userA]);
  await assert.rejects(pool.query("update public.analysis_runs set status='queued' where id=$1", [runId]));
  const guardedTables = ["contract_parties", "intelligence_evidence", "clauses", "obligations", "deadlines",
    "risks", "recommendations", "contract_search_chunks", "contract_intelligence_profiles"];
  for (const table of guardedTables) {
    await assert.rejects(pool.query(`insert into public.${table}(organization_id,document_version_id,analysis_run_id) values ($1,$2,$3)`,
      [orgA, first.version_id, runId]), /verified ingestion and dispatch required/);
  }
  await assert.rejects(transition("stored", "ready", id()));
  await assert.rejects(transition("stored", "ready", runId));
  assert.equal((await pool.query("select state from public.contract_upload_journal where id=$1", [first.journal_id])).rows[0].state, "stored");
  assert.equal((await pool.query("select count(*)::int as n from public.contract_analysis_outbox")).rows[0].n, 0);
  await pool.query("update public.documents set status='ready' where id=$1", [first.document_id]);
  await pool.query("update public.document_versions set extraction_status='completed',processing_status='processed' where id=$1", [first.version_id]);
  await pool.query("insert into public.document_version_extractions(document_version_id,organization_id,text_content,text_length,extraction_status) values ($1,$2,'synthetic contract',18,'completed')", [first.version_id, orgA]);
  await pool.query("insert into public.contract_sections(organization_id,contract_id,document_id,document_version_id,section_order,source_text) values ($1,$2,$3,$4,0,'synthetic contract')", [orgA, first.contract_id, first.document_id, first.version_id]);
  await pool.query("insert into public.contract_document_chunks(organization_id,contract_id,document_id,document_version_id,chunk_order,source_text,content_hash) values ($1,$2,$3,$4,0,'synthetic contract',$5)", [orgA, first.contract_id, first.document_id, first.version_id, "a".repeat(64)]);
  await transition("stored", "ready", runId);
  await assert.rejects(transition("stored", "ready", runId));
  const events = await pool.query("select state from public.contract_upload_events where journal_id=$1 order by id", [first.journal_id]);
  assert.deepEqual(events.rows.map((row) => row.state), ["reserved", "transferring", "stored", "ready"]);
  await assert.rejects(pool.query("delete from public.contract_upload_events where journal_id=$1", [first.journal_id]));
  checks.push("scoped transitions and append-only events");
  assert.equal((await pool.query("select state from public.contract_analysis_outbox where journal_id=$1", [first.journal_id])).rows[0].state, "pending");
  assert.equal((await pool.query("select status from public.analysis_runs where id=$1", [runId])).rows[0].status, "awaiting_ingestion");
  const inspection = await pool.query("select * from public.inspect_contract_upload_recovery($1,100)", [orgA]);
  assert.equal(inspection.rows.find((row) => row.journal_id === first.journal_id).classification, "RETRY_ELIGIBLE");
  assert.equal(inspection.rows.some((row) => row.journal_id === otherTenant.journal_id), false);
  assert.deepEqual((await pool.query("select * from public.inspect_contract_upload_recovery($1,100)", [orgA])).rows, inspection.rows);
  await assert.rejects(pool.query("select * from public.inspect_contract_upload_recovery($1,101)", [orgA]));
  await assert.rejects(pool.query("update public.analysis_runs set status='queued' where id=$1", [runId]));
  await assert.rejects(pool.query("select public.dispatch_contract_analysis($1,$2)", [orgB, first.journal_id]));
  await assert.rejects(pool.query("select public.dispatch_pending_contract_analyses(101)"));
  await assert.rejects(pool.query("insert into public.clauses(organization_id,contract_id,document_id,document_version_id,analysis_run_id,title,category,source_text,confidence) values ($1,$2,$3,$4,$5,'Synthetic','maintenance','source',1)",
    [orgA, first.contract_id, first.document_id, first.version_id, runId]), /verified ingestion and dispatch required/);
  const rollbackClient = await pool.connect();
  try {
    await rollbackClient.query("begin");
    await rollbackClient.query("select public.dispatch_contract_analysis($1,$2)", [orgA, first.journal_id]);
    await rollbackClient.query("rollback");
  } finally { rollbackClient.release(); }
  assert.equal((await pool.query("select state from public.contract_analysis_outbox where journal_id=$1", [first.journal_id])).rows[0].state, "pending");
  assert.equal((await pool.query("select status from public.analysis_runs where id=$1", [runId])).rows[0].status, "awaiting_ingestion");
  const dispatches = await Promise.all([1, 2].map(() => pool.query("select public.dispatch_contract_analysis($1,$2) as run", [orgA, first.journal_id])));
  assert.ok(dispatches.every((result) => result.rows[0].run === runId));
  assert.equal((await pool.query("select status from public.analysis_runs where id=$1", [runId])).rows[0].status, "queued");
  assert.equal((await pool.query("select * from public.inspect_contract_upload_recovery($1,100)", [orgA])).rows.some((row) => row.journal_id === first.journal_id), false);
  await assert.rejects(pool.query("insert into public.clauses(organization_id,contract_id,document_id,document_version_id,analysis_run_id,title,category,source_text,confidence) values ($1,$2,$3,$4,$5,'Synthetic','maintenance','source',1)",
    [orgA, first.contract_id, first.document_id, first.version_id, runId]), /ANALYSIS_FENCE_REJECTED/);
  const primaryClaim = (await pool.query(
    "select * from public.claim_analysis_execution($1,$2)",
    [orgA, runId]
  )).rows[0];
  const primaryFence = {
    workerId: primaryClaim.worker_id,
    executionId: primaryClaim.execution_id,
    generation: primaryClaim.generation,
    token: primaryClaim.token,
  };
  const wrongStatusToken = crypto.randomBytes(32).toString("hex");
  const analysisRunRepository = createAnalysisRunRepository(undefined, pool);
  const startedAt = new Date().toISOString();
  await analysisRunRepository.updateStatus({
    analysisRunId: runId, organizationId: orgA, status: "extracting", startedAt, fence: primaryFence,
  });
  await assert.rejects(analysisRunRepository.updateStatus({
    analysisRunId: runId, organizationId: orgA, status: "analysing", startedAt,
    fence: { ...primaryFence, token: wrongStatusToken },
  }), /ANALYSIS_FENCE_REJECTED/);
  await analysisRunRepository.updateStatus({
    analysisRunId: runId, organizationId: orgA, status: "analysing", startedAt, fence: primaryFence,
  });
  const intelligenceStore = createPostgresIntelligenceStore(pool);
  await intelligenceStore.setBudget(orgA, { allocated: 100, reserved: 5, consumed: 0, hardLimit: true });
  const aiJob = {
    id: id(), organizationId: orgA, userId: userA, analysisRunId: runId,
    operation: "full_contract_analysis", status: "processing", estimatedIntelligence: 5,
    actualIntelligence: 0, requestKey: `analysis-run:${runId}`, technicalUsage: {},
    createdAt: new Date().toISOString(),
  };
  const createdAiJob = await intelligenceStore.createJob(aiJob);
  const duplicateAiJob = await intelligenceStore.createJob({ ...aiJob, id: id() });
  assert.equal(duplicateAiJob.id, createdAiJob.id);
  const aiCompletion = {
    job: {
      ...createdAiJob, status: "completed", actualIntelligence: 7,
      provider: "synthetic-provider", model: "synthetic-model",
      technicalUsage: { input_tokens: 10, output_tokens: 2 },
      completedAt: new Date().toISOString(),
    },
    reservedAmount: 5,
    usage: {
      organizationId: orgA, jobId: createdAiJob.id, userId: userA, analysisRunId: runId,
      operation: "full_contract_analysis", estimatedIntelligence: 5, actualIntelligence: 7,
      provider: "synthetic-provider", model: "synthetic-model",
      technicalUsage: { input_tokens: 10, output_tokens: 2 }, createdAt: new Date().toISOString(),
    },
    cache: null,
  };
  await intelligenceStore.completeRequest(aiCompletion);
  await intelligenceStore.completeRequest(aiCompletion);
  assert.equal((await intelligenceStore.getBudget(orgA)).consumed, 7);
  assert.equal((await pool.query("select count(*)::int as n from public.ai_intelligence_usage where job_id=$1", [createdAiJob.id])).rows[0].n, 1);
  checks.push("run-attributed AI job deduplication and PostgreSQL usage accounting idempotency");
  const initialStage = await pool.connect();
  try {
    await initialStage.query("begin");
    await beginFence(initialStage, primaryFence, orgA, runId);
    await initialStage.query("insert into public.clauses(organization_id,contract_id,document_id,document_version_id,analysis_run_id,title,category,source_text,confidence) values ($1,$2,$3,$4,$5,'Synthetic','maintenance','source',1)",
      [orgA, first.contract_id, first.document_id, first.version_id, runId]);
    await initialStage.query("commit");
  } finally { initialStage.release(); }
  assert.equal((await pool.query("select count(*)::int as n from public.contract_analysis_outbox where journal_id=$1 and state='dispatched'", [first.journal_id])).rows[0].n, 1);
  assert.equal((await pool.query("select public.dispatch_pending_contract_analyses(10) as count")).rows[0].count, 0);
  checks.push("verified ingestion, nine result-table readiness guards, transactional outbox, rollback and concurrent idempotent dispatch");

  const secondRun = id();
  await pool.query("select public.transition_contract_upload($1,$2,'reserved','transferring',null)", [orgA, second.journal_id]);
  await pool.query("select public.transition_contract_upload($1,$2,'transferring','stored',null)", [orgA, second.journal_id]);
  await pool.query("insert into public.analysis_runs(id,organization_id,contract_id,document_version_id,status,pipeline_version,requested_by) values ($1,$2,$3,$4,'awaiting_ingestion','synthetic',$5)",
    [secondRun, orgA, second.contract_id, second.version_id, userA]);
  await pool.query("update public.document_versions set extraction_status='completed',processing_status='processed' where id=$1", [second.version_id]);
  await pool.query("insert into public.document_version_extractions(document_version_id,organization_id,text_content,text_length,extraction_status) values ($1,$2,'synthetic contract',18,'completed')", [second.version_id, orgA]);
  await pool.query("insert into public.contract_sections(organization_id,contract_id,document_id,document_version_id,section_order,source_text) values ($1,$2,$3,$4,0,'synthetic contract')", [orgA, second.contract_id, second.document_id, second.version_id]);
  await pool.query("insert into public.contract_document_chunks(organization_id,contract_id,document_id,document_version_id,chunk_order,source_text,content_hash) values ($1,$2,$3,$4,0,'synthetic contract',$5)", [orgA, second.contract_id, second.document_id, second.version_id, "c".repeat(64)]);
  const failureClient = await pool.connect();
  try {
    await failureClient.query("begin");
    await failureClient.query("create function public.synthetic_outbox_failure() returns trigger language plpgsql as $$ begin raise exception 'synthetic outbox failure'; end $$");
    await failureClient.query("create trigger synthetic_outbox_failure before insert on public.contract_analysis_outbox for each row execute function public.synthetic_outbox_failure()");
    await assert.rejects(failureClient.query("select public.transition_contract_upload($1,$2,'stored','ready',$3)", [orgA, second.journal_id, secondRun]), /synthetic outbox failure/);
    await failureClient.query("rollback");
  } finally { failureClient.release(); }
  assert.equal((await pool.query("select state from public.contract_upload_journal where id=$1", [second.journal_id])).rows[0].state, "stored");
  assert.equal((await pool.query("select count(*)::int as n from public.contract_analysis_outbox where journal_id=$1", [second.journal_id])).rows[0].n, 0);
  await pool.query("select public.transition_contract_upload($1,$2,'stored','ready',$3)", [orgA, second.journal_id, secondRun]);
  const batches = await Promise.all([1, 2].map(() => pool.query("select public.dispatch_pending_contract_analyses(1) as count")));
  assert.equal(batches.reduce((sum, result) => sum + result.rows[0].count, 0), 1);
  assert.equal((await pool.query("select status from public.analysis_runs where id=$1", [secondRun])).rows[0].status, "queued");
  assert.equal((await pool.query("select public.dispatch_pending_contract_analyses(1) as count")).rows[0].count, 0);
  checks.push("outbox failure rollback and concurrent bounded dispatch recovery");

  const access = await pool.query(`select
    has_function_privilege('authenticated', 'public.reserve_contract_upload(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,bigint,text,integer,text)', 'execute') as member_rpc,
    has_function_privilege('service_role', 'public.reserve_contract_upload(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,bigint,text,integer,text)', 'execute') as service_rpc,
    has_table_privilege('service_role', 'public.contract_upload_journal', 'insert') as direct_insert,
    has_table_privilege('service_role', 'public.contract_upload_events', 'insert') as forged_event,
    has_table_privilege('service_role', 'public.contract_analysis_outbox', 'update') as direct_dispatch,
    has_function_privilege('authenticated', 'public.dispatch_pending_contract_analyses(integer)', 'execute') as member_dispatch`);
  assert.deepEqual(access.rows[0], { member_rpc: false, service_rpc: true, direct_insert: false, forged_event: false, direct_dispatch: false, member_dispatch: false });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role service_role");
    await client.query("select public.transition_contract_upload($1,$2,'reserved','manual_review',null)", [orgB, otherTenant.journal_id]);
    await client.query("select public.reserve_contract_upload($1,$2,null,null,$3,$4,'Synthetic','synthetic.pdf','application/pdf',10,$5,1,'contract-documents')",
      [orgA, userA, id(), id(), "e".repeat(64)]);
    await client.query("rollback");
  } finally {
    client.release();
  }
  checks.push("RPC-only privileges and service role execution");
  await pool.query("select public.transition_contract_upload($1,$2,'reserved','manual_review',null)", [orgB, otherTenant.journal_id]);
  const manual = (await pool.query("select * from public.inspect_contract_upload_recovery($1,100)", [orgB])).rows;
  assert.equal(manual.find((row) => row.journal_id === otherTenant.journal_id).classification, "MANUAL_REVIEW_REQUIRED");
  assert.equal((await pool.query("select state from public.contract_upload_journal where id=$1", [otherTenant.journal_id])).rows[0].state, "manual_review");
  checks.push("bounded tenant-scoped dry-run classification preserves manual review");
  await pool.query("grant usage on schema public,auth to authenticated; grant select on public.documents,public.contract_upload_journal to authenticated");
  const member = await pool.connect();
  try {
    await member.query("begin");
    await member.query("set local role authenticated");
    await member.query("select set_config('request.jwt.claim.sub',$1,true)", [userA]);
    assert.equal((await member.query("select id from public.documents where id=$1", [first.document_id])).rowCount, 1);
    assert.equal((await member.query("select id from public.contract_upload_journal")).rowCount, 0);
    await member.query("select set_config('request.jwt.claim.sub',$1,true)", [userB]);
    assert.equal((await member.query("select id from public.documents where id=$1", [first.document_id])).rowCount, 0);
    await member.query("rollback");
  } finally {
    member.release();
  }
  checks.push("synthetic authenticated document RLS and journal denial");

  const fencePrivileges = await pool.query(`select
    has_table_privilege('service_role', 'public.analysis_write_fences', 'select,insert,update,delete') as service_table,
    has_function_privilege('service_role', 'public.begin_analysis_fenced_write_v2(uuid,uuid,uuid,uuid,bigint,text)', 'execute') as service_begin,
    has_function_privilege('authenticated', 'public.begin_analysis_fenced_write_v2(uuid,uuid,uuid,uuid,bigint,text)', 'execute') as member_begin,
    has_function_privilege('service_role', 'public.claim_analysis_execution(uuid,uuid)', 'execute') as service_claim,
    has_function_privilege('authenticated', 'public.claim_analysis_execution(uuid,uuid)', 'execute') as member_claim`);
  assert.deepEqual(fencePrivileges.rows[0], {
    service_table: false, service_begin: true, member_begin: false,
    service_claim: true, member_claim: false,
  });
  const workerA = primaryFence.workerId;
  const tokenA = primaryFence.token;
  const workerB = id();
  const executionB = id();
  const tokenB = crypto.randomBytes(32).toString("hex");
  const executions = new Map([[workerA, primaryFence.executionId], [workerB, executionB]]);
  const aircraftId = id(), managedRelationship = id(), independentRelationship = id();
  await pool.query("insert into public.aircraft(id,data_source) values ($1,'synthetic')", [aircraftId]);
  const firstClause = await pool.connect();
  const duplicateClause = await pool.connect();
  const duplicateIdentity = crypto.randomBytes(32).toString("hex");
  const clauseSql = `insert into public.clauses
    (id,organization_id,contract_id,document_id,document_version_id,analysis_run_id,title,category,source_text,confidence,clause_identity)
    values ($1,$2,$3,$4,$5,$6,'Concurrent','maintenance','synthetic',1,$7)`;
  try {
    await firstClause.query("begin");
    await beginFence(firstClause, primaryFence, orgA, runId);
    await duplicateClause.query("begin");
    const duplicatePid = (await duplicateClause.query("select pg_backend_pid() as pid")).rows[0].pid;
    const duplicateFenceWrite = beginFence(duplicateClause, primaryFence, orgA, runId);
    await firstClause.query(clauseSql, [id(), orgA, first.contract_id, first.document_id, first.version_id, runId, duplicateIdentity]);
    let blockedByFirst = false;
    for (let attempt = 0; attempt < 40 && !blockedByFirst; attempt += 1) {
      blockedByFirst = (await pool.query("select cardinality(pg_blocking_pids($1)) > 0 as blocked", [duplicatePid])).rows[0].blocked;
      if (!blockedByFirst) await new Promise((resolve) => setTimeout(resolve, 25));
    }
    await firstClause.query("commit");
    await duplicateFenceWrite;
    await beginFence(duplicateClause, primaryFence, orgA, runId);
    const duplicateWrite = assert.rejects(duplicateClause.query(clauseSql,
      [id(), orgA, first.contract_id, first.document_id, first.version_id, runId, duplicateIdentity]),
    { code: "23505", constraint: "clauses_document_version_run_identity_key" });
    await duplicateWrite;
    await duplicateClause.query("rollback");
    assert.equal(blockedByFirst, true, "concurrent duplicate must wait on the first transaction");
    assert.equal((await pool.query("select count(*)::int as n from public.clauses where analysis_run_id=$1 and clause_identity=$2", [runId, duplicateIdentity])).rows[0].n, 1);
  } finally {
    firstClause.release();
    duplicateClause.release();
  }
  checks.push("real concurrent PostgreSQL clause identity uniqueness and transaction blocking");
  const transfer = await pool.connect();
  try {
    await transfer.query(`update public.analysis_write_fences
      set worker_id=$1,execution_id=$2,generation=2,token_hash=$3
      where organization_id=$4 and analysis_run_id=$5`,
    [workerB, executionB, "b".repeat(64), orgA, runId]).then(
      () => assert.fail("ownership transfer must remain disabled"),
      (error) => assert.equal(error.code, "P0001")
    );
  } finally { transfer.release(); }
  const invalid = await pool.connect();
  try {
    for (const [fence, organization, run] of [
      [{ ...primaryFence, workerId: workerB }, orgA, runId],
      [{ ...primaryFence, generation: 2 }, orgA, runId],
      [{ ...primaryFence, token: tokenB }, orgA, runId],
      [primaryFence, orgB, runId],
      [{ ...primaryFence, executionId: id() }, orgA, runId],
    ]) {
      await invalid.query("begin");
      await assert.rejects(beginFence(invalid, fence, organization, run), /ANALYSIS_FENCE_REJECTED/);
      await invalid.query("rollback");
    }
    await assert.rejects(pool.query("select public.begin_analysis_fenced_write($1,$2,$3,$4,$5)", [orgA, runId, workerB, 2, tokenB]), /ANALYSIS_FENCE_EXECUTION_REQUIRED/);
  } finally { invalid.release(); }
  checks.push("database-issued initial ownership, immutable generation, disabled transfer, and wrong-worker/execution/tenant/token rejection");

  const { createClauseRepository } = await import("../repositories/phase3/clauseRepository.js");
  const { runDeterministicClauseStage, segmentDeterministicClauses } = await import("../services/phase3/intelligence/deterministicClauseService.js");
  const clauseRepository = createClauseRepository({}, pool);
  const source = {
    organizationId: orgA, contractId: first.contract_id, documentId: first.document_id,
    documentVersionId: first.version_id, analysisRunId: runId,
    text: "PAYMENT\nThe lessee shall pay monthly rent.\n",
    pageBoundaries: "derived_unavailable", sourceLocator: (start, end) => `char:${start}-${end}`,
    analysisRun: { status: "extracting" },
  };
  const stageArgs = {
    organizationId: orgA, documentVersionId: first.version_id, analysisRunId: runId,
    sourceService: { async load() { return source; } },
    clauseRepository: { ...clauseRepository, async listByRun() { return []; } },
  };
  const currentFence = primaryFence;
  await assert.rejects(runDeterministicClauseStage({ ...stageArgs, fence: { ...currentFence, workerId: workerB, executionId: executionB } }), /ANALYSIS_FENCE_REJECTED/);
  await assert.rejects(runDeterministicClauseStage({ ...stageArgs, fence: { ...currentFence, executionId: id() } }), /ANALYSIS_FENCE_REJECTED/);
  await assert.rejects(runDeterministicClauseStage({ ...stageArgs, organizationId: orgB, fence: currentFence }), /ANALYSIS_FENCE_REJECTED/);
  await assert.rejects(runDeterministicClauseStage({ ...stageArgs, analysisRunId: secondRun, fence: currentFence }), /ANALYSIS_FENCE_REJECTED/);
  const planned = segmentDeterministicClauses(source);
  const badClauses = planned.map(({ evidence: _evidence, ...clause }) => clause);
  await assert.rejects(clauseRepository.persistDeterministicClauseStage({
    organizationId: orgA, contractId: first.contract_id, documentId: first.document_id,
    documentVersionId: first.version_id, analysisRunId: runId, fence: currentFence,
    clauses: badClauses, evidenceRows: planned.map(({ evidence }) => ({ ...evidence, page_number: -1 })),
  }), { code: "23514" });
  assert.equal((await pool.query("select count(*)::int as n from public.clauses where id=any($1::uuid[])", [badClauses.map((row) => row.id)])).rows[0].n, 0);
  const competingStages = await Promise.allSettled([1, 2].map(() => runDeterministicClauseStage({ ...stageArgs, fence: currentFence })));
  assert.equal(competingStages.filter((result) => result.status === "fulfilled").length, 1,
    JSON.stringify(competingStages.map((result) => result.status === "fulfilled" ? "fulfilled" : { code: result.reason.code, constraint: result.reason.constraint })));
  assert.equal(competingStages.filter((result) => result.status === "rejected" && result.reason.code === "23505" && result.reason.constraint === "clauses_document_version_run_identity_key").length, 1,
    JSON.stringify(competingStages.map((result) => result.status === "fulfilled" ? "fulfilled" : { code: result.reason.code, constraint: result.reason.constraint })));
  const persistedStage = competingStages.find((result) => result.status === "fulfilled").value;
  assert.equal(persistedStage.clauses.length, planned.length);
  assert.equal(persistedStage.evidence.length, planned.length);
  assert.equal(persistedStage.clauseEvidence.length, planned.length);
  checks.push("real deterministic clause service and repository: stale, execution, tenant and run rejection; rollback; concurrent submissions and PostgreSQL clause identity constraint");

  const rows = Object.fromEntries([
    "document_version_pages", "contract_parties", "intelligence_evidence", "clauses", "obligations",
    "deadlines", "risks", "recommendations", "contract_search_chunks", "contract_intelligence_profiles",
  ].map((table) => [table, id()]));
  const scoped = "id,organization_id,contract_id,document_id,document_version_id,analysis_run_id";
  const values = [orgA, first.contract_id, first.document_id, first.version_id, runId];
  const inserts = [
    ["document_version_pages", "page_number", "1"],
    ["contract_parties", "name,normalized_name,role,confidence", "'Synthetic','synthetic','lessor',1"],
    ["intelligence_evidence", "excerpt,stage,pipeline_version,confidence,evidence_hash", `'source','test','test',1,'${"f".repeat(64)}'`],
    ["clauses", "title,category,source_text,confidence", "'Synthetic B','maintenance','source',1"],
    ["obligations", "clause_id,description,obligation_type,confidence,obligation_identity", `$7,'Synthetic','maintenance',1,'${"d".repeat(64)}'`],
    ["deadlines", "deadline_type,original_expression,confidence", "'ambiguous','unknown',1"],
    ["risks", "risk_category,severity,explanation,confidence", "'financial','low','synthetic',1"],
    ["recommendations", "recommendation_type,action,business_rationale,confidence", "'review','review','synthetic',1"],
    ["contract_search_chunks", "chunk_index,text_content,text_hash", `0,'source','${"e".repeat(64)}'`],
    ["contract_intelligence_profiles", "confidence", "1"],
  ];
  const links = [
    ["clause_evidence", "clause_id", "clauses"],
    ["obligation_evidence", "obligation_id", "obligations"],
    ["deadline_evidence", "deadline_id", "deadlines"],
    ["risk_evidence", "risk_id", "risks"],
    ["recommendation_evidence", "recommendation_id", "recommendations"],
    ["party_evidence", "party_id", "contract_parties"],
  ];
  const current = await pool.connect();
  try {
    await current.query("begin");
    await beginFence(current, primaryFence, orgA, runId);
    for (const [table, extraColumns, extraValues] of inserts) {
      const params = [rows[table], ...values];
      if (table === "obligations") params.push(rows.clauses);
      await current.query(`insert into public.${table}(${scoped},${extraColumns}) values ($1,$2,$3,$4,$5,$6,${extraValues})`, params);
    }
    for (const [table, key, parent] of links) {
      await current.query(`insert into public.${table}(organization_id,${key},evidence_id) values ($1,$2,$3)`,
        [orgA, rows[parent], rows.intelligence_evidence]);
    }
    await current.query("commit");
  } finally { current.release(); }

  const secondClaim = (await pool.query(
    "select * from public.claim_analysis_execution($1,$2)",
    [orgA, secondRun]
  )).rows[0];
  const secondFence = {
    workerId: secondClaim.worker_id,
    executionId: secondClaim.execution_id,
    generation: secondClaim.generation,
    token: secondClaim.token,
  };
  const otherEvidence = id();
  const otherRun = await pool.connect();
  try {
    await otherRun.query("begin");
    await beginFence(otherRun, secondFence, orgA, secondRun);
    await otherRun.query(`insert into public.intelligence_evidence(${scoped},excerpt,stage,pipeline_version,confidence,evidence_hash)
      values ($1,$2,$3,$4,$5,$6,'other source','test','test',1,$7)`,
    [otherEvidence, orgA, second.contract_id, second.document_id, second.version_id, secondRun, "8".repeat(64)]);
    await otherRun.query("commit");
    await otherRun.query("begin");
    await beginFence(otherRun, primaryFence, orgA, runId);
    await assert.rejects(otherRun.query("insert into public.clause_evidence(organization_id,clause_id,evidence_id) values ($1,$2,$3)",
      [orgA, rows.clauses, otherEvidence]), /ANALYSIS_FENCE_REJECTED/);
    await otherRun.query("rollback");
    await otherRun.query("begin");
    await beginFence(otherRun, primaryFence, orgA, runId);
    await assert.rejects(otherRun.query(`insert into public.document_version_pages(${scoped},page_number)
      values ($1,$2,$3,$4,$5,$6,1)`, [id(), orgA, second.contract_id, second.document_id, second.version_id, secondRun]), /ANALYSIS_FENCE_REJECTED/);
    await otherRun.query("rollback");
  } finally { otherRun.release(); }

  const stale = await pool.connect();
  try {
    for (const [table, extraColumns, extraValues] of inserts) {
      await stale.query("begin");
      await stale.query(`select set_config('operion.fence_organization',$1,true),set_config('operion.fence_run',$2,true),
        set_config('operion.fence_worker',$3,true),set_config('operion.fence_generation','1',true),set_config('operion.fence_token',$4,true),set_config('operion.fence_execution',$5,true)`,
        [orgA, runId, workerB, tokenB, executions.get(workerB)]);
      const params = [id(), ...values];
      if (table === "obligations") params.push(rows.clauses);
      for (const [sql, args] of [
        [`insert into public.${table}(${scoped},${extraColumns}) values ($1,$2,$3,$4,$5,$6,${extraValues})`, params],
        [`update public.${table} set analysis_run_id=analysis_run_id where id=$1`, [rows[table]]],
        [`delete from public.${table} where id=$1`, [rows[table]]],
      ]) {
        await stale.query("savepoint attempt");
        await assert.rejects(stale.query(sql, args), /ANALYSIS_FENCE_REJECTED/);
        await stale.query("rollback to savepoint attempt");
      }
      await stale.query("rollback");
    }
    for (const [table, key, parent] of links) {
      await stale.query("begin");
      await stale.query(`select set_config('operion.fence_organization',$1,true),set_config('operion.fence_run',$2,true),
        set_config('operion.fence_worker',$3,true),set_config('operion.fence_generation','1',true),set_config('operion.fence_token',$4,true),set_config('operion.fence_execution',$5,true)`,
        [orgA, runId, workerB, tokenB, executions.get(workerB)]);
      for (const sql of [
        `insert into public.${table}(organization_id,${key},evidence_id) values ($1,$2,$3)`,
        `update public.${table} set rank=rank where organization_id=$1 and ${key}=$2 and evidence_id=$3`,
        `delete from public.${table} where organization_id=$1 and ${key}=$2 and evidence_id=$3`,
      ]) {
        await stale.query("savepoint attempt");
        await assert.rejects(stale.query(sql, [orgA, rows[parent], rows.intelligence_evidence]), /ANALYSIS_FENCE_REJECTED/);
        await stale.query("rollback to savepoint attempt");
      }
      await stale.query("rollback");
    }
  } finally { stale.release(); }
  const service = await pool.connect();
  try {
    await service.query("begin");
    await service.query("grant select, delete on public.clauses to service_role");
    await service.query("set local role service_role");
    await assert.rejects(beginFence(service, { ...primaryFence, token: tokenB }, orgA, runId), /ANALYSIS_FENCE_REJECTED/);
    await service.query("rollback");
    await service.query("begin");
    await service.query("set local role service_role");
    await assert.rejects(beginFence(service, { ...primaryFence, token: tokenB }, orgA, runId), /ANALYSIS_FENCE_REJECTED/);
    await service.query("rollback");
  } finally { service.release(); }

  const relationshipSeed = await pool.connect();
  try {
    await relationshipSeed.query("begin");
    await beginFence(relationshipSeed, primaryFence, orgA, runId);
    await relationshipSeed.query(`insert into public.aircraft_contract_relationships
      (id,organization_id,aircraft_id,contract_id,relationship_type)
      values ($1,$2,$3,$4,'leased_under')`,
    [managedRelationship, orgA, aircraftId, first.contract_id]);
    await relationshipSeed.query("commit");
  } finally { relationshipSeed.release(); }
  await pool.query(`insert into public.aircraft_contract_relationships
    (id,organization_id,aircraft_id,contract_id,relationship_type)
    values ($1,$2,$3,$4,'leased_under')`,
  [independentRelationship, orgB, aircraftId, otherTenant.contract_id]);

  const blocked = await pool.connect();
  try {
    await blocked.query("begin");
    for (const [sql, args] of [
      ["update public.contracts set title=title where id=$1", [first.contract_id]],
      ["delete from public.contracts where id=$1", [first.contract_id]],
      ["update public.aircraft_contract_relationships set active=false where id=$1", [managedRelationship]],
      ["delete from public.aircraft_contract_relationships where id=$1", [managedRelationship]],
      ["update public.aircraft_contract_relationships set contract_id=$1,organization_id=$2 where id=$3",
        [otherTenant.contract_id, orgB, managedRelationship]],
      ["update public.aircraft_contract_relationships set contract_id=$1,organization_id=$2 where id=$3",
        [first.contract_id, orgA, independentRelationship]],
    ]) {
      await blocked.query("savepoint attempt");
      await assert.rejects(blocked.query(sql, args), /ANALYSIS_FENCE_SHARED_WRITE_BLOCKED/);
      await blocked.query("rollback to savepoint attempt");
    }
    await blocked.query("rollback");
  } finally { blocked.release(); }
  const sharedOwner = await pool.connect();
  try {
    await sharedOwner.query("begin");
    await beginFence(sharedOwner, primaryFence, orgA, runId);
    await sharedOwner.query("update public.contracts set title=title where id=$1", [first.contract_id]);
    await sharedOwner.query("update public.aircraft_contract_relationships set active=active where id=$1", [managedRelationship]);
    await sharedOwner.query(`insert into public.aircraft_contract_relationships
      (organization_id,aircraft_id,contract_id,relationship_type)
      values ($1,$2,$3,'leased_under')
      on conflict (organization_id,aircraft_id,contract_id,relationship_type)
      do update set active=true`,
    [orgA, aircraftId, first.contract_id]);
    await sharedOwner.query("rollback");
  } finally { sharedOwner.release(); }
  assert.equal((await pool.query("update public.contracts set title=title where id=$1", [otherTenant.contract_id])).rowCount, 1);
  assert.equal((await pool.query("update public.aircraft_contract_relationships set active=active where id=$1", [independentRelationship])).rowCount, 1);
  const sharedService = await pool.connect();
  try {
    await sharedService.query("begin");
    await sharedService.query("grant select,update on public.contracts to service_role");
    await sharedService.query("set local role service_role");
    await assert.rejects(sharedService.query("update public.contracts set title=title where id=$1", [first.contract_id]), /ANALYSIS_FENCE_SHARED_WRITE_BLOCKED/);
    await sharedService.query("rollback");
  } finally { sharedService.release(); }
  checks.push("database-issued owner shared contract and aircraft writes pass; stale, wrong-scope, service-role, and unrelated writes are handled");

  const atomic = await pool.connect();
  const rollbackId = id();
  try {
    await atomic.query("begin");
    await beginFence(atomic, primaryFence, orgA, runId);
    await atomic.query(`insert into public.clauses(${scoped},title,category,source_text,confidence)
      values ($1,$2,$3,$4,$5,$6,'Rollback','maintenance','source',1)`, [rollbackId, ...values]);
    await assert.rejects(atomic.query(`insert into public.clauses(${scoped},title,category,source_text,confidence)
      values ($1,$2,$3,$4,$5,$6,'Invalid','invalid-category','source',1)`, [id(), ...values]), { code: "23514" });
    await atomic.query("rollback");
  } finally { atomic.release(); }
  assert.equal((await pool.query("select count(*)::int as n from public.clauses where id=$1", [rollbackId])).rows[0].n, 0);
  const disconnectId = id();
  const disconnected = await pool.connect();
  await disconnected.query("begin");
  await beginFence(disconnected, primaryFence, orgA, runId);
  await disconnected.query(`insert into public.clauses(${scoped},title,category,source_text,confidence)
    values ($1,$2,$3,$4,$5,$6,'Disconnect','maintenance','source',1)`, [disconnectId, ...values]);
  disconnected.release(true);
  assert.equal((await pool.query("select count(*)::int as n from public.clauses where id=$1", [disconnectId])).rows[0].n, 0);
  await analysisRunRepository.updateStatus({
    analysisRunId: runId, organizationId: orgA, status: "indexing", startedAt, fence: primaryFence,
  });
  await analysisRunRepository.updateStatus({
    analysisRunId: runId, organizationId: orgA, status: "completed", startedAt,
    completedAt: new Date().toISOString(), fence: primaryFence,
  });
  await pool.query("alter table public.analysis_write_fences disable trigger guard_analysis_fence_generation");
  await pool.query("update public.analysis_write_fences set expires_at=clock_timestamp()-interval '1 second' where organization_id=$1 and analysis_run_id=$2", [orgA, runId]);
  await pool.query("alter table public.analysis_write_fences enable trigger guard_analysis_fence_generation");
  const expired = await pool.connect();
  try {
    await expired.query("begin");
    await assert.rejects(beginFence(expired, primaryFence, orgA, runId), /ANALYSIS_FENCE_REJECTED/);
    await expired.query("rollback");
    await assert.rejects(pool.query("update public.analysis_write_fences set expires_at=clock_timestamp()+interval '10 minutes' where organization_id=$1 and analysis_run_id=$2", [orgA, runId]), /ANALYSIS_FENCE_TRANSFER_DISABLED/);
  } finally { expired.release(); }
  checks.push("current owner writes ten scoped tables and six evidence links; stale inserts, updates and deletes rejected");
  checks.push("cross-run evidence rejected, service-role bypass rejected, failure and disconnect rollbacks, expired ownership rejected");
  console.log(JSON.stringify({ result: "PASS", checks, limitations: ["PostgreSQL only; Auth and Storage services are stubs"] }));
} finally {
  if (pool) await pool.end();
  if (started) {
    run("pg_ctl.exe", ["stop", "-D", data, "-m", "fast", "-w", "-t", "30"]);
    started = false;
  }
  if (!started) await fs.rm(temp, { recursive: true, force: true });
}
