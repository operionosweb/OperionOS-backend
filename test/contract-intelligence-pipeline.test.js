import assert from "node:assert/strict";
import test from "node:test";

import { createContractIntelligencePipeline } from "../services/phase3/analysis/contractIntelligencePipeline.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const contractId = "22222222-2222-4222-8222-222222222222";
const documentId = "33333333-3333-4333-8333-333333333333";
const documentVersionId = "44444444-4444-4444-8444-444444444444";
const analysisRunId = "55555555-5555-4555-8555-555555555555";
const fenceContext = {
  workerId: "66666666-6666-4666-8666-666666666666",
  executionId: "77777777-7777-4777-8777-777777777777",
  generation: "1",
  token: "a".repeat(64),
};

function fixture({ status = "queued", failClauseStage = false, clauseFailure = null, failProfilePersist = false, failFailureStateUpdate = false, conflictingIdentifiers = false, aiAnalysisService, assertAIApproval, existingProfile, synchronizeReads = false, claimTimeoutAfterCommit = false, loseLockAfterClause = false, loseLockDuringAI = false } = {}) {
  const transitions = [];
  const calls = [];
  const indexed = [];
  const relationships = [];
  let lockLost = false;
  let run = { id: analysisRunId, organization_id: organizationId, contract_id: contractId, document_version_id: documentVersionId, status };
  let reads = 0;
  let releaseReads;
  const bothReads = new Promise((resolve) => { releaseReads = resolve; });
  const evidence = { id: "66666666-6666-4666-8666-666666666666", page_number: 1, source_locator: "page:1:char:0-120", excerpt: "AIRCRAFT LEASE AGREEMENT", char_start: 0, char_end: 120, confidence: 0.95 };
  const clause = { id: "77777777-7777-4777-8777-777777777777", clause_number: "1", title: "AIRCRAFT LEASE AGREEMENT", source_text: `AIRCRAFT LEASE AGREEMENT\nRegistration: G-SYN1${conflictingIdentifiers ? "\nRegistration: G-SYN2" : ""}\nThe Lessee shall maintain the Aircraft.` };
  const analysisRunRepository = {
    getById: async () => {
      const snapshot = { ...run };
      if (synchronizeReads) {
        reads += 1;
        if (reads === 2) releaseReads();
        await bothReads;
      }
      return snapshot;
    },
    claimQueued: async () => {
      if (run.status !== "queued") return null;
      transitions.push({ status: "processing", errorMessage: null });
      run = { ...run, status: "processing" };
      if (claimTimeoutAfterCommit) throw Object.assign(new Error("synthetic response timeout"), { code: "ETIMEDOUT" });
      return { run, fenceContext };
    },
    updateStatus: async (update) => {
      if (failFailureStateUpdate && update.status === "failed") {
        throw Object.assign(new Error("private status update detail"), { code: "STATUS_WRITE_FAILED" });
      }
      transitions.push({ status: update.status, errorMessage: update.errorMessage || null, errorCode: update.errorCode || null });
      run = { ...run, status: update.status };
      return run;
    },
  };
  const profileRepository = {
    getByRun: async () => existingProfile || (status === "completed" ? { id: "profile-existing" } : null),
    listClauseSources: async () => [{ ...clause, evidence: [evidence] }],
    persist: async ({ profile }) => {
      calls.push("profile");
      if (failProfilePersist) throw Object.assign(new Error("synthetic persistence failure"), { code: "PERSIST_FAILED" });
      return { id: "profile-new", ...profile };
    },
  };
  const pipeline = createContractIntelligencePipeline({
    withLock: async (_keys, operation) => operation(() => {
      if (lockLost) throw Object.assign(new Error("synthetic lock loss"), { code: "OPERATION_LOCK_LOST" });
    }),
    analysisRunRepository,
    profileRepository,
    searchRepository: {
      replaceForRun: async ({ chunks }) => {
        calls.push("search");
        indexed.push(...chunks);
        return chunks;
      },
    },
    sourceService: {
      load: async () => ({ contractId, documentId }),
    },
    clauseStage: async () => {
      calls.push("clauses");
      if (clauseFailure) throw clauseFailure;
      if (failClauseStage) throw Object.assign(new Error("source text must not enter persisted failure details"), { code: "CLAUSE_FAILED" });
      if (loseLockAfterClause) lockLost = true;
      return { clauses: [clause], evidence: [evidence], clauseEvidence: [{ clause_id: clause.id, evidence_id: evidence.id }] };
    },
    obligationService: { runStage: async () => { calls.push("obligations"); return { obligations: [] }; } },
    deadlineService: { runStage: async () => { calls.push("deadlines"); return { deadlines: [] }; } },
    riskService: { runStage: async () => { calls.push("risks"); return { risks: [] }; } },
    aviationRelationshipRepository: {
      async materializeContractRelationships(input) {
        calls.push("relationships");
        relationships.push(input);
        return input.identifiers.length ? [{ id: "relationship-1" }] : [];
      },
    },
    ...(aiAnalysisService ? { aiAnalysisService: {
      async analyze(args) {
        const result = await aiAnalysisService.analyze(args);
        if (loseLockDuringAI) lockLost = true;
        return result;
      },
    } } : {}),
    ...(assertAIApproval ? { assertAIApproval } : {}),
  });
  return { pipeline, transitions, calls, indexed, relationships };
}

