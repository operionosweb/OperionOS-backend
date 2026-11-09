import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { deriveAviationPredictiveContractRisk } from "../services/phase3/intelligence/aviationPredictiveContractRiskService.js";

const fixture = JSON.parse(await readFile(
  new URL("./fixtures/aviation-acceptance/phase59-predictive-contract-risk.json", import.meta.url),
  "utf8",
));
const LEASE_ID = "22222222-2222-4222-8222-222222222201";
const LEASE_RUN_ID = "55555555-5555-4555-8555-555555552201";
const LEASE_VERSION_ID = "44444444-4444-4444-8444-444444442201";
const FINANCING_ID = "22222222-2222-4222-8222-222222222203";

function derive(overrides = {}) {
  return deriveAviationPredictiveContractRisk({
    organizationId: fixture.organizationId,
    portfolio: fixture.portfolio,
    externalRisk: fixture.externalRisk,
    asOf: fixture.asOf,
    ...overrides,
  });
}

function contract(result, id) {
  return result.contracts.find((item) => item.contractId === id);
}

test("correlates fuel, foreign-currency, and utilization components without adding them", () => {
  const result = derive();
  const lease = contract(result, LEASE_ID);
  const fuel = lease.components.find((item) => item.factor === "fuel");
  const fx = lease.components.find((item) => item.factor === "fx");
  const utilization = lease.components.find((item) => item.kind === "operational_utilisation");

  assert.deepEqual(new Set(lease.factors), new Set(["fuel", "fx", "utilisation"]));
  assert.equal(lease.components.length, 3);
  assert.equal(fuel.observation.value, 2.45);
  assert.equal(fx.contractualPayment.amount, 1_250_000);
  assert.equal(utilization.current.recordedUtilisation, 420);
  assert.equal(utilization.current.headroom, 80);
  assert.equal(utilization.forecast.estimatedThresholdDate, "2026-12-01");
  assert.equal(utilization.financialExposure.projected.amount, 2_500);
  assert.equal(utilization.financialExposure.current, null);
  assert.equal(fuel.calculation.status, "not_calculated");
  assert.equal(fx.calculation.status, "not_calculated");
  assert.equal(lease.interactions.at(-1).classification, "unknown");
  assert.match(lease.interactions.at(-1).reason, /No cross-component sum/);
  assert.equal(lease.recommendation.clauses.length, 3);
  assert.ok(lease.recommendation.observations.length >= 2);
  assert.equal(result.sensitivity.status, "not_calculated");
});

test("carries explicit fuel-clause calculations into predictive risk without cross-category aggregation", () => {
  const externalRisk = structuredClone(fixture.externalRisk);
  const fuelAssessment = externalRisk.contractualAssessments.find((item) => item.id === "ext-fuel-mro");
  fuelAssessment.observation.id = "ev-fuel-observation";
  fuelAssessment.obligationId = "synthetic-fuel-adjustment-obligation";
  fuelAssessment.obligationDescription = "Review and pay the weekly fuel adjustment";
  fuelAssessment.obligationReviewStatus = "verified";
  fuelAssessment.obligationEvidence = {
    evidenceId: "ev-fuel-obligation",
    sourceLocator: "MRO clause 2 obligation",
    excerpt: "The Lessee shall pay the stated weekly adjustment.",
    reviewStatus: "verified",
  };
  fuelAssessment.fuelExposure = {
    status: "calculated",
    exposureClassification: "direct_contractual_adjustment",
    calculation: {
      status: "calculated",
      methodology: "phase72-explicit-weekly-fuel-adjustment-v1",
      formula: "max(0, 2.45 − 2.00) × 20,000 gallons/week × 80%",
      baselinePrice: { amount: 2, unit: "USD per gallon" },
      currentPrice: {
        amount: 2.45,
        unit: "USD per gallon",
        observationDate: "2026-11-06",
        evidenceId: "ev-fuel-observation",
      },
      volume: { amount: 20000, unit: "gallons per week" },
      passThroughPercent: 80,
      amount: { value: 7200, currency: "USD", period: "week" },
      payingParty: "lessee_or_airline",
    },
    missingInputs: [],
    explanation: "Synthetic test: the clause-derived weekly adjustment is USD 7,200.",
    recommendation: {
      action: "Reconcile the cited clause and matching benchmark period to the supplier invoice.",
      supportingEvidenceIds: ["ev-fuel-clause-mro", "ev-fuel-observation"],
      expectedCommercialBenefit: "Clarifies the period-specific pass-through.",
      limitations: ["Not an invoice or net exposure."],
    },
  };
  fuelAssessment.calculation = {
    status: "calculated",
    amount: { value: 7200, currency: "USD" },
    reason: fuelAssessment.fuelExposure.explanation,
    missingInputs: [],
  };

  const result = derive({ externalRisk });
  const mroContract = contract(result, "22222222-2222-4222-8222-222222222202");
  const fuel = mroContract.components.find((item) => item.factor === "fuel");
  const exposure = fuel.exposureAssessment;
  const warning = result.earlyWarnings.find((item) => item.category === "fuel_price_adjustment");

  assert.equal(fuel.fuelExposure.status, "calculated");
  assert.equal(fuel.financialExposure, null);
  assert.equal(exposure.result.financial[0].amount, 7200);
  assert.equal(exposure.result.financial[0].currency, "USD");
  assert.equal(exposure.result.financial[0].period, "week");
  assert.equal(exposure.methodology.id, "phase72-explicit-weekly-fuel-adjustment-v1");
  assert.equal(exposure.severity.level, "not_scored");
  assert.equal(mroContract.exposureAggregation.status, "not_aggregated");
  assert.equal(warning.category, "fuel_price_adjustment");
  assert.equal(warning.result.financialAdjustment.amount, 7200);
  assert.ok(warning.recommendation.supportingEvidence.some((item) => item.evidenceId === "ev-fuel-observation"));
});

