import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import express from "express";
import { OCI_MODULES, OCI_STAGES } from "../shared/ociContracts.js";
import { scoreOciAccountFit, OCI_ACCOUNT_FIT_CRITERIA } from "../shared/ociAccountFit.js";
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
const ociProjectRef = "abcdefghijklmnopqrst";
const ociDatabaseEnv = databaseUrl => ({
  OCI_DATABASE_TARGET: "dedicated-oci",
  OCI_SUPABASE_PROJECT_REF: ociProjectRef,
  OCI_DATABASE_URL: databaseUrl || `postgresql://postgres:offline@db.${ociProjectRef}.supabase.co:5432/oci`,
});
test("OCI database transport enforces verified TLS despite URL overrides and accepts approved CA", () => {
  const config = createOciDatabaseConfig({
    ...ociDatabaseEnv(`postgresql://postgres:offline@db.${ociProjectRef}.supabase.co:5432/oci?sslmode=disable&ssl=false&sslcert=bad&sslkey=bad&sslrootcert=bad&SSLMode=no-verify&application_name=oci`),
    OCI_DATABASE_CA: rootCertificates[0],
  });
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.ca, rootCertificates[0]);
  const url = new URL(config.connectionString);
  assert.equal(url.searchParams.get("application_name"), "oci");
  assert.deepEqual([...url.searchParams.keys()], ["application_name"]);
  const defaults = createOciDatabaseConfig(ociDatabaseEnv());
  assert.deepEqual(defaults.ssl, { rejectUnauthorized: true });
});
test("OCI database fails explicit invalid or missing config without fallback or credential disclosure", () => {
  for (const env of [
    {},
    { ...ociDatabaseEnv(), OCI_DATABASE_URL: "" },
    { ...ociDatabaseEnv(), OCI_DATABASE_URL: "password-secret" },
    { ...ociDatabaseEnv(), OCI_DATABASE_URL: "postgres://db.example.org/oci" },
    { ...ociDatabaseEnv(), OCI_DATABASE_URL: "postgres://postgres:offline@db.otherprojectref12345.supabase.co/oci" },
    { DATABASE_URL: "postgres://postgres:offline@db.example.org/oci" },
  ]) {
    assert.throws(() => createOciDatabaseConfig(env), error => error.status === 503 && error.code.startsWith("OCI_DATABASE_") && !error.message.includes("secret"));
  }
  assert.throws(() => createOciDatabaseConfig({ ...ociDatabaseEnv(), OCI_DATABASE_CA: "not PEM" }), error => error.code === "OCI_DATABASE_INVALID_CA");
});
test("OCI database stays lazy and injected query/pool tests never create live connections", async () => {
  let constructions = 0, supplied, queryArgs;
  class OfflinePool {
    constructor(config) { constructions++; supplied = config; }
    on() {}
    async query(...args) { queryArgs = args; return { rows: [] }; }
    async end() {}
  }
  const database = createOciDatabase({
    env: ociDatabaseEnv(`postgres://postgres:offline@db.${ociProjectRef}.supabase.co/oci?sslmode=disable`),
    Pool: OfflinePool,
  });
  assert.equal(constructions, 0);
  await database.query("select $1", ["offline"]);
  assert.equal(constructions, 1); assert.equal(supplied.ssl.rejectUnauthorized, true);
  assert.deepEqual(queryArgs, ["select $1", ["offline"]]);
  await database.end();
  const missing = createOciDatabase({ env: {}, Pool: OfflinePool });
  assert.throws(() => missing.query("select 1"), error => error.code === "OCI_DATABASE_INVALID_TARGET");
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
      if (input.data.recommendationId && [...records.values()].some(r =>
        r.kind === "activities" && r.data.recommendationId === input.data.recommendationId)) return null;
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
    async geographyOptions() { return { options: [], truncated: false }; },
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
test("commercial opportunity progression preserves explicit stage evidence and outcome reasons", () => {
  for (const stage of ["Target identified", "Research completed", "Initial contact", "Discovery scheduled",
    "Discovery completed", "Qualified", "Product demonstration", "Pilot proposed", "Commercial negotiation",
    "On hold", "Won", "Lost"]) assert.ok(OCI_STAGES.includes(stage));
  assert.throws(() => validateOciData("opportunities", {
    name: "Qualified prospect", stage: "Qualified", currency: "EUR",
  }), invalid, "a new record beyond identified requires a human rationale");
  assert.throws(() => validateOciData("opportunities", {
    name: "Won prospect", stage: "Won", currency: "EUR", stageChangeEvidence: "Customer accepted",
  }), invalid, "a new Won record requires commercial source evidence");
  assert.throws(() => validateOciData("opportunities", {
    name: "Lost prospect", stage: "Lost", currency: "EUR",
    stageChangeEvidence: "Founder decision",
  }), invalid, "Lost requires a loss reason");
  assert.throws(() => validateOciData("opportunities", {
    name: "Paused prospect", stage: "On hold", currency: "EUR",
    stageChangeEvidence: "Decision paused",
  }), invalid, "On hold requires a reason");
  const current = { name: "Existing", stage: "Qualified", currency: "EUR", stageChangeEvidence: "Initial qualification" };
  assert.throws(() => validateOciData("opportunities", {
    name: "Existing", stage: "Product demonstration", currency: "EUR",
  }, OCI_STAGES, current), invalid);
  const advanced = validateOciData("opportunities", {
    name: "Existing", stage: "Product demonstration", currency: "EUR",
    stageChangeEvidence: "Discovery notes support a demonstration; internal decision 2026-10-31.",
    opportunityOwner: "Founder", expectedDecisionDate: "2027-01-15",
    lastInteraction: "2026-10-31", sourceEvidence: "Discovery record reference",
  }, OCI_STAGES, current);
  assert.equal(advanced.stage, "Product demonstration");
  assert.equal(advanced.opportunityOwner, "Founder");
  assert.throws(() => validateOciData("opportunities", {
    name: "Won prospect", stage: "Won", currency: "EUR", stageChangeEvidence: "Customer accepted",
  }), invalid);
  assert.doesNotThrow(() => validateOciData("opportunities", {
    name: "Won prospect", stage: "Won", currency: "EUR",
    stageChangeEvidence: "Signed proposal reference", sourceEvidence: "Signed agreement reference",
  }));
});
test("stakeholder role records separate sourced people from account-level hypotheses", () => {
  const accountData = {
    name: "European airline", classification: "Research finding", researchStatus: "Researched",
    source: "Public annual report", researchDate: "2026-10-31",
    stakeholderDepartment: "Procurement", stakeholderStatus: "Hypothesised buying role",
    stakeholderEvidence: "Hypothesis based on published tender process; no individual identified.",
  };
  assert.equal(validateOciData("accounts", accountData).stakeholderStatus, "Hypothesised buying role");
  assert.throws(() => validateOciData("accounts", {
    ...accountData, stakeholderStatus: "Publicly identified person", source: "", researchDate: "",
  }), invalid);
  const publicContact = {
    name: "Synthetic test person", jobTitle: "Procurement Director", source: "Public company page",
    lawfulBasis: "Legitimate interests", lawfulBasisDetails: "Business-only public professional information",
    retentionReviewDate: "2027-10-31", identityStatus: "Publicly identified person",
    decisionDepartment: "Procurement",
  };
  assert.equal(validateOciData("contacts", publicContact).identityStatus, "Publicly identified person");
  assert.throws(() => validateOciData("contacts", {
    ...publicContact, identityStatus: "Verified contact", relationshipStatus: "Identified",
  }), invalid);
  assert.doesNotThrow(() => validateOciData("contacts", {
    ...publicContact, identityStatus: "Verified contact", relationshipStatus: "Contacted",
  }));
});
test("pilot proposals require measurable current-capability scope, approvals and evidenced customer decisions", () => {
  const draft = {
    name: "Contract review pilot", offerType: "Pilot", currency: "EUR",
    pilotStatus: "Draft", capabilityVerification: "Manual review confirms current Contract Intelligence capabilities.",
  };
  assert.doesNotThrow(() => validateOciData("pilots", draft));
  const offer = {
    ...draft, pilotStatus: "Proposed", proposalStatus: "Draft",
    customerProblem: "Validated contract review bottleneck", contractUseCase: "Extract and review renewal clauses",
    scope: "Review a customer-supplied sample portfolio", documentCount: 20,
    documentAssumptions: "Synthetic test portfolio count supplied for the test only",
    deliverables: "Reviewed results and issue register", durationDays: 30, price: 5000,
    successCriteria: "Review 20 contracts; customer approves accuracy and delivery time",
    priceEvidence: "Manual proposed price basis; not customer commitment",
  };
  assert.doesNotThrow(() => validateOciData("pilots", offer));
  assert.throws(() => validateOciData("pilots", { ...offer, proposalStatus: "Awaiting customer" }), invalid);
  const approved = {
    ...offer, proposalStatus: "Awaiting customer", approvalStatus: "Approved",
    approvalEvidence: "Synthetic internal approval record",
  };
  assert.doesNotThrow(() => validateOciData("pilots", approved));
  assert.throws(() => validateOciData("pilots", {
    ...approved, proposalStatus: "Accepted", pilotStatus: "Active",
  }), invalid);
  assert.doesNotThrow(() => validateOciData("pilots", {
    ...approved, proposalStatus: "Accepted", pilotStatus: "Active",
    customerDecisionEvidence: "Synthetic test: approved proposal reference",
  }));
});
test("account-fit rubric is weighted, evidence-gated, uncertainty-labelled and never qualifies an account", () => {
  const criteria = OCI_ACCOUNT_FIT_CRITERIA;
  assert.equal(scoreOciAccountFit({}).score, null);
  const partialWithoutEvidence = { [criteria[0].key]: "Verified — High", [criteria[1].key]: "Hypothesis — Medium" };
  assert.equal(scoreOciAccountFit(partialWithoutEvidence).score, null);
  const fitData = {
    ...partialWithoutEvidence, fitEvidence: "Contract complexity: source A; volume: hypothesis from public fleet report.",
    [criteria[2].key]: "Unknown",
  };
  const score = scoreOciAccountFit(fitData);
  assert.equal(score.assessed, 2);
  assert.equal(score.unknown, criteria.length - 2);
  assert.equal(score.verified, 1);
  assert.equal(score.hypotheses, 1);
  assert.equal(score.score, null, "partial evidence cannot produce a score");
  fitData[criteria[2].key] = "Hypothesis — Low";
  const scored = scoreOciAccountFit(fitData);
  assert.equal(scored.assessed, 3);
  assert.ok(scored.score > 0 && scored.score < 100);
  const module = OCI_MODULES.find(item => item.id === "accounts");
  assert.ok(module.fields.some(field => field.key === "researchStatus"));
  assert.ok(module.fields.some(field => field.key === "fleetPortfolio"));
  assert.ok(module.fields.some(field => field.key === "contractUseCases"));
  const account = { name: "Aviation target", country: "Spain", classification: "Assumption",
    [criteria[0].key]: "Verified — High" };
  assert.throws(() => validateOciData("accounts", account), invalid);
  assert.throws(() => validateOciData("accounts", { ...account, fitEvidence: "Criterion source" }), invalid);
  const verified = validateOciData("accounts", {
    ...account, source: "Public annual report", researchDate: "2026-10-31",
    fitEvidence: "Contract complexity: annual report URL; manually reviewed.",
  });
  assert.equal(verified[criteria[0].key], "Verified — High");
  assert.equal(verified.accountStatus, undefined);
  assert.throws(() => validateOciData("accounts", {
    name: "Uncited account research", classification: "Research finding", researchStatus: "Researched",
  }), invalid);
  assert.throws(() => validateOciData("market", {
    title: "Uncited market research", classification: "Research finding", researchStatus: "Researched",
  }), invalid);
  assert.doesNotThrow(() => validateOciData("market", {
    title: "Sourced market research", classification: "Research finding", researchStatus: "Researched",
    source: "Public report", researchDate: "2026-10-31",
  }));
});
test("market-research handoff fields preserve research versus customer validation", () => {
  const market = OCI_MODULES.find(item => item.id === "market");
  const discovery = OCI_MODULES.find(item => item.id === "discovery");
  assert.ok(market.fields.some(field => field.key === "researchStatus"));
  assert.ok(discovery.fields.some(field => field.key === "researchReference"));
  assert.ok(discovery.fields.some(field => field.key === "discoveryStatus"));
  assert.ok(discovery.fields.some(field => field.key === "contractIntelligenceNeeds"));
  const data = validateOciData("discovery", {
    title: "Interview", discoveryStatus: "Preparing", validation: "Internal assumption",
    researchReference: "Market research only. Customer validation pending.",
  });
  assert.equal(data.validation, "Internal assumption");
  assert.equal(data.researchReference, "Market research only. Customer validation pending.");
  assert.throws(() => validateOciData("discovery", {
    title: "Interview", validation: "Customer-validated",
  }), invalid);
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
test("commercial recommendations become audited actions with controlled lifecycle history", async () => {
  const { service, records } = fixture();
  records.get(account).data = { name: "A", accountStatus: "Target", priority: "High", researchStatus: "Not researched" };
  const dueDate = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
  const created = await service.acceptRecommendation("accounts", account, { dueDate }, actor);
  assert.equal(created.data.actionStatus, "Accepted");
  assert.deepEqual(JSON.parse(created.data.actionHistory), [{ status: "Accepted", at: JSON.parse(created.data.actionHistory)[0].at, actorId: actor }]);
  assert.equal(created.account_id, account);
  await assert.rejects(service.acceptRecommendation("accounts", account, { dueDate }, actor), conflict);
  assert.equal(records.size, 4);

  const editable = Object.fromEntries(OCI_MODULES.find(module => module.id === "activities").fields
    .filter(field => !field.internalOnly && !field.readOnly && Object.hasOwn(created.data, field.key))
    .map(field => [field.key, created.data[field.key]]));
  const inProgress = await service.updateRecord("activities", created.id, {
    version: 1, data: { ...editable, actionStatus: "In progress" }, accountId: account,
  }, actor);
  assert.deepEqual(JSON.parse(inProgress.data.actionHistory).map(event => event.status), ["Accepted", "In progress"]);
  const completed = await service.updateRecord("activities", created.id, {
    version: 2, accountId: account,
    data: { ...editable, actionStatus: "Completed", activityStatus: "Completed",
      completedDate: new Date().toISOString().slice(0, 10), outcome: "Research completed and source recorded." },
  }, actor);
  assert.deepEqual(JSON.parse(completed.data.actionHistory).map(event => event.status), ["Accepted", "In progress", "Completed"]);
  await assert.rejects(service.updateRecord("activities", created.id, {
    version: 3, accountId: account, data: { ...editable, activityStatus: "Completed", outcome: "Attempted to reopen", actionStatus: "In progress" },
  }, actor), invalid);
  await assert.rejects(service.archiveRecord("activities", created.id, { version: 3 }, actor), invalid);
});
test("dismissal, snooze, source relationships, managed history and waiting-response evidence are enforced", async () => {
  const { service, records } = fixture();
  records.get(account).data = { name: "A", accountStatus: "Target", priority: "High", researchStatus: "Not researched" };
  const dueDate = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
  const action = await service.acceptRecommendation("accounts", account, { dueDate }, actor);
  const editable = Object.fromEntries(OCI_MODULES.find(module => module.id === "activities").fields
    .filter(field => !field.internalOnly && !field.readOnly && Object.hasOwn(action.data, field.key))
    .map(field => [field.key, action.data[field.key]]));
  const nextDate = new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10);
  const snoozed = await service.updateRecord("activities", action.id, {
    version: 1, accountId: account,
    data: { ...editable, actionStatus: "Snoozed", reviewDate: nextDate },
  }, actor);
  assert.equal(snoozed.data.reviewDate, nextDate);
  await assert.rejects(service.updateRecord("activities", action.id, {
    version: 2, accountId: account, data: { ...editable, actionStatus: "Dismissed", activityStatus: "Cancelled" },
  }, actor), invalid);
  const dismissed = await service.updateRecord("activities", action.id, {
    version: 2, accountId: account,
    data: { ...editable, actionStatus: "Dismissed", activityStatus: "Cancelled", dismissalReason: "No longer relevant." },
  }, actor);
  assert.equal(dismissed.data.dismissalReason, "No longer relevant.");
  assert.throws(() => validateOciData("activities", {
    title: "Research account", type: "Research", activityStatus: "Planned",
    actionStatus: "Accepted", actionHistory: "forged",
  }), invalid);
  assert.throws(() => validateOciData("activities", {
    title: "Email", type: "Email", activityStatus: "Completed", responseStatus: "Awaiting external response",
  }), invalid);
  assert.doesNotThrow(() => validateOciData("activities", {
    title: "Email", type: "Email", activityStatus: "Completed", outcome: "Sent follow-up after the meeting.",
    followUpDate: dueDate, responseStatus: "Awaiting external response",
  }));
  const contactId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  records.set(contactId, { id: contactId, kind: "contacts", status: "active", version: 1,
    account_id: account, opportunity_id: null, data: { relationshipStatus: "Identified", source: "Public professional directory" } });
  const contactAction = await service.acceptRecommendation("contacts", contactId, {}, actor);
  assert.equal(contactAction.account_id, account);
  assert.equal(contactAction.data.relatedRecordKind, "contacts");
  await assert.rejects(service.acceptRecommendation("contacts", recordId, {}, actor), error => error.status === 404);
  records.get(account).data.priority = "Low";
  await assert.rejects(service.acceptRecommendation("accounts", account, {}, actor), conflict);
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
  assert.ok(validateOciData("opportunities", {
    name: "O", stage: "Custom", currency: "eur", stageChangeEvidence: "Custom-stage evidence",
  }, stages));
  assert.deepEqual(await service.getStages(), stages);
});
test("financial arithmetic never mixes currencies or actual and forecast bases", () => {
  const result = calculateOciRevenue([
    { currency: "EUR", basis: "Actual", revenueClass: "Recognised actual", segment: "Airline", amount: "100", costComplete: true, hasEstimatedCosts: true, pilotRevenue: "100", deliveryCost: "20", infrastructureCost: "10", aiProcessingCost: "5", storageCost: "5" },
    { currency: "USD", basis: "Actual", revenueClass: "Recognised actual", amount: "200", subscriptionRevenue: "200", mrr: "200", arr: "2400" },
    { currency: "EUR", basis: "Forecast", revenueClass: "Speculative forecast", amount: "0", deliveryCost: "20" },
  ]);
  assert.equal(result[0].grossMargin, 60); assert.equal(result[0].grossMarginPercent, 60);
  assert.equal(result[0].marginBasis, "Estimated");
  assert.equal(result[1].amount, 200); assert.equal(result[1].arr, 2400);
  assert.equal(result[1].cost, null); assert.equal(result[1].grossMargin, null);
  assert.equal(result[1].costComplete, false); assert.equal(result[1].marginBasis, "Unknown");
  assert.equal(result[2].grossMarginPercent, null);
  assert.equal(result[0].revenueClass, "Recognised actual");
  assert.equal(result[0].segment, "Airline");
  assert.equal(result.length, 3); assert.equal(Object.hasOwn(result, "total"), false);
});
test("revenue requires explicit period amount and assessed costs require complete evidence", () => {
  const base = { name: "R", basis: "Actual", revenueClass: "Recognised actual", revenueType: "Pilot", currency: "EUR", source: "Ledger", costBasis: "Unassessed", periodDate: "2026-10-01" };
  assert.throws(() => validateOciData("revenue", base), invalid);
  assert.equal(validateOciData("revenue", { ...base, amount: 0 }).amount, 0);
  assert.throws(() => validateOciData("revenue", { ...base, amount: 100, costBasis: "Recorded" }), invalid);
  const costs = { deliveryCost: 0, infrastructureCost: 0, aiProcessingCost: 0, storageCost: 0 };
  assert.ok(validateOciData("revenue", { ...base, ...costs, amount: 100, costBasis: "Recorded" }));
  assert.throws(() => validateOciData("revenue", { ...base, ...costs, amount: 100, costBasis: "Estimated" }), invalid);
  assert.ok(validateOciData("revenue", { ...base, ...costs, amount: 100, costBasis: "Estimated", assumptions: "Manual cost estimate" }));
  const unknown = calculateOciRevenue([{ currency: "EUR", basis: "Actual", revenueClass: "Recognised actual", amountComplete: false, costComplete: false }])[0];
  assert.equal(unknown.amount, null); assert.equal(unknown.grossMargin, null);
  const recorded = calculateOciRevenue([{ currency: "EUR", basis: "Actual", revenueClass: "Recognised actual", amount: "100", costComplete: true, hasEstimatedCosts: false }])[0];
  assert.equal(recorded.marginBasis, "Recorded"); assert.equal(recorded.grossMarginPercent, 100);
  assert.throws(() => validateOciData("revenue", { ...base, revenueClass: "Speculative forecast", amount: 10 }), invalid);
  const contracted = {
    ...base, basis: "Forecast", revenueClass: "Contracted future", source: "Signed agreement reference",
    assumptions: "Recognize over the agreed delivery period", amount: 100,
  };
  assert.doesNotThrow(() => validateOciData("revenue", contracted));
  assert.throws(() => validateOciData("revenue", { ...contracted, source: "" }), invalid);
  const legacy = {
    name: "Old revenue", basis: "Actual", revenueType: "Pilot", currency: "EUR",
    amount: 10, source: "Ledger", costBasis: "Unassessed", periodDate: "2026-10-01",
  };
  assert.equal(validateOciData("revenue", { ...legacy, revenueClass: "Unclassified legacy" }, OCI_STAGES, legacy).revenueClass, "Unclassified legacy");
  assert.throws(() => validateOciData("revenue", { ...base, revenueClass: "Unclassified legacy", amount: 10 }), invalid);
});
test("recurring revenue periods stay separate and absent ancillary metrics remain unknown", () => {
  const result = calculateOciRevenue([
    { currency: "EUR", basis: "Actual", revenueClass: "Recognised actual", periodDate: "2026-10-01", amount: "100", mrr: "100", arr: "1200" },
    { currency: "EUR", basis: "Actual", revenueClass: "Recognised actual", periodDate: "2026-11-01", amount: "100", mrr: "100", arr: "1200" },
    { currency: "USD", basis: "Forecast", revenueClass: "Speculative forecast", periodDate: "2026-11-01", amount: "50", acquisitionCost: "0" },
  ]);
  assert.equal(result[0].periodDate, "2026-10-01"); assert.equal(result[1].periodDate, "2026-11-01");
  assert.equal(result[0].mrr, 100); assert.equal(result[1].mrr, 100);
  assert.equal(result[0].arr, 1200); assert.equal(result[1].arr, 1200);
  for (const key of ["mrr", "arr", "annualContractValue", "lifetimeValue"]) assert.equal(result[2][key], null);
  assert.equal(result[2].acquisitionCost, 0);
  assert.equal(result[0].acquisitionCost, null);
  assert.throws(() => validateOciData("revenue", { name: "R", basis: "Actual", revenueClass: "Recognised actual", revenueType: "Pilot", currency: "EUR", amount: 0, source: "Ledger", costBasis: "Unassessed" }), invalid);
});
test("dashboard transforms only persisted aggregate inputs, including manual weighted pipeline", async () => {
  const { service, repository } = fixture();
  repository.dashboard = async () => ({
    metrics: { activeOpportunities: 0 }, nextActions: [],
    financials: [{ currency: "EUR", basis: "Actual", revenueClass: "Recognised actual", segment: "Airline", amount: "100", amountComplete: true }],
    pipeline: [{ currency: "EUR", countryCode: "ES", segment: "Airline", probabilityComplete: false, opportunityCount: 2, value: "1000", weightedValue: null }],
  });
  const result = await service.dashboard();
  assert.deepEqual(result.metrics, { activeOpportunities: 0 });
  assert.equal(result.revenueSummary.financials[0].revenueClass, "Recognised actual");
  assert.equal(result.revenueSummary.financials[0].segment, "Airline");
  assert.deepEqual(result.revenueSummary.pipeline, [{
    currency: "EUR", countryCode: "ES", segment: "Airline", probabilityComplete: false,
    opportunityCount: 2, dataOrigin: "Unclassified", value: 1000, weightedValue: null,
  }]);
});
test("repository parameterizes all user values and allowlists sort", async () => {
  const calls = [];
  const repo = createOciRepository(async (sql, params) => { calls.push({ sql, params }); return { rows: [{ records: [], total: 0 }] }; });
  await repo.listRecords("accounts", { search: "'; DROP TABLE%_", status: "all", sort: "name_asc", page: 2, pageSize: 5 });
  assert.equal(calls[0].sql.includes("DROP TABLE"), false);
  assert.equal(calls[0].params[2], "%'; DROP TABLE\\%\\_%");
  assert.equal(calls[0].params[4], 5);
  assert.match(calls[0].sql, /filtered as \(select \* from enriched where kind=\$1/);
  assert.match(calls[0].sql, /geo_country=ANY\(\$\d+::text\[\]\)/);
  assert.ok(calls[0].sql.indexOf("filtered as") < calls[0].sql.indexOf("selected as"));
  assert.match(calls[0].sql, /jsonb_agg\(selected order by coalesce\(data->>'name',data->>'title',''\) asc,id\)/);
  await assert.rejects(repo.listRecords("accounts", { search: "", status: "active", sort: "name;drop", page: 1, pageSize: 5 }), TypeError);
  await repo.updateRecord("accounts", account, { data: { name: "A" }, accountId: null, opportunityId: null, version: 4 }, actor);
  assert.match(calls[1].sql, /version=\$6 and status='active'/);
  assert.equal(calls[1].params[5], 4);
});
test("recommendation acceptance serializes idempotently and records only one action identity", async () => {
  const actionId = `accounts:${account}:founder-next-step-v1`;
  let captured;
  const repo = createOciRepository(async (sql, params) => { captured = { sql, params }; return { rows: [] }; });
  assert.equal(await repo.createRecord("activities", {
    data: { recommendationId: actionId }, accountId: account, opportunityId: null,
  }, actor), null);
  assert.match(captured.sql, /pg_advisory_xact_lock\(hashtext\(\$6\)\)/);
  assert.match(captured.sql, /not exists \(select 1 from public\.oci_records/);
  assert.equal(captured.params[5], actionId);
  assert.equal(Math.max(...[...captured.sql.matchAll(/\$(\d+)/g)].map(match => Number(match[1]))), captured.params.length);
});
test("repository scopes geographic options and dashboard aggregates before grouping", async () => {
  const calls = [];
  const repo = createOciRepository(async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ country_code: "ES", administrative_region: "Madrid", city: "Madrid" }] };
  });
  const filters = { scope: "EUROPE", countries: ["ES"], regions: [], cities: [], airports: [], segments: ["Airline"], companyTypes: [] };
  await repo.listRecords("opportunities", { search: "", status: "active", sort: "updated_desc", page: 1, pageSize: 12, geography: filters });
  assert.match(calls[0].sql, /LEFT JOIN public\.oci_records a ON a\.id=r\.account_id AND a\.kind='accounts'/);
  assert.match(calls[0].sql, /geo_segment=ANY\(\$\d+::text\[\]\)/);
  assert.ok(calls[0].params.some(value => Array.isArray(value) && value.length === 1 && value[0] === "ES"));
  const options = await repo.geographyOptions();
  assert.deepEqual(options, { options: [{ country_code: "ES", administrative_region: "Madrid", city: "Madrid" }], truncated: false });
  assert.match(calls[1].sql, /limit 2001/);
  await repo.dashboard(filters);
  assert.match(calls[2].sql, /accounts_by_country as/);
  assert.match(calls[2].sql, /pipeline_by_country as/);
  assert.match(calls[2].sql, /discovery_by_country as/);
  assert.match(calls[2].sql, /pilots_by_country as/);
  assert.match(calls[2].sql, /revenue_by_country as/);
  assert.match(calls[2].sql, /account_verification as/);
  assert.match(calls[2].sql, /accounts_awaiting_research as/);
  assert.match(calls[2].sql, /high_priority_european_accounts as/);
  assert.match(calls[2].sql, /validated_customer_problems as/);
  assert.match(calls[2].sql, /potential_pilot_candidates as/);
  assert.match(calls[2].sql, /action_candidates as/);
  assert.match(calls[2].sql, /founder-next-step-v1/);
  assert.match(calls[2].sql, /execution_actions as/);
  assert.match(calls[2].sql, /relatedRecordName/);
  assert.match(calls[2].sql, /source\.id::text=r\.data->>'relatedRecordId'/);
  assert.match(calls[2].sql, /'dataOrigin',"dataOrigin"/);
  assert.match(calls[2].sql, /waiting_for_response as/);
  assert.match(calls[2].sql, /Geography unresolved/);
  assert.match(calls[2].sql, /actionsCompletedThisMonth/);
  assert.match(calls[2].sql, /opportunitiesWithoutRecentActivity/);
  assert.match(calls[2].sql, /recommendationReason/);
  assert.match(calls[2].sql, /recommendedAction/);
  assert.match(calls[2].sql, /probabilityComplete/);
  assert.match(calls[2].sql, /Unclassified legacy/);
  assert.match(calls[2].sql, /closedOpportunityWinRate/);
  assert.match(calls[2].sql, /data_origin as "dataOrigin"/);
  assert.match(calls[2].sql, /geo_country=ANY\(\$\d+::text\[\]\)/);
  const placeholders = [...calls[2].sql.matchAll(/\$(\d+)/g)].map(match => Number(match[1]));
  assert.equal(Math.max(...placeholders), calls[2].params.length);
  assert.equal(calls[2].params.at(-2), "EUROPE");
  assert.ok(calls[2].params.at(-1).includes("ES"), "European membership is separately bound for priority accounts");
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
  assert.match(captured, /group by data->>'currency',data->>'basis',coalesce\(data->>'revenueClass','Unclassified legacy'\),/);
  assert.match(captured, /data->>'periodDate' as "periodDate"/);
  for (const key of ["mrr", "arr", "annualContractValue", "acquisitionCost", "lifetimeValue"]) {
    assert.ok(captured.includes(`sum((data->>'${key}')::numeric) as "${key}"`));
    assert.ok(!captured.includes(`sum(coalesce((data->>'${key}')::numeric,0))`));
  }
  assert.match(captured, /as "costComplete"/);
  assert.match(captured, /as "hasEstimatedCosts"/);
  assert.match(captured, /action_candidates as \(select r\.id,r\.kind,r\.data/);
  assert.match(captured, /recommendationReason/);
  assert.match(captured, /recommendedAction/);
  assert.match(captured, /actions as \(select jsonb_build_object/);
  assert.match(captured, /'upcomingActivities'.*data->>'dueDate'>=current_date::text/);
  assert.match(captured, /'overdueActivities'.*data->>'dueDate'<current_date::text/);
  assert.match(captured, /then sum\(\(data->>'value'\)::numeric\*\(data->>'probability'\)::numeric\/100\)/);
  assert.match(captured, /limit 25/);
  assert.match(captured, /status='active'/);
});
test("router requires injectable authorization and completes CRUD/error responses offline", async () => {
  // Keep provider configuration empty; all database operations below are injected.
  process.env.DATABASE_URL = ""; process.env.SUPABASE_URL = ""; process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  const { createOciRouter } = await import("../routes/ociRoutes.js");
  const { service, repository, records } = fixture();
  records.get(account).data = { name: "A", accountStatus: "Target", priority: "High", researchStatus: "Not researched" };
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
    const acceptedRecommendation = await fetch(`${url}/recommendations/accounts/${account}/accept`, {
      method: "POST", headers, body: JSON.stringify({ dueDate: "2026-11-06" }),
    });
    assert.equal(acceptedRecommendation.status, 201);
    assert.equal((await acceptedRecommendation.json()).record.data.actionStatus, "Accepted");
    assert.equal((await fetch(`${url}/records/accounts?pageSize=101`, { headers })).status, 400);
    assert.deepEqual((await (await fetch(`${url}/geography/options?geoScope=EUROPE`, { headers })).json()).options, []);
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
      if (token === "ordinary") return { id: otherAccount, emailVerified: true, mfaVerified: true };
      if (token === "forged") return { id: otherAccount, emailVerified: true, mfaVerified: true, user_metadata: { role: "super_admin" }, role: "SUPERADMIN" };
      if (token === "aal1") return { id: actor, emailVerified: true, mfaVerified: false };
      return { id: actor, emailVerified: true, mfaVerified: true };
    },
    async queryFn(sql, params) {
      assert.match(sql, /from public\.oci_user_roles/);
      assert.match(sql, /role = 'super_admin'/);
      assert.doesNotMatch(sql, /platform_user_roles|SUPERADMIN/);
      return { rows: params[0] === actor ? [{ user_id: actor }] : [] };
    },
    async audit(actorId, action) { audits.push({ actorId, action }); },
  });
  const { service } = fixture();
  const app = express(); app.use(express.json()); app.use("/api/oci", createOciRouter(service, authorization));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const routes = [
    ["GET", "/schema"], ["GET", "/dashboard"], ["GET", "/geography/options"], ["GET", "/records/accounts"],
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