test("pipeline composes deterministic stages and completes an evidence-grounded index", async () => {
  const context = fixture();
  const result = await context.pipeline.run({ organizationId, analysisRunId });

  assert.equal(result.status, "completed");
  assert.deepEqual(context.transitions.map((item) => item.status), ["processing", "extracting", "analysing", "indexing", "completed"]);
  assert.deepEqual(context.calls, ["clauses", "obligations", "deadlines", "risks", "profile", "relationships", "search"]);
  assert.equal(result.profile.metadata.contractType, "AIRCRAFT_LEASE");
  assert.equal(context.indexed.length, 1);
  assert.equal(context.indexed[0].page_start, 1);
  assert.equal(context.indexed[0].analysis_run_id, analysisRunId);
  assert.equal(context.relationships[0].relationshipType, "leased_under");
  assert.equal(context.relationships[0].identifiers[0].value, "G-SYN1");
  assert.equal(result.counts.aircraftRelationships, 1);
});

test("observed lock loss stops subsequent analysis and does not write a failure status", async () => {
  const context = fixture({ loseLockAfterClause: true });
  await assert.rejects(context.pipeline.run({ organizationId, analysisRunId }), { code: "OPERATION_LOCK_LOST" });
  assert.deepEqual(context.calls, ["clauses"]);
  assert.deepEqual(context.transitions.map((item) => item.status), ["processing", "extracting"]);
});

test("observed lock loss during AI prevents later profile and completion writes", async () => {
  const context = fixture({
    loseLockDuringAI: true,
    assertAIApproval: () => {},
    aiAnalysisService: { async analyze() { return { method: "ai", status: "requires_review", findings: [] }; } },
  });
  await assert.rejects(context.pipeline.run({ organizationId, analysisRunId, useAI: true, confirmAIBudget: true }), { code: "OPERATION_LOCK_LOST" });
  assert.equal(context.calls.includes("profile"), false);
  assert.equal(context.calls.includes("search"), false);
  assert.equal(context.transitions.some((item) => ["failed", "completed"].includes(item.status)), false);
});

test("opt-in AI runs only after approval and persists separately from deterministic results", async () => {
  const ai = { async analyze({ scope, clauses, confirmation }) {
    assert.equal(scope.organizationId, organizationId);
    assert.equal(clauses[0].evidence[0].id, "66666666-6666-4666-8666-666666666666");
    assert.equal(confirmation, true);
    return { method: "ai", status: "requires_review", findings: [] };
  } };
  const context = fixture({ aiAnalysisService: ai, assertAIApproval: () => {} });
  const result = await context.pipeline.run({ organizationId, analysisRunId, useAI: true, confirmAIBudget: true });
  assert.equal(result.profile.metadata.aiAnalysis.method, "ai");
  assert.equal(result.profile.metadata.aiAnalysis.status, "requires_review");
  assert.equal(result.profile.metadata.contractType, "AIRCRAFT_LEASE");
});

test("AI request fails before processing when approval or confirmation is missing", async () => {
  const context = fixture({ assertAIApproval: () => {} });
  await assert.rejects(context.pipeline.run({ organizationId, analysisRunId, useAI: true }), { code: "AI_CONFIRMATION_REQUIRED" });
  assert.deepEqual(context.transitions, []);
  const blocked = fixture({ assertAIApproval: () => { throw Object.assign(new Error("not approved"), { code: "CONTRACT_AI_NOT_APPROVED" }); } });
  await assert.rejects(blocked.pipeline.run({ organizationId, analysisRunId, useAI: true, confirmAIBudget: true }), { code: "CONTRACT_AI_NOT_APPROVED" });
  assert.deepEqual(blocked.calls, []);
});

test("AI cannot overwrite a previously persisted deterministic profile", async () => {
  const context = fixture({ existingProfile: { metadata: {} }, assertAIApproval: () => {} });
  await assert.rejects(context.pipeline.run({ organizationId, analysisRunId, useAI: true, confirmAIBudget: true }), { code: "AI_NEW_RUN_REQUIRED" });
  assert.deepEqual(context.transitions, []);
});

test("AI failure records failed processing without persisting a misleading profile", async () => {
  const context = fixture({
    assertAIApproval: () => {},
    aiAnalysisService: { async analyze() { throw Object.assign(new Error("synthetic private content"), { code: "AI_SOURCE_MISMATCH" }); } },
  });
  await assert.rejects(context.pipeline.run({ organizationId, analysisRunId, useAI: true, confirmAIBudget: true }), { code: "AI_SOURCE_MISMATCH" });
  assert.equal(context.transitions.at(-1).status, "failed");
  assert.equal(context.transitions.at(-1).errorMessage, "Contract intelligence processing failed");
  assert.equal(context.calls.includes("profile"), false);
});

