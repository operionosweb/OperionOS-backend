import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { build } from "esbuild";

const compiled = await build({
  stdin: {
    contents: `
      import React from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import { StaticRouter, Routes, Route } from "react-router-dom";
      import { DemoDataProvider, useDemoData } from "./src/demo/DemoDataProvider";
      import DemoWorkspace from "./src/routes/demo/DemoWorkspace";
      import DemoContracts from "./src/routes/demo/DemoContracts";
      import DemoFinancialImpact from "./src/components/demo/DemoFinancialImpact";
      import DemoHub from "./src/routes/DemoHub";
      import { DemoDisclosure, Confidence, RiskBadge } from "./src/demo/DemoUI";
      import DemoIntelligence from "./src/routes/demo/DemoIntelligence";
      import { PUBLIC_DEMO_CONTRACTS } from "./src/lib/publicDemoData";
      export { DEMO_CONTRACTS, getDemoEvidence } from "./src/demo/DemoDataProvider";
      export { SYNTHETIC_INDEXATION, calculateSyntheticIndexation } from "./src/demo/indexationJourney";
      export { SYNTHETIC_AIRCRAFT_LEASE, calculateSyntheticFuelPriceAdjustment, calculateSyntheticInterestRateScenarios, calculateSyntheticFxReferenceSensitivity, calculateSyntheticFxScenarioComparisons, calculateSyntheticFxReferenceMovement, calculateSyntheticUtilisationJourney, calculateSyntheticOutcomeComparison, reassessSyntheticUtilisation, calculateSyntheticCalendarYearProjection } from "./src/demo/aviationIntelligenceJourney";
      export { PUBLIC_DEMO_CONTRACTS };
      export function renderJourney() {
        return renderToStaticMarkup(React.createElement(StaticRouter, { location: "/demo/intelligence" },
          React.createElement(DemoDataProvider, null, React.createElement(DemoIntelligence))));
      }
      export function renderPublicDemo() {
        return renderToStaticMarkup(React.createElement(StaticRouter, { location: "/demo" },
          React.createElement(DemoHub)));
      }
      export function renderEvidence(contractId, id) {
        function Probe() { return React.createElement("span", null, JSON.stringify(useDemoData().getEvidence(contractId, id))); }
        return renderToStaticMarkup(React.createElement(DemoDataProvider, null, React.createElement(Probe)));
      }
      export function renderWorkspace(id, section = "overview") {
        return renderToStaticMarkup(React.createElement(StaticRouter, { location: "/demo/contracts/" + id + "/" + section },
          React.createElement(DemoDataProvider, null, React.createElement(Routes, null,
            React.createElement(Route, {path: "/demo/contracts/:id/:section", element: React.createElement(DemoWorkspace)})))));
      }
      export function renderLabels() {
        return renderToStaticMarkup(React.createElement(React.Fragment, null,
          React.createElement(DemoDisclosure),
          React.createElement(Confidence, {value: .97}),
          React.createElement(Confidence, {value: null}),
          React.createElement(RiskBadge, {severity: "High"})));
      }
      export function renderContracts() {
        return renderToStaticMarkup(React.createElement(StaticRouter, null,
          React.createElement(DemoDataProvider, null, React.createElement(DemoContracts))));
      }
      export function renderFinancialEmpty(contract) {
        return renderToStaticMarkup(React.createElement(DemoFinancialImpact, {contract}));
      }
    `,
    resolveDir: fileURLToPath(new URL("..", import.meta.url)),
    loader: "jsx",
  },
  bundle: true,
  packages: "external",
  platform: "node",
  format: "cjs",
  write: false,
  loader: { ".css": "empty" },
  plugins: [{
    name: "browser-only-matt-boundary",
    setup(plugin) {
      plugin.onResolve({ filter: /\/Matt$/ }, () => ({ path: "Matt", namespace: "browser-only" }));
      plugin.onLoad({ filter: /.*/, namespace: "browser-only" }, () => ({
        contents: `import React from "react"; export function MattExperience({ contract }) { return React.createElement("section", { "data-matt-contract": contract?.id }, "Browser-only Matt boundary; live assistant tested separately."); }`,
        loader: "js",
        resolveDir: fileURLToPath(new URL("..", import.meta.url)),
      }));
    },
  }],
});
const bundledModule = { exports: {} };
new Function("require", "module", "exports", "window", compiled.outputFiles[0].text)(
  createRequire(import.meta.url), bundledModule, bundledModule.exports,
  { location: { search: "", hash: "", href: "https://demo.example.test/demo", origin: "https://demo.example.test" }, sessionStorage: { getItem: () => null } },
);
const { DEMO_CONTRACTS, getDemoEvidence, PUBLIC_DEMO_CONTRACTS, SYNTHETIC_AIRCRAFT_LEASE: lease, calculateSyntheticFuelPriceAdjustment: calculateFuelAdjustment, calculateSyntheticInterestRateScenarios: calculateInterestScenarios, calculateSyntheticFxReferenceSensitivity: calculateFx, calculateSyntheticFxScenarioComparisons: calculateFxScenarios, calculateSyntheticFxReferenceMovement: calculateFxMovement, calculateSyntheticUtilisationJourney: calculate, calculateSyntheticOutcomeComparison: compareSyntheticOutcome, reassessSyntheticUtilisation: reassessSynthetic, calculateSyntheticCalendarYearProjection: calculateAnnualProjection, renderJourney, renderPublicDemo, renderEvidence, renderWorkspace, renderLabels, renderContracts, renderFinancialEmpty } = bundledModule.exports;

