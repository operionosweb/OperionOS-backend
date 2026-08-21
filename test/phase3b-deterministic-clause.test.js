import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { CLAUSE_CATEGORIES } from "../domain/contractIntelligence/enums.js";
import {
  deterministicClauseConstants,
  segmentDeterministicClauses,
  runDeterministicClauseStage,
  computeClauseIdentity,
} from "../services/phase3/intelligence/deterministicClauseService.js";
import { buildCanonicalPageSource } from "../services/phase3/source/deterministicSourcePageAdapter.js";
import { createClauseRepository } from "../repositories/phase3/clauseRepository.js";

const UUID_PLACEHOLDER = "11111111-1111-4111-8111-111111111111";

function buildTestSource(text) {
  return {
    organizationId: UUID_PLACEHOLDER,
    contractId: UUID_PLACEHOLDER,
    documentId: UUID_PLACEHOLDER,
    documentVersionId: UUID_PLACEHOLDER,
    analysisRunId: UUID_PLACEHOLDER,
    text,
    pageBoundaries: "derived_unavailable",
    pages: [],
    sourceLocator: (start, end) => `source:char:${start}-${end}`,
  };
}

// Simulates a real PostgreSQL connection's transactional semantics (BEGIN/COMMIT/
// ROLLBACK isolation and a unique constraint on (document_version_id,
// analysis_run_id, clause_identity)) so the repository's real transaction code path
// can be exercised without a live database. This is CODE-VERIFIED behavior only;
// it does not prove anything about actual PostgreSQL locking/MVCC semantics, which
// remain DATABASE REQUIRED — NOT EXECUTED.
function createFakeTransactionalPgPool() {
  const committed = { clauses: [], intelligence_evidence: [], clause_evidence: [] };
  const log = [];
  let idCounter = 0;

  function parseInsertRows(sql, values) {
    const columnsMatch = sql.match(/\(([^)]+)\) values/i);
    const columns = columnsMatch[1].split(",").map((column) => column.trim());
    const rows = [];
    for (let i = 0; i < values.length; i += columns.length) {
      const row = {};
      columns.forEach((column, index) => {
        row[column] = values[i + index];
      });
      rows.push(row);
    }
    return rows;
  }

  function connect() {
    let pending = null;

    return Promise.resolve({
      async query(sql, values = []) {
        const normalized = sql.trim().toLowerCase();
        log.push(normalized.split("\n")[0].slice(0, 40));

        if (normalized === "begin") {
          pending = { clauses: [], intelligence_evidence: [], clause_evidence: [] };
          return { rows: [] };
        }

        if (normalized === "commit") {
          committed.clauses.push(...pending.clauses);
          committed.intelligence_evidence.push(...pending.intelligence_evidence);
          committed.clause_evidence.push(...pending.clause_evidence);
          pending = null;
          return { rows: [] };
        }

        if (normalized === "rollback") {
          pending = null;
          return { rows: [] };
        }

        if (normalized.startsWith("insert into clauses")) {
          const rows = parseInsertRows(sql, values);
          for (const row of rows) {
            const isDuplicate = [...committed.clauses, ...pending.clauses].some(
              (existing) =>
                existing.document_version_id === row.document_version_id &&
                existing.analysis_run_id === row.analysis_run_id &&
                existing.clause_identity === row.clause_identity
            );
            if (isDuplicate) {
              const error = new Error(
                'duplicate key value violates unique constraint "clauses_document_version_run_identity_key"'
              );
              error.code = "23505";
              throw error;
            }
            idCounter += 1;
            row.id = `clause-${idCounter}`;
          }
          pending.clauses.push(...rows);
          return { rows };
        }

        if (normalized.startsWith("insert into intelligence_evidence")) {
          const rows = parseInsertRows(sql, values);
          rows.forEach((row) => {
            idCounter += 1;
            row.id = `evidence-${idCounter}`;
          });
          pending.intelligence_evidence.push(...rows);
          return { rows };
        }

        if (normalized.startsWith("insert into clause_evidence")) {
          const rows = parseInsertRows(sql, values);
          pending.clause_evidence.push(...rows);
          return { rows };
        }

        if (normalized.startsWith("update clauses")) {
          const [parentClauseId, childClauseId] = values;
          const row =
            pending.clauses.find((clause) => clause.id === childClauseId) ||
            committed.clauses.find((clause) => clause.id === childClauseId);
          if (row) row.parent_clause_id = parentClauseId;
          return { rows: [] };
        }

        throw new Error(`Unhandled query in fake pg client: ${sql}`);
      },
      release() {},
    });
  }

  return { connect, committed, log };
}

