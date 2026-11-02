import React, { useState } from "react";
import { evaluateFuelPriceScenario } from "../../../../domain/contractIntelligence/aviationContractCore.js";
import EvidencePanel from "./EvidencePanel";

function evidenceRows(evidence = []) {
  return evidence.map((item) => ({
    id: item.evidenceId,
    excerpt: item.originalClauseText || item.evidenceText,
    source_locator: item.sourceLocation,
    page_number: item.pageNumber,
  }));
}

function money(amount, currency) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

function CoreEvidence({ findingLabel, evidence }) {
  return <div>
    {evidence.map((item, index) => <p className="op-body-sm" key={item.clauseId || index}>
      {item.clauseId ? <a href={`#clause-${item.clauseId}`}>Clause {item.clauseNumber || "number unavailable"}</a> : "Clause identity unavailable"}
      {" · "}{item.pageNumber ? `Page ${item.pageNumber}` : "Page unavailable"}
    </p>)}
    <div style={{ whiteSpace: "pre-wrap" }}>
      <EvidencePanel findingLabel={findingLabel} evidence={evidenceRows(evidence)} />
    </div>
  </div>;
}

function FuelPriceScenario({ mechanism }) {
  const [origin, setOrigin] = useState("hypothetical");
  const [price, setPrice] = useState("");
  const [asOf, setAsOf] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [result, setResult] = useState(null);
  const baseline = mechanism.baselineFuelPrice;
  function change(setter, value) { setter(value); setResult(null); }
  function calculate(event) {
    event.preventDefault();
    setResult(evaluateFuelPriceScenario(mechanism, {
      kind: "fuel_price", origin, value: price.trim() ? Number(price) : null,
      currency: baseline?.currency, unit: baseline?.unit, reference: mechanism.reference,
      asOf, sourceLabel,
    }));
  }
  return (
    <article className="op-surface-plane-secondary" style={{ padding: "var(--op-space-4)", marginTop: "var(--op-space-3)" }}>
      <h3 className="op-heading-sm">Fuel-price adjustment · {mechanism.status === "supported" ? "scenario foundation" : "requires review"}</h3>
      <p className="op-body-sm">{mechanism.interpretation}</p>
      {mechanism.candidateClauseCount > mechanism.evidence.length && <p className="op-body-sm">{mechanism.candidateClauseCount} candidate clauses; first {mechanism.evidence.length} citations shown. Review all fuel-related source text before resolving applicability.</p>}
      <CoreEvidence findingLabel="Fuel pricing mechanism" evidence={mechanism.evidence} />
      {mechanism.status !== "supported" ? (
        <ul className="op-body-sm">{mechanism.missingConditions.map((issue) => <li key={issue}>{issue}</li>)}</ul>
      ) : (
        <>
          <p className="op-body-sm"><strong>Extracted contractual inputs:</strong> Base surcharge {money(mechanism.baseSurcharge.amount, mechanism.baseSurcharge.currency)} per flight; baseline fuel price {baseline.amount} {baseline.currency} / {baseline.unit}; reference {mechanism.reference}; frequency {mechanism.adjustmentFrequency}.</p>
          <p className="op-body-sm"><strong>Parsed formula:</strong> base surcharge × (current fuel price / baseline fuel price).</p>
          <form onSubmit={calculate}>
            <div className="op-grid op-grid-2">
              <label className="op-body-sm">Input provenance
                <select style={{ width: "100%", minWidth: 0 }} value={origin} onChange={(event) => change(setOrigin, event.target.value)}>
                  <option value="hypothetical">Hypothetical assumption</option>
                  <option value="user_supplied">User-supplied observation (unverified)</option>
                </select>
              </label>
              <label className="op-body-sm">Fuel price ({baseline.currency} / {baseline.unit})
                <input style={{ width: "100%", minWidth: 0 }} type="number" step="any" min="0" required value={price} onChange={(event) => change(setPrice, event.target.value)} />
              </label>
              <label className="op-body-sm">Observation / scenario date (not an invoice date)
                <input style={{ width: "100%", minWidth: 0 }} type="date" required value={asOf} onChange={(event) => change(setAsOf, event.target.value)} />
              </label>
              <label className="op-body-sm">{origin === "hypothetical" ? "Assumption description" : "Source label for the stated contractual reference"}
                <input style={{ width: "100%", minWidth: 0 }} required maxLength={200} value={sourceLabel} onChange={(event) => change(setSourceLabel, event.target.value)} />
              </label>
            </div>
            <p className="op-body-sm">Enter a value for {mechanism.reference} in the stated currency and unit. No live market feed, reference substitution or currency conversion is available. Inputs and results remain local to this view and are not saved.</p>
            <button type="submit" className="op-body-sm">Calculate labelled scenario</button>
          </form>
          {result && <div role="status" style={{ marginTop: "var(--op-space-3)" }}>
            {result.status === "computed" ? (
              <>
                <p className="op-body"><strong>Scenario only:</strong> {money(result.amount, result.currency)} surcharge per {result.unit}; change from contractual base {money(result.delta, result.currency)}.</p>
                <p className="op-body-sm">{result.calculation} · {result.input.origin.replaceAll("_", " ")} · {result.input.asOf} · {result.input.sourceLabel}</p>
                {result.limitations.map((limitation) => <p className="op-body-sm" key={limitation}>{limitation}</p>)}
              </>
            ) : <ul>{result.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
          </div>}
        </>
      )}
    </article>
  );
}

export default function AviationContractCoreSection({ core }) {
  if (!core) return <p className="op-body-sm">Aviation topic coverage and fuel pricing were not produced by this analysis version. A new analysis run is needed; existing completed runs are not rewritten.</p>;
  return (
    <section style={{ marginTop: "var(--op-space-4)", overflowWrap: "anywhere" }} aria-label="Aviation contract core">
      <h3 className="op-heading-sm">Aviation review coverage</h3>
      <p className="op-body-sm">Evidence-linked topic identification is interpretation, not confirmed obligation, liability or compliance. “Not established” means not identified in the analysed text, not absent from the agreement.</p>
      <div className="op-grid op-grid-2">
        {core.topics.map((topic) => <article key={topic.id} className="op-relationship-item">
          <div><strong>{topic.label}</strong><p className="op-body-sm">{topic.status === "identified_for_review" ? "Mention identified · review applicability" : "Not established from analysed text"}</p>{topic.identifiedClauseCount > topic.evidence.length && <p className="op-body-sm">{topic.identifiedClauseCount} identified clauses; first {topic.evidence.length} citations shown.</p>}</div>
          {!!topic.evidence.length && <CoreEvidence findingLabel={`${topic.label} topic`} evidence={topic.evidence} />}
        </article>)}
      </div>
      {core.fuelMechanisms.length ? core.fuelMechanisms.map((mechanism) => <FuelPriceScenario key={`${core.version}:${mechanism.id}`} mechanism={mechanism} />) : <p className="op-body-sm">No fuel adjustment mechanism was identified. No fuel-price exposure is quantified.</p>}
    </section>
  );
}