test("synthetic MRO indexation connects shared formula, reviewed example, risks and all Workspace sections", () => {
  const { SYNTHETIC_INDEXATION: indexation, calculateSyntheticIndexation } = bundledModule.exports;
  const contract = DEMO_CONTRACTS.find((item) => item.id === indexation.contractRouteId);
  const result = calculateSyntheticIndexation();
  assert.equal(result.calculation.revisedPrice, 103000);
  assert.equal(result.calculation.incrementalCost, 3000);
  assert.equal(calculateSyntheticIndexation(306).calculation.revisedPrice, 101600);
  assert.equal(calculateSyntheticIndexation(330).calculation.revisedPrice, 103000);
  assert.equal(calculateSyntheticIndexation(294).calculation.revisedPrice, 100000);
  assert.equal(calculateSyntheticIndexation(NaN).calculation, null);
  assert.equal(contract.clauses[0].text, indexation.excerpt);
  assert.equal(contract.deadlines[0].timing, "2026-12-02");
  assert.equal(contract.financialImpact.currentContractualExposure, null);
  assert.equal(contract.financialImpact.items[0].baseAmount, 3000);
  for (const id of result.evidenceIds) {
    assert.equal(getDemoEvidence(contract.id, id).synthetic, true);
    assert.equal(getDemoEvidence(lease.contractRouteId, id), undefined);
  }
  for (const section of ["overview", "clauses", "obligations", "deadlines", "risks", "evidence", "financial-impact", "assistant"]) {
    const html = renderWorkspace(contract.id, section);
    assert.match(html, /Synthetic|synthetic/);
    assert.doesNotMatch(html, /Demo contract unavailable/);
  }
  const html = renderJourney();
  assert.match(html, /Synthetic aviation MRO indexation/);
  assert.match(html, /not BLS data or customer records/);
  assert.match(html, /phase74-explicit-index-ratio-v1/);
  assert.match(html, /synthetic-indexation-level/);
});

test("primary Demo lease connects synthetic clause, reports, obligation and risk", () => {
  const contract = DEMO_CONTRACTS.find(item => item.id === lease.contractRouteId);
  const clause = contract.clauses.find(item => item.id === "cl-utilisation");
  const obligation = contract.obligations.find(item => item.id === lease.obligation.id);
  const paymentObligation = contract.obligations.find(item => item.id === lease.fxPayment.obligation.id);
  const risk = contract.risks.find(item => item.id === "rk-utilisation");
  assert.equal(clause.evidenceId, lease.clause.id);
  assert.equal(clause.text, lease.clause.excerpt);
  assert.equal(obligation.clauseId, clause.id);
  assert.equal(paymentObligation.clauseId, lease.fxPayment.clauseId);
  assert.equal(paymentObligation.evidenceId, lease.fxPayment.evidenceId);
  assert.equal(risk.obligationId, obligation.id);
  assert.equal(risk.evidenceIds.includes(lease.syntheticOutcome.evidenceId), false);
  const sourceIds = [lease.clause.id, ...lease.readings.map(reading => reading.evidenceId)];
  assert.deepEqual(risk.evidenceIds, sourceIds);
  for (const id of sourceIds) {
    const source = contract.evidence.find(item => item.id === id);
    assert.equal(source.synthetic, true);
    assert.ok(renderEvidence(contract.id, id).includes(id), `context resolves ${id}`);
  }
  for (const reading of lease.readings) {
    assert.equal(contract.evidence.find(item => item.id === reading.evidenceId).page, reading.page);
  }
  assert.equal(contract.financialImpact.items.length, 3, "the only added amount is a separate fuel-clause illustration, not a utilization charge");
  assert.equal(contract.financialImpact.items.some(item => item.clauseId === "cl-utilisation"), false, "utilisation remains unmonetized without a contractual charge");
});

