import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  ANALYSIS_RUN_STATES,
  CLAUSE_CATEGORIES,
  DEADLINE_TYPES,
  RECOMMENDATION_TYPES,
  RISK_CATEGORIES,
} from "../domain/contractIntelligence/enums.js";
import {
  assertAnalysisRunRetry,
  assertAnalysisRunTransition,
  canTransitionAnalysisRun,
  getAllowedAnalysisRunTransitions,
} from "../domain/contractIntelligence/stateMachine.js";
import {
  ClassificationSchema,
  ClauseSchema,
  DeadlineSchema,
  ObligationSchema,
  ProviderResultSchema,
  RecommendationSchema,
  RiskSchema,
} from "../schemas/phase3/index.js";
import { createAlephAlphaProvider } from "../providers/ai/alephAlphaProvider.js";
import { createMistralProvider } from "../providers/ai/mistralProvider.js";
import { createOpenAIProvider } from "../providers/ai/openaiProvider.js";
import { createAnalysisRunService } from "../services/phase3/analysis/analysisRunService.js";
import { createEvidenceService } from "../services/phase3/evidence/evidenceService.js";

const organizationA = "11111111-1111-4111-8111-111111111111";
const organizationB = "22222222-2222-4222-8222-222222222222";
const contractId = "33333333-3333-4333-8333-333333333333";
const documentId = "44444444-4444-4444-8444-444444444444";
const versionId = "55555555-5555-4555-8555-555555555555";
const runId = "66666666-6666-4666-8666-666666666666";
const clauseId = "77777777-7777-4777-8777-777777777777";
const evidenceId = "88888888-8888-4888-8888-888888888888";
const evidenceIds = [evidenceId];

const sourceFinding = {
  confidence: 0.9,
  review_status: "pending",
  evidence_ids: evidenceIds,
};

test("Phase 3A taxonomies expose the bounded aviation-first values", () => {
  assert.ok(CLAUSE_CATEGORIES.includes("maintenance"));
  assert.ok(CLAUSE_CATEGORIES.includes("delivery/redelivery"));
  assert.ok(RISK_CATEGORIES.includes("liability"));
  assert.ok(DEADLINE_TYPES.includes("redelivery_date"));
  assert.ok(RECOMMENDATION_TYPES.includes("monitor_deadline"));
  assert.deepEqual(ANALYSIS_RUN_STATES, [
    "queued",
    "processing",
    "extracting",
    "analysing",
    "indexing",
    "completed",
    "failed",
    "cancelled",
    "requires_review",
  ]);
});

test("AnalysisRun state machine accepts every valid transition", () => {
  const validTransitions = [
    ["queued", "processing"],
    ["processing", "extracting"],
    ["extracting", "analysing"],
    ["analysing", "indexing"],
    ["indexing", "completed"],
    ["queued", "failed"],
    ["processing", "cancelled"],
    ["analysing", "requires_review"],
    ["indexing", "failed"],
    ["failed", "processing"],
  ];

  for (const [from, to] of validTransitions) {
    assert.equal(canTransitionAnalysisRun(from, to), true);
    assert.doesNotThrow(() => assertAnalysisRunTransition(from, to));
  }

  assert.deepEqual(getAllowedAnalysisRunTransitions("queued"), [
    "processing",
    "failed",
    "cancelled",
  ]);
});

test("AnalysisRun state machine rejects invalid and terminal transitions", () => {
  const invalidTransitions = [
    ["completed", "processing"],
    ["cancelled", "completed"],
    ["failed", "completed"],
    ["queued", "completed"],
    ["extracting", "completed"],
    ["requires_review", "processing"],
  ];

  for (const [from, to] of invalidTransitions) {
    assert.equal(canTransitionAnalysisRun(from, to), false);
    assert.throws(
      () => assertAnalysisRunTransition(from, to),
      (error) => error.code === "INVALID_ANALYSIS_RUN_TRANSITION"
    );
  }

  assert.throws(
    () => assertAnalysisRunRetry({ status: "completed" }),
    (error) => error.code === "ANALYSIS_RUN_RETRY_NOT_ALLOWED"
  );
});

