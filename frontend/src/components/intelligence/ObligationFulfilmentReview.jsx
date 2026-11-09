import React, { useEffect, useState } from "react";
import Button from "../ui/Button";
import { assessObligationFulfilment, getObligationFulfilment } from "../../lib/contractsApi";

const STATUS_OPTIONS = [
  ["pending_evidence", "Pending evidence"],
  ["evidence_submitted", "Evidence submitted"],
  ["under_review", "Under review"],
  ["fulfilled", "Fulfilment confirmed by reviewer"],
  ["partially_fulfilled", "Partially fulfilled"],
  ["not_fulfilled", "Not fulfilled - reviewer assessment"],
  ["disputed", "Disputed"],
  ["insufficient_evidence", "Insufficient evidence"],
];

const RELATIONSHIP_OPTIONS = [
  ["supports", "Supports fulfilment"],
  ["contradicts", "Contradicts fulfilment"],
  ["context", "Context only"],
];

const PERIOD_OPTIONS = [
  ["matches", "Period matches"],
  ["mismatches", "Wrong period"],
  ["not_assessed", "Period not assessed"],
];

function labelForStatus(status) {
  return STATUS_OPTIONS.find(([value]) => value === status)?.[1] || "Not assessed";
}

function formatReviewDate(value) {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time not recorded" : new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatConfidence(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "";
  return ` · extraction confidence ${Math.round(Number(value) * 100)}%`;
}

function formatDueStatus(deadline) {
  const remaining = deadline.daysRemaining;
  switch (deadline.status) {
    case "passed":
      return `Deadline passed ${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? "" : "s"} ago - human review required`;
    case "due_today":
      return "Deadline is today";
    case "approaching":
    case "scheduled":
      return `Not yet due - ${remaining} day${remaining === 1 ? "" : "s"} remaining`;
    case "awaiting_condition":
      return "Awaiting condition confirmation";
    case "awaiting_trigger":
      return "Awaiting trigger date";
    case "unverified_date":
      return "Date requires verification";
    case "unresolved":
      return "Deadline timing unresolved";
    default:
      return "No verified due date established";
  }
}

