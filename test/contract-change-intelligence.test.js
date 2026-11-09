import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import test from "node:test";

import {
  buildContractChangeComparison,
  createContractChangeIntelligenceService,
} from "../services/phase3/intelligence/contractChangeIntelligenceService.js";

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const CONTRACT_ID = "22222222-2222-4222-8222-222222222222";

async function fixtureSnapshot(filename, suffix, expiryDeadline) {
  const contents = await fs.readFile(new URL(`./fixtures/aviation-change/${filename}`, import.meta.url), "utf8");
  const clauses = contents.trim().split(/\r?\n/).slice(1).map((line) => {
    const [clause_number, category, title, page, source_text] = line.split("\t");
    const id = crypto.randomUUID();
    const evidenceId = crypto.randomUUID();
    return {
      id,
      clause_number,
      category,
      title,
      source_text,
      confidence: 0.99,
      review_status: "pending",
      evidence: [{
        id: evidenceId,
        pageNumber: Number(page),
        sourceLocator: `Clause ${clause_number}`,
        excerpt: source_text,
        reviewStatus: "pending",
        rank: 1,
        isPrimary: true,
      }],
    };
  });
  const clauseByNumber = new Map(clauses.map((clause) => [clause.clause_number, clause]));
  const rentClause = clauseByNumber.get("1.1");
  const reserveClause = clauseByNumber.get("1.2");
  const termClause = clauseByNumber.get("1.5");
  const noticeClause = clauseByNumber.get("1.6");
  return {
    source: {
      analysisRunId: crypto.randomUUID(),
      documentName: `synthetic-${suffix}.txt`,
      documentVersionNumber: 1,
    },
    clauses,
    obligations: [{
      id: crypto.randomUUID(),
      clause_id: reserveClause.id,
      description: "Pay engine maintenance reserves",
      obligation_type: "maintenance",
      status: "identified",
      review_status: "pending",
    }, {
      id: `extension-obligation-${suffix}`,
      clause_id: noticeClause.id,
      description: "Give extension notice",
      obligation_type: "notice",
      status: "identified",
      review_status: "pending",
    }],
    deadlines: [{
      id: expiryDeadline,
      source_clause_id: noticeClause.id,
      obligation_id: `extension-obligation-${suffix}`,
      original_expression: "180 days before lease expiry",
      timing_expression: "180 days before lease expiry",
      anchor_reference: "lease expiry",
      absolute_date: suffix === "source-a" ? "2027-12-31" : "2028-12-31",
      status: "identified",
      review_status: "pending",
    }, {
      id: crypto.randomUUID(),
      source_clause_id: termClause.id,
      original_expression: "Lease term expires 30 June",
      timing_expression: "Lease term expiry",
      anchor_reference: null,
      absolute_date: suffix === "source-a" ? "2028-06-30" : "2029-06-30",
      status: "identified",
      review_status: "pending",
    }],
    risks: [{
      id: crypto.randomUUID(),
      clause_id: reserveClause.id,
      title: "Maintenance reserve amount requires review",
      risk_type: "maintenance_reserve_exposure",
      severity: "medium",
      status: "identified",
      review_status: "pending",
      source_references: [{ source_type: "clause", source_id: reserveClause.id }],
    }, {
      id: `extension-risk-${suffix}`,
      clause_id: null,
      title: "Extension notice deadline may require recalculation",
      risk_type: "deadline_dependency",
      severity: "low",
      status: "identified",
      review_status: "pending",
      affected_deadline_ids: [expiryDeadline],
    }],
    financialImpact: {
      impacts: [{
        id: `rent-impact-${suffix}`,
        sourceClauseId: rentClause.id,
        sourceRiskId: null,
        category: "contractual_payment",
        description: "Monthly aircraft rent",
        baseAmount: suffix === "source-a" ? 120000 : 135000,
        currency: "USD",
        frequency: "monthly",
        calculationMethod: "direct_contract_amount",
      }],
    },
    evidenceByClause: new Map(clauses.map((clause) => [clause.id, clause.evidence])),
  };
}

