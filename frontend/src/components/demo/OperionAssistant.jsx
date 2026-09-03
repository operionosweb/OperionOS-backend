import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowUp, Atom, Building2, CalendarClock, CheckCircle2,
  ExternalLink, FileCheck2, FileText, ListChecks, Maximize2, Mic, Minimize2,
  Plane, Plus, RotateCcw, Scale, ShieldAlert, Sparkles, Trash2, X,
} from "lucide-react";
import { useDemoData } from "../../demo/DemoDataProvider";
import BrandMark from "../ui/BrandMark";
import { DemoBadge } from "../../demo/DemoUI";

function restoreMessages() {
  try {
    return JSON.parse(sessionStorage.getItem("operion.demo.assistant")) || [];
  } catch {
    return [];
  }
}

function resolveContext(location, contracts, primaryContract, aviationContext) {
  const contractId = location.pathname.match(/^\/demo\/contracts\/([^/]+)/)?.[1];
  const contract = contracts.find((item) => item.id === contractId) || primaryContract;
  const section = location.pathname.split("/").at(-1);
  if (location.pathname.includes("live-tracking")) {
    const aircraft = aviationContext?.aircraft;
    const relatedContracts = aviationContext?.relatedContracts || [];
    return { type: "AIRCRAFT", title: aircraft?.registration || "Aircraft intelligence", subtitle: aircraft ? `${aircraft.model} / ${aircraft.flightNumber}` : "Aviation intelligence ready", contract: relatedContracts[0] || contract, aircraft, relatedContracts, relationships: aviationContext?.relationships || [] };
  }
  if (contractId) {
    const labels = { risks: "Risk intelligence ready", obligations: "Obligation intelligence ready", deadlines: "Deadline intelligence ready", evidence: "Evidence intelligence ready", clauses: "Clause intelligence ready" };
    return { type: section === "assistant" ? "CONTRACT" : (section || "CONTRACT").toUpperCase(), title: contract.title, subtitle: labels[section] || `Analysing ${contract.contractId}`, contract };
  }
  if (location.pathname.includes("intelligence")) return { type: "PORTFOLIO", title: "Contract intelligence", subtitle: "Portfolio intelligence ready", contract };
  if (location.pathname.includes("upload")) return { type: "DOCUMENT", title: "Contract ingestion", subtitle: "Document context ready", contract };
  return { type: "PORTFOLIO", title: "Aviation Partners Ltd.", subtitle: "Portfolio intelligence ready", contract };
}

function suggestionsFor(context) {
  if (context.type === "AIRCRAFT") return ["What aircraft are affected by this contract?", "Show supplier dependencies", "Show linked maintenance obligations"];
  if (context.type === "RISKS") return ["Analyse the highest contract risks", "Which risks have the strongest evidence?", "What should management review first?"];
  if (context.type === "OBLIGATIONS") return ["Show obligations due this month", "Which obligations are conditional?", "Show obligation source clauses"];
  if (context.type === "DEADLINES") return ["Which deadlines are computable?", "Show ambiguous deadlines", "What trigger dates are missing?"];
  return ["Analyse the highest contract risks", "Show obligations due this month", "Summarise this contract", "What happens if we return the aircraft late?"];
}

function evidenceFor(contract, ids) {
  return ids.map((id) => contract.evidence.find((item) => item.id === id)).filter(Boolean);
}

