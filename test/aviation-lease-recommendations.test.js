import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { createAviationLeaseRecommendationRepository } from "../repositories/phase3/aviationLeaseRecommendationRepository.js";
import {
  createAviationLeaseRecommendationService,
  deriveAviationLeaseRecommendations,
  validateAviationLeaseRecommendationDecision,
} from "../services/phase3/intelligence/aviationLeaseRecommendationService.js";
import { readAnalysisRunAviationLeaseRiskAssessment } from "../routes/analysisRunRoutes.js";

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const CONTRACT_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";
const RUN_ID = "55555555-5555-4555-8555-555555555555";
const OBLIGATION_ID = "66666666-6666-4666-8666-666666666666";
const CLAUSE_ID = "77777777-7777-4777-8777-777777777777";
const EVIDENCE_ID = "88888888-8888-4888-8888-888888888888";
const REVIEWER_ID = "99999999-9999-4999-8999-999999999999";
const RECOMMENDATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SCOPE = {
  organizationId: ORGANIZATION_ID,
  contractId: CONTRACT_ID,
  documentId: DOCUMENT_ID,
  documentVersionId: VERSION_ID,
  analysisRunId: RUN_ID,
};

function risk(overrides = {}) {
  return {
    id: "aviation-lease-obligation-66666666",
    obligation_id: OBLIGATION_ID,
    clause_id: CLAUSE_ID,
    risk_category: "insurance",
    risk_type: "aviation_lease_insurance_review",
    title: "Review aircraft insurance certificate",
    description: "No operational fulfilment assessment is recorded.",
    rationale: "Derived from the cited aircraft lease clause and available evidence.",
    priority: "MEDIUM",
    status: "requires_review",
    assessment_status: "not_assessed",
    deadline_information: {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      status: "approaching",
      absoluteDate: "2026-11-20",
    },
    recommended_action: "Obtain current insurance certificates and compare coverage and effective dates with the cited lease clause.",
    contract_evidence: [{
      evidenceId: EVIDENCE_ID,
      sourceLocator: "Clause 12.4",
      pageNumber: 8,
      excerpt: "Lessee shall maintain aircraft hull insurance.",
      confidence: 0.96,
      reviewStatus: "verified",
      supportType: "supports",
      isPrimary: true,
    }],
    operational_evidence: [],
    uncertainty_indicators: ["No human fulfilment assessment has been recorded."],
    ...overrides,
  };
}

function storedRecommendation(overrides = {}) {
  return {
    id: RECOMMENDATION_ID,
    recommendation_key: "f".repeat(64),
    organization_id: ORGANIZATION_ID,
    contract_id: CONTRACT_ID,
    document_id: DOCUMENT_ID,
    document_version_id: VERSION_ID,
    analysis_run_id: RUN_ID,
    obligation_id: OBLIGATION_ID,
    clause_id: CLAUSE_ID,
    source_risk_key: "old-risk-key",
    recommendation_type: "review",
    action: "Previous recommendation action",
    business_rationale: "Earlier evidence-derived reasoning.",
    urgency: "medium",
    owner_role: "INSURANCE",
    confidence: 0.91,
    review_status: "pending",
    created_at: "2026-11-01T10:00:00.000Z",
    evidence: [],
    decision_history: [{
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "accepted",
      actor_type: "human",
      reviewer_user_id: REVIEWER_ID,
      explanation: "Accepted after review.",
      created_at: "2026-11-02T10:00:00.000Z",
    }],
    ...overrides,
  };
}

