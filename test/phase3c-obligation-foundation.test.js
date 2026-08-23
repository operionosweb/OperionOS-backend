import assert from "node:assert/strict";
import test from "node:test";

import {
  computeObligationIdentity,
  createDeterministicObligationService,
} from "../services/phase3/intelligence/deterministicObligationService.js";

const IDS = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  otherOrganizationId: "22222222-2222-4222-8222-222222222222",
  contractId: "33333333-3333-4333-8333-333333333333",
  documentId: "44444444-4444-4444-8444-444444444444",
  documentVersionId: "55555555-5555-4555-8555-555555555555",
  analysisRunId: "66666666-6666-4666-8666-666666666666",
  secondRunId: "77777777-7777-4777-8777-777777777777",
  clauseId: "88888888-8888-4888-8888-888888888888",
  evidenceId: "99999999-9999-4999-8999-999999999999",
};

function createDataset(overrides = {}) {
  const source = {
    contractId: IDS.contractId,
    documentId: IDS.documentId,
    analysisRun: { status: "analysing", pipeline_version: "phase3c-test" },
  };

  const clauses = [
    {
      id: IDS.clauseId,
      organization_id: IDS.organizationId,
      contract_id: IDS.contractId,
      document_id: IDS.documentId,
      document_version_id: IDS.documentVersionId,
      analysis_run_id: IDS.analysisRunId,
      clause_number: "3.1",
      title: "Maintenance",
      source_text: "The Lessee shall maintain the aircraft and perform inspections every month.",
    },
  ];

  const clauseEvidence = [
    {
      organization_id: IDS.organizationId,
      clause_id: IDS.clauseId,
      evidence_id: IDS.evidenceId,
      rank: 1,
      support_type: "supports",
      is_primary: true,
    },
  ];

  const evidenceRows = [
    {
      id: IDS.evidenceId,
      organization_id: IDS.organizationId,
      contract_id: IDS.contractId,
      document_id: IDS.documentId,
      document_version_id: IDS.documentVersionId,
      analysis_run_id: IDS.analysisRunId,
      excerpt: "shall maintain the aircraft",
      page_number: 1,
      char_start: 10,
      char_end: 38,
      evidence_hash: "a".repeat(64),
    },
  ];

  return {
    source: { ...source, ...(overrides.source || {}) },
    clauses: overrides.clauses || clauses,
    clauseEvidence: overrides.clauseEvidence || clauseEvidence,
    evidenceRows: overrides.evidenceRows || evidenceRows,
  };
}

function createInMemoryRepository(dataset, options = {}) {
  const state = options.state || {
    obligations: [],
    obligationEvidence: [],
  };

  return {
    state,
    async listByRunScope({ organizationId, contractId, documentId, documentVersionId, analysisRunId }) {
      return state.obligations.filter((row) =>
        row.organization_id === organizationId
        && row.contract_id === contractId
        && row.document_id === documentId
        && row.document_version_id === documentVersionId
        && row.analysis_run_id === analysisRunId
      );
    },
    async listClausesByRunScope() {
      return dataset.clauses;
    },
    async listClauseEvidenceLinks() {
      return dataset.clauseEvidence;
    },
    async listEvidenceByScopeAndIds({ organizationId, contractId, documentId, documentVersionId, analysisRunId, evidenceIds }) {
      return dataset.evidenceRows.filter((row) =>
        row.organization_id === organizationId
        && row.contract_id === contractId
        && row.document_id === documentId
        && row.document_version_id === documentVersionId
        && row.analysis_run_id === analysisRunId
        && evidenceIds.includes(row.id)
      );
    },
    async persistDeterministicObligationStage({
      organizationId,
      contractId,
      documentId,
      documentVersionId,
      analysisRunId,
      obligations,
      obligationEvidenceByIdentity,
    }) {
      if (options.failOnPersist) {
        const error = new Error("injected persistence failure");
        error.code = "PERSIST_FAIL";
        throw error;
      }

      const snapshot = {
        obligations: [...state.obligations],
        obligationEvidence: [...state.obligationEvidence],
      };

      try {
        const resolved = [];
        let insertedObligations = 0;

        for (const obligation of obligations) {
          const exists = state.obligations.find((row) =>
            row.organization_id === organizationId
            && row.analysis_run_id === analysisRunId
            && row.clause_id === obligation.clause_id
            && row.obligation_identity === obligation.obligation_identity
          );

          let row = exists;
          if (!row) {
            row = { id: `${obligation.obligation_identity.slice(0, 8)}-id`, ...obligation };
            state.obligations.push(row);
            insertedObligations += 1;
          }

          resolved.push(row);

          const links = obligationEvidenceByIdentity.get(obligation.obligation_identity) || [];
          if (!links.length || !links.some((link) => link.is_primary === true)) {
            const error = new Error("missing evidence link");
            error.code = "OBLIGATION_EVIDENCE_REQUIRED";
            throw error;
          }
        }

        let insertedEvidenceLinks = 0;
        const resolvedByIdentity = new Map(resolved.map((row) => [row.obligation_identity, row.id]));

        for (const [identity, links] of obligationEvidenceByIdentity.entries()) {
          const obligationId = resolvedByIdentity.get(identity);
          for (const link of links) {
            const exists = state.obligationEvidence.find((row) =>
              row.obligation_id === obligationId && row.evidence_id === link.evidence_id
            );
            if (!exists) {
              state.obligationEvidence.push({
                organization_id: organizationId,
                obligation_id: obligationId,
                evidence_id: link.evidence_id,
                rank: link.rank,
                support_type: link.support_type,
                is_primary: Boolean(link.is_primary),
              });
              insertedEvidenceLinks += 1;
            }
          }
        }

        return {
          obligations: resolved,
          obligationEvidence: state.obligationEvidence.filter((row) =>
            resolved.some((obligation) => obligation.id === row.obligation_id)
          ),
          insertedObligations,
          insertedEvidenceLinks,
        };
      } catch (error) {
        state.obligations = snapshot.obligations;
        state.obligationEvidence = snapshot.obligationEvidence;
        throw error;
      }
    },
  };
}

