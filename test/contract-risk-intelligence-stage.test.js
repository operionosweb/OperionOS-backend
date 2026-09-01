import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import test from "node:test";

import { createAIGateway, createInMemoryIntelligenceStore } from "../services/ai/aiGateway.js";
import {
  createContractRiskIntelligenceService,
  createGatewayRiskProvider,
} from "../services/phase3/intelligence/contractRiskIntelligenceService.js";
import { readAnalysisRunRisks } from "../routes/analysisRunRoutes.js";

const SCOPE = Object.freeze({
  organizationId: "11111111-1111-4111-8111-111111111111",
  contractId: "22222222-2222-4222-8222-222222222222",
  documentId: "33333333-3333-4333-8333-333333333333",
  documentVersionId: "44444444-4444-4444-8444-444444444444",
  analysisRunId: "55555555-5555-4555-8555-555555555555",
});

function clause(sourceText, overrides = {}) {
  return {
    id: crypto.randomUUID(),
    source_text: sourceText,
    source_evidence_id: crypto.randomUUID(),
    evidence: [],
    ...overrides,
  };
}

function withEvidence(item) {
  return {
    ...item,
    evidence: [{ evidence_id: item.source_evidence_id, rank: 1, support_type: "supports", is_primary: true }],
  };
}

function inMemoryRepository(intelligence) {
  const rows = [];
  const links = [];
  return {
    rows,
    links,
    async listIntelligence() { return intelligence; },
    async listByRunScope(scope) {
      return rows.filter((row) => row.organization_id === scope.organizationId
        && row.document_version_id === scope.documentVersionId
        && row.analysis_run_id === scope.analysisRunId);
    },
    async persistRisks({ risks }) {
      let insertedRisks = 0;
      let insertedEvidenceLinks = 0;
      const persisted = [];
      for (const risk of risks) {
        let row = rows.find((item) => item.organization_id === risk.organization_id
          && item.analysis_run_id === risk.analysis_run_id
          && item.risk_identity === risk.risk_identity);
        if (!row) {
          row = { id: crypto.randomUUID(), ...risk };
          rows.push(row);
          insertedRisks += 1;
        }
        persisted.push(row);
        for (const link of risk.evidence) {
          if (!links.some((item) => item.risk_id === row.id && item.evidence_id === link.evidence_id)) {
            links.push({ risk_id: row.id, ...link });
            insertedEvidenceLinks += 1;
          }
        }
      }
      return { risks: persisted, insertedRisks, insertedEvidenceLinks };
    },
  };
}

test("100-clause economics case screens to 10 deterministic candidates with zero AI", async () => {
  const risky = Array.from({ length: 10 }, (_, index) => withEvidence(clause(`Late payment incurs a fee of EUR ${100_000 + index}.`)));
  const ordinary = Array.from({ length: 90 }, (_, index) => withEvidence(clause(`The Lessee shall maintain record set ${index + 1}.`)));
  const clauses = [...risky, ...ordinary];
  const obligations = Array.from({ length: 50 }, (_, index) => ({ id: crypto.randomUUID(), clause_id: clauses[index].id, obligation_type: "maintenance" }));
  const deadlines = Array.from({ length: 40 }, (_, index) => ({
    id: crypto.randomUUID(), source_clause_id: clauses[index].id, obligation_id: obligations[index].id,
    deadline_type: "relative", amount: 30, unit: "days", confidence: 0.98,
  }));
  const repository = inMemoryRepository({ clauses, obligations, deadlines });
  const result = await createContractRiskIntelligenceService({ repository }).runStage(SCOPE);

  assert.equal(result.totalClauses, 100);
  assert.equal(result.totalObligations, 50);
  assert.equal(result.totalDeadlines, 40);
  assert.equal(result.deterministicCandidates, 10);
  assert.equal(result.aiCandidates, 0);
  assert.equal(result.aiRequests, 0);
  assert.equal(result.estimatedIntelligence, 0);
  assert.equal(result.actualIntelligence, 0);
  assert.equal(result.risks.length, 10);
});