function answerQuestion(question, context) {
  const contract = context.contract;
  const scopedContracts = context.relatedContracts?.length ? context.relatedContracts : [contract];
  const relationshipFor = (item) => context.relationships?.find((relationship) => relationship.contractId === item.id);
  const scopedRisks = scopedContracts.flatMap((item) => { const relationship = relationshipFor(item); return relationship ? item.risks.filter((risk) => relationship.riskIds.includes(risk.id)) : item.risks; });
  const scopedObligations = scopedContracts.flatMap((item) => { const relationship = relationshipFor(item); return relationship ? item.obligations.filter((obligation) => relationship.obligationIds.includes(obligation.id)) : item.obligations; });
  const scopedDeadlines = scopedContracts.flatMap((item) => { const relationship = relationshipFor(item); return relationship ? item.deadlines.filter((deadline) => relationship.deadlineIds.includes(deadline.id)) : item.deadlines; });
  const normalized = question.toLowerCase();
  const base = { id: `answer-${Date.now()}`, role: "assistant", question, contractId: contract.id };
  if (/late|return aircraft|redelivery/.test(normalized)) {
    return { ...base, type: "risk", title: "Late-return exposure identified", summary: "Late return may trigger a daily fee under Clause 22.4. Continued delay may also give the lessor termination rights after the stated period.", confidence: 96, items: contract.risks.filter((risk) => risk.id === "rk-return"), evidence: evidenceFor(contract, ["ev-return", "ev-termination"]), recommendation: "Confirm the contractual return date and prepare the redelivery evidence package before expiry." };
  }
  if (/risk|exposure|management review/.test(normalized)) {
    return { ...base, type: "risk", title: `${scopedRisks.length} material risks identified`, summary: `Operion ranked the prepared findings linked to ${context.aircraft?.registration || contract.contractId} and retained their evidence lineage.`, confidence: 94, items: scopedRisks, evidence: evidenceFor(contract, contract.risks.flatMap((risk) => risk.evidenceIds).slice(0, 3)), recommendation: "Review critical return conditions before the high-severity maintenance records finding." };
  }
  if (/obligation|commitment|insurance/.test(normalized)) {
    const items = /insurance/.test(normalized) ? scopedObligations.filter((item) => item.category === "Insurance") : scopedObligations;
    return { ...base, type: "obligation", title: `${items.length} structured obligation${items.length === 1 ? "" : "s"} found`, summary: "Each obligation remains connected to its actor, timing, condition, clause, and source evidence.", confidence: 97, items, evidence: evidenceFor(contract, items.map((item) => item.evidenceId)), recommendation: "Validate trigger dates before treating relative deadlines as calendar dates." };
  }
  if (/deadline|due|timing|trigger date|ambiguous/.test(normalized)) {
    return { ...base, type: "deadline", title: `${scopedDeadlines.length} deadline expressions found`, summary: "Operion distinguishes absolute, relative, recurring, and event-based timing without inventing missing dates.", confidence: 95, items: scopedDeadlines, evidence: evidenceFor(contract, contract.deadlines.map((item) => item.evidenceId)), recommendation: "Supply the insurance expiry and shop-visit dates to resolve conditional deadlines." };
  }
  if (/contract.*connect|contracts.*affect|related contract/.test(normalized)) return { ...base, type: "answer", title: `${scopedContracts.length} connected contract${scopedContracts.length === 1 ? "" : "s"}`, summary: `${context.aircraft?.registration || "The selected asset"} is connected to ${scopedContracts.map((item) => item.title).join(", ") || "no established contracts"}.`, confidence: scopedContracts.length ? 96 : 0, items: scopedContracts.map((item) => ({ id: item.id, title: item.title, category: item.type, severity: item.status })), evidence: evidenceFor(contract, contract.evidence.slice(0, 2).map((item) => item.id)), recommendation: "Open the connected contract to inspect its clauses and source evidence." };
  if (/aircraft|fleet|maintenance/.test(normalized)) {
    const aircraft = context.aircraft || contract.aircraft;
    return { ...base, type: "aircraft", title: aircraft ? "Aircraft relationship established" : "No aircraft relationship established", summary: aircraft ? `${aircraft.registration} / ${aircraft.model} is linked to ${scopedContracts.length} prepared contract record${scopedContracts.length === 1 ? "" : "s"}.` : "The prepared contract has no aircraft association.", confidence: aircraft ? 92 : 0, items: aircraft ? [{ id: "aircraft", title: aircraft.registration, category: aircraft.model, severity: "Linked" }] : [], evidence: evidenceFor(contract, ["ev-maintenance"]), recommendation: aircraft ? "Review linked maintenance and redelivery obligations." : "Add a verified aircraft-contract relationship before drawing operational conclusions." };
  }
  if (/supplier|counterparty|dependency/.test(normalized)) {
    return { ...base, type: "supplier", title: `${scopedContracts.length} counterparty relationship${scopedContracts.length === 1 ? "" : "s"} identified`, summary: `These counterparties are connected to ${context.aircraft?.registration || contract.contractId} through prepared agreements. Broader supplier concentration is not established.`, confidence: 88, items: scopedContracts.map((item) => ({ id: item.id, title: item.counterparty, category: item.type, severity: "Contractual" })), evidence: [], recommendation: "Review each agreement before inferring portfolio-level supplier dependency." };
  }
  if (/summar|contract/.test(normalized)) {
    return { ...base, type: "answer", title: contract.title, summary: `${contract.contractId} is a prepared ${contract.type.toLowerCase()} between ${contract.lessor} and ${contract.lessee}. Operion identified ${contract.clauses.length} clauses, ${contract.obligations.length} obligations, ${contract.deadlines.length} deadlines, and ${contract.risks.length} risks.`, confidence: 98, items: contract.risks.slice(0, 2), evidence: evidenceFor(contract, ["ev-return", "ev-insurance"]), recommendation: "Open the contract workspace to inspect each finding and its source." };
  }
  return { ...base, type: "unsupported", title: "Insufficient evidence", summary: "Operion could not establish this answer from the available contract evidence.", confidence: 0, items: [], evidence: [], searched: "Prepared clauses, obligations, deadlines, risks, and evidence", found: "No finding with sufficient relevance", missing: "Verified source evidence or a supported operational data source" };
}