test("attaches independent contract-version-scoped assessments without mutating or double-counting evidence", () => {
  const original = structuredClone(fixture);
  const metric = structuredClone(fixture.portfolio.utilisationExposures[0]);
  const result = derive({
    leaseAssessment: {
      organizationId: fixture.organizationId,
      contractId: LEASE_ID,
      analysisRunId: LEASE_RUN_ID,
      documentVersionId: LEASE_VERSION_ID,
      risks: [{
        contract_id: LEASE_ID,
        clause_id: metric.clauseId,
        contract_evidence: metric.contractEvidence,
        utilisation_exposure: { metrics: [metric] },
      }],
    },
  });
  const lease = contract(result, LEASE_ID);
  const utilization = lease.components.find((item) => item.kind === "operational_utilisation");
  const fx = lease.components.find((item) => item.factor === "fx");

  assert.equal(lease.components.length, 3);
  assert.equal(lease.exposureAssessmentCount, 3);
  assert.equal(utilization.exposureAssessment.category, "aircraft_lease_maximum_utilisation");
  assert.equal(utilization.exposureAssessment.contract.organizationId, fixture.organizationId);
  assert.equal(utilization.exposureAssessment.contract.documentVersionId, LEASE_VERSION_ID);
  assert.equal(utilization.exposureAssessment.clause.clauseId, metric.clauseId);
  assert.equal(utilization.exposureAssessment.evidence.contractual[0].evidenceId, "ev-clause-util-n101");
  assert.equal(utilization.exposureAssessment.evidence.operational[0].evidenceId, "ev-usage-n101");
  assert.equal(utilization.exposureAssessment.dataFreshness.status, "current");
  assert.equal(utilization.exposureAssessment.dataFreshness.latestObservationDate, "2026-11-09");
  assert.equal(utilization.exposureAssessment.methodology.version, "phase67-calendar-year-run-rate-v1");
  assert.ok(utilization.exposureAssessment.recommendation.expectedBenefit);
  assert.equal(utilization.exposureAssessment.recommendation.actionState, "recommendation_only");
  assert.equal(utilization.exposureAssessment.recommendation.humanApprovalRequired, true);
  assert.equal(utilization.exposureAssessment.recommendation.performedAt, null);
  assert.equal(fx.exposureAssessment.category, "fx_reference_sensitivity");
  assert.equal(fx.exposureAssessment.contract.documentVersionId, LEASE_VERSION_ID);
  assert.equal(fx.exposureAssessment.dataFreshness.status, "current");
  assert.equal(fx.exposureAssessment.methodology.version, "phase58-contractual-reference-assessment-v1");
  assert.equal(fx.exposureAssessment.recommendation.actionState, "recommendation_only");
  assert.equal(new Set(lease.components.map((item) => item.exposureAssessment.id)).size, 3);
  assert.equal(lease.components.some((item) => item.combinedAmount !== undefined), false);
  assert.deepEqual(fixture, original);

  const stalePortfolio = structuredClone(fixture.portfolio);
  stalePortfolio.utilisationExposures[0].documentVersionId = "44444444-4444-4444-8444-000000000000";
  const staleResult = derive({ portfolio: stalePortfolio });
  assert.equal(
    contract(staleResult, LEASE_ID).components.some((item) => item.kind === "operational_utilisation"),
    false,
  );
});

test("standardized assessments surface operational staleness and retain recommendation-only decision state", () => {
  const metric = structuredClone(fixture.portfolio.utilisationExposures[0]);
  metric.reportingPeriod = { start: "2026-10-01", end: "2026-10-31" };
  const result = derive({
    asOf: "2026-12-10",
    leaseAssessment: {
      organizationId: fixture.organizationId,
      contractId: LEASE_ID,
      analysisRunId: LEASE_RUN_ID,
      documentVersionId: LEASE_VERSION_ID,
      risks: [{
        contract_id: LEASE_ID,
        clause_id: metric.clauseId,
        contract_evidence: metric.contractEvidence,
        utilisation_exposure: { metrics: [metric] },
      }],
    },
  });
  const lease = contract(result, LEASE_ID);
  const utilization = lease.components.find((item) => item.kind === "operational_utilisation");
  const fx = lease.components.find((item) => item.factor === "fx");
  assert.equal(utilization.exposureAssessment.dataFreshness.status, "stale");
  assert.equal(utilization.exposureAssessment.dataFreshness.ageDays, 31);
  assert.equal(fx.exposureAssessment.dataFreshness.status, "current");
  assert.ok(utilization.exposureAssessment.recommendation.expectedBenefit);
  assert.equal(utilization.exposureAssessment.recommendation.humanApprovalRequired, true);
  assert.equal(utilization.exposureAssessment.recommendation.performedAt, null);
});

test("keeps an incomplete minimum period as an observed reading, not a shortfall or projection", () => {
  const metric = {
    ...structuredClone(fixture.portfolio.utilisationExposures[0]),
    direction: "minimum",
    contractualLimit: null,
    contractualMinimum: 600,
    status: "minimum_period_incomplete",
    headroom: null,
    remainingRequirement: null,
    consumedPercent: null,
    forecast: {
      status: "minimum_requirement_forecast_not_supported",
      sources: [],
    },
    financialExposure: {
      status: "not_calculated",
      reason: "No applicable shortfall formula is established.",
      current: null,
      projected: null,
      limitations: [],
    },
  };
  const result = derive({
    portfolio: {
      ...fixture.portfolio,
      utilisationExposures: [metric],
    },
  });
  const component = contract(result, LEASE_ID).components.find((item) => item.kind === "operational_utilisation");

  assert.equal(component.direction, "minimum");
  assert.equal(component.financialExposure.current, null);
  assert.equal(component.financialExposure.projected, null);
  assert.equal(component.current.recordedUtilisation, 420);
  assert.equal(component.current.status, "minimum_period_incomplete");
  assert.equal(component.current.remainingRequirement, null);
  assert.equal(component.forecast, null);
  assert.equal(component.exposureAssessment.category, "aircraft_lease_minimum_utilisation");
  assert.equal(component.exposureAssessment.result.operational.remainingRequirement, null);
  assert.equal(
    component.exposureAssessment.result.projection.annualizedUtilisation.status,
    "insufficient_evidence",
  );
  assert.equal(component.exposureAssessment.result.financial[0].status, "not_calculated");
  assert.equal(component.exposureAssessment.result.financial[0].amount, null);
});

