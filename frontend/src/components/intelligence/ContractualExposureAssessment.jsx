import React from "react";

export default function ContractualExposureAssessment({ assessment }) {
  if (!assessment) return null;
  return (
    <section className="op-surface" style={{ padding: "var(--op-space-2)", marginTop: "var(--op-space-2)" }} aria-label="Standardized contractual exposure assessment">
      <p className="op-body-sm"><strong>Assessment framework v{assessment.frameworkVersion} · {assessment.category.replaceAll("_", " ")}</strong></p>
      <p className="op-body-sm">
        Assessed {new Date(assessment.assessmentTimestamp).toLocaleString("en-GB")}
        {assessment.assessmentAsOf ? ` · evidence as of ${assessment.assessmentAsOf}` : ""}
        {" · "}{assessment.methodology.description}
      </p>
      <p className="op-body-sm">
        Contract {assessment.contract.contractId} · version {assessment.contract.documentVersionId} · methodology {assessment.methodology.id}
        {assessment.methodology.version ? ` (${assessment.methodology.version})` : ""}
      </p>
      <p className="op-body-sm">
        Evidence freshness: {assessment.dataFreshness.status.replaceAll("_", " ")}
        {assessment.dataFreshness.latestObservationDate ? ` · latest observation ${assessment.dataFreshness.latestObservationDate}` : ""}
        {assessment.dataFreshness.ageDays !== null ? ` · ${assessment.dataFreshness.ageDays} day(s) old` : ""}
        {assessment.dataFreshness.maxAgeDays !== null ? ` · policy ${assessment.dataFreshness.maxAgeDays} days` : ""}
        {assessment.dataFreshness.sourceName ? ` · ${assessment.dataFreshness.sourceName}` : ""}
      </p>
      <p className="op-body-sm">
        Obligation: {assessment.obligation.description || "No specific extracted obligation is linked to this clause."}
        {" · "}clause {assessment.clause.clauseNumber || assessment.clause.clauseId}
      </p>
      {assessment.calculationInputs.contractualFacts.map((fact, index) => (
        <p className="op-body-sm" key={`${fact.type}-${index}`}>
          Contractual fact: {fact.type.replaceAll("_", " ")}
          {fact.value !== undefined ? ` · ${fact.value} ${fact.unit || ""}` : ""}
          {fact.amount !== undefined ? ` · ${fact.amount} ${fact.currency || ""}` : ""}
          {fact.measurementPeriod ? ` · ${fact.measurementPeriod}` : ""}
        </p>
      ))}
      {assessment.calculationInputs.verifiedObservations.map((observation, index) => (
        <p className="op-body-sm" key={`${observation.type || observation.indicatorId}-${index}`}>
          Verified observation: {observation.value} {observation.unit}
          {observation.observationDate ? ` · ${observation.observationDate}` : ""}
          {observation.reportingPeriod ? ` · period ${observation.reportingPeriod.start} to ${observation.reportingPeriod.end}` : ""}
          {observation.status ? ` · ${observation.status.replaceAll("_", " ")}` : ""}
        </p>
      ))}
      {assessment.calculationInputs.userAssumptions.map((assumption, index) => (
        <p className="op-body-sm" key={`${assumption.type}-${index}`}>
          User assumption: {assumption.label || assumption.assumption || assumption.quotePerEur}
          {assumption.unit ? ` ${assumption.unit}` : ""}
        </p>
      ))}
      {assessment.result.operational && (
        <p className="op-body-sm">
          Deterministic operational result: {assessment.result.operational.recordedUtilisation} {assessment.result.operational.unit}
          {assessment.result.operational.contractualThreshold !== null
            ? ` · ${assessment.result.operational.direction} ${assessment.result.operational.contractualThreshold}`
            : ""}
          {assessment.result.operational.headroom !== null
            ? ` · remaining headroom ${assessment.result.operational.headroom}`
            : assessment.result.operational.remainingRequirement !== null
              ? ` · ${assessment.result.operational.remainingRequirement} below minimum`
              : ""}
        </p>
      )}
      {assessment.result.financial.map((result, index) => (
        <p className="op-body-sm" key={`${result.kind || result.status}-${index}`}>
          Financial result: {result.kind?.replaceAll("_", " ") || result.status?.replaceAll("_", " ")}
          {Number.isFinite(result.amount) ? ` · ${result.amount} ${result.currency || ""}` : ` · ${result.reason || "not calculated"}`}
        </p>
      ))}
      {assessment.result.projection && (
        <p className="op-body-sm">
          Existing deterministic projection: {assessment.result.projection.status?.replaceAll("_", " ") || "available"}
          {assessment.result.projection.estimatedThresholdDate ? ` · estimated threshold ${assessment.result.projection.estimatedThresholdDate}` : ""}
          {assessment.result.projection.assumption ? ` · assumption: ${assessment.result.projection.assumption}` : ""}
        </p>
      )}
      <p className="op-body-sm">Risk identified: {assessment.recommendation.riskIdentified}</p>
      <p className="op-body-sm">Potential consequence: {assessment.recommendation.potentialConsequence}</p>
      <p className="op-body-sm">
        Priority: {assessment.priority.level.replaceAll("_", " ")} — {assessment.priority.basis}
        {" · "}severity: not scored.
      </p>
      <p className="op-body-sm">Proposed action: {assessment.recommendation.proposedAction} Advisory only; not legal advice.</p>
      <p className="op-body-sm">Potential benefit: {assessment.recommendation.expectedBenefit}</p>
      <p className="op-body-sm">
        Decision status: recommendation only; human review required; no action is recorded as approved or performed.
      </p>
      {Object.entries(assessment.evidence).map(([type, evidence]) => evidence.length > 0 && (
        <div key={type}>
          <p className="op-body-sm"><strong>{type.replaceAll("_", " ")} evidence provenance</strong></p>
          <ul className="op-body-sm">
            {evidence.map((item, index) => (
              <li key={`${item.evidenceId}-${index}`}>
                {item.evidenceId} · {item.reviewStatus || "review status unavailable"}
                {item.sourceName ? ` · ${item.sourceName}` : ""}
                {item.sourceLocator ? ` · ${item.sourceLocator}` : ""}
                {item.pageNumber ? ` · page ${item.pageNumber}` : ""}
                {item.observationDate ? ` · observed ${item.observationDate}` : ""}
                {item.excerpt ? ` — “${item.excerpt}”` : ""}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {assessment.calculationInputs.missingInformation.map((item) => (
        <p className="op-body-sm" key={item}>Outstanding information: {item}</p>
      ))}
      <p className="op-body-sm">{assessment.severity.reason}</p>
      {assessment.limitations.map((item) => <p className="op-body-sm" key={item}>{item}</p>)}
    </section>
  );
}