test("synthetic weekly fuel-price adjustment is explicit, bounded, and provenance-linked across Demo sections", () => {
  const contract = DEMO_CONTRACTS.find(item => item.id === lease.contractRouteId);
  const fuel = lease.fuelPriceAdjustment;
  const calculation = calculateFuelAdjustment(lease);
  const clause = contract.clauses.find(item => item.id === fuel.clauseId);
  const obligation = contract.obligations.find(item => item.id === fuel.obligationId);
  const risk = contract.risks.find(item => item.id === "rk-fuel-price");
  const impact = contract.financialImpact.items.find(item => item.id === "fi-fuel-adjustment");

  assert.equal(calculation.status, "synthetic_calculated");
  assert.equal(calculation.adjustment.amount, 2400);
  assert.equal(calculation.adjustment.currency, "USD");
  assert.equal(calculation.adjustment.period, "week");
  assert.equal(clause.evidenceId, fuel.evidenceId);
  assert.equal(obligation.clauseId, fuel.clauseId);
  assert.equal(risk.obligationId, fuel.obligationId);
  assert.deepEqual(risk.evidenceIds, calculation.evidenceIds);
  assert.equal(impact.baseAmount, calculation.adjustment.amount);
  assert.equal(impact.currency, "USD");
  assert.equal(impact.evidenceIds.length, 2);
  assert.equal(contract.financialImpact.eventDrivenExposure, 185000, "fuel amount is not included in the existing event exposure");
  assert.match(calculation.disclosure, /not a live benchmark/i);
  assert.match(calculation.disclosure, /customer cost/i);
  for (const id of calculation.evidenceIds) {
    assert.equal(getDemoEvidence(contract.id, id).synthetic, true);
    assert.ok(renderEvidence(contract.id, id).includes(id));
  }
  for (const section of ["overview", "clauses", "obligations", "deadlines", "risks", "evidence", "financial-impact"]) {
    const html = renderWorkspace(contract.id, section);
    assert.ok(html.includes(fuel.clauseNumber) || html.includes(fuel.obligationId) || html.includes("Weekly fuel-price clause adjustment"), section);
  }
  const journey = renderJourney();
  assert.match(journey, /Synthetic contract-linked fuel-price exposure/);
  assert.match(journey, /2,400\.00/);
  assert.match(journey, /No live EIA value is used/);

  const invalidObservation = {
    ...lease,
    fuelPriceAdjustment: {
      ...fuel,
      observation: { ...fuel.observation, synthetic: false },
    },
  };
  assert.equal(calculateFuelAdjustment(invalidObservation).status, "insufficient_synthetic_data");
  const missingFormula = {
    ...lease,
    fuelPriceAdjustment: { ...fuel, quantityGallons: null },
  };
  assert.equal(calculateFuelAdjustment(missingFormula).status, "insufficient_synthetic_data");
});

