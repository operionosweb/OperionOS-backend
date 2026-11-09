import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createAviationOutcomeIntelligenceService,
  deriveAviationForecastBacktest,
} from "../services/phase3/intelligence/aviationOutcomeIntelligenceService.js";

const IDS = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  contractId: "22222222-2222-4222-8222-222222222222",
  documentVersionId: "33333333-3333-4333-8333-333333333333",
  analysisRunId: "44444444-4444-4444-8444-444444444444",
  clauseId: "55555555-5555-4555-8555-555555555555",
  obligationId: "66666666-6666-4666-8666-666666666666",
  reviewerId: "77777777-7777-4777-8777-777777777777",
  evidenceId: "88888888-8888-4888-8888-888888888888",
  secondEvidenceId: "99999999-9999-4999-8999-999999999999",
};

function makeAssessment(overrides = {}) {
  return {
    applicable: true,
    contractId: IDS.contractId,
    documentVersionId: IDS.documentVersionId,
    analysisRunId: IDS.analysisRunId,
    risks: [{
      clause_id: IDS.clauseId,
      obligation_id: IDS.obligationId,
      contract_evidence: [{
        evidenceId: "a1111111-1111-4111-8111-111111111111",
        reviewStatus: "verified",
        excerpt: "Aircraft registration G-OPER is subject to the utilization provisions.",
      }],
      utilisation_exposure: {
        metrics: [{
          unit: "flight_hours",
          forecast: {
            status: "forecast_available",
            contractualLimit: 5000,
            currentVerifiedUtilisation: 4300,
            remainingHeadroom: 700,
            averageDailyConsumption: 2,
            observations: [{ start: "2026-08-01", end: "2026-08-31", cumulativeUtilisation: 3900 }],
            evidenceCoverage: { observationCount: 3, coveredFrom: "2026-08-01", coveredThrough: "2026-10-31", reportingPeriodsContiguous: true },
            lastObservedDate: "2026-10-31",
            estimatedDaysToThreshold: 350,
            projectedThresholdDate: "2027-10-16",
            forecastAssumption: "Constant-rate estimate; not a guaranteed outcome.",
            sources: [{ evidenceId: IDS.evidenceId }, { evidenceId: IDS.secondEvidenceId }],
          },
        }],
      },
    }],
    ...overrides,
  };
}

function service({ assessment = makeAssessment(), savedOutcomes = [], savedSnapshots = [] } = {}) {
  const calls = { outcomes: [], snapshots: [] };
  const api = createAviationOutcomeIntelligenceService({
    assessmentReader: async (scope) => {
      assert.equal(scope.organizationId, IDS.organizationId);
      assert.equal(scope.analysisRunId, IDS.analysisRunId);
      return assessment;
    },
    repository: {
      async listOutcomes(scope) {
        assert.deepEqual(scope, {
          organizationId: IDS.organizationId,
          contractId: IDS.contractId,
          documentVersionId: IDS.documentVersionId,
          analysisRunId: IDS.analysisRunId,
        });
        return savedOutcomes;
      },
      async createOutcome(input) {
        calls.outcomes.push(input);
        return { id: "outcome-1", ...input };
      },
      async createForecastSnapshot(input) {
        calls.snapshots.push(input);
        return { id: `snapshot-${calls.snapshots.length}`, ...input };
      },
      async listForecastSnapshots(scope) {
        assert.deepEqual(scope, {
          organizationId: IDS.organizationId,
          contractId: IDS.contractId,
          documentVersionId: IDS.documentVersionId,
          analysisRunId: IDS.analysisRunId,
        });
        return savedSnapshots;
      },
    },
    clock: () => new Date("2026-11-09T12:00:00.000Z"),
  });
  return { api, calls };
}