test("correlates foreign-currency and floating-rate clauses for the same financing contract", () => {
  const financing = contract(derive(), FINANCING_ID);
  assert.deepEqual(new Set(financing.factors), new Set(["fx", "interest"]));
  assert.equal(financing.components.find((item) => item.factor === "fx").contractualPayment.currency, "USD");
  assert.equal(financing.components.find((item) => item.factor === "interest").benchmark, "SOFR");
  assert.ok(financing.components.every((item) => item.financialExposure === null));
  assert.match(financing.recommendation.uncertainty, /No combined impact/);
});

test("carries a verified financing run-rate into a distinct predictive assessment without adding FX exposure", () => {
  const externalRisk = structuredClone(fixture.externalRisk);
  const interest = externalRisk.contractualAssessments.find((item) => item.id === "ext-interest-financing");
  interest.financingExposure = {
    status: "calculated",
    exposureClassification: "floating_rate",
    explanation: "Verified SOFR clause and principal support a simple annualized run-rate.",
    calculation: {
      status: "calculated",
      methodology: "phase73-simple-annualized-financing-run-rate-v1",
      principal: { amount: 10_000_000, currency: "USD", evidenceId: "ev-financing-clause" },
      spreadBasisPoints: 250,
      annualizedInterestExpense: { amount: 642_000, currency: "USD", period: "year" },
    },
    missingInputs: [],
    recommendation: {
      issue: "Floating-rate exposure",
      action: "Review repricing and rate protection.",
      expectedCommercialBenefit: "Clarifies financing terms.",
      supportingEvidenceIds: ["ev-financing-clause", "ev-sofr-observation"],
      limitations: ["Not payable interest or hedge-adjusted exposure."],
    },
  };
  interest.calculation = {
    status: "calculated",
    amount: { value: 642_000, currency: "USD", period: "year" },
    reason: interest.financingExposure.explanation,
    missingInputs: [],
  };

  const result = derive({ externalRisk });
  const financing = contract(result, FINANCING_ID);
  const interestComponent = financing.components.find((item) => item.factor === "interest");
  const exposure = interestComponent.exposureAssessment;

  assert.equal(interestComponent.financingExposure.status, "calculated");
  assert.equal(exposure.category, "interest_external_risk_sensitivity");
  assert.equal(exposure.result.financial[0].kind, "annualized_interest_run_rate");
  assert.equal(exposure.result.financial[0].amount, 642_000);
  assert.equal(exposure.result.financial[0].currency, "USD");
  assert.equal(exposure.result.financial[0].period, "year");
  assert.match(exposure.methodology.description, /not accrued or payable interest/i);
  assert.equal(financing.components.find((item) => item.factor === "fx").financialExposure, null);
  assert.equal(financing.exposureAggregation.status, "not_aggregated");
  assert.match(financing.recommendation.uncertainty, /No combined impact/);
});

test("recognizes same-clause co-location as potentially linked but never assumes additivity", () => {
  const source = fixture.externalRisk.contractualAssessments.find((item) => item.id === "ext-fx-lease");
  const linked = {
    ...source,
    id: "ext-fx-utilization-clause",
    clauseId: "lease-utilization-12",
    clauseNumber: "12",
    evidence: {
      ...source.evidence,
      evidenceId: "ev-same-clause-secondary",
    },
  };
  const result = derive({
    externalRisk: {
      ...fixture.externalRisk,
      contractualAssessments: [...fixture.externalRisk.contractualAssessments, linked],
    },
  });
  const lease = contract(result, LEASE_ID);
  assert.ok(lease.interactions.some((item) => item.classification === "potentially_linked"));
  assert.ok(lease.interactions.some((item) => item.classification === "unknown"));
  assert.equal(lease.components.some((item) => item.combinedAmount !== undefined), false);
});

test("keeps currencies separate and does not count a Phase 57 finding twice", () => {
  const lease = contract(derive(), LEASE_ID);
  const utilization = lease.components.find((item) => item.kind === "operational_utilisation");
  assert.equal(lease.components.filter((item) => item.kind === "contractual_financial_exposure").length, 0);
  assert.deepEqual(utilization.financialExposure.projected, {
    kind: "projected",
    amount: 2_500,
    currency: "USD",
    status: "potential_future_exposure",
    reportingPeriod: null,
    measurementDate: "2026-12-31",
    calculation: "5 projected excess hours × USD 500 per hour = USD 2,500.",
    assumptions: ["Historical average daily utilization continues."],
    evidence: [{
      evidenceId: "ev-forecast-n101",
      evidenceType: "forecast_utilisation",
      sourceLocator: "Utilization forecast",
      pageNumber: 4,
      excerpt: "Verified cumulative flight-hour history.",
      reviewStatus: "verified",
    }],
  });
  assert.deepEqual(derive().portfolio.projectedByCurrency, [{ currency: "USD", amount: 2_500 }]);
  assert.match(derive().portfolio.currencyAggregation, /no cross-currency/);
});

test("keeps current, forecast, and hypothetical results distinct", () => {
  const lease = contract(derive(), LEASE_ID);
  const utilization = lease.components.find((item) => item.kind === "operational_utilisation");
  assert.equal(utilization.current.status, "approaching");
  assert.equal(utilization.forecast.status, "forecast_available");
  assert.equal(utilization.financialExposure.projected.status, "potential_future_exposure");
  assert.equal(derive().sensitivity.hypotheticalOutputs.length, 0);
});

