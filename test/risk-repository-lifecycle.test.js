import assert from "node:assert/strict";
import test from "node:test";

import { createRiskRepository } from "../repositories/phase3/riskRepository.js";

const SCOPE = Object.freeze({
  organizationId: "11111111-1111-4111-8111-111111111111",
  contractId: "22222222-2222-4222-8222-222222222222",
  documentId: "33333333-3333-4333-8333-333333333333",
  documentVersionId: "44444444-4444-4444-8444-444444444444",
  analysisRunId: "55555555-5555-4555-8555-555555555555",
  fence: {
    workerId: "99999999-9999-4999-8999-999999999999",
    executionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    generation: "1",
    token: "a".repeat(64),
  },
});

function fakePool({ existingRisk = null, supersededRows = [] } = {}) {
  const calls = [];
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [], rowCount: 0 };
      }
      if (sql.startsWith("select public.begin_analysis_fenced_write_v2")) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("set status = 'superseded'")) {
        return { rows: supersededRows, rowCount: supersededRows.length };
      }
      if (sql.startsWith("insert into risks")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("select * from risks")) {
        return { rows: existingRisk ? [{ ...existingRisk }] : [], rowCount: existingRisk ? 1 : 0 };
      }
      if (sql.startsWith("update risks set")) {
        return {
          rows: existingRisk ? [{
            ...existingRisk,
            title: "Updated contractual exposure",
            metadata: { deterministic: true, recommended_action: "Updated action" },
          }] : [],
          rowCount: existingRisk ? 1 : 0,
        };
      }
      if (sql.startsWith("insert into risk_evidence")) return { rows: [], rowCount: 1 };
      throw new Error(`Unexpected SQL in repository test: ${sql}`);
    },
    release() {},
  };
  return {
    calls,
    pool: { async connect() { return client; } },
  };
}

function candidate(overrides = {}) {
  return {
    organization_id: SCOPE.organizationId,
    contract_id: SCOPE.contractId,
    document_id: SCOPE.documentId,
    document_version_id: SCOPE.documentVersionId,
    analysis_run_id: SCOPE.analysisRunId,
    clause_id: "66666666-6666-4666-8666-666666666666",
    risk_category: "financial",
    risk_type: "penalty_exposure",
    title: "Updated contractual exposure",
    description: "An explicit payment consequence.",
    rationale: "The clause states a financial consequence.",
    severity: "medium",
    probability: null,
    confidence: 0.96,
    source_type: "clause",
    source_references: [],
    affected_obligation_ids: [],
    affected_deadline_ids: [],
    status: "identified",
    risk_version: "phase3e-contract-risk-v1:deterministic",
    metadata: { deterministic: true, recommended_action: "Updated action" },
    risk_identity: "a".repeat(64),
    review_status: "pending",
    evidence: [{
      evidence_id: "77777777-7777-4777-8777-777777777777",
      rank: 1,
      support_type: "supports",
      is_primary: true,
    }],
    ...overrides,
  };
}

test("risk reconciliation updates an existing finding and supersedes removed findings transactionally", async () => {
  const existingRisk = {
    id: "88888888-8888-4888-8888-888888888888",
    ...candidate({
      title: "Old contractual exposure",
      metadata: { deterministic: true, superseded_at: "old" },
    }),
  };
  const { calls, pool } = fakePool({ existingRisk, supersededRows: [{ id: "stale-risk" }] });
  const repository = createRiskRepository({}, pool);
  const result = await repository.persistRisks({
    ...SCOPE,
    reconciliationGroups: [{
      riskVersion: "phase3e-contract-risk-v1:deterministic",
      riskIdentities: ["a".repeat(64)],
    }],
    risks: [candidate()],
  });

  assert.equal(result.updatedRisks, 1);
  assert.equal(result.supersededRisks, 1);
  assert.equal(result.insertedRisks, 0);
  assert.match(result.risks[0].title, /Updated contractual exposure/);
  const supersedeCall = calls.find(({ sql }) => sql.includes("set status = 'superseded'"));
  assert.deepEqual(supersedeCall.values, [
    SCOPE.organizationId,
    SCOPE.contractId,
    SCOPE.documentId,
    SCOPE.documentVersionId,
    SCOPE.analysisRunId,
    "phase3e-contract-risk-v1:deterministic",
    ["a".repeat(64)],
  ]);
  const updateCall = calls.find(({ sql }) => sql.startsWith("update risks set"));
  assert.match(updateCall.sql, /status = case when status = 'superseded'/);
  assert.match(updateCall.sql, /'superseded_at'/);
  assert.ok(calls.some(({ sql }) => sql === "COMMIT"));
});

test("an empty current finding set still supersedes prior deterministic findings", async () => {
  const { calls, pool } = fakePool({ supersededRows: [{ id: "stale-risk" }] });
  const repository = createRiskRepository({}, pool);
  const result = await repository.persistRisks({
    ...SCOPE,
    reconciliationGroups: [{
      riskVersion: "phase3e-contract-risk-v1:deterministic",
      riskIdentities: [],
    }],
    risks: [],
  });

  assert.deepEqual(result, {
    risks: [],
    insertedRisks: 0,
    updatedRisks: 0,
    supersededRisks: 1,
    insertedEvidenceLinks: 0,
  });
  assert.ok(calls.some(({ sql }) => sql.includes("set status = 'superseded'")));
  assert.ok(calls.some(({ sql }) => sql === "COMMIT"));
});