test("synthetic aircraft lease comparison isolates changed commercial terms and preserves source evidence", async () => {
  const sourceA = await fixtureSnapshot("aircraft-lease-source-a.txt", "source-a", "deadline-a");
  const sourceB = await fixtureSnapshot("aircraft-lease-source-b.txt", "source-b", "deadline-b");
  const originalSnapshots = structuredClone([sourceA, sourceB]);

  const result = buildContractChangeComparison({ sourceA, sourceB });

  assert.equal(result.status, "review_required");
  assert.deepEqual(result.summary, { modified: 3, unchanged: 3 });
  assert.deepEqual([sourceA, sourceB], originalSnapshots);
  assert.deepEqual(result.comparisonBasis, {
    sourceA: "explicitly_selected",
    sourceB: "explicitly_selected",
    contractualChronology: "unknown",
    legalApplicability: "unknown",
  });
  const rentChange = result.changes.find((item) => item.original?.clauseNumber === "1.1");
  assert.equal(rentChange.type, "modified");
  assert.equal(rentChange.financialTermReviewRequired, true);
  assert.equal(rentChange.impactStatus, "possible_impact_direct_source_link");
  assert.equal(rentChange.linkedIntelligence.original.financialAssessments[0].baseAmount, 120000);
  assert.equal(rentChange.linkedIntelligence.comparison.financialAssessments[0].baseAmount, 135000);
  assert.equal("financialDelta" in rentChange, false);
  assert.match(rentChange.original.text, /USD 120,000/);
  assert.match(rentChange.comparison.text, /USD 135,000/);
  assert.equal(rentChange.original.evidence[0].pageNumber, 1);
  assert.equal(rentChange.original.evidenceStatus, "available");
  assert.equal(rentChange.comparison.evidence[0].sourceLocator, "Clause 1.1");

  const reserveChange = result.changes.find((item) => item.original?.clauseNumber === "1.2");
  assert.equal(reserveChange.linkedIntelligence.original.obligations.length, 1);
  assert.equal(reserveChange.linkedIntelligence.original.risks.length, 1);
  assert.equal(reserveChange.linkedIntelligence.reassessmentRequired, true);
  assert.equal(reserveChange.impactStatus, "possible_impact_direct_source_link");

  const expiryChange = result.changes.find((item) => item.original?.clauseNumber === "1.5");
  assert.equal(expiryChange.type, "modified");
  assert.equal(expiryChange.impactStatus, "possible_impact_direct_source_link");
  assert.equal(expiryChange.linkedIntelligence.original.potentiallyRelatedDeadlines.length, 1);
  assert.equal(expiryChange.linkedIntelligence.comparison.potentiallyRelatedDeadlines.length, 1);
  assert.equal(expiryChange.linkedIntelligence.original.potentiallyRelatedDeadlines[0].potentiallyAffectedObligations[0].id, "extension-obligation-source-a");
  assert.equal(expiryChange.linkedIntelligence.original.potentiallyRelatedDeadlines[0].potentiallyAffectedRisks[0].id, "extension-risk-source-a");
  const expiryWithoutDirectDeadline = buildContractChangeComparison({
    sourceA: { ...sourceA, deadlines: sourceA.deadlines.filter((item) => item.source_clause_id !== expiryChange.original.clauseId) },
    sourceB: { ...sourceB, deadlines: sourceB.deadlines.filter((item) => item.source_clause_id !== expiryChange.comparison.clauseId) },
  }).changes.find((item) => item.original?.clauseNumber === "1.5");
  assert.equal(expiryWithoutDirectDeadline.impactStatus, "possible_impact_candidate_link");

  const unchangedClause = result.changes.find((item) => item.type === "unchanged");
  assert.equal(unchangedClause.impactStatus, "no_text_change_detected");
  assert.equal(unchangedClause.linkedIntelligence.reassessmentRequired, false);
  assert.equal(result.interpretation.effectiveDate, "unknown");
  assert.equal(result.interpretation.supersessionStatus, "unknown");
  assert.ok(result.limitations.some((item) => item.includes("not asserted to have been added or removed")));
  assert.throws(() => buildContractChangeComparison({
    sourceA: { ...sourceA, clauses: [] },
    sourceB,
  }), { code: "CHANGE_COMPARISON_UNAVAILABLE", status: 422 });
});

