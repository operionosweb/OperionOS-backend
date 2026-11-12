import assert from "node:assert/strict";
import test from "node:test";
import { createAnalysisRunRepository } from "../repositories/phase3/analysisRunRepository.js";

test("analysis claim accepts only a database-issued, tenant-scoped fencing context", async () => {
  let rpcCall;
  const filters = [];
  const client = {
    async rpc(functionName, parameters) {
      rpcCall = { functionName, parameters };
      return {
        data: [{
          worker_id: "33333333-3333-4333-8333-333333333333",
          execution_id: "44444444-4444-4444-8444-444444444444",
          generation: "1",
          token: "a".repeat(64),
        }],
        error: null,
      };
    },
    from(table) {
      assert.equal(table, "analysis_runs");
      return {
        select() { return this; },
        eq(column, value) { filters.push([column, value]); return this; },
        async maybeSingle() {
          return {
            data: {
              id: "22222222-2222-4222-8222-222222222222",
              organization_id: "11111111-1111-4111-8111-111111111111",
              status: "processing",
            },
            error: null,
          };
        },
      };
    },
  };
  const organizationId = "11111111-1111-4111-8111-111111111111";
  const analysisRunId = "22222222-2222-4222-8222-222222222222";
  const claim = await createAnalysisRunRepository(client).claimQueued({
    organizationId, analysisRunId, startedAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(rpcCall.functionName, "claim_analysis_execution");
  assert.deepEqual(rpcCall.parameters, {
    p_organization_id: organizationId,
    p_analysis_run_id: analysisRunId,
  });
  assert.equal(claim.run.status, "processing");
  assert.equal(claim.fenceContext.workerId, "33333333-3333-4333-8333-333333333333");
  assert.equal(claim.fenceContext.executionId, "44444444-4444-4444-8444-444444444444");
  assert.equal(claim.fenceContext.token, "a".repeat(64));
  assert.deepEqual(filters, [["id", analysisRunId], ["organization_id", organizationId]]);
});
