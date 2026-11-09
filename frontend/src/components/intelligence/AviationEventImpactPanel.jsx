import React, { useEffect, useMemo, useState } from "react";
import Button from "../ui/Button";
import { reviewAviationEventImpact } from "../../lib/contractsApi";

const EVENT_CATEGORIES = [
  ["shop_visit", "Shop visit"],
  ["maintenance", "Maintenance event"],
  ["aog", "Aircraft on Ground (AOG)"],
  ["delivery", "Aircraft delivery"],
  ["redelivery", "Aircraft redelivery"],
  ["supplier_disruption", "Supplier disruption"],
  ["operational_disruption", "Operational disruption"],
  ["insurance_event", "Insurance event"],
];

const inputStyle = {
  width: "100%",
  minHeight: 42,
  padding: "var(--op-space-2)",
  border: "1px solid var(--op-border-subtle)",
  borderRadius: "var(--op-radius-md)",
  background: "var(--op-surface-primary)",
  color: "var(--op-text-primary)",
  font: "inherit",
};

function eventAssetLabel(relationship) {
  return [
    relationship.registration || relationship.serial_number || "Aircraft identity unavailable",
    relationship.aircraft_type,
    relationship.manufacturer,
    relationship.model,
  ].filter(Boolean).join(" · ");
}

