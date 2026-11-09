import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { createObligationFulfilmentService } from "../services/phase3/intelligence/obligationFulfilmentService.js";
import { createObligationFulfilmentRepository } from "../repositories/phase3/obligationFulfilmentRepository.js";

const IDS = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  foreignOrganizationId: "99999999-9999-4999-8999-999999999999",
  contractId: "22222222-2222-4222-8222-222222222222",
  foreignContractId: "33333333-3333-4333-8333-333333333333",
  documentId: "44444444-4444-4444-8444-444444444444",
  evidenceDocumentId: "55555555-5555-4555-8555-555555555555",
  runId: "66666666-6666-4666-8666-666666666666",
  obligationId: "77777777-7777-4777-8777-777777777777",
  reviewerId: "88888888-8888-4888-8888-888888888888",
  evidenceId: "99999999-9999-4999-8999-999999999999",
  evidenceId2: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

function fixture({
  obligation = {},
  deadlines = [],
  evidence = [],
  history = [],
  analysisRunStatus = "completed",
  createError = null,
} = {}) {
  const analysisRun = {
    id: IDS.runId,
    organization_id: IDS.organizationId,
    contract_id: IDS.contractId,
    document_version_id: "aaaaaaaa-bbbb-4aaa-8aaa-aaaaaaaaaaaa",
    status: analysisRunStatus,
  };
  const version = {
    id: analysisRun.document_version_id,
    organization_id: IDS.organizationId,
    document_id: IDS.documentId,
  };
  const row = {
    id: IDS.obligationId,
    organization_id: IDS.organizationId,
    contract_id: IDS.contractId,
    document_id: IDS.documentId,
    document_version_id: version.id,
    analysis_run_id: IDS.runId,
    description: "The Lessee shall pay monthly rent for the applicable period.",
    actor: "Lessee",
    action: "pay",
    object: "monthly rent",
    obligation_type: "payment",
    review_status: "pending",
    ...obligation,
  };
  const evidenceRows = evidence.length ? evidence : [{
    id: IDS.evidenceId,
    organization_id: IDS.organizationId,
    contract_id: IDS.contractId,
    document_id: IDS.evidenceDocumentId,
    document_version_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    analysis_run_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    document_name: "Payment confirmation.pdf",
    version_number: 1,
    page_number: 1,
    source_locator: "Payment receipt",
    excerpt: "Transfer completed for the November 2026 rent period.",
    stage: "document",
    review_status: "pending",
    confidence: 0.96,
    ambiguity_reason: null,
    created_at: "2026-11-06T10:00:00.000Z",
  }];
  const assessments = [...history];
  const calls = { created: [] };
  const service = createObligationFulfilmentService({
    analysisRunRepository: {
      async getById(id, organizationId) {
        return id === IDS.runId && organizationId === IDS.organizationId ? analysisRun : null;
      },
    },
    obligationRepository: {
      async listByRunScope(scope) {
        return scope.organizationId === IDS.organizationId
          && scope.contractId === IDS.contractId
          ? [row]
          : [];
      },
    },
    deadlineRepository: {
      async listByRunScope() { return deadlines; },
    },
    fulfilmentRepository: {
      async listAvailableEvidence({ organizationId, contractId }) {
        if (organizationId !== IDS.organizationId || contractId !== IDS.contractId) return [];
        return evidenceRows;
      },
      async listByObligation({ organizationId, contractId, obligationId }) {
        if (organizationId !== IDS.organizationId || contractId !== IDS.contractId || obligationId !== IDS.obligationId) return [];
        return assessments;
      },
      async createAssessment(input) {
        if (createError) throw createError;
        calls.created.push(input);
        assessments.unshift({
          id: `assessment-${assessments.length + 1}`,
          reviewer_user_id: input.reviewerUserId,
          status: input.status,
          explanation: input.explanation,
          created_at: `2026-11-06T10:${String(assessments.length).padStart(2, "0")}:00.000Z`,
          evidence: input.evidence.map((link) => {
            const source = evidenceRows.find((item) => item.id === link.evidenceId);
            return {
              id: source.id,
              documentId: source.document_id,
              documentVersionId: source.document_version_id,
              analysisRunId: source.analysis_run_id,
              documentName: source.document_name,
              versionNumber: source.version_number,
              pageNumber: source.page_number,
              sourceLocator: source.source_locator,
              excerpt: source.excerpt,
              confidence: source.confidence,
              ambiguityReason: source.ambiguity_reason,
              reviewStatus: source.review_status,
              relationship: link.relationship,
              periodStatus: link.periodStatus,
              reviewerNote: link.reviewerNote,
            };
          }),
        });
      },
    },
    documentVersionResolver: async (id, organizationId) => (
      id === version.id && organizationId === IDS.organizationId ? version : null
    ),
    clock: () => new Date("2026-11-06T00:00:00.000Z"),
  });
  return { service, calls, assessments, row };
}