function IntelligenceCore({ compact = false }) {
  const signals = compact ? ["RISKS", "EVIDENCE", "AIRCRAFT"] : ["CONTRACTS", "RISKS", "OBLIGATIONS", "DEADLINES", "AIRCRAFT", "SUPPLIERS"];
  return <div className={`oa-core${compact ? " is-compact" : ""}`} aria-hidden="true"><div className="oa-core-rings"><i/><i/><i/><span><Atom size={compact ? 25 : 38}/></span></div>{signals.map((signal, index)=><b key={signal} style={{"--signal-index":index,"--signal-count":signals.length}}>{signal}</b>)}</div>;
}

function ProcessingState() {
  return <div className="oa-processing" role="status" aria-live="polite"><div className="oa-processing-head"><span><Sparkles size={16}/></span><div><strong>Analysing</strong><small>Prepared intelligence corpus</small></div></div><div className="oa-processing-path">{["Contract clauses","Obligations","Deadlines","Risk relationships"].map((label,index)=><div key={label} style={{"--step":index}}><i><CheckCircle2 size={13}/></i><span>{label}</span></div>)}</div></div>;
}

function FindingIcon({ type }) {
  const Icon = { risk: ShieldAlert, obligation: ListChecks, deadline: CalendarClock, aircraft: Plane, supplier: Building2, answer: FileText }[type] || Scale;
  return <Icon size={17}/>;
}

function AssistantAnswer({ message, onEvidence }) {
  if (message.type === "unsupported") return <article className="oa-answer oa-answer-unsupported"><header><span><AlertTriangle size={17}/></span><div><small>Safety mechanism</small><h3>{message.title}</h3></div></header><p>{message.summary}</p><dl className="oa-missing-grid"><div><dt>Evidence searched</dt><dd>{message.searched}</dd></div><div><dt>What was found</dt><dd>{message.found}</dd></div><div><dt>What is missing</dt><dd>{message.missing}</dd></div></dl></article>;
  return <article className="oa-answer"><header><span><FindingIcon type={message.type}/></span><div><small>Operion AI / evidence-grounded</small><h3>{message.title}</h3></div><em>{message.confidence}% confidence</em></header><p>{message.summary}</p>{!!message.items.length&&<div className="oa-findings">{message.items.slice(0,4).map((item,index)=><div key={item.id}><b>{String(index+1).padStart(2,"0")}</b><span><small>{item.category || item.type || "Intelligence finding"}</small><strong>{item.title}</strong>{(item.rationale||item.timing)&&<p>{item.rationale||item.timing}</p>}</span><em>{item.severity || item.modality || item.status}</em></div>)}</div>}{!!message.evidence.length&&<div className="oa-evidence-list"><h4><FileCheck2 size={15}/>Source evidence</h4>{message.evidence.slice(0,3).map((item)=><button key={item.id} type="button" onClick={()=>onEvidence(message.contractId,item)}><span><strong>{item.locator}</strong><small>Contract source / page {item.page}</small></span><ExternalLink size={14}/></button>)}</div>}<div className="oa-recommendation"><small>Recommended action</small><strong>{message.recommendation}</strong></div></article>;
}

function ContextPanel({ context }) {
  const contract = context.contract;
  return <aside className="oa-context-panel"><header><span>Active intelligence context</span><DemoBadge>DEMO DATA</DemoBadge></header><div className="oa-context-identity"><span><FileText size={19}/></span><div><small>{context.type}</small><strong>{context.title}</strong><p>{context.subtitle}</p></div></div><dl><div><dt>Contract</dt><dd>{contract.contractId}</dd></div><div><dt>Aircraft</dt><dd>{contract.aircraft?.registration || "Not established"}</dd></div><div><dt>Counterparty</dt><dd>{contract.counterparty}</dd></div><div><dt>Evidence</dt><dd>{contract.evidence.length} prepared sources</dd></div></dl><div className="oa-context-signals">{[[ShieldAlert,"Risks",contract.risks.length],[ListChecks,"Obligations",contract.obligations.length],[CalendarClock,"Deadlines",contract.deadlines.length]].map(([Icon,label,value])=><div key={label}><Icon size={15}/><span>{label}</span><strong>{value}</strong></div>)}</div><p className="oa-context-honesty"><CheckCircle2 size={15}/>Synthetic demo data remains isolated from production tenant records.</p></aside>;
}