export default function AviationEventImpactPanel({ analysisRunId, organizationId, relationships = [] }) {
  const assets = useMemo(() => [...new Map(
    relationships.filter((item) => item.aircraft_id && item.evidence_id)
      .map((item) => [item.aircraft_id, item])
  ).values()], [relationships]);
  const [assetId, setAssetId] = useState("");
  const [category, setCategory] = useState("shop_visit");
  const [eventDate, setEventDate] = useState("");
  const [summary, setSummary] = useState("");
  const [sourceExcerpt, setSourceExcerpt] = useState("");
  const [sourceLocator, setSourceLocator] = useState("");
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const [review, setReview] = useState(null);

  useEffect(() => {
    if (!assets.some((item) => item.aircraft_id === assetId)) {
      setAssetId(assets[0]?.aircraft_id || "");
      setReview(null);
      setError("");
      setState("idle");
    }
  }, [assets, assetId]);

  async function submit(event) {
    event.preventDefault();
    setState("loading");
    setError("");
    setReview(null);
    try {
      const result = await reviewAviationEventImpact(analysisRunId, organizationId, {
        assetId,
        category,
        eventDate: eventDate || null,
        summary,
        sourceExcerpt,
        sourceLocator,
      });
      setReview(result.eventImpact);
      setState("ready");
    } catch (requestError) {
      setError(requestError.message || "The event-to-contract review could not be completed.");
      setState("error");
    }
  }

  return (
    <section className="op-surface-plane-secondary" style={{ marginTop: "var(--op-space-4)", padding: "var(--op-space-4)" }}>
      <p className="op-kicker">Event-to-contract review</p>
      <h3 className="op-heading-sm">Check a reported aviation event against this contract</h3>
      <p className="op-body-sm">
        Review is limited to this contract and an existing evidence-backed aircraft link. Submitted event context is unverified, transient, and never treated as proof of breach or liability.
      </p>
      {!assets.length ? (
        <p className="op-body-sm">An active aircraft-to-contract relationship with source evidence is required. No event impact will be inferred from an identifier alone.</p>
      ) : (
        <form onSubmit={submit} style={{ display: "grid", gap: "var(--op-space-3)", marginTop: "var(--op-space-3)" }}>
          <label style={{ display: "grid", gap: "var(--op-space-1)" }}>
            <span className="op-body-sm">Aircraft</span>
            <select required value={assetId} onChange={(event) => { setAssetId(event.target.value); setReview(null); }} style={inputStyle}>
              {assets.map((item) => <option key={item.aircraft_id} value={item.aircraft_id}>{eventAssetLabel(item)}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: "var(--op-space-1)" }}>
            <span className="op-body-sm">Event category</span>
            <select value={category} onChange={(event) => { setCategory(event.target.value); setReview(null); }} style={inputStyle}>
              {EVENT_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: "var(--op-space-1)" }}>
            <span className="op-body-sm">Event date (optional)</span>
            <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: "var(--op-space-1)" }}>
            <span className="op-body-sm">Event summary</span>
            <input required minLength={8} maxLength={500} value={summary} onChange={(event) => setSummary(event.target.value)} style={inputStyle} placeholder="Describe the reported event" />
          </label>
          <label style={{ display: "grid", gap: "var(--op-space-1)" }}>
            <span className="op-body-sm">Source excerpt</span>
            <textarea required minLength={8} maxLength={3000} rows={3} value={sourceExcerpt} onChange={(event) => setSourceExcerpt(event.target.value)} style={{ ...inputStyle, resize: "vertical" }} placeholder="Paste the relevant operational report excerpt" />
          </label>
          <label style={{ display: "grid", gap: "var(--op-space-1)" }}>
            <span className="op-body-sm">Source locator (optional)</span>
            <input maxLength={250} value={sourceLocator} onChange={(event) => setSourceLocator(event.target.value)} style={inputStyle} placeholder="Document, page, or record reference" />
          </label>
          <div>
            <Button type="submit" disabled={state === "loading"}>{state === "loading" ? "Reviewing…" : "Review contract relevance"}</Button>
          </div>
        </form>
      )}
      {error && <p className="op-body-sm" role="alert">{error}</p>}
      {review && (
        <div style={{ marginTop: "var(--op-space-4)" }} aria-live="polite">
          <span className="op-status-badge is-neutral">Human review required · event unverified</span>
          <p className="op-body-sm">{review.event.label}: {review.event.summary}{review.event.eventDate ? ` · ${review.event.eventDate}` : ""}</p>
          {review.potentialImpacts.length ? review.potentialImpacts.map((impact) => (
            <article className="op-relationship-item" key={impact.clause.id}>
              <div>
                <strong className="op-body">{impact.clause.number ? `Clause ${impact.clause.number}: ` : ""}{impact.clause.title || "Potentially relevant clause"}</strong>
                <p className="op-body-sm">{impact.reasons.join("; ")}</p>
                <p className="op-body-sm">{impact.clause.sourceText}</p>
                <p className="op-body-sm">Contract evidence records: {impact.clause.evidence.length || "not linked in the current analysis"}.</p>
                {impact.obligations.map((obligation) => <p className="op-body-sm" key={obligation.id}><strong>Potential obligation:</strong> {obligation.description || obligation.type || obligation.id}</p>)}
                {impact.deadlines.map((deadline) => <p className="op-body-sm" key={deadline.id}><strong>Related deadline:</strong> {deadline.timingExpression || deadline.absoluteDate || "Timing not established"}{deadline.monitoringStatus ? ` · ${deadline.monitoringStatus}` : ""}</p>)}
                {impact.risks.map((risk) => <p className="op-body-sm" key={risk.id}><strong>Existing risk:</strong> {risk.title}{risk.priority ? ` · ${risk.priority}` : ""}{risk.fulfilmentStatus ? ` · fulfilment ${risk.fulfilmentStatus}` : ""}</p>)}
                {impact.financialImpacts.map((financial) => <p className="op-body-sm" key={financial.id}><strong>Existing financial term:</strong> {financial.description} · {financial.resultLabel}</p>)}
                {impact.recommendations.map((recommendation) => <p className="op-body-sm" key={recommendation.id || recommendation.action}><strong>Existing recommended action:</strong> {recommendation.action}</p>)}
                {impact.clause.id && <button type="button" className="op-body-sm" onClick={() => document.getElementById(`clause-${impact.clause.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>View source clause</button>}
              </div>
            </article>
          )) : <p className="op-body-sm">No contract clause matched the supported terms for this event category. That does not establish that the event has no contractual effect.</p>}
          {review.limitations.map((limitation) => <p className="op-body-sm op-relationship-boundary" key={limitation}>{limitation}</p>)}
        </div>
      )}
    </section>
  );
}
