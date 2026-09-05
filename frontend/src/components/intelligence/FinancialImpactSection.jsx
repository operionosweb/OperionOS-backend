import React, { useEffect, useState } from "react";
import { ArrowDown, Calculator, CircleDollarSign, ExternalLink, ShieldCheck, X } from "lucide-react";
import { EmptyState, LoadingState } from "../ui/States";

function formatMoney(amount, currency) {
  if (!Number.isFinite(amount) || !currency) return "Not quantified";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

function formatTotals(totals = {}) {
  const entries = Object.entries(totals);
  return entries.length ? entries.map(([currency, amount]) => formatMoney(amount, currency)) : ["Not quantified"];
}

function sourceTarget(node) {
  if (!node.referenceId) return null;
  if (node.type === "clause") return `clause-${node.referenceId}`;
  if (node.type === "mitigation") return "actions";
  return null;
}

function FinancialImpactDrawer({ impact, onClose }) {
  const [selectedNode, setSelectedNode] = useState(impact.path[0]);

  useEffect(() => {
    const close = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  function inspectNode(node) {
    setSelectedNode(node);
    const target = sourceTarget(node);
    if (target) document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="op-financial-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="op-financial-drawer" role="dialog" aria-modal="true" aria-label={`Why ${impact.description}`} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="op-page-kicker">Why this amount?</span>
            <h2>{impact.description}</h2>
            <p>{impact.exposureType === "event_driven" ? "Event-driven potential exposure" : "Current contractual exposure"}</p>
          </div>
          <button type="button" className="op-icon-button" onClick={onClose} aria-label="Close financial impact"><X size={18} /></button>
        </header>

        <div className="op-financial-drawer-body">
          <section className="op-financial-result" aria-label="Calculation result">
            <span>Estimated financial impact</span>
            <strong>{impact.resultLabel}</strong>
            <small>{impact.calculationMethod.replaceAll("_", " ")}</small>
          </section>

          <section>
            <h3>Financial Impact Tree</h3>
            <p className="op-body-sm">Select a step to inspect its role in the calculation. Linked source steps also move to the underlying workspace record.</p>
            <ol className="op-exposure-path">
              {impact.path.map((node, index) => (
                <li key={node.id}>
                  <button type="button" aria-pressed={selectedNode.id === node.id} className={selectedNode.id === node.id ? "is-active" : ""} onClick={() => inspectNode(node)}>
                    <span>{node.type.replaceAll("_", " ")}</span>
                    <strong>{node.label}</strong>
                    {node.referenceId && <ExternalLink size={14} aria-hidden="true" />}
                  </button>
                  {index < impact.path.length - 1 && <ArrowDown size={15} aria-hidden="true" />}
                </li>
              ))}
            </ol>
            <div className="op-financial-node-detail" role="status">
              <span>{selectedNode.type.replaceAll("_", " ")}</span>
              <p>{selectedNode.label}</p>
              {selectedNode.referenceId && <small>This step is linked to an evidence-backed workspace record.</small>}
            </div>
          </section>

          <section>
            <h3>Calculation</h3>
            <dl className="op-financial-details">
              <div><dt>Base amount</dt><dd>{formatMoney(impact.baseAmount, impact.currency)}</dd></div>
              <div><dt>Method</dt><dd>{impact.calculationMethod.replaceAll("_", " ")}</dd></div>
              <div><dt>Trigger event</dt><dd>{impact.triggerEvent || "No future trigger identified; current contract terms apply."}</dd></div>
              <div><dt>Time horizon</dt><dd>{impact.timeHorizon || "Not established"}</dd></div>
              <div><dt>Confidence</dt><dd>{impact.confidence === null ? "Not established" : `${Math.round(impact.confidence * 100)}%`}</dd></div>
              <div><dt>Probability</dt><dd>{impact.probability === null ? "Not estimated" : `${Math.round(impact.probability * 100)}%`}</dd></div>
            </dl>
            {impact.calculation && <p className="op-financial-formula"><Calculator size={16} />{impact.calculation}</p>}
            {impact.assumptions.map((assumption) => <p className="op-body-sm" key={assumption}>Assumption: {assumption}</p>)}
          </section>

          <section>
            <h3>Contract provenance</h3>
            {impact.provenance.clause ? (
              <button type="button" className="op-financial-source" onClick={() => inspectNode({ type: "clause", referenceId: impact.provenance.clause.id, id: "source-clause", label: impact.provenance.clause.title || "Source clause" })}>
                <span>Clause {impact.provenance.clause.number || "number unavailable"}</span>
                <strong>{impact.provenance.clause.title || "Untitled clause"}</strong>
                <p>{impact.provenance.clause.text || "Clause text unavailable."}</p>
              </button>
            ) : <p className="op-body-sm">A source clause link is not available for this impact.</p>}
            {impact.provenance.obligations.map((item) => <p className="op-body-sm" key={item.id}><strong>Obligation:</strong> {item.description}</p>)}
            {impact.provenance.deadlines.map((item) => <p className="op-body-sm" key={item.id}><strong>Deadline:</strong> {item.absoluteDate || item.timingExpression || "Timing unavailable"}</p>)}
            {impact.provenance.evidence.map((item, index) => (
              <blockquote key={item.evidenceId || index}>
                <p>{item.excerpt || "Evidence excerpt unavailable."}</p>
                <cite>{item.sourceLocator || (item.pageNumber ? `Page ${item.pageNumber}` : "Contract source")}</cite>
              </blockquote>
            ))}
          </section>

          <section>
            <h3>Recommended action to potential value</h3>
            <p className="op-body">{impact.mitigationAction || "No evidence-linked mitigation action is available."}</p>
            <div className="op-financial-value-flow">
              <span><small>Exposure before action</small><strong>{formatMoney(impact.baseAmount, impact.currency)}</strong></span>
              <span><small>After action</small><strong>{formatMoney(impact.estimatedExposureAfterMitigation, impact.currency)}</strong></span>
              <span><small>Potential protected value</small><strong>{formatMoney(impact.estimatedProtectedValue, impact.currency)}</strong></span>
            </div>
            {impact.estimatedProtectedValue === null && <p className="op-body-sm">Potential value is not calculated because no evidence-backed post-mitigation amount is available. This is not a savings forecast.</p>}
          </section>
        </div>
      </aside>
    </div>
  );
}

export default function FinancialImpactSection({ financialImpact, state = "ready" }) {
  const [selectedImpact, setSelectedImpact] = useState(null);

  if (state === "loading") return <LoadingState label="Loading financial impact…" />;
  if (state === "unavailable") return <EmptyState title="Financial impact unavailable" description="The financial impact service could not be reached for this analysis run." />;
  if (!financialImpact || financialImpact.status === "empty") {
    return <EmptyState title="No quantifiable financial exposure found" description="No evidence-linked contractual risk is available for financial impact analysis." />;
  }

  const cards = [
    ["Current financial exposure", financialImpact.summary.currentContractual, "Amounts already implied by current contract terms."],
    ["Event-driven potential exposure", financialImpact.summary.eventDriven, "Amounts that become relevant only if stated trigger conditions occur."],
    ["Potential avoidable exposure", financialImpact.summary.potentialAvoidable, "Only explicit, bounded mitigation calculations are included."],
    ["Potential protected value", financialImpact.summary.protectedValue, "Estimated value, never guaranteed savings."],
  ];

  return (
    <>
      <div className="op-financial-kpis">
        {cards.map(([label, totals, note]) => (
          <article className="op-financial-kpi" key={label}>
            <span>{label}</span>
            {formatTotals(totals).map((value) => <strong key={value}>{value}</strong>)}
            <small>{note}</small>
          </article>
        ))}
      </div>
      <div className="op-financial-boundary"><ShieldCheck size={18} aria-hidden="true" /><p>{financialImpact.methodology.statement}</p></div>
      {financialImpact.missingInputs.length > 0 && <div className="op-honest-boundary"><strong>What is still needed for a reliable estimate</strong>{financialImpact.missingInputs.map((item) => <p key={item}>{item}</p>)}</div>}
      <div className="op-financial-impact-list">
        {financialImpact.impacts.map((impact) => (
          <article className="op-financial-impact-card" key={impact.id}>
            <header><div><span>{impact.category.replaceAll("_", " ")}</span><h3>{impact.description}</h3></div><span className={`op-status-badge${impact.exposureType === "event_driven" ? " is-neutral" : ""}`}>{impact.exposureType.replaceAll("_", " ")}</span></header>
            <div className="op-financial-impact-amount"><CircleDollarSign size={19} /><strong>{impact.resultLabel}</strong></div>
            <dl>
              <div><dt>Event / condition</dt><dd>{impact.triggerEvent || "Current contract terms"}</dd></div>
              <div><dt>Clause</dt><dd>{impact.sourceClauseNumber || "Not linked"}</dd></div>
              <div><dt>Recommended action</dt><dd>{impact.mitigationAction || "No linked action"}</dd></div>
              <div><dt>Potential protected value</dt><dd>{formatMoney(impact.estimatedProtectedValue, impact.currency)}</dd></div>
            </dl>
            <button type="button" className="op-button-secondary" onClick={() => setSelectedImpact(impact)}><Calculator size={16} />Why this amount?</button>
          </article>
        ))}
      </div>
      {selectedImpact && <FinancialImpactDrawer impact={selectedImpact} onClose={() => setSelectedImpact(null)} />}
    </>
  );
}