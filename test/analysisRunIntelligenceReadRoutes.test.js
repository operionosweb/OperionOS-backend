import assert from "node:assert/strict";
import test from "node:test";

import {
  answerAnalysisRunQuestion,
  readAnalysisRunClauses,
  readAnalysisRunEvidence,
  readAnalysisRunObligations,
  readAnalysisRunProfile,
  readAnalysisRunRelationships,
  searchAnalysisRun,
} from "../routes/analysisRunRoutes.js";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = "33333333-3333-4333-8333-333333333333";
const DOCUMENT_VERSION_ID = "44444444-4444-4444-8444-444444444444";

function createAnalysisRunRepository(result) {
  return {
    async getById(analysisRunId, organizationId) {
      assert.equal(analysisRunId, RUN_ID);
      assert.equal(organizationId, ORG_ID);
      return result;
    },
  };
}

function createClauseRepository(rows) {
  return {
    async listByRun({ organizationId, documentVersionId, analysisRunId }) {
      assert.equal(organizationId, ORG_ID);
      assert.equal(documentVersionId, DOCUMENT_VERSION_ID);
      assert.equal(analysisRunId, RUN_ID);
      return rows;
    },
  };
}

function createObligationRepository(rows) {
  return {
    async listByRunScope({ organizationId, contractId, documentId, documentVersionId, analysisRunId }) {
      assert.equal(organizationId, ORG_ID);
      assert.equal(contractId, "contract-1");
      assert.equal(documentId, "document-1");
      assert.equal(documentVersionId, DOCUMENT_VERSION_ID);
      assert.equal(analysisRunId, RUN_ID);
      return rows;
    },
  };
}

test("readAnalysisRunClauses returns canonical clauses for the authenticated tenant", async () => {
  const clauses = [
    {
      id: "clause-1",
      analysis_run_id: RUN_ID,
      document_version_id: DOCUMENT_VERSION_ID,
      clause_number: "3.1",
      title: "Maintenance",
      category: "maintenance",
      source_text: "The Lessee shall maintain the aircraft.",
      review_status: "pending",
    },
  ];

  const result = await readAnalysisRunClauses({
    organizationId: ORG_ID,
    analysisRunId: RUN_ID,
    analysisRunRepository: createAnalysisRunRepository({
      id: RUN_ID,
      organization_id: ORG_ID,
      document_version_id: DOCUMENT_VERSION_ID,
    }),
    clauseRepository: createClauseRepository(clauses),
  });

  assert.deepEqual(result, clauses);
});

test("readAnalysisRunClauses rejects unknown or cross-tenant analysis runs", async () => {
  await assert.rejects(
    () => readAnalysisRunClauses({
      organizationId: ORG_ID,
      analysisRunId: RUN_ID,
      analysisRunRepository: createAnalysisRunRepository(null),
      clauseRepository: createClauseRepository([]),
    }),
    (error) => error.code === "ANALYSIS_RUN_NOT_FOUND"
  );

  await assert.rejects(
    () => readAnalysisRunClauses({
      organizationId: ORG_ID,
      analysisRunId: RUN_ID,
      analysisRunRepository: createAnalysisRunRepository({
        id: RUN_ID,
        organization_id: OTHER_ORG_ID,
        document_version_id: DOCUMENT_VERSION_ID,
      }),
      clauseRepository: createClauseRepository([]),
    }),
    (error) => error.code === "ANALYSIS_RUN_NOT_FOUND"
  );
});

test("readAnalysisRunObligations returns canonical obligations for the authenticated tenant", async () => {
  const obligations = [
    {
      id: "obligation-1",
      analysis_run_id: RUN_ID,
      clause_id: "clause-1",
      description: "The Lessee shall maintain the aircraft.",
      obligation_type: "maintenance",
      priority: "high",
      status: "identified",
      confidence: 0.93,
    },
  ];

  const result = await readAnalysisRunObligations({
    organizationId: ORG_ID,
    analysisRunId: RUN_ID,
    analysisRunRepository: createAnalysisRunRepository({
      id: RUN_ID,
      organization_id: ORG_ID,
      contract_id: "contract-1",
      document_version_id: DOCUMENT_VERSION_ID,
    }),
    documentVersionResolver: async () => ({
      id: DOCUMENT_VERSION_ID,
      document_id: "document-1",
      organization_id: ORG_ID,
    }),
    obligationRepository: createObligationRepository(obligations),
  });

  assert.deepEqual(result, obligations);
});

test("readAnalysisRunObligations returns empty result when no obligations exist for the run", async () => {
  const result = await readAnalysisRunObligations({
    organizationId: ORG_ID,
    analysisRunId: RUN_ID,
    analysisRunRepository: createAnalysisRunRepository({
      id: RUN_ID,
      organization_id: ORG_ID,
      contract_id: "contract-1",
      document_version_id: DOCUMENT_VERSION_ID,
    }),
    documentVersionResolver: async () => ({
      id: DOCUMENT_VERSION_ID,
      document_id: "document-1",
      organization_id: ORG_ID,
    }),
    obligationRepository: createObligationRepository([]),
  });

  assert.deepEqual(result, []);
});