test("preserves stale observations as stale without presenting them as current", () => {
  const externalRisk = structuredClone(fixture.externalRisk);
  externalRisk.contractualAssessments[0].observation.freshnessStatus = "stale";
  const result = derive({ externalRisk });
  const fuel = contract(result, LEASE_ID).components.find((item) => item.factor === "fuel");
  assert.equal(fuel.observation.freshnessStatus, "stale");
  assert.equal(fuel.observation.value, 2.45);
  assert.equal(result.portfolio.indicatorGroups.some((item) => item.indicatorId === "fuel.jet.us.gulf_coast"), false);
});

test("does not promote missing observations, unreviewed clauses, or a stale contract version", () => {
  const externalRisk = structuredClone(fixture.externalRisk);
  externalRisk.contractualAssessments[0].observation = null;
  externalRisk.contractualAssessments[1].evidence.reviewStatus = "pending";
  externalRisk.contractualAssessments[2].documentVersionId = "44444444-4444-4444-8444-000000000000";
  const result = derive({ externalRisk });
  const lease = contract(result, LEASE_ID);
  assert.equal(lease.components.some((item) => item.factor === "fx"), false);
  const fuel = lease.components.find((item) => item.factor === "fuel");
  assert.equal(fuel.observation, null);
  assert.equal(fuel.status, "verified_contractual_relationship");
  assert.equal(result.contracts.some((item) => item.components.some((component) => component.clauseId === "finance-payment-3")), false);
});

test("requires verified contractual and operational citations for utilization and charges", () => {
  const portfolio = structuredClone(fixture.portfolio);
  portfolio.utilisationExposures[0].sources[0].reviewStatus = "pending";
  portfolio.utilisationExposures[0].contractEvidence[0].reviewStatus = "pending";
  portfolio.utilisationExposures[0].financialExposure.projected.sources[0].reviewStatus = "pending";
  portfolio.financialExposure.findings = [];
  const result = derive({ portfolio });
  assert.equal(contract(result, LEASE_ID).components.some((item) => item.kind === "operational_utilisation"), false);
});

test("uses a reviewed lease assessment in workspace scope and checks its version", () => {
  const metric = fixture.portfolio.utilisationExposures[0];
  const leaseAssessment = {
    applicable: true,
    organizationId: fixture.organizationId,
    contractId: LEASE_ID,
    analysisRunId: LEASE_RUN_ID,
    documentVersionId: LEASE_VERSION_ID,
    risks: [{
      contract_id: LEASE_ID,
      clause_id: metric.clauseId,
      contract_evidence: metric.contractEvidence,
      utilisation_exposure: { metrics: [metric] },
    }],
  };
  const workspace = derive({
    portfolio: null,
    leaseAssessment,
    contractId: LEASE_ID,
    analysisRunId: LEASE_RUN_ID,
    documentVersionId: LEASE_VERSION_ID,
    externalRisk: {
      ...fixture.externalRisk,
      contractualAssessments: fixture.externalRisk.contractualAssessments.filter((item) => item.contractId === LEASE_ID),
    },
  });
  const utilization = contract(workspace, LEASE_ID).components.find((item) => item.kind === "operational_utilisation");
  assert.equal(utilization.financialExposure.projected.amount, 2_500);
});

test("marks reviewer-ambiguous external terms for review rather than as verified exposure", () => {
  const source = fixture.externalRisk.contractualAssessments[0];
  const result = derive({
    externalRisk: {
      ...fixture.externalRisk,
      contractualAssessments: [{
        ...source,
        id: "ambiguous-source",
        status: "requires_review",
        mechanism: "requires_review",
      }],
    },
    portfolio: null,
  });
  const item = contract(result, LEASE_ID).components[0];
  assert.equal(item.status, "requires_review");
  assert.equal(item.observation.value, 2.45);
  assert.equal(contract(result, LEASE_ID).priority.level, "evidence_review");
});

test("does not infer an independent interaction or increase priority from factor count", () => {
  const result = derive();
  const lease = contract(result, LEASE_ID);
  assert.ok(lease.interactions.every((item) => item.classification !== "independent"));
  assert.equal(result.prioritizationPolicy.factorCountDoesNotIncreaseSeverity, true);
  assert.equal(lease.priority.level, "projected_exposure_review");
});

test("groups shared indicators and confirmed aircraft only using verified portfolio relationships", () => {
  const result = derive();
  assert.deepEqual(
    result.portfolio.indicatorGroups.find((item) => item.indicatorId === "fuel.jet.us.gulf_coast").contractIds.sort(),
    [
      "22222222-2222-4222-8222-222222222201",
      "22222222-2222-4222-8222-222222222202",
    ],
  );
  assert.equal(result.portfolio.confirmedAircraftGroups.length, 1);
  assert.deepEqual(new Set(result.portfolio.confirmedAircraftGroups[0].contractIds), new Set([LEASE_ID, "22222222-2222-4222-8222-222222222202"]));
  assert.equal(result.portfolio.confirmedAircraftGroups.some((item) => item.aircraftId === "aircraft-unverified"), false);
});

test("orders immediate and projected evidence without a numeric risk score", () => {
  const portfolio = structuredClone(fixture.portfolio);
  portfolio.utilisationExposures[0].financialExposure.current = {
    status: "currently_demonstrated_exposure",
    amount: 500,
    currency: "USD",
    sources: [{
      evidenceId: "ev-current-charge",
      sourceLocator: "Utilization report",
      excerpt: "Verified current usage.",
      reviewStatus: "verified",
    }],
  };
  const lease = contract(derive({ portfolio }), LEASE_ID);
  assert.equal(lease.priority.level, "current_exposure_review");
  assert.equal("score" in lease.priority, false);
});