const verifiedOutcome = (overrides = {}) => ({
  clauseId: IDS.clauseId,
  obligationId: IDS.obligationId,
  outcomeType: "flight_hours",
  classification: "verified_actual",
  value: 5100,
  unit: "flight_hours",
  measurementBasis: "cumulative_to_date",
  periodStart: "2027-02-01",
  periodEnd: "2027-02-28",
  methodology: "Reviewer-confirmed aircraft utilization report.",
  evidence: [{
    evidenceId: IDS.evidenceId,
    relationship: "supports",
    periodStatus: "matches",
  }],
  ...overrides,
});

function evaluationSnapshot(overrides = {}) {
  return {
    id: "snapshot-value-1",
    organization_id: IDS.organizationId,
    contract_id: IDS.contractId,
    document_version_id: IDS.documentVersionId,
    analysis_run_id: IDS.analysisRunId,
    clause_id: IDS.clauseId,
    obligation_id: IDS.obligationId,
    forecast_type: "operational_utilisation_threshold",
    metric: "flight_hours",
    unit: "flight_hours",
    contractual_limit: 5000,
    generated_at: "2026-11-09T12:00:00.000Z",
    last_observed_date: "2026-10-31",
    estimated_threshold_date: "2027-02-15",
    forecast_horizon_days: 107,
    methodology_version: "phase55-utilisation-v1",
    assumption: "Observed average calendar-day rate continues unchanged; estimate only.",
    inputs: {
      currentVerifiedUtilisation: 4300,
      averageDailyConsumption: 2,
      lastObservedDate: "2026-10-31",
    },
    evidence: [
      { evidenceId: IDS.evidenceId, documentVersionId: IDS.documentVersionId, analysisRunId: IDS.analysisRunId, reviewStatus: "verified" },
      { evidenceId: IDS.secondEvidenceId, documentVersionId: IDS.documentVersionId, analysisRunId: IDS.analysisRunId, reviewStatus: "verified" },
    ],
    ...overrides,
  };
}

function evaluationOutcome(overrides = {}) {
  return {
    id: "outcome-value-1",
    organization_id: IDS.organizationId,
    contract_id: IDS.contractId,
    document_version_id: IDS.documentVersionId,
    analysis_run_id: IDS.analysisRunId,
    clause_id: IDS.clauseId,
    obligation_id: IDS.obligationId,
    outcome_type: "flight_hours",
    classification: "verified_actual",
    value: 4480,
    unit: "flight_hours",
    measurement_basis: "cumulative_to_date",
    period_start: "2027-01-01",
    period_end: "2027-01-31",
    verified_at: "2027-02-02T10:00:00.000Z",
    created_at: "2027-02-02T10:00:00.000Z",
    evidence: [{ evidenceId: IDS.secondEvidenceId, reviewStatus: "verified", relationship: "supports", periodStatus: "matches" }],
    ...overrides,
  };
}

test("outcome recording binds reviewer, version, clause, and obligation to verified evidence", async () => {
  const { api, calls } = service();
  const outcome = await api.recordOutcome({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.analysisRunId,
    reviewerUserId: IDS.reviewerId,
    input: verifiedOutcome(),
  });

  assert.equal(outcome.classification, "verified_actual");
  assert.equal(outcome.organizationId, IDS.organizationId);
  assert.equal(outcome.documentVersionId, IDS.documentVersionId);
  assert.equal(outcome.clauseId, IDS.clauseId);
  assert.equal(outcome.obligationId, IDS.obligationId);
  assert.equal(outcome.verifiedAt, "2026-11-09T12:00:00.000Z");
  assert.match(outcome.dedupeKey, /^[0-9a-f]{64}$/);
  assert.equal(calls.outcomes.length, 1);
});

test("unverified classifications remain explicit and are never promoted to ground truth", async () => {
  const { api } = service({ savedOutcomes: [{
    id: "outcome-2",
    classification: "estimated",
    value: 100,
  }] });
  const result = await api.list({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.analysisRunId,
  });
  assert.equal(result.outcomeHistoryStatus, "not_assessed");
  assert.equal(result.outcomes[0].classification, "estimated");
  assert.match(result.message, /only verified actuals/i);
});

