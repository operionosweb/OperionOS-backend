import assert from "node:assert/strict";
import test from "node:test";
import { assertAnalysisIngestionReady } from "../routes/analysisRunRoutes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const versionId = "22222222-2222-4222-8222-222222222222";

function clientWith(result, filters) {
  return {
    from(table) {
      assert.equal(table, "contract_upload_journal");
      return {
        select() { return this; },
        eq(column, value) { filters.push([column, value]); return this; },
        async maybeSingle() { return result; },
      };
    },
  };
}

test("manual analysis rejects staged and incomplete uploads", async () => {
  const staged = { status: "awaiting_ingestion", document_version_id: versionId };
  await assert.rejects(assertAnalysisIngestionReady({ run: staged, organizationId, client: {} }), { code: "INGESTION_NOT_READY" });
  const filters = [];
  const failed = { status: "failed", document_version_id: versionId };
  await assert.rejects(assertAnalysisIngestionReady({
    run: failed, organizationId, client: clientWith({ data: { state: "manual_review" }, error: null }, filters),
  }), { code: "INGESTION_NOT_READY" });
  assert.deepEqual(filters, [["organization_id", organizationId], ["document_version_id", versionId]]);
});

test("manual analysis permits ready and legacy documents, but fails closed on lookup errors", async () => {
  const run = { status: "queued", document_version_id: versionId };
  for (const data of [{ state: "ready" }, null]) {
    await assert.doesNotReject(assertAnalysisIngestionReady({
      run, organizationId, client: clientWith({ data, error: null }, []),
    }));
  }
  await assert.rejects(assertAnalysisIngestionReady({
    run, organizationId, client: clientWith({ data: null, error: { code: "synthetic" } }, []),
  }), { code: "STORAGE_ERROR" });
});
