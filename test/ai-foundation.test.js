import assert from "node:assert/strict";
import test from "node:test";
import { createAIGateway, createInMemoryIntelligenceStore, hashContent } from "../services/ai/aiGateway.js";
import { createAssistantDataAccess } from "../services/ai/assistantDataAccess.js";
import { createContractIntelligenceDomain } from "../services/contractIntelligenceDomain.js";
import { analyzeContract } from "../aiEngine.js";

const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";

function gateway(provider = {}) {
  return createAIGateway({ providers: { mistral: { name: "mistral", model: "test", generate: provider.generate || (async () => ({ output: { ok: true }, usage: {} })) } }, costs: { classification: 10, full_contract_analysis: 100, confirmationThreshold: 50 }, store: createInMemoryIntelligenceStore() });
}

test("provider abstraction selects configured Mistral and records a completed job", async () => {
  const calls = [];
  const ai = gateway({ generate: async (request) => { calls.push(request); return { output: { answer: "ok" }, usage: { input_tokens: 2 } }; } });
  ai.setBudget(orgA, { allocated: 100 });
  const result = await ai.request({ organizationId: orgA, operation: "classification", input: "short" });
  assert.equal(result.success, true);
  assert.equal(result.job.provider, "mistral");
  assert.equal(result.job.status, "completed");
  assert.equal(calls.length, 1);
});

test("provider failure is surfaced and the job is marked failed", async () => {
  const ai = gateway({ generate: async () => { throw Object.assign(new Error("down"), { code: "PROVIDER_UNAVAILABLE" }); } });
  ai.setBudget(orgA, { allocated: 100 });
  await assert.rejects(() => ai.request({ organizationId: orgA, operation: "classification", input: "failure" }), { code: "PROVIDER_UNAVAILABLE" });
  assert.equal([...ai.store.jobs.values()][0].status, "failed");
});

test("deterministic and existing intelligence paths consume zero and skip the provider", async () => {
  let calls = 0;
  const ai = gateway({ generate: async () => { calls += 1; return { output: {} }; } });
  ai.setBudget(orgA, { allocated: 1 });
  const deterministic = await ai.request({ organizationId: orgA, operation: "full_contract_analysis", deterministicResult: [{ id: 1 }] });
  const existing = await ai.request({ organizationId: orgA, operation: "full_contract_analysis", existingIntelligence: { clause: "termination" } });
  assert.equal(deterministic.intelligenceConsumption, 0);
  assert.equal(existing.intelligenceConsumption, 0);
  assert.equal(calls, 0);
});

test("cache hit reuses identical document intelligence and changed content misses", async () => {
  let calls = 0;
  const ai = gateway({ generate: async () => { calls += 1; return { output: { calls }, usage: {} }; } });
  ai.setBudget(orgA, { allocated: 300 });
  const input = "same document";
  const first = await ai.request({ organizationId: orgA, operation: "classification", input });
  const second = await ai.request({ organizationId: orgA, operation: "classification", input });
  const changed = await ai.request({ organizationId: orgA, operation: "classification", input: `${input}!` });
  assert.equal(first.source, "provider");
  assert.equal(second.source, "cache");
  assert.equal(changed.source, "provider");
  assert.equal(calls, 2);
  assert.notEqual(hashContent(input), hashContent(`${input}!`));
});

test("cache reuse remains available when no budget remains", async () => {
  const ai = gateway();
  ai.setBudget(orgA, { allocated: 10 });
  await ai.request({ organizationId: orgA, operation: "classification", input: "cached" });
  const reused = await ai.request({ organizationId: orgA, operation: "classification", input: "cached" });
  assert.equal(reused.source, "cache");
  assert.equal(reused.intelligenceConsumption, 0);
});

test("budget blocks insufficient and exact-boundary requests, while zero-cost remains available", async () => {
  const ai = gateway();
  ai.setBudget(orgA, { allocated: 10 });
  const exact = await ai.request({ organizationId: orgA, operation: "classification", input: "x" });
  assert.equal(exact.success, true);
  const blocked = await ai.request({ organizationId: orgA, operation: "classification", input: "different" });
  assert.equal(blocked.code, "INSUFFICIENT_INTELLIGENCE_BUDGET");
  const free = await ai.request({ organizationId: orgA, operation: "unknown", deterministicResult: [] });
  assert.equal(free.intelligenceConsumption, 0);
});