test("synthetic aircraft financing journey applies SOFR assumptions, margin, caps, floor and contract evidence", () => {
  const financing = lease.aircraftFinancing;
  const calculation = calculateInterestScenarios(financing);
  const contract = DEMO_CONTRACTS.find(item => item.id === financing.contractRouteId);
  const clause = contract.clauses.find(item => item.id === financing.clause.clauseId);
  const obligation = contract.obligations.find(item => item.id === financing.clause.obligationId);
  const risk = contract.risks.find(item => item.id === "rk-interest-rate");
  const impact = contract.financialImpact.items.find(item => item.id === "fi-interest-rate-scenario");

  assert.equal(calculation.status, "synthetic_calculated");
  assert.equal(calculation.syntheticOnly, true);
  assert.equal(calculation.baseline.applicableRatePercent, 6.42);
  assert.equal(calculation.baseline.annualizedInterestExpense.amount, 642000);
  const moderate = calculation.scenarios.find(item => item.scenarioChangePercentagePoints === 1);
  const capped = calculation.scenarios.find(item => item.scenarioChangePercentagePoints === 2);
  assert.equal(moderate.annualizedInterestExpense.amount, 742000);
  assert.equal(moderate.annualizedDifference.amount, 100000);
  assert.equal(capped.applicableRatePercent, 7.5);
  assert.equal(capped.annualizedInterestExpense.amount, 750000);
  assert.equal(capped.annualizedDifference.amount, 108000);

  assert.equal(clause.evidenceId, financing.clause.id);
  assert.equal(obligation.clauseId, financing.clause.clauseId);
  assert.equal(risk.obligationId, financing.clause.obligationId);
  assert.ok(risk.evidenceIds.includes(financing.benchmark.evidenceId));
  assert.equal(impact.baseAmount, moderate.annualizedDifference.amount);
  assert.equal(impact.currency, "USD");
  assert.equal(contract.financialImpact.currentContractualExposure, null);
  assert.equal(contract.financialImpact.eventDrivenExposure, null);
  for (const id of calculation.evidenceIds) {
    assert.equal(getDemoEvidence(contract.id, id).synthetic, true);
    assert.ok(renderEvidence(contract.id, id).includes(id));
  }
  for (const section of ["overview", "clauses", "obligations", "deadlines", "risks", "evidence", "financial-impact"]) {
    const html = renderWorkspace(contract.id, section);
    assert.ok(html.includes(financing.clause.number) || html.includes(financing.clause.obligationId), section);
  }
  const journey = renderJourney();
  assert.match(journey, /Synthetic aircraft financing rate exposure/);
  assert.match(journey, /not sourced from the New York Fed/);
  assert.match(journey, /not customer data or live market observations/);
  assert.match(journey, /750,000\.00/);
  assert.match(renderWorkspace(contract.id, "assistant"), /Floating-rate aircraft financing/);

  const invalidBenchmark = {
    ...financing,
    benchmark: { ...financing.benchmark, synthetic: false },
  };
  assert.equal(calculateInterestScenarios(invalidBenchmark).status, "insufficient_synthetic_data");
  const missingPrincipal = {
    ...financing,
    principal: { ...financing.principal, amount: null },
  };
  assert.equal(calculateInterestScenarios(missingPrincipal).status, "insufficient_synthetic_data");
});

test("public Demo uses the same bounded synthetic fuel example and clearly discloses non-live inputs", () => {
  const sampleLease = PUBLIC_DEMO_CONTRACTS.find(item => item.id === lease.contractRouteId);
  assert.ok(sampleLease.clauses.some(item => item.id === lease.fuelPriceAdjustment.clauseId));
  assert.ok(sampleLease.obligations.some(item => item.id === lease.fuelPriceAdjustment.obligationId));
  const html = renderPublicDemo();
  assert.match(html, /Synthetic-only external-risk illustration/);
  assert.match(html, /2,400\.00/);
  assert.match(html, /no EIA or live data is used/);
  assert.match(html, /No customer-specific, live-source, or portfolio-level financial exposure is calculated/);
});

test("synthetic calendar-year projection is period-aligned, deterministic, and evidence-linked", () => {
  const contract = DEMO_CONTRACTS.find(item => item.id === lease.contractRouteId);
  const clause = contract.clauses.find(item => item.id === "cl-utilisation-calendar-year");
  const obligation = contract.obligations.find(item => item.id === lease.calendarYearAllowance.obligation.id);
  const risk = contract.risks.find(item => item.id === "rk-utilisation-calendar-year");
  const projection = calculateAnnualProjection(lease);

  assert.equal(clause.text, lease.calendarYearAllowance.clause.excerpt);
  assert.equal(obligation.clauseId, clause.id);
  assert.equal(risk.clauseId, clause.id);
  assert.equal(projection.status, "synthetic_deterministic_projection");
  assert.equal(projection.classification, "potential_exposure_developing");
  assert.equal(projection.recordedUtilisation, 700);
  assert.equal(projection.annualizedConsumptionRate, 1205.19);
  assert.equal(projection.projectedUtilisationAtPeriodEnd, 1205.19);
  assert.equal(projection.projectedExcessUnits, 205.19);
  assert.equal(projection.horizon.end, "2026-12-31");
  assert.match(projection.assumption, /continues unchanged/);
  assert.ok(projection.supportingEvidenceIds.includes(lease.calendarYearAllowance.clause.id));
  for (const id of projection.supportingEvidenceIds) {
    const source = getDemoEvidence(contract.id, id);
    assert.equal(source.synthetic, true);
    assert.ok(renderEvidence(contract.id, id).includes(id));
  }

  const mismatchedPeriod = {
    ...lease,
    calendarYearAllowance: { ...lease.calendarYearAllowance, measurementPeriod: "per lease year" },
  };
  assert.equal(calculateAnnualProjection(mismatchedPeriod).status, "insufficient_synthetic_data");
  const incompleteHistory = {
    ...lease,
    calendarYearAllowance: {
      ...lease.calendarYearAllowance,
      readings: lease.calendarYearAllowance.readings.filter(reading => reading.periodStart !== "2026-04-01"),
    },
  };
  assert.equal(calculateAnnualProjection(incompleteHistory).status, "insufficient_synthetic_data");

  const html = renderJourney();
  assert.match(html, /Synthetic annual allowance projection/);
  assert.match(html, /potential exposure developing/);
  assert.match(html, /205\.19 flight hours/);
  assert.match(html, /no comparable subsequent synthetic calendar-year outcome/i);
});