function assessment(status, evidence = [], explanation = "Reviewer assessed the cited operational records.") {
  return { status, evidence, explanation };
}

function evidenceLink(evidenceId = IDS.evidenceId, relationship = "supports", periodStatus = "matches") {
  return { evidenceId, relationship, periodStatus };
}

test("fulfilment history distinguishes contract evidence from unassessed operational evidence", async () => {
  const sourceEvidence = {
    id: IDS.evidenceId2,
    document_id: IDS.documentId,
    document_name: "Aircraft lease.pdf",
  };
  const { service } = fixture({ evidence: [sourceEvidence] });
  const result = await service.get({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.runId,
    obligationId: IDS.obligationId,
  });
  assert.equal(result.status, "not_assessed");
  assert.deepEqual(result.history, []);
  assert.equal(result.availableEvidence.length, 0);
  assert.match(result.recommendedAction, /missing evidence is not proof/i);
});

test("available evidence retains extraction quality and uncertainty provenance", async () => {
  const { service } = fixture({
    evidence: [{
      id: IDS.evidenceId,
      organization_id: IDS.organizationId,
      contract_id: IDS.contractId,
      document_id: IDS.evidenceDocumentId,
      document_version_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      analysis_run_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      document_name: "Aircraft insurance certificate.pdf",
      version_number: 1,
      page_number: 2,
      source_locator: "Certificate period",
      excerpt: "Coverage subject to confirmation of insured aircraft serial number.",
      stage: "document",
      review_status: "requires_review",
      confidence: 0.61,
      ambiguity_reason: "Insured aircraft identity is incomplete.",
    }],
  });
  const result = await service.get({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.runId,
    obligationId: IDS.obligationId,
  });
  assert.equal(result.availableEvidence[0].confidence, 0.61);
  assert.equal(result.availableEvidence[0].ambiguityReason, "Insured aircraft identity is incomplete.");
  assert.equal(result.availableEvidence[0].reviewStatus, "requires_review");
});

test("reviewed fulfilment requires explicit period-matched support and rejects conflicts", async () => {
  const { service, calls } = fixture();
  await assert.rejects(() => service.assess({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.runId,
    obligationId: IDS.obligationId,
    reviewerUserId: IDS.reviewerId,
    input: assessment("fulfilled"),
  }), { code: "FULFILMENT_SUPPORT_INSUFFICIENT", status: 400 });
  await assert.rejects(() => service.assess({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.runId,
    obligationId: IDS.obligationId,
    reviewerUserId: IDS.reviewerId,
    input: assessment("fulfilled", [evidenceLink(IDS.evidenceId, "supports", "mismatches")]),
  }), { code: "FULFILMENT_SUPPORT_INSUFFICIENT", status: 400 });
  await assert.rejects(() => service.assess({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.runId,
    obligationId: IDS.obligationId,
    reviewerUserId: IDS.reviewerId,
    input: assessment("fulfilled", [
      evidenceLink(),
      evidenceLink(IDS.evidenceId2, "contradicts"),
    ]),
  }), { code: "FULFILMENT_SUPPORT_INSUFFICIENT", status: 400 });
  assert.equal(calls.created.length, 0);
});