test("AnalysisRun service scopes access and creates retries as new runs", async () => {
  const calls = [];
  let run = {
    id: runId,
    status: "failed",
    organization_id: organizationA,
    contract_id: contractId,
    document_version_id: versionId,
    requested_by: "99999999-9999-4999-8999-999999999999",
    pipeline_version: "phase3a-test",
    intelligence_schema_version: "phase3a-v1",
    retry_count: 0,
  };
  const repository = {
    async getById(id, organizationId) {
      calls.push(["get", id, organizationId]);
      return organizationId === organizationA ? run : null;
    },
    async updateStatus(input) {
      calls.push(["update", input.organizationId, input.status]);
      run = { ...run, status: input.status };
      return run;
    },
    async createRetry(input) {
      calls.push(["retry", input.organizationId]);
      return { ...run, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", status: "processing" };
    },
  };
  const service = createAnalysisRunService(repository);

  const ownRun = await service.getAnalysisRun({
    analysisRunId: runId,
    organizationId: organizationA,
  });
  assert.equal(ownRun.organization_id, organizationA);
  assert.equal(
    await service.getAnalysisRun({ analysisRunId: runId, organizationId: organizationB }),
    null
  );

  await service.retry({ analysisRunId: runId, organizationId: organizationA });
  assert.deepEqual(calls.at(-1), ["retry", organizationA]);
});

test("schemas accept valid findings and reject invalid confidence/enums", () => {
  assert.equal(
    ClassificationSchema.safeParse({
      ...sourceFinding,
      contract_type: "Aircraft Lease Agreement",
    }).success,
    true
  );
  assert.equal(
    ClauseSchema.safeParse({
      ...sourceFinding,
      title: "Maintenance",
      category: "maintenance",
      source_text: "The lessee shall maintain the aircraft.",
    }).success,
    true
  );
  assert.equal(
    ObligationSchema.safeParse({
      ...sourceFinding,
      clause_id: clauseId,
      description: "Maintain the aircraft.",
      obligation_type: "maintenance",
      priority: "high",
    }).success,
    true
  );
  assert.equal(
    RiskSchema.safeParse({
      ...sourceFinding,
      risk_category: "liability",
      severity: "high",
      probability: null,
      explanation: "Liability exposure is stated in the clause.",
    }).success,
    true
  );
  assert.equal(
    RecommendationSchema.safeParse({
      ...sourceFinding,
      recommendation_type: "review",
      action: "Review the liability cap.",
      business_rationale: "The clause creates uncapped exposure.",
      urgency: "high",
    }).success,
    true
  );

  assert.equal(
    ClauseSchema.safeParse({
      ...sourceFinding,
      title: "Unknown",
      category: "not-a-category",
      source_text: "text",
    }).success,
    false
  );
  assert.equal(
    RiskSchema.safeParse({
      ...sourceFinding,
      confidence: 1.1,
      risk_category: "liability",
      severity: "high",
      explanation: "invalid confidence",
    }).success,
    false
  );
});

test("relative deadlines preserve the expression and do not require an absolute date", () => {
  const valid = DeadlineSchema.safeParse({
    ...sourceFinding,
    deadline_type: "relative_deadline",
    original_expression: "within 30 days after receipt of notice",
    anchor_event: "receipt_of_notice",
    offset_value: 30,
    offset_unit: "days",
    normalized_date: null,
  });
  assert.equal(valid.success, true);

  const invalid = DeadlineSchema.safeParse({
    ...sourceFinding,
    deadline_type: "relative_deadline",
    original_expression: "within 30 days after receipt of notice",
    offset_value: 30,
    offset_unit: "days",
    normalized_date: null,
  });
  assert.equal(invalid.success, false);

  const invalidFixed = DeadlineSchema.safeParse({
    ...sourceFinding,
    deadline_type: "fixed_date",
    original_expression: "1 January 2030",
  });
  assert.equal(invalidFixed.success, false);
});

test("provider result cannot represent provider failure as successful empty output", () => {
  assert.equal(
    ProviderResultSchema.safeParse({
      status: "failed",
      metadata: {
        provider: "mistral",
        model: "foundation-only",
        schema_version: "phase3a-v1",
        retry_count: 0,
      },
      error_code: "PROVIDER_TIMEOUT",
    }).success,
    true
  );
  assert.equal(
    ProviderResultSchema.safeParse({
      status: "failed",
      metadata: {
        provider: "mistral",
        model: "foundation-only",
        schema_version: "phase3a-v1",
        retry_count: 0,
      },
    }).success,
    false
  );
});

test("Phase 3A provider adapters are explicit no-call stubs", async () => {
  for (const provider of [
    createOpenAIProvider(),
    createMistralProvider(),
    createAlephAlphaProvider(),
  ]) {
    await assert.rejects(
      () => provider.analyzeStructured({}),
      (error) => error.code === "PHASE3_PROVIDER_NOT_IMPLEMENTED"
    );
  }
});

test("evidence contract supports multiple findings and contradictory support", async () => {
  const evidenceService = createEvidenceService({
    async create({ organizationId, evidence }) {
      assert.equal(organizationId, organizationA);
      return { id: evidenceId, organization_id: organizationId, ...evidence };
    },
    async listByRun({ organizationId }) {
      if (organizationId !== organizationA) return [];
      return [{ id: evidenceId, organization_id: organizationId, support_type: "contradicts" }];
    },
  });

  const evidence = await evidenceService.create({
    organizationId: organizationA,
    evidence: {
      contract_id: contractId,
      document_id: documentId,
      document_version_id: versionId,
      analysis_run_id: runId,
      excerpt: "The supplier may terminate after notice.",
      stage: "clause",
      pipeline_version: "phase3a-test",
      confidence: 0.8,
      evidence_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
  });
  assert.equal(evidence.organization_id, organizationA);
  assert.equal(
    ClauseSchema.safeParse({
      ...sourceFinding,
      title: "Maintenance",
      category: "maintenance",
      source_text: "The lessee shall maintain the aircraft.",
    }).success,
    true
  );
  assert.equal(
    RiskSchema.safeParse({
      ...sourceFinding,
      risk_category: "maintenance/operational",
      severity: "medium",
      probability: null,
      explanation: "The same source supports an operational risk finding.",
    }).success,
    true
  );
  assert.equal((await evidenceService.listByRun({ organizationId: organizationA, analysisRunId: runId }))[0].support_type, "contradicts");
  assert.deepEqual(
    await evidenceService.listByRun({ organizationId: organizationB, analysisRunId: runId }),
    []
  );
});

test("migration declares Phase 3A tables, organization scope, evidence joins, and RLS", async () => {
  const migration = await fs.readFile("supabase/migrations/003_phase3a_foundation.sql", "utf8");
  for (const table of [
    "contract_parties",
    "document_version_pages",
    "intelligence_evidence",
    "clauses",
    "clause_evidence",
    "obligations",
    "obligation_evidence",
    "deadlines",
    "deadline_evidence",
    "risks",
    "risk_evidence",
    "recommendations",
    "recommendation_evidence",
    "contract_search_chunks",
  ]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.match(migration, /organization_id uuid not null/);
  assert.match(migration, /prevent_phase3_result_update/);
  assert.match(migration, /phase3_member_select/);
  assert.match(migration, /extracting/);
  assert.match(migration, /requires_review/);
});
