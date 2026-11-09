import React, { useEffect, useMemo, useState } from "react";
import {
  getAviationForecastBacktest,
  getAviationOutcomeHistory,
  recordAviationOutcome,
  snapshotAviationUtilisationForecast,
} from "../../lib/contractsApi";

const OUTCOME_TYPES = [
  ["flight_hours", "Flight hours"],
  ["flight_cycles", "Flight cycles"],
  ["charge", "Contractual charge"],
  ["maintenance_charge", "Maintenance charge"],
  ["fx_adjustment", "FX adjustment"],
  ["fuel_adjustment", "Fuel adjustment"],
  ["operational_disruption", "Operational disruption"],
  ["supplier_impact", "Supplier impact"],
  ["other", "Other"],
];
const EVIDENCE_RELATIONSHIPS = [
  ["supports", "Supports outcome"],
  ["contradicts", "Contradicts outcome"],
  ["context", "Context only"],
];
const EVIDENCE_PERIOD_STATUSES = [
  ["matches", "Source period matches"],
  ["mismatches", "Source period differs"],
  ["not_assessed", "Period not assessed"],
];
const CLASSIFICATIONS = [
  ["verified_actual", "Verified actual"],
  ["partially_verified", "Partially verified"],
  ["unverified_reported", "Unverified reported"],
  ["estimated", "Estimated"],
  ["hypothetical", "Hypothetical"],
];
const FINANCIAL_TYPES = new Set(["charge", "maintenance_charge", "fx_adjustment", "fuel_adjustment"]);
const UTILIZATION_TYPES = new Set(["flight_hours", "flight_cycles"]);
const FIELD_STYLE = { display: "block", width: "100%", marginTop: "var(--op-space-1)" };

function sourceEvidence(risks) {
  return [...new Map((risks || []).flatMap((risk) => [
    ...(risk.operational_evidence || []),
    ...(risk.utilisation_exposure?.metrics || []).flatMap((metric) => metric.forecast?.sources || []),
  ])
    .filter((item) => item?.evidenceId && (item.reviewStatus || item.review_status) !== "rejected")
    .map((item) => [item.evidenceId, item])).values()];
}

function outcomeLabel(value) {
  return OUTCOME_TYPES.find(([key]) => key === value)?.[1] || value?.replaceAll("_", " ") || "Outcome";
}

function dateValue(value) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