export default function ObligationFulfilmentReview({ analysisRunId, organizationId, obligation, canReview }) {
  const [result, setResult] = useState(null);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("evidence_submitted");
  const [explanation, setExplanation] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setState("loading");
    setError("");
    getObligationFulfilment(analysisRunId, obligation.id, organizationId)
      .then((response) => {
        if (active) {
          setResult(response);
          setState("ready");
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message || "Fulfilment history could not be loaded.");
          setState("error");
        }
      });
    return () => { active = false; };
  }, [analysisRunId, obligation.id, organizationId]);

  function updateEvidence(evidenceId, field, value) {
    setSelectedEvidence((current) => ({
      ...current,
      [evidenceId]: {
        evidenceId,
        relationship: "supports",
        periodStatus: "not_assessed",
        ...current[evidenceId],
        [field]: value,
      },
    }));
  }

  async function submitAssessment(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const updated = await assessObligationFulfilment(
        analysisRunId,
        obligation.id,
        organizationId,
        { status, explanation, evidence: Object.values(selectedEvidence) }
      );
      setResult(updated);
      setExplanation("");
      setSelectedEvidence({});
      setState("ready");
    } catch (requestError) {
      setError(requestError.message || "The assessment could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <details className="op-surface" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-3)", gridColumn: "1 / -1" }}>
      <summary className="op-body-sm" style={{ cursor: "pointer" }}>
        Fulfilment review · {state === "ready" ? labelForStatus(result?.status) : state === "loading" ? "Loading" : "Unavailable"}
        {result?.history?.length ? ` · ${result.history.length} historical assessment${result.history.length === 1 ? "" : "s"}` : ""}
      </summary>
      {state === "loading" ? <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>Loading review history and same-contract evidence…</p>
        : state === "error" ? <p className="op-body-sm" role="alert" style={{ marginTop: "var(--op-space-2)", color: "var(--op-signal-risk)" }}>{error}</p>
          : <>
            <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>
              Contract evidence establishes the requirement; only a human reviewer can assess separate operational evidence. Missing evidence is not proof of non-fulfilment, and these assessments are not legal certification.
            </p>
            {obligation.metadata?.required_evidence?.length > 0 && <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>
              Contract-extracted evidence requested: {obligation.metadata.required_evidence.join("; ")}
            </p>}
            {result.deadlineMonitoring.map((deadline) => <p key={deadline.id} className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>
              {deadline.timingExpression || "Contractual deadline"}{deadline.absoluteDate ? ` · ${deadline.absoluteDate}` : ""} · {formatDueStatus(deadline)}{deadline.reviewRequired ? " · extracted deadline needs review" : ""}
            </p>)}
            {result.deadlineReviewPrompt && <p className="op-body-sm" role="note" style={{ marginTop: "var(--op-space-2)" }}>
              {result.deadlineReviewPrompt.message}
            </p>}
            <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>
              Recommended next action: {result.recommendedAction}
            </p>
            {!result.history.length && <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>No fulfilment assessment has been recorded.</p>}
            {result.history.map((item) => (
              <section key={item.id} className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-2)" }}>
                <p className="op-kicker">{labelForStatus(item.status)} · {formatReviewDate(item.createdAt)} · reviewer {item.reviewerUserId || "not identified"}</p>
                <p className="op-body-sm" style={{ marginTop: "var(--op-space-1)" }}>{item.explanation}</p>
                {item.evidence.map((source) => <p key={source.id} className="op-body-sm" style={{ marginTop: "var(--op-space-1)" }}>
                  {source.documentName || "Contract evidence"}{source.versionNumber ? ` · version ${source.versionNumber}` : ""}{source.pageNumber ? ` · page ${source.pageNumber}` : ""}{source.sourceLocator ? ` · ${source.sourceLocator}` : ""}
                  {" · "}{source.relationship} · period {source.periodStatus}
                  {source.reviewStatus ? ` · source review ${source.reviewStatus}` : ""}
                  {formatConfidence(source.confidence)}
                  {source.ambiguityReason ? ` · uncertainty: ${source.ambiguityReason}` : ""}
                  {source.excerpt ? ` · “${source.excerpt}”` : ""}
                </p>)}
              </section>
            ))}
            {canReview ? (
              <form onSubmit={submitAssessment} style={{ marginTop: "var(--op-space-3)" }}>
                <label className="op-body-sm" style={{ display: "block" }}>
                  Reviewer assessment
                  <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ display: "block", width: "100%", marginTop: "var(--op-space-1)" }}>
                    {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="op-body-sm" style={{ display: "block", marginTop: "var(--op-space-2)" }}>
                  Explanation (required)
                  <textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} maxLength={4000} required rows={3} style={{ display: "block", width: "100%", marginTop: "var(--op-space-1)" }} />
                </label>
                <p className="op-kicker" style={{ marginTop: "var(--op-space-3)" }}>Recent operational evidence excerpts from other documents in this contract (up to 200)</p>
                {!result.availableEvidence.length ? <p className="op-body-sm">No separate-document evidence is available. Link a relevant evidence source from this contract before assessing fulfilment.</p>
                  : result.availableEvidence.map((item) => {
                    const selected = selectedEvidence[item.id];
                    return (
                      <div key={item.id} className="op-surface-plane-secondary" style={{ padding: "var(--op-space-2)", marginTop: "var(--op-space-2)" }}>
                        <label className="op-body-sm" style={{ display: "flex", gap: "var(--op-space-2)", alignItems: "flex-start" }}>
                          <input type="checkbox" checked={Boolean(selected)} onChange={(event) => {
                            if (event.target.checked) updateEvidence(item.id, "relationship", "supports");
                            else setSelectedEvidence((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== item.id)));
                          }} />
                          <span>{item.documentName || "Evidence document"}{item.versionNumber ? ` · version ${item.versionNumber}` : ""}{item.pageNumber ? ` · page ${item.pageNumber}` : ""}{item.sourceLocator ? ` · ${item.sourceLocator}` : ""}{item.reviewStatus ? ` · source review ${item.reviewStatus}` : ""}{formatConfidence(item.confidence)}{item.ambiguityReason ? ` · uncertainty: ${item.ambiguityReason}` : ""}<br />{item.excerpt}</span>
                        </label>
                        {selected && <div className="op-grid op-grid-2" style={{ marginTop: "var(--op-space-2)" }}>
                          <label className="op-body-sm">Relationship
                            <select value={selected.relationship} onChange={(event) => updateEvidence(item.id, "relationship", event.target.value)}>
                              {RELATIONSHIP_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                          </label>
                          <label className="op-body-sm">Applicable period
                            <select value={selected.periodStatus} onChange={(event) => updateEvidence(item.id, "periodStatus", event.target.value)}>
                              {PERIOD_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                          </label>
                        </div>}
                      </div>
                    );
                  })}
                {error && <p className="op-body-sm" role="alert" style={{ marginTop: "var(--op-space-2)", color: "var(--op-signal-risk)" }}>{error}</p>}
                <div style={{ marginTop: "var(--op-space-3)" }}>
                  <Button type="submit" variant="secondary" disabled={submitting || !explanation.trim()}>
                    {submitting ? "Recording review…" : "Record append-only assessment"}
                  </Button>
                </div>
              </form>
            ) : <p className="op-body-sm" style={{ marginTop: "var(--op-space-3)" }}>Contract write permission is required to record a reviewer assessment.</p>}
          </>}
    </details>
  );
}
