import assert from "node:assert/strict";
import test from "node:test";

import { createSearchChunkRepository } from "../repositories/phase3/searchChunkRepository.js";
import { answerPortfolioContractQuestion } from "../services/phase3/intelligence/portfolioContractAssistantService.js";
import { answerPortfolioQuestion } from "../routes/analysisRunRoutes.js";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG_ID = "22222222-2222-4222-8222-222222222222";
const CONTRACT_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_1_ID = "44444444-4444-4444-8444-444444444444";
const VERSION_2_ID = "55555555-5555-4555-8555-555555555555";
const RUN_1_ID = "66666666-6666-4666-8666-666666666666";
const RUN_2_ID = "77777777-7777-4777-8777-777777777777";

function createSearchClient(rows) {
  const queries = [];
  return {
    queries,
    from(table) {
      const query = { table, filters: [], inFilters: [], limit: Infinity };
      queries.push(query);
      const builder = {
        select() { return builder; },
        eq(column, value) { query.filters.push([column, value]); return builder; },
        in(column, values) { query.inFilters.push([column, values]); return builder; },
        textSearch(column, value, options) { query.textSearch = [column, value, options]; return builder; },
        limit(value) { query.limit = value; return builder; },
        order() { return builder; },
        then(resolve, reject) {
          let data = rows[table] || [];
          for (const [column, value] of query.filters) data = data.filter((row) => row[column] === value);
          for (const [column, values] of query.inFilters) data = data.filter((row) => values.includes(row[column]));
          if (query.textSearch) {
            const terms = query.textSearch[1].toLowerCase().split(/\s+/);
            data = data.filter((row) => terms.some((term) => row.text_content?.toLowerCase().includes(term)));
          }
          return Promise.resolve({ data: data.slice(0, query.limit), error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

function chunk(id, runId, versionId, overrides = {}) {
  return {
    id,
    organization_id: ORG_ID,
    contract_id: CONTRACT_ID,
    document_id: "88888888-8888-4888-8888-888888888888",
    document_version_id: versionId,
    analysis_run_id: runId,
    text_content: "Maintenance reserve payments are due monthly.",
    char_start: 120,
    char_end: 168,
    page_start: 7,
    page_end: 7,
    index_status: "ready",
    ...overrides,
  };
}

function metadataRows() {
  return {
    analysis_runs: [
      { id: RUN_1_ID, organization_id: ORG_ID, contract_id: CONTRACT_ID, document_version_id: VERSION_1_ID, status: "completed" },
      { id: RUN_2_ID, organization_id: ORG_ID, contract_id: CONTRACT_ID, document_version_id: VERSION_2_ID, status: "completed" },
      { id: "99999999-9999-4999-8999-999999999999", organization_id: ORG_ID, contract_id: CONTRACT_ID, document_version_id: VERSION_1_ID, status: "processing" },
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", organization_id: OTHER_ORG_ID, contract_id: CONTRACT_ID, document_version_id: VERSION_1_ID, status: "completed" },
    ],
    contracts: [
      { id: CONTRACT_ID, organization_id: ORG_ID, title: "Aircraft Lease A" },
      { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", organization_id: OTHER_ORG_ID, title: "Foreign Contract" },
    ],
    document_versions: [
      { id: VERSION_1_ID, organization_id: ORG_ID, version_number: 1 },
      { id: VERSION_2_ID, organization_id: ORG_ID, version_number: 2 },
      { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", organization_id: OTHER_ORG_ID, version_number: 99 },
    ],
  };
}

test("portfolio search restricts index and metadata reads to organization and completed runs", async () => {
  const client = createSearchClient({
    ...metadataRows(),
    contract_search_chunks: [
      chunk("chunk-1", RUN_1_ID, VERSION_1_ID),
      chunk("chunk-2", RUN_2_ID, VERSION_2_ID),
      chunk("chunk-incomplete", "99999999-9999-4999-8999-999999999999", VERSION_1_ID),
      chunk("chunk-foreign", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", VERSION_1_ID, { organization_id: OTHER_ORG_ID }),
      chunk("chunk-misaligned", RUN_1_ID, VERSION_2_ID),
    ],
  });
  const repository = createSearchChunkRepository(client);

  const found = await repository.searchPortfolio({ organizationId: ORG_ID, query: "maintenance reserve", limit: 500 });

  assert.deepEqual(found.results.map((item) => item.id), ["chunk-1", "chunk-2"]);
  assert.equal(found.incompleteReferences, true);
  assert.ok(client.queries.every((query) => query.filters.some(([column, value]) => column === "organization_id" && value === ORG_ID)));
  assert.equal(client.queries[0].filters.find(([column]) => column === "index_status")?.[1], "ready");
  assert.equal(client.queries[0].limit, 25);
});

test("portfolio search links indexed passages only to a unique same-run clause", async () => {
  const clause = {
    id: "clause-1",
    organization_id: ORG_ID,
    contract_id: CONTRACT_ID,
    document_id: "88888888-8888-4888-8888-888888888888",
    document_version_id: VERSION_1_ID,
    analysis_run_id: RUN_1_ID,
    clause_number: "12.4",
    title: "Maintenance reserves",
    source_text: "Maintenance reserve payments are due monthly.",
  };
  const rows = {
    ...metadataRows(),
    contract_search_chunks: [chunk("chunk-1", RUN_1_ID, VERSION_1_ID)],
    clauses: [clause],
  };
  const found = await createSearchChunkRepository(createSearchClient(rows))
    .searchPortfolio({ organizationId: ORG_ID, query: "maintenance reserve" });
  assert.deepEqual(found.results[0].clause, { id: "clause-1", number: "12.4", title: "Maintenance reserves" });
  assert.equal(found.incompleteReferences, false);

  rows.clauses.push({ ...clause, id: "clause-duplicate", clause_number: "12.5" });
  const ambiguous = await createSearchChunkRepository(createSearchClient(rows))
    .searchPortfolio({ organizationId: ORG_ID, query: "maintenance reserve" });
  assert.equal(ambiguous.results[0].clause, null);
  assert.equal(ambiguous.incompleteReferences, true);
});

test("portfolio assistant returns provenance and discloses multiple matching versions", async () => {
  let searchInput;
  const result = await answerPortfolioContractQuestion({
    organizationId: ORG_ID,
    question: "What do these contracts say about reserves?",
    searchRepository: {
      async searchPortfolio(input) {
        searchInput = input;
        return {
          incompleteReferences: false,
          results: [
            { id: "chunk-1", contractId: CONTRACT_ID, contractTitle: "Aircraft Lease A", documentVersionId: VERSION_1_ID, versionNumber: 1, analysisRunId: RUN_1_ID, excerpt: "Reserve payments are due monthly.", pageStart: 7, pageEnd: 7, clause: { id: "clause-1", number: "12.4", title: "Reserve payments" } },
            { id: "chunk-2", contractId: CONTRACT_ID, contractTitle: "Aircraft Lease A", documentVersionId: VERSION_2_ID, versionNumber: 2, analysisRunId: RUN_2_ID, excerpt: "Reserve payments are due quarterly.", charStart: 70, charEnd: 110 },
          ],
        };
      },
    },
  });

  assert.equal(searchInput.organizationId, ORG_ID);
  assert.equal(result.established, true);
  assert.equal(result.citations.length, 2);
  assert.equal(result.citations[0].version.number, 1);
  assert.equal(result.citations[0].clause.id, "clause-1");
  assert.equal(result.citations[0].source.locator, "page 7");
  assert.equal(result.citations[1].source.locator, "characters 70-110");
  assert.match(result.uncertainty.join(" "), /Multiple contract versions matched/);
  assert.match(result.uncertainty.join(" "), /not model-generated legal conclusions/);
  assert.equal(result.intelligenceConsumption, 0);
});

test("portfolio assistant assembles structured findings, financial evidence, recommendations, and asset links", async () => {
  const calls = [];
  const source = {
    id: "evidence-1",
    excerpt: "Maintenance reserves are payable for each flight hour.",
    page_number: 9,
    source_locator: "page:9:char:300-356",
  };
  const result = await answerPortfolioContractQuestion({
    organizationId: ORG_ID,
    question: "What maintenance reserve financial risk and recommended action applies to this aircraft MSN?",
    searchRepository: {
      async searchPortfolio() {
        return {
          incompleteReferences: false,
          results: [
            { id: "chunk-1", contractId: CONTRACT_ID, contractTitle: "Aircraft Lease A", documentVersionId: VERSION_1_ID, versionNumber: 1, analysisRunId: RUN_1_ID, excerpt: source.excerpt },
            { id: "chunk-2", contractId: CONTRACT_ID, contractTitle: "Aircraft Lease A", documentVersionId: VERSION_1_ID, versionNumber: 1, analysisRunId: RUN_1_ID, excerpt: source.excerpt },
          ],
        };
      },
    },
    async intelligenceReader(input) {
      calls.push(input);
      return {
        assistant: {
          established: true,
          answer: "The lessee must pay a maintenance reserve by flight-hour usage.",
          findings: [{ type: "obligation", id: "obligation-1", label: "Maintenance reserve" }],
          evidence: [source],
        },
        financialImpact: {
          impacts: [
            {
              category: "maintenance_reserve",
              description: "Engine maintenance reserve rate",
              resultLabel: "Rate per flight hour; not a total exposure",
              calculationMethod: "direct_contract_rate",
              provenance: { evidence: [{ evidenceId: source.id, excerpt: source.excerpt, pageNumber: 9, sourceLocator: source.source_locator }] },
            },
            {
              category: "maintenance_reserve",
              description: "Unproven reserve exposure",
              resultLabel: "EUR 999,999",
              provenance: { evidence: [] },
            },
          ],
        },
        leaseAssessment: {
          applicable: true,
          recommendations: [
            {
              id: "recommendation-1",
              recommendation_key: "same-recommendation",
              is_current: true,
              status: "suggested",
              action: "Review the reserve rate against actual utilization inputs.",
              business_rationale: "The rate is not a confirmed cash balance.",
              urgency: "medium",
              owner_role: "FINANCE",
              evidence: [{ evidenceId: source.id, excerpt: source.excerpt, pageNumber: 9, sourceLocator: source.source_locator }],
            },
            {
              id: "recommendation-duplicate",
              recommendation_key: "same-recommendation",
              is_current: true,
              status: "suggested",
              action: "Duplicate recommendation must be omitted.",
              evidence: [{ evidenceId: source.id, excerpt: source.excerpt }],
            },
            {
              id: "recommendation-rejected",
              recommendation_key: "rejected-recommendation",
              is_current: true,
              status: "rejected",
              action: "Rejected action must be omitted.",
              evidence: [{ evidenceId: source.id, excerpt: source.excerpt }],
            },
          ],
        },
        aircraftRelationships: [{
          evidence_id: source.id,
          excerpt: source.excerpt,
          page_number: 9,
          source_locator: source.source_locator,
          serial_number: "MSN-123",
          relationship_type: "leased_under",
        }],
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    organizationId: ORG_ID,
    analysisRunId: RUN_1_ID,
    question: "What maintenance reserve financial risk and recommended action applies to this aircraft MSN?",
    includeFinancial: true,
    includeRecommendations: true,
    includeAircraftRelationships: true,
  });
  assert.equal(result.answerType, "deterministic_structured_answer");
  assert.match(result.answer, /must pay a maintenance reserve/);
  assert.equal(result.structuredAnswers.length, 1);
  assert.equal(result.structuredAnswers[0].contract.title, "Aircraft Lease A");
  assert.equal(result.financialFindings.length, 1);
  assert.doesNotMatch(result.financialFindings[0].resultLabel, /999,999/);
  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0].humanReviewRequired, true);
  assert.equal(result.aircraftRelationships[0].serialNumber, "MSN-123");
  assert.ok(result.citations.some((citation) => citation.type === "structured_intelligence"));
  assert.ok(result.citations.some((citation) => citation.type === "financial_evidence"));
  assert.match(result.uncertainty.join(" "), /human review remains required/);
  assert.equal(result.coverage.returnedPassages, 2);
  assert.equal(result.coverage.structuredAnalysisRuns, 1);
  assert.equal(result.intelligenceConsumption, 0);
});

test("portfolio assistant propagates structured reader failures instead of returning a success-shaped answer", async () => {
  await assert.rejects(
    () => answerPortfolioContractQuestion({
      organizationId: ORG_ID,
      question: "What are the aircraft termination rights?",
      searchRepository: {
        async searchPortfolio() {
          return {
            results: [{ id: "chunk-1", contractId: CONTRACT_ID, contractTitle: "Aircraft Lease A", documentVersionId: VERSION_1_ID, versionNumber: 1, analysisRunId: RUN_1_ID, excerpt: "Either party may terminate after written notice." }],
          };
        },
      },
      async intelligenceReader() {
        throw Object.assign(new Error("reader failed"), { code: "STORAGE_ERROR", status: 503 });
      },
    }),
    (error) => error.code === "STORAGE_ERROR" && error.status === 503
  );
});

test("portfolio assistant reports unsupported questions without inventing evidence", async () => {
  const result = await answerPortfolioContractQuestion({
    organizationId: ORG_ID,
    question: "What is the total reserve exposure?",
    searchRepository: { async searchPortfolio() { return { results: [], incompleteReferences: true }; } },
  });

  assert.equal(result.established, false);
  assert.deepEqual(result.citations, []);
  assert.equal(result.coverage.completeness, "partial");
  assert.match(result.answer, /cannot establish/i);
});

test("portfolio assistant marks malformed citation records as partial coverage", async () => {
  const result = await answerPortfolioContractQuestion({
    organizationId: ORG_ID,
    question: "Find the reserve payment clause",
    searchRepository: {
      async searchPortfolio() {
        return {
          results: [{ id: "incomplete", excerpt: "Reserve payments are due monthly." }],
          incompleteReferences: false,
        };
      },
    },
  });

  assert.equal(result.established, false);
  assert.equal(result.coverage.completeness, "partial");
  assert.equal(result.coverage.unresolvedReferencesOmitted, true);
});

test("portfolio assistant validates scope and question and route uses authenticated organization scope", async () => {
  await assert.rejects(
    () => answerPortfolioContractQuestion({ organizationId: OTHER_ORG_ID, question: "??" }),
    (error) => error.code === "INVALID_ASSISTANT_QUESTION"
  );
  await assert.rejects(
    () => answerPortfolioContractQuestion({ organizationId: "", question: "Find payment clauses" }),
    (error) => error.code === "ORGANIZATION_ACCESS_DENIED"
  );

  let forwarded;
  const result = await answerPortfolioQuestion({
    organizationId: ORG_ID,
    question: "Find payment clauses",
    searchRepository: { async searchPortfolio(input) { forwarded = input; return { results: [], incompleteReferences: false }; } },
    intelligenceReader: async () => { throw new Error("No run should be queried for an empty result"); },
  });
  assert.equal(forwarded.organizationId, ORG_ID);
  assert.equal(result.established, false);
});
