import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Maximize2, X } from "lucide-react";
import { MattExperience, MattPresenceOnly } from "../../routes/Matt";
import { useDemoData } from "../../demo/DemoDataProvider";
import { useOrganization } from "../../context/OrganizationContext";
import { useAuth } from "../../context/AuthContext";
import { useMattIntroduction } from "../matt/mattIntroduction";
import MattEnvironment from "../matt/MattEnvironment";
import "../../styles/mattFloating.css";
import { mattPageId } from "../../../../shared/operionPlatformKnowledge.js";

export default function OperionAssistant() {
  const { contracts, primaryContract } = useDemoData();
  return <MattFloating demo contracts={contracts} primaryContract={primaryContract}/>;
}

export function MattFloating({ demo = false, contracts = [], primaryContract, presenceOnly = false }) {
  const location = useLocation();
  const { organizationId } = useOrganization();
  const { user } = useAuth();
  const introduction = useMattIntroduction(demo ? "demo" : `user:${user?.id}`);
  const [open, setOpen] = useState(false), [inlineIntroduction, setInlineIntroduction] = useState(false), [flight, setFlight] = useState(null);
  const [introductionError, setIntroductionError] = useState("");
  const [selectedContext, setSelectedContext] = useState(null);
  const [contextMode, setContextMode] = useState("analysis");
  const trigger = useRef(null), panel = useRef(null);
  const base = demo ? "/demo" : "/app";
  const contractId = location.pathname.match(/^\/(?:demo|app)\/contracts\/([^/]+)/)?.[1] || new URLSearchParams(location.search).get("contract");
  const contract = presenceOnly ? null : selectedContext?.contract || contracts.find((item) => item.id === contractId) || primaryContract || (contractId ? { id: contractId, title: "Selected authorized contract" } : null);
  useEffect(() => {
    const show = (event) => {
      if (demo && event.detail?.flight) setFlight(event.detail.flight);
      if (!presenceOnly && event.detail?.contract?.id) { setSelectedContext({ contract: event.detail.contract, analysisRunId: event.detail.analysisRunId }); setFlight(null); }
      setInlineIntroduction(false);
      setOpen(true);
    };
    const update = (event) => setFlight(demo ? event.detail?.flight || null : null);
    window.addEventListener("operion:assistant", show);
    window.addEventListener("operion:aviation-context", update);
    return () => { window.removeEventListener("operion:assistant", show); window.removeEventListener("operion:aviation-context", update); };
  }, [demo, presenceOnly]);
  useEffect(() => { setFlight(null); setSelectedContext(null); setContextMode("analysis"); setOpen(false); }, [location.pathname, location.search, organizationId, presenceOnly]);
  useEffect(() => {
    if ((demo || user?.id) && !location.pathname.startsWith(`${base}/matt`) && !document.querySelector(".matt-page") && introduction.outcome === "intro_not_seen") {
      if (demo) setInlineIntroduction(true);
      else setOpen(true);
    }
  }, [base, demo, user?.id, location.pathname, introduction.outcome]);
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
  if (!presenceOnly) { query.set("scope", contextMode); query.set("page", mattPageId(location.pathname)); }
  return <>
    {demo && inlineIntroduction && (!introduction.completed || introductionError) && <InlineIntroduction error={introductionError} onError={setIntroductionError} onDismiss={() => setInlineIntroduction(false)}/>}
    <div className="matt-floating">
    <button ref={trigger} type="button" className="matt-floating-trigger" aria-label={open ? "Close Matt assistant" : "Ask Matt"} aria-expanded={open} onClick={() => { setInlineIntroduction(false); setOpen((value) => !value); }}>
      <span className="matt-floating-portrait" aria-hidden="true"><img src="/matt/executive-office.jpg" alt="" width="40" height="40" decoding="async"/></span><span>Matt</span>
    </button>
    {open && <section ref={panel} className="matt-floating-panel" role="dialog" aria-label="Matt contextual assistant">
      <header><strong>{presenceOnly ? "MATT / PLATFORM-ONLY PRESENCE" : `ASK MATT / ${flight ? flight.id : contract?.title || "Authorized contract context"}`}</strong><Link to={`${base}/matt${presenceOnly ? "" : `?${query}`}`} onClick={() => setOpen(false)}><Maximize2 size={16}/>Expand Matt</Link><button type="button" aria-label="Close Matt panel" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={18}/></button></header>
      {presenceOnly
        ? <MattPresenceOnly compact/>
        : <MattExperience key={flight?.id || contract?.id || organizationId} demo={demo} organizationId={organizationId} contract={flight ? undefined : contract} analysisRunId={selectedContext?.analysisRunId} flight={flight} initialMode={contextMode} onScopeChange={setContextMode} compact/>}
    </section>}
    </div>
  </>;
}

function InlineIntroduction({ error, onError, onDismiss }) {
  const [mediaStatus, setMediaStatus] = useState("idle");
  return <section className="matt-inline-introduction" aria-labelledby="matt-introduction-heading">
    <h2 id="matt-introduction-heading">Meet Matt</h2>
    <p>Watch the introduction or continue exploring the Demo below.</p>
    <MattEnvironment introductionKey="demo" phase={mediaStatus} onMediaStatus={setMediaStatus} onMediaError={onError}/>
    {error && <><p role="alert">{error}</p><button type="button" onClick={onDismiss}>Dismiss introduction</button></>}
  </section>;
}