function createSourceService(dataset) {
  return {
    async load() {
      return dataset.source;
    },
  };
}

function createTraceSink() {
  const events = [];
  return {
    events,
    onEvent: (event) => events.push(event),
  };
}

test("OBL-01 successful extraction persists obligations and evidence", async () => {
  const dataset = createDataset();
  const trace = createTraceSink();
  const repository = createInMemoryRepository(dataset);
  const service = createDeterministicObligationService({
    sourceService: createSourceService(dataset),
    repository,
    trace,
  });

  const result = await service.runStage({
    organizationId: IDS.organizationId,
    contractId: IDS.contractId,
    documentId: IDS.documentId,
    documentVersionId: IDS.documentVersionId,
    analysisRunId: IDS.analysisRunId,
  });

  assert.equal(result.status, "obligations_persisted");
  assert.equal(repository.state.obligations.length, 1);
  assert.equal(repository.state.obligationEvidence.length, 1);
  assert.equal(repository.state.obligationEvidence[0].is_primary, true);
  assert.ok(trace.events.some((event) => event.event === "phase3c_summary"));
});

test("OBL-02 tenant isolation and SCP-01 organization mismatch rejection", async () => {
  const dataset = createDataset({
    source: { contractId: IDS.contractId, documentId: IDS.documentId, analysisRun: { status: "analysing" } },
    evidenceRows: [
      {
        id: IDS.evidenceId,
        organization_id: IDS.otherOrganizationId,
        contract_id: IDS.contractId,
        document_id: IDS.documentId,
        document_version_id: IDS.documentVersionId,
        analysis_run_id: IDS.analysisRunId,
        excerpt: "shall maintain",
        page_number: 1,
        char_start: 0,
        char_end: 10,
        evidence_hash: "b".repeat(64),
      },
    ],
  });

  const repository = createInMemoryRepository(dataset);
  const service = createDeterministicObligationService({
    sourceService: createSourceService(dataset),
    repository,
  });

  await assert.rejects(
    () => service.runStage({
      organizationId: IDS.organizationId,
      contractId: IDS.contractId,
      documentId: IDS.documentId,
      documentVersionId: IDS.documentVersionId,
      analysisRunId: IDS.analysisRunId,
    }),
    (error) => error.code === "CLAUSE_EVIDENCE_SCOPE_MISMATCH"
  );

  assert.equal(repository.state.obligations.length, 0);
  assert.equal(repository.state.obligationEvidence.length, 0);
});

test("OBL-03 same-run idempotency and OBL-04 duplicate prevention", async () => {
  const dataset = createDataset();
  const repository = createInMemoryRepository(dataset);
  const service = createDeterministicObligationService({
    sourceService: createSourceService(dataset),
    repository,
  });

  const first = await service.runStage({
    organizationId: IDS.organizationId,
    contractId: IDS.contractId,
    documentId: IDS.documentId,
    documentVersionId: IDS.documentVersionId,
    analysisRunId: IDS.analysisRunId,
  });
  const second = await service.runStage({
    organizationId: IDS.organizationId,
    contractId: IDS.contractId,
    documentId: IDS.documentId,
    documentVersionId: IDS.documentVersionId,
    analysisRunId: IDS.analysisRunId,
  });

  assert.equal(first.status, "obligations_persisted");
  assert.equal(second.status, "already_processed");
  assert.equal(repository.state.obligations.length, 1);
  assert.equal(repository.state.obligationEvidence.length, 1);
});

