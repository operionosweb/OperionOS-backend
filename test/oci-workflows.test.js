import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import express from "express";
import { OCI_MODULES, OCI_STAGES } from "../shared/ociContracts.js";
import { createOciService, validateOciData, validateOciStages, calculateOciRevenue } from "../services/ociService.js";
import { createOciRepository } from "../repositories/ociRepository.js";
import { createOciDatabaseConfig, createOciDatabase } from "../repositories/ociDatabase.js";
import { rootCertificates } from "node:tls";

const actor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const account = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherAccount = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const opportunity = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const recordId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const invalid = error => error.status === 400;
const conflict = error => error.status === 409;
test("OCI database transport enforces verified TLS despite URL overrides and accepts approved CA", () => {
  const config = createOciDatabaseConfig({
    DATABASE_URL: "postgresql://user:password@db.example.org:5432/oci?sslmode=disable&ssl=false&sslcert=bad&sslkey=bad&sslrootcert=bad&SSLMode=no-verify&application_name=oci",
    OCI_DATABASE_CA: rootCertificates[0],
  });
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.ca, rootCertificates[0]);
  const url = new URL(config.connectionString);
  assert.equal(url.searchParams.get("application_name"), "oci");
  assert.deepEqual([...url.searchParams.keys()], ["application_name"]);
  const defaults = createOciDatabaseConfig({ DATABASE_URL: "postgres://user:pass@db.example.org/oci" });
  assert.deepEqual(defaults.ssl, { rejectUnauthorized: true });
});
test("OCI database fails explicit invalid or missing config without fallback or credential disclosure", () => {
  for (const env of [{}, { DATABASE_URL: "" }, { DATABASE_URL: "password-secret" }, { DATABASE_URL: "https://user:secret@db.example.org/oci" }, { DATABASE_URL: "postgres://db.example.org" }]) {
    assert.throws(() => createOciDatabaseConfig(env), e => e.status === 503 && e.code.startsWith("OCI_DATABASE_") && !e.message.includes("secret"));
  }
  assert.throws(() => createOciDatabaseConfig({ DATABASE_URL: "postgres://db.example.org/oci", OCI_DATABASE_CA: "not PEM" }), e => e.code === "OCI_DATABASE_INVALID_CA");
});
test("OCI database stays lazy and injected query/pool tests never create live connections", async () => {
  let constructions = 0, supplied, queryArgs;
  class OfflinePool {
    constructor(config) { constructions++; supplied = config; }
    on() {}
    async query(...args) { queryArgs = args; return { rows: [] }; }
    async end() {}
  }
  const database = createOciDatabase({ env: { DATABASE_URL: "postgres://user:secret@db.example.org/oci?sslmode=disable" }, Pool: OfflinePool });
  assert.equal(constructions, 0);
  await database.query("select $1", ["offline"]);
  assert.equal(constructions, 1); assert.equal(supplied.ssl.rejectUnauthorized, true);
  assert.deepEqual(queryArgs, ["select $1", ["offline"]]);
  await database.end();
  const missing = createOciDatabase({ env: {}, Pool: OfflinePool });
  assert.throws(() => missing.query("select 1"), e => e.code === "OCI_DATABASE_NOT_CONFIGURED");
  assert.equal(constructions, 1);
});
function fixture() {
  const records = new Map([
    [account, { id: account, kind: "accounts", status: "active", version: 1, account_id: null, data: { name: "A", classification: "Assumption" } }],
    [otherAccount, { id: otherAccount, kind: "accounts", status: "active", version: 1, account_id: null }],
    [opportunity, { id: opportunity, kind: "opportunities", status: "active", version: 1, account_id: account, data: { name: "O", stage: "Qualified", currency: "EUR" } }],
  ]);
  const events = [];
  let stages = [...OCI_STAGES];
  const repository = {
    async getStages() { return stages; },
    async getRecord(kind, id) { const r = records.get(id); return r?.kind === kind ? r : null; },
    async createRecord(kind, input, actorId) {
      const record = { id: recordId, kind, data: input.data, account_id: input.accountId, opportunity_id: input.opportunityId, status: "active", version: 1, created_by: actorId, updated_by: actorId };
      records.set(record.id, record); events.push({ action: "record.created", actor_id: actorId, metadata: { version: 1 } }); return record;
    },
    async updateRecord(kind, id, input, actorId) {
      const r = records.get(id); if (!r || r.version !== input.version) return null;
      const record = { ...r, data: input.data, account_id: input.accountId, opportunity_id: input.opportunityId, version: r.version + 1, updated_by: actorId };
      records.set(id, record); return record;
    },
    async hasActiveReferences(id) { return [...records.values()].some(r => r.status === "active" && (r.account_id === id || r.opportunity_id === id)); },
    async hasMismatchedOpportunityReferences(id, accountId) { return [...records.values()].some(r => r.status === "active" && r.opportunity_id === id && r.account_id !== accountId); },
    async archiveRecord(kind, id, version, actorId) {
      const r = records.get(id); if (r.version !== version) return null;
      const record = { ...r, version: version + 1, status: "archived", updated_by: actorId }; records.set(id, record); return record;
    },
    async eraseContact(id, version, actorId) {
      const r = records.get(id); if (r.kind !== "contacts" || r.version !== version || r.data?.privacyErased) return null;
      const record = { ...r, data: { name: "Erased contact", privacyErased: true }, status: "archived", version: version + 1, updated_by: actorId };
      records.set(id, record); events.push({ action: "record.privacy_erased", actor_id: actorId, metadata: { version: record.version } }); return record;
    },
    async usedStages() { return [...records.values()].filter(r => r.kind === "opportunities").map(r => r.data.stage); },
    async setStages(value) { stages = value; },
    async listRecords(kind, options) { return { records: [...records.values()].filter(r => r.kind === kind), total: 1, options }; },
    async listAudit(limit) { return events.slice(0, limit); },
    async dashboard() { return { metrics: { targetOrganisations: records.size }, nextActions: [], financials: [], pipeline: [] }; },
  };
  return { records, repository, service: createOciService(repository), events };
}
test("shared schema covers the eight modules with browser-safe fields", () => {
  assert.deepEqual(OCI_MODULES.map(m => m.id), ["accounts", "contacts", "market", "opportunities", "activities", "discovery", "pilots", "revenue"]);
  for (const module of OCI_MODULES) {
    assert.equal(new Set(module.fields.map(f => f.key)).size, module.fields.length);
    assert.ok(module.fields.every(f => ["text", "textarea", "email", "url", "date", "number", "select"].includes(f.type)));
  }
});
test("all module forms validate minimal required fields", () => {
  for (const module of OCI_MODULES) {
    const data = {};
    for (const f of module.fields.filter(f => f.required)) {
      data[f.key] = f.key === "currency" ? "EUR" : f.type === "number" ? 0 : f.type === "select" ? f.options[0] : f.type === "date" ? "2026-10-31" : "Professional evidence";
    }
    if (module.id === "accounts" || module.id === "market") { data.classification = "Assumption"; }
    if (module.id === "discovery") data.validation = "Internal assumption";
    if (module.id === "revenue") data.source = "Financial ledger reference";
    assert.ok(validateOciData(module.id, data));
  }
});
test("unknown kinds, unknown fields, malformed fields and unsafe URLs fail closed", () => {
  for (const [kind, data] of [
    ["customers", {}], ["accounts", { name: "A", classification: "Assumption", password: "secret" }],
    ["accounts", { name: "A", classification: "Assumption", website: "javascript:alert(1)" }],
    ["accounts", { name: "A", classification: "Assumption", website: "https://user:password@example.org" }],
    ["opportunities", { name: "O", stage: "Qualified", currency: "EUR", value: -1 }],
    ["opportunities", { name: "O", stage: "Qualified", currency: "EUR", value: Infinity }],
    ["opportunities", { name: "O", stage: "Qualified", currency: "EUR", expectedCloseDate: "2026-02-30" }],
    ["opportunities", { name: "O", stage: "Qualified", currency: "ZZZ" }],
    ["market", { title: "x".repeat(241), classification: "Assumption" }],
  ]) assert.throws(() => validateOciData(kind, data), invalid);
});
test("evidence, GDPR contact fields, capability and probability assumptions are mandatory", () => {
  assert.throws(() => validateOciData("accounts", { name: "A", classification: "Verified fact" }), invalid);
  assert.throws(() => validateOciData("accounts", { name: "A", classification: "Assumption", companySize: 100 }), invalid);
  assert.throws(() => validateOciData("contacts", { name: "N", email: "n@example.org" }), invalid);
  assert.throws(() => validateOciData("opportunities", { name: "O", stage: "Qualified", currency: "EUR", probability: 50 }), invalid);
  assert.throws(() => validateOciData("pilots", { name: "P", offerType: "Pilot", pilotStatus: "Draft", currency: "EUR" }), invalid);
  assert.throws(() => validateOciData("discovery", { title: "D", validation: "Customer-validated" }), invalid);
  assert.throws(() => validateOciData("revenue", { name: "R", basis: "Forecast", revenueType: "Pilot", currency: "EUR" }), invalid);
  assert.throws(() => validateOciData("revenue", { name: "R", basis: "Actual", revenueType: "Pilot", currency: "EUR" }), invalid);
});
test("CRUD records preserve relationship links, replace data, enforce versions and archive", async () => {
  const { service, records, events } = fixture();
  const created = await service.createRecord("activities", { accountId: account, opportunityId: opportunity, data: { title: "Call", type: "Call", activityStatus: "Planned", outcome: "Old" } }, actor);
  assert.equal(created.account_id, account);
  assert.equal(events[0].actor_id, actor);
  assert.deepEqual(events[0].metadata, { version: 1 });
  const updated = await service.updateRecord("activities", created.id, { version: 1, data: { title: "New call", type: "Call", activityStatus: "Completed" } }, actor);
  assert.equal(updated.account_id, account); assert.equal(updated.opportunity_id, opportunity);
  assert.equal(updated.data.outcome, undefined); assert.equal(updated.version, 2);
  await assert.rejects(service.updateRecord("activities", created.id, { version: 1, data: updated.data }, actor), conflict);
  const archived = await service.archiveRecord("activities", created.id, { version: 2 }, actor);
  assert.equal(archived.status, "archived"); assert.equal(records.has(created.id), true);
  await assert.rejects(service.archiveRecord("activities", created.id, { version: 3 }, actor), conflict);
});
test("missing, archived, wrong kind and cross-account links are rejected", async () => {
  const { service, records } = fixture();
  const data = { title: "Call", type: "Call", activityStatus: "Planned" };
  for (const input of [
    { data }, { data, accountId: opportunity },
    { data, accountId: otherAccount, opportunityId: opportunity },
    { data, accountId: account, opportunityId: actor },
  ]) await assert.rejects(service.createRecord("activities", input, actor), invalid);
  records.get(account).status = "archived";
  await assert.rejects(service.createRecord("activities", { data, accountId: account }, actor), invalid);
});
test("archive referenced parent and moving referenced opportunity to another account are rejected", async () => {
  const { service } = fixture();
  await assert.rejects(service.archiveRecord("accounts", account, { version: 1 }, actor), conflict);
  await service.createRecord("activities", { data: { title: "Call", type: "Call", activityStatus: "Planned" }, accountId: account, opportunityId: opportunity }, actor);
  await assert.rejects(service.archiveRecord("opportunities", opportunity, { version: 1 }, actor), conflict);
  await assert.rejects(service.updateRecord("opportunities", opportunity, { data: { name: "O", stage: "Qualified", currency: "EUR" }, accountId: otherAccount, version: 1 }, actor), conflict);
});
test("late repository version conflicts are surfaced and mutation actor/body validated", async () => {
  const { service, repository } = fixture();
  repository.updateRecord = async () => null;
  await assert.rejects(service.updateRecord("accounts", account, { data: { name: "A", classification: "Assumption" }, version: 1 }, actor), conflict);
  await assert.rejects(service.createRecord("accounts", { data: { name: "A", classification: "Assumption" }, role: "admin" }, actor), invalid);
  await assert.rejects(service.createRecord("accounts", { data: { name: "A", classification: "Assumption" } }, "bad-actor"), invalid);
  await assert.rejects(service.archiveRecord("accounts", account, {}, actor), invalid);
});
test("authorized erasure minimises active and archived contacts without changing provenance or links", async () => {
  for (const status of ["active", "archived"]) {
    const { service, records, events } = fixture();
    const current = { id: recordId, kind: "contacts", status, version: 3, account_id: account, opportunity_id: opportunity,
      created_by: actor, created_at: "2026-10-01", data: { name: "Person", email: "person@example.org", notes: "Private professional notes" } };
    records.set(recordId, current);
    const erased = await service.eraseContact(recordId, { version: 3 }, actor);
    assert.deepEqual(erased.data, { name: "Erased contact", privacyErased: true });
    assert.equal(erased.status, "archived"); assert.equal(erased.version, 4);
    for (const key of ["account_id", "opportunity_id", "created_by", "created_at"]) assert.equal(erased[key], current[key]);
    assert.deepEqual(events.at(-1), { action: "record.privacy_erased", actor_id: actor, metadata: { version: 4 } });
    await assert.rejects(service.eraseContact(recordId, { version: 4 }, actor), conflict);
  }
});
test("erasure rejects wrong-kind identities, bad or stale versions, extra fields and failed audits", async () => {
  const { service, repository, records } = fixture();
  await assert.rejects(service.eraseContact(account, { version: 1 }, actor), e => e.status === 404);
  await assert.rejects(service.eraseContact(recordId, {}, actor), invalid);
  await assert.rejects(service.eraseContact(recordId, { version: 1, data: {} }, actor), invalid);
  records.set(recordId, { id: recordId, kind: "contacts", status: "archived", version: 2, data: { name: "Private" } });
  await assert.rejects(service.eraseContact(recordId, { version: 1 }, actor), conflict);
  const failure = new Error("Audit storage unavailable");
  repository.eraseContact = createOciRepository(async () => { throw failure; }).eraseContact;
  await assert.rejects(service.eraseContact(recordId, { version: 2 }, actor), e => e === failure);
  assert.deepEqual(records.get(recordId).data, { name: "Private" });
  assert.throws(() => validateOciData("contacts", { name: "Erased contact", privacyErased: true }), invalid);
});
test("repository erasure uses fixed data, optimistic version and contact-only atomic audited UPDATE", async () => {
  let captured;
  const repo = createOciRepository(async (sql, params) => { captured = { sql, params }; return { rows: [] }; });
  await repo.eraseContact(recordId, 4, actor);
  assert.match(captured.sql, /data='\{"name":"Erased contact","privacyErased":true\}'::jsonb/);
  assert.match(captured.sql, /where kind='contacts' and id=\$1 and version=\$2/);
  assert.doesNotMatch(captured.sql, /set[^;]*(account_id=|opportunity_id=|created_by=)/);
  assert.deepEqual(captured.params, [recordId, 4, actor]);
});
test("list and audit queries are bounded, reject injection options and handle Express query objects", async () => {
  const { service } = fixture();
  const query = Object.assign(Object.create(null), { page: "2", pageSize: "10", status: "all", sort: "name_desc" });
  assert.equal((await service.listRecords("accounts", query)).options.page, 2);
  for (const q of [{ page: "0" }, { pageSize: "101" }, { page: "1.5" }, { sort: "id;delete" }, { status: "private" }, { search: ["bad"] }, { search: "x".repeat(201) }, { extra: "1" }])
    await assert.rejects(service.listRecords("accounts", q), invalid);
  await assert.rejects(service.audit({ limit: "101" }), invalid);
});
test("configurable stages are safe and active or archived opportunity stages cannot be removed", async () => {
  const { service, records } = fixture();
  for (const stages of [[], ["Won", "won", "Lost"], ["Won", "Lost", " "], ["Won", "Lost", "bad\n"], ["Won", "Lost", "x".repeat(61)]])
    assert.throws(() => validateOciStages(stages), invalid);
  await assert.rejects(service.setStages({ stages: ["Won", "Lost"] }, actor), invalid);
  records.get(opportunity).status = "archived";
  await assert.rejects(service.setStages({ stages: ["Won", "Lost"] }, actor), invalid);
  const stages = await service.setStages({ stages: ["Qualified", "Custom", "Won", "Lost"] }, actor);
  assert.ok(validateOciData("opportunities", { name: "O", stage: "Custom", currency: "eur" }, stages));
  assert.deepEqual(await service.getStages(), stages);
});
test("financial arithmetic never mixes currencies or actual and forecast bases", () => {
  const result = calculateOciRevenue([
    { currency: "EUR", basis: "Actual", amount: "100", costComplete: true, hasEstimatedCosts: true, pilotRevenue: "100", deliveryCost: "20", infrastructureCost: "10", aiProcessingCost: "5", storageCost: "5" },
    { currency: "USD", basis: "Actual", amount: "200", subscriptionRevenue: "200", mrr: "200", arr: "2400" },
    { currency: "EUR", basis: "Forecast", amount: "0", deliveryCost: "20" },
  ]);
  assert.equal(result[0].grossMargin, 60); assert.equal(result[0].grossMarginPercent, 60);
  assert.equal(result[0].marginBasis, "Estimated");
  assert.equal(result[1].amount, 200); assert.equal(result[1].arr, 2400);
  assert.equal(result[1].cost, null); assert.equal(result[1].grossMargin, null);
  assert.equal(result[1].costComplete, false); assert.equal(result[1].marginBasis, "Unknown");
  assert.equal(result[2].grossMarginPercent, null);
  assert.equal(result.length, 3); assert.equal(Object.hasOwn(result, "total"), false);
});
test("revenue requires explicit period amount and assessed costs require complete evidence", () => {
  const base = { name: "R", basis: "Actual", revenueType: "Pilot", currency: "EUR", source: "Ledger", costBasis: "Unassessed", periodDate: "2026-10-01" };
  assert.throws(() => validateOciData("revenue", base), invalid);
  assert.equal(validateOciData("revenue", { ...base, amount: 0 }).amount, 0);
  assert.throws(() => validateOciData("revenue", { ...base, amount: 100, costBasis: "Recorded" }), invalid);
  const costs = { deliveryCost: 0, infrastructureCost: 0, aiProcessingCost: 0, storageCost: 0 };
  assert.ok(validateOciData("revenue", { ...base, ...costs, amount: 100, costBasis: "Recorded" }));
  assert.throws(() => validateOciData("revenue", { ...base, ...costs, amount: 100, costBasis: "Estimated" }), invalid);
  assert.ok(validateOciData("revenue", { ...base, ...costs, amount: 100, costBasis: "Estimated", assumptions: "Manual cost estimate" }));
  const unknown = calculateOciRevenue([{ currency: "EUR", basis: "Actual", amountComplete: false, costComplete: false }])[0];
  assert.equal(unknown.amount, null); assert.equal(unknown.grossMargin, null);
  const recorded = calculateOciRevenue([{ currency: "EUR", basis: "Actual", amount: "100", costComplete: true, hasEstimatedCosts: false }])[0];
  assert.equal(recorded.marginBasis, "Recorded"); assert.equal(recorded.grossMarginPercent, 100);
});
test("recurring revenue periods stay separate and absent ancillary metrics remain unknown", () => {
  const result = calculateOciRevenue([
    { currency: "EUR", basis: "Actual", periodDate: "2026-10-01", amount: "100", mrr: "100", arr: "1200" },
    { currency: "EUR", basis: "Actual", periodDate: "2026-11-01", amount: "100", mrr: "100", arr: "1200" },
    { currency: "USD", basis: "Forecast", periodDate: "2026-11-01", amount: "50", acquisitionCost: "0" },
  ]);
  assert.equal(result[0].periodDate, "2026-10-01"); assert.equal(result[1].periodDate, "2026-11-01");
  assert.equal(result[0].mrr, 100); assert.equal(result[1].mrr, 100);
  assert.equal(result[0].arr, 1200); assert.equal(result[1].arr, 1200);
  for (const key of ["mrr", "arr", "annualContractValue", "lifetimeValue"]) assert.equal(result[2][key], null);
  assert.equal(result[2].acquisitionCost, 0);
  assert.equal(result[0].acquisitionCost, null);
  assert.throws(() => validateOciData("revenue", { name: "R", basis: "Actual", revenueType: "Pilot", currency: "EUR", amount: 0, source: "Ledger", costBasis: "Unassessed" }), invalid);
});
test("dashboard transforms only persisted aggregate inputs, including manual weighted pipeline", async () => {
  const { service, repository } = fixture();
  repository.dashboard = async () => ({ metrics: { activeOpportunities: 0 }, nextActions: [], financials: [], pipeline: [{ currency: "EUR", value: "1000", weightedValue: "250" }] });
  const result = await service.dashboard();
  assert.deepEqual(result.metrics, { activeOpportunities: 0 });
  assert.deepEqual(result.revenueSummary, { financials: [], pipeline: [{ currency: "EUR", value: 1000, weightedValue: 250 }] });
});
test("repository parameterizes all user values and allowlists sort", async () => {
  const calls = [];
  const repo = createOciRepository(async (sql, params) => { calls.push({ sql, params }); return { rows: [{ records: [], total: 0 }] }; });
  await repo.listRecords("accounts", { search: "'; DROP TABLE%_", status: "all", sort: "name_asc", page: 2, pageSize: 5 });
  assert.equal(calls[0].sql.includes("DROP TABLE"), false);
  assert.equal(calls[0].params[2], "%'; DROP TABLE\\%\\_%");
  assert.equal(calls[0].params[4], 5);
  assert.match(calls[0].sql, /jsonb_agg\(selected order by coalesce\(data->>'name',data->>'title',''\) asc,id\)/);
  await assert.rejects(repo.listRecords("accounts", { search: "", status: "active", sort: "name;drop", page: 1, pageSize: 5 }), TypeError);
  await repo.updateRecord("accounts", account, { data: { name: "A" }, accountId: null, opportunityId: null, version: 4 }, actor);
  assert.match(calls[1].sql, /version=\$6 and status='active'/);
  assert.equal(calls[1].params[5], 4);
});
test("repository propagates audit failures and maps authoritative integrity conflicts", async () => {
  const failure = new Error("Audit storage unavailable");
  const repo = createOciRepository(async () => { throw failure; });
  await assert.rejects(repo.createRecord("accounts", { data: {}, accountId: null, opportunityId: null }, actor), e => e === failure);
  const conflicting = createOciRepository(async () => { throw Object.assign(new Error("details"), { code: "23514" }); });
  await assert.rejects(conflicting.archiveRecord("accounts", account, 1, actor), e => e.status === 409 && !e.message.includes("details"));
});
test("missing persisted stage configuration fails explicitly without a default success", async () => {
  for (const setting of [undefined, { value: null }, { value: {} }]) {
    const repo = createOciRepository(async () => ({ rows: setting ? [setting] : [] }));
    await assert.rejects(repo.getStages(), e => e.status === 503 && e.code === "OCI_SETTINGS_UNAVAILABLE");
    await assert.rejects(createOciService(repo).schema(), e => e.code === "OCI_SETTINGS_UNAVAILABLE");
  }
  const repo = createOciRepository(async () => ({ rows: [{ value: ["Custom", "Won", "Lost"] }] }));
  assert.deepEqual(await repo.getStages(), ["Custom", "Won", "Lost"]);
});
test("duplicate active account/contact identities map database uniqueness errors to safe conflicts", async () => {
  const repo = createOciRepository(async () => { throw Object.assign(new Error("private email"), { code: "23505" }); });
  for (const kind of ["accounts", "contacts"]) {
    await assert.rejects(repo.createRecord(kind, { data: {}, accountId: account, opportunityId: null }, actor),
      e => e.status === 409 && e.code === "OCI_DUPLICATE_CONFLICT" && !e.message.includes("private email"));
    await assert.rejects(repo.updateRecord(kind, recordId, { data: {}, accountId: account, opportunityId: null, version: 1 }, actor),
      e => e.status === 409 && e.code === "OCI_DUPLICATE_CONFLICT");
  }
});
test("migration has isolated tables, RLS, serialized reference checks and transactional privacy-safe audit", async () => {
  const sql = await readFile(new URL("../supabase/migrations/022_oci_foundation.sql", import.meta.url), "utf8");
  for (const table of ["oci_records", "oci_settings", "oci_user_roles", "oci_audit_events"])
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(sql, /from public,anon,authenticated/);
  assert.match(sql, /for each statement execute function public\.oci_lock_mutation/);
  assert.match(sql, /parent\.kind<>'accounts'/);
  assert.match(sql, /parent\.account_id is distinct from new\.account_id/);
  assert.match(sql, /Active OCI records reference this parent/);
  assert.match(sql, /oci_records_audit after insert or update/);
  assert.match(sql, /record\.privacy_erased/);
  assert.match(sql, /old\.status='archived' and not privacy_erasure/);
  assert.match(sql, /new\.account_id is not distinct from old\.account_id/);
  assert.match(sql, /new\.opportunity_id is not distinct from old\.opportunity_id/);
  assert.match(sql, /Privacy marker cannot be created through ordinary CRUD/);
  assert.doesNotMatch(sql, /current_setting\('oci\.privacy|set_config.*privacy/);
  assert.match(sql, /oci_user_roles_audit after insert or update or delete/);
  assert.match(sql, /current_setting\('oci\.actor_id',true\)/);
  assert.match(sql, /kind='opportunities' and not\(new\.value/);
  assert.match(sql, /create unique index oci_accounts_active_identity_idx/);
  assert.match(sql, /create unique index oci_contacts_active_email_idx/);
  assert.match(sql, /lower\(btrim\(data->>'name'\)\),lower\(btrim\(coalesce\(data->>'country',''\)\)\)/);
  assert.match(sql, /where kind='contacts' and status='active' and nullif/);
  const recordDefinition = sql.split("create table public.oci_records (")[1].split("create index")[0];
  assert.match(recordDefinition, /created_by uuid,\s+updated_by uuid/);
  assert.doesNotMatch(recordDefinition, /references auth\.users/);
  assert.match(sql, /jsonb_build_object\('version',new\.version\)/);
  assert.doesNotMatch(sql, /jsonb_build_object\([^;]*new\.data/s);
  assert.doesNotMatch(sql, /security definer|@operionos|insert into public\.oci_user_roles/i);
});
test("repository dashboard uses grouped actual/forecast currencies and bounded actions", async () => {
  let captured;
  const repo = createOciRepository(async sql => { captured = sql; return { rows: [{}] }; });
  await repo.dashboard();
  assert.match(captured, /group by data->>'currency',data->>'basis',data->>'periodDate'/);
  assert.match(captured, /data->>'periodDate' as "periodDate"/);
  for (const key of ["mrr", "arr", "annualContractValue", "acquisitionCost", "lifetimeValue"]) {
    assert.ok(captured.includes(`sum((data->>'${key}')::numeric) as "${key}"`));
    assert.ok(!captured.includes(`sum(coalesce((data->>'${key}')::numeric,0))`));
  }
  assert.match(captured, /as "costComplete"/);
  assert.match(captured, /as "hasEstimatedCosts"/);
  assert.match(captured, /actions as \(select \* from active where \(kind<>'activities' or data->>'activityStatus'='Planned'\)/);
  assert.match(captured, /'upcomingActivities'.*data->>'dueDate'>=current_date::text/);
  assert.match(captured, /'overdueActivities'.*data->>'dueDate'<current_date::text/);
  assert.match(captured, /probability'\)::numeric,0\)\/100/);
  assert.match(captured, /limit 25/);
  assert.match(captured, /status='active'/);
});
test("router requires injectable authorization and completes CRUD/error responses offline", async () => {
  // Keep provider configuration empty; all database operations below are injected.
  process.env.DATABASE_URL = ""; process.env.SUPABASE_URL = ""; process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  const { createOciRouter } = await import("../routes/ociRoutes.js");
  const { service, repository } = fixture();
  const app = express(); app.use(express.json());
  app.use("/api/oci", createOciRouter(service, (req, res, next) => {
    if (req.headers.authorization !== "Bearer offline") return res.status(403).json({ success: false });
    req.user = { id: actor }; next();
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/oci`;
    const headers = { authorization: "Bearer offline", "content-type": "application/json" };
    assert.equal((await fetch(`${url}/schema`)).status, 403);
    assert.equal((await (await fetch(`${url}/schema`, { headers })).json()).modules.length, 8);
    assert.equal((await fetch(`${url}/records/not-a-kind`, { headers })).status, 400);
    const created = await fetch(`${url}/records/activities`, { method: "POST", headers, body: JSON.stringify({ accountId: account, data: { title: "Call", type: "Call", activityStatus: "Planned" } }) });
    assert.equal(created.status, 201); const record = (await created.json()).record;
    const patched = await fetch(`${url}/records/activities/${record.id}`, { method: "PATCH", headers, body: JSON.stringify({ version: 1, data: { title: "Call", type: "Call", activityStatus: "Completed" } }) });
    assert.equal(patched.status, 200);
    const archived = await fetch(`${url}/records/activities/${record.id}`, { method: "DELETE", headers, body: JSON.stringify({ version: 2 }) });
    assert.equal((await archived.json()).record.status, "archived");
    assert.equal((await fetch(`${url}/records/accounts?pageSize=101`, { headers })).status, 400);
    assert.ok((await (await fetch(`${url}/dashboard`, { headers })).json()).revenueSummary);
    assert.equal((await (await fetch(`${url}/audit?limit=1`, { headers })).json()).events.length, 1);
    assert.equal((await fetch(`${url}/settings/stages`, { method: "PUT", headers, body: JSON.stringify({ stages: ["Qualified", "Won", "Lost"] }) })).status, 200);
    repository.getStages = createOciRepository(async () => ({ rows: [] })).getStages;
    const missingConfig = await fetch(`${url}/schema`, { headers });
    assert.equal(missingConfig.status, 503);
    assert.deepEqual(await missingConfig.json(), { success: false, code: "OCI_SETTINGS_UNAVAILABLE", error: "OCI persisted stage configuration is unavailable" });
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test("real OCI authorization protects every business route against anonymous, ordinary and forged metadata sessions", async () => {
  process.env.DATABASE_URL = ""; process.env.SUPABASE_URL = ""; process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  const [{ createOciRouter }, { createOciAccessMiddleware }] = await Promise.all([
    import("../routes/ociRoutes.js"), import("../middleware/ociAccessMiddleware.js"),
  ]);
  const audits = [];
  const authorization = createOciAccessMiddleware({
    async verify(token) {
      if (token === "ordinary") return { id: otherAccount, mfaVerified: true };
      if (token === "forged") return { id: otherAccount, mfaVerified: true, user_metadata: { role: "super_admin" }, role: "SUPERADMIN" };
      if (token === "aal1") return { id: actor, mfaVerified: false };
      return { id: actor, mfaVerified: true };
    },
    async queryFn(sql, params) {
      assert.match(sql, /join public\.platform_user_roles/);
      assert.match(sql, /platform\.role = 'SUPERADMIN'/);
      return { rows: params[0] === actor ? [{ user_id: actor }] : [] };
    },
    async audit(actorId, action) { audits.push({ actorId, action }); },
  });
  const { service } = fixture();
  const app = express(); app.use(express.json()); app.use("/api/oci", createOciRouter(service, authorization));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const routes = [
    ["GET", "/schema"], ["GET", "/dashboard"], ["GET", "/records/accounts"],
    ["POST", "/records/accounts", { data: { name: "A", classification: "Assumption" } }],
    ["PATCH", `/records/accounts/${account}`, { data: { name: "A", classification: "Assumption" }, version: 1 }],
    ["DELETE", `/records/accounts/${account}`, { version: 1 }],
    ["POST", `/records/contacts/${recordId}/erase`, { version: 1 }],
    ["GET", "/audit"], ["GET", "/settings/stages"],
    ["PUT", "/settings/stages", { stages: ["Qualified", "Won", "Lost"] }],
  ];
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/oci`;
    for (const token of [null, "ordinary", "forged", "aal1"]) {
      for (const [method, path, body] of routes) {
        const headers = { "content-type": "application/json" };
        if (token) headers.authorization = `Bearer ${token}`;
        const response = await fetch(`${url}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
        assert.equal(response.status, token ? 403 : 401, `${token ?? "anonymous"} ${method} ${path}`);
        assert.equal(response.headers.get("cache-control"), "private, no-store");
        const result = await response.json();
        assert.equal(result.success, false);
        assert.equal(result.record, undefined); assert.equal(result.records, undefined);
        assert.equal(result.code, token === "aal1" ? "OCI_MFA_REQUIRED" : token ? "OCI_ACCESS_DENIED" : "OCI_AUTH_REQUIRED");
      }
    }
    assert.equal(audits.length, routes.length * 4);
    assert.equal(audits.filter(event => event.action === "MFA_REQUIRED").length, routes.length);
    const allowed = await fetch(`${url}/schema`, { headers: { authorization: "Bearer assigned" } });
    assert.equal(allowed.status, 200);
    assert.equal(audits.at(-1).action, "ACCESS_GRANTED");
  } finally { await new Promise(resolve => server.close(resolve)); }
});