test("missing outcome history is not reported as proof that no outcome occurred", async () => {
  const { api } = service();
  const result = await api.list({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.analysisRunId,
  });
  assert.equal(result.outcomeHistoryStatus, "not_assessed");
  assert.match(result.message, /does not establish that no contractual outcome occurred/i);
});

test("verified actual outcomes fail closed without period-matched supporting evidence", async () => {
  const { api, calls } = service();
  await assert.rejects(api.recordOutcome({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.analysisRunId,
    reviewerUserId: IDS.reviewerId,
    input: verifiedOutcome({
      evidence: [{
        evidenceId: IDS.evidenceId,
        relationship: "supports",
        periodStatus: "not_assessed",
      }],
    }),
  }), { code: "AVIATION_OUTCOME_VERIFICATION_UNSUPPORTED" });
  assert.equal(calls.outcomes.length, 0);
});

test("invalid periods, negative utilization, and currency/unit mismatch are rejected", async () => {
  const { api } = service();
  for (const input of [
    verifiedOutcome({ periodStart: "2027-02-30" }),
    verifiedOutcome({ value: -1 }),
    verifiedOutcome({ value: null }),
    verifiedOutcome({ outcomeType: "charge", classification: "partially_verified", value: 12, unit: "USD", currency: "EUR", measurementBasis: "reporting_period_total" }),
  ]) {
    await assert.rejects(api.recordOutcome({
      organizationId: IDS.organizationId,
      analysisRunId: IDS.analysisRunId,
      reviewerUserId: IDS.reviewerId,
      input,
    }));
  }
});

test("asset identifiers must be supported by verified contract evidence", async () => {
  const { api } = service();
  await assert.rejects(api.recordOutcome({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.analysisRunId,
    reviewerUserId: IDS.reviewerId,
    input: verifiedOutcome({ assetIdentifier: "N-UNSUPPORTED" }),
  }), { code: "AVIATION_OUTCOME_ASSET_UNSUPPORTED" });
});

test("forecast snapshots preserve only currently eligible deterministic Phase 55 estimates", async () => {
  const { api, calls } = service();
  const result = await api.snapshotForecast({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.analysisRunId,
    reviewerUserId: IDS.reviewerId,
    metric: "flight_hours",
  });
  assert.equal(result.methodologyVersion, "phase55-utilisation-v1");
  assert.equal(calls.snapshots.length, 1);
  assert.equal(calls.snapshots[0].estimatedThresholdDate, "2027-10-16");
  assert.equal(calls.snapshots[0].generatedAt, "2026-11-09T12:00:00.000Z");
  assert.equal(calls.snapshots[0].evidenceIds.length, 2);
  assert.match(calls.snapshots[0].assumption, /Constant-rate/);
});

test("snapshot cannot be created when the original deterministic forecast is unavailable", async () => {
  const assessment = makeAssessment();
  assessment.risks[0].utilisation_exposure.metrics[0].forecast.status = "insufficient_history";
  const { api, calls } = service({ assessment });
  await assert.rejects(api.snapshotForecast({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.analysisRunId,
    reviewerUserId: IDS.reviewerId,
    metric: "flight_hours",
  }), { code: "AVIATION_FORECAST_NOT_ELIGIBLE" });
  assert.equal(calls.snapshots.length, 0);
});