test("unmatched clauses remain unresolved rather than being asserted added or removed", () => {
  const source = (clauseNumber, text) => ({
    source: {},
    clauses: [{
      id: crypto.randomUUID(),
      clause_number: clauseNumber,
      title: "Rent",
      category: "Commercial/payment",
      source_text: text,
    }],
    obligations: [],
    deadlines: [],
    risks: [],
    evidenceByClause: new Map(),
  });

  const result = buildContractChangeComparison({
    sourceA: source("7.1", "Pay monthly aircraft rent of USD 120,000."),
    sourceB: source("9.4", "Pay monthly aircraft rent of USD 135,000."),
  });
  assert.deepEqual(result.summary, { unmatched_original: 1, unmatched_comparison: 1 });
  assert.ok(result.changes.every((item) => item.reviewStatus === "requires_human_review"));
  assert.ok(result.changes.every((item) => item.candidateChange.startsWith("potential_")));
  assert.ok(result.changes.every((item) => item.impactStatus === "unresolved_no_explicit_relationship"));
  assert.ok(result.changes.every((item) => item.financialTermReviewRequired));
});

test("ambiguous analysis pairs and cross-contract runs fail closed before source loading", async () => {
  const firstRunId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const secondRunId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const otherContractRunId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const foreignTenantRunId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const incompleteRunId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const runs = new Map([
    [firstRunId, {
      id: firstRunId,
      organization_id: ORGANIZATION_ID,
      contract_id: CONTRACT_ID,
      status: "completed",
    }],
    [secondRunId, {
      id: secondRunId,
      organization_id: ORGANIZATION_ID,
      contract_id: CONTRACT_ID,
      status: "completed",
    }],
    [otherContractRunId, {
      id: otherContractRunId,
      organization_id: ORGANIZATION_ID,
      contract_id: "33333333-3333-4333-8333-333333333333",
      status: "completed",
    }],
    [foreignTenantRunId, {
      id: foreignTenantRunId,
      organization_id: "99999999-9999-4999-8999-999999999999",
      contract_id: CONTRACT_ID,
      status: "completed",
    }],
    [incompleteRunId, {
      id: incompleteRunId,
      organization_id: ORGANIZATION_ID,
      contract_id: CONTRACT_ID,
      status: "processing",
    }],
  ]);
  let sourceLoads = 0;
  const [sourceA, sourceB] = await Promise.all([
    fixtureSnapshot("aircraft-lease-source-a.txt", "source-a", "deadline-a"),
    fixtureSnapshot("aircraft-lease-source-b.txt", "source-b", "deadline-b"),
  ]);
  const service = createContractChangeIntelligenceService({
    analysisRunRepository: {
      async getById(id, organizationId) {
        const run = runs.get(id);
        return run?.organization_id === organizationId ? run : null;
      },
    },
    snapshotLoader: async (run) => {
      sourceLoads += 1;
      return run.id === firstRunId ? sourceA : sourceB;
    },
  });
  await assert.rejects(() => service.compare({
    organizationId: ORGANIZATION_ID,
    sourceAAnalysisRunId: firstRunId,
    sourceBAnalysisRunId: otherContractRunId,
  }), { code: "ANALYSIS_RUN_NOT_FOUND", status: 404 });
  assert.equal(sourceLoads, 0);

  await assert.rejects(() => service.compare({
    organizationId: ORGANIZATION_ID,
    sourceAAnalysisRunId: firstRunId,
    sourceBAnalysisRunId: foreignTenantRunId,
  }), { code: "ANALYSIS_RUN_NOT_FOUND", status: 404 });
  assert.equal(sourceLoads, 0);

  await assert.rejects(() => service.compare({
    organizationId: ORGANIZATION_ID,
    sourceAAnalysisRunId: firstRunId,
    sourceBAnalysisRunId: incompleteRunId,
  }), { code: "ANALYSIS_NOT_COMPLETED", status: 422 });
  assert.equal(sourceLoads, 0);

  const comparison = await service.compare({
    organizationId: ORGANIZATION_ID,
    sourceAAnalysisRunId: firstRunId,
    sourceBAnalysisRunId: secondRunId,
  });
  assert.equal(comparison.status, "review_required");
  assert.equal(sourceLoads, 2);

  await assert.rejects(() => service.compare({
    organizationId: ORGANIZATION_ID,
    sourceAAnalysisRunId: firstRunId,
    sourceBAnalysisRunId: firstRunId,
  }), { code: "CHANGE_COMPARISON_REQUIRES_TWO_RUNS", status: 400 });
});