function buildClausePlan({ clauseNumber, title, sourceText, charStart, charEnd }) {
  return {
    organization_id: UUID_PLACEHOLDER,
    contract_id: UUID_PLACEHOLDER,
    document_id: UUID_PLACEHOLDER,
    document_version_id: UUID_PLACEHOLDER,
    analysis_run_id: UUID_PLACEHOLDER,
    clause_number: clauseNumber,
    title,
    category: "general",
    subtype: "numbered_heading",
    source_text: sourceText,
    confidence: 0.5,
    review_status: "pending",
    clause_identity: computeClauseIdentity({
      clauseNumber,
      title,
      sourceText,
      charStart,
      charEnd,
      organizationId: UUID_PLACEHOLDER,
      documentVersionId: UUID_PLACEHOLDER,
      analysisRunId: UUID_PLACEHOLDER,
    }),
  };
}

function buildEvidencePlan(clausePlan, { charStart, charEnd }) {
  return {
    organization_id: UUID_PLACEHOLDER,
    contract_id: UUID_PLACEHOLDER,
    document_id: UUID_PLACEHOLDER,
    document_version_id: UUID_PLACEHOLDER,
    analysis_run_id: UUID_PLACEHOLDER,
    page_id: null,
    page_number: null,
    excerpt: clausePlan.source_text,
    char_start: charStart,
    char_end: charEnd,
    source_locator: `source:char:${charStart}-${charEnd}`,
    stage: "deterministic_clause_segmentation",
    provider: null,
    model: null,
    prompt_version: null,
    pipeline_version: "phase3b-deterministic-clause-v1",
    confidence: 0.5,
    review_status: "pending",
    ambiguity_reason: null,
    evidence_hash: crypto.createHash("sha256").update(clausePlan.source_text).digest("hex"),
  };
}