test("backtest evaluates later verified threshold evidence as an interval, without hindsight", () => {
  const snapshot = {
    id: "snapshot-1",
    organization_id: IDS.organizationId,
    contract_id: IDS.contractId,
    document_version_id: IDS.documentVersionId,
    analysis_run_id: IDS.analysisRunId,
    clause_id: IDS.clauseId,
    obligation_id: IDS.obligationId,
    forecast_type: "operational_utilisation_threshold",
    metric: "flight_hours",
    unit: "flight_hours",
    contractual_limit: 5000,
    generated_at: "2026-11-09T12:00:00.000Z",
    estimated_threshold_date: "2027-02-15",
    forecast_horizon_days: 98,
  };
  const outcomes = [
    {
      id: "before-forecast",
      ...snapshot,
      classification: "verified_actual",
      outcome_type: "flight_hours",
      measurement_basis: "cumulative_to_date",
      value: 5100,
      period_start: "2026-10-01",
      period_end: "2026-10-31",
      verified_at: "2026-11-01T10:00:00.000Z",
      evidence: [{ reviewStatus: "verified", relationship: "supports", periodStatus: "matches" }],
    },
    {
      id: "below-limit",
      ...snapshot,
      classification: "verified_actual",
      outcome_type: "flight_hours",
      measurement_basis: "cumulative_to_date",
      value: 4800,
      period_start: "2027-01-01",
      period_end: "2027-01-31",
      verified_at: "2027-02-02T10:00:00.000Z",
      evidence: [{ reviewStatus: "verified", relationship: "supports", periodStatus: "matches" }],
    },
    {
      id: "crossing",
      ...snapshot,
      classification: "verified_actual",
      outcome_type: "flight_hours",
      measurement_basis: "cumulative_to_date",
      value: 5100,
      period_start: "2027-02-01",
      period_end: "2027-02-28",
      verified_at: "2027-03-02T10:00:00.000Z",
      evidence: [{ reviewStatus: "verified", relationship: "supports", periodStatus: "matches" }],
    },
  ];
  const result = deriveAviationForecastBacktest({ snapshots: [snapshot], outcomes });
  assert.equal(result.status, "descriptive_backtest");
  assert.equal(result.eligibleForecastCount, 1);
  assert.equal(result.verifiedThresholdOutcomes, 1);
  assert.deepEqual(result.evaluations[0].observedThresholdWindow, { start: "2027-01-31", end: "2027-02-28" });
  assert.equal(result.evaluations[0].signedErrorDays, 0);
  assert.equal(result.metrics.maeDaysToObservedWindow, 0);
  assert.match(result.limitations[1], /interval-censored/i);
});

test("backtest excludes a formerly verified outcome after its source evidence is rejected", () => {
  const snapshot = {
    id: "snapshot-evidence-status",
    organization_id: IDS.organizationId,
    contract_id: IDS.contractId,
    document_version_id: IDS.documentVersionId,
    analysis_run_id: IDS.analysisRunId,
    clause_id: IDS.clauseId,
    obligation_id: IDS.obligationId,
    forecast_type: "operational_utilisation_threshold",
    metric: "flight_hours",
    unit: "flight_hours",
    contractual_limit: 5000,
    generated_at: "2026-11-09T12:00:00.000Z",
    estimated_threshold_date: "2027-02-15",
    forecast_horizon_days: 98,
  };
  const result = deriveAviationForecastBacktest({
    snapshots: [snapshot],
    outcomes: [{
      ...snapshot,
      classification: "verified_actual",
      outcome_type: "flight_hours",
      measurement_basis: "cumulative_to_date",
      value: 5100,
      period_start: "2027-02-01",
      period_end: "2027-02-28",
      verified_at: "2027-03-02T10:00:00.000Z",
      evidence: [{ reviewStatus: "rejected", relationship: "supports", periodStatus: "matches" }],
    }],
  });
  assert.equal(result.status, "not_available");
  assert.equal(result.excludedReasons.no_subsequent_verified_outcome, 1);
});