test("synthetic projection comparison is provenance-linked and does not imply real-world accuracy", () => {
  const contract = DEMO_CONTRACTS.find(item => item.id === lease.contractRouteId);
  const comparison = compareSyntheticOutcome(lease);
  assert.equal(comparison.status, "synthetic_descriptive_comparison");
  assert.equal(comparison.sampleSizeStatus, "insufficient_sample_size");
  assert.equal(comparison.actualCumulativeValue, lease.syntheticOutcome.cumulativeValue);
  assert.ok(comparison.evidenceIds.includes(lease.syntheticOutcome.evidenceId));
  assert.ok(comparison.absoluteError >= 0);
  assert.match(comparison.disclosure, /not independently verified/i);
  assert.equal(getDemoEvidence(contract.id, lease.syntheticOutcome.evidenceId).synthetic, true);
  assert.equal(getDemoEvidence(contract.id, lease.syntheticOutcome.evidenceId).page, lease.syntheticOutcome.page);
  assert.ok(renderEvidence(contract.id, lease.syntheticOutcome.evidenceId).includes(lease.syntheticOutcome.evidenceId));

  const unavailable = compareSyntheticOutcome({ ...lease, syntheticOutcome: null });
  assert.equal(unavailable.status, "not_available");
  assert.match(unavailable.reason, /missing outcome is treated as zero/i);
  const html = renderJourney();
  assert.match(html, /Synthetic projection versus later outcome example/);
  assert.match(html, /insufficient sample size/);
  assert.match(html, /excluded from real-world evaluation/);
});

test("updated synthetic utilisation observation produces a separate local reassessment", () => {
  const contract = DEMO_CONTRACTS.find(item => item.id === lease.contractRouteId);
  const reassessment = reassessSynthetic(lease);
  assert.equal(reassessment.status, "synthetic_reassessment");
  assert.equal(reassessment.syntheticOnly, true);
  assert.equal(reassessment.persisted, false);
  assert.equal(reassessment.observation.evidenceId, lease.updatedSyntheticObservation.evidenceId);
  assert.notEqual(
    reassessment.updatedProjection.estimatedThresholdDate,
    reassessment.previousProjection.estimatedThresholdDate,
  );
  assert.equal(getDemoEvidence(contract.id, lease.updatedSyntheticObservation.evidenceId).synthetic, true);
  assert.equal(getDemoEvidence(contract.id, lease.updatedSyntheticObservation.evidenceId).page, lease.updatedSyntheticObservation.page);
  const risk = contract.risks.find(item => item.id === "rk-utilisation");
  assert.equal(risk.evidenceIds.includes(lease.updatedSyntheticObservation.evidenceId), false);
  assert.equal(
    reassessSynthetic(lease, { ...lease.updatedSyntheticObservation, periodStart: "2026-10-01" }).status,
    "not_available",
  );
  const html = renderJourney();
  assert.match(html, /Reassess after an updated synthetic observation/);
  assert.match(html, /Reassess using the updated report/);
});

