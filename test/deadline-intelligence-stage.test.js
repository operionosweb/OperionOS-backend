import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import test from "node:test";

import { createDeadlineIntelligenceService, createGatewayDeadlineProvider } from "../services/phase3/intelligence/deadlineIntelligenceService.js";
import { readAnalysisRunDeadlines } from "../routes/analysisRunRoutes.js";

const SCOPE = Object.freeze({
  organizationId: "11111111-1111-4111-8111-111111111111",
  contractId: "22222222-2222-4222-8222-222222222222",
  documentId: "33333333-3333-4333-8333-333333333333",
  documentVersionId: "44444444-4444-4444-8444-444444444444",
  analysisRunId: "55555555-5555-4555-8555-555555555555",
});

function obligation(description, overrides = {}) {
  return {
    id: crypto.randomUUID(),
    clause_id: crypto.randomUUID(),
    obligation_identity: crypto.randomBytes(32).toString("hex"),
    description,
    condition: null,
    evidence: [{ evidence_id: crypto.randomUUID(), rank: 1, support_type: "supports", is_primary: true }],
    ...overrides,
  };
}

function inMemoryRepository({ obligations = [], clauses = [] } = {}) {
  const rows = [];
  const evidence = [];
  return {
    rows,
    evidence,
    async listObligationsWithEvidence() { return obligations; },
    async listClausesForDefinitions() { return clauses; },
    async listByRunScope(scope) {
      return rows.filter((row) => row.organization_id === scope.organizationId
        && row.document_version_id === scope.documentVersionId
        && row.analysis_run_id === scope.analysisRunId);
    },
    async persistDeadlines({ deadlines }) {
      const persisted = [];
      let insertedDeadlines = 0;
      let insertedEvidenceLinks = 0;
      for (const deadline of deadlines) {
        let row = rows.find((entry) => entry.organization_id === deadline.organization_id
          && entry.analysis_run_id === deadline.analysis_run_id
          && entry.obligation_id === deadline.obligation_id
          && entry.deadline_identity === deadline.deadline_identity);
        if (!row) {
          row = { id: crypto.randomUUID(), ...deadline };
          rows.push(row);
          insertedDeadlines += 1;
        }
        persisted.push(row);
        for (const link of deadline.evidence) {
          if (!evidence.some((entry) => entry.deadline_id === row.id && entry.evidence_id === link.evidence_id)) {
            evidence.push({ deadline_id: row.id, ...link });
            insertedEvidenceLinks += 1;
          }
        }
      }
      return { deadlines: persisted, insertedDeadlines, insertedEvidenceLinks };
    },
  };
}

test("50 deterministic temporal expressions consume zero AI Intelligence Budget", async () => {
  const obligations = Array.from({ length: 50 }, (_, index) => obligation(`The Lessee shall notify the Lessor within ${index + 1} days after delivery.`));
  const repository = inMemoryRepository({ obligations });
  const result = await createDeadlineIntelligenceService({ repository }).runStage(SCOPE);

  assert.equal(result.deterministicAnalyses, 50);
  assert.equal(result.aiFallbackAnalyses, 0);
  assert.equal(result.aiIntelligenceConsumed, 0);
  assert.equal(result.cacheHits, 0);
  assert.equal(result.cacheMisses, 0);
  assert.equal(result.deadlines.length, 50);
  assert.ok(result.deadlines.every((row) => row.absolute_date === null));
});

test("deadline materialization is idempotent and preserves obligation evidence provenance", async () => {
  const source = obligation("The Lessee shall notify the Lessor within 5 Business Days after material damage.");
  const repository = inMemoryRepository({ obligations: [source] });
  const service = createDeadlineIntelligenceService({ repository });
  const first = await service.runStage(SCOPE);
  const second = await service.runStage(SCOPE);

  assert.equal(first.status, "deadlines_persisted");
  assert.equal(second.status, "already_processed");
  assert.equal(repository.rows.length, 1);
  assert.equal(repository.evidence.length, 1);
  assert.equal(repository.rows[0].obligation_id, source.id);
  assert.equal(repository.rows[0].source_clause_id, source.clause_id);
  assert.equal(repository.rows[0].source_evidence_id, source.evidence[0].evidence_id);
});