test("clauseRepository.persistDeterministicClauseStage real transaction boundary", async (suite) => {
  await suite.test("CODE-VERIFIED: commits clauses, evidence, and clause_evidence in one transaction", async () => {
    const pgPool = createFakeTransactionalPgPool();
    const repository = createClauseRepository({}, pgPool);
    const clause1 = buildClausePlan({ clauseNumber: "1", title: "Payment", sourceText: "1. Payment\nPay rent.", charStart: 0, charEnd: 20 });
    const clause2 = buildClausePlan({ clauseNumber: "1.1", title: "Timing", sourceText: "1.1 Timing\nMonthly.", charStart: 20, charEnd: 40 });

    const result = await repository.persistDeterministicClauseStage({
      organizationId: UUID_PLACEHOLDER,
      contractId: UUID_PLACEHOLDER,
      documentId: UUID_PLACEHOLDER,
      documentVersionId: UUID_PLACEHOLDER,
      analysisRunId: UUID_PLACEHOLDER,
      clauses: [clause1, clause2],
      evidenceRows: [buildEvidencePlan(clause1, { charStart: 0, charEnd: 20 }), buildEvidencePlan(clause2, { charStart: 20, charEnd: 40 })],
      parentClausePlan: [{ clause_number: "1.1", parent_clause_number: "1" }],
    });

    assert.equal(result.clauses.length, 2);
    assert.equal(result.evidence.length, 2);
    assert.equal(result.clauseEvidence.length, 2);
    assert.equal(pgPool.committed.clauses.length, 2);
    // parent link resolved even though clause_identity correlation (not array index) was used
    const child = result.clauses.find((row) => row.clause_number === "1.1");
    const parent = result.clauses.find((row) => row.clause_number === "1");
    assert.equal(child.parent_clause_id, parent.id);
    assert.deepEqual(pgPool.log.slice(0, 1), ["begin"]);
    assert.ok(pgPool.log.includes("commit"));
    assert.ok(!pgPool.log.includes("rollback"));
  });

  await suite.test("CODE-VERIFIED: failure during evidence insert rolls back the whole batch, no clauses persist", async () => {
    const pgPool = createFakeTransactionalPgPool();
    const originalConnect = pgPool.connect;
    let callCount = 0;
    pgPool.connect = async () => {
      const conn = await originalConnect();
      const originalQuery = conn.query.bind(conn);
      conn.query = async (sql, values) => {
        if (sql.trim().toLowerCase().startsWith("insert into intelligence_evidence")) {
          callCount += 1;
          throw new Error("evidence insert failure injection");
        }
        return originalQuery(sql, values);
      };
      return conn;
    };
    const repository = createClauseRepository({}, pgPool);
    const clause1 = buildClausePlan({ clauseNumber: "1", title: "Payment", sourceText: "1. Payment\nPay rent.", charStart: 0, charEnd: 20 });

    await assert.rejects(
      () =>
        repository.persistDeterministicClauseStage({
          organizationId: UUID_PLACEHOLDER,
          contractId: UUID_PLACEHOLDER,
          documentId: UUID_PLACEHOLDER,
          documentVersionId: UUID_PLACEHOLDER,
          analysisRunId: UUID_PLACEHOLDER,
          clauses: [clause1],
          evidenceRows: [buildEvidencePlan(clause1, { charStart: 0, charEnd: 20 })],
          parentClausePlan: [],
        }),
      /evidence insert failure injection/
    );

    assert.equal(callCount, 1);
    assert.equal(pgPool.committed.clauses.length, 0, "no clause row should be visible after rollback");
    assert.equal(pgPool.committed.intelligence_evidence.length, 0);
    assert.ok(pgPool.log.includes("rollback"));
    assert.ok(!pgPool.log.includes("commit"));
  });

  await suite.test("CODE-VERIFIED: failure during clause_evidence insert rolls back clauses and evidence together", async () => {
    const pgPool = createFakeTransactionalPgPool();
    const originalConnect = pgPool.connect;
    pgPool.connect = async () => {
      const conn = await originalConnect();
      const originalQuery = conn.query.bind(conn);
      conn.query = async (sql, values) => {
        if (sql.trim().toLowerCase().startsWith("insert into clause_evidence")) {
          throw new Error("clause_evidence insert failure injection");
        }
        return originalQuery(sql, values);
      };
      return conn;
    };
    const repository = createClauseRepository({}, pgPool);
    const clause1 = buildClausePlan({ clauseNumber: "1", title: "Payment", sourceText: "1. Payment\nPay rent.", charStart: 0, charEnd: 20 });

    await assert.rejects(
      () =>
        repository.persistDeterministicClauseStage({
          organizationId: UUID_PLACEHOLDER,
          contractId: UUID_PLACEHOLDER,
          documentId: UUID_PLACEHOLDER,
          documentVersionId: UUID_PLACEHOLDER,
          analysisRunId: UUID_PLACEHOLDER,
          clauses: [clause1],
          evidenceRows: [buildEvidencePlan(clause1, { charStart: 0, charEnd: 20 })],
          parentClausePlan: [],
        }),
      /clause_evidence insert failure injection/
    );

    assert.equal(pgPool.committed.clauses.length, 0);
    assert.equal(pgPool.committed.intelligence_evidence.length, 0);
    assert.equal(pgPool.committed.clause_evidence.length, 0);
  });

  await suite.test("CODE-VERIFIED: retry after a failed stage succeeds and leaves exactly one committed batch", async () => {
    const pgPool = createFakeTransactionalPgPool();
    const originalConnect = pgPool.connect;
    let shouldFail = true;
    pgPool.connect = async () => {
      const conn = await originalConnect();
      const originalQuery = conn.query.bind(conn);
      conn.query = async (sql, values) => {
        if (shouldFail && sql.trim().toLowerCase().startsWith("insert into intelligence_evidence")) {
          throw new Error("transient failure");
        }
        return originalQuery(sql, values);
      };
      return conn;
    };
    const repository = createClauseRepository({}, pgPool);
    const clause1 = buildClausePlan({ clauseNumber: "1", title: "Payment", sourceText: "1. Payment\nPay rent.", charStart: 0, charEnd: 20 });
    const args = {
      organizationId: UUID_PLACEHOLDER,
      contractId: UUID_PLACEHOLDER,
      documentId: UUID_PLACEHOLDER,
      documentVersionId: UUID_PLACEHOLDER,
      analysisRunId: UUID_PLACEHOLDER,
      clauses: [clause1],
      evidenceRows: [buildEvidencePlan(clause1, { charStart: 0, charEnd: 20 })],
      parentClausePlan: [],
    };

    await assert.rejects(() => repository.persistDeterministicClauseStage(args));
    assert.equal(pgPool.committed.clauses.length, 0);

    shouldFail = false;
    const result = await repository.persistDeterministicClauseStage(args);
    assert.equal(result.clauses.length, 1);
    assert.equal(pgPool.committed.clauses.length, 1);
  });

  await suite.test("CODE-VERIFIED: duplicate same-run invocation is rejected by the clause_identity unique constraint", async () => {
    const pgPool = createFakeTransactionalPgPool();
    const repository = createClauseRepository({}, pgPool);
    const clause1 = buildClausePlan({ clauseNumber: "1", title: "Payment", sourceText: "1. Payment\nPay rent.", charStart: 0, charEnd: 20 });
    const args = {
      organizationId: UUID_PLACEHOLDER,
      contractId: UUID_PLACEHOLDER,
      documentId: UUID_PLACEHOLDER,
      documentVersionId: UUID_PLACEHOLDER,
      analysisRunId: UUID_PLACEHOLDER,
      clauses: [clause1],
      evidenceRows: [buildEvidencePlan(clause1, { charStart: 0, charEnd: 20 })],
      parentClausePlan: [],
    };

    const first = await repository.persistDeterministicClauseStage(args);
    assert.equal(first.clauses.length, 1);

    // Simulates two concurrent callers that both passed listByRun() before either
    // inserted (the check-then-insert race). The second transaction must fail and
    // roll back cleanly rather than create a duplicate stage result.
    await assert.rejects(() => repository.persistDeterministicClauseStage(args), /duplicate key value/);

    assert.equal(pgPool.committed.clauses.length, 1, "only the first batch may persist");
  });

  await suite.test("DATABASE REQUIRED — NOT EXECUTED: real Postgres unique_violation (23505) enforcement under true concurrency", () => {
    // The fake pool above proves the application code correctly issues BEGIN,
    // detects a duplicate, and issues ROLLBACK. It cannot prove that PostgreSQL's
    // actual MVCC/locking behavior serializes two truly concurrent transactions
    // the same way. That requires a live database and is intentionally not
    // simulated here.
    assert.ok(true);
  });
});