test("Demo FX sensitivity traces one synthetic payment to evidence and keeps assumptions distinct", () => {
  const contract = DEMO_CONTRACTS.find(item => item.id === lease.contractRouteId);
  const clause = contract.clauses.find(item => item.id === lease.fxPayment.clauseId);
  const evidence = getDemoEvidence(contract.id, lease.fxPayment.evidenceId);
  assert.equal(clause.evidenceId, lease.fxPayment.evidenceId);
  assert.equal(clause.text, lease.fxPayment.excerpt);
  assert.equal(evidence.synthetic, true);
  assert.equal(evidence.page, lease.fxPayment.page);
  assert.equal(lease.fxPayment.referenceLabel, "Synthetic illustration only — not sourced from ECB");

  const result = calculateFx({
    paymentAmount: lease.fxPayment.amount,
    referenceQuotePerEur: lease.fxPayment.referenceRate,
    scenarioQuotePerEur: 1.2,
  });

  test("Demo FX early warning compares two synthetic reference inputs without implying a forecast", () => {
    const result = calculateFxMovement({
      paymentAmount: lease.fxPayment.amount,
      paymentDueDate: lease.fxPayment.dueDate,
      referenceObservations: lease.fxPayment.referenceObservations,
    });
    assert.equal(result.status, "synthetic_reference_comparison");
    assert.equal(result.classification, "attention_required");
    assert.equal(result.previousReferenceEquivalent, 1116071.43);
    assert.equal(result.currentReferenceEquivalent, 1136363.64);
    assert.equal(result.referenceEquivalentChange, 20292.21);
    assert.deepEqual(result.supportingEvidenceIds, ["ev-fx-reference-prior", "ev-fx-reference-current"]);
    assert.equal(result.freshnessStatus, "synthetic_current");
    assert.equal(result.ageDays, 3);
    for (const observation of lease.fxPayment.referenceObservations) {
      assert.equal(getDemoEvidence(lease.contractRouteId, observation.evidenceId).synthetic, true);
    }
    assert.equal(calculateFxMovement({
      paymentAmount: lease.fxPayment.amount,
      paymentDueDate: lease.fxPayment.dueDate,
      referenceObservations: lease.fxPayment.referenceObservations.slice(1),
    }).status, "insufficient_synthetic_inputs");
    const stale = calculateFxMovement({
      paymentAmount: lease.fxPayment.amount,
      paymentDueDate: lease.fxPayment.dueDate,
      referenceObservations: lease.fxPayment.referenceObservations,
      asOf: "2026-11-20",
    });
    assert.equal(stale.status, "stale_synthetic_data");
    assert.equal(stale.freshnessStatus, "stale");
    assert.equal(stale.ageDays, 14);

    const html = renderJourney();
    assert.match(html, /Synthetic early warning · attention required/);
    assert.match(html, /ev-fx-reference-prior/);
    assert.match(html, /ev-fx-reference-current/);
    assert.match(html, /not a forecast/);
    assert.match(html, /not sourced from the ECB/);
    assert.match(html, /Reassess synthetic snapshot/);
    assert.match(html, /not provider-verified/);
  });
  assert.equal(result.status, "synthetic_deterministic_sensitivity");
  assert.equal(result.referenceEquivalent, Number((lease.fxPayment.amount / lease.fxPayment.referenceRate).toFixed(2)));
  assert.equal(result.scenarioEquivalent, Number((lease.fxPayment.amount / 1.2).toFixed(2)));
  assert.equal(calculateFx({ paymentAmount: 0, referenceQuotePerEur: 1.1, scenarioQuotePerEur: 1.2 }).status, "insufficient_synthetic_inputs");

  const scenarios = calculateFxScenarios({
    paymentAmount: lease.fxPayment.amount,
    paymentCurrency: lease.fxPayment.currency,
    paymentDueDate: lease.fxPayment.dueDate,
    paymentEvidenceId: lease.fxPayment.evidenceId,
    referenceQuotePerEur: lease.fxPayment.referenceRate,
    referenceRateUnit: lease.fxPayment.referenceRateUnit,
    referenceEvidenceId: "ev-fx-reference-current",
    scenarios: [
      { label: "Moderate adverse", quotePerEur: 1.05 },
      { label: "Severe adverse", quotePerEur: 1.00 },
      { label: "Favourable", quotePerEur: 1.15 },
    ],
  });
  assert.equal(scenarios.status, "synthetic_scenario_comparison");
  assert.equal(scenarios.synthetic, true);
  assert.equal(scenarios.notForecast, true);
  assert.equal(scenarios.comparisons.length, 3);
  assert.ok(scenarios.comparisons[0].signedDifference.amount > 0);
  assert.ok(scenarios.comparisons[2].signedDifference.amount < 0);
  assert.deepEqual(scenarios.comparisons[0].evidenceReferences, ["ev-fx-payment", "ev-fx-reference-current"]);
  assert.equal(scenarios.comparisons[0].recommendation.status, "synthetic_recommendation_only");
  assert.equal(calculateFxScenarios({
    paymentAmount: lease.fxPayment.amount,
    paymentCurrency: lease.fxPayment.currency,
    paymentDueDate: lease.fxPayment.dueDate,
    paymentEvidenceId: lease.fxPayment.evidenceId,
    referenceQuotePerEur: lease.fxPayment.referenceRate,
    referenceRateUnit: lease.fxPayment.referenceRateUnit,
    referenceEvidenceId: "ev-fx-reference-current",
    scenarios: [{ label: "Invalid", quotePerEur: 0 }],
  }).status, "insufficient_synthetic_inputs");

  const html = renderJourney();
  assert.match(html, /Synthetic contract-linked FX sensitivity/);
  assert.match(html, /Synthetic baseline:/);
  assert.match(html, /Moderate adverse · synthetic scenario/);
  assert.match(html, /Severe adverse · synthetic scenario/);
  assert.match(html, /Favourable · synthetic scenario/);
  assert.match(html, /not a forecast/);
  assert.match(html, /not sourced from ECB/);
  assert.match(html, /ev-fx-payment/);
});