test("superseded, unverified, wrong-version and non-crossing outcomes cannot be backtest ground truth", () => {
  const snapshot = {
    id: "snapshot-2",
    organization_id: IDS.organizationId,
    contract_id: IDS.contractId,
    document_version_id: IDS.documentVersionId,
    analysis_run_id: IDS.analysisRunId,
    clause_id: IDS.clauseId,
    obligation_id: IDS.obligationId,
    forecast_type: "operational_utilisation_threshold",
    metric: "flight_cycles",
    unit: "flight_cycles",
    contractual_limit: 1000,
    generated_at: "2026-11-09T12:00:00.000Z",
    estimated_threshold_date: "2027-03-01",
    forecast_horizon_days: 112,
  };
  const result = deriveAviationForecastBacktest({
    snapshots: [snapshot],
    outcomes: [{
      classification: "verified_actual",
      outcome_type: "flight_cycles",
      measurement_basis: "cumulative_to_date",
      unit: "flight_cycles",
      organization_id: IDS.organizationId,
      contract_id: IDS.contractId,
      document_version_id: IDS.documentVersionId,
      analysis_run_id: IDS.analysisRunId,
      obligation_id: IDS.obligationId,
      clause_id: IDS.clauseId,
      value: 900,
      period_start: "2027-01-01",
      period_end: "2027-01-31",
      verified_at: "2027-02-02T10:00:00.000Z",
      created_at: "2027-02-02T10:00:00.000Z",
      evidence: [{ reviewStatus: "verified", relationship: "supports", periodStatus: "matches" }],
      evidence: [{ reviewStatus: "verified", relationship: "supports", periodStatus: "matches" }],
    }],
  });
  assert.equal(result.status, "not_available");
  assert.equal(result.verifiedThresholdOutcomes, 0);
  assert.equal(result.excludedReasons.threshold_not_observed, 1);
  assert.equal(result.metrics, null);
});

test("value evaluation compares a preserved deterministic projection with a subsequent verified cumulative outcome", () => {
  const snapshot = evaluationSnapshot();
  const result = deriveAviationForecastBacktest({
    snapshots: [snapshot],
    outcomes: [evaluationOutcome()],
  }).utilisationValueEvaluation;
  assert.equal(result.status, "descriptive_projection_evaluation");
  assert.equal(result.eligibleObservationCount, 1);
  assert.equal(result.sampleSizeStatus, "insufficient_sample_size");
  assert.equal(result.metrics.meanAbsoluteError, 4);
  assert.equal(result.metrics.meanSignedError, 4);
  assert.equal(result.metrics.meanAbsolutePercentageError, 0.09);
  assert.equal(result.metrics.overestimationCount, 1);
  assert.equal(result.metrics.underestimationCount, 0);
  assert.equal(result.evaluations[0].projectedCumulativeValue, 4484);
  assert.equal(result.evaluations[0].actualCumulativeValue, 4480);
  assert.deepEqual(result.evaluations[0].forecastEvidenceIds, [IDS.evidenceId, IDS.secondEvidenceId]);
  assert.deepEqual(result.evaluations[0].outcomeEvidenceIds, [IDS.secondEvidenceId]);
});

test("backtest response timestamps the derived evaluation without persisting a mutable assessment", async () => {
  const { api } = service({
    savedSnapshots: [evaluationSnapshot()],
    savedOutcomes: [evaluationOutcome()],
  });
  const result = await api.backtest({
    organizationId: IDS.organizationId,
    analysisRunId: IDS.analysisRunId,
  });
  assert.equal(result.evaluatedAt, "2026-11-09T12:00:00.000Z");
  assert.equal(result.utilisationValueEvaluation.evaluatedAt, result.evaluatedAt);
  assert.equal(result.utilisationValueEvaluation.evaluations[0].evaluatedAt, result.evaluatedAt);
});

