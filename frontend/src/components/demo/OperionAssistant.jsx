import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Maximize2, X, Video } from "lucide-react";
import { MattExperience, MattPresenceOnly } from "../../routes/Matt";
import { useDemoData } from "../../demo/DemoDataProvider";
import { useOrganization } from "../../context/OrganizationContext";
import "../../styles/mattFloating.css";

export default function OperionAssistant() {
  const { contracts, primaryContract } = useDemoData();
  return <MattFloating demo contracts={contracts} primaryContract={primaryContract}/>;
}

export function MattFloating({ demo = false, contracts = [], primaryContract, presenceOnly = false }) {
  const location = useLocation();
  const { organizationId } = useOrganization();
  const [open, setOpen] = useState(false), [flight, setFlight] = useState(null);
  const [selectedContext, setSelectedContext] = useState(null);
  const trigger = useRef(null), panel = useRef(null);
  const base = demo ? "/demo" : "/app";
  const contractId = location.pathname.match(/^\/(?:demo|app)\/contracts\/([^/]+)/)?.[1] || new URLSearchParams(location.search).get("contract");
  const contract = presenceOnly ? null : selectedContext?.contract || contracts.find((item) => item.id === contractId) || primaryContract || (contractId ? { id: contractId, title: "Selected authorized contract" } : null);
  useEffect(() => {
    const show = (event) => {
      if (demo && event.detail?.flight) setFlight(event.detail.flight);
      if (!presenceOnly && event.detail?.contract?.id) { setSelectedContext({ contract: event.detail.contract, analysisRunId: event.detail.analysisRunId }); setFlight(null); }
      setOpen(true);
    };
    const update = (event) => setFlight(demo ? event.detail?.flight || null : null);
    window.addEventListener("operion:assistant", show);
    window.addEventListener("operion:aviation-context", update);
    return () => { window.removeEventListener("operion:assistant", show); window.removeEventListener("operion:aviation-context", update); };
  }, [demo, presenceOnly]);
  useEffect(() => { setFlight(null); setSelectedContext(null); setOpen(false); }, [location.pathname, location.search, organizationId, presenceOnly]);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector("button")?.focus();
    const key = (event) => {
      if (event.key === "Escape") { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  if (location.pathname.startsWith(`${base}/matt`)) return null;
  const query = new URLSearchParams(!presenceOnly && flight ? { flight: flight.id } : !presenceOnly && contract ? { contract: contract.id, ...(selectedContext?.analysisRunId ? { analysis: selectedContext.analysisRunId } : {}) } : {});
  return <div className="matt-floating">
    <button ref={trigger} type="button" className="matt-floating-trigger" aria-label={open ? "Close Matt assistant" : "Open Matt assistant"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <Video size={24} aria-hidden="true"/><span>Matt</span>
    </button>
    {open && <section ref={panel} className="matt-floating-panel" role="dialog" aria-label="Matt contextual assistant">
      <header><strong>{presenceOnly ? "MATT / PLATFORM-ONLY PRESENCE" : `ASK MATT / ${flight ? flight.id : contract?.title || "Authorized contract context"}`}</strong><Link to={`${base}/matt${presenceOnly ? "" : `?${query}`}`} onClick={() => setOpen(false)}><Maximize2 size={16}/>Expand Matt</Link><button type="button" aria-label="Close Matt panel" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={18}/></button></header>
      {presenceOnly
        ? <MattPresenceOnly compact/>
        : <MattExperience key={flight?.id || contract?.id || organizationId} demo={demo} organizationId={organizationId} contract={flight ? undefined : contract} analysisRunId={selectedContext?.analysisRunId} flight={flight} compact/>}
    </section>}
  </div>;
}