test("termination obligations select an explicit default cure period from clause context", async () => {
  const source = obligation("The Lessor may terminate the Agreement following an uncured Event of Default.");
  const repository = inMemoryRepository({
    obligations: [source],
    clauses: [{
      id: source.clause_id,
      source_text: "Failure to pay Rent within 7 business days after notice constitutes an Event of Default. The Lessor may terminate the Agreement following an uncured Event of Default. Notice must be given within 45 days after the default notice.",
    }],
  });
  const result = await createDeadlineIntelligenceService({ repository }).runStage(SCOPE);
  const deadline = result.deadlines[0];

  assert.equal(deadline.amount, 7);
  assert.equal(deadline.unit, "business_days");
  assert.equal(deadline.direction, "after");
  assert.equal(deadline.anchor_reference, "notice constitutes an event of default");
  assert.equal(deadline.status, "awaiting_trigger");
  assert.match(deadline.timing_expression, /7 business days after notice/i);
  assert.doesNotMatch(deadline.timing_expression, /45 days/i);
  assert.equal(deadline.source_clause_id, source.clause_id);
  assert.equal(deadline.source_evidence_id, source.evidence[0].evidence_id);
});

test("Expiration Date materialization preserves its unresolved anchor and evidence", async () => {
  const source = obligation("The Lessee shall return the Aircraft on the Expiration Date.");
  const repository = inMemoryRepository({ obligations: [source] });
  const result = await createDeadlineIntelligenceService({ repository }).runStage(SCOPE);
  const deadline = result.deadlines[0];

  assert.equal(deadline.deadline_type, "event_based");
  assert.equal(deadline.anchor_reference, "expiration date");
  assert.equal(deadline.direction, "upon");
  assert.equal(deadline.computability, "relative_event");
  assert.equal(deadline.absolute_date, null);
  assert.equal(deadline.status, "awaiting_trigger");
  assert.equal(deadline.source_evidence_id, source.evidence[0].evidence_id);
  assert.deepEqual(deadline.evidence, source.evidence);
});

test("Effective Date definitions resolve deterministically with auditable anchor source", async () => {
  const definitionClauseId = crypto.randomUUID();
  const definitionEvidenceId = crypto.randomUUID();
  const repository = inMemoryRepository({
    obligations: [obligation("The Lessee shall pay within 30 days after the Effective Date.")],
    clauses: [{ id: definitionClauseId, source_evidence_id: definitionEvidenceId, source_text: "Effective Date means 1 September 2026." }],
  });
  const result = await createDeadlineIntelligenceService({ repository }).runStage(SCOPE);
  const deadline = result.deadlines[0];

  assert.equal(deadline.absolute_date, "2026-10-01");
  assert.equal(deadline.metadata.anchor_source.source_clause_id, definitionClauseId);
  assert.equal(deadline.metadata.anchor_source.source_evidence_id, definitionEvidenceId);
  assert.equal(deadline.metadata.calculation.anchor_date, "2026-09-01");
  assert.equal(deadline.metadata.calculation.result, "2026-10-01");
});

test("unresolved and complex timing remains non-computable without invoking AI", async () => {
  const repository = inMemoryRepository({
    obligations: [obligation("The Lessee shall respond within a commercially appropriate operational window determined by prevailing circumstances.")],
  });
  const result = await createDeadlineIntelligenceService({ repository }).runStage(SCOPE);
  assert.equal(result.deadlines[0].deadline_type, "non_computable");
  assert.equal(result.deadlines[0].absolute_date, null);
  assert.equal(result.aiFallbackAnalyses, 0);
  assert.equal(result.aiIntelligenceConsumed, 0);
});

test("non-temporal obligations are skipped while service failure timing preserves evidence", async () => {
  const serviceFailure = obligation("The Operator shall provide the report following a service failure.");
  const repository = inMemoryRepository({
    obligations: [
      obligation("The Supplier shall maintain all required technical records."),
      obligation("The Operator shall maintain insurance coverage."),
      serviceFailure,
    ],
  });
  const result = await createDeadlineIntelligenceService({ repository }).runStage(SCOPE);

  assert.equal(result.deadlines.length, 1);
  assert.equal(result.deadlines[0].deadline_type, "event_based");
  assert.equal(result.deadlines[0].timing_expression, "following a service failure");
  assert.equal(result.deadlines[0].anchor_reference, "service failure");
  assert.equal(result.deadlines[0].direction, "after");
  assert.equal(result.deadlines[0].computability, "relative_event");
  assert.equal(result.deadlines[0].status, "awaiting_trigger");
  assert.equal(result.deadlines[0].absolute_date, null);
  assert.equal(result.deadlines[0].source_evidence_id, serviceFailure.evidence[0].evidence_id);
  assert.deepEqual(result.deadlines[0].evidence, serviceFailure.evidence);
  assert.equal(result.aiFallbackAnalyses, 0);
});

