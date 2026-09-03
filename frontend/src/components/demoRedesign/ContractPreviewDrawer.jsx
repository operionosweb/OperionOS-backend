import React, { useEffect, useRef, useState } from "react";
import { ExternalLink, FileCheck2, GitBranch, Plane, Sparkles, X } from "lucide-react";
import { DemoBadge, RiskBadge } from "../../demo/DemoUI";

export default function ContractPreviewDrawer({ contract, relationship, linkedAircraft, currentAircraftId, onClose, onOpenContract, onOpenEvidence, onSelectAircraft, onAskOperion }) {
  const closeRef = useRef(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    closeRef.current?.focus();
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [contract.id]);

  const scopedObligations = relationship ? contract.obligations.filter((item) => relationship.obligationIds.includes(item.id)) : contract.obligations;
  const scopedRisks = relationship ? contract.risks.filter((item) => relationship.riskIds.includes(item.id)) : contract.risks;
  const keyRisk = scopedRisks[0];
  return <div className="od-contract-preview-backdrop" role="presentation" onClick={onClose}><aside className="od-contract-preview" role="dialog" aria-modal="true" aria-labelledby="contract-preview-title" onClick={(event) => event.stopPropagation()}><header><div><DemoBadge>CONTRACT NETWORK</DemoBadge><h2 id="contract-preview-title">{contract.title}</h2><p>{contract.type}</p></div><button ref={closeRef} type="button" onClick={onClose} aria-label="Close contract preview"><X size={18}/></button></header><div className="od-contract-preview-status"><DemoBadge tone="success">{contract.status}</DemoBadge><span>{contract.contractId}</span></div><dl className="od-contract-preview-facts"><div><dt>Parties</dt><dd>{contract.lessor} → {contract.lessee}</dd></div><div><dt>Supplier</dt><dd>{contract.counterparty}</dd></div><div><dt>Effective</dt><dd>{contract.effective}</dd></div><div><dt>Expiry</dt><dd>{contract.expiry}</dd></div><div><dt>Related findings</dt><dd>{scopedObligations.length} obligations · {scopedRisks.length} risks</dd></div></dl>{keyRisk && <section className="od-contract-preview-risk"><div><span>Key risk</span><RiskBadge severity={keyRisk.severity}/></div><strong>{keyRisk.title}</strong><p>{keyRisk.rationale}</p><button type="button" onClick={() => onOpenEvidence(keyRisk.evidenceIds[0])}><FileCheck2 size={14}/>View evidence</button></section>}<section className="od-linked-aircraft"><header><div><span>Linked aircraft</span><strong>{linkedAircraft.length}</strong></div><button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}><GitBranch size={14}/>{expanded ? "Hide" : "View"} aircraft dependencies</button></header>{expanded && <div className="od-linked-aircraft-list">{linkedAircraft.map((aircraft) => { const current = aircraft.id === currentAircraftId; return <button type="button" key={aircraft.id} className={current ? "is-current" : ""} onClick={() => !current && onSelectAircraft(aircraft.id)} disabled={current}><span><Plane size={15}/></span><div><strong>{aircraft.registration}{current && <em>Current aircraft</em>}</strong><small>{aircraft.type} · {aircraft.callsign}</small><small>{aircraft.origin} → {aircraft.destination} · {aircraft.status}</small></div></button>; })}</div>}</section><footer><button type="button" onClick={onAskOperion}><Sparkles size={15}/>Ask Operion</button><button type="button" className="is-primary" onClick={onOpenContract}>Open full contract <ExternalLink size={14}/></button></footer></aside></div>;
}