test("copied non-lease contracts exclude all lease-journey content", () => {
  for (const contract of DEMO_CONTRACTS.filter(item => item.analysisStatus === "synthetic_template")) {
    assert.equal(contract.synthetic, true);
    assert.equal(contract.analysisStatus, "synthetic_template");
    assert.equal(contract.health, "Not assessed");
    for (const key of ["clauses", "obligations", "deadlines", "risks", "evidence"]) {
      assert.deepEqual(contract[key], [], `${contract.id}: no attributed lease ${key}`);
    }
    for (const key of ["clauses", "obligations", "risks", "evidence"]) {
      assert.equal(contract[key].some(item => item.id.includes("utilisation")), false, `${contract.id}: ${key}`);
    }
    assert.equal(contract.financialImpact, null);
  }
});

test("evidence lookup is strictly contract-scoped, including duplicate source ids and absent inputs", () => {
  const primary = DEMO_CONTRACTS[0];
  const template = DEMO_CONTRACTS.find(item => item.analysisStatus === "synthetic_template");
  const source = primary.evidence[0];
  assert.equal(getDemoEvidence(primary.id, source.id), source);
  for (const contractId of [template.id, "unknown", undefined]) {
    assert.equal(getDemoEvidence(contractId, source.id), undefined);
    assert.equal(renderEvidence(contractId, source.id), "<span></span>");
  }
  assert.equal(getDemoEvidence(primary.id, "unknown"), undefined);
  assert.equal(getDemoEvidence(primary.id), undefined);
  const contractSpecificSource = { ...source, excerpt: "Synthetic evidence belonging only to requested contract" };
  template.evidence.push(contractSpecificSource);
  try {
    assert.equal(getDemoEvidence(template.id, source.id), contractSpecificSource);
    assert.ok(renderEvidence(template.id, source.id).includes(contractSpecificSource.excerpt));
    assert.equal(getDemoEvidence(primary.id, source.id), source);
  } finally {
    template.evidence.pop();
  }
});

test("workspace templates and unknown contracts stay empty without lease provenance", () => {
  for (const contract of DEMO_CONTRACTS.filter(item => item.analysisStatus === "synthetic_template")) {
    for (const section of ["overview", "clauses", "obligations", "deadlines", "risks", "evidence", "financial-impact", "assistant"]) {
      const html = renderWorkspace(contract.id, section);
      assert.match(html, /Synthetic template — contract-type analysis not validated/);
      assert.match(html, /Lease clauses, findings and evidence are not attributed/);
      assert.doesNotMatch(html, /id="contract-investigation"|Aircraft Return Conditions|Clause 22\.4|185,000|120,000/);
    }
    assert.match(renderFinancialEmpty(contract), /Synthetic financial analysis unavailable/);
    assert.doesNotMatch(renderFinancialEmpty(contract), /No quantifiable financial exposure found/);
  }
  assert.match(renderWorkspace("unknown"), /Demo contract unavailable/);
  assert.doesNotMatch(renderWorkspace("unknown"), /Aircraft Lease Agreement/);
  const leaseHtml = renderWorkspace(lease.contractRouteId);
  assert.match(leaseHtml, /id="contract-investigation"/);
  assert.match(leaseHtml, new RegExp('href="/demo/contracts/' + lease.contractRouteId + '/assistant"'));
});

test("shared labels disclose Phase62 exclusions and synthetic uncalibrated values", () => {
  const html = renderLabels();
  for (const text of ["not production Phase 54–62 output", "outcome history", "immutable snapshots", "verified backtests", "calibrated Bayesian/Monte Carlo forecasts", "unavailable and unvalidated", "justified model inputs and verified history are missing", "not measured customer data", "97% synthetic confidence · not calibrated", "Confidence unavailable", "High · illustrative"]) {
    assert.ok(html.includes(text), text);
  }
  const portfolio = renderContracts();
  assert.match(portfolio, /copied non-lease templates/);
  assert.match(portfolio, /not validated contract-type analysis/);
  assert.doesNotMatch(portfolio, />Analysed</);
});