test("version scopes do not share deadline intelligence", async () => {
  const source = obligation("Payment shall be made within 10 days following receipt of invoice.");
  const repository = inMemoryRepository({ obligations: [source] });
  const service = createDeadlineIntelligenceService({ repository });
  const otherScope = {
    ...SCOPE,
    documentVersionId: "66666666-6666-4666-8666-666666666666",
    analysisRunId: "77777777-7777-4777-8777-777777777777",
  };
  await service.runStage(SCOPE);
  await service.runStage(otherScope);

  assert.equal(repository.rows.length, 2);
  assert.notEqual(repository.rows[0].document_version_id, repository.rows[1].document_version_id);
});

test("deadline reads reject cross-tenant analysis runs before repository access", async () => {
  let repositoryCalled = false;
  await assert.rejects(
    () => readAnalysisRunDeadlines({
      organizationId: SCOPE.organizationId,
      analysisRunId: SCOPE.analysisRunId,
      analysisRunRepository: {
        async getById() {
          return { ...SCOPE, organization_id: "88888888-8888-4888-8888-888888888888", document_version_id: SCOPE.documentVersionId };
        },
      },
      deadlineRepository: { async listByRunScope() { repositoryCalled = true; return []; } },
      documentVersionResolver: async () => null,
    }),
    (error) => error.code === "ANALYSIS_RUN_NOT_FOUND"
  );
  assert.equal(repositoryCalled, false);
});

test("migration extends immutable deadlines without updating historical rows", async () => {
  const migration = await fs.readFile("supabase/migrations/011_deadline_temporal_intelligence.sql", "utf8");
  assert.match(migration, /structured_timing jsonb/);
  assert.match(migration, /business_days/);
  assert.match(migration, /event_based/);
  assert.match(migration, /deadlines_identity_scope_uidx/);
  assert.doesNotMatch(migration, /update public\.deadlines/i);
});

test("complex timing uses the controlled fallback with bounded context and no fabricated date", async () => {
  const source = obligation("The Lessee shall respond in the operational window customarily applicable to the relevant maintenance condition.");
  const clause = { id: source.clause_id, source_text: source.description };
  const repository = inMemoryRepository({ obligations: [source], clauses: [clause] });
  const payloads = [];
  const provider = {
    async analyzeStructured(payload) {
      payloads.push(payload);
      return {
        deadline_type: "event_based",
        timing_expression: "operational window customarily applicable",
        trigger_type: "event",
        trigger_expression: "relevant maintenance condition",
        anchor_reference: "relevant maintenance condition",
        direction: "upon",
        computability: "relative_event",
        confidence: 0.72,
      };
    },
  };
  const result = await createDeadlineIntelligenceService({ repository, provider }).runStage({ ...SCOPE, useAIFallback: true });

  assert.equal(result.aiFallbackAnalyses, 1);
  assert.equal(result.deadlines[0].absolute_date, null);
  assert.deepEqual(Object.keys(payloads[0]).sort(), [
    "evidence_ids", "obligation", "obligation_id", "obligation_identity", "organization_id",
    "parser_version", "prompt_version", "relevant_clause", "schema_version", "taxonomy_version", "user_id",
  ]);
  assert.equal(payloads[0].relevant_clause.text, source.description);
  assert.equal("full_contract" in payloads[0], false);
});

test("Gateway fallback records estimate, actual usage, provider miss and cache hit", async () => {
  const calls = [];
  const metrics = {};
  let source = "provider";
  const provider = createGatewayDeadlineProvider({
    metrics,
    gateway: {
      async request(request) {
        calls.push(request);
        return {
          success: true,
          source,
          estimatedIntelligence: 25,
          result: {
            deadline_type: "ambiguous",
            timing_expression: "commercially appropriate period",
            computability: "ambiguous",
            ambiguity: "Contractual standard requires interpretation",
            confidence: 0.65,
          },
          job: { estimatedIntelligence: 25, actualIntelligence: source === "provider" ? 25 : 0 },
        };
      },
    },
  });
  const payload = { organization_id: SCOPE.organizationId, obligation_id: crypto.randomUUID(), parser_version: "v1" };
  await provider.analyzeStructured(payload);
  source = "cache";
  await provider.analyzeStructured(payload);

  assert.equal(calls[0].operation, "clause_interpretation");
  assert.equal(calls[0].structured, true);
  assert.equal(metrics.requests, 2);
  assert.equal(metrics.estimatedIntelligence, 50);
  assert.equal(metrics.actualIntelligence, 25);
  assert.equal(metrics.cacheMisses, 1);
  assert.equal(metrics.cacheHits, 1);
});