test("returns a safe empty state and rejects an invalid organization scope", () => {
  const result = derive({
    externalRisk: { asOf: fixture.asOf, contractualAssessments: [] },
    portfolio: null,
  });
  assert.equal(result.status, "no_supported_contractual_exposure");
  assert.equal(result.contracts.length, 0);
  assert.throws(() => deriveAviationPredictiveContractRisk({
    organizationId: "not-an-organization",
    externalRisk: { contractualAssessments: [] },
  }), /organization/i);
  assert.throws(() => derive({
    externalRisk: {
      organizationId: "99999999-9999-4999-8999-999999999999",
      contractualAssessments: [],
    },
  }), /different organization/i);
});

test("prioritizes an exact upcoming payment date without asserting it is unpaid", () => {
  const externalRisk = {
    ...fixture.externalRisk,
    contractualAssessments: [fixture.externalRisk.contractualAssessments.find((item) => item.id === "ext-fx-lease")],
  };
  const result = derive({ portfolio: null, externalRisk });
  const lease = contract(result, LEASE_ID);
  assert.equal(lease.priority.level, "time_sensitive_review");
  assert.equal(lease.components[0].contractualPayment.dueDate, "2026-12-01");
  assert.match(lease.priority.reason, /within 30 days/);
});

test("uses the existing approaching utilization status as a review cue, not a probability", () => {
  const metric = {
    ...fixture.portfolio.utilisationExposures[0],
    financialExposure: null,
    forecast: null,
  };
  const result = derive({
    portfolio: null,
    externalRisk: { asOf: fixture.asOf, contractualAssessments: [] },
    leaseAssessment: {
      contractId: LEASE_ID,
      analysisRunId: LEASE_RUN_ID,
      documentVersionId: LEASE_VERSION_ID,
      risks: [{
        contract_id: LEASE_ID,
        clause_id: metric.clauseId,
        contract_evidence: metric.contractEvidence,
        utilisation_exposure: { metrics: [metric] },
      }],
    },
  });
  assert.equal(contract(result, LEASE_ID).priority.level, "approaching_limit_review");
  assert.match(contract(result, LEASE_ID).priority.reason, /not a probability or forecast/);
});

test("reports probabilistic readiness without inventing Bayesian or Monte Carlo outputs", () => {
  const result = derive();
  const lease = contract(result, LEASE_ID);
  const readiness = lease.probabilisticReadiness;
  const dimension = (name) => readiness.evidenceDimensions.find((item) => item.name === name);

  assert.equal(readiness.status, "deterministic_only");
  assert.equal(readiness.generatedOn, fixture.asOf);
  assert.equal(readiness.modelVersion, "phase60-readiness-v1");
  assert.equal(readiness.basis.documentVersionId, LEASE_VERSION_ID);
  assert.ok(readiness.basis.evidenceIds.length > 0);
  assert.deepEqual(new Set(readiness.deterministicBaselineComponentIds), new Set(lease.components.map((item) => item.id)));
  assert.equal(readiness.bayesianUpdate.status, "not_run");
  assert.equal(readiness.bayesianUpdate.prior, null);
  assert.equal(readiness.bayesianUpdate.posterior, null);
  assert.equal(readiness.monteCarlo.status, "not_run");
  assert.equal(readiness.monteCarlo.iterations, 0);
  assert.deepEqual(readiness.monteCarlo.inputs, []);
  assert.equal(readiness.assumptionDisclosure.hypotheticalInputs, "None supplied or generated.");
  assert.equal(dimension("contractual_evidence").status, "sufficient_evidence");
  assert.equal(dimension("data_recency").status, "insufficient_evidence");
  assert.equal(dimension("historical_data_coverage").status, "insufficient_evidence");
  assert.equal(dimension("dependency_evidence").status, "insufficient_evidence");
  assert.equal(dimension("distribution_suitability").status, "insufficient_evidence");
  assert.equal(dimension("model_validation").status, "not_assessed");
  assert.equal(result.probabilisticReadiness.forecastCount, 0);
  assert.equal(result.probabilisticReadiness.deterministicOnlyContractCount, result.contracts.length);
  assert.equal(lease.components.find((item) => item.kind === "operational_utilisation").financialExposure.projected.amount, 2_500);
});

test("marks stale market data as stale in predictive evidence readiness", () => {
  const externalRisk = structuredClone(fixture.externalRisk);
  externalRisk.contractualAssessments[0].observation.freshnessStatus = "stale";
  const result = derive({ externalRisk });
  const readiness = contract(result, LEASE_ID).probabilisticReadiness;
  const externalDimension = readiness.evidenceDimensions.find((item) => item.name === "external_observation_quality");

  assert.equal(externalDimension.status, "stale_evidence");
  assert.equal(readiness.evidenceDimensions.find((item) => item.name === "data_recency").status, "stale_evidence");
  assert.equal(readiness.monteCarlo.status, "not_run");
  assert.ok(readiness.nextActions.some((item) => /historical series/.test(item)));
});

test("connects indicator coverage to the matching contract and discloses missing outcome evaluation", () => {
  const externalRisk = structuredClone(fixture.externalRisk);
  externalRisk.historicalObservationCoverage = [{
    indicatorId: "fuel.jet.us.gulf_coast",
    status: "partial_coverage",
    observationCount: 12,
    oldestObservationDate: "2026-01-02",
    latestObservationDate: "2026-11-06",
    maximumObservedGapDays: 42,
    duplicateDateCount: 1,
    revisionRecordCount: 2,
    gapsExceedingExpectedCadence: [{ days: 42 }],
  }];
  const readiness = contract(derive({ externalRisk }), LEASE_ID).probabilisticReadiness;
  const coverage = readiness.historicalObservationCoverage[0];
  const historicalDimension = readiness.evidenceDimensions.find((item) => item.name === "historical_data_coverage");

  assert.equal(coverage.indicatorId, "fuel.jet.us.gulf_coast");
  assert.equal(coverage.observationCount, 12);
  assert.equal(historicalDimension.status, "limited_evidence");
  assert.match(historicalDimension.reason, /42 day\(s\)/);
  assert.equal(readiness.contractualOutcomeHistory.status, "not_assessed");
  assert.equal(readiness.contractualOutcomeHistory.verifiedOutcomeCount, null);
  assert.match(readiness.contractualOutcomeHistory.reason, /Phase 62 provides a contract-version-scoped outcome history workflow/i);
  assert.match(readiness.contractualOutcomeHistory.reason, /absence from this payload is not evidence that no outcome occurred/i);
  assert.equal(readiness.forecastEvaluation.status, "not_available");
  assert.deepEqual(readiness.forecastEvaluation.metrics, []);
  assert.match(readiness.forecastEvaluation.reason, /deterministic backtesting does not calibrate probabilistic forecasts/i);
  assert.ok(readiness.nextActions.some((item) => /record later verified, period-matched outcomes/i.test(item)));
});

