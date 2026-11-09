import React, { useState } from "react";
import { Link } from "react-router-dom";
import { BrainCircuit, CalendarClock, FileCheck2, ListChecks, Scale, ShieldAlert } from "lucide-react";
import { useDemoData } from "../../demo/DemoDataProvider";
import { DemoBadge, GlassCard, MetricCard, PageHeader, RiskBadge } from "../../demo/DemoUI";
import { SYNTHETIC_INDEXATION, calculateSyntheticIndexation } from "../../demo/indexationJourney";
import {
  SYNTHETIC_AIRCRAFT_LEASE,
  calculateSyntheticFxScenarioComparisons,
  calculateSyntheticFxReferenceMovement,
  calculateSyntheticUtilisationJourney,
  calculateSyntheticOutcomeComparison,
  reassessSyntheticUtilisation,
  calculateSyntheticCalendarYearProjection,
  calculateSyntheticFuelPriceAdjustment,
  calculateSyntheticInterestRateScenarios,
} from "../../demo/aviationIntelligenceJourney";

function SyntheticIndexationJourney() {
  const [indexValue, setIndexValue] = useState("330");
  const baseline = calculateSyntheticIndexation();
  const scenario = calculateSyntheticIndexation(indexValue.trim() ? Number(indexValue) : NaN);
  return <GlassCard title="Synthetic aviation MRO indexation" eyebrow="Contractual formula, not headline inflation">
    <p>{SYNTHETIC_INDEXATION.disclosure}</p>
    <blockquote>{SYNTHETIC_INDEXATION.excerpt}</blockquote>
    <p>Synthetic reviewed publication: September 2026 index 315; illustrative publication {SYNTHETIC_INDEXATION.observation.publicationTimestamp}. Contract version {SYNTHETIC_INDEXATION.documentVersionId}.</p>
    <p>Baseline USD 100,000 per year. Index change: 315 / 300 − 1 = 5%; indexed share 80% → 4%; contractual cap → 3%. Revised annual price USD 103,000; incremental price USD 3,000. Notice review: 2026-12-02; adjustment: 2027-01-01.</p>
    <label htmlFor="synthetic-indexation-level">Synthetic alternative index level, not a forecast
      <input id="synthetic-indexation-level" type="number" min="0.000001" max="1000000" step="any" value={indexValue} onChange={(event) => setIndexValue(event.target.value)} />
    </label>
    <p aria-live="polite">{scenario.calculation
      ? `Assumed index ${indexValue}: USD ${scenario.calculation.revisedPrice.toLocaleString("en-US")} per year; difference from synthetic reviewed baseline USD ${(scenario.calculation.revisedPrice - baseline.calculation.revisedPrice).toLocaleString("en-US")}; contractual adjustment ${scenario.calculation.adjustmentPercent}%.`
      : `No comparison: ${scenario.missingInputs.join("; ")}.`}</p>
    <p>Method {baseline.calculation.methodology}. The formula is shared with production calculations; synthetic evidence is never stored as a real publication or used for calibration.</p>
    <p>Advisory action: check exact index identity and base, reference months, capped share and notice compliance. Downstream recoverability is not established.</p>
    <Link to={`/demo/contracts/${SYNTHETIC_INDEXATION.contractRouteId}/clauses`}>Open synthetic indexation clause</Link>{" · "}
    <Link to={`/demo/contracts/${SYNTHETIC_INDEXATION.contractRouteId}/evidence`}>Review synthetic publication and contract evidence</Link>{" · "}
    <Link to={`/demo/contracts/${SYNTHETIC_INDEXATION.contractRouteId}/financial-impact`}>Review synthetic financial impact</Link>
  </GlassCard>;
}

