import React, { useId } from "react";
import { Link } from "react-router-dom";
import { ImageOff, Plane, X } from "lucide-react";
import { DemoBadge } from "../../demo/DemoUI";

export default function AircraftInfoPopup({ aircraft, contracts, onClose }) {
  const titleId = useId();
  return <section className="od-aircraft-popup od-dashboard-flight-details" role="dialog" aria-modal="false"
    aria-labelledby={titleId} onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); }
    }}
    onPointerDown={(event) => event.stopPropagation()}
    onWheel={(event) => event.stopPropagation()}>
    <header className="od-aircraft-popup-header">
      <div className="od-dashboard-selected-heading">
        <span className="od-dashboard-plane-icon"><Plane size={18}/></span>
        <div><small>Selected aircraft · synthetic</small><h3 id={titleId}>{aircraft.registration}</h3></div>
      </div>
      <button type="button" className="od-aircraft-popup-close" onClick={onClose} aria-label="Close aircraft infocard"><X size={18}/></button>
    </header>
    <DemoBadge tone={aircraft.status === "On time" ? "success" : "neutral"}>{aircraft.status}</DemoBadge>
    <p className="od-dashboard-flight-operator">{aircraft.operator} · {aircraft.type} · {aircraft.callsign}</p>
    <div className="od-dashboard-route">
      <span><small>ORIGIN</small><strong>{aircraft.origin}</strong><em>{aircraft.departure}</em></span>
      <i aria-hidden="true"/><Plane size={16}/>
      <span><small>DESTINATION</small><strong>{aircraft.destination}</strong><em>{aircraft.eta}</em></span>
    </div>
    <dl className="od-dashboard-flight-facts">
      <div><dt>Altitude</dt><dd>{aircraft.altitude.toLocaleString()} m</dd></div>
      <div><dt>Ground speed</dt><dd>{aircraft.speed} km/h</dd></div>
      <div><dt>Heading</dt><dd>{aircraft.heading}°</dd></div>
      <div><dt>Flight phase</dt><dd>{aircraft.phase}</dd></div>
    </dl>
    <div className="od-flight-contract-links">{aircraft.contractIds.map((id) =>
      <Link className="od-button" key={id} to={`/demo/contracts/${id}`}>Inspect {id.replace("demo-", "").replaceAll("-", " ")} contract</Link>)}</div>
    <details className="od-spatial-contract-context"><summary>Contract intelligence for {aircraft.registration}</summary>
      <p>Prepared relationships only. MSN, live performance and supplier facility locations are unavailable. Non-lease demo records share sample legal evidence and require individual validation.</p>
      {contracts.map((contract) => <article key={contract.id}>
        <h4>{contract.title} · {contract.contractId}</h4>
        <p>{contract.counterparty} · {contract.status} · {contract.effective} – {contract.expiry}</p>
        {contract.type === "Aircraft Operating Lease" && <p>Lessor: {contract.lessor} · Lessee: {contract.lessee}</p>}
        <div className="od-flight-contract-links">{["clauses", "obligations", "deadlines", "risks", "financial-impact", "evidence"].map((section) =>
          <Link key={section} to={`/demo/contracts/${contract.id}/${section}`}>{section.replaceAll("-", " ")}</Link>)}</div>
      </article>)}
    </details>
    <div className="od-aircraft-photo-unavailable" role="status">
      <ImageOff size={20}/><strong>Aircraft photo unavailable</strong>
      <p>This aircraft is part of a synthetic scenario. No verified, licensed photograph is available; a stock image would not identify this airframe.</p>
    </div>
  </section>;
}