test("incomplete extraction and snapshot loading failures are surfaced without a partial comparison", async () => {
  const firstRunId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const secondRunId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const runs = new Map([firstRunId, secondRunId].map((id) => [id, {
    id,
    organization_id: ORGANIZATION_ID,
    contract_id: CONTRACT_ID,
    document_version_id: `version-${id}`,
    status: "completed",
  }]));
  const filters = [];
  const client = {
    from(table) {
      return {
        select() { return this; },
        eq(field, value) { filters.push({ table, field, value }); return this; },
        async maybeSingle() {
          return {
            data: {
              id: `version-${firstRunId}`,
              document_id: "document-a",
              organization_id: ORGANIZATION_ID,
              extraction_status: "failed",
            },
            error: null,
          };
        },
      };
    },
  };
  const repository = { async listByRun() { return []; } };
  const service = createContractChangeIntelligenceService({
    client,
    analysisRunRepository: { async getById(id, organizationId) {
      const run = runs.get(id);
      return run?.organization_id === organizationId ? run : null;
    } },
    clauseRepository: { ...repository, async listByRunScope() { return []; }, async listClauseEvidenceLinks() { return []; } },
    obligationRepository: { async listByRunScope() { return []; } },
    deadlineRepository: { async listByRunScope() { return []; } },
    riskRepository: { async listByRunScope() { return []; } },
    evidenceRepository: { async listByRun() { return []; } },
    profileRepository: { async getByRun() { return null; } },
  });
  await assert.rejects(() => service.compare({
    organizationId: ORGANIZATION_ID,
    sourceAAnalysisRunId: firstRunId,
    sourceBAnalysisRunId: secondRunId,
  }), { code: "SOURCE_EXTRACTION_INCOMPLETE", status: 422 });
  assert.ok(filters.some((filter) => filter.field === "organization_id" && filter.value === ORGANIZATION_ID));

  const snapshot = await fixtureSnapshot("aircraft-lease-source-a.txt", "source-a", "deadline-a");
  const failingService = createContractChangeIntelligenceService({
    analysisRunRepository: { async getById(id, organizationId) {
      const run = runs.get(id);
      return run?.organization_id === organizationId ? run : null;
    } },
    snapshotLoader: async (run) => {
      if (run.id === secondRunId) throw new Error("snapshot storage unavailable");
      return snapshot;
    },
  });
  await assert.rejects(() => failingService.compare({
    organizationId: ORGANIZATION_ID,
    sourceAAnalysisRunId: firstRunId,
    sourceBAnalysisRunId: secondRunId,
  }), /snapshot storage unavailable/);
});

test("comparison route remains behind authenticated organization contract-read middleware", async () => {
  const routeSource = await fs.readFile(new URL("../routes/analysisRunRoutes.js", import.meta.url), "utf8");
  assert.match(routeSource, /router\.use\(\s*authenticateUser,\s*requireOrganizationMembership,\s*requireOrganizationPermission\("contract:read"\)\s*\)/);
  assert.match(routeSource, /router\.get\("\/:sourceAId\/compare\/:sourceBId"/);
});