function SyntheticLeaseJourney() {
  const lease = SYNTHETIC_AIRCRAFT_LEASE;
  const estimate = calculateSyntheticUtilisationJourney(lease);
  const outcomeComparison = calculateSyntheticOutcomeComparison(lease);
  const annualProjection = calculateSyntheticCalendarYearProjection(lease);
  const fuelAdjustment = calculateSyntheticFuelPriceAdjustment(lease);
  const financing = lease.aircraftFinancing;
  const interestScenarioComparison = calculateSyntheticInterestRateScenarios(financing);
  const [fxScenarioRates, setFxScenarioRates] = useState([
    { label: "Moderate adverse", quotePerEur: "1.05" },
    { label: "Severe adverse", quotePerEur: "1.00" },
    { label: "Favourable", quotePerEur: "1.15" },
  ]);
  const [syntheticAssessmentAt, setSyntheticAssessmentAt] = useState(null);
  const [syntheticUtilisationReassessment, setSyntheticUtilisationReassessment] = useState(null);
  const fxPayment = lease.fxPayment;
  const fxScenarioComparisons = calculateSyntheticFxScenarioComparisons({
    paymentAmount: fxPayment.amount,
    paymentCurrency: fxPayment.currency,
    paymentDueDate: fxPayment.dueDate,
    paymentEvidenceId: fxPayment.evidenceId,
    referenceQuotePerEur: fxPayment.referenceRate,
    referenceRateUnit: fxPayment.referenceRateUnit,
    referenceEvidenceId: "ev-fx-reference-current",
    scenarios: fxScenarioRates.map((scenario) => ({
      ...scenario,
      quotePerEur: scenario.quotePerEur.trim() ? Number(scenario.quotePerEur) : NaN,
    })),
  });
  const fxMovement = calculateSyntheticFxReferenceMovement({
    paymentAmount: fxPayment.amount,
    paymentDueDate: fxPayment.dueDate,
    referenceObservations: fxPayment.referenceObservations,
  });
  const contractPath = `/demo/contracts/${lease.contractRouteId}`;
  const evidencePath = `${contractPath}/evidence`;
  const hours = value => value.toLocaleString("en-GB");
  const euro = value => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  const elapsedDays = (Date.parse(lease.readings.at(-1).periodEnd) - Date.parse(lease.readings[0].periodEnd)) / 86_400_000;
  return <section className="od-lease-journey" aria-labelledby="synthetic-journey-title" aria-describedby="synthetic-journey-disclosure">
    <GlassCard title="Synthetic lease intelligence journey" eyebrow="Synthetic demonstration only">
      <h2 id="synthetic-journey-title">Lease clause → utilisation → exposure → qualified deterministic estimate</h2>
      <p id="synthetic-journey-disclosure">Every clause, report, reading, date, limit, exposure, estimate and outcome example in this panel is synthetic, not customer data. Demo does not connect to production APIs, external observations, persisted forecast snapshots, independently verified outcomes, or backtesting. This is not a display of production Phase 54–62 outputs. Synthetic comparisons are illustrations only and are excluded from real-world evaluation. Calibrated Bayesian/Monte Carlo forecasts are not available.</p>
      <p>Evidence status: synthetic sources are treated as verified only within this example; no customer evidence, reviewer action, or production verification is represented.</p>
      <ol className="od-lease-journey-steps">
        <li>
          <h3>Synthetic lease clause</h3>
          <p>Synthetic {lease.contractId} · {lease.aircraft} · clause {lease.clause.number}</p>
          <blockquote>{lease.clause.excerpt}</blockquote>
          <Link to={evidencePath}>Synthetic source: {lease.clause.id} · p. {lease.clause.page}</Link>
          <p><Link to={`${contractPath}/obligations`}>Review synthetic obligation {lease.obligation.id}</Link></p>
        </li>
        <li>
          <h3>Synthetic cumulative utilisation</h3>
          <ul>{lease.readings.map(reading => <li key={reading.evidenceId}>
            <p>Synthetic {reading.periodStart} – {reading.periodEnd}: <strong>{hours(reading.cumulativeValue)} cumulative flight hours</strong></p>
            <Link to={evidencePath}>Synthetic source: {reading.evidenceId} · p. {reading.page}</Link>
          </li>)}</ul>
          <p>These are cumulative readings, not monthly increments; do not sum them.</p>
        </li>
        <li>
          <h3>Synthetic allowance exposure</h3>
          {estimate.status === "synthetic_deterministic_estimate" && <p>Synthetic {hours(estimate.recordedUtilisation)} / {hours(estimate.contractualLimit)} flight hours consumed ({estimate.consumedPercent}%); synthetic remaining headroom: <strong>{hours(estimate.remainingHeadroom)} flight hours</strong>.</p>}
          {estimate.status === "synthetic_deterministic_estimate" && <>
            <p><strong>Synthetic early warning · {estimate.earlyWarning.classification.replaceAll("_", " ")}:</strong> {estimate.earlyWarning.basis}</p>
            <p>Observed cumulative change only: {hours(estimate.latestObservedChange.from.cumulativeUtilisation)} flight hours on {estimate.latestObservedChange.from.observationDate} to {hours(estimate.latestObservedChange.to.cumulativeUtilisation)} on {estimate.latestObservedChange.to.observationDate}, a recorded difference of {hours(estimate.latestObservedChange.observedDifference)} flight hours.</p>
            <p>Sources: <Link to={evidencePath}>{estimate.latestObservedChange.from.evidenceId}</Link> · <Link to={evidencePath}>{estimate.latestObservedChange.to.evidenceId}</Link>. This observed difference is not a projected utilization rate.</p>
          </>}
          <p>Headroom is an operational comparison, not a monetary loss or an established breach. The synthetic clause provides no price per excess hour, notice trigger, maintenance adjustment, or redelivery consequence; no financial amount or contractual consequence is inferred. This is not legal advice.</p>
          {estimate.status === "synthetic_deterministic_estimate" && <div>
            <p><strong>Recommended mitigation · {estimate.recommendation.priority.replaceAll("_", " ")}:</strong> {estimate.recommendation.action}</p>
            <p>Basis: the cited monthly-report obligation and latest synthetic utilisation evidence.</p>
            <Link to={evidencePath}>Sources: {estimate.recommendation.supportingEvidenceIds.join(" · ")}</Link>
          </div>}
          <Link to={`${contractPath}/financial-impact`}>Review separate synthetic financial-impact assumptions</Link>
        </li>
        <li>
          <h3>Synthetic qualified deterministic estimate</h3>
          {estimate.status === "synthetic_deterministic_estimate" ? <>
            <p>Synthetic average: ({hours(estimate.recordedUtilisation)} − {hours(lease.readings[0].cumulativeValue)}) / {elapsedDays} calendar days ≈ {estimate.averageDailyRate} flight hours/day.</p>
            <p>Synthetic threshold estimate: <strong>{estimate.projectedThresholdDate}</strong> ({estimate.horizonDays} days after synthetic {estimate.coveredThrough}). Synthetic horizon = ceiling of remaining headroom / unrounded average daily rate.</p>
            <p>{estimate.assumption} No seasonality, operational change or uncertainty model is applied. This synthetic outcome example is separate from production outcome history and does not backtest or validate a production forecast.</p>
          </> : <p>{estimate.reason} No synthetic estimate is available.</p>}
          <Link to={evidencePath}>Review all synthetic calculation sources and page references</Link>
          <section aria-labelledby="synthetic-projection-outcome-comparison">
            <h4 id="synthetic-projection-outcome-comparison">Synthetic projection versus later outcome example</h4>
            {outcomeComparison.status === "synthetic_descriptive_comparison" ? <>
              <p>For synthetic {outcomeComparison.period.start} to {outcomeComparison.period.end}, projected cumulative utilisation was {hours(outcomeComparison.projectedCumulativeValue)} versus a synthetic later outcome example of {hours(outcomeComparison.actualCumulativeValue)} {outcomeComparison.unit.replaceAll("_", " ")}. Signed error (projected minus outcome): {outcomeComparison.signedError} {outcomeComparison.unit.replaceAll("_", " ")}; absolute error: {outcomeComparison.absoluteError} {outcomeComparison.unit.replaceAll("_", " ")}{outcomeComparison.percentageError === null ? "" : ` (${outcomeComparison.percentageError}% absolute percentage error)`}.</p>
              <p>Sample status: {outcomeComparison.sampleSizeStatus.replaceAll("_", " ")}. {outcomeComparison.disclosure}</p>
              <p>Calculation uses snapshot methodology {outcomeComparison.methodology}, created {new Date(outcomeComparison.forecastGeneratedAt).toLocaleDateString("en-GB")}, and {outcomeComparison.daysFromLastObservation} calendar days from the last synthetic observation.</p>
              <Link to={evidencePath}>Synthetic provenance: {outcomeComparison.evidenceIds.join(" · ")}</Link>
            </> : <p>{outcomeComparison.reason} A missing value is not a zero outcome and cannot support an accuracy conclusion.</p>}
          </section>
          <section aria-labelledby="synthetic-utilisation-reassessment">
            <h4 id="synthetic-utilisation-reassessment">Reassess after an updated synthetic observation</h4>
            <p>A separate later synthetic report is available to demonstrate an on-demand reassessment; it is not included in the original snapshot or evidence history.</p>
            <Link to={evidencePath}>Updated synthetic source: {lease.updatedSyntheticObservation.evidenceId} · p. {lease.updatedSyntheticObservation.page}</Link>
            <button type="button" className="op-btn op-btn-quiet" onClick={() => setSyntheticUtilisationReassessment(reassessSyntheticUtilisation(lease))}>
              Reassess using the updated report
            </button>
            {syntheticUtilisationReassessment?.status === "synthetic_reassessment" && <>
              <p role="status">Reassessed locally as of {syntheticUtilisationReassessment.assessedAsOf} using {syntheticUtilisationReassessment.observation.cumulativeValue.toLocaleString("en-GB")} {syntheticUtilisationReassessment.observation.unit.replaceAll("_", " ")} from {syntheticUtilisationReassessment.observation.periodStart} to {syntheticUtilisationReassessment.observation.periodEnd}.</p>
              <p>Original projection: {syntheticUtilisationReassessment.previousProjection.recordedUtilisation.toLocaleString("en-GB")} recorded hours → estimated threshold {syntheticUtilisationReassessment.previousProjection.estimatedThresholdDate}. Updated projection: {syntheticUtilisationReassessment.updatedProjection.recordedUtilisation.toLocaleString("en-GB")} recorded hours, {syntheticUtilisationReassessment.updatedProjection.remainingHeadroom.toLocaleString("en-GB")} hours of headroom → estimated threshold {syntheticUtilisationReassessment.updatedProjection.estimatedThresholdDate} at {syntheticUtilisationReassessment.updatedProjection.averageDailyRate} hours/day.</p>
              <p>{syntheticUtilisationReassessment.disclosure} The saved original forecast is unchanged.</p>
            </>}
            {syntheticUtilisationReassessment?.status === "not_available" && <p role="status">{syntheticUtilisationReassessment.reason}</p>}
          </section>
        </li>
      </ol>
      <section aria-labelledby="synthetic-calendar-year-projection">
        <h3 id="synthetic-calendar-year-projection">Synthetic annual allowance projection</h3>
        <p>Separate synthetic clause {lease.calendarYearAllowance.clause.number}: “{lease.calendarYearAllowance.clause.excerpt}”</p>
        <Link to={evidencePath}>Synthetic contractual source: {lease.calendarYearAllowance.clause.id} · p. {lease.calendarYearAllowance.clause.page}</Link>
        <p><Link to={`${contractPath}/obligations`}>Synthetic obligation: {lease.calendarYearAllowance.obligation.title}</Link></p>
        {annualProjection.status === "synthetic_deterministic_projection" ? <>
          <p>Verified synthetic calendar-year history: {annualProjection.coverage.from} to {annualProjection.coverage.through} ({annualProjection.coverage.observationCount} cumulative readings). Latest recorded: {hours(annualProjection.recordedUtilisation)} / {hours(annualProjection.contractualLimit)} flight hours.</p>
          <p>Deterministic annualized consumption rate: {annualProjection.annualizedConsumptionRate.toLocaleString("en-GB", { maximumFractionDigits: 2 })} flight hours/year. Projected at {annualProjection.horizon.end}: <strong>{annualProjection.projectedUtilisationAtPeriodEnd.toLocaleString("en-GB", { maximumFractionDigits: 2 })}</strong> / {hours(annualProjection.contractualLimit)} flight hours ({annualProjection.classification.replaceAll("_", " ")}). Indicative projected difference: {annualProjection.projectedExcessUnits.toLocaleString("en-GB", { maximumFractionDigits: 2 })} flight hours; no monetary penalty is established.</p>
          <p>Methodology {annualProjection.methodologyVersion}: current calendar-year cumulative hours / elapsed calendar days × 365, then projected through the calendar-year end at the same daily rate. {annualProjection.assumption}</p>
          <p>{annualProjection.limitation} No seasonality, revised flight plan, or operational disruption is modeled.</p>
          <p>Outcome comparison: not available for this separate calendar-year projection. No comparable subsequent synthetic calendar-year outcome is provided, so no accuracy or calibration conclusion is possible.</p>
          <p><strong>Recommended mitigation:</strong> review the remaining calendar-year flight plan against the cited allowance, obtain the next period-matched report, and review applicable excess-use terms with the lease owner before discussing options with the lessor.</p>
          <p>Sources: <Link to={evidencePath}>{annualProjection.supportingEvidenceIds.join(" · ")}</Link></p>
        </> : <p>{annualProjection.reason} No projection is presented.</p>}
      </section>
      <section aria-labelledby="synthetic-fuel-price-exposure">
        <h3 id="synthetic-fuel-price-exposure">Synthetic contract-linked fuel-price exposure</h3>
        <p>Synthetic {lease.contractId} · weekly fuel-price adjustment · clause {lease.fuelPriceAdjustment.clauseNumber}</p>
        <blockquote>{lease.fuelPriceAdjustment.excerpt}</blockquote>
        <Link to={evidencePath}>Synthetic clause source: {lease.fuelPriceAdjustment.evidenceId} · p. {lease.fuelPriceAdjustment.page}</Link>
        <p><Link to={`${contractPath}/obligations`}>Synthetic obligation: review and pay the stated weekly adjustment</Link></p>
        <p><strong>Synthetic benchmark illustration:</strong> {lease.fuelPriceAdjustment.observation.value} {lease.fuelPriceAdjustment.observation.unit} on {lease.fuelPriceAdjustment.observation.observationDate} for {lease.fuelPriceAdjustment.observation.market}. {lease.fuelPriceAdjustment.observation.source}. No live EIA value is used.</p>
        {fuelAdjustment.status === "synthetic_calculated" ? <>
          <p>Explicit synthetic inputs: baseline {fuelAdjustment.baselinePrice.amount.toFixed(2)} {fuelAdjustment.baselinePrice.unit}; {fuelAdjustment.volume.amount.toLocaleString("en-GB")} {fuelAdjustment.volume.unit}; pass-through {fuelAdjustment.passThroughPercent}%; paying party {fuelAdjustment.payingParty}.</p>
          <p>Deterministic one-week calculation: {fuelAdjustment.formula} = <strong>{new Intl.NumberFormat("en-GB", { style: "currency", currency: fuelAdjustment.adjustment.currency, minimumFractionDigits: 2 }).format(fuelAdjustment.adjustment.amount)}</strong>.</p>
          <p>{fuelAdjustment.disclosure} No annualization, additional operating volume, taxes, delivery differential, FX conversion, recovery, or invoice settlement is inferred.</p>
          <p><strong>Recommended mitigation:</strong> {lease.fuelPriceAdjustment.payingParty} should reconcile the clause, matching benchmark period, covered gallons, and supplier invoice before settlement. This is a review prompt, not legal or financial advice.</p>
          {fuelAdjustment.limitations.map(limitation => <p key={limitation}>{limitation}</p>)}
          <p>Evidence provenance: <Link to={evidencePath}>{fuelAdjustment.evidenceIds.join(" · ")}</Link></p>
          <p><Link to={`${contractPath}/risks`}>Review the linked synthetic risk</Link> · <Link to={`${contractPath}/financial-impact`}>Review this separate USD illustration</Link>.</p>
        </> : <p role="status">{fuelAdjustment.reason} Missing: {fuelAdjustment.missingInputs.join("; ")}</p>}
      </section>
      <section aria-labelledby="synthetic-interest-rate-exposure">
        <h3 id="synthetic-interest-rate-exposure">Synthetic aircraft financing rate exposure</h3>
        <p>Synthetic contract {financing.contractId} · {financing.contractTitle} · clause {financing.clause.number}</p>
        <blockquote>{financing.clause.excerpt}</blockquote>
        <p>
          <Link to={`/demo/contracts/${financing.contractRouteId}/clauses`}>Open the synthetic financing clause and workspace</Link>
          {" · "}
          <Link to={`/demo/contracts/${financing.contractRouteId}/obligations`}>Review the linked financing obligation</Link>
          {" · "}
          <Link to={`/demo/contracts/${financing.contractRouteId}/evidence`}>Inspect financing evidence</Link>
        </p>
        {interestScenarioComparison.status === "synthetic_calculated" ? <>
          <p>
            <strong>Synthetic contractual facts:</strong> outstanding principal {financing.principal.currency} {financing.principal.amount.toLocaleString("en-US")} as of {financing.principal.asOf}; SOFR {financing.benchmark.value}% per annum as of {financing.benchmark.observationDate}; spread {financing.spreadBasisPoints} basis points; {financing.resetFrequency} reset; floor {financing.floorRatePercent}% and cap {financing.capRatePercent}%.
          </p>
          <p><strong>Synthetic benchmark provenance:</strong> {financing.benchmark.source}. No live New York Fed observation is used.</p>
          <p>
            Baseline simple annualized balance run-rate: {interestScenarioComparison.baseline.applicableRatePercent}% all-in = {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(interestScenarioComparison.baseline.annualizedInterestExpense.amount)} per year.
          </p>
          <ul>
            {interestScenarioComparison.scenarios.map((scenario) => scenario.status === "synthetic_calculated" ? (
              <li key={scenario.label}>
                <strong>{scenario.label}:</strong> assumed SOFR {scenario.assumedBenchmarkPercent}% → {scenario.applicableRatePercent}% all-in after the contractual floor/cap → {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(scenario.annualizedInterestExpense.amount)} per year; annualized difference {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(scenario.annualizedDifference.amount)}.
              </li>
            ) : <li key={scenario.label}>{scenario.label}: {scenario.reason}</li>)}
          </ul>
          <p>{interestScenarioComparison.disclosure}</p>
          <p><strong>Recommended commercial review:</strong> {interestScenarioComparison.recommendation.action}</p>
          <p>Evidence: <Link to={`/demo/contracts/${financing.contractRouteId}/evidence`}>{interestScenarioComparison.evidenceIds.join(" · ")}</Link></p>
          {interestScenarioComparison.limitations.map((limitation) => <p key={limitation}>{limitation}</p>)}
        </> : <p>{interestScenarioComparison.reason} No synthetic interest amount is inferred.</p>}
      </section>
      <section aria-labelledby="synthetic-fx-title">
        <h3 id="synthetic-fx-title">Synthetic contract-linked FX sensitivity</h3>
        <p>Synthetic {lease.contractId} · maintenance reserve · clause {fxPayment.clauseNumber}</p>
        <blockquote>{fxPayment.excerpt}</blockquote>
        <Link to={evidencePath}>Synthetic clause evidence: {fxPayment.evidenceId} · p. {fxPayment.page}</Link>
        <p><Link to={`${contractPath}/obligations`}>Synthetic payment obligation: {fxPayment.obligation.title}</Link></p>
        <p>Contractual fact: {fxPayment.amount.toLocaleString("en-GB")} {fxPayment.currency}, due {fxPayment.dueDate}. This is one cited payment; no recurring or annual amount is inferred.</p>
        <p>{fxPayment.referenceLabel}: {fxPayment.referenceRate} {fxPayment.referenceRateUnit}. No external provider is queried.</p>
        {fxMovement.status === "synthetic_reference_comparison" && <>
          <p><strong>Synthetic early warning · {fxMovement.classification.replaceAll("_", " ")}:</strong> two dated synthetic reference inputs changed the one-payment EUR reference equivalent by {euro(fxMovement.referenceEquivalentChange)} ({fxMovement.referenceEquivalentChangePercent}%). The latest dated input is {fxMovement.ageDays} day(s) old as of 2026-11-09; this freshness label is illustrative and not provider-verified.</p>
          <p>Synthetic prior {fxMovement.previousObservation.observationDate}: {fxMovement.previousObservation.quotePerEur} {fxPayment.referenceRateUnit} · <Link to={evidencePath}>{fxMovement.previousObservation.evidenceId}</Link>.</p>
          <p>Synthetic current {fxMovement.currentObservation.observationDate}: {fxMovement.currentObservation.quotePerEur} {fxPayment.referenceRateUnit} · <Link to={evidencePath}>{fxMovement.currentObservation.evidenceId}</Link>.</p>
          <p>Reference equivalents: {euro(fxMovement.previousReferenceEquivalent)} → {euro(fxMovement.currentReferenceEquivalent)}. This deterministic comparison is informational, not actual settlement, incurred loss, or a forecast.</p>
          <p>Recommended mitigation: {fxMovement.recommendation}</p>
          {fxMovement.limitations.map(limitation => <p key={limitation}>{limitation}</p>)}
        </>}
        {fxMovement.status === "stale_synthetic_data" && <p role="status">{fxMovement.reason} No movement warning or sensitivity comparison is presented.</p>}
        <button type="button" onClick={() => setSyntheticAssessmentAt(new Date().toISOString())}>Reassess synthetic snapshot</button>
        {syntheticAssessmentAt && <p role="status">Synthetic evidence reassessed locally at {syntheticAssessmentAt}. This recalculates the fixed synthetic inputs only; no external source is fetched.</p>}
        <p>Synthetic baseline: {fxPayment.referenceRate} {fxPayment.referenceRateUnit} → {euro(fxPayment.amount / fxPayment.referenceRate)} reference equivalent. Compare up to three explicit assumptions; no probability or future rate is implied.</p>
        {fxScenarioRates.map((scenario, index) => (
          <label key={scenario.label} htmlFor={`synthetic-fx-scenario-rate-${index}`}>
            Synthetic {scenario.label} assumption ({fxPayment.referenceRateUnit})
            <input
              id={`synthetic-fx-scenario-rate-${index}`}
              type="number"
              min="0.00000001"
              max="1000000"
              step="any"
              value={scenario.quotePerEur}
              onChange={(event) => setFxScenarioRates((current) => current.map((entry, entryIndex) => (
                entryIndex === index ? { ...entry, quotePerEur: event.target.value } : entry
              )))}
            />
          </label>
        ))}
        {fxScenarioComparisons.status === "synthetic_scenario_comparison" ? (
          <div aria-live="polite">
            {fxScenarioComparisons.comparisons.map((scenario) => (
              <article key={scenario.scenarioId}>
                <h4>{scenario.label} · synthetic scenario</h4>
                <p>Hypothetical assumption: {scenario.assumption.quotePerEur} {scenario.assumption.unit}; synthetic reference: {scenario.baselineObservation.value} {scenario.baselineObservation.unit} ({scenario.baselineObservation.evidenceId}).</p>
                <p>Baseline reference equivalent: {euro(scenario.baselineResult.amount)} → scenario equivalent: {euro(scenario.scenarioResult.amount)}.</p>
                <p>Difference: {euro(scenario.signedDifference.amount)} ({scenario.percentageDifference}%). {scenario.contractualImpactExplanation}</p>
                <p>Payment clause {fxPayment.clauseNumber}, obligation: {fxPayment.obligation.title}. Contract evidence: <Link to={evidencePath}>{fxPayment.evidenceId}</Link>.</p>
                <p><strong>Synthetic recommendation only:</strong> {scenario.recommendation.action}</p>
                <p>Scenario ID: {scenario.scenarioId} · {scenario.methodology}. Not a forecast, actual exposure, or customer data.</p>
              </article>
            ))}
          </div>
        ) : <p role="status">No comparison shown: enter positive synthetic rates for all scenarios.</p>}
        <p>The alternative rates are synthetic assumptions, not forecasts. EUR equivalents use a synthetic illustrative reference only; they are not actual settlement values, the organization's reporting currency, or a quantified loss. Review payment currency and hedge context with treasury.</p>
      </section>
      <p>Live external source integrations remain disconnected in Demo: {lease.externalSources.map(source => `${source.name} — ${source.provider}`).join("; ")}. The FX sensitivity above uses only synthetic inputs.</p>
    </GlassCard>
  </section>;
}

