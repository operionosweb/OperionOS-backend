import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { GLOBE_DEMO_NOTICE } from "../../demo/globeIntelligenceData";
import { activeFilters, ALERT_FILTERS, alertValues, DEFAULT_FLEET_FILTERS, filterOptions, fleetValues, FLEET_INTELLIGENCE_FILTERS } from "./globeIntelligence";

export function IntelligenceFilters({ fields, records, values, filters, onChange, defaults = {} }) {
  return <>
    <div className="od-intelligence-active-filters" aria-label="Active filters">
      <strong>{activeFilters(filters, defaults).length} active filters</strong>
      {activeFilters(filters, defaults).map(([key, value]) => <button type="button" key={key} onClick={() => onChange({ ...filters, [key]: defaults[key] || "" })} aria-label={`Remove ${fields.find(([id]) => id === key)?.[1]} filter`}>{value} <X size={12}/></button>)}
    </div>
    <details className="od-intelligence-filter-details"><summary>Combine detailed filters</summary><div className="od-intelligence-filter-grid">
      {fields.map(([key, label]) => <label key={key}>{label}<select aria-label={label} value={filters[key] || ""} onChange={(event) => onChange({ ...filters, [key]: event.target.value })}>
        <option value="">All</option>
        {filterOptions(records, values, key).map((value) => <option key={value}>{value}</option>)}
      </select></label>)}
    </div></details>
  </>;
}

export function FleetIntelligenceFilters({ aircraft, filters, onChange }) {
  return <>
    <div className="od-intelligence-presets" role="group" aria-label="Fleet investigation presets">
      {[["Disruptions", { flightStatus: "Delayed" }], ["Notice deadlines", { deadline: "Within 15 minutes" }], ["Unquantified exposure", { unquantified: "Yes" }], ["High exposure review", { highExposure: "Yes — scenario ≥ EUR 300" }]].map(([label, preset]) =>
        <button type="button" key={label} onClick={() => onChange({ ...DEFAULT_FLEET_FILTERS, ...preset })}>{label}</button>)}
    </div>
    <IntelligenceFilters fields={FLEET_INTELLIGENCE_FILTERS} records={aircraft} values={fleetValues} filters={filters} onChange={onChange} defaults={DEFAULT_FLEET_FILTERS}/>
  </>;
}

export function GlobeAlerts({ records, allRecords, filters, onChange, onSelect, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => { closeRef.current?.focus({ preventScroll: true }); }, []);
  return <section className="od-globe-fleet-popup od-dashboard-fleet-card od-globe-alerts" role="dialog" aria-modal="false" aria-label="Globe alerts"
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}
    onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
    <header><h3>Globe alerts</h3><button ref={closeRef} type="button" className="od-aircraft-popup-close" onClick={onClose} aria-label="Close globe alerts"><X size={18}/></button></header>
    <p className="od-intelligence-notice">{GLOBE_DEMO_NOTICE}</p>
    <IntelligenceFilters fields={ALERT_FILTERS} records={allRecords} values={alertValues} filters={filters} onChange={onChange}/>
    <p role="status">{records.length} matching alerts · current fleet filters also apply</p>
    <div className="od-intelligence-alert-list">{records.map(({ alert, aircraft }) => <button type="button" key={alert.id} onClick={() => onSelect(aircraft.id, alert.id)}>
      <strong>{aircraft.registration} · {alert.severity}</strong><span>{alert.title}</span><small>{aircraft.origin} → {aircraft.destination} · {alert.category} · {alert.actionStatus}</small>
    </button>)}</div>
    {!records.length && <p role="status">No alerts match this fleet and alert filter combination. Clear filters or broaden your market context.</p>}
    <button type="button" className="od-button" onClick={() => onChange({})}>Clear alert filters</button>
  </section>;
}

export function ContractIntelligencePanel({ aircraft, onClose }) {
  const closeRef = useRef(null);
  const { contract, exposure, legal } = aircraft.intelligence;
  useEffect(() => { closeRef.current?.focus({ preventScroll: true }); }, []);
  return <section className="od-aircraft-popup od-dashboard-flight-details od-globe-contract-panel" role="dialog" aria-modal="false" aria-label="Contextual contract inspection"
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}
    onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
    <header className="od-aircraft-popup-header"><div><small>{aircraft.registration} · retained Globe selection</small><h3>{contract.title}</h3></div><button ref={closeRef} type="button" className="od-aircraft-popup-close" onClick={onClose} aria-label="Return to aircraft"><X size={18}/></button></header>
    <p className="od-intelligence-notice">{GLOBE_DEMO_NOTICE}</p>
    <p>{contract.id} · {contract.type} · {contract.counterparty}</p>
    <h4>Relevant clause and evidence</h4>
    {contract.clause ? <><strong>{contract.clause.title}</strong><blockquote>{contract.clause.text}</blockquote><p>Source: {contract.clause.source} · {aircraft.scenarioDate} · fictional excerpt, not verified legal evidence</p></> : <p>No applicable clause supplied. Insufficient evidence; obtain the agreement before assessing obligations.</p>}
    <h4>Obligation and deadline</h4>
    {contract.obligation ? <><p>{contract.obligation.title}</p><p>{contract.obligation.id} · {contract.obligation.status} · {contract.obligation.deadline}</p></> : <p>Obligation not established.</p>}
    <h4>Triggering event</h4><p>{aircraft.intelligence.event.title} · {aircraft.intelligence.event.at}</p>
    <dl className="od-dashboard-flight-facts">{Object.entries(contract.provisions).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <h4>{exposure.state}</h4>{exposure.amount !== null && <p>{exposure.currency} {exposure.amount.toLocaleString()} · hypothetical scenario calculation only</p>}<p>{exposure.basis}</p><p>Confidence: {exposure.confidence}</p><p>{exposure.assumptions}</p>
    <h4>Legal-scope candidates · not legal advice</h4><p>{legal.notice}</p><p>Governing law: {legal.governingLaw}</p>
    {legal.candidates.map((candidate) => <article key={candidate.id}><strong>{candidate.framework} · {candidate.confidence}</strong><p>{candidate.basis}</p><p>Potential scope: {candidate.scope}</p><p>Conditions: {candidate.conditions}</p><a href={candidate.source.url} target="_blank" rel="noopener noreferrer">Source: {candidate.source.title}</a></article>)}
    <h4>Explainable recommendations</h4>
    {aircraft.intelligence.recommendations.map((action) => <article key={action.id}><strong>{action.title}</strong><p>{action.reason}</p></article>)}
    {!aircraft.intelligence.recommendations.length && <p>No action suggested by this scenario.</p>}
    <p>No notice is sent and no contract, audit or customer record is changed by this inspection.</p>
  </section>;
}
