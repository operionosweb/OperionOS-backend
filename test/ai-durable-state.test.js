import assert from "node:assert/strict";
import test from "node:test";

import { createAIGateway } from "../services/ai/aiGateway.js";

const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";

function durableStore(allocated = 10) {
  const budgets = new Map([
    [orgA, { allocated, consumed: 0, reserved: 0, warningThreshold: 80, hardLimit: true }],
    [orgB, { allocated, consumed: 0, reserved: 0, warningThreshold: 80, hardLimit: true }],
  ]);
  const jobs = new Map();
  const cache = new Map();
  const usage = [];
  const calls = [];
  const cacheKey = value => [value.organizationId, value.documentHash, value.operation, value.analysisVersion, value.promptVersion, value.provider, value.model].join(":");

  return {
    kind: "postgres",
    budgets,
    jobs,
    cache,
    usage,
    calls,
    async getBudget(organizationId) { calls.push("getBudget"); return { ...(budgets.get(organizationId) || { allocated: 0, consumed: 0, reserved: 0, hardLimit: true }) }; },
    async setBudget(organizationId, values) { budgets.set(organizationId, { ...values }); return values; },
    async reserveBudget(organizationId, amount) {
      calls.push("reserveBudget");
      const budget = budgets.get(organizationId);
      if (!budget || (budget.hardLimit && budget.allocated - budget.consumed - budget.reserved < amount)) return null;
      budget.reserved += amount;
      return { ...budget };
    },
    async releaseBudget(organizationId, amount) { calls.push("releaseBudget"); const budget = budgets.get(organizationId); budget.reserved = Math.max(0, budget.reserved - amount); return { ...budget }; },
    async consumeBudget(organizationId, reserved, actual) { calls.push("consumeBudget"); const budget = budgets.get(organizationId); budget.reserved -= reserved; budget.consumed += actual; return { ...budget }; },
    async createJob(job) {
      calls.push("createJob");
      const existing = [...jobs.values()].find(candidate => candidate.organizationId === job.organizationId
        && candidate.requestKey === job.requestKey && ["pending", "estimating", "processing"].includes(candidate.status));
      if (existing) return existing;
      jobs.set(`${job.organizationId}:${job.id}`, { ...job });
      return job;
    },
    async updateJob(job) { calls.push(`updateJob:${job.status}`); jobs.set(`${job.organizationId}:${job.id}`, { ...job }); return job; },
    async getJob(organizationId, jobId) { return jobs.get(`${organizationId}:${jobId}`) || null; },
    async cancelJob(organizationId, jobId, completedAt) { const job = jobs.get(`${organizationId}:${jobId}`); if (!job) return null; job.status = "cancelled"; job.completedAt = completedAt; return job; },
    async getCache(identity) { calls.push("getCache"); return cache.get(cacheKey(identity)) || null; },
    async putCache(value) { calls.push("putCache"); cache.set(cacheKey(value), { result: value.result, job: value.job }); },
    async recordUsage(value) { calls.push("recordUsage"); usage.push(value); },
  };
}

function gateway(store, generate) {
  return createAIGateway({
    store,
    costs: { classification: 10, confirmationThreshold: 50 },
    providers: { mistral: { name: "mistral", model: "test", generate } },
  });
}

test("atomic durable reservation admits only one concurrent exact-budget request", async () => {
  const store = durableStore(10);
  let providerCalls = 0;
  const ai = gateway(store, async () => { providerCalls += 1; return { output: { ok: true }, usage: {} }; });

  const results = await Promise.all([
    ai.request({ organizationId: orgA, operation: "classification", input: "first" }),
    ai.request({ organizationId: orgA, operation: "classification", input: "second" }),
  ]);

  assert.equal(results.filter(result => result.success).length, 1);
  assert.equal(results.filter(result => result.code === "INSUFFICIENT_INTELLIGENCE_BUDGET").length, 1);
  assert.equal(providerCalls, 1);
  assert.equal(store.budgets.get(orgA).consumed, 10);
  assert.equal(store.budgets.get(orgA).reserved, 0);
});

test("provider failure releases a durable reservation and persists failed status", async () => {
  const store = durableStore(10);
  const ai = gateway(store, async () => { throw Object.assign(new Error("offline"), { code: "PROVIDER_UNAVAILABLE" }); });

  await assert.rejects(ai.request({ organizationId: orgA, operation: "classification", input: "failure" }), { code: "PROVIDER_UNAVAILABLE" });

  assert.equal(store.budgets.get(orgA).reserved, 0);
  assert.equal([...store.jobs.values()][0].status, "failed");
  assert.ok(store.calls.includes("releaseBudget"));
});

test("durable cache is tenant scoped and completed work persists job and usage", async () => {
  const store = durableStore(20);
  let providerCalls = 0;
  const ai = gateway(store, async () => { providerCalls += 1; return { output: { call: providerCalls }, usage: { input_tokens: 2 } }; });

  const first = await ai.request({ organizationId: orgA, operation: "classification", input: "same" });
  const cached = await ai.request({ organizationId: orgA, operation: "classification", input: "same" });
  const otherTenant = await ai.request({ organizationId: orgB, operation: "classification", input: "same" });

  assert.equal(first.source, "provider");
  assert.equal(cached.source, "cache");
  assert.equal(otherTenant.source, "provider");
  assert.equal(providerCalls, 2);
  assert.equal(store.usage.length, 2);
  assert.equal([...store.jobs.values()].filter(job => job.status === "completed").length, 2);
});

test("zero-cost durable paths perform no database work", async () => {
  const store = durableStore(0);
  const ai = gateway(store, async () => { throw new Error("provider should not run"); });

  await ai.request({ organizationId: orgA, operation: "classification", deterministicResult: [] });
  await ai.request({ organizationId: orgA, operation: "classification", existingIntelligence: {} });

  assert.deepEqual(store.calls, []);
});

test("concurrent identical durable requests do not duplicate provider spend", async () => {
  const store = durableStore(100);
  let providerCalls = 0;
  let releaseProvider;
  const providerGate = new Promise(resolve => { releaseProvider = resolve; });
  const ai = gateway(store, async () => {
    providerCalls += 1;
    await providerGate;
    return { output: { ok: true }, usage: {} };
  });

  const first = ai.request({ organizationId: orgA, operation: "classification", input: "identical" });
  const duplicate = await ai.request({ organizationId: orgA, operation: "classification", input: "identical" });
  releaseProvider();
  const completed = await first;

  assert.equal(completed.success, true);
  assert.equal(duplicate.code, "REQUEST_IN_PROGRESS");
  assert.equal(providerCalls, 1);
  assert.equal(store.budgets.get(orgA).consumed, 10);
});

test("provider metadata cannot overspend an exact durable budget", async () => {
  const store = durableStore(10);
  const ai = gateway(store, async () => ({ output: { ok: true }, usage: { intelligence: 1000, input_tokens: 50 } }));

  const result = await ai.request({ organizationId: orgA, operation: "classification", input: "exact" });

  assert.equal(result.success, true);
  assert.equal(result.job.actualIntelligence, 10);
  assert.equal(result.job.technicalUsage.intelligence, 1000);
  assert.equal(store.budgets.get(orgA).consumed, 10);
  assert.equal(result.budget.remaining, 0);
});