test("expensive work requires explicit confirmation and exposes an estimate", async () => {
  const ai = gateway();
  ai.setBudget(orgA, { allocated: 200 });
  const pending = await ai.request({ organizationId: orgA, operation: "full_contract_analysis", input: "contract" });
  assert.equal(pending.code, "CONFIRMATION_REQUIRED");
  assert.equal(pending.job.status, "awaiting_confirmation");
  const completed = await ai.request({ organizationId: orgA, operation: "full_contract_analysis", input: "contract", confirmation: true });
  assert.equal(completed.success, true);
  const awaiting = await ai.request({ organizationId: orgA, operation: "full_contract_analysis", input: "cancel me" });
  assert.equal(ai.cancelJob(orgA, awaiting.job.id).status, "cancelled");
});

test("organisation scope prevents cross-tenant budget and job access", async () => {
  const ai = gateway();
  ai.setBudget(orgA, { allocated: 20 });
  assert.equal(ai.getBudget(orgB).allocated, 0);
  const result = await ai.request({ organizationId: orgA, operation: "classification", input: "x" });
  assert.equal(ai.getJob(orgB, result.job.id), null);
});

test("AI requests fail closed when organization scope is missing or invalid", async () => {
  const ai = gateway();
  await assert.rejects(
    () => ai.request({ operation: "classification", input: "tenant required" }),
    { code: "ORGANIZATION_ACCESS_DENIED" },
  );
  await assert.rejects(
    () => ai.request({ organizationId: "not-an-org", operation: "classification", input: "tenant required" }),
    { code: "ORGANIZATION_ACCESS_DENIED" },
  );
});

test("assistant data access allowlists structured resources and always scopes queries", async () => {
  const queries = [];
  const access = createAssistantDataAccess({ query: async (sql, values) => { queries.push({ sql, values }); return { rows: [{ id: 1 }] }; } });
  const rows = await access.find({ organizationId: orgA, resource: "contracts", filters: { status: "active" } });
  assert.deepEqual(rows, [{ id: 1 }]);
  assert.match(queries[0].sql, /FROM contracts WHERE organization_id = \$1 AND status = \$2/);
  await assert.rejects(() => access.find({ organizationId: orgA, resource: "users" }), { code: "UNSUPPORTED_DATA_RESOURCE" });
  assert.deepEqual(await access.find({ organizationId: orgB, resource: "contracts" }), [{ id: 1 }]);
  await assert.rejects(() => access.find({ organizationId: "not-an-org", resource: "contracts" }), { code: "ORGANIZATION_ACCESS_DENIED" });
});

test("contract domain service scopes writes and exposes version structure", async () => {
  const queries = [];
  const domain = createContractIntelligenceDomain(async (sql, values) => {
    queries.push({ sql, values });
    return { rows: [{ id: "33333333-3333-4333-8333-333333333333", organization_id: orgA }] };
  });
  const contract = await domain.createContract({ organizationId: orgA, userId: orgB, title: "Aircraft lease", contractType: "aviation_contract" });
  assert.equal(contract.organization_id, orgA);
  await domain.createContractVersion({ organizationId: orgA, contractId: contract.id, documentId: contract.id, userId: orgB, versionNumber: 1, sha256: "a".repeat(64), storageKey: "source.pdf", fileSize: 10 });
  assert.match(queries[0].sql, /organization_id, created_by, title/);
  assert.match(queries[1].sql, /document_versions/);
  await assert.rejects(() => domain.createContract({ organizationId: "not-an-org", userId: orgB, title: "x" }), { code: "ORGANIZATION_ACCESS_DENIED" });
});

test("migrated legacy engine requires tenant context before gateway execution", async () => {
  await assert.rejects(
    () => analyzeContract("aircraft lease terms"),
    { code: "ORGANIZATION_ACCESS_DENIED" },
  );
});