test("generates evidence-backed actions with obligation, risk, source, priority, and uncertainty", () => {
  const [recommendation] = deriveAviationLeaseRecommendations({ scope: SCOPE, risks: [risk()] });
  assert.equal(recommendation.status, "suggested");
  assert.equal(recommendation.is_current, true);
  assert.equal(recommendation.organization_id, ORGANIZATION_ID);
  assert.equal(recommendation.contract_id, CONTRACT_ID);
  assert.equal(recommendation.obligation_id, OBLIGATION_ID);
  assert.equal(recommendation.source_risk_key, "aviation-lease-obligation-66666666");
  assert.equal(recommendation.clause_id, CLAUSE_ID);
  assert.equal(recommendation.recommendation_type, "monitor_deadline");
  assert.equal(recommendation.urgency, "medium");
  assert.equal(recommendation.owner_role, "INSURANCE");
  assert.equal(recommendation.evidence_confidence, 0.96);
  assert.equal(recommendation.evidence[0].evidenceId, EVIDENCE_ID);
  assert.match(recommendation.business_rationale, /Clause 12\.4/);
  assert.match(recommendation.business_rationale, /not a contractual requirement or legal determination/i);
});

test("selects explainable recommendation categories for disputed, overdue, and ambiguous situations", () => {
  const disputed = deriveAviationLeaseRecommendations({
    scope: SCOPE,
    risks: [risk({ assessment_status: "disputed", deadline_information: null })],
  })[0];
  assert.equal(disputed.recommendation_type, "review");

  const overdue = deriveAviationLeaseRecommendations({
    scope: SCOPE,
    risks: [risk({ assessment_status: "not_fulfilled", deadline_information: { status: "passed" } })],
  })[0];
  assert.equal(overdue.recommendation_type, "escalate");

  const ambiguous = deriveAviationLeaseRecommendations({
    scope: SCOPE,
    risks: [risk({
      deadline_information: null,
      uncertainty_indicators: ["The aircraft asset scope needs confirmation."],
    })],
  })[0];
  assert.equal(ambiguous.recommendation_type, "clarify");

  const humanReviewedOutstanding = deriveAviationLeaseRecommendations({
    scope: SCOPE,
    risks: [risk({
      assessment_status: "not_fulfilled",
      deadline_information: null,
      uncertainty_indicators: [],
    })],
  })[0];
  assert.equal(humanReviewedOutstanding.recommendation_type, "escalate");

  const overdueUnassessed = deriveAviationLeaseRecommendations({
    scope: SCOPE,
    risks: [risk({ assessment_status: "not_assessed", deadline_information: { status: "passed" } })],
  })[0];
  assert.equal(overdueUnassessed.recommendation_type, "escalate");
});

test("supports category-specific owner suggestions across aviation delivery, maintenance, finance, insurance, and redelivery", () => {
  const categories = [
    ["delivery/redelivery", "aviation_lease_delivery_review", "AIRCRAFT_DELIVERY"],
    ["maintenance/operational", "aviation_lease_maintenance_review", "MAINTENANCE"],
    ["financial", "aviation_lease_financial_review", "FINANCE"],
    ["insurance", "aviation_lease_insurance_review", "INSURANCE"],
    ["delivery/redelivery", "aviation_lease_redelivery_review", "LEASE_RETURN"],
  ];
  for (const [riskCategory, riskType, ownerRole] of categories) {
    const [recommendation] = deriveAviationLeaseRecommendations({
      scope: SCOPE,
      risks: [risk({ risk_category: riskCategory, risk_type: riskType, deadline_information: null })],
    });
    assert.equal(recommendation.owner_role, ownerRole);
    assert.ok(recommendation.evidence.length > 0);
    assert.ok(recommendation.action.length > 0);
  }
});