test("reuses Phase 55 cited utilisation history for descriptive operational coverage only", () => {
  const metric = structuredClone(fixture.portfolio.utilisationExposures[0]);
  metric.forecast.observations = [
    { start: "2026-01-01", end: "2026-04-30", cumulativeUtilisation: 100 },
    { start: "2026-05-01", end: "2026-07-31", cumulativeUtilisation: 260 },
    { start: "2026-08-01", end: "2026-11-09", cumulativeUtilisation: 420 },
  ];
  metric.forecast.evidenceCoverage = {
    observationCount: 3,
    coveredFrom: "2026-01-01",
    coveredThrough: "2026-11-09",
    reportingPeriodsContiguous: true,
  };
  const result = derive({
    portfolio: null,
    externalRisk: { asOf: fixture.asOf, contractualAssessments: [] },
    leaseAssessment: {
      contractId: LEASE_ID,
      analysisRunId: LEASE_RUN_ID,
      documentVersionId: LEASE_VERSION_ID,
      risks: [{
        contract_id: LEASE_ID,
        clause_id: metric.clauseId,
        contract_evidence: metric.contractEvidence,
        utilisation_exposure: { metrics: [metric] },
      }],
    },
  });
  const readiness = contract(result, LEASE_ID).probabilisticReadiness;

  assert.deepEqual(readiness.operationalObservationCoverage.map((item) => ({
    clauseId: item.clauseId,
    unit: item.unit,
    observationCount: item.observationCount,
    coveredFrom: item.coveredFrom,
    coveredThrough: item.coveredThrough,
    reportingPeriodsContiguous: item.reportingPeriodsContiguous,
  })), [{
    clauseId: metric.clauseId,
    unit: "flight_hours",
    observationCount: 3,
    coveredFrom: "2026-01-01",
    coveredThrough: "2026-11-09",
    reportingPeriodsContiguous: true,
  }]);
  assert.match(readiness.evidenceDimensions.find((item) => item.name === "historical_data_coverage").reason, /Phase 62 can preserve eligible deterministic forecast snapshots/i);
  assert.equal(readiness.forecastEvaluation.status, "not_available");
});

test("returns a zero-forecast readiness summary when no supported contract evidence exists", () => {
  const result = derive({
    portfolio: null,
    externalRisk: { asOf: fixture.asOf, contractualAssessments: [] },
  });

  assert.equal(result.probabilisticReadiness.status, "no_probabilistic_forecasts");
  assert.equal(result.probabilisticReadiness.assessedContractCount, 0);
  assert.equal(result.probabilisticReadiness.forecastCount, 0);
  assert.deepEqual(result.probabilisticReadiness.evidenceGaps, []);
});

test("bounds a large synthetic batch of supported external assessments", () => {
  const assessments = Array.from({ length: 1000 }, (_, index) => ({
    id: `large-${index}`,
    category: "fx",
    status: "verified_contractual_relationship",
    mechanism: "explicit_foreign_currency_payment",
    contractId: `contract-${index}`,
    contractTitle: `Synthetic contract ${index}`,
    analysisRunId: `run-${index}`,
    documentVersionId: `version-${index}`,
    clauseId: `clause-${index}`,
    evidence: {
      evidenceId: `evidence-${index}`,
      reviewStatus: "verified",
      excerpt: "Payment in USD.",
    },
    calculation: { status: "not_calculated", missingInputs: ["reporting currency"] },
  }));
  const result = derive({
    portfolio: null,
    externalRisk: { asOf: fixture.asOf, contractualAssessments: assessments },
  });
  assert.equal(result.coverage.componentCount, 1000);
  assert.equal(result.contracts.length, 1000);
});

test("keeps the migration access model fail-closed and write-once for the service role", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/027_external_market_observations.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on public\.external_market_observations from public, anon, authenticated/i);
  assert.match(migration, /grant select, insert on public\.external_market_observations to service_role/i);
  assert.doesNotMatch(migration, /grant\s+(?:all|update|delete)\s+on\s+public\.external_market_observations\s+to\s+service_role/i);
  assert.match(migration, /external_market_observations_dedupe_idx/);
});

