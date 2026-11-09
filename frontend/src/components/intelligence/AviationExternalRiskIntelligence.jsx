import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  calculateAviationInterestRateScenarios,
  calculateAviationIndexationScenarios,
  calculateAviationFxReferenceSensitivity,
  getAviationExternalRiskIntelligence,
  refreshAviationExternalObservations,
} from "../../lib/contractsApi";
import { useOrganization } from "../../context/OrganizationContext";
import { ORGANIZATION_PERMISSIONS } from "../../lib/permissions";
import AviationPredictiveContractRisk from "./AviationPredictiveContractRisk";
import ContractualExposureAssessment from "./ContractualExposureAssessment";

function workspacePath(item) {
  const query = item.analysisRunId ? `?analysisRunId=${encodeURIComponent(item.analysisRunId)}` : "";
  const clause = item.clauseId ? `#clause-${encodeURIComponent(item.clauseId)}` : "#clauses";
  return `/app/contracts/${encodeURIComponent(item.contractId)}${query}${clause}`;
}

function observationText(observation) {
  if (!observation) return "No verified observation stored";
  const date = observation.observationDate || "date unavailable";
  const freshness = observation.freshnessStatus === "stale" ? "STALE — not current" : "verified observation";
  const update = observation.updateStatus === "revision" ? " · source revision retained" : "";
  const retrieved = observation.retrievalTimestamp ? ` · retrieved ${observation.retrievalTimestamp}` : "";
  const sourceType = observation.sourceType ? `${observation.sourceType.replaceAll("_", " ")} · ` : "";
  const scope = observation.geographicScope ? ` · scope: ${observation.geographicScope}` : "";
  return `${freshness}: ${observation.value} ${observation.unit} · observed ${date} · ${sourceType}${observation.sourceName}${scope}${retrieved}${update}`;
}