test("a changed utilization reading derives a distinct recommendation without changing other recommendation keys", () => {
  const utilizationRisk = (recordedUtilisation) => risk({
    risk_category: "maintenance/operational",
    risk_type: "aviation_lease_utilization_review",
    deadline_information: null,
    utilisation_exposure: {
      metrics: [{
        unit: "flight_hours",
        contractualLimit: 300,
        recordedUtilisation,
        headroom: 300 - recordedUtilisation,
        consumedPercent: Number(((recordedUtilisation / 300) * 100).toFixed(2)),
        status: "approaching",
        reportingPeriod: { start: "2026-01-01", end: "2026-11-09" },
        sources: [{ evidenceId: EVIDENCE_ID }],
      }],
    },
  });
  const [first] = deriveAviationLeaseRecommendations({ scope: SCOPE, risks: [utilizationRisk(250)] });
  const [updated] = deriveAviationLeaseRecommendations({ scope: SCOPE, risks: [utilizationRisk(260)] });
  assert.notEqual(first.recommendation_key, updated.recommendation_key);

  const forecastRisk = (projectedThresholdDate) => risk({
    risk_category: "maintenance/operational",
    risk_type: "aviation_lease_utilization_review",
    deadline_information: null,
    utilisation_exposure: {
      metrics: [{
        unit: "flight_hours",
        contractualLimit: 300,
        recordedUtilisation: 250,
        headroom: 50,
        consumedPercent: 83.33,
        status: "approaching",
        reportingPeriod: { start: "2026-01-01", end: "2026-11-09" },
        sources: [{ evidenceId: EVIDENCE_ID }],
        forecast: {
          status: "forecast_available",
          averageDailyConsumption: 0.8,
          historicalTrend: "stable",
          projectedThresholdDate,
          remainingHeadroom: 50,
          observations: [{ start: "2026-10-01", end: "2026-11-09", cumulativeUtilisation: 250 }],
          deadlineComparison: null,
          sources: [{ evidenceId: EVIDENCE_ID }],
        },
      }],
    },
  });
  const [firstForecast] = deriveAviationLeaseRecommendations({
    scope: SCOPE,
    risks: [forecastRisk("2026-12-01")],
  });
  const [updatedForecast] = deriveAviationLeaseRecommendations({
    scope: SCOPE,
    risks: [forecastRisk("2026-12-15")],
  });
  assert.notEqual(firstForecast.recommendation_key, updatedForecast.recommendation_key);

  const [unrelatedFirst] = deriveAviationLeaseRecommendations({ scope: SCOPE, risks: [risk()] });
  const [unrelatedUpdated] = deriveAviationLeaseRecommendations({ scope: SCOPE, risks: [risk()] });
  assert.equal(unrelatedFirst.recommendation_key, unrelatedUpdated.recommendation_key);
});

test("a changed contractual financial estimate derives a new evidence-linked recommendation", () => {
  const financialRisk = (amount) => risk({
    risk_category: "maintenance/operational",
    risk_type: "aviation_lease_utilization_review",
    deadline_information: null,
    description: `Verified current utilization indicates a contractual excess-charge exposure of ${amount} USD.`,
    recommended_action: "Have operations, finance, and lease owners verify the calculated excess utilization before any charge is processed.",
    operational_evidence: [{
      evidenceId: EVIDENCE_ID,
      sourceLocator: "Utilization ledger",
      pageNumber: 3,
      excerpt: "Verified cumulative flight hours: 320.",
      confidence: 0.99,
      reviewStatus: "verified",
      relationship: "supports",
      periodStatus: "matches",
    }],
    utilisation_exposure: {
      metrics: [{
        unit: "flight_hours",
        contractualLimit: 300,
        recordedUtilisation: 320,
        headroom: -20,
        consumedPercent: 106.67,
        status: "exceeded",
        reportingPeriod: { start: "2026-01-01", end: "2026-11-09" },
        sources: [{ evidenceId: EVIDENCE_ID }],
        forecast: null,
        financialExposure: {
          status: "currently_demonstrated_exposure",
          contractualProvision: {
            rate: { amount: 500, currency: "USD", per: "flight_hours" },
            allowance: 300,
            measurementPeriod: "per lease year",
            cap: null,
            clauseId: CLAUSE_ID,
            contractVersionId: VERSION_ID,
            evidence: [{ evidenceId: EVIDENCE_ID }],
          },
          current: {
            status: "currently_demonstrated_exposure",
            amount,
            currency: "USD",
            excessUnits: 20,
            sources: [{ evidenceId: EVIDENCE_ID }],
          },
          projected: { status: "not_projected", amount: null, currency: "USD" },
        },
      }],
    },
  });
  const [first] = deriveAviationLeaseRecommendations({ scope: SCOPE, risks: [financialRisk(10_000)] });
  const [updated] = deriveAviationLeaseRecommendations({ scope: SCOPE, risks: [financialRisk(12_000)] });

  assert.notEqual(first.recommendation_key, updated.recommendation_key);
  assert.equal(first.owner_role, "AIRCRAFT_OPERATIONS");
  assert.match(first.business_rationale, /excess-charge exposure of 10000 USD/i);
  assert.match(first.business_rationale, /verified cumulative flight hours/i);
  assert.match(first.business_rationale, /not a contractual requirement or legal determination/i);
});