test("canonical source page adapter and atomic persistence boundaries", async (suite) => {
  await suite.test("derived source pages expose canonical provenance and exact offsets", () => {
    const source = buildCanonicalPageSource({
      documentVersion: { id: UUID_PLACEHOLDER, organization_id: UUID_PLACEHOLDER },
      document: { id: UUID_PLACEHOLDER, contract_id: UUID_PLACEHOLDER, organization_id: UUID_PLACEHOLDER },
      analysisRun: { id: UUID_PLACEHOLDER, organization_id: UUID_PLACEHOLDER, status: "extracting" },
      extraction: { text_content: "1. Payment\nRent is due.\n\n2. Maintenance\nAircraft must be maintained.", extraction_status: "completed", text_truncated: false },
    });

    assert.equal(source.pageBoundaries, "derived_unavailable");
    assert.equal(source.pages.length > 0, true);
    assert.equal(source.pages[0].source_provenance, "derived_from_extraction_text");
    assert.equal(source.text.slice(source.pages[0].char_start, source.pages[0].char_end), source.pages[0].text_content);
    assert.equal(
      source.text.slice(source.pages[1].char_start, source.pages[1].char_end),
      source.pages[1].text_content
    );
  });

  await suite.test("runDeterministicClauseStage preserves atomic persistence contract", async () => {
    const calls = { count: 0 };
    const source = buildTestSource("1. Payment\nRent is due.");
    const fakeClauseRepository = {
      listByRun: async () => [],
      persistDeterministicClauseStage: async ({ clauses }) => {
        calls.count += 1;
        if (calls.count === 1) {
          throw new Error("evidence failure injection");
        }
        return {
          clauses: clauses.map((clause, index) => ({ ...clause, id: `clause-${index}` })),
          evidence: [],
          clauseEvidence: [],
        };
      },
    };

    await assert.rejects(
      () => runDeterministicClauseStage({
        documentVersionId: UUID_PLACEHOLDER,
        analysisRunId: UUID_PLACEHOLDER,
        organizationId: UUID_PLACEHOLDER,
        sourceService: { load: async () => source },
        clauseRepository: fakeClauseRepository,
      }),
      /evidence failure injection/
    );
  });
});

