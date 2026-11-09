import React, { useMemo } from "react";
import { deriveRedeliveryReview } from "../../lib/redeliveryIntelligence";
import Reveal from "../ui/Reveal";

function label(value) {
  return String(value || "not established").replaceAll("_", " ");
}

function sourceLabel(evidence) {
  return [
    evidence?.clauseNumber ? `Clause ${evidence.clauseNumber}` : null,
    evidence?.sourceLocation || null,
    evidence?.pageNumber ? `page ${evidence.pageNumber}` : null,
    evidence?.confidence !== null && evidence?.confidence !== undefined
      ? `extraction confidence ${Math.round(Number(evidence.confidence) * 100)}%`
      : null,
  ].filter(Boolean).join(" · ");
}

function dateDescription(deadline) {
  const timing = deadline.timing_expression || deadline.original_expression || "Timing not established";
  const date = deadline.absolute_date ? ` · ${deadline.absolute_date}` : "";
  const dateBasis = deadline.absolute_date
    ? deadline.metadata?.calculation?.method
      ? "Existing deadline-engine calculation"
      : "Extracted absolute date"
    : "No absolute date established";
  const monitoring = deadline.monitoring?.status
    ? ` · ${label(deadline.monitoring.status)}`
    : "";
  const review = deadline.monitoring?.reviewRequired || deadline.review_status === "requires_review"
    ? " · human verification required"
    : "";
  return `${timing}${date} · ${dateBasis}${monitoring}${review}`;
}