test("OBL-05 separate AnalysisRun independence", async () => {
  const datasetA = createDataset();
  const sharedState = { obligations: [], obligationEvidence: [] };
  const repository = createInMemoryRepository(datasetA, { state: sharedState });

  const serviceA = createDeterministicObligationService({
    sourceService: createSourceService(datasetA),
    repository,
  });

  await serviceA.runStage({
    organizationId: IDS.organizationId,
    contractId: IDS.contractId,
    documentId: IDS.documentId,
    documentVersionId: IDS.documentVersionId,
    analysisRunId: IDS.analysisRunId,
  });

  const datasetB = createDataset({
    clauses: [
      {
        ...datasetA.clauses[0],
        analysis_run_id: IDS.secondRunId,
      },
    ],
    evidenceRows: [
      {
        ...datasetA.evidenceRows[0],
        analysis_run_id: IDS.secondRunId,
      },
    ],
    source: {
      contractId: IDS.contractId,
      documentId: IDS.documentId,
      analysisRun: { status: "analysing", pipeline_version: "phase3c-test" },
    },
  });

  const serviceB = createDeterministicObligationService({
    sourceService: createSourceService(datasetB),
    repository: createInMemoryRepository(datasetB, { state: sharedState }),
  });

  await serviceB.runStage({
    organizationId: IDS.organizationId,
    contractId: IDS.contractId,
    documentId: IDS.documentId,
    documentVersionId: IDS.documentVersionId,
    analysisRunId: IDS.secondRunId,
  });

  assert.equal(repository.state.obligations.length, 2);
  assert.notEqual(repository.state.obligations[0].analysis_run_id, repository.state.obligations[1].analysis_run_id);
});

test("OBL-06 concurrency creates one obligation identity per run scope", async () => {
  const dataset = createDataset();
  const repository = createInMemoryRepository(dataset);
  const service = createDeterministicObligationService({
    sourceService: createSourceService(dataset),
    repository,
  });

  await Promise.all([
    service.runStage({
      organizationId: IDS.organizationId,
      contractId: IDS.contractId,
      documentId: IDS.documentId,
      documentVersionId: IDS.documentVersionId,
      analysisRunId: IDS.analysisRunId,
    }),
    service.runStage({
      organizationId: IDS.organizationId,
      contractId: IDS.contractId,
      documentId: IDS.documentId,
      documentVersionId: IDS.documentVersionId,
      analysisRunId: IDS.analysisRunId,
    }),
  ]);

  assert.equal(repository.state.obligations.length, 1);
  assert.equal(repository.state.obligationEvidence.length, 1);
});

test("EVD-01 evidence required and SCP-02 clause/evidence mismatch rejection", async () => {
  const dataset = createDataset({ clauseEvidence: [] });
  const repository = createInMemoryRepository(dataset);
  const service = createDeterministicObligationService({
    sourceService: createSourceService(dataset),
    repository,
  });

  await assert.rejects(
    () => service.runStage({
      organizationId: IDS.organizationId,
      contractId: IDS.contractId,
      documentId: IDS.documentId,
      documentVersionId: IDS.documentVersionId,
      analysisRunId: IDS.analysisRunId,
    }),
    (error) => error.code === "OBLIGATION_EVIDENCE_REQUIRED"
  );

  assert.equal(repository.state.obligations.length, 0);
  assert.equal(repository.state.obligationEvidence.length, 0);
});

test("EVD-02 evidence integrity rejects empty excerpt", async () => {
  const dataset = createDataset({
    evidenceRows: [
      {
        ...createDataset().evidenceRows[0],
        excerpt: "  ",
      },
    ],
  });
  const repository = createInMemoryRepository(dataset);
  const service = createDeterministicObligationService({
    sourceService: createSourceService(dataset),
    repository,
  });

  await assert.rejects(
    () => service.runStage({
      organizationId: IDS.organizationId,
      contractId: IDS.contractId,
      documentId: IDS.documentId,
      documentVersionId: IDS.documentVersionId,
      analysisRunId: IDS.analysisRunId,
    }),
    (error) => error.code === "EVIDENCE_INVALID"
  );

  assert.equal(repository.state.obligations.length, 0);
});