test("does not fabricate recommendations without source evidence and preserves superseded decision history", () => {
  const noEvidence = deriveAviationLeaseRecommendations({
    scope: SCOPE,
    risks: [risk({ contract_evidence: [], operational_evidence: [] })],
  });
  assert.deepEqual(noEvidence, []);
  assert.deepEqual(deriveAviationLeaseRecommendations({
    scope: SCOPE,
    risks: [risk({ contract_evidence: [{ evidenceId: EVIDENCE_ID, reviewStatus: "rejected" }] })],
  }), []);

  const resolved = deriveAviationLeaseRecommendations({
    scope: SCOPE,
    risks: [risk({ status: "resolved" })],
  });
  assert.deepEqual(resolved, []);

  const old = storedRecommendation();
  const [historical] = deriveAviationLeaseRecommendations({ scope: SCOPE, risks: [], storedRecommendations: [old] });
  assert.equal(historical.status, "superseded");
  assert.equal(historical.status_source, "derived");
  assert.match(historical.status_explanation, /current evidence-derived risk/i);
  assert.equal(historical.decision_history[0].status, "accepted");
  assert.equal(historical.decision_history[0].reviewer_user_id, REVIEWER_ID);

  const completed = storedRecommendation({
    decision_history: [{ ...old.decision_history[0], status: "completed" }],
  });
  const [completedHistory] = deriveAviationLeaseRecommendations({ scope: SCOPE, risks: [], storedRecommendations: [completed] });
  assert.equal(completedHistory.status, "completed");
});

test("decision validation requires an allowed status and a recorded human explanation", () => {
  assert.deepEqual(validateAviationLeaseRecommendationDecision({
    status: "accepted",
    explanation: "Reviewed the cited clause and assigned the renewal follow-up.",
  }), {
    status: "accepted",
    explanation: "Reviewed the cited clause and assigned the renewal follow-up.",
  });
  assert.throws(() => validateAviationLeaseRecommendationDecision({ status: "suggested", explanation: "No decision." }), {
    code: "RECOMMENDATION_STATUS_INVALID",
  });
  assert.throws(() => validateAviationLeaseRecommendationDecision({ status: "accepted", explanation: " " }), {
    code: "RECOMMENDATION_EXPLANATION_INVALID",
  });
  assert.throws(() => validateAviationLeaseRecommendationDecision({ status: "accepted", explanation: "x".repeat(2001) }), {
    code: "RECOMMENDATION_EXPLANATION_INVALID",
  });
});

