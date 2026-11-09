import React from "react";
import { Link } from "react-router-dom";
import ContractualExposureAssessment from "./ContractualExposureAssessment";

function workspacePath(contract, clauseId) {
  const query = contract.analysisRunId ? `?analysisRunId=${encodeURIComponent(contract.analysisRunId)}` : "";
  const anchor = clauseId ? `#clause-${encodeURIComponent(clauseId)}` : "#clauses";
  return `/app/contracts/${encodeURIComponent(contract.contractId)}${query}${anchor}`;
}

function formatAmount(amount, currency) {
  if (!Number.isFinite(amount) || !currency) return "Not calculated";
  return `${currency} ${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Evidence({ evidence }) {
  if (!evidence?.length) return <p className="op-body-sm">No verified evidence citation available.</p>;
  return (
    <ul className="op-body-sm">
      {evidence.map((item, index) => (
        <li key={`${item.evidenceId}-${index}`}>
          {item.evidenceType.replaceAll("_", " ")} · {item.sourceLocator || (item.pageNumber ? `page ${item.pageNumber}` : "source location unavailable")}
          {item.excerpt ? ` — “${item.excerpt}”` : ""}
        </li>
      ))}
    </ul>
  );
}

function Component({ item, contract }) {
  const currentFinancial = item.financialExposure?.current;
  const projectedFinancial = item.financialExposure?.projected;
  const projection = item.annualizedProjection;
  return (
    <article className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-2)" }}>
      <p className="op-body-sm">
        <strong>{item.factor.replaceAll("_", " ").toUpperCase()}</strong> · {item.status.replaceAll("_", " ")} · clause {item.clauseNumber || item.clauseId}
      </p>
      {item.kind === "external_sensitivity" && (
        <>
          <p className="op-body-sm">Contractual mechanism: {item.mechanism?.replaceAll("_", " ") || "review required"}</p>
          {item.observation ? (
            <p className="op-body-sm">
              <strong>VERIFIED OBSERVATION:</strong> {item.observation.freshnessStatus === "stale" ? "STALE — not current" : "Published observation"} · {item.observation.value} {item.observation.unit} · {item.observation.observationDate} · {item.observation.sourceName}
            </p>
          ) : <p className="op-body-sm"><strong>VERIFIED OBSERVATION:</strong> No matching observation is available; none is inferred.</p>}
          {item.contractualPayment?.amount !== null && item.contractualPayment && (
            <p className="op-body-sm">
              Contractual payment: {formatAmount(item.contractualPayment.amount, item.contractualPayment.currency)}
              {item.contractualPayment.dueDate ? ` · due ${item.contractualPayment.dueDate}` : " · payment date not established"}
            </p>
          )}
          {item.contractualRateTerms && (
            <p className="op-body-sm">
              Benchmark: {item.benchmark || "not established"} · spread: {item.contractualRateTerms.spreadBasisPoints === null ? "not established" : `${item.contractualRateTerms.spreadBasisPoints} bps`}
              {" · reset frequency: "}{item.contractualRateTerms.resetFrequency || "not established"}
            </p>
          )}
          {item.fuelExposure ? (
            <section className="op-surface" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-3)" }} aria-label="Contractual fuel-price adjustment assessment">
              <p className="op-body-sm"><strong>Fuel-price assessment:</strong> {item.fuelExposure.exposureClassification.replaceAll("_", " ")}</p>
              <p className="op-body-sm">{item.fuelExposure.explanation}</p>
              {item.fuelExposure.calculation ? (
                <>
                  <p className="op-body-sm">
                    Clause-derived adjustment: {formatAmount(item.fuelExposure.calculation.amount.value, item.fuelExposure.calculation.amount.currency)}
                    {" "}for the stated {item.fuelExposure.calculation.amount.period}; paying party: {item.fuelExposure.calculation.payingParty.replaceAll("_", " ")}.
                  </p>
                  <p className="op-body-sm">
                    Method {item.fuelExposure.calculation.methodology}: {item.fuelExposure.calculation.formula}
                  </p>
                  <p className="op-body-sm">
                    Baseline {item.fuelExposure.calculation.baselinePrice.amount} {item.fuelExposure.calculation.baselinePrice.unit}
                    {" · "}verified reference {item.fuelExposure.calculation.currentPrice.amount} {item.fuelExposure.calculation.currentPrice.unit}
                    {" · "}explicit volume {item.fuelExposure.calculation.volume.amount} {item.fuelExposure.calculation.volume.unit}
                    {" · "}pass-through {item.fuelExposure.calculation.passThroughPercent}%.
                  </p>
                </>
              ) : (
                <p className="op-body-sm">
                  Financial adjustment: not calculated. {item.fuelExposure.missingInputs.join("; ") || "Required contractual and observation inputs are unavailable."}
                </p>
              )}
              <p className="op-body-sm"><strong>Recommended action:</strong> {item.fuelExposure.recommendation.action}</p>
              <p className="op-body-sm">{item.fuelExposure.recommendation.expectedCommercialBenefit}</p>
              {item.fuelExposure.recommendation.supportingEvidenceIds.length > 0 && (
                <p className="op-body-sm">Supporting evidence: {item.fuelExposure.recommendation.supportingEvidenceIds.join(" · ")}</p>
              )}
              {item.fuelExposure.recommendation.limitations.map((limitation) => <p className="op-body-sm" key={limitation}>{limitation}</p>)}
              <p className="op-body-sm">This clause-derived calculation is not an invoice, forecast, net exposure, or legal conclusion.</p>
            </section>
          ) : (
            <p className="op-body-sm">External-variable financial impact: not calculated. {item.calculation?.missingInputs?.length ? `Missing: ${item.calculation.missingInputs.join(", ")}.` : ""}</p>
          )}
        </>
      )}
      {item.kind === "operational_utilisation" && (
        <>
          <p className="op-body-sm">
            {item.direction === "minimum" ? "Contractual minimum" : "Contractual maximum"}: {
              item.direction === "minimum"
                ? item.contractualMinimum === null ? "unavailable" : `${item.contractualMinimum.toLocaleString("en-GB")} ${item.unit.replaceAll("_", " ")}`
                : item.contractualLimit === null ? "unavailable" : `${item.contractualLimit.toLocaleString("en-GB")} ${item.unit.replaceAll("_", " ")}`
            }
            {item.contractualMeasurementPeriod ? ` · ${item.contractualMeasurementPeriod}` : " · measurement period not established"}
          </p>
          {item.current ? (
            <p className="op-body-sm">
              <strong>VERIFIED OPERATIONAL EXPOSURE:</strong> recorded {item.current.recordedUtilisation.toLocaleString("en-GB")} {item.unit.replaceAll("_", " ")}
              {item.direction === "minimum"
                ? item.current.remainingRequirement > 0
                  ? ` · ${item.current.remainingRequirement.toLocaleString("en-GB")} below minimum`
                  : ` · ${item.current.status.replaceAll("_", " ")}`
                : item.current.headroom !== null ? ` · remaining headroom ${item.current.headroom.toLocaleString("en-GB")}` : ""}
              {item.direction !== "minimum" && item.current.consumedPercent !== null ? ` · ${item.current.consumedPercent}% consumed` : ""}
              {item.current.reportingPeriod ? ` · period ${item.current.reportingPeriod.start} to ${item.current.reportingPeriod.end}` : ""}
            </p>
          ) : <p className="op-body-sm"><strong>CURRENT CONTRACTUAL EXPOSURE:</strong> recorded utilization is unavailable; no actual value is inferred.</p>}
          {item.deadline?.absoluteDate && (
            <p className="op-body-sm">Verified contractual deadline: {item.deadline.absoluteDate} · {item.deadline.daysRemaining === null ? "remaining time unavailable" : `${item.deadline.daysRemaining} day(s) remaining`}</p>
          )}
          {item.forecast ? (
            <p className="op-body-sm">
              <strong>PROJECTED EXPOSURE:</strong> {item.forecast.status.replaceAll("_", " ")}
              {item.forecast.estimatedThresholdDate ? ` · estimated threshold date ${item.forecast.estimatedThresholdDate}` : ""}
              {item.forecast.forecastAssumption ? ` · assumption: ${item.forecast.forecastAssumption}` : ""}
            </p>
          ) : <p className="op-body-sm"><strong>PROJECTED EXPOSURE:</strong> no supported forecast available.</p>}
          {projection && (
            <section className="op-surface" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-3)" }} aria-label="Deterministic calendar-year utilisation projection">
              <p className="op-body-sm">
                <strong>FORWARD-LOOKING UTILISATION:</strong> {projection.classification.replaceAll("_", " ")}
              </p>
              {projection.status === "projection_available" ? (
                <>
                  <p className="op-body-sm">
                    Verified calendar-year observations: {projection.historicalCoverage.coveredFrom} to {projection.historicalCoverage.coveredThrough} ({projection.historicalCoverage.observationCount} readings).
                    {" "}Observed annualized consumption rate: {projection.annualizedConsumptionRate.toLocaleString("en-GB")} {item.unit.replaceAll("_", " ")}/year.
                  </p>
                  <p className="op-body-sm">
                    Projected at {projection.horizon.end}: {projection.projectedUtilisationAtPeriodEnd.toLocaleString("en-GB")} {item.unit.replaceAll("_", " ")}
                    {" "}versus calendar-year allowance {projection.contractualLimit.toLocaleString("en-GB")} {item.unit.replaceAll("_", " ")}.
                    {projection.projectedExcessUnits > 0
                      ? ` Indicative overrun: ${projection.projectedExcessUnits.toLocaleString("en-GB")} ${item.unit.replaceAll("_", " ")}.`
                      : projection.projectedShortfallUnits > 0
                        ? ` Indicative minimum shortfall: ${projection.projectedShortfallUnits.toLocaleString("en-GB")} ${item.unit.replaceAll("_", " ")}.`
                        : ""}
                  </p>
                  <div role="group" aria-label="Recorded and projected utilization compared with the contractual allowance">
                    <p className="op-body-sm">Recorded to date: {item.current.recordedUtilisation.toLocaleString("en-GB")} / {projection.contractualLimit.toLocaleString("en-GB")}</p>
                    <progress aria-label="Recorded utilization against allowance" max={projection.contractualLimit} value={Math.min(item.current.recordedUtilisation, projection.contractualLimit)} />
                    <p className="op-body-sm">Projected period end: {projection.projectedUtilisationAtPeriodEnd.toLocaleString("en-GB")} / {projection.contractualLimit.toLocaleString("en-GB")}</p>
                    <progress aria-label="Projected utilization against allowance" max={projection.contractualLimit} value={Math.min(projection.projectedUtilisationAtPeriodEnd, projection.contractualLimit)} />
                  </div>
                  <p className="op-body-sm">
                    Projection horizon: {projection.horizon.start} to {projection.horizon.end} ({projection.horizon.days} day(s)); method {projection.methodologyVersion}.
                  </p>
                  {projection.assumptions.map((assumption) => <p className="op-body-sm" key={assumption}>Assumption: {assumption}</p>)}
                </>
              ) : (
                <p className="op-body-sm">
                  No contractual-period projection is available. {projection.missingInformation.join("; ") || "The contractual period is complete."}
                </p>
              )}
              {projection.limitations.map((limitation) => <p className="op-body-sm" key={limitation}>{limitation}</p>)}
              <Evidence evidence={projection.evidence} />
            </section>
          )}
          {currentFinancial && <p className="op-body-sm">Phase 56 current financial assessment: {formatAmount(currentFinancial.amount, currentFinancial.currency)} · {currentFinancial.status.replaceAll("_", " ")}</p>}
          {projectedFinancial && <p className="op-body-sm">Phase 56 projected financial assessment: {formatAmount(projectedFinancial.amount, projectedFinancial.currency)} · {projectedFinancial.status.replaceAll("_", " ")}</p>}
          {item.uncertainty?.map((reason) => <p className="op-body-sm" key={reason}>{reason}</p>)}
        </>
      )}
      {item.kind === "contractual_financial_exposure" && (
        <p className="op-body-sm">
          {item.status === "currently_demonstrated_exposure" ? "CURRENT CONTRACTUAL EXPOSURE" : "PROJECTED EXPOSURE"}: {formatAmount(item.amount, item.currency)} · {item.unit.replaceAll("_", " ")}
          {item.measurementPeriod ? ` · period ${typeof item.measurementPeriod === "string" ? item.measurementPeriod : JSON.stringify(item.measurementPeriod)}` : ""}
        </p>
      )}
      {item.observation?.sourceReference && (
        <p className="op-body-sm">
          Source record: {item.observation.sourceId} · retrieved {item.observation.retrievalTimestamp}
          {item.observation.publicationTimestamp ? ` · published ${item.observation.publicationTimestamp}` : ""}
          {item.observation.marketApplicability ? ` · ${item.observation.marketApplicability}` : ""}
          {item.observation.updateStatus === "revision" ? " · source revision retained" : ""}
        </p>
      )}
      {item.action && <p className="op-body-sm">Action to consider: {item.action}</p>}
      <ContractualExposureAssessment assessment={item.exposureAssessment} />
      <Evidence evidence={item.evidence} />
      {item.current?.evidence?.length > 0 && <Evidence evidence={item.current.evidence} />}
      {item.forecast?.evidence?.length > 0 && <Evidence evidence={item.forecast.evidence} />}
      {currentFinancial?.evidence?.length > 0 && <Evidence evidence={currentFinancial.evidence} />}
      {projectedFinancial?.evidence?.length > 0 && <Evidence evidence={projectedFinancial.evidence} />}
      <Link className="op-btn op-btn-quiet" to={workspacePath(contract, item.clauseId)}>Open supporting contract and clause</Link>
    </article>
  );
}

function EarlyWarning({ warning }) {
  const { contract, trigger, result, recommendation } = warning;
  return (
    <article className="op-surface" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-2)" }}>
      <p className="op-body-sm">
        <strong>{warning.status.replaceAll("_", " ")}</strong> · {warning.category.replaceAll("_", " ")} · {contract.contractTitle} · clause {warning.clause.clauseNumber || warning.clause.clauseId}
      </p>
      <p className="op-body-sm">
        {warning.obligation.linkStatus === "verified_link"
          ? `Verified obligation: ${warning.obligation.description || warning.obligation.obligationId}`
          : "No verified extracted obligation is linked; the review signal is informational and evidence is insufficient for obligation-level conclusions."}
      </p>
      {trigger.kind === "fx_reference_movement" && (
        <>
          <p className="op-body-sm">
            Reference comparison: {trigger.previousRate ?? "unavailable"} → {trigger.currentRate ?? "unavailable"} {trigger.unit || ""} · {trigger.fromObservationDate || "no prior date"} to {trigger.toObservationDate || "no current date"}.
          </p>
          {result.referenceEquivalentChange && (
            <p className="op-body-sm">
              One-payment reference EUR-equivalent change: {formatAmount(result.referenceEquivalentChange.amount, result.referenceEquivalentChange.currency)} · {result.referenceEquivalentChange.direction}. This is not a transaction value or incurred loss.
            </p>
          )}
          {trigger.kind === "fuel_price_adjustment" && (
            <p className="op-body-sm">
              Fuel adjustment: {result.financialAdjustment
                ? `${formatAmount(result.financialAdjustment.amount, result.financialAdjustment.currency)} for the stated ${result.financialAdjustment.period}`
                : "not calculated"}
              {trigger.currentPrice ? ` · reference ${trigger.currentPrice.amount} ${trigger.currentPrice.unit} on ${trigger.currentPrice.observationDate}` : ""}
              {trigger.baselinePrice ? ` · clause baseline ${trigger.baselinePrice.amount} ${trigger.baselinePrice.unit}` : ""}
              . Not an invoice amount or net recoverable exposure.
            </p>
          )}
        </>
      )}
      {trigger.reportingPeriod && (
        <p className="op-body-sm">
          Utilisation: {result.recordedUtilisation === null ? "not available" : `${result.recordedUtilisation.toLocaleString("en-GB")} ${result.unit?.replaceAll("_", " ") || ""}`}
          {result.contractualLimit === null ? "" : ` / ${result.contractualLimit.toLocaleString("en-GB")} ${result.unit?.replaceAll("_", " ") || ""}`}
          {result.headroom === null ? "" : ` · headroom ${result.headroom.toLocaleString("en-GB")}`}
          {result.consumedPercent === null ? "" : ` · ${result.consumedPercent}% consumed`}
          {` · period ${trigger.reportingPeriod.start} to ${trigger.reportingPeriod.end}`}
        </p>
      )}
      {result.annualizedProjection && (
        <p className="op-body-sm">
          Deterministic calendar-year projection: {result.annualizedProjection.projectedUtilisationAtPeriodEnd.toLocaleString("en-GB")} {result.unit?.replaceAll("_", " ") || ""} by {result.annualizedProjection.horizon.end}, versus allowance {result.annualizedProjection.contractualLimit.toLocaleString("en-GB")}. Method {result.annualizedProjection.methodologyVersion}; constant-rate assumption, not a breach or penalty finding.
        </p>
      )}
      <p className="op-body-sm"><strong>Risk identified:</strong> {recommendation.riskIdentified}</p>
      <p className="op-body-sm"><strong>Potential consequence:</strong> {recommendation.potentialConsequence}</p>
      <p className="op-body-sm"><strong>Action to consider:</strong> {recommendation.proposedAction}</p>
      {recommendation.missingInformation.length > 0 && (
        <p className="op-body-sm"><strong>Outstanding information:</strong> {recommendation.missingInformation.join("; ")}</p>
      )}
      <Evidence evidence={recommendation.supportingEvidence} />
      <Link className="op-btn op-btn-quiet" to={workspacePath(contract, warning.clause.clauseId)}>
        Open cited contract clause
      </Link>
    </article>
  );
}

function ProbabilisticReadiness({ assessment }) {
  if (!assessment) return null;
  return (
    <details className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-3)" }}>
      <summary className="op-body-sm">
        Probabilistic forecast: not produced · deterministic findings retained
      </summary>
      <p className="op-body-sm">
        Bayesian update and Monte Carlo simulation were not run. No prior, likelihood, input distribution, or probability has been invented.
      </p>
      <p className="op-body-sm">
        Assessment basis: contract version {assessment.basis.documentVersionId} · generated {assessment.generatedOn} · readiness rules {assessment.modelVersion}.
      </p>
      <p className="op-body-sm">
        {assessment.assumptionDisclosure.contractualFacts} {assessment.assumptionDisclosure.statisticalAssumptions} {assessment.assumptionDisclosure.hypotheticalInputs} {assessment.assumptionDisclosure.modelGeneratedEstimates}
      </p>
      {assessment.evidenceDimensions.map((dimension) => (
        <p className="op-body-sm" key={dimension.name}>
          <strong>{dimension.name.replaceAll("_", " ")}:</strong> {dimension.status.replaceAll("_", " ")} — {dimension.reason}
        </p>
      ))}
      {assessment.historicalObservationCoverage.map((coverage) => (
        <p className="op-body-sm" key={coverage.indicatorId}>
          <strong>{coverage.indicatorId} history:</strong> {coverage.status.replaceAll("_", " ")} · {coverage.observationCount} distinct date(s) · {coverage.oldestObservationDate || "no start"} to {coverage.latestObservationDate || "no latest date"} · max gap {coverage.maximumObservedGapDays === null ? "unknown" : `${coverage.maximumObservedGapDays} day(s)`} · {coverage.duplicateDateCount} duplicate date(s) · {coverage.revisionRecordCount} revision(s)
        </p>
      ))}
      {assessment.operationalObservationCoverage.map((coverage) => (
        <p className="op-body-sm" key={`${coverage.clauseId}:${coverage.unit}`}>
          <strong>Utilisation history, clause {coverage.clauseId}:</strong> {coverage.observationCount} cited {coverage.unit.replaceAll("_", " ")} observation(s) · {coverage.coveredFrom} to {coverage.coveredThrough} · reporting periods {coverage.reportingPeriodsContiguous ? "verified contiguous" : "not verified contiguous"}
        </p>
      ))}
      <p className="op-body-sm">
        <strong>Contractual outcome history:</strong> {assessment.contractualOutcomeHistory.status.replaceAll("_", " ")} — {assessment.contractualOutcomeHistory.reason}
      </p>
      <p className="op-body-sm">
        <strong>Forecast evaluation:</strong> {assessment.forecastEvaluation.status.replaceAll("_", " ")} — {assessment.forecastEvaluation.reason}
      </p>
      {assessment.nextActions.map((action) => (
        <p className="op-body-sm" key={action}>Action to consider: {action}</p>
      ))}
    </details>
  );
}

export default function AviationPredictiveContractRisk({ assessment }) {
  if (!assessment) return null;
  return (
    <section className="op-surface-plane-primary" style={{ padding: "var(--op-space-4)", marginTop: "var(--op-space-4)" }} aria-label="Predictive contract risk correlation">
      <p className="op-kicker">Evidence-backed correlation · no probability score</p>
      <h3 className="op-heading-md">Predictive contract risk</h3>
      <p className="op-body-sm">
        {assessment.coverage.componentCount} supported component(s) across {assessment.coverage.contractCount} current analysis group(s); {assessment.coverage.multiComponentContractCount} group(s) contain multiple components.
        Components are not added together unless a verified contractual calculation method supports it.
      </p>
      <section className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-3)" }} aria-label="Evidence-derived early warnings">
        <h4 className="op-heading-sm">Evidence-derived early warnings</h4>
        <p className="op-body-sm">
          Derived on explicit reassessment from stored verified observations and current-version contract evidence. Calendar-year utilisation projections are deterministic assumptions, not probabilistic forecasts or determinations of breach, loss, or penalty.
        </p>
        {assessment.earlyWarnings?.length
          ? assessment.earlyWarnings.map((warning) => <EarlyWarning key={warning.id} warning={warning} />)
          : <p className="op-body-sm">No supported FX, fuel-price, or utilisation review signal is available in this assessment.</p>}
      </section>
      <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-3)" }}>
        <p className="op-body-sm">
          <strong>Probabilistic forecasts:</strong> {assessment.probabilisticReadiness.forecastCount} produced across {assessment.probabilisticReadiness.assessedContractCount} assessed contract group(s). Existing deterministic values remain unchanged and currencies are not combined.
        </p>
        {assessment.probabilisticReadiness.evidenceGaps.map((gap) => (
          <p className="op-body-sm" key={`${gap.dimension}:${gap.status}`}>
            {gap.dimension.replaceAll("_", " ")} · {gap.status.replaceAll("_", " ")} · {gap.contractCount} contract group(s)
          </p>
        ))}
      </div>
      {assessment.contracts.map((contract) => (
        <article className="op-surface" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-3)" }} key={`${contract.contractId}:${contract.analysisRunId}:${contract.documentVersionId}`}>
          <p className="op-body-sm"><strong>{contract.contractTitle}</strong> · {contract.priority.level.replaceAll("_", " ")}</p>
          <p className="op-body-sm">{contract.priority.reason}</p>
          <ProbabilisticReadiness assessment={contract.probabilisticReadiness} />
          {contract.recommendation && (
            <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)" }}>
              <p className="op-body-sm"><strong>{contract.recommendation.title}</strong></p>
              <p className="op-body-sm">{contract.recommendation.action}</p>
              <p className="op-body-sm">{contract.recommendation.uncertainty}</p>
              {contract.recommendation.observations.map((observation, index) => (
                <p className="op-body-sm" key={`${observation.indicatorId}-${index}`}>
                  Supporting observation: {observation.value} {observation.unit} · {observation.observationDate} · {observation.sourceName}
                </p>
              ))}
              {contract.recommendation.supportedFinancialAssessments.map((item, index) => (
                <p className="op-body-sm" key={`${item.clauseId}-${item.type}-${index}`}>
                  Existing {item.type} assessment: {formatAmount(item.amount, item.currency)} · clause {item.clauseId}; not added to other components.
                </p>
              ))}
            </div>
          )}
          {contract.components.map((item) => <Component key={item.id} item={item} contract={contract} />)}
          {contract.interactions.map((interaction, index) => (
            <p className="op-body-sm" key={`${interaction.classification}-${index}`}>
              Interaction {interaction.classification.replaceAll("_", " ")}: {interaction.reason}
            </p>
          ))}
        </article>
      ))}
      {assessment.portfolio.indicatorGroups.map((group) => (
        <p className="op-body-sm" key={group.indicatorId}>
          Shared verified indicator {group.indicatorId} appears in {group.contractIds.length} contracts; this is a source grouping, not a financial concentration or loss estimate.
        </p>
      ))}
      {assessment.portfolio.currencyObligationGroups.map((group) => (
        <div className="op-body-sm" key={group.currency}>
          <strong>{group.currency} obligations:</strong> {group.obligations.length} cited payment(s); individual amounts are retained, not summed or converted.
          {group.obligations.map((item, index) => (
            <p className="op-body-sm" key={`${item.contractId}-${item.clauseId}-${index}`}>
              {formatAmount(item.amount, group.currency)} · {item.dueDate || "date not established"} · clause {item.clauseId}
            </p>
          ))}
        </div>
      ))}
      {assessment.portfolio.confirmedAircraftGroups.map((group) => (
        <p className="op-body-sm" key={group.aircraftId}>
          Confirmed aircraft {group.registration || group.serialNumber || group.aircraftId} has evidence-linked components across {group.contractIds.length} contract(s); amounts are not added here.
        </p>
      ))}
      {assessment.sensitivity.status !== "calculated" && (
        <details style={{ marginTop: "var(--op-space-3)" }}>
          <summary className="op-body-sm">Sensitivity and model limitations</summary>
          <p className="op-body-sm">{assessment.sensitivity.reason}</p>
          {assessment.sensitivity.unavailableInputs.map((item) => <p className="op-body-sm" key={item}>{item}</p>)}
        </details>
      )}
      {assessment.coverage.externalProvisionsTruncated && <p className="op-body-sm" role="status">External provision retrieval reached its safety limit; results are incomplete.</p>}
      {(assessment.coverage.portfolioRunsTruncated || assessment.coverage.portfolioRelationshipsTruncated) && (
        <p className="op-body-sm" role="status">Portfolio retrieval reached a safety limit; results are incomplete.</p>
      )}
    </section>
  );
}
