import React, { useEffect, useRef, useState } from "react";
import { decideAviationLeaseRecommendation, getAviationLeaseRiskAssessment } from "../../lib/contractsApi";
import { EmptyState } from "../ui/States";
import AviationOutcomeHistory from "./AviationOutcomeHistory";

function sourceLabel(source) {
  return [
    source.documentName,
    source.versionNumber ? `version ${source.versionNumber}` : null,
    source.sourceLocator,
    source.pageNumber ? `page ${source.pageNumber}` : null,
    source.reviewStatus ? `source ${source.reviewStatus}` : null,
    source.confidence !== null && source.confidence !== undefined && Number.isFinite(Number(source.confidence))
      ? `extraction confidence ${Math.round(Number(source.confidence) * 100)}%`
      : null,
  ].filter(Boolean).join(" · ");
}

function RiskEvidence({ title, items }) {
  if (!items?.length) return <p className="op-body-sm">No linked evidence excerpt is available.</p>;
  return (
    <div style={{ marginTop: "var(--op-space-2)" }}>
      <p className="op-kicker">{title}</p>
      {items.map((item) => (
        <div key={item.evidenceId} className="op-surface-plane-secondary" style={{ padding: "var(--op-space-2)", marginTop: "var(--op-space-1)" }}>
          {sourceLabel(item) && <p className="op-body-sm">{sourceLabel(item)}</p>}
          {item.ambiguityReason && <p className="op-body-sm">Uncertainty: {item.ambiguityReason}</p>}
          {item.relationship && <p className="op-body-sm">{item.relationship} · period {item.periodStatus}</p>}
          {item.excerpt && <p className="op-body-sm">“{item.excerpt}”</p>}
        </div>
      ))}
    </div>
  );
}

function UtilisationForecast({ forecast, label }) {
  if (!forecast) return null;
  const canProject = ["forecast_available", "threshold_reached"].includes(forecast.status);
  return (
    <section className="op-surface-plane-secondary" style={{ padding: "var(--op-space-2)", marginTop: "var(--op-space-2)" }} aria-label={`${label} predicted future exposure`}>
      <p className="op-kicker">Predicted future exposure — estimate, not a probability</p>
      <p className="op-body-sm">Forecast reliability: {forecast.forecastReliability?.replaceAll("_", " ") || forecast.status.replaceAll("_", " ")}</p>
      {canProject ? <>
        <p className="op-body-sm">
          Latest verified cumulative utilisation: {forecast.currentVerifiedUtilisation.toLocaleString()} {label} as of {forecast.lastObservedDate}.
        </p>
        <p className="op-body-sm">
          Historical average: {forecast.averageDailyConsumption.toLocaleString(undefined, { maximumFractionDigits: 4 })} {label} per calendar day · trend {forecast.historicalTrend.replaceAll("_", " ")} · {forecast.evidenceCoverage.observationCount} observations.
        </p>
        {forecast.projectedThresholdDate
          ? <p className="op-body-sm">Estimated threshold date: {forecast.projectedThresholdDate} ({forecast.estimatedDaysToThreshold} days after the last observation).</p>
          : <p className="op-body-sm">The latest verified cumulative reading is at or above the contractual threshold; no future crossing date was projected.</p>}
        {forecast.deadlineComparison && <p className="op-body-sm">
          Compared with verified contractual deadline {forecast.deadlineComparison.deadlineDate}: the threshold is estimated to be reached {forecast.deadlineComparison.projectedToReachBeforeDeadline ? "on or before" : "after"} that date.
        </p>}
        {forecast.observations.map((observation) => (
          <p key={`${observation.start}:${observation.end}`} className="op-body-sm">
            Verified cumulative reading: {observation.cumulativeUtilisation.toLocaleString()} {label} · period {observation.start} to {observation.end}.
          </p>
        ))}
        <p className="op-body-sm">{forecast.forecastAssumption}</p>
      </> : <p className="op-body-sm">Forecast unavailable: {forecast.reason || forecast.status.replaceAll("_", " ")} No projection was produced.</p>}
      <p className="op-body-sm">Any supported current or projected charge calculation is displayed separately below and uses the exact verified lease terms and evidence. A projection is not an incurred liability, invoice, or legal advice.</p>
      <RiskEvidence title="Historical forecast source evidence" items={forecast.sources} />
    </section>
  );
}