function scrollTo(id) {
  if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export default function AviationRedeliveryIntelligence({
  redelivery,
  relationships = [],
  obligations = [],
  deadlines = [],
  leaseAssessment,
  financialImpact,
}) {
  const review = useMemo(() => deriveRedeliveryReview({
    redelivery,
    obligations,
    deadlines,
    risks: leaseAssessment?.risks || [],
    recommendations: leaseAssessment?.recommendations || [],
    financialImpacts: financialImpact?.impacts || [],
  }), [redelivery, obligations, deadlines, leaseAssessment, financialImpact]);
  const assets = relationships.filter((relationship) => relationship.aircraft_id && relationship.evidence_id);

  return (
    <Reveal id="redelivery" style={{ marginBottom: "var(--op-space-5)", scrollMarginTop: 90 }}>
      <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>Aviation redelivery intelligence</h2>
      <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>
        Evidence-linked review of contract-stated return conditions. This is not a technical compliance certificate, legal determination, or readiness score.
      </p>
      <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-4)", marginBottom: "var(--op-space-3)" }}>
        <p className="op-kicker">Contract and aircraft scope</p>
        <p className="op-body-sm">This review uses only the currently selected contract analysis. Different contract versions are not combined.</p>
        {assets.length ? assets.map((asset) => (
          <p className="op-body-sm" key={asset.id}>
            {asset.registration || asset.serial_number || "Aircraft identity unavailable"}
            {asset.aircraft_type ? ` · ${asset.aircraft_type}` : ""}
            {asset.source_identifier ? ` · linked by ${asset.source_identifier}` : ""}
          </p>
        )) : <p className="op-body-sm">No active evidence-backed aircraft relationship is available for this contract. Contractual conditions remain visible; no aircraft is inferred.</p>}
        {review.returnLocation.status === "conflicting" ? (
          <div role="note" style={{ marginTop: "var(--op-space-2)" }}>
            <p className="op-body-sm"><strong>Return location requires human reconciliation.</strong> Distinct source candidates were preserved and no location was selected.</p>
            {review.returnLocation.candidates.map((candidate, index) => (
              <p className="op-body-sm" key={`${candidate.value}-${index}`}>
                {candidate.value}{candidate.evidence?.[0] ? ` · ${sourceLabel(candidate.evidence[0])}` : ""}
              </p>
            ))}
          </div>
        ) : review.returnLocation.value ? (
          <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>
            Return location extracted from contract: <strong>{review.returnLocation.value}</strong>
            {review.returnLocation.candidates[0]?.evidence?.[0] && ` · ${sourceLabel(review.returnLocation.candidates[0].evidence[0])}`}
          </p>
        ) : <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>A contractual return location was not established from the available source clauses.</p>}
      </div>

      {!review.requirements.length ? (
        <div className="op-surface" style={{ padding: "var(--op-space-4)" }}>
          <p className="op-body-sm">No supported redelivery conditions were extracted from the current contract analysis. This does not establish that the agreement has no return conditions.</p>
        </div>
      ) : (
        <div className="op-grid" style={{ gap: "var(--op-space-3)" }}>
          {review.requirements.map((requirement, index) => (
            <details className="op-surface" key={`${requirement.category}-${requirement.clauseId || "unlinked"}-${index}`} style={{ padding: "var(--op-space-3)" }}>
              <summary className="op-body-sm" style={{ cursor: "pointer" }}>
                <strong>{label(requirement.category)}</strong>
                {requirement.important ? " · important source condition" : ""}
                {requirement.multipleStatements ? " · multiple source statements; reconcile" : ""}
              </summary>
              <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>{requirement.requirement}</p>
              <p className="op-body-sm">
                {sourceLabel(requirement.evidence) || "Contract source location unavailable"}
                {requirement.evidence?.evidenceId ? ` · evidence ${requirement.evidence.evidenceId}` : ""}
              </p>
              {requirement.evidence?.evidenceText && <blockquote className="op-body-sm" style={{ margin: "var(--op-space-2) 0" }}>“{requirement.evidence.evidenceText}”</blockquote>}
              {requirement.clauseId && <button type="button" className="op-body-sm" onClick={() => scrollTo(`clause-${requirement.clauseId}`)}>View source clause</button>}

              <div style={{ marginTop: "var(--op-space-3)" }}>
                <p className="op-kicker">Linked obligation and timeline</p>
                {!requirement.obligations.length ? (
                  <p className="op-body-sm">No obligation is linked to this source clause in the current analysis.</p>
                ) : requirement.obligations.map((obligation) => {
                  const risk = requirement.risks.find((item) => item.obligation_id === obligation.id);
                  const operationalEvidence = risk?.operational_evidence || [];
                  const recommendedAction = requirement.recommendations.find((item) => (
                    item.source_risk_key === risk?.id || item.risk_id === risk?.id
                  ));
                  return (
                    <section className="op-surface-plane-secondary" key={obligation.id} style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-2)" }}>
                      <p className="op-body-sm"><strong>{obligation.description || "Contractual obligation"}</strong></p>
                      <p className="op-body-sm">Obligation association is by shared source clause; confirm that the extracted obligation captures this exact return condition.</p>
                      {obligation.actor && <p className="op-body-sm">Extracted responsible party: {obligation.actor}{obligation.confidence != null ? ` · extraction confidence ${Math.round(Number(obligation.confidence) * 100)}%` : ""} · confirm before assigning operational responsibility.</p>}
                      <button type="button" className="op-body-sm" onClick={() => scrollTo(`obligation-${obligation.id}`)}>Review obligation and fulfilment history</button>
                      {obligation.metadata?.required_evidence?.length > 0 && (
                        <p className="op-body-sm">Evidence types stated by the obligation parser: {obligation.metadata.required_evidence.join("; ")}</p>
                      )}
                      {risk ? (
                        <>
                          <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>
                            Human fulfilment assessment: {label(risk.assessment_status)} · potential risk: {risk.title} ({label(risk.priority)} review priority).
                          </p>
                          <p className="op-body-sm">{risk.description}</p>
                          {risk.uncertainty_indicators?.map((indicator) => <p className="op-body-sm" key={indicator}>Uncertainty: {indicator}</p>)}
                          {operationalEvidence.length ? operationalEvidence.map((item) => (
                            <p className="op-body-sm" key={item.evidenceId}>
                              Operational evidence · {item.documentName || "source"}{item.versionNumber ? ` · version ${item.versionNumber}` : ""}{item.sourceLocator ? ` · ${item.sourceLocator}` : ""}: {item.relationship || "relationship unrecorded"}, period {item.periodStatus || "not assessed"}{item.reviewStatus ? `, review ${label(item.reviewStatus)}` : ""}{item.ambiguityReason ? `, uncertainty ${item.ambiguityReason}` : ""}{item.excerpt ? ` · “${item.excerpt}”` : ""}
                            </p>
                          )) : <p className="op-body-sm">No operational evidence is linked to this assessment. Missing evidence is not proof of non-fulfilment.</p>}
                          <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>
                            Suggested action — not a contractual requirement: {recommendedAction?.action || risk.recommended_action}
                          </p>
                          {recommendedAction?.business_rationale && <p className="op-body-sm">{recommendedAction.business_rationale}</p>}
                        </>
                      ) : <p className="op-body-sm">No linked fulfilment-risk assessment is available for this obligation in the current analysis.</p>}
                      {requirement.financialImpacts.map((impact) => (
                        <p className="op-body-sm" key={impact.id}>
                          Existing clause-linked financial analysis: {impact.description || impact.category} · {impact.resultLabel || "Not quantified"}. This is not a confirmed cash balance or liability.
                        </p>
                      ))}
                    </section>
                  );
                })}
                {requirement.deadlines.length ? requirement.deadlines.map((deadline) => (
                  <p className="op-body-sm" key={deadline.id} style={{ marginTop: "var(--op-space-2)" }}>
                    Deadline · {dateDescription(deadline)}
                  </p>
                )) : <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>
                  No deadline is linked to this obligation or source clause. No date has been inferred from lease expiry.
                </p>}
              </div>
            </details>
          ))}
        </div>
      )}
    </Reveal>
  );
}