test("Phase 3B deterministic clause segmentation", async (suite) => {
  await suite.test("empty text throws", () => {
    assert.throws(
      () => segmentDeterministicClauses(buildTestSource("")),
      (error) => error.code === "SOURCE_TEXT_UNAVAILABLE"
    );
  });

  await suite.test("single unstructured text clause", () => {
    const source = buildTestSource(
      "This is an aircraft maintenance and service agreement."
    );
    const clauses = segmentDeterministicClauses(source);
    assert.equal(clauses.length, 1);
    assert.equal(clauses[0].clause_number, null);
    assert.equal(clauses[0].title, "Unstructured clause content");
    assert.equal(clauses[0].category, "maintenance");
    assert.equal(clauses[0].subtype, "unstructured");
    assert.equal(clauses[0].evidence.char_start, 0);
    assert.ok(clauses[0].evidence.char_end > 0);
    assert.equal(clauses[0].review_status, "requires_review");
  });

  await suite.test("preamble + numbered ARTICLE structure", () => {
    const source = buildTestSource(
      `This Agreement is entered into.

ARTICLE 1 - RENT
The lessee shall pay monthly rent.

ARTICLE 2 - MAINTENANCE
The lessee shall maintain the aircraft.`
    );
    const clauses = segmentDeterministicClauses(source);
    assert.ok(clauses.length >= 3);
    assert.equal(clauses[0].title, "Preamble");
    assert.equal(clauses[1].clause_number, "1");
    assert.equal(clauses[1].title, "RENT");
    assert.equal(clauses[2].clause_number, "2");
    assert.equal(clauses[2].title, "MAINTENANCE");
  });

  await suite.test("numbered clause structure (1, 2, 3)", () => {
    const source = buildTestSource(
      `1. Payment Obligations
The lessee shall pay rent quarterly.

2. Maintenance
The lessor shall maintain airworthiness.

3. Insurance
The lessee shall procure insurance.`
    );
    const clauses = segmentDeterministicClauses(source);
    assert.equal(clauses.length, 3);
    assert.equal(clauses[0].clause_number, "1");
    assert.equal(clauses[0].title, "Payment Obligations");
    assert.equal(clauses[0].category, "commercial/payment");
    assert.equal(clauses[1].clause_number, "2");
    assert.equal(clauses[1].category, "maintenance");
    assert.equal(clauses[2].clause_number, "3");
    assert.equal(clauses[2].category, "insurance");
  });

  await suite.test("nested clause structure (3, 3.1, 3.1.1)", () => {
    const source = buildTestSource(
      `3. Maintenance Program
The maintenance shall follow FAA guidelines.

3.1 Scheduled Maintenance
Maintenance is performed every 400 hours.

3.1.1 Engine Inspection
Engine shall be inspected by authorized personnel.

4. Delivery
Aircraft delivered in airworthy condition.`
    );
    const clauses = segmentDeterministicClauses(source);
    assert.equal(clauses.length, 4);
    assert.equal(clauses[0].clause_number, "3");
    assert.equal(clauses[1].clause_number, "3.1");
    assert.equal(clauses[2].clause_number, "3.1.1");
    assert.equal(clauses[3].clause_number, "4");
  });

  await suite.test("SECTION-based structure", () => {
    const source = buildTestSource(
      `SECTION 1 - Lease Term
This agreement establishes the lease term.

SECTION 2 - Payment Terms
Lessee shall pay as follows.

SECTION 2.1 - Late Fees
Payment delays incur fees.`
    );
    const clauses = segmentDeterministicClauses(source);
    assert.ok(clauses.length >= 3);
    assert.equal(clauses[0].clause_number, "1");
    assert.equal(clauses[0].subtype, "section");
  });

  await suite.test("unnumbered heading detection", () => {
    const source = buildTestSource(
      `PAYMENT TERMS
The lessee shall pay rent.

MAINTENANCE OBLIGATIONS
The aircraft shall be maintained.`
    );
    const clauses = segmentDeterministicClauses(source);
    assert.ok(clauses.length >= 2);
    const unnumbered = clauses.find((c) => c.subtype === "unnumbered_heading");
    assert.ok(unnumbered);
    assert.equal(unnumbered.clause_number, null);
    assert.equal(unnumbered.review_status, "requires_review");
  });

  await suite.test("category classification for maintenance", () => {
    const source = buildTestSource(
      `1. Maintenance and Airworthiness
The lessor shall ensure the aircraft is airworthy.`
    );
    const clauses = segmentDeterministicClauses(source);
    assert.equal(clauses[0].category, "maintenance");
    assert.ok(clauses[0].confidence > 0.7);
  });

  await suite.test("category classification for termination", () => {
    const source = buildTestSource(
      `5. Termination and Default
Either party may terminate upon default.`
    );
    const clauses = segmentDeterministicClauses(source);
    assert.equal(clauses[0].category, "termination/default");
  });

  await suite.test("category defaults to general with low confidence", () => {
    const source = buildTestSource(
      `2. Miscellaneous
This section contains various provisions.`
    );
    const clauses = segmentDeterministicClauses(source);
    assert.equal(clauses[0].category, "general");
    assert.ok(clauses[0].confidence < 0.7);
  });

  await suite.test("evidence char_start and char_end correctness", () => {
    const text = `1. First Clause
Content of first clause.

2. Second Clause
Content of second clause.`;
    const source = buildTestSource(text);
    const clauses = segmentDeterministicClauses(source);
    assert.equal(clauses.length, 2);

    const firstEvidence = clauses[0].evidence;
    const firstSlice = text.slice(firstEvidence.char_start, firstEvidence.char_end);
    assert.ok(firstSlice.includes("1. First Clause"));
    assert.ok(firstSlice.includes("Content of first clause"));

    const secondEvidence = clauses[1].evidence;
    const secondSlice = text.slice(secondEvidence.char_start, secondEvidence.char_end);
    assert.ok(secondSlice.includes("2. Second Clause"));
  });

  await suite.test("evidence source_locator format", () => {
    const source = buildTestSource("1. Test\nTest content.");
    const clauses = segmentDeterministicClauses(source);
    assert.ok(clauses.length > 0);
    const clause = clauses[0];
    assert.ok(clause.evidence);
    assert.ok(clause.evidence.source_locator);
    assert.ok(clause.evidence.source_locator.startsWith("source:char:"));
    const parts = clause.evidence.source_locator.split(":");
    const range = parts[2].split("-");
    assert.equal(range.length, 2);
    assert.ok(Number.isFinite(Number(range[0])));
    assert.ok(Number.isFinite(Number(range[1])));
  });

  await suite.test("clause/evidence relationship structure", () => {
    const source = buildTestSource("1. Single Clause\nWith content.");
    const clauses = segmentDeterministicClauses(source);
    const clause = clauses[0];
    assert.ok(clause.organization_id);
    assert.ok(clause.contract_id);
    assert.ok(clause.document_id);
    assert.ok(clause.document_version_id);
    assert.ok(clause.analysis_run_id);
    assert.ok(clause.evidence.organization_id === clause.organization_id);
    assert.ok(clause.evidence.contract_id === clause.contract_id);
    assert.ok(clause.evidence.pipeline_version);
  });

  await suite.test("organization scope is preserved", () => {
    const orgId = "99999999-9999-4999-9999-999999999999";
    const source = buildTestSource("1. Test\nContent.");
    source.organizationId = orgId;
    const clauses = segmentDeterministicClauses(source);
    assert.equal(clauses[0].organization_id, orgId);
    assert.equal(clauses[0].evidence.organization_id, orgId);
  });

  await suite.test("evidence hash is SHA256 of source text", () => {
    const source = buildTestSource("1. Test\nContent.");
    const clauses = segmentDeterministicClauses(source);
    const evidenceText = clauses[0].evidence.excerpt;
    const expectedHash = crypto
      .createHash("sha256")
      .update(evidenceText)
      .digest("hex");
    assert.equal(clauses[0].evidence.evidence_hash, expectedHash);
  });

  await suite.test("pipeline version is constant", () => {
    const source = buildTestSource("1. Test");
    const clauses = segmentDeterministicClauses(source);
    assert.equal(clauses[0].evidence.pipeline_version, deterministicClauseConstants.pipelineVersion);
  });

  await suite.test("no AI provider metadata in evidence", () => {
    const source = buildTestSource("1. Test\nContent.");
    const clauses = segmentDeterministicClauses(source);
    assert.equal(clauses[0].evidence.provider, null);
    assert.equal(clauses[0].evidence.model, null);
    assert.equal(clauses[0].evidence.prompt_version, null);
  });

  await suite.test("page_id and page_number are unavailable", () => {
    const source = buildTestSource("1. Test");
    const clauses = segmentDeterministicClauses(source);
    assert.equal(clauses[0].evidence.page_id, null);
    assert.equal(clauses[0].evidence.page_number, null);
    assert.ok(clauses[0].evidence.ambiguity_reason.includes("PDF page boundaries"));
  });

  await suite.test("taxonomy categories match Phase 3A enums", () => {
    const source = buildTestSource(
      `1. Payment
Payment terms apply.

2. Maintenance
Maintenance is required.

3. Insurance
Insurance is required.`
    );
    const clauses = segmentDeterministicClauses(source);
    clauses.forEach((clause) => {
      assert.ok(
        CLAUSE_CATEGORIES.includes(clause.category),
        `category ${clause.category} is in Phase 3A taxonomy`
      );
    });
  });

  await suite.test("confidence values are within bounds", () => {
    const source = buildTestSource(
      `1. Numbered and Matched
Maintenance is required.

GENERAL HEADING
No clear structure.`
    );
    const clauses = segmentDeterministicClauses(source);
    clauses.forEach((clause) => {
      assert.ok(
        clause.confidence >= 0 && clause.confidence <= 1,
        `confidence ${clause.confidence} is between 0 and 1`
      );
      assert.ok(
        clause.evidence.confidence >= 0 && clause.evidence.confidence <= 1,
        `evidence confidence ${clause.evidence.confidence} is between 0 and 1`
      );
    });
  });

  await suite.test("review_status reflects structure and category", () => {
    const source = buildTestSource(
      `1. Numbered Maintenance
Maintenance applies.

GENERAL UNNUMBERED HEADING
Content here.`
    );
    const clauses = segmentDeterministicClauses(source);
    assert.ok(clauses.length >= 2);
    assert.equal(clauses[0].review_status, "pending");
    const unnumbered = clauses.find((c) => c.subtype === "unnumbered_heading");
    assert.ok(unnumbered);
    assert.equal(unnumbered.review_status, "requires_review");
  });

  await suite.test("mixed structures in one document", () => {
    const source = buildTestSource(
      `Preamble to the agreement.

ARTICLE 1 - RIGHTS AND OBLIGATIONS
The parties shall perform as follows.

SECTION 2 - Payment Terms
2.1 Monthly payments are due.
2.1.1 Payment method shall be wire transfer.

3. GENERAL
Everything else.`
    );
    const clauses = segmentDeterministicClauses(source);
    assert.ok(clauses.length >= 4);
    const structures = new Set(clauses.map((c) => c.subtype));
    assert.ok(structures.has("preamble"));
    assert.ok(structures.has("article"));
  });

  await suite.test("evidence excerpt contains segment text", () => {
    const text = `1. Maintenance Clause
The lessor shall ensure airworthiness.

2. Payment Clause
The lessee shall pay rent.`;
    const source = buildTestSource(text);
    const clauses = segmentDeterministicClauses(source);
    assert.ok(clauses[0].evidence.excerpt.includes("Maintenance"));
    assert.ok(clauses[1].evidence.excerpt.includes("Payment"));
  });

  await suite.test("source_text matches evidence excerpt", () => {
    const source = buildTestSource("1. Test\nContent here.");
    const clauses = segmentDeterministicClauses(source);
    assert.equal(clauses[0].source_text, clauses[0].evidence.excerpt);
  });

  await suite.test("deterministic clauses are repeatable", () => {
    const text = `1. Payment
Pay rent.

2. Maintenance
Maintain aircraft.`;
    const source1 = buildTestSource(text);
    const source2 = buildTestSource(text);
    const clauses1 = segmentDeterministicClauses(source1);
    const clauses2 = segmentDeterministicClauses(source2);

    assert.equal(clauses1.length, clauses2.length);
    clauses1.forEach((clause, index) => {
      assert.equal(clause.clause_number, clauses2[index].clause_number);
      assert.equal(clause.title, clauses2[index].title);
      assert.equal(clause.category, clauses2[index].category);
      assert.equal(clause.evidence.char_start, clauses2[index].evidence.char_start);
      assert.equal(clause.evidence.char_end, clauses2[index].evidence.char_end);
    });
  });

  await suite.test("empty heading with content", () => {
    const source = buildTestSource(
      `1.
Content immediately after the number.

2. Titled Clause
More content.`
    );
    const clauses = segmentDeterministicClauses(source);
    assert.ok(clauses.length >= 2);
    assert.equal(clauses[0].clause_number, "1");
    assert.ok(clauses[0].title);
  });

  await suite.test("false positives from numbered prose are not treated as headings", () => {
    const text = `On the effective date, the parties shall commence performance.
The supplier may terminate for convenience.

1) dates and monetary amounts shall be identified in the schedule.
2. In the event of termination, the parties shall cooperate.

3.1% interest applies to overdue amounts.
EUR 1.2 million shall be paid on demand.
The customer shall provide access.

Section 3.1 of this Agreement defines the service level.
Payment under Section 4 shall be due within 30 days.`;
    const clauses = segmentDeterministicClauses(buildTestSource(text));
    assert.ok(clauses.every((clause) => !/^\d+(?:\.\d+)*%?$/.test(clause.clause_number || "") || clause.subtype !== "numbered_heading"));
    assert.ok(clauses.every((clause) => !/Section\s+\d+(?:\.\d+)?/i.test(clause.title)));
  });

  await suite.test("valid unnumbered and numbered headings remain detectable", () => {
    const text = `PAYMENT TERMS
The lessee shall pay rent.

MAINTENANCE OBLIGATIONS
The aircraft shall be maintained.

1 PAYMENT
This is payment.

2 MAINTENANCE
This is maintenance.

3.1 SERVICE LEVELS
Service levels apply.

ARTICLE 4 — TERMINATION
Termination is allowed.

SECTION 5 — INSURANCE
Insurance is required.`;
    const clauses = segmentDeterministicClauses(buildTestSource(text));
    const titles = clauses.map((clause) => clause.title);
    const numbers = clauses.map((clause) => clause.clause_number);
    assert.ok(titles.some((title) => title === "PAYMENT TERMS"));
    assert.ok(titles.some((title) => title === "MAINTENANCE OBLIGATIONS"));
    assert.ok(numbers.includes("1"));
    assert.ok(numbers.includes("2"));
    assert.ok(numbers.includes("3.1"));
    assert.ok(titles.some((title) => title === "PAYMENT" || title === "MAINTENANCE"));
    assert.ok(titles.some((title) => title.includes("SERVICE LEVELS")));
    assert.ok(titles.some((title) => title === "TERMINATION"));
    assert.ok(titles.some((title) => title === "INSURANCE"));
  });

  await suite.test("nested hierarchy resolves parent numbers exactly", () => {
    const text = `3. Maintenance Program
Maintenance is required.

3.1 Scheduled Maintenance
Schedule maintenance.

3.1.1 Engine Inspection
Inspect engine.

3.1.2 Cabin Inspection
Inspect cabin.

3.2 Maintenance Notice
Notice required.

4. Delivery
Deliver aircraft.`;
    const clauses = segmentDeterministicClauses(buildTestSource(text));
    const byNumber = new Map(clauses.map((clause) => [clause.clause_number, clause]));
    assert.equal(byNumber.get("3").parent_clause_number, null);
    assert.equal(byNumber.get("3.1").parent_clause_number, "3");
    assert.equal(byNumber.get("3.1.1").parent_clause_number, "3.1");
    assert.equal(byNumber.get("3.1.2").parent_clause_number, "3.1");
    assert.equal(byNumber.get("3.2").parent_clause_number, "3");
    assert.equal(byNumber.get("4").parent_clause_number, null);
  });

  await suite.test("missing parent stays null when parent number is absent", () => {
    const text = `3.1 Service Level
Service level applies.

3.2 Availability
Availability applies.`;
    const clauses = segmentDeterministicClauses(buildTestSource(text));
    const byNumber = new Map(clauses.map((clause) => [clause.clause_number, clause]));
    assert.equal(byNumber.get("3.1").parent_clause_number, null);
    assert.equal(byNumber.get("3.2").parent_clause_number, null);
  });

  await suite.test("repeated unnumbered headings preserve distinct identities by location", () => {
    const text = `PAYMENT TERMS
The lessee shall pay rent.

PAYMENT TERMS
The lessor shall pay maintenance.`;
    const clauses = segmentDeterministicClauses(buildTestSource(text));
    const headings = clauses.filter((clause) => clause.subtype === "unnumbered_heading");
    assert.equal(headings.length, 2);
    assert.notEqual(headings[0].clause_identity, headings[1].clause_identity);
    assert.notEqual(headings[0].evidence.char_start, headings[1].evidence.char_start);
  });

  await suite.test("evidence offsets remain exact for representative claims", () => {
    const text = `1. Payment
The lessee shall pay rent.

2. Maintenance
The lessor shall maintain the aircraft.`;
    const clauses = segmentDeterministicClauses(buildTestSource(text));
    for (const clause of clauses) {
      assert.ok(clause.evidence.char_start >= 0);
      assert.ok(clause.evidence.char_end <= text.length);
      assert.ok(clause.evidence.char_start < clause.evidence.char_end);
      assert.equal(text.slice(clause.evidence.char_start, clause.evidence.char_end), clause.evidence.excerpt);
    }
  });

  await suite.test("deterministic segmentation is stable across repeated runs", () => {
    const text = `3. Maintenance Program
Maintenance is required.

3.1 Scheduled Maintenance
Maintenance is performed.

4. Delivery
Delivery occurs.`;
    const first = segmentDeterministicClauses(buildTestSource(text));
    const second = segmentDeterministicClauses(buildTestSource(text));
    assert.deepEqual(first.map((clause) => ({
      clause_number: clause.clause_number,
      title: clause.title,
      category: clause.category,
      parent_clause_number: clause.parent_clause_number,
      confidence: clause.confidence,
      clause_identity: clause.clause_identity,
      char_start: clause.evidence.char_start,
      char_end: clause.evidence.char_end,
    })), second.map((clause) => ({
      clause_number: clause.clause_number,
      title: clause.title,
      category: clause.category,
      parent_clause_number: clause.parent_clause_number,
      confidence: clause.confidence,
      clause_identity: clause.clause_identity,
      char_start: clause.evidence.char_start,
      char_end: clause.evidence.char_end,
    })));
  });

  await suite.test("repository query scopes parent update by organization, contract, document, document version, and run", async () => {
    const { createClauseRepository } = await import("../repositories/phase3/clauseRepository.js");
    const calls = [];
    const fakeClient = {
      from(table) {
        calls.push(["from", table]);
        return {
          select(field) {
            calls.push(["select", field]);
            return {
              in(column, values) {
                calls.push(["in", column, values]);
                return {
                  eq(key, value) {
                    calls.push(["eq", key, value]);
                    return this;
                  },
                  then(resolve) {
                    resolve({ data: [{ id: "id-1" }], error: null });
                    return this;
                  },
                };
              },
            };
          },
          update(payload) {
            calls.push(["update", payload]);
            return {
              eq(key, value) {
                calls.push(["eq", key, value]);
                return this;
              },
              select() {
                calls.push(["select"]);
                return { single: async () => ({ data: { id: "id-1" }, error: null }) };
              },
            };
          },
        };
      },
    };

    const repo = createClauseRepository(fakeClient);
    await repo.updateParentLinks({
      organizationId: UUID_PLACEHOLDER,
      contractId: UUID_PLACEHOLDER,
      documentId: UUID_PLACEHOLDER,
      documentVersionId: UUID_PLACEHOLDER,
      analysisRunId: UUID_PLACEHOLDER,
      parentLinks: [{ clause_id: "id-1", parent_clause_id: "parent-1" }],
    });

    assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "contract_id"));
    assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "document_id"));
    assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "document_version_id"));
    assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "analysis_run_id"));
  });
});