test("derives version-scoped FX and utilization early warnings without aggregating exposures", () => {
  const portfolio = structuredClone(fixture.portfolio);
  const utilization = portfolio.utilisationExposures[0];
  utilization.obligationId = "verified-utilisation-obligation";
  utilization.obligationDescription = "Monitor cumulative flight-hour allowance";
  utilization.obligationReviewStatus = "verified";

  const externalRisk = structuredClone(fixture.externalRisk);
  const fx = externalRisk.contractualAssessments.find((item) => item.id === "ext-fx-lease");
  fx.obligationId = "verified-payment-obligation";
  fx.obligationDescription = "Pay the cited USD payment by its due date";
  fx.obligationReviewStatus = "verified";
  fx.obligationEvidence = {
    evidenceId: "ev-payment-obligation",
    sourceLocator: "Payment obligation",
    pageNumber: 8,
    excerpt: "The Lessee shall pay the cited amount on the stated date.",
    reviewStatus: "verified",
  };
  fx.observation.id = "ecb-current-usd";
  fx.observation.indicatorId = "fx.eur.usd";
  fx.observation.value = 1.1;
  fx.observation.currency = "USD";
  fx.observation.baseCurrency = "EUR";
  fx.observation.quoteCurrency = "USD";
  fx.observation.recordType = "published_observation";
  fx.observation.observationDate = "2026-11-06";
  fx.observation.dataQualityStatus = "verified";
  fx.observation.sourceId = "ecb";
  fx.observation.sourceReference = "https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A";
  fx.observation.movement = {
    status: "comparable",
    fromObservationId: "ecb-prior-usd",
    fromObservationDate: "2026-11-05",
    fromValue: 1.12,
    toObservationId: "ecb-current-usd",
    toObservationDate: "2026-11-06",
    toValue: 1.1,
    intervalDays: 1,
    sourceId: "ecb",
    sourceReference: fx.observation.sourceReference,
    unit: "USD per EUR",
  };

  const original = structuredClone({ portfolio, externalRisk });
  const result = derive({ portfolio, externalRisk });
  const leaseWarnings = result.earlyWarnings.filter((warning) => warning.contract.contractId === LEASE_ID);
  const fxWarning = leaseWarnings.find((warning) => warning.category === "financial_reference");
  const utilizationWarning = leaseWarnings.find((warning) => warning.category === "operational_utilisation");

  assert.equal(fxWarning.status, "attention_required");
  assert.equal(fxWarning.result.referenceEquivalentChange.amount, 20292.21);
  assert.equal(fxWarning.result.referenceEquivalentChange.currency, "EUR");
  assert.equal(fxWarning.result.notActualLoss, true);
  assert.deepEqual(fxWarning.evidence.external.map((item) => item.evidenceId), ["ecb-prior-usd", "ecb-current-usd"]);
  assert.ok(fxWarning.recommendation.supportingEvidence.some((item) => item.evidenceId === "ev-fx-clause-lease"));
  assert.ok(fxWarning.recommendation.supportingEvidence.some((item) => item.evidenceId === "ev-payment-obligation"));

  assert.equal(utilizationWarning.status, "approaching_limit_review");
  assert.equal(utilizationWarning.result.recordedUtilisation, 420);
  assert.equal(utilizationWarning.result.headroom, 80);
  assert.equal(utilizationWarning.result.projected, null);
  assert.equal(utilizationWarning.result.financialAmount, null);
  assert.ok(utilizationWarning.evidence.contractual.some((item) => item.evidenceId === "ev-clause-util-n101"));
  assert.ok(utilizationWarning.evidence.operational.some((item) => item.evidenceId === "ev-usage-n101"));

  assert.equal(new Set(result.earlyWarnings.map((warning) => warning.id)).size, result.earlyWarnings.length);
  assert.deepEqual({ portfolio, externalRisk }, original);
  assert.deepEqual(result.portfolio.projectedByCurrency, [{ currency: "USD", amount: 2500 }]);
  assert.equal(result.contracts.find((item) => item.contractId === LEASE_ID).components.length, 3);
  assert.deepEqual(
    derive({ portfolio, externalRisk }).earlyWarnings.map((warning) => warning.id),
    result.earlyWarnings.map((warning) => warning.id),
  );
});

test("fails early warnings closed for stale observations, stale utilization and unverified obligations", () => {
  const portfolio = structuredClone(fixture.portfolio);
  portfolio.utilisationExposures[0].obligationId = "unverified-utilisation-obligation";
  portfolio.utilisationExposures[0].obligationReviewStatus = "pending";
  portfolio.utilisationExposures[0].reportingPeriod.end = "2026-09-01";
  const externalRisk = structuredClone(fixture.externalRisk);
  const fx = externalRisk.contractualAssessments.find((item) => item.id === "ext-fx-lease");
  fx.observation.freshnessStatus = "stale";
  fx.observation.movement = {
    status: "insufficient_history",
    fromObservationDate: "2026-10-01",
    toObservationDate: "2026-11-06",
    fromValue: 1.12,
    toValue: 1.1,
    sourceId: "ecb",
    unit: "USD per EUR",
  };
  const result = derive({ portfolio, externalRisk });
  const warnings = result.earlyWarnings.filter((item) => item.contract.contractId === LEASE_ID);
  const fxWarning = warnings.find((item) => item.category === "financial_reference");
  const utilizationWarning = warnings.find((item) => item.category === "operational_utilisation");

  assert.equal(fxWarning.status, "insufficient_evidence");
  assert.equal(fxWarning.result.status, "not_calculated");
  assert.equal(fxWarning.result.referenceEquivalentChange, null);
  assert.ok(fxWarning.recommendation.missingInformation.length > 0);
  assert.equal(utilizationWarning.status, "insufficient_evidence");
  assert.equal(utilizationWarning.result.recordedUtilisation, 420);
  assert.equal(utilizationWarning.result.projected, null);
  assert.ok(utilizationWarning.recommendation.missingInformation.some((item) => /verified extracted utilisation obligation/i.test(item)));
});