function CommandInput({ value, onChange, onSubmit, onFocus, focused, compact = false }) {
  return <form className={`oa-command${focused ? " is-focused" : ""}`} onSubmit={onSubmit}><button type="button" aria-label="Add context"><Plus size={18}/></button><label><span className="oa-sr-only">Ask Operion</span><textarea rows="1" value={value} onChange={(event)=>onChange(event.target.value)} onFocus={onFocus} placeholder={compact ? "Ask about this context..." : "Ask Operion about contracts, evidence, aircraft, or risk..."} onKeyDown={(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();event.currentTarget.form.requestSubmit();}}}/></label><button type="button" disabled aria-label="Voice input is not enabled in demo mode" title="Voice input is not enabled in demo mode"><Mic size={18}/></button><button type="submit" className="oa-command-send" aria-label="Send command"><ArrowUp size={18}/></button></form>;
}

export default function OperionAssistant() {
  const location = useLocation();
  const navigate = useNavigate();
  const { contracts, primaryContract } = useDemoData();
  const bubbleRef = useRef(null);
  const panelRef = useRef(null);
  const [mode,setMode]=useState("closed");
  const [question,setQuestion]=useState("");
  const [messages,setMessages]=useState(restoreMessages);
  const [processing,setProcessing]=useState(false);
  const [focused,setFocused]=useState(false);
  const [aviationContext,setAviationContext]=useState(null);
  const context=useMemo(()=>resolveContext(location,contracts,primaryContract,aviationContext),[location,contracts,primaryContract,aviationContext]);
  const suggestions=useMemo(()=>suggestionsFor(context),[context]);

  useEffect(()=>{sessionStorage.setItem("operion.demo.assistant",JSON.stringify(messages));},[messages]);
  useEffect(()=>{if(location.pathname.endsWith("/assistant"))setMode("full");},[location.pathname]);
  useEffect(()=>{const open=(event)=>{if(event.detail?.aviation)setAviationContext(event.detail.aviation);setMode(event.detail?.mode||"panel");};const update=(event)=>setAviationContext(event.detail);window.addEventListener("operion:assistant",open);window.addEventListener("operion:aviation-context",update);return()=>{window.removeEventListener("operion:assistant",open);window.removeEventListener("operion:aviation-context",update);};},[]);
  useEffect(()=>{document.body.classList.toggle("oa-lock",mode==="full");return()=>document.body.classList.remove("oa-lock");},[mode]);
  useEffect(()=>{if(mode!=="closed")window.setTimeout(()=>panelRef.current?.querySelector("textarea")?.focus(),180);},[mode]);
  useEffect(()=>{const close=(event)=>{if(event.key==="Escape"&&mode!=="closed"){setMode(mode==="full"?"panel":"closed");bubbleRef.current?.focus();}};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close);},[mode]);
  useEffect(()=>{if(mode!=="full")return undefined;const trap=(event)=>{if(event.key!=="Tab")return;const controls=[...panelRef.current.querySelectorAll('a[href],button:not([disabled]),textarea')];if(!controls.length)return;const first=controls[0];const last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}};document.addEventListener("keydown",trap);return()=>document.removeEventListener("keydown",trap);},[mode]);

  const submit=(event,text=question)=>{event?.preventDefault();const value=text.trim();if(!value||processing)return;setMessages((current)=>[...current,{id:`question-${Date.now()}`,role:"user",content:value}]);setQuestion("");setProcessing(true);window.setTimeout(()=>{setMessages((current)=>[...current,answerQuestion(value,context)]);setProcessing(false);},850);};
  const openEvidence=(contractId,item)=>{navigate(`/demo/contracts/${contractId}/evidence`,{state:{evidenceId:item.id}});setMode("closed");};
  const clear=()=>{setMessages([]);setQuestion("");};
  const close=()=>{setMode("closed");bubbleRef.current?.focus();};

  return <div className={`oa-root oa-mode-${mode}`} data-context={context.type.toLowerCase()} aria-live="polite">
    {mode!=="full"&&<button ref={bubbleRef} type="button" className="oa-bubble" onClick={()=>setMode(mode==="closed"?"panel":"closed")} aria-label={mode==="closed"?"Open Operion AI Assistant":"Close Operion AI Assistant"} aria-expanded={mode==="panel"}><span className="oa-bubble-orbit"/><Atom size={25}/><i/></button>}
    {mode==="panel"&&<section ref={panelRef} className="oa-panel" role="dialog" aria-label="Operion AI Assistant"><header className="oa-panel-header"><div className="oa-ai-mark"><Atom size={20}/><i/></div><div><strong>OPERION AI</strong><span>Intelligence Assistant</span></div><em><i/>Ready / Demo</em><div className="oa-header-actions"><button type="button" onClick={close} aria-label="Minimize Assistant"><Minimize2 size={17}/></button><button type="button" onClick={()=>setMode("full")} aria-label="Open full Assistant"><Maximize2 size={17}/></button></div></header><div className="oa-panel-context"><span>{context.type}</span><div><strong>{context.title}</strong><small>{context.subtitle}</small></div></div><div className="oa-panel-body">{!messages.length&&!processing?<><IntelligenceCore compact/><div className="oa-panel-intro"><span>Context connected</span><h2>{context.subtitle}</h2><p>Ask across prepared contracts, evidence, obligations, risks, and aircraft relationships.</p></div><div className="oa-quick-list">{suggestions.slice(0,3).map((item)=><button key={item} type="button" onClick={(event)=>submit(event,item)}>{item}<ArrowUp size={13}/></button>)}</div></>:<div className="oa-thread">{messages.map((message)=>message.role==="user"?<article key={message.id} className="oa-question"><small>Your command</small><p>{message.content}</p></article>:<AssistantAnswer key={message.id} message={message} onEvidence={openEvidence}/>)}{processing&&<ProcessingState/>}</div>}</div><div className="oa-panel-command"><CommandInput compact value={question} onChange={setQuestion} onSubmit={submit} onFocus={()=>setFocused(true)} focused={focused}/><button type="button" className="oa-open-full" onClick={()=>setMode("full")}><Maximize2 size={15}/>Open Full Assistant</button><small>Prepared demo intelligence / no production records</small></div></section>}
    {mode==="full"&&<section ref={panelRef} className="oa-workspace" role="dialog" aria-modal="true" aria-labelledby="oa-workspace-title"><header className="oa-workspace-header"><div className="oa-workspace-brand"><BrandMark to="/demo/dashboard" size="sm"/><span/><div><strong id="oa-workspace-title">OPERION AI</strong><small>Intelligence Assistant</small></div></div><div className="oa-engine-state"><i/><span><strong>Intelligence Engine Ready</strong><small>{context.type} / {context.title}</small></span></div><div className="oa-workspace-actions"><button type="button" onClick={clear}><RotateCcw size={16}/>New Analysis</button><button type="button" onClick={clear}><Trash2 size={16}/>Clear Context</button><button type="button" onClick={()=>setMode("panel")}><Minimize2 size={16}/><span>Minimize</span></button><button type="button" onClick={close} aria-label="Close Assistant"><X size={18}/></button></div></header><div className="oa-workspace-grid"><main className="oa-conversation">{!messages.length&&!processing?<div className="oa-idle"><IntelligenceCore/><div><span>Connected organizational intelligence</span><h1>{context.subtitle}</h1><p>Operion connects prepared contracts, clauses, obligations, deadlines, risks, evidence, aircraft, and counterparties without inventing unsupported conclusions.</p></div><div className="oa-quick-grid">{suggestions.map((item,index)=><button key={item} type="button" onClick={(event)=>submit(event,item)}><span>{String(index+1).padStart(2,"0")}</span><strong>{item}</strong><ArrowUp size={15}/></button>)}</div></div>:<div className="oa-full-thread">{messages.map((message)=>message.role==="user"?<article key={message.id} className="oa-question"><small>Your command</small><p>{message.content}</p></article>:<AssistantAnswer key={message.id} message={message} onEvidence={openEvidence}/>)}{processing&&<ProcessingState/>}</div>}<div className="oa-command-dock"><CommandInput value={question} onChange={setQuestion} onSubmit={submit} onFocus={()=>setFocused(true)} focused={focused}/><div><span><i/>Evidence-first responses</span><small>Demo Mode / deterministic synthetic intelligence</small></div></div></main><ContextPanel context={context}/></div></section>}
  </div>;
}