function formatEuro(amount) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function FxReferenceSensitivity({ organizationId, item }) {
  const [scenarios, setScenarios] = useState([{ id: 1, label: "Scenario 1", rate: "" }]);
  const [scenarioSequence, setScenarioSequence] = useState(1);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const payment = item.contractualPayment;
  const usable = item.status === "verified_contractual_relationship"
    && item.mechanism === "explicit_foreign_currency_payment"
    && Number.isFinite(payment?.amount)
    && payment.amount > 0
    && payment.dueDate
    && item.evidence?.reviewStatus === "verified"
    && item.observation?.freshnessStatus === "current";

  async function submit(event) {
    event.preventDefault();
    setError("");
    setResults(null);
    const scenarioInputs = scenarios.map(({ label, rate }) => ({
      label: label.trim(),
      scenarioQuotePerEur: rate.trim() ? Number(rate) : NaN,
    }));
    if (scenarioInputs.some(({ label, scenarioQuotePerEur }) => (
      !label
      || label.length > 80
      || !Number.isFinite(scenarioQuotePerEur)
      || scenarioQuotePerEur <= 0
      || scenarioQuotePerEur > 1_000_000
    ))) {
      setError("Give each scenario a label and a positive quote-currency-per-EUR rate.");
      return;
    }

    setBusy(true);
    try {
      const response = await calculateAviationFxReferenceSensitivity(organizationId, {
        contractId: item.contractId,
        analysisRunId: item.analysisRunId,
        assessmentId: item.id,
        scenarios: scenarioInputs,
      });
      if (!Array.isArray(response?.scenarioComparisons)
        || response.scenarioComparisons.length !== scenarioInputs.length
        || response.scenarioComparisons.some((scenario) => (
          !scenario.scenarioId
          || !["calculated", "insufficient_evidence"].includes(scenario.status)
        ))) {
        throw new Error("FX scenario comparison returned an invalid response.");
      }
      setResults(response.scenarioComparisons);
    } catch (requestError) {
      setError(requestError.message || "FX sensitivity is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-3)" }}>
      <p className="op-body-sm"><strong>Deterministic FX reference sensitivity · not a forecast</strong></p>
      {usable ? (
        <>
          <p className="op-body-sm">
            Compare the cited payment with the current ECB EUR reference rate. Each alternative rate is an explicit user assumption; EUR amounts are reference equivalents, not the organization's reporting currency or settlement values. No scenario is a forecast or probability-weighted outcome.
          </p>
          <form onSubmit={submit}>
            {scenarios.map((scenario, index) => (
              <div key={scenario.id} style={{ display: "flex", gap: "var(--op-space-2)", alignItems: "end", marginTop: "var(--op-space-2)" }}>
                <div>
                  <label className="op-body-sm" htmlFor={`fx-scenario-label-${item.id}-${scenario.id}`}>Scenario label</label>
                  <input
                    id={`fx-scenario-label-${item.id}-${scenario.id}`}
                    type="text"
                    maxLength={80}
                    required
                    value={scenario.label}
                    onChange={(event) => setScenarios((current) => current.map((entry) => (
                      entry.id === scenario.id ? { ...entry, label: event.target.value } : entry
                    )))}
                  />
                </div>
                <div>
                  <label className="op-body-sm" htmlFor={`fx-scenario-rate-${item.id}-${scenario.id}`}>
                    Rate ({item.currency} per EUR)
                  </label>
                  <input
                    id={`fx-scenario-rate-${item.id}-${scenario.id}`}
                    type="number"
                    min="0.00000001"
                    max="1000000"
                    step="any"
                    required
                    value={scenario.rate}
                    onChange={(event) => setScenarios((current) => current.map((entry) => (
                      entry.id === scenario.id ? { ...entry, rate: event.target.value } : entry
                    )))}
                    aria-describedby={`fx-scenario-note-${item.id}`}
                  />
                </div>
                {scenarios.length > 1 && (
                  <button
                    className="op-btn op-btn-quiet"
                    type="button"
                    onClick={() => setScenarios((current) => current.filter((entry) => entry.id !== scenario.id))}
                    aria-label={`Remove ${scenario.label || `scenario ${index + 1}`}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <p className="op-body-sm" id={`fx-scenario-note-${item.id}`}>
              One cited payment of {payment.amount.toLocaleString("en-GB")} {payment.currency}, due {payment.dueDate}. ECB reference: {item.observation.value} {item.observation.unit} on {item.observation.observationDate}. Neither rate represents a transaction price.
            </p>
            <div style={{ display: "flex", gap: "var(--op-space-2)", marginTop: "var(--op-space-2)" }}>
              <button
                className="op-btn op-btn-quiet"
                type="button"
                disabled={scenarios.length >= 4}
                onClick={() => {
                  const next = scenarioSequence + 1;
                  setScenarioSequence(next);
                  setScenarios((current) => [...current, { id: next, label: `Scenario ${next}`, rate: "" }]);
                }}
              >
                Add scenario
              </button>
              <button className="op-btn op-btn-quiet" type="submit" disabled={busy}>
                {busy ? "Comparing…" : "Compare scenarios"}
              </button>
            </div>
          </form>
          {error && <p className="op-body-sm" role="alert" style={{ color: "var(--op-signal-risk)" }}>{error}</p>}
          {results && (
            <div role="status" aria-live="polite">
              <p className="op-body-sm">
                Contract impact: {item.obligationDescription || `Payment obligation in clause ${item.clauseNumber || item.clauseId}`}. Each result compares this same cited payment and reference observation.
              </p>
              {results.map((scenario) => scenario.status === "insufficient_evidence" ? (
                <p className="op-body-sm" key={scenario.scenarioId}>{scenario.label}: {scenario.reason}</p>
              ) : (
                <article className="op-surface-plane-secondary" key={scenario.scenarioId} style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-2)" }}>
                  <h4>{scenario.label}</h4>
                  <p className="op-body-sm">Hypothetical assumption: {scenario.assumption.quotePerEur} {scenario.assumption.unit}; verified baseline: {scenario.baselineObservation.value} {scenario.baselineObservation.unit} on {scenario.baselineObservation.observationDate} ({scenario.baselineObservation.sourceName}).</p>
                  <p className="op-body-sm">Baseline EUR reference equivalent: {formatEuro(scenario.baselineResult.amount)}</p>
                  <p className="op-body-sm">Scenario EUR reference equivalent: {formatEuro(scenario.scenarioResult.amount)}</p>
                  <p className="op-body-sm">Difference: {formatEuro(scenario.signedDifference.amount)} ({scenario.percentageDifference}%). Absolute difference: {formatEuro(scenario.absoluteDifference.amount)}.</p>
                  <p className="op-body-sm">{scenario.contractualImpactExplanation}</p>
                  <p className="op-body-sm"><strong>Recommendation only:</strong> {scenario.recommendation.action} Supporting evidence: {scenario.recommendation.supportingEvidenceIds.join(", ")}. No action was performed.</p>
                  <p className="op-body-sm">Scenario ID: {scenario.scenarioId} · created {scenario.createdAt}. Stored only in this workspace view; not saved as a forecast or historical assessment.</p>
                  <ContractualExposureAssessment assessment={scenario.exposureAssessment} />
                  {scenario.limitations.map((limitation) => <p className="op-body-sm" key={limitation}>{limitation}</p>)}
                </article>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="op-body-sm">
          Not calculated: a verified payment amount, due date, current-version citation, and current matching ECB reference observation are required.
        </p>
      )}
    </div>
  );
}

function InterestRateScenarioComparison({ organizationId, item }) {
  const baselineRate = item.observation?.value;
  const [principalAmount, setPrincipalAmount] = useState(
    Number.isFinite(item.financingExposure?.terms?.principalAmount)
      ? String(item.financingExposure.terms.principalAmount)
      : "",
  );
  const [scenarios, setScenarios] = useState([
    { id: 1, label: "SOFR + 0.50 percentage points", delta: "0.5" },
    { id: 2, label: "SOFR + 1.00 percentage point", delta: "1" },
    { id: 3, label: "SOFR + 2.00 percentage points", delta: "2" },
  ]);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const usable = item.status === "verified_contractual_relationship"
    && item.mechanism === "explicit_floating_reference_rate"
    && item.financingExposure?.exposureClassification === "floating_rate"
    && item.benchmark === "SOFR"
    && item.observation?.indicatorId === "interest.us.sofr"
    && item.observation?.freshnessStatus === "current"
    && Number.isFinite(baselineRate);
  const principal = Number(principalAmount);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setResults(null);
    if (!Number.isFinite(principal) || principal <= 0 || principal > 1_000_000_000_000) {
      setError("Enter a positive outstanding principal in USD, up to 1,000,000,000,000.");
      return;
    }

    const scenarioInputs = scenarios.map(({ label, delta }) => ({
      label: label.trim(),
      scenarioBenchmarkPercent: baselineRate + Number(delta),
    }));
    if (scenarioInputs.some(({ label, scenarioBenchmarkPercent }) => (
      !label
      || label.length > 80
      || !Number.isFinite(scenarioBenchmarkPercent)
      || scenarioBenchmarkPercent < 0
      || scenarioBenchmarkPercent > 100
    ))) {
      setError("Give each scenario a label and a resulting SOFR assumption from 0% to 100%.");
      return;
    }

    setBusy(true);
    try {
      const response = await calculateAviationInterestRateScenarios(organizationId, {
        contractId: item.contractId,
        analysisRunId: item.analysisRunId,
        assessmentId: item.id,
        principalAmount: principal,
        scenarios: scenarioInputs,
      });
      if (!Array.isArray(response?.scenarioComparisons)
        || response.scenarioComparisons.length !== scenarioInputs.length
        || response.scenarioComparisons.some((scenario) => (
          !scenario.scenarioId
          || !["calculated", "insufficient_evidence"].includes(scenario.status)
        ))) {
        throw new Error("Interest-rate scenario comparison returned an invalid response.");
      }
      setResults(response.scenarioComparisons);
    } catch (requestError) {
      setError(requestError.message || "Interest-rate scenario comparison is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  const formatUsd = (amount) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return (
    <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-3)" }}>
      <p className="op-body-sm"><strong>Controlled SOFR scenario comparison · not a forecast</strong></p>
      {usable ? (
        <>
          <p className="op-body-sm">
            Compare up to four explicitly assumed SOFR movements from the same verified New York Fed baseline. Rate changes are percentage points, not percentage changes. Principal is a user input unless it matches an explicitly extracted clause value; all outcomes are simple annualized balance run-rates, not accrued or payable interest.
          </p>
          <form onSubmit={submit}>
            <div>
              <label className="op-body-sm" htmlFor={`interest-principal-${item.id}`}>Outstanding principal (USD)</label>
              <input
                id={`interest-principal-${item.id}`}
                type="number"
                min="0.01"
                max="1000000000000"
                step="0.01"
                required
                value={principalAmount}
                onChange={(event) => setPrincipalAmount(event.target.value)}
                aria-describedby={`interest-scenario-note-${item.id}`}
              />
            </div>
            {scenarios.map((scenario, index) => (
              <div key={scenario.id} style={{ display: "flex", gap: "var(--op-space-2)", alignItems: "end", marginTop: "var(--op-space-2)" }}>
                <div>
                  <label className="op-body-sm" htmlFor={`interest-scenario-label-${item.id}-${scenario.id}`}>Scenario label</label>
                  <input
                    id={`interest-scenario-label-${item.id}-${scenario.id}`}
                    type="text"
                    maxLength={80}
                    required
                    value={scenario.label}
                    onChange={(event) => setScenarios((current) => current.map((entry) => (
                      entry.id === scenario.id ? { ...entry, label: event.target.value } : entry
                    )))}
                  />
                </div>
                <div>
                  <label className="op-body-sm" htmlFor={`interest-scenario-delta-${item.id}-${scenario.id}`}>SOFR change (percentage points)</label>
                  <input
                    id={`interest-scenario-delta-${item.id}-${scenario.id}`}
                    type="number"
                    min="-100"
                    max="100"
                    step="0.01"
                    required
                    value={scenario.delta}
                    onChange={(event) => setScenarios((current) => current.map((entry) => (
                      entry.id === scenario.id ? { ...entry, delta: event.target.value } : entry
                    )))}
                    aria-describedby={`interest-scenario-note-${item.id}`}
                  />
                </div>
                {scenarios.length > 1 && (
                  <button
                    className="op-btn op-btn-quiet"
                    type="button"
                    onClick={() => setScenarios((current) => current.filter((entry) => entry.id !== scenario.id))}
                    aria-label={`Remove ${scenario.label || `scenario ${index + 1}`}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <p className="op-body-sm" id={`interest-scenario-note-${item.id}`}>
              Verified baseline: SOFR {baselineRate}% per annum on {item.observation.observationDate} ({item.observation.sourceName}); contractual spread {item.financingExposure.terms.spreadBasisPoints} bps; reset {item.financingExposure.terms.resetFrequency}. Applicable clause cap/floor is applied where explicitly quantified. No hedge offset is inferred.
            </p>
            <div style={{ display: "flex", gap: "var(--op-space-2)", marginTop: "var(--op-space-2)" }}>
              <button
                className="op-btn op-btn-quiet"
                type="button"
                disabled={scenarios.length >= 4}
                onClick={() => {
                  const next = Math.max(...scenarios.map((entry) => entry.id)) + 1;
                  setScenarios((current) => [...current, {
                    id: next,
                    label: `Scenario ${next}`,
                    delta: "0",
                  }]);
                }}
              >
                Add scenario
              </button>
              <button className="op-btn op-btn-quiet" type="submit" disabled={busy}>
                {busy ? "Comparing…" : "Compare financing scenarios"}
              </button>
            </div>
          </form>
          {error && <p className="op-body-sm" role="alert" style={{ color: "var(--op-signal-risk)" }}>{error}</p>}
          {results && (
            <div role="status" aria-live="polite">
              <p className="op-body-sm">
                Clause {item.clauseNumber || item.clauseId} · {formatUsd(principal)} principal · {item.obligationDescription || "No separate extracted financing obligation is linked."}
              </p>
              {results.map((scenario) => scenario.status === "insufficient_evidence" ? (
                <p className="op-body-sm" key={scenario.scenarioId}>{scenario.label}: {scenario.reason}</p>
              ) : (
                <article className="op-surface-plane-secondary" key={scenario.scenarioId} style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-2)" }}>
                  <h4>{scenario.label}</h4>
                  <p className="op-body-sm">Assumed SOFR: {scenario.assumption.benchmarkPercent}% per annum; verified baseline: {scenario.baselineObservation.value}% on {scenario.baselineObservation.observationDate}. The same contractual spread and cap/floor are applied to both.</p>
                  <p className="op-body-sm">Baseline annualized run-rate: {formatUsd(scenario.baselineResult.annualizedInterestExpense.amount)} at {scenario.baselineResult.applicableRatePercent}% all-in.</p>
                  <p className="op-body-sm">Scenario annualized run-rate: {formatUsd(scenario.scenarioResult.annualizedInterestExpense.amount)} at {scenario.scenarioResult.applicableRatePercent}% all-in.</p>
                  <p className="op-body-sm">Annualized difference: {formatUsd(scenario.signedDifference.amount)}{scenario.percentageDifference === null ? "" : ` (${scenario.percentageDifference}% of baseline)`}.</p>
                  <p className="op-body-sm">{scenario.contractualImpactExplanation}</p>
                  <p className="op-body-sm">Principal basis: {scenario.principal.basis.replaceAll("_", " ")}. <strong>Recommendation only:</strong> {scenario.recommendation.action} Supporting evidence: {scenario.recommendation.supportingEvidenceIds.join(", ")}. No action was performed.</p>
                  <p className="op-body-sm">Scenario ID: {scenario.scenarioId} · created {scenario.createdAt}. Not persisted as a forecast or historical assessment.</p>
                  <ContractualExposureAssessment assessment={scenario.exposureAssessment} />
                  {scenario.limitations.map((limitation) => <p className="op-body-sm" key={limitation}>{limitation}</p>)}
                </article>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="op-body-sm">
          Not available: a verified, current-version SOFR floating-rate clause, explicit spread and reset frequency, current matching New York Fed observation, USD units, and a cited clause are required. Fixed-rate and non-SOFR clauses are not repriced by this comparison.
        </p>
      )}
    </div>
  );
}

function IndexationComparison({ organizationId, item }) {
  const exposure = item.indexationExposure;
  const [values, setValues] = useState(["310", "320", "330"]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setResults(null);
    setError("");
    const scenarios = values.map((value, index) => ({ label: `Index assumption ${index + 1}`, indexValue: value.trim() ? Number(value) : NaN }));
    if (scenarios.some((scenario) => !Number.isFinite(scenario.indexValue) || scenario.indexValue <= 0 || scenario.indexValue > 1e6)) {
      setError("Enter positive index-level assumptions up to 1,000,000.");
      return;
    }
    setBusy(true);
    try {
      const response = await calculateAviationIndexationScenarios(organizationId, {
        contractId: item.contractId, analysisRunId: item.analysisRunId, assessmentId: item.id, scenarios,
      });
      if (!Array.isArray(response?.scenarioComparisons) || response.scenarioComparisons.length !== scenarios.length) throw new Error("Indexation comparison returned an invalid response.");
      setResults(response.scenarioComparisons);
    } catch (requestError) {
      setError(requestError.message || "Indexation comparison unavailable.");
    } finally { setBusy(false); }
  }
  return <section aria-label="Contractual indexation assessment">
    <p className="op-body-sm"><strong>Indexation:</strong> {exposure.terms.classification.replaceAll("_", " ")} · {exposure.terms.protection} · {exposure.terms.seriesId || exposure.terms.indexType || "index not established"}</p>
    <p className="op-body-sm">{exposure.explanation}</p>
    <p className="op-body-sm">Adjustment: {exposure.terms.adjustmentDate || "not established"} · notice review: {exposure.noticeDate || "not established"} · {exposure.adjustmentTiming.replaceAll("_", " ")}</p>
    {exposure.calculation && <p className="op-body-sm">Baseline {exposure.calculation.currency} {exposure.calculation.baselinePrice.toLocaleString("en-GB")} per {exposure.calculation.period}; index {exposure.calculation.baselineIndex ?? "not applicable"} ({exposure.terms.baselinePeriod || "fixed escalation"}) → {exposure.calculation.currentIndex ?? "not applicable"} ({exposure.terms.referencePeriod || "fixed escalation"}). Adjustment {exposure.calculation.adjustmentPercent}%; revised price {exposure.calculation.currency} {exposure.calculation.revisedPrice.toLocaleString("en-GB")}; incremental cost {exposure.calculation.incrementalCost.toLocaleString("en-GB")}. Method {exposure.methodology}.</p>}
    {exposure.missingInputs.length > 0 && <p className="op-body-sm">Outstanding: {exposure.missingInputs.join("; ")}</p>}
    {exposure.status === "calculated" && exposure.terms.fixedEscalationPercent === null && <form onSubmit={submit}>
      <p className="op-body-sm">Controlled index assumptions, not forecasts. The same contractual formula and period apply to all comparisons.</p>
      {values.map((value, index) => <label key={index} style={{ display: "block", marginTop: "var(--op-space-2)" }}>
        Alternative index level {index + 1}
        <input aria-label={`Alternative index level ${index + 1}`} type="number" min="0.000001" max="1000000" step="any" required value={value}
          onChange={(event) => { setResults(null); setValues((current) => current.map((entry, position) => position === index ? event.target.value : entry)); }} />
      </label>)}
      <button className="op-btn op-btn-quiet" type="submit" disabled={busy}>{busy ? "Comparing…" : "Compare index assumptions"}</button>
    </form>}
    {error && <p role="alert">{error}</p>}
    {results && <div aria-live="polite">{results.map((scenario) => <p key={scenario.scenarioId} className="op-body-sm">{scenario.label}: {scenario.scenarioResult ? `${scenario.scenarioResult.currency} ${scenario.scenarioResult.revisedPrice.toLocaleString("en-GB")} per ${scenario.scenarioResult.period}; difference ${scenario.signedDifference.toLocaleString("en-GB")}` : scenario.reason}. {scenario.scenarioId} · {scenario.methodology}. Advisory only; ephemeral, not a forecast.</p>)}</div>}
    {exposure.limitations.map((limitation) => <p className="op-body-sm" key={limitation}>{limitation}</p>)}
  </section>;
}

export default function AviationExternalRiskIntelligence({ organizationId, contractId, analysisRunId }) {
  const organizationContext = useOrganization();
  const canRefreshSources = organizationContext?.hasOrganizationPermission?.(ORGANIZATION_PERMISSIONS.CONTRACT_WRITE) === true;
  const [state, setState] = useState("loading");
  const [assessment, setAssessment] = useState(null);
  const [predictiveAssessment, setPredictiveAssessment] = useState(null);
  const [error, setError] = useState("");
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [refreshingSources, setRefreshingSources] = useState(false);
  const [sourceRefreshResult, setSourceRefreshResult] = useState(null);
  const [sourceRefreshError, setSourceRefreshError] = useState("");

  async function refreshSources() {
    setRefreshingSources(true);
    setSourceRefreshError("");
    setSourceRefreshResult(null);
    try {
      const response = await refreshAviationExternalObservations(organizationId);
      if (!response?.success || !response.refresh || !Number.isFinite(response.refresh.receivedCount)) {
        throw new Error("External observation refresh returned an invalid response.");
      }
      setSourceRefreshResult(response.refresh);
      setRefreshIndex((value) => value + 1);
    } catch (requestError) {
      setSourceRefreshError(requestError.message || "External observations could not be refreshed.");
    } finally {
      setRefreshingSources(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setError("");
    getAviationExternalRiskIntelligence(organizationId, { contractId, analysisRunId })
      .then((response) => {
        if (cancelled) return;
        if (!response?.externalRisk || !Array.isArray(response.externalRisk.contractualAssessments)) {
          throw new Error("External risk intelligence returned an invalid response.");
        }
        setAssessment(response.externalRisk);
        setPredictiveAssessment(response.predictiveRisk || null);
        setState("ready");
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError.message || "External risk intelligence is unavailable.");
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, contractId, analysisRunId, refreshIndex]);

  return (
    <section className="op-surface" style={{ padding: "var(--op-space-4)", marginBottom: "var(--op-space-5)" }} aria-label="Aviation external risk intelligence">
      <p className="op-kicker">{contractId ? "Contract external-risk context" : "External indicators and contractual evidence"}</p>
      {!contractId && <h2 className="op-heading-md">Aviation external risk intelligence</h2>}
      <p className="op-body-sm">
        Published indicators are kept distinct from verified contractual relationships and uncalculated exposure. This is not a forecast or a statement of incurred loss.
      </p>
      {state === "loading" && <p className="op-body-sm" role="status">
        {assessment ? "Reassessing from the latest stored observations and current-version contract evidence…" : "Checking verified external observations and current-version contract evidence…"}
      </p>}
      {state === "error" && <p className="op-body-sm" role="alert" style={{ color: "var(--op-signal-risk)" }}>{error}</p>}
      {state === "ready" && assessment && (
        <>
          <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-3)" }}>
            {canRefreshSources && (
              <>
                <button
                  className="op-btn op-btn-quiet"
                  type="button"
                  onClick={refreshSources}
                  disabled={refreshingSources}
                >
                  {refreshingSources ? "Refreshing public sources…" : "Refresh public observations"}
                </button>
                <p className="op-body-sm">
                  Manual refresh retrieves public reference data only; no contract text or customer data is sent to providers. Refresh is not scheduled or continuous.
                </p>
              </>
            )}
            <button
              className="op-btn op-btn-quiet"
              type="button"
              onClick={() => setRefreshIndex((value) => value + 1)}
              disabled={state === "loading"}
            >
              Reassess latest stored evidence
            </button>
            <p className="op-body-sm">
              This explicit reassessment reads observations already stored for your organization. It does not collect new source data or run background monitoring.
              {predictiveAssessment?.assessedAt ? ` Last assessed ${new Date(predictiveAssessment.assessedAt).toLocaleString()}.` : ""}
            </p>
            {sourceRefreshError && <p className="op-body-sm" role="alert" style={{ color: "var(--op-signal-risk)" }}>{sourceRefreshError}</p>}
            {sourceRefreshResult && (
              <div className="op-body-sm" role="status" aria-live="polite">
                <p>Public-source refresh completed at {sourceRefreshResult.retrievedAt}: {sourceRefreshResult.insertedCount} new observation(s), {sourceRefreshResult.duplicateCount} unchanged duplicate(s) ignored.</p>
                {Object.entries(sourceRefreshResult.sources).map(([category, source]) => (
                  <p key={category}>{category.toUpperCase()} · {source.status}{source.reason ? ` · ${source.reason}` : ""}</p>
                ))}
                <p>{sourceRefreshResult.disclaimer}</p>
              </div>
            )}
          </div>
          <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-3)" }}>
            <p className="op-body-sm">Assessment date: {assessment.asOf} · {assessment.coverage.includedProvisions} verified evidence-linked provision(s) reviewed</p>
            {assessment.categorySummary.map((category) => (
              <p className="op-body-sm" key={category.category}>
                {category.category.toUpperCase()}: {category.affectedContractCount} affected contract(s), {category.verifiedClauseCount} verified clause(s); no financial aggregation
                {category.signalStatuses.map((signal, index) => (
                  <span key={`${category.category}-${index}`}> · signal {signal.status}{signal.latest ? ` (${observationText(signal.latest)})` : ""}</span>
                ))}
              </p>
            ))}
            <p className="op-body-sm">
              Fuel source status: {assessment.sourcePolicy.fuel.status}
              {assessment.sourcePolicy.fuel.reason
                ? ` · ${assessment.sourcePolicy.fuel.reason}`
                : assessment.sourcePolicy.fuel.latest
                  ? ` · ${observationText(assessment.sourcePolicy.fuel.latest)}`
                  : ""}
            </p>
            {(assessment.observations || []).map((observation) => (
              <p className="op-body-sm" key={`${observation.indicatorId}-${observation.observationDate}`}>
                {observationText(observation)} · {observation.attribution}
                {observation.sourceReference && <> · <a href={observation.sourceReference} target="_blank" rel="noopener noreferrer">Source reference</a></>}
                {observation.publicationTimestamp ? ` · published ${observation.publicationTimestamp}` : " · publication timestamp not supplied by source"}
                {observation.sourceDisclaimer ? ` ${observation.sourceDisclaimer}` : ""}
              </p>
            ))}
            {assessment.coverage.provisionsTruncated && <p className="op-body-sm" role="status">Provision retrieval reached its safety limit; this result is incomplete.</p>}
          </div>
          {assessment.contractualAssessments.length > 0 ? (
            <div style={{ marginTop: "var(--op-space-4)" }}>
              {assessment.contractualAssessments.map((item) => (
                <article className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-2)" }} key={item.id}>
                  <p className="op-body-sm"><strong>{item.category.toUpperCase()} · {item.status.replaceAll("_", " ")}</strong> · {item.contractTitle} · clause {item.clauseNumber || item.clauseId}</p>
                  <p className="op-body-sm">{item.mechanism.replaceAll("_", " ")}{item.currency ? ` · ${item.currency}` : ""}{item.benchmark ? ` · ${item.benchmark}` : ""}</p>
                  {item.contractualPayment?.amount !== null && item.contractualPayment && (
                    <p className="op-body-sm">
                      Contractual payment: {item.contractualPayment.amount.toLocaleString("en-GB")} {item.contractualPayment.currency}
                      {item.contractualPayment.dueDate ? ` · due ${item.contractualPayment.dueDate}` : " · due date not established"}
                    </p>
                  )}
                  {item.contractualRateTerms && (
                    <p className="op-body-sm">
                      Contractual spread: {item.contractualRateTerms.spreadBasisPoints === null ? "not established" : `${item.contractualRateTerms.spreadBasisPoints} basis points`}
                      {" · reset frequency: "}{item.contractualRateTerms.resetFrequency || "not established"}
                    </p>
                  )}
                  {item.category === "interest" && item.financingExposure && (
                    <>
                      <p className="op-body-sm">
                        Financing classification: {item.financingExposure.exposureClassification.replaceAll("_", " ")}
                        {item.financingExposure.terms?.benchmark ? ` · benchmark ${item.financingExposure.terms.benchmark}` : ""}
                        {item.financingExposure.terms?.principalCurrency ? ` · principal currency ${item.financingExposure.terms.principalCurrency}` : ""}
                      </p>
                      {item.financingExposure.calculation ? (
                        <p className="op-body-sm">
                          Simple annualized balance run-rate: {item.financingExposure.calculation.annualizedInterestExpense.currency} {item.financingExposure.calculation.annualizedInterestExpense.amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {" "}at {item.financingExposure.calculation.applicableRatePercent}% per annum. Not accrued or payable interest.
                        </p>
                      ) : (
                        <p className="op-body-sm">
                          Financing run-rate not calculated: {item.financingExposure.missingInputs.join("; ") || "required verified inputs are unavailable"}.
                        </p>
                      )}
                    </>
                  )}
                  <p className="op-body-sm">{observationText(item.observation)}</p>
                  {item.category === "fuel" && item.fuelExposure ? (
                    <>
                      <p className="op-body-sm"><strong>Fuel-price assessment:</strong> {item.fuelExposure.explanation}</p>
                      {item.fuelExposure.calculation ? (
                        <p className="op-body-sm">
                          Clause-derived adjustment: {item.fuelExposure.calculation.amount.currency} {item.fuelExposure.calculation.amount.value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {" "}for {item.fuelExposure.calculation.amount.period}; method {item.fuelExposure.calculation.methodology}. Not an invoice amount or net recoverable exposure.
                        </p>
                      ) : (
                        <p className="op-body-sm">Adjustment not calculated. Outstanding: {item.fuelExposure.missingInputs.join("; ") || "required calculation inputs are unavailable"}.</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="op-body-sm">Assessment: {item.calculation.status.replaceAll("_", " ")} — {item.calculation.reason}</p>
                      <p className="op-body-sm">Missing inputs: {item.calculation.missingInputs.join(", ")}</p>
                    </>
                  )}
                  <p className="op-body-sm">{item.recommendation.action}</p>
                  <p className="op-body-sm">{item.evidence.sourceLocator || (item.evidence.pageNumber ? `Page ${item.evidence.pageNumber}` : "Source location unavailable")} · {item.evidence.excerpt}</p>
                  {item.category === "fx" && (
                    <FxReferenceSensitivity organizationId={organizationId} item={item} />
                  )}
                  {item.category === "interest" && (
                    <InterestRateScenarioComparison organizationId={organizationId} item={item} />
                  )}
                  {item.indexationExposure && <IndexationComparison key={item.id} organizationId={organizationId} item={item} />}
                  <Link className="op-btn op-btn-quiet" to={workspacePath(item)}>Open cited contract clause</Link>
                </article>
              ))}
            </div>
          ) : <p className="op-body-sm">No supported external-risk contractual relationships were identified in the verified evidence reviewed.</p>}
          <p className="op-body-sm" style={{ marginTop: "var(--op-space-3)" }}>{assessment.portfolioAggregation.explanation}</p>
          <AviationPredictiveContractRisk assessment={predictiveAssessment} />
        </>
      )}
    </section>
  );
}
