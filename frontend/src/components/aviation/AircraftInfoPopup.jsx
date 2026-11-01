import React, { useId, useState } from "react";
import { Plane, X } from "lucide-react";
import { DemoBadge } from "../../demo/DemoUI";
import { GLOBE_DEMO_NOTICE } from "../../demo/globeIntelligenceData";

export default function AircraftInfoPopup({ aircraft, onClose, onInspectContract, selectedAlertId }) {
  const titleId = useId();
  const { event, contract, exposure, recommendations } = aircraft.intelligence;
  const [factsOpen, setFactsOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(Boolean(selectedAlertId));
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  return <section className="od-aircraft-popup od-dashboard-flight-details" role="dialog" aria-modal="false"
    aria-labelledby={titleId} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}
    onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
    <header className="od-aircraft-popup-header">
      <div className="od-dashboard-selected-heading"><span className="od-dashboard-plane-icon"><Plane size={18}/></span><div><small>Selected aircraft · fictional scenario</small><h3 id={titleId}>{aircraft.registration}</h3></div></div>
      <button type="button" className="od-aircraft-popup-close" onClick={onClose} aria-label="Close aircraft infocard"><X size={18}/></button>
    </header>
    <p className="od-intelligence-notice">{GLOBE_DEMO_NOTICE}</p>
    <DemoBadge tone={aircraft.status === "On time" ? "success" : "neutral"}>{aircraft.status}</DemoBadge>
    <p className="od-dashboard-flight-operator">{aircraft.operator} · {aircraft.type} · {aircraft.callsign}</p>
    <div className="od-dashboard-route"><span><small>ORIGIN</small><strong>{aircraft.origin}</strong><em>{aircraft.scheduledDeparture}</em></span><i aria-hidden="true"/><Plane size={16}/><span><small>DESTINATION</small><strong>{aircraft.destination}</strong><em>{aircraft.estimatedArrival}</em></span></div>
    <details open={factsOpen} onToggle={(event) => setFactsOpen(event.currentTarget.open)}><summary>Aircraft and flight details</summary>{factsOpen && <dl className="od-dashboard-flight-facts">
      {[["Aircraft identifier", aircraft.id], ["Flight", aircraft.flightNumber], ["Model", aircraft.model], ["Lessor / ownership", aircraft.lessor], ["Manufacture year", aircraft.manufactureYear ?? "Not provided"], ["Aircraft condition", aircraft.condition],
        ["Scheduled departure", aircraft.scheduledDeparture], ["Estimated departure", aircraft.estimatedDeparture], ["Scheduled arrival", aircraft.scheduledArrival], ["Estimated arrival", aircraft.estimatedArrival], ["Delay", `${aircraft.delayMinutes} scenario minutes`], ["Rerouting", aircraft.rerouting],
        ["Altitude", `${aircraft.altitude.toLocaleString()} m`], ["Ground speed", `${aircraft.speed} km/h`], ["Heading", `${aircraft.heading.toFixed(0)}°`], ["Flight phase", aircraft.phase]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>}</details>
    <h4>Operational conditions / last event</h4><p>{event.title} · {event.at}</p><p>Source: {event.source}. No live weather, ownership, airframe condition or operational verification.</p>
    {!!aircraft.alerts.length && <details open={alertsOpen} onToggle={(event) => setAlertsOpen(event.currentTarget.open)} aria-label="Aircraft alerts"><summary>{aircraft.alerts.length} alerts requiring review</summary>{alertsOpen && aircraft.alerts.map((alert) => <article className={alert.id === selectedAlertId ? "od-intelligence-selected-alert" : ""} data-alert-id={alert.id} key={alert.id}>
      <strong>{alert.title}</strong><p>{alert.category} · {alert.severity} · {alert.actionStatus}</p><small>Evidence: {alert.evidence}</small>
    </article>)}</details>}
    <h4>Potential contractual exposure</h4><strong>{exposure.state}</strong><p>{exposure.basis}</p><p>Confidence: {exposure.confidence}</p>
    <p>{exposure.assumptions} A delay alone never establishes a breach.</p>
    <button type="button" className="od-button" onClick={onInspectContract}>Inspect associated contract</button>
    <p>{contract.title} · {contract.type}</p>
    <details open={evidenceOpen} onToggle={(event) => setEvidenceOpen(event.currentTarget.open)}><summary>Contract evidence and obligations</summary>{evidenceOpen && <>
      <p>Relevant clause: {contract.clause?.title || "No applicable clause supplied"}</p>
      <p>Evidence: {contract.clause?.source || "Insufficient evidence"}</p>
      <p>Obligation: {contract.obligation?.title || "Not established"}</p>
      <p>Deadline: {contract.obligation?.deadline || "Not established"}</p>
      <dl className="od-dashboard-flight-facts">{Object.entries(contract.provisions).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </>}</details>
    <h4>Recommended actions — rule-based, not automatically executed</h4>
    {recommendations.map((action) => <article key={action.id}><strong>{action.title}</strong><p>{action.reason}</p></article>)}
    {!recommendations.length && <p>No identified exposure or recommended action in this scenario.</p>}
  </section>;
}
