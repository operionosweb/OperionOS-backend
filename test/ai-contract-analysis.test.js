import assert from "node:assert/strict";
import test from "node:test";
import { createAzureOpenAIProvider, createAIGateway, createInMemoryIntelligenceStore } from "../services/ai/aiGateway.js";
import { createPostgresIntelligenceStore } from "../services/ai/postgresIntelligenceStore.js";
import { createAIContractAnalysisService } from "../services/phase3/intelligence/aiContractAnalysisService.js";

const scope = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  contractId: "33333333-3333-4333-8333-333333333333",
  documentId: "44444444-4444-4444-8444-444444444444",
  documentVersionId: "22222222-2222-4222-8222-222222222222",
  analysisRunId: "55555555-5555-4555-8555-555555555555",
};
const text = "The Lessee shall pay USD 1000 per month for engine maintenance.";
const source = { ...scope, text, pageBoundaries: "explicit", pages: [{ page_number: 2, char_start: 0, char_end: text.length }] };
const clauses = [{ id: "clause-1", clause_number: "3.1", evidence: [{ id: "evidence-1", excerpt: text }] }];
const approved = {
  CONTRACT_AI_ENABLED: "true", CONTRACT_AI_PROVIDER_APPROVED: "true",
  CONTRACT_AI_ISOLATION_VERIFIED: "true", CONTRACT_AI_DATA_USE_APPROVED: "true",
};
const finding = {
  category: "financial_commitment", source_ref: "S1", quote: text,
  interpretation: "The lessee appears responsible for USD 1000 per month.",
  recommended_action: "Review the payment terms.", confidence: "medium",
};

test("Azure adapter uses a strict schema, server key, bounded request and trusted endpoint", async () => {
  const calls = [];
  const provider = createAzureOpenAIProvider({
    endpoint: "https://synthetic.openai.azure.com", apiKey: "synthetic-key", model: "synthetic-model",
    http: { async post(...args) {
      calls.push(args);
      return { data: { choices: [{ finish_reason: "stop", message: { content: "{\"findings\":[]}" } }], usage: { prompt_tokens: 10, extra: "synthetic private data" } } };
    } },
  });
  const format = { type: "json_schema", json_schema: { name: "test", strict: true, schema: { type: "object" } } };
  const result = await provider.generate({ input: "synthetic", system: "synthetic", responseFormat: format });
  assert.equal(calls[0][0], "https://synthetic.openai.azure.com/openai/v1/chat/completions");
  assert.equal(calls[0][1].response_format, format);
  assert.equal(calls[0][1].max_completion_tokens, 4096);
  assert.equal(calls[0][1].n, 1);
  assert.equal(calls[0][2].headers["api-key"], "synthetic-key");
  assert.equal(calls[0][2].maxRedirects, 0);
  assert.equal(calls[0][2].timeout, 60000);
  assert.deepEqual(result.usage, { prompt_tokens: 10 });
  const unsafe = createAzureOpenAIProvider({ endpoint: "https://openai.azure.com.attacker.invalid", apiKey: "synthetic", model: "test", http: { post() { assert.fail("must not send"); } } });
  await assert.rejects(unsafe.generate({ responseFormat: format }), { code: "INVALID_PROVIDER_CONFIGURATION" });
});

test("Azure output truncated by the completion limit fails rather than returning partial intelligence", async () => {
  let calls = 0;
  const provider = createAzureOpenAIProvider({
    endpoint: "https://synthetic.openai.azure.com", apiKey: "synthetic-key", model: "synthetic-model",
    http: { async post() {
      calls += 1;
      return { data: { choices: [{ finish_reason: "length", message: { content: "{\"findings\":[" } }] } };
    } },
  });
  await assert.rejects(provider.generate({ input: "synthetic", system: "synthetic", responseFormat: {} }), { code: "INVALID_STRUCTURED_OUTPUT" });
  assert.equal(calls, 1);
});

test("approval gate prevents contract content reaching the gateway", async () => {
  const service = createAIContractAnalysisService({ env: {}, gateway: { request() { assert.fail("must not send"); } } });
  await assert.rejects(service.analyze({ scope, source, clauses, confirmation: true }), { code: "CONTRACT_AI_NOT_APPROVED" });
});

test("oversized source excerpts are rejected before a provider request", async () => {
  const oversized = "A".repeat(100001);
  const service = createAIContractAnalysisService({ env: approved, gateway: { request() { assert.fail("must not send"); } } });
  await assert.rejects(service.analyze({
    scope, source: { ...source, text: oversized },
    clauses: [{ id: "clause", evidence: [{ id: "evidence", excerpt: oversized }] }], confirmation: true,
  }), { code: "AI_SOURCE_TOO_LARGE" });
});

test("configured AI input byte limit is enforced before provider access", async () => {
  const service = createAIContractAnalysisService({
    env: { ...approved, CONTRACT_AI_MAX_INPUT_BYTES: "20" },
    gateway: { request() { assert.fail("must not send"); } },
  });
  await assert.rejects(service.analyze({ scope, source, clauses, confirmation: true }), { code: "AI_SOURCE_TOO_LARGE" });
});

