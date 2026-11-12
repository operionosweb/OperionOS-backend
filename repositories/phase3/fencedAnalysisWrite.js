import { assertOrganizationScope, assertResourceId } from "./scope.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{64}$/;

export function assertFenceContext(fence) {
  if (!fence || !UUID.test(fence.workerId || "")
      || !UUID.test(fence.executionId || "")
      || !/^[1-9]\d*$/.test(String(fence.generation))
      || !TOKEN.test(fence.token || "")) {
    throw Object.assign(new Error("A database-issued analysis fence is required"), {
      code: "ANALYSIS_FENCE_CONTEXT_REQUIRED",
      status: 409,
    });
  }
}

export async function beginFencedAnalysisWrite(client, { organizationId, analysisRunId, fence }) {
  assertOrganizationScope(organizationId);
  assertResourceId(analysisRunId, "analysisRunId");
  assertFenceContext(fence);
  await client.query(
    "select public.begin_analysis_fenced_write_v2($1,$2,$3,$4,$5,$6)",
    [organizationId, analysisRunId, fence.workerId, fence.executionId, fence.generation, fence.token]
  );
}