test("service enforces the decision state machine and reviewer attribution", async () => {
  let recorded;
  const service = createAviationLeaseRecommendationService({
    repository: {
      async recordDecision(input) {
        recorded = input;
        return { id: RECOMMENDATION_ID };
      },
    },
  });
  const [candidate] = deriveAviationLeaseRecommendations({ scope: SCOPE, risks: [risk()] });
  await service.decide({
    recommendation: { ...candidate, status: "accepted" },
    reviewerUserId: REVIEWER_ID,
    input: { status: "completed", explanation: "Renewal review completed and recorded." },
  });
  assert.equal(recorded.reviewerUserId, REVIEWER_ID);
  assert.equal(recorded.status, "completed");

  await service.decide({
    recommendation: candidate,
    reviewerUserId: REVIEWER_ID,
    input: { status: "rejected", explanation: "Rejected after confirming the cited evidence does not support this follow-up." },
  });
  assert.equal(recorded.status, "rejected");

  await assert.rejects(service.decide({
    recommendation: candidate,
    reviewerUserId: REVIEWER_ID,
    input: { status: "completed", explanation: "Not approved first." },
  }), { code: "RECOMMENDATION_TRANSITION_INVALID" });

  await assert.rejects(service.decide({
    recommendation: { ...candidate, status: "accepted", status_source: "derived", id: RECOMMENDATION_ID },
    reviewerUserId: REVIEWER_ID,
    input: { status: "completed", explanation: "This stale recommendation should fail." },
  }), { code: "RECOMMENDATION_NOT_CURRENT" });
});

test("analysis-run recommendation integration only derives from completed, tenant-scoped lease data", async () => {
  let recommendationScope;
  const dependencies = {
    organizationId: ORGANIZATION_ID,
    analysisRunId: RUN_ID,
    analysisRunRepository: {
      async getById() {
        return {
          id: RUN_ID,
          organization_id: ORGANIZATION_ID,
          contract_id: CONTRACT_ID,
          document_version_id: VERSION_ID,
          status: "completed",
        };
      },
    },
    documentVersionResolver: async () => ({
      id: VERSION_ID,
      organization_id: ORGANIZATION_ID,
      document_id: DOCUMENT_ID,
    }),
    profileRepository: {
      async getByRun() {
        return { classification: { type: "AIRCRAFT_LEASE", status: "confirmed" } };
      },
    },
    riskRepository: {
      async listIntelligence(scope) {
        assert.deepEqual(scope, SCOPE);
        return {
          clauses: [{
            id: CLAUSE_ID,
            source_text: "Lessee shall maintain aircraft hull insurance and provide current certificates.",
            title: "Aircraft insurance",
            category: "insurance",
            evidence: [{
              evidence_id: EVIDENCE_ID,
              support_type: "supports",
              source: {
                source_locator: "Clause 12.4",
                excerpt: "Lessee shall maintain aircraft hull insurance.",
                confidence: 0.96,
                review_status: "verified",
              },
            }],
          }],
          obligations: [{
            id: OBLIGATION_ID,
            clause_id: CLAUSE_ID,
            obligation_type: "insurance",
            description: "Maintain aircraft hull insurance",
            action: "maintain",
            object: "aircraft hull insurance",
          }],
          deadlines: [],
        };
      },
    },
    fulfilmentRepository: {
      async listLatestForRun({ scope, obligationIds }) {
        assert.deepEqual(scope, SCOPE);
        assert.deepEqual(obligationIds, [OBLIGATION_ID]);
        return [];
      },
    },
    recommendationRepository: {
      async listByRun(scope) {
        recommendationScope = scope;
        return [];
      },
    },
  };
  const result = await readAnalysisRunAviationLeaseRiskAssessment(dependencies);
  assert.equal(result.applicable, true);
  assert.equal(result.risks.length, 1);
  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0].obligation_id, OBLIGATION_ID);
  assert.deepEqual(recommendationScope, SCOPE);

  await assert.rejects(readAnalysisRunAviationLeaseRiskAssessment({
    ...dependencies,
    analysisRunRepository: {
      async getById() {
        return {
          id: RUN_ID,
          organization_id: ORGANIZATION_ID,
          contract_id: CONTRACT_ID,
          document_version_id: VERSION_ID,
          status: "processing",
        };
      },
    },
    riskRepository: {
      async listIntelligence() { assert.fail("incomplete analyses cannot produce recommendations"); },
    },
  }), { code: "ANALYSIS_NOT_COMPLETED" });
});