test("mismatched tenant or document scope never reaches the provider", async () => {
  const service = createAIContractAnalysisService({ env: approved, gateway: { request() { assert.fail("must not send"); } } });
  for (const altered of [
    { ...source, organizationId: "another-tenant" },
    { ...source, documentVersionId: "another-document" },
    { ...source, analysisRunId: "another-run" },
  ]) {
    await assert.rejects(service.analyze({ scope, source: altered, clauses, confirmation: true }), { code: "ORGANIZATION_ACCESS_DENIED" });
  }
  const foreignEvidence = [{ ...clauses[0], evidence: [{ ...clauses[0].evidence[0], document_id: "another-document" }] }];
  await assert.rejects(service.analyze({ scope, source, clauses: foreignEvidence, confirmation: true }), { code: "ORGANIZATION_ACCESS_DENIED" });
});

test("synthetic findings are source-linked, require review and retain only reliable pages", async () => {
  const requests = [];
  const gateway = { async request(request) { requests.push(request); return { success: true, result: { findings: [finding] } }; } };
  const service = createAIContractAnalysisService({ env: approved, gateway });
  const result = await service.analyze({ scope, source, clauses, confirmation: true });
  assert.equal(requests[0].provider, "azure_openai");
  assert.equal(requests[0].cache, false);
  assert.equal(requests[0].organizationId, scope.organizationId);
  assert.equal(result.findings[0].evidence.pageNumber, 2);
  assert.equal(result.findings[0].evidence.evidenceText, text);
  assert.equal(result.findings[0].reviewStatus, "requires_review");
  const docx = await service.analyze({ scope, source: { ...source, pageBoundaries: "derived_unavailable" }, clauses, confirmation: true });
  assert.equal(docx.findings[0].evidence.pageNumber, null);
});

test("invalid outputs, unsupported quotes and invented numeric values fail closed", async () => {
  for (const result of [
    { findings: [{ ...finding, quote: "Not present in the contract" }] },
    { findings: [{ ...finding, interpretation: "The lessee owes USD 2000." }] },
    { findings: [{ ...finding, confidence: 0.99 }] },
  ]) {
    const service = createAIContractAnalysisService({ env: approved, gateway: { async request() { return { success: true, result }; } } });
    await assert.rejects(service.analyze({ scope, source, clauses, confirmation: true }), (error) => ["AI_OUTPUT_INVALID", "AI_SOURCE_MISMATCH"].includes(error.code));
  }
});

test("non-cached AI requests are billed and retry without reusing previous output", async () => {
  const store = createInMemoryIntelligenceStore();
  let calls = 0;
  const gateway = createAIGateway({
    store, costs: { full_contract_analysis: 10, confirmationThreshold: 50 },
    providers: { azure_openai: { name: "azure_openai", model: "synthetic", async generate() { calls += 1; return { output: { findings: [] } }; } } },
  });
  gateway.setBudget(scope.organizationId, { allocated: 30 });
  const service = createAIContractAnalysisService({ env: approved, gateway });
  await service.analyze({ scope, source, clauses, confirmation: true });
  await service.analyze({ scope, source, clauses, confirmation: true });
  assert.equal(calls, 2);
  assert.equal(store.cache.size, 0);
  assert.equal(gateway.getBudget(scope.organizationId).consumed, 20);
});

test("durable completion records usage without persisting AI output in cache", async () => {
  const queries = [];
  let jobStatus = "processing";
  let usageRecorded = false;
  let budgetUpdates = 0;
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes("select status from ai_intelligence_jobs")) return { rows: [{ status: jobStatus }] };
      if (sql.includes("select id from ai_intelligence_usage")) return { rows: usageRecorded ? [{ id: "usage" }] : [] };
      if (sql.includes("update ai_intelligence_budgets")) {
        budgetUpdates += 1;
        return { rows: [{ allocated_intelligence: 100, consumed_intelligence: 10 }] };
      }
      if (sql.includes("update ai_intelligence_jobs")) {
        jobStatus = "completed";
        return { rows: [{ id: "job" }] };
      }
      if (sql.includes("insert into ai_intelligence_usage")) {
        usageRecorded = true;
        return { rows: [{ id: "usage" }] };
      }
      if (sql.includes("select * from ai_intelligence_budgets")) {
        return { rows: [{ allocated_intelligence: 100, consumed_intelligence: 10 }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const store = createPostgresIntelligenceStore({ async connect() { return client; } });
  const completion = {
    job: { organizationId: scope.organizationId, id: "job", status: "completed", actualIntelligence: 10 },
    reservedAmount: 10,
    usage: { organizationId: scope.organizationId, jobId: "job", operation: "full_contract_analysis" },
    cache: null,
  };
  await store.completeRequest(completion);
  await store.completeRequest(completion);
  assert.ok(queries.some((sql) => sql.includes("insert into ai_intelligence_usage")));
  assert.equal(queries.filter((sql) => sql.includes("insert into ai_intelligence_usage")).length, 1);
  assert.equal(budgetUpdates, 1);
  assert.equal(queries.some((sql) => sql.includes("insert into ai_intelligence_cache")), false);
  assert.ok(queries.includes("commit"));
});
