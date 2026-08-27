import React from "react";

const EXPOSURES = [{ type: "Liability", title: "Penalty Clause B", value: "€1.2M", tone: "risk", icon: "!" }, { type: "Revenue", title: "Service SLA Met", value: "+€850k", tone: "positive", icon: "✓" }];

export default function FinancialExposure() {
  return <section className="op-home-financial" aria-labelledby="financial-exposure-title"><div className="op-container"><div className="op-home-section-heading"><p className="op-eyebrow">Contract economics</p><h2 id="financial-exposure-title">Financial Exposure</h2><p>Trace every cent across your contracts.</p></div><div className="op-home-exposure-list">{EXPOSURES.map((exposure) => <article key={exposure.title} className={`op-exposure-card op-exposure-${exposure.tone}`}><span className="op-exposure-icon" aria-hidden="true">{exposure.icon}</span><div><small>{exposure.type}</small><h3>{exposure.title}</h3></div><strong>{exposure.value}</strong></article>)}</div><p className="op-home-disclaimer">Illustrative examples only. Actual exposure depends on the applicable agreement, operational conditions, and actions taken.</p></div></section>;
}