export default function AviationOutcomeHistory({ analysisRunId, organizationId, assessment, canWrite = false }) {
  const [history, setHistory] = useState([]);
  const [historyStatus, setHistoryStatus] = useState("loading");
  const [backtest, setBacktest] = useState(null);
  const [backtestStatus, setBacktestStatus] = useState("loading");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [riskId, setRiskId] = useState("");
  const [outcomeType, setOutcomeType] = useState("flight_hours");
  const [classification, setClassification] = useState("unverified_reported");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("flight_hours");
  const [currency, setCurrency] = useState("");
  const [measurementBasis, setMeasurementBasis] = useState("cumulative_to_date");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [methodology, setMethodology] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [evidenceRelationship, setEvidenceRelationship] = useState("supports");
  const [evidencePeriodStatus, setEvidencePeriodStatus] = useState("not_assessed");
  const [assetIdentifier, setAssetIdentifier] = useState("");
  const [correctionTarget, setCorrectionTarget] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [pendingSnapshot, setPendingSnapshot] = useState("");

  const eligibleRisks = useMemo(() => (assessment?.risks || []).filter((risk) => (
    risk.utilisation_exposure?.metrics?.length
  )), [assessment]);
  const chosenRisk = eligibleRisks.find((risk) => risk.id === riskId) || eligibleRisks[0] || null;
  const evidenceOptions = useMemo(() => sourceEvidence(chosenRisk ? [chosenRisk] : []), [chosenRisk]);
  const activeOutcomes = history.filter((item) => !item.is_superseded);
  const correctionRecord = activeOutcomes.find((item) => item.id === correctionTarget);
  const snapshotMetrics = [...new Set(eligibleRisks.flatMap((risk) => (
    risk.utilisation_exposure.metrics
      .filter((item) => item.forecast?.status === "forecast_available")
      .map((item) => item.unit)
  )))];

  async function refreshHistory() {
    const response = await getAviationOutcomeHistory(analysisRunId, organizationId);
    setHistory(response.outcomes || []);
    setHistoryStatus(response.outcomeHistoryStatus || "not_assessed");
    const evaluation = await getAviationForecastBacktest(analysisRunId, organizationId);
    setBacktest(evaluation.backtest || null);
    setBacktestStatus("ready");
  }

  useEffect(() => {
    let active = true;
    setHistoryStatus("loading");
    setBacktestStatus("loading");
    setError("");
    Promise.all([
      getAviationOutcomeHistory(analysisRunId, organizationId),
      getAviationForecastBacktest(analysisRunId, organizationId),
    ]).then(([outcomeResponse, backtestResponse]) => {
      if (!active) return;
      setHistory(outcomeResponse.outcomes || []);
      setHistoryStatus(outcomeResponse.outcomeHistoryStatus || "not_assessed");
      setBacktest(backtestResponse.backtest || null);
      setBacktestStatus("ready");
    }).catch((requestError) => {
      if (!active) return;
      setError(requestError.message || "Outcome history could not be loaded.");
      setHistoryStatus("error");
      setBacktestStatus("error");
    });
    return () => { active = false; };
  }, [analysisRunId, organizationId]);

  useEffect(() => {
    if (!riskId && eligibleRisks.length) setRiskId(eligibleRisks[0].id);
  }, [eligibleRisks, riskId]);

  useEffect(() => {
    if (!evidenceId && evidenceOptions.length) setEvidenceId(evidenceOptions[0].evidenceId);
  }, [evidenceOptions, evidenceId]);

  useEffect(() => {
    if (!correctionRecord) return;
    setRiskId(eligibleRisks.find((risk) => risk.obligation_id === correctionRecord.obligation_id)?.id || "");
    setOutcomeType(correctionRecord.outcome_type);
    setClassification(correctionRecord.classification);
    setValue(String(correctionRecord.value));
    setUnit(correctionRecord.unit);
    setCurrency(correctionRecord.currency || "");
    setMeasurementBasis(correctionRecord.measurement_basis);
    setPeriodStart(dateValue(correctionRecord.period_start));
    setPeriodEnd(dateValue(correctionRecord.period_end));
    setMethodology(correctionRecord.methodology || "");
    const correctionEvidence = correctionRecord.evidence?.[0];
    setEvidenceId(correctionEvidence?.evidenceId || "");
    setEvidenceRelationship(correctionEvidence?.relationship || "supports");
    setEvidencePeriodStatus(correctionEvidence?.periodStatus || "not_assessed");
    setAssetIdentifier(correctionRecord.asset_identifier || "");
  }, [correctionTarget]);

  function changeOutcomeType(nextType) {
    setOutcomeType(nextType);
    if (UTILIZATION_TYPES.has(nextType)) {
      setUnit(nextType);
      setCurrency("");
      setMeasurementBasis("cumulative_to_date");
    } else {
      setMeasurementBasis("reporting_period_total");
      if (FINANCIAL_TYPES.has(nextType)) {
        setUnit(currency || "EUR");
      } else {
        setUnit("event_value");
        setCurrency("");
      }
    }
  }

  async function submitOutcome(event) {
    event.preventDefault();
    if (!chosenRisk || !evidenceId) {
      setError("Select an aviation obligation and verified operational evidence.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await recordAviationOutcome(analysisRunId, organizationId, {
        clauseId: chosenRisk.clause_id,
        obligationId: chosenRisk.obligation_id,
        outcomeType,
        classification,
        value: Number(value),
        unit,
        measurementBasis,
        currency: FINANCIAL_TYPES.has(outcomeType) ? currency : null,
        assetIdentifier: assetIdentifier.trim() || null,
        periodStart,
        periodEnd,
        methodology: methodology.trim(),
        evidence: [{
          evidenceId,
          relationship: evidenceRelationship,
          periodStatus: evidencePeriodStatus,
        }],
        ...(correctionTarget ? {
          supersedesOutcomeId: correctionTarget,
          correctionReason: correctionReason.trim(),
        } : {}),
      });
      setCorrectionTarget("");
      setCorrectionReason("");
      setValue("");
      setMethodology("");
      setAssetIdentifier("");
      await refreshHistory();
      setNotice("Outcome evidence saved as an immutable history record.");
    } catch (requestError) {
      setError(requestError.message || "Outcome evidence could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function createSnapshot(metric) {
    setPendingSnapshot(metric);
    setError("");
    setNotice("");
    try {
      const response = await snapshotAviationUtilisationForecast(analysisRunId, organizationId, metric);
      setNotice(`${response.snapshots?.length || 0} ${metric.replaceAll("_", " ")} forecast snapshot(s) preserved with their original inputs and evidence.`);
      const evaluation = await getAviationForecastBacktest(analysisRunId, organizationId);
      setBacktest(evaluation.backtest || null);
      setBacktestStatus("ready");
    } catch (requestError) {
      setError(requestError.message || "The forecast snapshot could not be saved.");
    } finally {
      setPendingSnapshot("");
    }
  }

  return (
    <section className="op-surface-plane-primary" style={{ padding: "var(--op-space-4)", marginTop: "var(--op-space-4)" }} aria-label="Aviation outcome evidence and forecast evaluation">
      <h3 className="op-heading-sm">Verified outcomes and forecast evaluation</h3>
      <p className="op-body-sm" style={{ marginTop: "var(--op-space-1)" }}>
        Record aviation outcomes against this contract version and obligation. Only verified actuals with verified, period-matched supporting evidence can enter deterministic utilization backtests. Estimates, reports and hypothetical values remain separate; this is not legal or accounting advice.
      </p>
      {error && <p role="alert" className="op-body-sm" style={{ color: "var(--op-signal-risk)", marginTop: "var(--op-space-2)" }}>{error}</p>}
      {notice && <p role="status" className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>{notice}</p>}

      <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-3)" }}>
        <p className="op-kicker">Phase 55 deterministic forecast snapshots</p>
        <p className="op-body-sm">Snapshots are created only on request and preserve the original evidence, contract version, calculation inputs, assumption and forecast date. No forecast is reconstructed from later data.</p>
        {!snapshotMetrics.length ? <p className="op-body-sm">No eligible future utilization threshold estimate is available to snapshot.</p> : snapshotMetrics.map((metric) => (
          <button
            key={metric}
            className="op-btn op-btn-quiet"
            type="button"
            disabled={!canWrite || Boolean(pendingSnapshot)}
            onClick={() => createSnapshot(metric)}
            style={{ margin: "var(--op-space-1) var(--op-space-1) 0 0" }}
          >
            {pendingSnapshot === metric ? "Saving snapshot…" : `Preserve ${metric.replaceAll("_", " ")} forecast`}
          </button>
        ))}
        {!canWrite && <p className="op-body-sm">Contract write permission is required to preserve a forecast snapshot.</p>}
      </div>

      <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-3)" }}>
        <p className="op-kicker">Outcome history · {historyStatus.replaceAll("_", " ")}</p>
        {historyStatus === "loading" && <p className="op-body-sm" role="status">Loading outcome history…</p>}
        {historyStatus === "error" && <p className="op-body-sm">Outcome history is unavailable; no missing-data conclusion is inferred.</p>}
        {historyStatus !== "loading" && historyStatus !== "error" && !history.length && (
          <p className="op-body-sm">No outcome records are available for this version. This does not mean that no contractual outcome occurred.</p>
        )}
        {history.map((item) => (
          <article key={item.id} className="op-surface" style={{ padding: "var(--op-space-2)", marginTop: "var(--op-space-2)" }}>
            <p className="op-body-sm"><strong>{outcomeLabel(item.outcome_type)}</strong> · {item.classification.replaceAll("_", " ")} · {Number(item.value).toLocaleString()} {item.unit} · period {dateValue(item.period_start)} to {dateValue(item.period_end)}</p>
            <p className="op-body-sm">Contract version {item.document_version_id} · clause {item.clause_id} · obligation {item.obligation_id}{item.currency ? ` · ${item.currency}` : ""}{item.asset_identifier ? ` · asset ${item.asset_identifier}` : ""}</p>
            <p className="op-body-sm">Method: {item.methodology} · {item.verified_at ? `reviewed ${new Date(item.verified_at).toLocaleDateString()}` : "not verified as an actual"}</p>
            {item.supersedes_outcome_id && <p className="op-body-sm">Correction of prior record · {item.correction_reason}</p>}
            {item.is_superseded && <p className="op-body-sm">Superseded by a later immutable correction; retained for history.</p>}
            {(item.evidence || []).map((source) => <details key={source.evidenceId} style={{ marginTop: "var(--op-space-1)" }}>
              <summary className="op-body-sm">{source.documentName || "Source document"} · version {source.versionNumber || "unavailable"} · {source.sourceLocator || (source.pageNumber ? `page ${source.pageNumber}` : "location unavailable")} · {source.reviewStatus}</summary>
              <p className="op-body-sm">{source.excerpt || "No excerpt is available."}</p>
            </details>)}
            {canWrite && !item.is_superseded && (
              <button type="button" className="op-btn op-btn-quiet" onClick={() => setCorrectionTarget(item.id)}>Correct this record</button>
            )}
          </article>
        ))}
      </div>

      {canWrite && eligibleRisks.length > 0 && (
        <form onSubmit={submitOutcome} className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-3)" }}>
          <p className="op-kicker">{correctionTarget ? "Append a historical correction" : "Record an aviation outcome"}</p>
          <p className="op-body-sm">A submitted record is immutable. Corrections append a new record and retain the prior version. Verified actuals require a source already reviewed as verified.</p>
          <div className="op-grid op-grid-2">
            <label className="op-body-sm">Lease obligation
              <select value={chosenRisk?.id || ""} onChange={(event) => setRiskId(event.target.value)} style={FIELD_STYLE}>
                {eligibleRisks.map((risk) => <option key={risk.id} value={risk.id}>{risk.title}</option>)}
              </select>
            </label>
            <label className="op-body-sm">Outcome type
              <select value={outcomeType} onChange={(event) => changeOutcomeType(event.target.value)} style={FIELD_STYLE}>
                {OUTCOME_TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label className="op-body-sm">Evidence classification
              <select value={classification} onChange={(event) => setClassification(event.target.value)} style={FIELD_STYLE}>
                {CLASSIFICATIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label className="op-body-sm">Value
              <input required type="number" step="any" value={value} onChange={(event) => setValue(event.target.value)} style={FIELD_STYLE} />
            </label>
            {FINANCIAL_TYPES.has(outcomeType) ? <>
              <label className="op-body-sm">Currency
                <input required maxLength={3} value={currency} onChange={(event) => { setCurrency(event.target.value.toUpperCase()); setUnit(event.target.value.toUpperCase()); }} style={FIELD_STYLE} />
              </label>
            </> : <label className="op-body-sm">Unit
              <input required maxLength={40} value={unit} readOnly={UTILIZATION_TYPES.has(outcomeType)} onChange={(event) => setUnit(event.target.value)} style={FIELD_STYLE} />
            </label>}
            <label className="op-body-sm">Measurement basis
              <select value={measurementBasis} onChange={(event) => setMeasurementBasis(event.target.value)} style={FIELD_STYLE}>
                {UTILIZATION_TYPES.has(outcomeType) ? <>
                  <option value="cumulative_to_date">Cumulative to date</option>
                  <option value="reporting_period_total">Reporting-period total</option>
                </> : <>
                  <option value="reporting_period_total">Reporting-period total</option>
                  <option value="event_value">Event value</option>
                </>}
              </select>
            </label>
            <label className="op-body-sm">Reporting period start<input required type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} style={FIELD_STYLE} /></label>
            <label className="op-body-sm">Reporting period end<input required type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} style={FIELD_STYLE} /></label>
            <label className="op-body-sm">Source evidence
              <select required value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} style={FIELD_STYLE}>
                <option value="">Select source evidence</option>
                {evidenceOptions.map((item) => <option key={item.evidenceId} value={item.evidenceId}>{item.documentName || "Operational document"} · {item.sourceLocator || `page ${item.pageNumber || "unavailable"}`} · {item.reviewStatus || item.review_status || "review status unavailable"}</option>)}
              </select>
            </label>
            <label className="op-body-sm">Evidence relationship
              <select value={evidenceRelationship} onChange={(event) => setEvidenceRelationship(event.target.value)} style={FIELD_STYLE}>
                {EVIDENCE_RELATIONSHIPS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label className="op-body-sm">Evidence reporting period
              <select value={evidencePeriodStatus} onChange={(event) => setEvidencePeriodStatus(event.target.value)} style={FIELD_STYLE}>
                {EVIDENCE_PERIOD_STATUSES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label className="op-body-sm">Aircraft / asset identifier, if evidenced
              <input maxLength={100} value={assetIdentifier} onChange={(event) => setAssetIdentifier(event.target.value)} style={FIELD_STYLE} />
            </label>
            <label className="op-body-sm" style={{ gridColumn: "1 / -1" }}>Methodology and verification basis
              <textarea required maxLength={4000} value={methodology} onChange={(event) => setMethodology(event.target.value)} rows={3} style={FIELD_STYLE} />
            </label>
          </div>
          {correctionTarget && <>
            <label className="op-body-sm" style={{ display: "block", marginTop: "var(--op-space-2)" }}>Correction reason
              <textarea required maxLength={2000} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} rows={2} style={FIELD_STYLE} />
            </label>
            <button type="button" className="op-btn op-btn-quiet" onClick={() => setCorrectionTarget("")}>Cancel correction</button>
          </>}
          <p className="op-body-sm">Verified actuals require a source currently marked verified, explicitly marked as supporting, and confirmed to cover this reporting period.</p>
          {!evidenceOptions.length && <p className="op-body-sm" role="status">No usable operational source evidence is available for this lease obligation. Add source records before recording an outcome.</p>}
          <button className="op-btn op-btn-primary" type="submit" disabled={saving || !evidenceOptions.length} style={{ marginTop: "var(--op-space-2)" }}>
            {saving ? "Saving immutable record…" : correctionTarget ? "Append correction" : "Record outcome"}
          </button>
        </form>
      )}

      <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-3)" }}>
        <p className="op-kicker">Chronological Phase 55 backtest</p>
        {backtestStatus === "loading" && <p className="op-body-sm" role="status">Evaluating preserved forecasts against subsequent evidence…</p>}
        {backtestStatus === "error" && <p className="op-body-sm">Forecast evaluation is unavailable. No performance is inferred.</p>}
        {backtestStatus === "ready" && backtest && <>
          <p className="op-body-sm">Threshold-date status: {backtest.status.replaceAll("_", " ")} · {backtest.verifiedThresholdOutcomes} verified threshold outcome(s) / {backtest.eligibleForecastCount} stored forecast(s).</p>
          {backtest.metrics ? <p className="op-body-sm">Interval-censored threshold-date error · MAE {backtest.metrics.maeDaysToObservedWindow} days · RMSE {backtest.metrics.rmseDaysToObservedWindow} days · bias {backtest.metrics.biasDaysToObservedWindow} days.</p>
            : <p className="op-body-sm">Backtesting is not yet possible: no eligible snapshot has a subsequent verified cumulative utilization threshold outcome.</p>}
          {Object.entries(backtest.excludedReasons || {}).map(([reason, count]) => <p key={reason} className="op-body-sm">Excluded {count}: {reason.replaceAll("_", " ")}.</p>)}
          {backtest.limitations.map((limitation) => <p key={limitation} className="op-body-sm">{limitation}</p>)}
          <div className="op-surface" style={{ padding: "var(--op-space-2)", marginTop: "var(--op-space-3)" }}>
            <p className="op-kicker">Cumulative utilisation projection comparison</p>
            <p className="op-body-sm">
              {backtest.utilisationValueEvaluation?.eligibleObservationCount || 0} comparable verified observation(s) / {backtest.utilisationValueEvaluation?.eligibleForecastCount || 0} stored snapshot(s).
              {" "}Aggregate sample status: {(backtest.utilisationValueEvaluation?.sampleSizeStatus || "insufficient_sample_size").replaceAll("_", " ")}.
            </p>
            {backtest.utilisationValueEvaluation?.evaluatedAt && <p className="op-body-sm">Evaluation computed {new Date(backtest.utilisationValueEvaluation.evaluatedAt).toLocaleString()} from the preserved snapshot and current evidence review statuses; this result is derived on request, not stored as a new historical record.</p>}
            {backtest.utilisationValueEvaluation?.eligibleObservationCount > 0 ? <>
            {Object.entries(backtest.utilisationValueEvaluation.metricsByMetric || {}).map(([metric, metrics]) => <div key={metric}>
              <p className="op-body-sm">
                {metric.replaceAll("_", " ")} descriptive error only (projected minus actual; positive means overestimation) · {metrics.observationCount} observation(s) · {metrics.sampleSizeStatus.replaceAll("_", " ")} · mean absolute error {metrics.meanAbsoluteError} {metric} · signed bias {metrics.meanSignedError} {metric}.
                {metrics.meanAbsolutePercentageError === null
                  ? " Percentage error is unavailable for zero or sub-unit actual values."
                  : ` Mean absolute percentage error ${metrics.meanAbsolutePercentageError}% across ${metrics.percentageErrorObservationCount} eligible observation(s).`}
              </p>
              <p className="op-body-sm">
                Overestimated {metrics.overestimationCount} · underestimated {metrics.underestimationCount} · exact {metrics.exactMatchCount}.
              </p>
            </div>)}
            {backtest.utilisationValueEvaluation.evaluations.map((item) => <p key={`${item.forecastSnapshotId}-${item.outcomeId}`} className="op-body-sm">
              {item.metric.replaceAll("_", " ")} · {item.actualReportingPeriod.start} to {item.actualReportingPeriod.end}: projected {item.projectedCumulativeValue} vs verified actual {item.actualCumulativeValue} {item.unit} · signed error {item.signedError} {item.unit}. Method {item.methodologyVersion}; baseline {item.projectionInputs.currentVerifiedUtilisation}, rate {item.projectionInputs.averageDailyConsumption} {item.unit}/day. Forecast evidence: {item.forecastEvidenceIds.join(", ") || "unavailable"} · outcome evidence: {item.outcomeEvidenceIds.join(", ") || "unavailable"}. {item.forecastAssumption}
            </p>)}
            </> : <p className="op-body-sm">No compatible cumulative utilisation projection/outcome pair is available; missing or incompatible evidence is not treated as zero.</p>}
            {Object.entries(backtest.utilisationValueEvaluation?.excludedReasons || {}).map(([reason, count]) => <p key={reason} className="op-body-sm">Value comparison excluded {count}: {reason.replaceAll("_", " ")}.</p>)}
            {Object.entries(backtest.utilisationValueEvaluation?.excludedByCategory || {}).map(([category, count]) => <p key={category} className="op-body-sm">Eligibility classification · {category.replaceAll("_", " ")}: {count}.</p>)}
            {(backtest.utilisationValueEvaluation?.limitations || []).map((limitation) => <p key={limitation} className="op-body-sm">{limitation}</p>)}
          </div>
        </>}
      </div>
    </section>
  );
}
