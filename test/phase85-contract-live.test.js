import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { assertConfig, assertLiveFindings, assertTenantDenials, createSyntheticPdf } from "./phase85-contract-live.js";

test("live command blocks without configuration before any remote operation", () => {
  const result = spawnSync(process.execPath, ["test\\phase85-contract-live.js"], {
    cwd: process.cwd(), encoding: "utf8", env: { SystemRoot: process.env.SystemRoot || "" },
  });
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.equal(report.code, "CONFIGURATION_BLOCKED");
  assert.ok(report.missing.includes("AZURE_OPENAI_API_KEY"));
  assert.ok(report.approvalsRequired.includes("CONTRACT_TEST_DEPLOYMENT_LIMITS_VERIFIED"));
});

test("unapproved AI and wrong project are rejected before live work", () => {
  assert.throws(() => assertConfig({
    PHASE3_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
    CONTRACT_TEST_PRODUCTION_PROJECT_REF: "abcdefghijklmnopqrst",
  }), (error) => error.code === "CONFIGURATION_BLOCKED"
    && error.errors.includes("PRODUCTION_PROJECT_REJECTED")
    && error.approvalsRequired.includes("CONTRACT_AI_PROVIDER_APPROVED"));
});

function profile() {
  const categories = ["summary", "clause", "obligation", "deadline", "financial_commitment", "risk", "recommendation"];
  return { metadata: { aiAnalysis: {
    method: "ai", provider: "azure_openai", status: "requires_review",
    findings: categories.map((category) => ({
      category, reviewStatus: "requires_review",
      evidence: { evidenceId: "evidence", documentVersionId: "version", evidenceText: "Source quotation" },
    })),
  } } };
}

test("live success requires AI findings and exact source evidence", () => {
  assert.equal(assertLiveFindings(profile(), "Original Source quotation from agreement", "version").length, 7);
  const deterministic = profile();
  deterministic.metadata.aiAnalysis.method = "deterministic";
  assert.throws(() => assertLiveFindings(deterministic, "Source quotation", "version"), { code: "AI_RESULT_REQUIRED" });
  assert.throws(() => assertLiveFindings(profile(), "Different document", "version"), { code: "SOURCE_EVIDENCE_INVALID" });
  const missing = profile();
  missing.metadata.aiAnalysis.findings.pop();
  assert.throws(() => assertLiveFindings(missing, "Source quotation", "version"), { code: "AI_CATEGORIES_INCOMPLETE" });
});

test("tenant isolation cannot pass on transport failures or untested access", () => {
  assert.doesNotThrow(() => assertTenantDenials({ apiOther: 404, apiAnonymous: 401, databaseOther: 0, storageOther: 403 }));
  for (const altered of [
    { apiOther: 503, apiAnonymous: 401, databaseOther: 0, storageOther: 403 },
    { apiOther: 404, apiAnonymous: 401, databaseOther: 1, storageOther: 403 },
    { apiOther: 404, apiAnonymous: 401, databaseOther: 0, storageOther: undefined },
  ]) assert.throws(() => assertTenantDenials(altered), { code: "TENANT_ISOLATION_UNVERIFIED" });
});

test("synthetic lease PDF is stable across retries", async () => {
  assert.deepEqual(await createSyntheticPdf(), await createSyntheticPdf());
});

test("synthetic lease PDF is readable by the actual document extractor", async () => {
  const { extractDocumentMetadata } = await import("../services/documentIngestionService.js");
  const parsed = await extractDocumentMetadata(await createSyntheticPdf(), ".pdf", { ocrProvider: null });
  assert.equal(parsed.requiresOcr, false);
  for (const phrase of ["SYNTHETIC AIRCRAFT LEASE AGREEMENT", "MAINTENANCE RESERVES", "EXTENSION OPTION"]) {
    assert.ok(parsed.text.includes(phrase));
  }
});