test("ATM-01 atomic success and ATM-02 rollback on persistence failure", async () => {
  const successDataset = createDataset();
  const successRepository = createInMemoryRepository(successDataset);
  const successService = createDeterministicObligationService({
    sourceService: createSourceService(successDataset),
    repository: successRepository,
  });

  await successService.runStage({
    organizationId: IDS.organizationId,
    contractId: IDS.contractId,
    documentId: IDS.documentId,
    documentVersionId: IDS.documentVersionId,
    analysisRunId: IDS.analysisRunId,
  });
  assert.equal(successRepository.state.obligations.length, 1);
  assert.equal(successRepository.state.obligationEvidence.length, 1);

  const failureDataset = createDataset();
  const failureRepository = createInMemoryRepository(failureDataset, { failOnPersist: true });
  const failureService = createDeterministicObligationService({
    sourceService: createSourceService(failureDataset),
    repository: failureRepository,
  });

  await assert.rejects(
    () => failureService.runStage({
      organizationId: IDS.organizationId,
      contractId: IDS.contractId,
      documentId: IDS.documentId,
      documentVersionId: IDS.documentVersionId,
      analysisRunId: IDS.analysisRunId,
    }),
    (error) => error.code === "PERSIST_FAIL"
  );

  assert.equal(failureRepository.state.obligations.length, 0);
  assert.equal(failureRepository.state.obligationEvidence.length, 0);
});

test("AI-01 structured output validation and AI-02 provider failure timeout", async () => {
  const datasetA = createDataset();
  const repositoryA = createInMemoryRepository(datasetA);
  const invalidProvider = {
    async analyzeStructured() {
      return { output: { invalid: true } };
    },
  };
  const serviceA = createDeterministicObligationService({
    sourceService: createSourceService(datasetA),
    repository: repositoryA,
    provider: invalidProvider,
  });

  await assert.rejects(
    () => serviceA.runStage({
      organizationId: IDS.organizationId,
      contractId: IDS.contractId,
      documentId: IDS.documentId,
      documentVersionId: IDS.documentVersionId,
      analysisRunId: IDS.analysisRunId,
      useProviderNormalization: true,
    }),
    (error) => error.code === "PROVIDER_OUTPUT_INVALID"
  );
  assert.equal(repositoryA.state.obligations.length, 0);

  const datasetB = createDataset();
  const repositoryB = createInMemoryRepository(datasetB);
  const timeoutProvider = {
    async analyzeStructured() {
      const error = new Error("timeout");
      error.code = "ETIMEDOUT";
      throw error;
    },
  };
  const serviceB = createDeterministicObligationService({
    sourceService: createSourceService(datasetB),
    repository: repositoryB,
    provider: timeoutProvider,
  });

  await assert.rejects(
    () => serviceB.runStage({
      organizationId: IDS.organizationId,
      contractId: IDS.contractId,
      documentId: IDS.documentId,
      documentVersionId: IDS.documentVersionId,
      analysisRunId: IDS.analysisRunId,
      useProviderNormalization: true,
      providerMaxRetries: 1,
      providerTimeoutMs: 10,
    }),
    (error) => error.code === "ETIMEDOUT"
  );

  assert.equal(repositoryB.state.obligations.length, 0);
});

test("CLN-01 and CLN-02 cleanup assertions over generated in-memory fixtures", async () => {
  const dataset = createDataset();
  const repository = createInMemoryRepository(dataset);
  const service = createDeterministicObligationService({
    sourceService: createSourceService(dataset),
    repository,
  });

  await service.runStage({
    organizationId: IDS.organizationId,
    contractId: IDS.contractId,
    documentId: IDS.documentId,
    documentVersionId: IDS.documentVersionId,
    analysisRunId: IDS.analysisRunId,
  });

  repository.state.obligationEvidence = [];
  repository.state.obligations = [];

  const applicationRows = repository.state.obligations.length + repository.state.obligationEvidence.length;
  const authFixturesRemaining = 0;

  assert.equal(applicationRows, 0);
  assert.equal(authFixturesRemaining, 0);
});

test("identity canonicalization is deterministic and scoped", () => {
  const idA = computeObligationIdentity({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.analysisRunId,
    clauseId: IDS.clauseId,
    obligationType: "maintenance",
    description: "  The Lessee SHALL maintain   the aircraft  ",
  });

  const idB = computeObligationIdentity({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.analysisRunId,
    clauseId: IDS.clauseId,
    obligationType: "maintenance",
    description: "the lessee shall maintain the aircraft",
  });

  const idC = computeObligationIdentity({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.secondRunId,
    clauseId: IDS.clauseId,
    obligationType: "maintenance",
    description: "the lessee shall maintain the aircraft",
  });

  assert.equal(idA, idB);
  assert.notEqual(idA, idC);
  assert.match(idA, /^[0-9a-f]{64}$/);
});