test("partial and disputed states require the matching evidence relationships", async () => {
  const { service } = fixture();
  await assert.rejects(() => service.assess({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.runId,
    obligationId: IDS.obligationId,
    reviewerUserId: IDS.reviewerId,
    input: assessment("disputed", [evidenceLink()]),
  }), { code: "FULFILMENT_CONFLICT_REQUIRED" });
  const { service: partialService } = fixture();
  const partial = await partialService.assess({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.runId,
    obligationId: IDS.obligationId,
    reviewerUserId: IDS.reviewerId,
    input: assessment("partially_fulfilled", [evidenceLink()], "Payment evidence supports some but not all required instalments."),
  });
  assert.equal(partial.status, "partially_fulfilled");
  const { service: validService } = fixture({
    evidence: [
      {
        id: IDS.evidenceId,
        document_id: IDS.evidenceDocumentId,
        document_version_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        analysis_run_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      },
      {
        id: IDS.evidenceId2,
        document_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        document_version_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        analysis_run_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      },
    ],
  });
  const result = await validService.assess({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.runId,
    obligationId: IDS.obligationId,
    reviewerUserId: IDS.reviewerId,
    input: assessment("disputed", [evidenceLink(), evidenceLink(IDS.evidenceId2, "contradicts")]),
  });
  assert.equal(result.status, "disputed");
  assert.equal(result.history[0].evidence.length, 2);
  assert.equal(result.history[0].evidence[0].documentVersionId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
});

test("not fulfilled cannot be concluded from missing or only supporting evidence", async () => {
  const { service } = fixture();
  for (const evidence of [[], [evidenceLink()]]) {
    await assert.rejects(() => service.assess({
      organizationId: IDS.organizationId,
      analysisRunId: IDS.runId,
      obligationId: IDS.obligationId,
      reviewerUserId: IDS.reviewerId,
      input: assessment("not_fulfilled", evidence),
    }), { code: "FULFILMENT_NEGATIVE_CLAIM_UNSUPPORTED" });
  }
});

test("assessment history is append-only, attributed, and allows explicit reassessment", async () => {
  const { service, calls } = fixture();
  const submitted = await service.assess({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.runId,
    obligationId: IDS.obligationId,
    reviewerUserId: IDS.reviewerId,
    input: assessment("evidence_submitted", [evidenceLink()], "Payment record submitted for review."),
  });
  assert.equal(submitted.status, "evidence_submitted");
  const reviewed = await service.assess({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.runId,
    obligationId: IDS.obligationId,
    reviewerUserId: IDS.reviewerId,
    input: assessment("fulfilled", [evidenceLink()], "Reviewer confirmed the payment period and amount."),
  });
  assert.equal(reviewed.status, "fulfilled");
  assert.equal(reviewed.history.length, 2);
  assert.equal(reviewed.history[0].reviewerUserId, IDS.reviewerId);
  assert.equal(calls.created.length, 2);
  assert.equal(calls.created[0].explanation, "Payment record submitted for review.");
  assert.equal(calls.created[1].evidence[0].periodStatus, "matches");
});

test("concurrent duplicate submissions append independent review history", async () => {
  const { service, calls } = fixture();
  const submission = {
    organizationId: IDS.organizationId,
    analysisRunId: IDS.runId,
    obligationId: IDS.obligationId,
    reviewerUserId: IDS.reviewerId,
    input: assessment("evidence_submitted", [evidenceLink()], "Same evidence submitted for independent review."),
  };
  await Promise.all([
    service.assess(submission),
    service.assess(submission),
  ]);
  assert.equal(calls.created.length, 2);
  assert.equal(calls.created[0].status, "evidence_submitted");
  assert.equal(calls.created[1].status, "evidence_submitted");
});

test("synthetic lease operations support distinct performed and unresolved review outcomes", async () => {
  const aviationObligations = [
    ["delivery", "deliver", "aircraft delivery documentation", "Signed aircraft delivery receipt and acceptance checklist."],
    ["compliance", "provide", "complete aircraft technical records", "Aircraft technical records index and current status sheet."],
    ["insurance", "maintain", "required hull insurance", "Current aircraft hull insurance certificate."],
    ["maintenance", "perform", "scheduled maintenance", "Approved maintenance release for the scheduled check."],
    ["payment", "pay", "monthly maintenance reserve payment", "Maintenance reserve remittance statement for November 2026."],
    ["redelivery", "return", "aircraft in required return condition", "Aircraft return inspection and records checklist."],
  ];

  for (const [index, [obligationType, action, object, excerpt]] of aviationObligations.entries()) {
    const sourceRows = [
      [IDS.evidenceId, IDS.evidenceDocumentId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "cccccccc-cccc-4ccc-8ccc-cccccccccccc", excerpt],
      [IDS.evidenceId2, "dddddddd-dddd-4ddd-8ddd-dddddddddddd", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "ffffffff-ffff-4fff-8fff-ffffffffffff", "Evidence indicates the required action remains outstanding."],
    ].map(([id, documentId, documentVersionId, analysisRunId, sourceExcerpt], evidenceIndex) => ({
      id,
      organization_id: IDS.organizationId,
      contract_id: IDS.contractId,
      document_id: documentId,
      document_version_id: documentVersionId,
      analysis_run_id: analysisRunId,
      document_name: evidenceIndex === 0 ? `Lease operations record ${index + 1}.pdf` : `Exception report ${index + 1}.pdf`,
      version_number: 1,
      page_number: evidenceIndex + 1,
      source_locator: evidenceIndex === 0 ? "Operational record" : "Exception entry",
      excerpt: sourceExcerpt,
      stage: "document",
      review_status: "verified",
      confidence: evidenceIndex === 0 ? 0.96 : 0.92,
      ambiguity_reason: null,
    }));

    const fulfilled = fixture({
      obligation: { obligation_type: obligationType, action, object },
      evidence: sourceRows,
    });
    const result = await fulfilled.service.assess({
      organizationId: IDS.organizationId,
      analysisRunId: IDS.runId,
      obligationId: IDS.obligationId,
      reviewerUserId: IDS.reviewerId,
      input: assessment("fulfilled", [evidenceLink(IDS.evidenceId)], `Reviewer checked the ${object} record.`),
    });
    assert.equal(result.status, "fulfilled", `${obligationType}: ${object}`);
    assert.equal(result.history[0].evidence[0].excerpt, excerpt);
    assert.equal(result.history[0].evidence[0].confidence, 0.96);

    const notFulfilled = fixture({
      obligation: { obligation_type: obligationType, action, object },
      evidence: sourceRows,
    });
    const negativeResult = await notFulfilled.service.assess({
      organizationId: IDS.organizationId,
      analysisRunId: IDS.runId,
      obligationId: IDS.obligationId,
      reviewerUserId: IDS.reviewerId,
      input: assessment("not_fulfilled", [evidenceLink(IDS.evidenceId2, "contradicts")], `Reviewer checked the outstanding ${object} item.`),
    });
    assert.equal(negativeResult.status, "not_fulfilled", `${obligationType}: ${object}`);

    const insufficient = fixture({
      obligation: { obligation_type: obligationType, action, object },
      evidence: sourceRows,
    });
    const insufficientResult = await insufficient.service.assess({
      organizationId: IDS.organizationId,
      analysisRunId: IDS.runId,
      obligationId: IDS.obligationId,
      reviewerUserId: IDS.reviewerId,
      input: assessment("insufficient_evidence", [], `No admissible evidence establishes whether ${object} occurred.`),
    });
    assert.equal(insufficientResult.status, "insufficient_evidence", `${obligationType}: ${object}`);
    assert.equal(insufficientResult.history[0].evidence.length, 0);

    const disputed = fixture({
      obligation: { obligation_type: obligationType, action, object },
      evidence: sourceRows,
    });
    const disputedResult = await disputed.service.assess({
      organizationId: IDS.organizationId,
      analysisRunId: IDS.runId,
      obligationId: IDS.obligationId,
      reviewerUserId: IDS.reviewerId,
      input: assessment("disputed", [
        evidenceLink(IDS.evidenceId),
        evidenceLink(IDS.evidenceId2, "contradicts"),
      ], `Records conflict about the ${object} obligation.`),
    });
    assert.equal(disputedResult.status, "disputed", `${obligationType}: ${object}`);
  }
});

test("cross-tenant runs, cross-contract evidence and incomplete obligations fail closed", async () => {
  const { service, calls } = fixture();
  await assert.rejects(() => service.get({
    organizationId: IDS.foreignOrganizationId,
    analysisRunId: IDS.runId,
    obligationId: IDS.obligationId,
  }), { code: "ANALYSIS_RUN_NOT_FOUND", status: 404 });
  await assert.rejects(() => service.assess({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.runId,
    obligationId: IDS.obligationId,
    reviewerUserId: IDS.reviewerId,
    input: assessment("fulfilled", [evidenceLink(IDS.foreignContractId)]),
  }), { code: "FULFILMENT_EVIDENCE_SCOPE_INVALID", status: 422 });
  assert.equal(calls.created.length, 0);

  const incompleteRun = fixture({ analysisRunStatus: "processing" });
  await assert.rejects(() => incompleteRun.service.get({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.runId,
    obligationId: IDS.obligationId,
  }), { code: "ANALYSIS_NOT_COMPLETED", status: 422 });

  const incomplete = fixture({ obligation: { actor: null } });
  await assert.rejects(() => incomplete.service.assess({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.runId,
    obligationId: IDS.obligationId,
    reviewerUserId: IDS.reviewerId,
    input: assessment("fulfilled", [evidenceLink()]),
  }), { code: "OBLIGATION_INCOMPLETE", status: 422 });
});

test("database failures are surfaced without reporting a successful assessment", async () => {
  const databaseFailure = Object.assign(new Error("database unavailable"), { code: "DB_UNAVAILABLE" });
  const { service, calls } = fixture({ createError: databaseFailure });
  await assert.rejects(() => service.assess({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.runId,
    obligationId: IDS.obligationId,
    reviewerUserId: IDS.reviewerId,
    input: assessment("evidence_submitted", [evidenceLink()]),
  }), (error) => error === databaseFailure);
  assert.equal(calls.created.length, 0);
});

test("passed verified deadline prompts review but never labels breach or overwrites fulfilment status", async () => {
  const { service: pendingService } = fixture({
    deadlines: [{
      id: IDS.evidenceId2,
      obligation_id: IDS.obligationId,
      absolute_date: "2026-11-01",
      status: "calculated",
      computability: "absolute",
      review_status: "verified",
    }],
  });
  const pending = await pendingService.get({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.runId,
    obligationId: IDS.obligationId,
  });
  assert.equal(pending.status, "not_assessed");
  assert.equal(pending.deadlineReviewPrompt.status, "deadline_passed_fulfilment_unestablished");
  assert.match(pending.deadlineReviewPrompt.message, /does not determine breach/i);
});

test("fulfilment route retains tenant authentication and write permission boundary", async () => {
  const source = await fs.readFile(new URL("../routes/analysisRunRoutes.js", import.meta.url), "utf8");
  assert.match(source, /router\.use\(\s*authenticateUser,\s*requireOrganizationMembership,\s*requireOrganizationPermission\("contract:read"\)\s*\)/);
  assert.match(source, /router\.get\("\/:id\/obligations\/:obligationId\/fulfilment"/);
  assert.match(source, /router\.post\(\s*"\/:id\/obligations\/:obligationId\/fulfilment",\s*requireOrganizationPermission\("contract:write"\)/);
});

test("migration enforces same-tenant contract scope and append-only assessment history", async () => {
  const migration = await fs.readFile(new URL("../supabase/migrations/024_obligation_fulfilment_assessment.sql", import.meta.url), "utf8");
  assert.match(migration, /unique \(id, organization_id, contract_id\)/);
  assert.match(migration, /references public\.obligations\(id, organization_id, contract_id\)/);
  assert.match(migration, /references public\.intelligence_evidence\(id, organization_id, contract_id\)/);
  assert.match(migration, /before update or delete on public\.obligation_fulfilment_assessments/);
  assert.match(migration, /before update or delete on public\.obligation_fulfilment_assessment_evidence/);
  assert.match(migration, /for select to authenticated\s+using \(public\.is_organization_member\(organization_id\)\)/);
  assert.match(migration, /for select to authenticated\s+using \(public\.is_organization_member\(organization_id\)\)/);
});

test("repository scopes evidence queries and rolls back an invalid cross-contract evidence reference", async () => {
  const statements = [];
  let permitEvidence = false;
  const connection = {
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("select id, document_id") && sql.includes("from obligations")) {
        return { rows: [{ id: IDS.obligationId, document_id: IDS.documentId }] };
      }
      if (sql.includes("from intelligence_evidence e") && sql.includes("for share of e")) {
        return { rows: permitEvidence ? [{ id: IDS.evidenceId }] : [] };
      }
      if (sql.includes("insert into obligation_fulfilment_assessments")) {
        return { rows: [{
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          organization_id: IDS.organizationId,
          contract_id: IDS.contractId,
          obligation_id: IDS.obligationId,
          reviewer_user_id: IDS.reviewerId,
          status: "fulfilled",
          explanation: "Human review completed.",
        }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const repository = createObligationFulfilmentRepository({
    async query(sql, values) {
      statements.push({ sql, values });
      return { rows: [] };
    },
    async connect() { return connection; },
  });
  await repository.listAvailableEvidence({
    organizationId: IDS.organizationId,
    contractId: IDS.contractId,
    excludedDocumentId: IDS.documentId,
  });
  await repository.listByObligation({
    organizationId: IDS.organizationId,
    contractId: IDS.contractId,
    obligationId: IDS.obligationId,
  });
  const availableEvidenceQuery = statements.find((item) => item.sql.includes("from intelligence_evidence e") && !item.sql.includes("for share of e"));
  assert.match(availableEvidenceQuery.sql, /e\.organization_id = \$1/);
  assert.match(availableEvidenceQuery.sql, /e\.contract_id = \$2/);
  assert.match(availableEvidenceQuery.sql, /e\.confidence, e\.ambiguity_reason/);
  const historyQuery = statements.find((item) => item.sql.includes("jsonb_build_object"));
  assert.match(historyQuery.sql, /'confidence', e\.confidence/);
  assert.match(historyQuery.sql, /'ambiguityReason', e\.ambiguity_reason/);
  assert.match(historyQuery.sql, /a\.organization_id = \$1\s+and a\.contract_id = \$2/);

  const input = {
    organizationId: IDS.organizationId,
    contractId: IDS.contractId,
    obligationId: IDS.obligationId,
    reviewerUserId: IDS.reviewerId,
    status: "fulfilled",
    explanation: "Human review completed.",
    evidence: [evidenceLink()],
  };
  await assert.rejects(() => repository.createAssessment(input), {
    code: "FULFILMENT_EVIDENCE_SCOPE_INVALID",
    status: 422,
  });
  assert.ok(statements.some((item) => item.sql === "ROLLBACK"));
  assert.ok(statements.some((item) => item.sql.includes("e.organization_id = $2") && item.sql.includes("e.contract_id = $3")));
  const evidenceValidation = statements.find((item) => item.sql.includes("for share of e"));
  assert.match(evidenceValidation.sql, /v\.extraction_status = 'completed'/);
  assert.match(evidenceValidation.sql, /ar\.status = 'completed'/);
  assert.equal(statements.some((item) => item.sql.includes("insert into obligation_fulfilment_assessments")), false);

  permitEvidence = true;
  const created = await repository.createAssessment(input);
  assert.equal(created.reviewer_user_id, IDS.reviewerId);
  assert.equal(statements.filter((item) => item.sql === "COMMIT").length, 1);
});