export default function DemoIntelligence() {
  const { contracts, budget, primaryContract } = useDemoData();
  const totals = contracts.reduce((sum,contract)=>({clauses:sum.clauses+contract.clauses.length,obligations:sum.obligations+contract.obligations.length,deadlines:sum.deadlines+contract.deadlines.length,risks:sum.risks+contract.risks.length,evidence:sum.evidence+contract.evidence.length}),{clauses:0,obligations:0,deadlines:0,risks:0,evidence:0});
  const categories = [
    [Scale,"Clause Intelligence",totals.clauses,"Structure, categories, source text, and confidence","clauses"],
    [ListChecks,"Obligation Intelligence",totals.obligations,"Actors, actions, objects, modality, timing, and conditions","obligations"],
    [CalendarClock,"Deadline Intelligence",totals.deadlines,"Absolute, relative, recurring, event-based, and ambiguous timing","deadlines"],
    [ShieldAlert,"Risk Intelligence",totals.risks,"Evidence-linked contractual risk without predictive claims","risks"],
    [FileCheck2,"Evidence",totals.evidence,"Auditable excerpts, source locators, and document context","evidence"],
  ];
  return <>
    <PageHeader eyebrow="Intelligence / prepared portfolio" title="What Operion understands" description="Aviation Contract Intelligence grounded in clauses, obligations, deadlines, risks, and evidence." actions={<DemoBadge>DEMO DATA</DemoBadge>} />
    <SyntheticLeaseJourney />
    <SyntheticIndexationJourney />
    <div className="od-metric-grid od-metric-grid-five">{categories.map(([Icon,title,value,,section],index)=><MetricCard key={title} icon={Icon} label={title.replace(" Intelligence","")} value={value} note="Prepared findings" tone={["purple","blue","green","amber","blue"][index]}/>)}</div>
    <div className="od-intelligence-layout"><div className="od-intelligence-categories">{categories.map(([Icon,title,value,copy,section])=><Link key={title} to={`/demo/contracts/${primaryContract.id}/${section}`}><span><Icon size={22}/></span><div><small>Available intelligence</small><h2>{title}</h2><p>{copy}</p></div><strong>{value}</strong></Link>)}</div><aside><GlassCard title="Risk priorities" eyebrow="Prepared contract portfolio"><div className="od-risk-priorities">{primaryContract.risks.map(risk=><Link key={risk.id} to={`/demo/contracts/${primaryContract.id}/risks`}><div><strong>{risk.title}</strong><small>{risk.category}</small></div><RiskBadge severity={risk.severity}/></Link>)}</div></GlassCard><GlassCard title="AI Intelligence Budget" eyebrow="Synthetic demonstration" className="od-intelligence-budget"><BrainCircuit size={25}/><strong>{budget.remaining.toLocaleString()}</strong><span>Prepared units remaining</span><div><i style={{width:`${Math.round(budget.used/budget.allocated*100)}%`}}/></div><p>Production budget enforcement remains server-authoritative. These values demonstrate the interface only.</p></GlassCard></aside></div>
    <div className="od-honesty-note"><strong>No production predictive intelligence is shown</strong><p>The synthetic journey above is a qualified deterministic illustration only. Live fuel, interest-rate, weather, scenario, and digital-twin capabilities are excluded from this environment.</p></div>
  </>;
}
