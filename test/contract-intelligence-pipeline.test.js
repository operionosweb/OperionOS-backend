import assert from "node:assert/strict";
import test from "node:test";

import { createContractIntelligencePipeline } from "../services/phase3/analysis/contractIntelligencePipeline.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const contractId = "22222222-2222-4222-8222-222222222222";
const documentId = "33333333-3333-4333-8333-333333333333";
const documentVersionId = "44444444-4444-4444-8444-444444444444";
const analysisRunId = "55555555-5555-4555-8555-555555555555";

function fixture({ status = "queued", failClauseStage = false } = {}) {
  const transitions = [];
  const calls = [];
  const indexed = [];
  const relationships = [];
  let run = { id: analysisRunId, organization_id: organizationId, contract_id: contractId, document_version_id: documentVersionId, status };
  const evidence = { id: "66666666-6666-4666-8666-666666666666", page_number: 1, source_locator: "page:1:char:0-120", excerpt: "AIRCRAFT LEASE AGREEMENT", char_start: 0, char_end: 120, confidence: 0.95 };
  const clause = { id: "77777777-7777-4777-8777-777777777777", clause_number: "1", title: "AIRCRAFT LEASE AGREEMENT", source_text: "AIRCRAFT LEASE AGREEMENT\nRegistration: G-SYN1\nThe Lessee shall maintain the Aircraft." };
  const analysisRunRepository = {
    getById: async () => run,
    updateStatus: async (update) => {
      transitions.push({ status: update.status, errorMessage: update.errorMessage || null });
      run = { ...run, status: update.status };
      return run;
    },
  };
  const profileRepository = {
    getByRun: async () => ({ id: "profile-existing" }),
    listClauseSources: async () => [{ ...clause, evidence: [evidence] }],
    persist: async ({ profile }) => {
      calls.push("profile");
      return { id: "profile-new", ...profile };
    },
  };
  const pipeline = createContractIntelligencePipeline({
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
      if (failClauseStage) throw Object.assign(new Error("source text must not enter persisted failure details"), { code: "CLAUSE_FAILED" });
      return { clauses: [clause], evidence: [evidence], clauseEvidence: [{ clause_id: clause.id, evidence_id: evidence.id }] };
    },
    obligationService: { runStage: async () => { calls.push("obligations"); return { obligations: [] }; } },
    deadlineService: { runStage: async () => { calls.push("deadlines"); return { deadlines: [] }; } },
    riskService: { runStage: async () => { calls.push("risks"); return { risks: [] }; } },
    aviationRelationshipRepository: {
      async materializeContractRelationships(input) {
        calls.push("relationships");
        relationships.push(input);
        return [{ id: "relationship-1" }];
      },
    },
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