test("flight-hour and flight-cycle evaluation metrics remain separate and incomparable", () => {
  const cyclesSnapshot = evaluationSnapshot({
    id: "snapshot-cycles",
    metric: "flight_cycles",
    unit: "flight_cycles",
    contractual_limit: 1000,
    estimated_threshold_date: "2027-05-19",
    inputs: {
      currentVerifiedUtilisation: 800,
      averageDailyConsumption: 1,
      lastObservedDate: "2026-10-31",
    },
  });
  const cyclesOutcome = evaluationOutcome({
    id: "outcome-cycles",
    outcome_type: "flight_cycles",
    unit: "flight_cycles",
    value: 892,
  });
  const result = deriveAviationForecastBacktest({
    snapshots: [evaluationSnapshot(), cyclesSnapshot],
    outcomes: [evaluationOutcome(), cyclesOutcome],
  }).utilisationValueEvaluation;
  assert.equal(result.eligibleObservationCount, 2);
  assert.equal(result.metrics, null);
  assert.deepEqual(Object.keys(result.metricsByMetric).sort(), ["flight_cycles", "flight_hours"]);
  assert.equal(result.metricsByMetric.flight_hours.meanAbsoluteError, 4);
  assert.equal(result.metricsByMetric.flight_cycles.meanAbsoluteError, 0);
});