test("readAnalysisRunEvidence returns source detail without tenant or identity fields", async () => {
  const result = await readAnalysisRunEvidence({
    organizationId: ORG_ID,
    analysisRunId: RUN_ID,
    analysisRunRepository: createAnalysisRunRepository({ id: RUN_ID, organization_id: ORG_ID }),
    evidenceRepository: {
      async listByRun(scope) {
        assert.deepEqual(scope, { organizationId: ORG_ID, analysisRunId: RUN_ID });
        return [{
          id: "evidence-1",
          organization_id: ORG_ID,
          contract_id: "contract-1",
          document_id: "document-1",
          document_version_id: DOCUMENT_VERSION_ID,
          analysis_run_id: RUN_ID,
          excerpt: "The Lessee shall maintain the Aircraft.",
          page_number: 4,
          source_locator: "page:4:char:120-160",
          evidence_hash: "internal",
        }];
      },
    },
  });

  assert.deepEqual(result, [{
    id: "evidence-1",
    analysis_run_id: RUN_ID,
    excerpt: "The Lessee shall maintain the Aircraft.",
    page_number: 4,
    source_locator: "page:4:char:120-160",
  }]);
});

test("readAnalysisRunEvidence rejects cross-tenant analysis runs", async () => {
  await assert.rejects(() => readAnalysisRunEvidence({
    organizationId: ORG_ID,
    analysisRunId: RUN_ID,
    analysisRunRepository: createAnalysisRunRepository({ id: RUN_ID, organization_id: OTHER_ORG_ID }),
    evidenceRepository: { async listByRun() { throw new Error("must not query evidence"); } },
  }), (error) => error.code === "ANALYSIS_RUN_NOT_FOUND");
});

test("profile and search readers are sanitized and tenant scoped", async () => {
  const analysisRunRepository = createAnalysisRunRepository({ id: RUN_ID, organization_id: ORG_ID });
  const profile = await readAnalysisRunProfile({
    organizationId: ORG_ID,
    analysisRunId: RUN_ID,
    analysisRunRepository,
    profileRepository: {
      async getByRun(scope) {
        assert.deepEqual(scope, { organizationId: ORG_ID, analysisRunId: RUN_ID });
        return { id: "profile-1", organization_id: ORG_ID, contract_id: "contract-1", document_id: "document-1", document_version_id: DOCUMENT_VERSION_ID, executive_summary: "Grounded summary" };
      },
    },
  });
  assert.deepEqual(profile, { id: "profile-1", executive_summary: "Grounded summary" });

  const results = await searchAnalysisRun({
    organizationId: ORG_ID,
    analysisRunId: RUN_ID,
    query: "maintenance reserve",
    limit: 5,
    analysisRunRepository,
    searchRepository: {
      async search(input) {
        assert.deepEqual(input, { organizationId: ORG_ID, analysisRunId: RUN_ID, query: "maintenance reserve", limit: 5 });
        return [{ id: "chunk-1", page_start: 7 }];
      },
    },
  });
  assert.deepEqual(results, [{ id: "chunk-1", page_start: 7 }]);
});

test("profile and search readers reject foreign runs before downstream access", async () => {
  const analysisRunRepository = createAnalysisRunRepository({ id: RUN_ID, organization_id: OTHER_ORG_ID });
  const unreachable = new Proxy({}, { get() { return async () => { throw new Error("must not query downstream repository"); }; } });
  await assert.rejects(() => readAnalysisRunProfile({ organizationId: ORG_ID, analysisRunId: RUN_ID, analysisRunRepository, profileRepository: unreachable }), (error) => error.code === "ANALYSIS_RUN_NOT_FOUND");
  await assert.rejects(() => searchAnalysisRun({ organizationId: ORG_ID, analysisRunId: RUN_ID, query: "rent", analysisRunRepository, searchRepository: unreachable }), (error) => error.code === "ANALYSIS_RUN_NOT_FOUND");
});

test("relationship reader resolves the authenticated run contract scope", async () => {
  const relationships = [{
    id: "relationship-1",
    aircraft_id: "aircraft-1",
    registration: "G-OPER",
    relationship_type: "leased_under",
    source_locator: "page:2",
  }];
  const result = await readAnalysisRunRelationships({
    organizationId: ORG_ID,
    analysisRunId: RUN_ID,
    analysisRunRepository: createAnalysisRunRepository({
      id: RUN_ID,
      organization_id: ORG_ID,
      contract_id: "contract-1",
    }),
    relationshipRepository: {
      async listByContract(scope) {
        assert.deepEqual(scope, { organizationId: ORG_ID, contractId: "contract-1" });
        return relationships;
      },
    },
  });

  assert.deepEqual(result, relationships);
});

test("relationship reader rejects foreign runs before repository access", async () => {
  let called = false;
  await assert.rejects(() => readAnalysisRunRelationships({
    organizationId: ORG_ID,
    analysisRunId: RUN_ID,
    analysisRunRepository: createAnalysisRunRepository({ id: RUN_ID, organization_id: OTHER_ORG_ID }),
    relationshipRepository: { async listByContract() { called = true; } },
  }), (error) => error.code === "ANALYSIS_RUN_NOT_FOUND");
  assert.equal(called, false);
});

test("analysis-run assistant passes the authoritative tenant scope to every reader", async () => {
  const calls = [];
  const reader = (name, result = []) => async (scope) => {
    calls.push([name, scope]);
    return result;
  };
  const source = { id: "evidence-1", excerpt: "Lessee shall maintain the Aircraft.", page_number: 7 };
  const result = await answerAnalysisRunQuestion({
    organizationId: ORG_ID,
    analysisRunId: RUN_ID,
    question: "Who is responsible for maintenance?",
    readers: {
      clauses: reader("clauses", [{ id: "clause-1", title: "Maintenance", source_text: source.excerpt }]),
      obligations: reader("obligations"),
      deadlines: reader("deadlines"),
      risks: reader("risks"),
      evidence: reader("evidence", [source]),
    },
  });

  assert.equal(result.established, true);
  assert.equal(calls.length, 5);
  assert.ok(calls.every(([, scope]) => scope.organizationId === ORG_ID && scope.analysisRunId === RUN_ID));
  assert.ok(calls.every(([, scope]) => !("organization_id" in scope)));
});