test("300-page synthetic contract sends only reduced candidates to AI and reuses gateway cache", async () => {
  const filler = "Routine aircraft maintenance record requirement ".repeat(80);
  const clauses = Array.from({ length: 300 }, (_, index) => withEvidence(clause(index === 217
    ? "Performance is subject to availability and a commercially reasonable maintenance window."
    : `Page ${index + 1}. ${filler}`)));
  const providerCalls = [];
  const store = createInMemoryIntelligenceStore();
  const gateway = createAIGateway({
    store,
    providers: {
      mistral: {
        name: "mistral",
        model: "test-mistral",
        async generate(request) {
          providerCalls.push(request);
          const payload = JSON.parse(request.input);
          return {
            output: {
              risks: [{
                category: "operational",
                risk_type: "availability_exposure",
                title: "Availability-dependent maintenance performance",
                description: "Performance depends on availability under an interpretive contractual standard.",
                rationale: "The supplied clause combines an availability dependency with a commercially reasonable window.",
                severity: "medium",
                confidence: 0.82,
                source_clause_ids: [payload.candidate_clauses[0].id],
                consequence: "The dependency may affect performance of the stated maintenance requirement.",
              }],
            },
            usage: { intelligence: 35 },
          };
        },
      },
    },
  });
  gateway.setBudget(SCOPE.organizationId, { allocated: 1000 });
  const metrics = {};
  const provider = createGatewayRiskProvider({ gateway, metrics });
  const repository = inMemoryRepository({ clauses, obligations: [], deadlines: [] });
  const service = createContractRiskIntelligenceService({ repository, provider, metrics });

  const first = await service.runStage({ ...SCOPE, useAIFallback: true });
  const second = await service.runStage({ ...SCOPE, useAIFallback: true });

  assert.equal(first.aiCandidates, 1);
  assert.equal(first.aiRequests, 1);
  assert.equal(providerCalls.length, 1);
  assert.equal(providerCalls[0].input.includes("Page 1."), false);
  const sent = JSON.parse(providerCalls[0].input);
  assert.deepEqual(Object.keys(sent).sort(), [
    "candidate_clauses", "organization_id", "prompt_version", "related_deadlines",
    "related_obligations", "schema_version", "source_intelligence_version", "taxonomy_version", "user_id",
  ]);
  assert.equal(sent.candidate_clauses.length, 1);
  assert.equal("full_contract" in sent, false);
  assert.equal(first.actualIntelligence, 35);
  assert.equal(second.cacheHits, 1);
  assert.equal(repository.rows.length, 1);
});

test("invalid semantic sources fail only their batch and preserve deterministic risks", async () => {
  const clauses = [
    withEvidence(clause("Late payment incurs a fee of EUR 100,000.")),
    withEvidence(clause("Performance is subject to availability.")),
  ];
  const repository = inMemoryRepository({ clauses, obligations: [], deadlines: [] });
  const provider = {
    async analyzeStructured() {
      return {
        risks: [{
          category: "operational", risk_type: "availability_exposure", title: "Invalid source",
          description: "Unsupported source.", rationale: "Unsupported source.", severity: "medium",
          confidence: 0.8, source_clause_ids: [crypto.randomUUID()], consequence: null,
        }],
      };
    },
  };
  const result = await createContractRiskIntelligenceService({ repository, provider }).runStage({ ...SCOPE, useAIFallback: true });

  assert.equal(result.status, "partial_failure");
  assert.equal(result.failedCandidates.length, 1);
  assert.equal(result.risks.length, 1);
  assert.equal(result.risks[0].risk_type, "penalty_exposure");
});

