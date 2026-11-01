import React, { useEffect, useId, useRef, useState } from "react";
import { Plane, Sparkles, X } from "lucide-react";
import { DemoBadge } from "../../demo/DemoUI";
import { GLOBE_DEMO_NOTICE } from "../../demo/globeIntelligenceData";

export default function AircraftInfoPopup({ aircraft, onClose, onInspectContract, selectedAlertId, onAskMatt }) {
  const titleId = useId();
  const { event, contract, exposure, recommendations } = aircraft.intelligence;
  const [factsOpen, setFactsOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(Boolean(selectedAlertId));
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);
  const { legal, operationalExposure } = aircraft.intelligence;
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  function closeCard() {
    if (closing) return;
    setClosing(true);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 150;
    closeTimer.current = window.setTimeout(onClose, delay);
  }
  function askMatt() {
    window.dispatchEvent(new CustomEvent("operion:assistant", { detail: { flight: aircraft } }));
    onAskMatt?.(aircraft);
  }
  return <section className={`od-aircraft-popup od-dashboard-flight-details od-globe-spatial-infocard${closing ? " is-closing" : ""}`} role="dialog" aria-modal="false"
    data-testid="globe-aircraft-infocard"
    aria-labelledby={titleId} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); closeCard(); } }}
    onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
    <header className="od-aircraft-popup-header">
      <div className="od-dashboard-selected-heading"><span className="od-dashboard-plane-icon"><Plane size={18}/></span><div><small>Selected simulated flight · {aircraft.flightNumber}</small><h3 id={titleId}>{aircraft.registration}</h3></div></div>
      <button type="button" className="od-aircraft-popup-close" onClick={closeCard} aria-label="Close aircraft infocard"><X size={18}/></button>
    </header>
    <p className="od-intelligence-notice">{GLOBE_DEMO_NOTICE}</p>
    <DemoBadge tone={aircraft.status === "On time" ? "success" : "neutral"}>{aircraft.status}</DemoBadge>
    <p className="od-dashboard-flight-operator">{aircraft.operator} · {aircraft.type} · {aircraft.callsign} · simulated status</p>
    <div className="od-dashboard-route"><span><small>ORIGIN · {aircraft.originCountry}</small><strong>{aircraft.origin}</strong><em>{aircraft.scheduledDeparture}</em></span><i aria-hidden="true"/><Plane size={16}/><span><small>DESTINATION · {aircraft.destinationCountry}</small><strong>{aircraft.destination}</strong><em>{aircraft.estimatedArrival}</em></span></div>
    <div className="od-globe-flight-meta"><span>Route distance <strong>{aircraft.routeDistanceKm.toLocaleString()} km · approximate great circle</strong></span><span>Data time <strong>{aircraft.dataTimestamp}</strong></span><span>Source <strong>Fixed scenario / airport table · no live telemetry</strong></span></div>
    <details open={factsOpen} onToggle={(event) => setFactsOpen(event.currentTarget.open)}><summary>Aircraft and flight details</summary>{factsOpen && <dl className="od-dashboard-flight-facts">
      {[["Aircraft identifier", aircraft.id], ["Flight", aircraft.flightNumber], ["Model", aircraft.model], ["Lessor / ownership", aircraft.lessor], ["Manufacture year", aircraft.manufactureYear ?? "Not provided"], ["Aircraft condition", aircraft.condition],
        ["Scheduled departure", aircraft.scheduledDeparture], ["Estimated departure", aircraft.estimatedDeparture], ["Scheduled arrival", aircraft.scheduledArrival], ["Estimated arrival", aircraft.estimatedArrival], ["Delay", `${aircraft.delayMinutes} scenario minutes`], ["Rerouting", aircraft.rerouting],
        ["Route distance", `${aircraft.routeDistanceKm.toLocaleString()} km · approximate great circle`], ["Flight source", GLOBE_DEMO_NOTICE], ["Altitude", `${aircraft.altitude.toLocaleString()} m · simulated`], ["Ground speed", `${aircraft.speed} km/h · simulated`], ["Heading", `${aircraft.heading.toFixed(0)}° · simulated`], ["Flight phase", `${aircraft.phase} · simulated`]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>}</details>
    <h4>Operational conditions / last event</h4><p>{event.title} · {event.at}</p><p>Source: {event.source}. No live weather, ownership, airframe condition or operational verification.</p>
    <details className="od-globe-operational-exposure"><summary>Operational exposure by scenario</summary><ul>{operationalExposure.map((item) => <li key={item.category}><strong>{item.category}</strong><span>{item.assessment}</span></li>)}</ul></details>
    {!!aircraft.alerts.length && <details open={alertsOpen} onToggle={(event) => setAlertsOpen(event.currentTarget.open)} aria-label="Aircraft alerts"><summary>{aircraft.alerts.length} alerts requiring review</summary>{alertsOpen && aircraft.alerts.map((alert) => <article className={alert.id === selectedAlertId ? "od-intelligence-selected-alert" : ""} data-alert-id={alert.id} key={alert.id}>
      <strong>{alert.title}</strong><p>{alert.category} · {alert.severity} · {alert.actionStatus}</p><small>Evidence: {alert.evidence}</small>
    </article>)}</details>}
    <section className="od-globe-exposure-summary"><h4>Potential financial exposure</h4><strong>{exposure.state}</strong>{exposure.amount !== null && <strong>{exposure.currency} {exposure.amount.toLocaleString()} · hypothetical only</strong>}<p>{exposure.basis}</p><p>Confidence: {exposure.confidence}</p><ul>{exposure.components.map((component) => <li key={component}>{component}</li>)}</ul>
      <p>{exposure.assumptions} No confirmed contractual amount or actual liability is established; a delay alone never establishes a breach.</p></section>
    <button type="button" className="od-button" onClick={onInspectContract}>Inspect associated contract</button>
    <p>{contract.title} · {contract.type}</p>
    <details open={evidenceOpen} onToggle={(event) => setEvidenceOpen(event.currentTarget.open)}><summary>Contract evidence and obligations</summary>{evidenceOpen && <>
      <p>Relevant clause: {contract.clause?.title || "No applicable clause supplied"}</p>
      <p>Evidence: {contract.clause?.source || "Insufficient evidence"}</p>
      <blockquote>{contract.clause?.text || "No clause text supplied."}</blockquote>
      <p>Obligation: {contract.obligation?.title || "Not established"}</p>
      <p>Status: {contract.obligation?.status || "Not established"}</p>
      <p>Deadline: {contract.obligation?.deadline || "Not established"}</p>
      <dl className="od-dashboard-flight-facts">{Object.entries(contract.provisions).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </>}</details>
    <details className="od-globe-legal-candidates"><summary>Legal-scope candidates · not legal advice</summary>
      <p>{legal.notice}</p><p>Governing law: {legal.governingLaw}</p>
      {legal.candidates.map((candidate) => <article key={candidate.id}>
        <strong>{candidate.framework}</strong><span>{candidate.confidence}</span><p>{candidate.basis}</p><p>Potential scope: {candidate.scope}</p><p>Conditions to verify: {candidate.conditions}</p>
        <a href={candidate.source.url} target="_blank" rel="noopener noreferrer">Source: {candidate.source.title}</a>
      </article>)}
    </details>
    <h4>Recommended actions — rule-based, not automatically executed</h4>
    {recommendations.map((action) => <article key={action.id}><strong>{action.title}</strong><p>{action.reason}</p></article>)}
    {!recommendations.length && <p>No identified exposure or recommended action in this scenario.</p>}
    <button type="button" className="od-button od-globe-ask-matt" onClick={askMatt}><Sparkles size={16}/>Ask Matt about this flight</button>
  </section>;
}