test("a failed profile write cannot automatically repeat a potentially charged AI call", async () => {
  let calls = 0;
  const context = fixture({
    failProfilePersist: true,
    assertAIApproval: () => {},
    aiAnalysisService: { async analyze() { calls += 1; return { method: "ai", status: "requires_review", findings: [] }; } },
  });
  const args = { organizationId, analysisRunId, useAI: true, confirmAIBudget: true };
  await assert.rejects(context.pipeline.run(args), { code: "PERSIST_FAILED" });
  await assert.rejects(context.pipeline.run(args), { code: "AI_RETRY_REQUIRES_REVIEW" });
  assert.equal(calls, 1);
});

test("two workers reading queued state cannot both claim or invoke AI", async () => {
  let calls = 0;
  const context = fixture({
    synchronizeReads: true,
    assertAIApproval: () => {},
    aiAnalysisService: { async analyze() { calls += 1; return { method: "ai", status: "requires_review", findings: [] }; } },
  });
  const args = { organizationId, analysisRunId, useAI: true, confirmAIBudget: true };
  const results = await Promise.allSettled([context.pipeline.run(args), context.pipeline.run(args)]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(results.find((item) => item.status === "rejected").reason.code, "ANALYSIS_IN_PROGRESS");
  assert.equal(calls, 1);
});

test("a lost response after a successful claim does not permit automatic replay", async () => {
  let calls = 0;
  const context = fixture({
    claimTimeoutAfterCommit: true,
    assertAIApproval: () => {},
    aiAnalysisService: { async analyze() { calls += 1; } },
  });
  const args = { organizationId, analysisRunId, useAI: true, confirmAIBudget: true };
  await assert.rejects(context.pipeline.run(args), { code: "ETIMEDOUT" });
  await assert.rejects(context.pipeline.run(args), { code: "AI_RETRY_REQUIRES_REVIEW" });
  assert.equal(calls, 0);
});

test("an incomplete run with a persisted AI result requires review without calling the provider again", async () => {
  const analysis = { method: "ai", status: "requires_review", findings: [] };
  const context = fixture({
    status: "failed",
    existingProfile: { metadata: { aiAnalysis: analysis } },
    assertAIApproval: () => {},
    aiAnalysisService: { async analyze() { assert.fail("provider must not be called again"); } },
  });
  await assert.rejects(context.pipeline.run({ organizationId, analysisRunId, useAI: true, confirmAIBudget: true }), { code: "ANALYSIS_RECOVERY_REQUIRED" });
  assert.deepEqual(context.transitions, []);
});

test("pipeline withholds aircraft relationship materialization when identifiers conflict", async () => {
  const context = fixture({ conflictingIdentifiers: true });
  const result = await context.pipeline.run({ organizationId, analysisRunId });

  assert.equal(result.status, "completed");
  assert.equal(result.profile.metadata.assetIdentificationReview.status, "requires_review");
  assert.deepEqual(context.relationships[0].identifiers, []);
  assert.equal(result.counts.aircraftRelationships, 0);
});

test("completed pipeline runs are idempotent", async () => {
  const context = fixture({ status: "completed" });
  const result = await context.pipeline.run({ organizationId, analysisRunId });

  assert.equal(result.status, "already_processed");
  assert.deepEqual(context.transitions, []);
  assert.deepEqual(context.calls, []);
  assert.equal(result.profile.id, "profile-existing");
});

test("pipeline persists a sanitized failed state", async () => {
  const context = fixture({ failClauseStage: true });
  await assert.rejects(
    context.pipeline.run({ organizationId, analysisRunId }),
    (error) => error.code === "CLAUSE_FAILED"
  );

  assert.deepEqual(context.transitions.map((item) => item.status), ["processing", "extracting", "failed"]);
  assert.equal(context.transitions.at(-1).errorMessage, "Contract intelligence processing failed");
});

test("untrusted processing error codes and messages do not reach status or warning logs", async () => {
  const secret = "synthetic-credential-not-for-logs";
  const context = fixture({ clauseFailure: Object.assign(new Error(secret), {
    code: secret, constraint: secret, detail: secret, schema: secret, table: secret,
  }) });
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    await assert.rejects(context.pipeline.run({ organizationId, analysisRunId }), (error) => error.message === secret);
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(context.transitions.at(-1).errorCode, "PROCESSING_FAILED");
  assert.equal(JSON.stringify(warnings).includes(secret), false);
});

test("pipeline reports failed status persistence without masking the processing error", async () => {
  const context = fixture({ failClauseStage: true, failFailureStateUpdate: true });
  const errors = [];
  const originalConsoleError = console.error;
  console.error = (...args) => errors.push(args);

  try {
    await assert.rejects(
      context.pipeline.run({ organizationId, analysisRunId }),
      (error) => error.code === "CLAUSE_FAILED"
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(errors, [[
    "contract_intelligence_failure_status_update_failed",
    {
      organizationId,
      analysisRunId,
      processingErrorCode: "PROCESSING_FAILED",
      statusUpdateErrorCode: "STATUS_UPDATE_FAILED",
    },
  ]]);
});