test("recommendation repository lists only the fully scoped analysis run", async () => {
  let captured;
  const repository = createAviationLeaseRecommendationRepository({
    async query(sql, values) {
      captured = { sql, values };
      return { rows: [] };
    },
  });
  await repository.listByRun(SCOPE);
  assert.match(captured.sql, /r\.organization_id = \$1/);
  assert.match(captured.sql, /r\.contract_id = \$2/);
  assert.match(captured.sql, /r\.document_id = \$3/);
  assert.match(captured.sql, /r\.document_version_id = \$4/);
  assert.match(captured.sql, /r\.analysis_run_id = \$5/);
  assert.match(captured.sql, /recommendation_decision_history/);
  assert.match(captured.sql, /recommendation_evidence/);
  assert.deepEqual(captured.values, [
    ORGANIZATION_ID,
    CONTRACT_ID,
    DOCUMENT_ID,
    VERSION_ID,
    RUN_ID,
  ]);
});

test("decision write appends a recommendation and immutable history in one tenant-scoped transaction", async () => {
  const statements = [];
  const connection = {
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (/from obligations o/i.test(sql)) return { rows: [{ id: OBLIGATION_ID }] };
      if (/from intelligence_evidence/i.test(sql)) return { rows: [{ id: EVIDENCE_ID, confidence: 0.96 }] };
      if (/from recommendations/i.test(sql)) return { rows: [] };
      if (/insert into recommendations/i.test(sql)) return { rows: [{ id: RECOMMENDATION_ID }] };
      if (/from recommendation_decision_history/i.test(sql)) return { rows: [{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", sequence_number: 1, status: "suggested" }] };
      if (/insert into recommendation_decision_history/i.test(sql)) return {
        rows: [{
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          recommendation_id: RECOMMENDATION_ID,
          status: "accepted",
          reviewer_user_id: REVIEWER_ID,
          explanation: "The action was reviewed and accepted.",
          created_at: "2026-11-06T10:00:00.000Z",
        }],
      };
      return { rows: [] };
    },
    release() {
      statements.push({ sql: "RELEASE", values: [] });
    },
  };
  const repository = createAviationLeaseRecommendationRepository({
    async connect() { return connection; },
  });
  const [candidate] = deriveAviationLeaseRecommendations({ scope: SCOPE, risks: [risk()] });
  const result = await repository.recordDecision({
    recommendation: candidate,
    reviewerUserId: REVIEWER_ID,
    status: "accepted",
    explanation: "The action was reviewed and accepted.",
  });

  assert.equal(result.id, RECOMMENDATION_ID);
  assert.equal(result.decision.status, "accepted");
  assert.ok(statements.some((item) => item.sql === "BEGIN"));
  assert.ok(statements.some((item) => item.sql === "COMMIT"));
  assert.ok(statements.some((item) => /insert into recommendation_evidence/i.test(item.sql)));
  assert.equal(statements.filter((item) => /insert into recommendation_decision_history/i.test(item.sql)).length, 2);
  assert.ok(statements.every((item) => !/\b(update|delete)\s+(recommendations|recommendation_evidence|recommendation_decision_history)\b/i.test(item.sql)));
  const evidenceScope = statements.find((item) => /from intelligence_evidence/i.test(item.sql));
  assert.deepEqual(evidenceScope.values, [[EVIDENCE_ID], ORGANIZATION_ID, CONTRACT_ID]);
});

test("repeated identical decisions are idempotent and do not duplicate immutable history", async () => {
  const statements = [];
  const connection = {
    async query(sql) {
      statements.push(sql);
      if (/from obligations o/i.test(sql)) return { rows: [{ id: OBLIGATION_ID }] };
      if (/from intelligence_evidence/i.test(sql)) return { rows: [{ id: EVIDENCE_ID, confidence: 0.96 }] };
      if (/from recommendations/i.test(sql)) return {
        rows: [{
          id: RECOMMENDATION_ID,
          source_risk_key: "aviation-lease-obligation-66666666",
          obligation_id: OBLIGATION_ID,
          clause_id: CLAUSE_ID,
          action: "Obtain current insurance certificates and compare coverage and effective dates with the cited lease clause.",
          business_rationale: "existing identical candidate",
        }],
      };
      if (/from recommendation_decision_history/i.test(sql)) return {
        rows: [{ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", sequence_number: 2, status: "accepted" }],
      };
      return { rows: [] };
    },
    release() {},
  };
  const repository = createAviationLeaseRecommendationRepository({
    async connect() { return connection; },
  });
  const [candidate] = deriveAviationLeaseRecommendations({ scope: SCOPE, risks: [risk()] });
  candidate.business_rationale = "existing identical candidate";
  candidate.id = RECOMMENDATION_ID;
  candidate.status = "accepted";
  candidate.status_source = "recorded";
  const result = await repository.recordDecision({
    recommendation: candidate,
    reviewerUserId: REVIEWER_ID,
    status: "accepted",
    explanation: "Repeated network submission.",
  });
  assert.equal(result.decision.sequence_number, 2);
  assert.ok(statements.includes("COMMIT"));
  assert.equal(statements.filter((sql) => /insert into recommendation_decision_history/i.test(sql)).length, 0);
});

test("invalid or cross-tenant evidence fails closed and rolls back decision writes", async () => {
  const statements = [];
  const connection = {
    async query(sql) {
      statements.push(sql);
      if (/from obligations o/i.test(sql)) return { rows: [{ id: OBLIGATION_ID }] };
      if (/from intelligence_evidence/i.test(sql)) return { rows: [] };
      return { rows: [] };
    },
    release() {},
  };
  const repository = createAviationLeaseRecommendationRepository({
    async connect() { return connection; },
  });
  const [candidate] = deriveAviationLeaseRecommendations({ scope: SCOPE, risks: [risk()] });
  await assert.rejects(repository.recordDecision({
    recommendation: candidate,
    reviewerUserId: REVIEWER_ID,
    status: "accepted",
    explanation: "Reject evidence outside this tenant.",
  }), { code: "RECOMMENDATION_EVIDENCE_SCOPE_INVALID" });
  assert.ok(statements.includes("ROLLBACK"));
  assert.ok(!statements.some((sql) => /insert into recommendations/i.test(sql)));
});

test("migration, API, and Workspace preserve scoped human decision history without executing actions", async () => {
  const [migration, routes, panel] = await Promise.all([
    fs.readFile(new URL("../supabase/migrations/025_aviation_recommendation_decisions.sql", import.meta.url), "utf8"),
    fs.readFile(new URL("../routes/analysisRunRoutes.js", import.meta.url), "utf8"),
    fs.readFile(new URL("../frontend/src/components/intelligence/AviationLeaseRiskAssessment.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /recommendation_key/);
  assert.match(migration, /recommendation_decision_history/);
  assert.match(migration, /'suggested', 'under_review', 'accepted', 'rejected', 'completed', 'superseded'/);
  assert.match(migration, /sequence_number integer not null check \(sequence_number > 0\)/);
  assert.match(migration, /before update or delete on public\.recommendation_decision_history/i);
  assert.match(migration, /for select to authenticated\s+using \(public\.is_organization_member\(organization_id\)\)/i);
  assert.doesNotMatch(migration, /for (?:insert|update|delete) to authenticated/i);
  assert.match(routes, /router\.post\(\s*"\/:id\/aviation-lease-recommendations\/:recommendationKey\/decision",\s*requireOrganizationPermission\("contract:write"\)/);
  assert.match(panel, /Suggested action — not a contractual requirement/);
  assert.match(panel, /Start review/);
  assert.match(panel, /Accept/);
  assert.match(panel, /Reject/);
  assert.match(panel, /Mark completed/);
  assert.match(panel, /Recommendation history/);
  assert.match(panel, /role="alert"/);
});