test("shell, financial impact and assistant retain local synthetic disclosures", async () => {
  const read = path => readFile(new URL("../src/" + path, import.meta.url), "utf8");
  const [shell, financial, assistant, dashboard, workspace] = await Promise.all([
    read("components/layout/DemoShell.jsx"),
    read("components/demo/DemoFinancialImpact.jsx"),
    read("components/demo/OperionAssistant.jsx"),
    read("routes/demo/DemoDashboard.jsx"),
    read("routes/demo/DemoWorkspace.jsx"),
  ]);
  assert.match(shell, /<DemoDisclosure \/><Outlet \/>/);
  assert.match(shell, /SYNTHETIC NOTICES/);
  assert.match(shell, /not detected customer events/);
  assert.match(shell, /Synthetic demonstration telemetry/);
  assert.match(shell, /Search synthetic contracts and Demo pages/);
  assert.match(shell, /SYNTHETIC<\/DemoBadge>/);
  assert.match(financial, /Synthetic contractual commitment/);
  assert.match(financial, /Illustrative rent assumption · not measured/);
  assert.match(assistant, /import \{ MattExperience, MattPresenceOnly \}/);
  assert.match(assistant, /useDemoData/);
  assert.match(assistant, /<MattExperience/);
  assert.match(dashboard, /no lease findings or evidence are attributed/);
  assert.match(workspace, /lookupEvidence\(contract\.id, evidenceId\)/);
  assert.match(workspace, /Synthetic evidence unavailable/);
});

test("deterministic synthetic calculation uses cumulative differences, not a sum", () => {
  const estimate = calculate();
  assert.equal(estimate.recordedUtilisation, 4300);
  assert.equal(estimate.remainingHeadroom, 700);
  assert.equal(estimate.consumedPercent, 86);
  assert.equal(estimate.averageDailyRate, 6.5574);
  assert.equal(estimate.horizonDays, 107);
  assert.equal(estimate.projectedThresholdDate, "2027-02-15");
  assert.equal(estimate.earlyWarning.classification, "approaching_limit_review");
  assert.equal(estimate.latestObservedChange.observedDifference, 200);
  assert.equal(estimate.latestObservedChange.from.evidenceId, "ev-utilisation-sep");
  assert.equal(estimate.latestObservedChange.to.evidenceId, "ev-utilisation-oct");
  assert.match(estimate.recommendation.action, /monthly utilization report/i);
  assert.match(estimate.recommendation.action, /lessor early/i);
  assert.deepEqual(estimate.recommendation.supportingEvidenceIds, [
    lease.clause.id,
    lease.readings.at(-1).evidenceId,
  ]);
  assert.equal(calculate({ ...lease, readings: lease.readings.slice(0, 2) }).status, "insufficient_synthetic_data");
});

test("rendered journey is labelled, source-linked, navigable and explicitly synthetic", () => {
  const html = renderJourney();
  assert.match(html, /aria-labelledby="synthetic-journey-title"/);
  assert.match(html, /id="synthetic-journey-title"/);
  assert.match(html, /aria-describedby="synthetic-journey-disclosure"/);
  for (const source of [lease.clause, ...lease.readings]) {
    assert.ok(html.includes(source.evidenceId ?? source.id));
    assert.ok(html.includes(`p. ${source.page}`));
  }
  for (const section of ["evidence", "obligations", "financial-impact"]) {
    assert.ok(html.includes(`href="/demo/contracts/${lease.contractRouteId}/${section}"`));
  }
  for (const disclosure of ["Every clause, report, reading, date, limit, exposure, estimate and outcome example", "production APIs", "external observations", "persisted forecast snapshots", "verified outcomes", "backtesting", "not a display of production Phase 54", "not a forecast of breach or a probability", "not a monetary loss", "Evidence status: synthetic sources are treated as verified only within this example", "Recommended mitigation", "not legal advice"]) {
    assert.ok(html.includes(disclosure), disclosure);
  }
  assert.ok(html.includes(lease.clause.id));
  assert.ok(html.includes(lease.readings.at(-1).evidenceId));
  assert.ok(html.includes("2027-02-15"));
  assert.ok(html.includes("not monthly increments"));
});