test("value evaluation excludes incomparable units, periods, methodologies, scopes, financial outcomes and unverified evidence", () => {
  const validSnapshot = evaluationSnapshot();
  const cases = [
    { name: "methodology", snapshot: evaluationSnapshot({ methodology_version: "phase67-calendar-year-run-rate-v1" }), outcome: evaluationOutcome(), reason: "unsupported_methodology_version" },
    { name: "stale forecast evidence", snapshot: evaluationSnapshot({ evidence: [{ evidenceId: IDS.evidenceId, documentVersionId: IDS.documentVersionId, analysisRunId: IDS.analysisRunId, reviewStatus: "stale" }] }), outcome: evaluationOutcome(), reason: "invalid_forecast_evidence" },
    { name: "wrong forecast evidence version", snapshot: evaluationSnapshot({ evidence: [{ evidenceId: IDS.evidenceId, documentVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", analysisRunId: IDS.analysisRunId, reviewStatus: "verified" }] }), outcome: evaluationOutcome(), reason: "invalid_forecast_evidence" },
    { name: "unit", snapshot: validSnapshot, outcome: evaluationOutcome({ unit: "flight_cycles" }), reason: "incompatible_unit" },
    { name: "basis", snapshot: validSnapshot, outcome: evaluationOutcome({ measurement_basis: "reporting_period_total" }), reason: "incompatible_measurement_basis" },
    { name: "period overlap", snapshot: validSnapshot, outcome: evaluationOutcome({ period_start: "2026-10-15", period_end: "2026-11-15" }), reason: "incompatible_observation_period" },
    { name: "outside horizon", snapshot: validSnapshot, outcome: evaluationOutcome({ period_start: "2027-02-20", period_end: "2027-02-28" }), reason: "outside_projection_horizon" },
    { name: "wrong organization", snapshot: validSnapshot, outcome: evaluationOutcome({ organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }), reason: "no_subsequent_verified_outcome" },
    { name: "wrong version", snapshot: validSnapshot, outcome: evaluationOutcome({ document_version_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }), reason: "no_subsequent_verified_outcome" },
    { name: "FX outcome", snapshot: validSnapshot, outcome: evaluationOutcome({ outcome_type: "fx_adjustment" }), reason: "no_subsequent_verified_outcome" },
    { name: "rejected evidence", snapshot: validSnapshot, outcome: evaluationOutcome({ evidence: [{ reviewStatus: "rejected", relationship: "supports", periodStatus: "matches" }] }), reason: "no_subsequent_verified_outcome" },
    { name: "stale outcome evidence", snapshot: validSnapshot, outcome: evaluationOutcome({ evidence: [{ reviewStatus: "stale", relationship: "supports", periodStatus: "matches" }] }), reason: "no_subsequent_verified_outcome" },
    { name: "mismatched outcome evidence period", snapshot: validSnapshot, outcome: evaluationOutcome({ evidence: [{ reviewStatus: "verified", relationship: "supports", periodStatus: "mismatches" }] }), reason: "no_subsequent_verified_outcome" },
    { name: "superseded correction", snapshot: validSnapshot, outcome: evaluationOutcome({ is_superseded: true }), reason: "no_subsequent_verified_outcome" },
  ];
  for (const item of cases) {
    const evaluation = deriveAviationForecastBacktest({
      snapshots: [item.snapshot],
      outcomes: [item.outcome],
    }).utilisationValueEvaluation;
    assert.equal(evaluation.eligibleObservationCount, 0, item.name);
    assert.equal(evaluation.excludedReasons[item.reason], 1, item.name);
    assert.equal(evaluation.metrics, null, item.name);
  }
  const noSnapshots = deriveAviationForecastBacktest({ snapshots: [], outcomes: [evaluationOutcome()] }).utilisationValueEvaluation;
  assert.equal(noSnapshots.status, "not_available");
  assert.equal(noSnapshots.eligibleForecastCount, 0);
});

test("value evaluation omits percentage errors for zero and sub-unit actuals", () => {
  const snapshot = evaluationSnapshot({
    contractual_limit: 10,
    estimated_threshold_date: "2027-02-08",
    inputs: {
      currentVerifiedUtilisation: 0,
      averageDailyConsumption: 0.1,
      lastObservedDate: "2026-10-31",
    },
  });
  for (const value of [0, 0.5]) {
    const evaluation = deriveAviationForecastBacktest({
      snapshots: [snapshot],
      outcomes: [evaluationOutcome({
        value,
        period_start: "2026-11-10",
        period_end: "2026-11-20",
      })],
    }).utilisationValueEvaluation;
    assert.equal(evaluation.eligibleObservationCount, 1);
    assert.equal(evaluation.evaluations[0].percentageError, null);
    assert.equal(evaluation.evaluations[0].percentageErrorEligible, false);
    assert.equal(evaluation.metrics.meanAbsolutePercentageError, null);
    assert.equal(evaluation.metrics.percentageErrorObservationCount, 0);
  }
});

test("value evaluation fails closed for invalid snapshot inputs and cumulative values below the baseline", () => {
  const invalidSnapshot = evaluationSnapshot({
    inputs: {
      currentVerifiedUtilisation: 4300,
      averageDailyConsumption: 0,
      lastObservedDate: "2026-10-31",
    },
  });
  const invalidInputEvaluation = deriveAviationForecastBacktest({
    snapshots: [invalidSnapshot],
    outcomes: [evaluationOutcome()],
  }).utilisationValueEvaluation;
  assert.equal(invalidInputEvaluation.excludedReasons.invalid_forecast_inputs, 1);
  const decreasedEvaluation = deriveAviationForecastBacktest({
    snapshots: [evaluationSnapshot()],
    outcomes: [evaluationOutcome({ value: 4299 })],
  }).utilisationValueEvaluation;
  assert.equal(decreasedEvaluation.excludedReasons.invalid_actual_observation, 1);
});

test("migration enforces tenant scope, evidence-backed actuals, and immutable history", async () => {
  const migration = await readFile(new URL("../supabase/migrations/028_aviation_outcomes_and_forecast_history.sql", import.meta.url), "utf8");
  assert.match(migration, /foreign key \(obligation_id, organization_id, contract_id, document_version_id, analysis_run_id, clause_id\)/);
  assert.match(migration, /classification = 'verified_actual'/);
  assert.match(migration, /e\.review_status = 'verified'/);
  assert.match(migration, /deferrable initially deferred/i);
  assert.match(migration, /before update or delete on public\.aviation_contract_outcomes/i);
  assert.match(migration, /using \(public\.is_organization_member\(organization_id\)\)/);
  assert.match(migration, /revoke all on public\.aviation_contract_outcomes/i);
});