test("projects a verified calendar-year allowance and cites its assumptions without claiming breach", () => {
  const portfolio = structuredClone(fixture.portfolio);
  const metric = portfolio.utilisationExposures[0];
  const periods = [
    ["2026-01-01", "2026-01-31", 100],
    ["2026-02-01", "2026-02-28", 200],
    ["2026-03-01", "2026-03-31", 300],
    ["2026-04-01", "2026-04-30", 400],
    ["2026-05-01", "2026-05-31", 500],
    ["2026-06-01", "2026-06-30", 600],
    ["2026-07-01", "2026-07-31", 700],
  ];
  const forecastSources = periods.map((_, index) => ({
    evidenceId: `verified-calendar-reading-${index + 1}`,
    reviewStatus: "verified",
    sourceLocator: `Calendar-year report ${index + 1}`,
    excerpt: `Verified cumulative flight hours for report ${index + 1}.`,
  }));
  metric.contractualLimit = 1000;
  metric.contractualMeasurementPeriod = "per calendar year";
  metric.contractEvidence = [{
    evidenceId: "verified-calendar-year-clause",
    reviewStatus: "verified",
    sourceLocator: "Clause 15.3",
    excerpt: "Cumulative flight hours shall not exceed 1,000 per calendar year.",
  }];
  metric.obligationId = "verified-calendar-year-obligation";
  metric.obligationDescription = "Monitor cumulative calendar-year flight hours";
  metric.obligationReviewStatus = "verified";
  metric.obligationEvidence = {
    evidenceId: "verified-calendar-year-obligation-evidence",
    reviewStatus: "verified",
    sourceLocator: "Clause 15.3",
    excerpt: "The Lessee shall submit monthly reports.",
  };
  metric.current = {
    status: "within_limit",
    recordedUtilisation: 700,
    headroom: 300,
    consumedPercent: 70,
    reportingPeriod: { start: "2026-07-01", end: "2026-07-31" },
    sources: [{
      evidenceId: "verified-current-calendar-reading",
      reviewStatus: "verified",
      sourceLocator: "July utilisation report",
    }],
  };
  metric.forecast = {
    status: "forecast_available",
    forecastReliability: "sufficient_verified_evidence",
    contractualLimit: 1000,
    lastObservedDate: "2026-07-31",
    observations: periods.map(([start, end, cumulativeUtilisation]) => ({
      start,
      end,
      cumulativeUtilisation,
    })),
    evidenceCoverage: {
      observationCount: periods.length,
      coveredFrom: "2026-01-01",
      coveredThrough: "2026-07-31",
      reportingPeriodsContiguous: true,
    },
    sources: forecastSources,
    forecastAssumption: "Observed calendar-day consumption rate continues unchanged.",
  };
  metric.financialExposure = null;
  const original = structuredClone(portfolio);
  const result = derive({ portfolio, asOf: "2026-08-09" });
  const lease = contract(result, LEASE_ID);
  const component = lease.components.find((item) => item.kind === "operational_utilisation");
  const projection = component.annualizedProjection;

  assert.equal(projection.status, "projection_available", JSON.stringify(projection));
  assert.equal(projection.methodologyVersion, "phase67-calendar-year-run-rate-v1");
  assert.equal(projection.classification, "potential_exposure_developing");
  assert.equal(projection.annualizedConsumptionRate, 1205.19);
  assert.equal(projection.projectedUtilisationAtPeriodEnd, 1205.19);
  assert.equal(projection.projectedExcessUnits, 205.19);
  assert.deepEqual(projection.horizon, { start: "2026-07-31", end: "2026-12-31", days: 153 });
  assert.equal(projection.observations.length, 7);
  assert.ok(projection.assumptions.some((item) => /rate remains unchanged/.test(item)));
  assert.ok(projection.limitations.some((item) => /does not establish a breach/.test(item)));
  assert.ok(component.exposureAssessment.result.projection.annualizedUtilisation);

  const warning = result.earlyWarnings.find((item) => item.clause.clauseId === metric.clauseId);
  assert.equal(warning.status, "potential_exposure_developing");
  assert.equal(warning.trigger.kind, "calendar_year_utilisation_projection");
  assert.ok(warning.recommendation.supportingEvidence.some((item) => item.evidenceId === "verified-calendar-year-clause"));
  assert.ok(warning.recommendation.supportingEvidence.some((item) => item.evidenceId === forecastSources[0].evidenceId));
  assert.deepEqual(portfolio, original);

  const mismatchedPeriod = structuredClone(portfolio);
  mismatchedPeriod.utilisationExposures[0].contractualMeasurementPeriod = "per lease year";
  const mismatchResult = derive({ portfolio: mismatchedPeriod, asOf: "2026-08-09" });
  const mismatch = contract(mismatchResult, LEASE_ID).components
    .find((item) => item.kind === "operational_utilisation").annualizedProjection;
  assert.equal(mismatch.status, "insufficient_evidence");
  assert.equal(mismatch.projectedUtilisationAtPeriodEnd, null);
  assert.ok(mismatch.missingInformation.some((item) => /calendar-year allowance/i.test(item)));

  const gappedHistory = structuredClone(portfolio);
  gappedHistory.utilisationExposures[0].forecast.observations.splice(3, 1);
  const gapResult = derive({ portfolio: gappedHistory, asOf: "2026-08-09" });
  const gap = contract(gapResult, LEASE_ID).components
    .find((item) => item.kind === "operational_utilisation").annualizedProjection;
  assert.equal(gap.status, "insufficient_evidence");
  assert.equal(gap.projectedUtilisationAtPeriodEnd, null);

  const staleHistory = structuredClone(portfolio);
  const staleResult = derive({ portfolio: staleHistory, asOf: "2026-09-10" });
  const stale = contract(staleResult, LEASE_ID).components
    .find((item) => item.kind === "operational_utilisation").annualizedProjection;
  assert.equal(stale.status, "insufficient_evidence");
  assert.equal(stale.projectedUtilisationAtPeriodEnd, null);

  const minimumHistory = structuredClone(portfolio);
  const minimumMetric = minimumHistory.utilisationExposures[0];
  minimumMetric.direction = "minimum";
  minimumMetric.contractualMinimum = 1250;
  minimumMetric.contractualLimit = null;
  minimumMetric.status = "above_minimum";
  minimumMetric.current.status = "above_minimum";
  minimumMetric.current.remainingRequirement = 0;
  minimumMetric.contractEvidence[0].excerpt = "Cumulative flight hours shall be at least 1,250 per calendar year.";
  const minimumResult = derive({ portfolio: minimumHistory, asOf: "2026-08-09" });
  const minimumProjection = contract(minimumResult, LEASE_ID).components
    .find((item) => item.kind === "operational_utilisation").annualizedProjection;
  assert.equal(minimumProjection.status, "projection_available");
  assert.equal(minimumProjection.projectedShortfallUnits, 44.81);
  assert.equal(minimumProjection.classification, "potential_exposure_developing");
});