test("severity calibration covers recurring, timing, financial, and explicit uncapped exposure", async () => {
  const recurringClause = withEvidence(clause("The Lessee shall report compliance annually."));
  const shortClause = withEvidence(clause("The Lessee shall notify damage within 2 days."));
  const highClause = withEvidence(clause("Late payment incurs a fee of EUR 100,000."));
  const criticalClause = withEvidence(clause("Liability for all losses is expressly unlimited."));
  const obligations = [{ id: crypto.randomUUID(), clause_id: recurringClause.id, obligation_type: "compliance" }];
  const deadlines = [
    { id: crypto.randomUUID(), source_clause_id: recurringClause.id, obligation_id: obligations[0].id, deadline_type: "recurring", recurrence: { frequency: "annually" }, confidence: 0.98 },
    { id: crypto.randomUUID(), source_clause_id: shortClause.id, deadline_type: "relative", amount: 2, unit: "days", confidence: 0.98 },
  ];
  const repository = inMemoryRepository({ clauses: [recurringClause, shortClause, highClause, criticalClause], obligations, deadlines });
  const result = await createContractRiskIntelligenceService({ repository }).runStage(SCOPE);

  assert.deepEqual(new Set(result.risks.map((risk) => risk.severity)), new Set(["low", "high", "critical"]));
  assert.equal(result.risks.find((risk) => risk.risk_type === "recurring_compliance").severity, "low");
  assert.equal(result.risks.find((risk) => risk.risk_type === "short_notice_period").severity, "high");
});

test("Step 7 migration enforces identity, probability absence, and version scope", async () => {
  const migration = await fs.readFile("supabase/migrations/012_contract_risk_intelligence.sql", "utf8");
  assert.match(migration, /risks_identity_scope_uidx/);
  assert.match(migration, /probability is null/);
  assert.match(migration, /document_version_id/);
  assert.doesNotMatch(migration, /update public\.risks/i);
});

test("risk persistence is idempotent and retains evidence provenance", async () => {
  const source = withEvidence(clause("Late payment incurs a fee of EUR 100,000."));
  const repository = inMemoryRepository({ clauses: [source], obligations: [], deadlines: [] });
  const service = createContractRiskIntelligenceService({ repository });
  const first = await service.runStage(SCOPE);
  const second = await service.runStage(SCOPE);

  assert.equal(first.insertedRisks, 1);
  assert.equal(second.insertedRisks, 0);
  assert.equal(second.status, "already_processed");
  assert.equal(repository.rows.length, 1);
  assert.equal(repository.links.length, 1);
  assert.equal(repository.links[0].evidence_id, source.source_evidence_id);
});

test("contract version scopes do not inherit prior risk records", async () => {
  const source = withEvidence(clause("Liability for all losses is unlimited."));
  const repository = inMemoryRepository({ clauses: [source], obligations: [], deadlines: [] });
  const service = createContractRiskIntelligenceService({ repository });
  const nextScope = {
    ...SCOPE,
    documentVersionId: "66666666-6666-4666-8666-666666666666",
    analysisRunId: "77777777-7777-4777-8777-777777777777",
  };
  await service.runStage(SCOPE);
  await service.runStage(nextScope);

  assert.equal(repository.rows.length, 2);
  assert.notEqual(repository.rows[0].document_version_id, repository.rows[1].document_version_id);
  assert.notEqual(repository.rows[0].analysis_run_id, repository.rows[1].analysis_run_id);
});

test("risk reads reject cross-tenant analysis runs before repository access", async () => {
  let repositoryCalled = false;
  await assert.rejects(
    () => readAnalysisRunRisks({
      organizationId: SCOPE.organizationId,
      analysisRunId: SCOPE.analysisRunId,
      analysisRunRepository: {
        async getById() {
          return { organization_id: "88888888-8888-4888-8888-888888888888", document_version_id: SCOPE.documentVersionId };
        },
      },
      riskRepository: { async listByRunScope() { repositoryCalled = true; return []; } },
      documentVersionResolver: async () => null,
    }),
    (error) => error.code === "ANALYSIS_RUN_NOT_FOUND"
  );
  assert.equal(repositoryCalled, false);
});