function UtilisationFinancialExposure({ exposure }) {
  if (!exposure) return null;
  const money = (item) => item?.amount === null || item?.amount === undefined
    ? "Not calculated"
    : `${item.currency || exposure.currency || ""} ${Number(item.amount).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
  const provision = exposure.contractualProvision;
  return (
    <section className="op-surface-plane-secondary" style={{ padding: "var(--op-space-2)", marginTop: "var(--op-space-2)" }} aria-label="Aircraft lease contractual financial exposure">
      <p className="op-kicker">Contractual financial exposure — informational, not a confirmed liability</p>
      <p className="op-body-sm">Assessment status: {exposure.status.replaceAll("_", " ")} · calculated {exposure.calculationDate || "date unavailable"}</p>
      {provision ? <>
        <p className="op-body-sm"><strong>Verified contractual provision:</strong> {provision.rate.currency} {provision.rate.amount.toLocaleString()} per {provision.unit.replace("_", " ")} above the {provision.allowance.toLocaleString()} {provision.unit.replace("_", " ")} allowance · {provision.measurementPeriod}.</p>
        <p className="op-body-sm">Source clause: {provision.clauseNumber || provision.clauseId || "identified clause"} · contract version {provision.contractVersionId || "unavailable"}.</p>
        {provision.cap && <p className="op-body-sm">Verified same-unit contractual cap: {provision.cap.currency} {provision.cap.amount.toLocaleString()} per {provision.cap.measurementPeriod || provision.measurementPeriod}.</p>}
        <RiskEvidence title="Verified financial provision evidence" items={provision.evidence} />
      </> : <p className="op-body-sm">Verified contractual rate, allowance, currency, and source evidence are not all available. No industry rate or currency was substituted.</p>}
      <div className="op-surface" style={{ padding: "var(--op-space-2)", marginTop: "var(--op-space-2)" }}>
        <strong className="op-body">Current demonstrated exposure</strong>
        <p className="op-body-sm">{exposure.current?.status?.replaceAll("_", " ") || "not assessed"} · {money(exposure.current)}</p>
        {exposure.current?.calculation && <p className="op-body-sm">{exposure.current.calculation}</p>}
        {exposure.current?.reason && <p className="op-body-sm">{exposure.current.reason}</p>}
        {exposure.current?.sources?.length > 0 && <RiskEvidence title="Current utilisation evidence" items={exposure.current.sources} />}
      </div>
      <div className="op-surface" style={{ padding: "var(--op-space-2)", marginTop: "var(--op-space-2)" }}>
        <strong className="op-body">Projected financial exposure — estimate, not incurred</strong>
        <p className="op-body-sm">{exposure.projected?.status?.replaceAll("_", " ") || "not assessed"} · {money(exposure.projected)}</p>
        {exposure.projected?.measurementDate && <p className="op-body-sm">Contractual measurement date: {exposure.projected.measurementDate}</p>}
        {exposure.projected?.calculation && <p className="op-body-sm">{exposure.projected.calculation}</p>}
        {exposure.projected?.reason && <p className="op-body-sm">{exposure.projected.reason}</p>}
        {exposure.projected?.assumptions?.map((assumption) => <p key={assumption} className="op-body-sm">Assumption: {assumption}</p>)}
        {exposure.projected?.sources?.length > 0 && <RiskEvidence title="Projected utilisation source evidence" items={exposure.projected.sources} />}
      </div>
      <p className="op-body-sm">{exposure.reason || "Amounts are informational estimates, not invoices, incurred liabilities, accounting provisions, guaranteed payments, or legal advice."}</p>
      {exposure.limitations?.map((limitation) => <p key={limitation} className="op-body-sm">{limitation}</p>)}
    </section>
  );
}

function UtilisationExposure({ exposure, contractEvidence }) {
  if (!exposure?.metrics?.length) return null;
  const metricLabel = (unit) => unit === "flight_hours" ? "flight hours" : "flight cycles";
  return (
    <section className="op-surface-plane-secondary" style={{ padding: "var(--op-space-2)", marginTop: "var(--op-space-3)" }} aria-label="Aircraft lease utilisation exposure">
      <p className="op-kicker">Aircraft lease utilisation exposure — informational, not legal advice</p>
      <p className="op-body-sm" style={{ marginTop: "var(--op-space-1)" }}>
        Current exposure is based on reviewer-verified reporting-period evidence. The {exposure.approachingThresholdPercent}% consumed flag is separate from the historical-rate estimates below and is not a breach finding.
      </p>
      {exposure.metrics.map((metric) => (
        <div key={`${metric.direction || "maximum"}:${metric.unit}`} className="op-surface" style={{ padding: "var(--op-space-2)", marginTop: "var(--op-space-2)" }}>
          <strong className="op-body">{metricLabel(metric.unit)}</strong>
          {metric.direction === "minimum"
            ? <p className="op-body-sm">Contractual minimum: {metric.contractualMinimum === null ? "ambiguous in source clause" : `${metric.contractualMinimum.toLocaleString()} ${metricLabel(metric.unit)}`} · period {metric.contractualMeasurementPeriod || "not established"}</p>
            : <p className="op-body-sm">Contractual maximum: {metric.contractualLimit === null ? "ambiguous in source clause" : `${metric.contractualLimit.toLocaleString()} ${metricLabel(metric.unit)}`} · period {metric.contractualMeasurementPeriod || "not established"}</p>}
          {["within_limit", "approaching", "at_limit", "exceeded", "below_minimum", "at_minimum", "above_minimum", "minimum_period_incomplete"].includes(metric.status) ? <>
            <p className="op-body-sm">Verified recorded utilisation: {metric.recordedUtilisation.toLocaleString()} {metricLabel(metric.unit)}</p>
            {metric.direction === "minimum"
              ? <p className="op-body-sm">
                {metric.status === "minimum_period_incomplete"
                  ? "Reporting period does not establish a complete contractual minimum period; no shortfall comparison was made."
                  : metric.status === "below_minimum"
                  ? `Recorded amount is ${metric.remainingRequirement.toLocaleString()} ${metricLabel(metric.unit)} below the minimum`
                  : metric.status === "at_minimum"
                    ? "Recorded amount meets the minimum"
                    : "Recorded amount is above the minimum"}
                {" · "}{metric.status.replaceAll("_", " ")}. This is an operational comparison, not a breach or penalty finding.
              </p>
              : <p className="op-body-sm">
                Headroom (negative means above cap): {metric.headroom.toLocaleString()} {metricLabel(metric.unit)} · {metric.consumedPercent === null ? "percentage not calculable" : `${metric.consumedPercent}% consumed`} · {metric.status.replaceAll("_", " ")}
              </p>}
            <p className="op-body-sm">Reporting period: {metric.reportingPeriod.start} to {metric.reportingPeriod.end}</p>
            {metric.sources.map((source) => (
              <p key={source.evidenceId} className="op-body-sm">
                Usage source: {[source.documentName, source.versionNumber ? `version ${source.versionNumber}` : null, source.sourceLocator, source.pageNumber ? `page ${source.pageNumber}` : null].filter(Boolean).join(" · ") || source.evidenceId}
              </p>
            ))}
          </> : <p className="op-body-sm">Recorded utilisation unavailable: {metric.reason || metric.status.replaceAll("_", " ")}. No headroom or percentage was calculated.</p>}
          <UtilisationForecast forecast={metric.forecast} label={metricLabel(metric.unit)} />
          <UtilisationFinancialExposure exposure={metric.financialExposure} />
        </div>
      ))}
      <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>
        Contractual limits are grounded in the cited source clause below; recorded values are shown only from verified, period-matched supporting evidence.
      </p>
      <RiskEvidence title="Contractual limit source" items={contractEvidence} />
    </section>
  );
}

export default function AviationLeaseRiskAssessment({ analysisRunId, organizationId, onAssessmentChange, canReview = false }) {
  const [result, setResult] = useState(null);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [decisionNotes, setDecisionNotes] = useState({});
  const [savingKey, setSavingKey] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const requestScope = useRef("");

  useEffect(() => {
    let active = true;
    requestScope.current = `${organizationId}:${analysisRunId}`;
    setState("loading");
    setError("");
    setDecisionError("");
    setDecisionNotes({});
    setSavingKey("");
    onAssessmentChange?.(null);
    getAviationLeaseRiskAssessment(analysisRunId, organizationId)
      .then((response) => {
        if (!active) return;
        setResult(response);
        onAssessmentChange?.(response);
        setState("ready");
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message || "Aviation lease risk assessment is unavailable.");
        onAssessmentChange?.(null);
        setState("error");
      });
    return () => { active = false; };
  }, [analysisRunId, organizationId]);

  async function submitDecision(recommendation, status) {
    const explanation = decisionNotes[recommendation.recommendation_key]?.trim();
    if (!explanation) {
      setDecisionError("Add a short reason before recording this recommendation decision.");
      return;
    }
    setSavingKey(recommendation.recommendation_key);
    setDecisionError("");
    try {
      const response = await decideAviationLeaseRecommendation(
        analysisRunId,
        recommendation.recommendation_key,
        organizationId,
        { status, explanation }
      );
      if (requestScope.current !== `${organizationId}:${analysisRunId}`) return;
      if (!response?.recommendation) throw new Error("The recommendation changed before the decision could be refreshed.");
      const updatedResult = {
        ...result,
        recommendations: (result?.recommendations || []).map((item) => (
          item.recommendation_key === recommendation.recommendation_key
            ? response.recommendation
            : item
        )),
      };
      setResult(updatedResult);
      onAssessmentChange?.(updatedResult);
      setDecisionNotes((current) => ({ ...current, [recommendation.recommendation_key]: "" }));
    } catch (requestError) {
      if (requestScope.current !== `${organizationId}:${analysisRunId}`) return;
      setDecisionError(requestError.message || "The recommendation decision could not be saved.");
    } finally {
      if (requestScope.current === `${organizationId}:${analysisRunId}`) setSavingKey("");
    }
  }

  const currentRecommendations = (result?.recommendations || []).filter((item) => item.is_current);
  const historicalRecommendations = (result?.recommendations || []).filter((item) => !item.is_current);

  return (
    <section className="op-surface-plane-primary" style={{ padding: "var(--op-space-4)", marginBottom: "var(--op-space-4)" }}>
      <h3 className="op-heading-sm">Aviation lease obligation exposure</h3>
      <p className="op-body-sm" style={{ marginTop: "var(--op-space-1)" }}>
        Deterministic review of lease obligations, deadlines, and human-assessed operational evidence. Priority indicates review urgency, not breach or probability.
      </p>
      {state === "loading" ? <p className="op-body-sm" role="status" style={{ marginTop: "var(--op-space-3)" }}>Reviewing lease evidence and deadlines…</p>
        : state === "error" ? <p className="op-body-sm" role="alert" style={{ marginTop: "var(--op-space-3)", color: "var(--op-signal-risk)" }}>{error}</p>
          : !result?.applicable ? <p className="op-body-sm" style={{ marginTop: "var(--op-space-3)" }}>{result?.reason || "This analysis is not a confirmed aircraft lease."}</p>
            : <>
              {!result.risks?.length && <EmptyState title="No open lease obligation exposure identified" description="No supported unresolved fulfilment or actionable deadline finding was identified from the available lease evidence." />}
              {result.risks?.length > 0 && <div className="op-grid" style={{ gap: "var(--op-space-3)", marginTop: "var(--op-space-3)" }}>
                {result.risks.map((risk) => {
                  const recommendation = currentRecommendations.find((item) => item.source_risk_key === risk.id);
                  return (
                    <article key={risk.id} className="op-surface" style={{ padding: "var(--op-space-3)" }}>
                      <div className="op-relationship-item">
                        <strong className="op-body">{risk.title}</strong>
                        <span className="op-badge">{risk.priority}</span>
                        <span className="op-badge">{risk.status.replaceAll("_", " ")}</span>
                      </div>
                      <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>{risk.description}</p>
                      <p className="op-body-sm" style={{ marginTop: "var(--op-space-1)" }}>{risk.rationale}</p>
                      <UtilisationExposure exposure={risk.utilisation_exposure} contractEvidence={risk.contract_evidence} />
                      <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>
                        Obligation status: {risk.assessment_status.replaceAll("_", " ")}
                        {risk.deadline_information && ` · Deadline ${risk.deadline_information.status.replaceAll("_", " ")}${risk.deadline_information.absoluteDate ? ` (${risk.deadline_information.absoluteDate})` : ""}`}
                      </p>
                      {risk.uncertainty_indicators.map((indicator) => <p key={indicator} className="op-body-sm" style={{ marginTop: "var(--op-space-1)" }}>Uncertainty: {indicator}</p>)}
                      <p className="op-kicker" style={{ marginTop: "var(--op-space-3)" }}>Suggested action — not a contractual requirement</p>
                      <p className="op-body-sm">{recommendation?.action || risk.recommended_action}</p>
                      {recommendation && <>
                        <p className="op-body-sm" style={{ marginTop: "var(--op-space-1)" }}>
                          Recommendation status: {recommendation.status.replaceAll("_", " ")} · Suggested owner: {recommendation.owner_role.replaceAll("_", " ").toLowerCase()}
                        </p>
                        <details style={{ marginTop: "var(--op-space-2)" }}>
                          <summary className="op-body-sm">Why this action is suggested</summary>
                          <p className="op-body-sm" style={{ whiteSpace: "pre-wrap", marginTop: "var(--op-space-1)" }}>{recommendation.business_rationale}</p>
                        </details>
                        {!["rejected", "completed", "superseded"].includes(recommendation.status) && <>
                          <label className="op-body-sm" style={{ display: "block", marginTop: "var(--op-space-2)" }}>
                            Decision note
                            <textarea
                              value={decisionNotes[recommendation.recommendation_key] || ""}
                              onChange={(event) => setDecisionNotes((current) => ({
                                ...current,
                                [recommendation.recommendation_key]: event.target.value,
                              }))}
                              maxLength={2000}
                              rows={2}
                              style={{ display: "block", width: "100%", marginTop: "var(--op-space-1)" }}
                              aria-label={`Decision note for ${recommendation.action}`}
                            />
                          </label>
                          <div className="op-relationship-item" style={{ marginTop: "var(--op-space-2)" }}>
                            {recommendation.status === "suggested" && <button type="button" className="op-body-sm" disabled={Boolean(savingKey)} onClick={() => submitDecision(recommendation, "under_review")}>Start review</button>}
                            {["suggested", "under_review"].includes(recommendation.status) && <>
                              <button type="button" className="op-body-sm" disabled={Boolean(savingKey)} onClick={() => submitDecision(recommendation, "accepted")}>Accept</button>
                              <button type="button" className="op-body-sm" disabled={Boolean(savingKey)} onClick={() => submitDecision(recommendation, "rejected")}>Reject</button>
                            </>}
                            {recommendation.status === "accepted" && <button type="button" className="op-body-sm" disabled={Boolean(savingKey)} onClick={() => submitDecision(recommendation, "completed")}>Mark completed</button>}
                          </div>
                        </>}
                        {recommendation.decision_history?.length > 0 && <details style={{ marginTop: "var(--op-space-2)" }}>
                          <summary className="op-body-sm">Decision history ({recommendation.decision_history.length})</summary>
                          {recommendation.decision_history.map((item) => (
                            <p key={item.id} className="op-body-sm" style={{ marginTop: "var(--op-space-1)" }}>
                              {item.status.replaceAll("_", " ")} · {item.actor_type === "human" ? "reviewer recorded" : "system suggested"} · {item.explanation}
                            </p>
                          ))}
                        </details>}
                      </>}
                      <RiskEvidence title="Contract-source evidence" items={risk.contract_evidence} />
                      <RiskEvidence title="Operational evidence and human assessment" items={risk.operational_evidence} />
                      <button
                        type="button"
                        className="op-body-sm"
                        style={{ marginTop: "var(--op-space-2)" }}
                        onClick={() => document.getElementById(`obligation-${risk.obligation_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      >
                        View affected obligation
                      </button>
                      <button
                        type="button"
                        className="op-body-sm"
                        style={{ marginTop: "var(--op-space-2)", marginLeft: "var(--op-space-2)" }}
                        onClick={() => document.getElementById(`clause-${risk.clause_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      >
                        View source clause
                      </button>
                    </article>
                  );
                })}
              </div>}
              {historicalRecommendations.length > 0 && <section style={{ marginTop: "var(--op-space-4)" }}>
                <h4 className="op-heading-sm">Recommendation history</h4>
                {historicalRecommendations.map((item) => (
                  <article key={item.id} className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-2)" }}>
                    <div className="op-relationship-item">
                      <strong className="op-body">{item.status.replaceAll("_", " ")}</strong>
                      <span className="op-badge">{item.urgency}</span>
                    </div>
                    <p className="op-body-sm" style={{ marginTop: "var(--op-space-1)" }}>{item.action}</p>
                    <p className="op-body-sm" style={{ marginTop: "var(--op-space-1)" }}>
                      {item.status_explanation || "Earlier human/system decisions remain in the append-only history."}
                    </p>
                    <details style={{ marginTop: "var(--op-space-2)" }}>
                      <summary className="op-body-sm">Why this action was suggested</summary>
                      <p className="op-body-sm" style={{ whiteSpace: "pre-wrap", marginTop: "var(--op-space-1)" }}>{item.business_rationale}</p>
                    </details>
                    <RiskEvidence title="Supporting recommendation evidence" items={item.evidence} />
                    <button
                      type="button"
                      className="op-body-sm"
                      style={{ marginTop: "var(--op-space-2)" }}
                      onClick={() => document.getElementById(`obligation-${item.obligation_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    >
                      View affected obligation
                    </button>
                    <button
                      type="button"
                      className="op-body-sm"
                      style={{ marginTop: "var(--op-space-2)", marginLeft: "var(--op-space-2)" }}
                      onClick={() => document.getElementById(`clause-${item.clause_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    >
                      View source clause
                    </button>
                  </article>
                ))}
              </section>}
              <AviationOutcomeHistory
                analysisRunId={analysisRunId}
                organizationId={organizationId}
                assessment={result}
                canWrite={canReview}
              />
              {decisionError && <p className="op-body-sm" role="alert" style={{ marginTop: "var(--op-space-3)", color: "var(--op-signal-risk)" }}>{decisionError}</p>}
            </>}
    </section>
  );
}
