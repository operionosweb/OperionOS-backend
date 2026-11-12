import React, { useCallback, useEffect, useState } from "react";
import { Link, NavLink, useLocation, useParams } from "react-router-dom";
import { Atom, Bot, CalendarClock, ExternalLink, FileText, ListChecks, Plane, ShieldAlert, Sparkles, Star } from "lucide-react";
import { useDemoData } from "../../demo/DemoDataProvider";
import { Confidence, DemoBadge, EmptyState, EvidenceCard, GlassCard, MetricCard, PageHeader, RiskBadge } from "../../demo/DemoUI";
import DemoFinancialImpact from "../../components/demo/DemoFinancialImpact";
import ContractIntelligenceInvestigation from "../../components/demo/ContractIntelligenceInvestigation";
import { trackEvent } from "../../components/analytics/Analytics";
import { MattExperience } from "../Matt";
import { buildAviationContractCore } from "../../../../domain/contractIntelligence/aviationContractCore.js";

const sections = ["overview","clauses","obligations","deadlines","risks","evidence","financial-impact","assistant"];

function WorkspaceOverview({ contract }) {
  const severity = contract.risks.reduce((result,risk)=>({...result,[risk.severity]:(result[risk.severity]||0)+1}),{});
  return <>
    <MattExperience demo contract={contract}/>
    <div className="od-metric-grid od-metric-grid-five"><MetricCard icon={ShieldAlert} label="Contract Health" value={contract.health} note="Prepared risk profile" tone="green"/><MetricCard icon={ListChecks} label="Obligations" value={contract.obligations.length} note="Structured findings"/><MetricCard icon={CalendarClock} label="Deadlines" value={contract.deadlines.length} note="Temporal findings" tone="blue"/><MetricCard icon={ShieldAlert} label="Risks" value={contract.risks.length} note={`${severity.Critical||0} critical`} tone="amber"/><MetricCard icon={FileText} label="Document" value={contract.pages} note="Pages / v1.0" tone="blue"/></div>
    <div className="od-grid-two"><GlassCard title="Top risk areas" eyebrow="Evidence-linked"><div className="od-risk-bars">{contract.risks.map((risk,index)=><Link key={risk.id} to={`../risks`} relative="path" state={{ focusRiskId: risk.id, source: "workspace_overview" }}><span>{risk.category}</span><RiskBadge severity={risk.severity}/><i><b style={{width:`${90-index*18}%`}}/></i></Link>)}</div></GlassCard><GlassCard title="Contract identity" eyebrow="Prepared aviation context"><dl className="od-detail-list"><div><dt>Lessor</dt><dd>{contract.lessor}</dd></div><div><dt>Lessee</dt><dd>{contract.lessee}</dd></div><div><dt>Aircraft</dt><dd>{contract.aircraft ? `${contract.aircraft.registration} / ${contract.aircraft.model}` : "Association unavailable"}</dd></div><div><dt>Effective</dt><dd>{contract.effective}</dd></div><div><dt>Expiry</dt><dd>{contract.expiry}</dd></div></dl></GlassCard></div>
    <div className="od-grid-two"><GlassCard title="Recent obligations" eyebrow="Contract intelligence"><div className="od-compact-list">{contract.obligations.map(item=><Link to="../obligations" relative="path" key={item.id}><span className="od-list-icon"><ListChecks size={15}/></span><div><strong>{item.title}</strong><small>{item.actor} · {item.timing}</small></div><DemoBadge tone="neutral">{item.modality}</DemoBadge></Link>)}</div></GlassCard><GlassCard title="Deadline intelligence" eyebrow="No invented dates"><div className="od-compact-list">{contract.deadlines.map(item=><Link to="../deadlines" relative="path" key={item.id}><span className="od-list-icon"><CalendarClock size={15}/></span><div><strong>{item.title}</strong><small>{item.timing}</small></div><DemoBadge tone="neutral">{item.type}</DemoBadge></Link>)}</div></GlassCard></div>
  </>;
}

function AviationCoverage({ contract, getEvidence, openEvidence }) {
  const sources = contract.clauses.flatMap((clause) => {
    const evidence = getEvidence(clause.evidenceId);
    if (!evidence?.excerpt) return [];
    return [{
      text: evidence.excerpt, title: clause.title, clauseId: clause.id, clauseNumber: clause.number,
      evidenceId: evidence.id, pageNumber: evidence.page, sourceLocation: evidence.locator,
    }];
  });
  const core = buildAviationContractCore(sources);
  const identified = core.topics.filter((topic) => topic.status === "identified_for_review");
  return <GlassCard title="Aviation review coverage" eyebrow="Deterministic synthetic example">
    <p>These prepared excerpts demonstrate the same topic identification used by the contract workspace. A mention requires human review and does not establish an obligation, breach or legal conclusion.</p>
    <p>Topics not identified in these excerpts are not necessarily absent from an agreement. No genuine AI request or customer contract is involved.</p>
    {identified.length ? identified.map((topic) => <div key={topic.id}>
      <strong>{topic.label}</strong>{" · "}Mention identified for review{" "}
      {topic.evidence.map((item) => <button key={item.evidenceId} type="button" onClick={() => openEvidence(getEvidence(item.evidenceId))}>
        View synthetic source{item.pageNumber ? ` · page ${item.pageNumber}` : ""}
      </button>)}
    </div>) : <p>No aviation topics were identified in the prepared excerpts.</p>}
  </GlassCard>;
}

function Clauses({ contract, getEvidence, openEvidence }) {
  return <div className="od-finding-grid">{contract.clauses.map(clause=><article className="od-finding-card" key={clause.id}><header><div><span>Clause {clause.number}</span><h2>{clause.title}</h2></div><RiskBadge severity={clause.risk}/></header><div className="od-finding-meta"><DemoBadge tone="neutral">{clause.category}</DemoBadge><Confidence value={clause.confidence}/></div><blockquote>{clause.text}</blockquote><footer><button type="button" onClick={()=>openEvidence(getEvidence(clause.evidenceId))}>View source evidence <ExternalLink size={14}/></button></footer></article>)}</div>;
}

function Obligations({ contract, getEvidence, openEvidence }) {
  return <div className="od-finding-grid">{contract.obligations.map(item=><article className="od-finding-card" key={item.id}><header><div><span>{item.category}</span><h2>{item.title}</h2></div><DemoBadge tone={item.modality==="Mandatory"?"success":"neutral"}>{item.modality}</DemoBadge></header><dl className="od-structured-grid"><div><dt>Actor</dt><dd>{item.actor}</dd></div><div><dt>Action</dt><dd>{item.action}</dd></div><div><dt>Object</dt><dd>{item.object}</dd></div><div><dt>Timing</dt><dd>{item.timing}</dd></div><div><dt>Condition</dt><dd>{item.condition}</dd></div><div><dt>Frequency</dt><dd>{item.frequency}</dd></div></dl><footer><Confidence value={item.confidence}/><button type="button" onClick={()=>openEvidence(getEvidence(item.evidenceId))}>Evidence <ExternalLink size={14}/></button></footer></article>)}</div>;
}

function Deadlines({ contract, getEvidence, openEvidence }) {
  return <div className="od-timeline">{contract.deadlines.map(item=><article key={item.id}><span className="od-timeline-mark"><CalendarClock size={17}/></span><div className="od-finding-card"><header><div><span>{item.type} deadline</span><h2>{item.title}</h2></div><DemoBadge tone="neutral">{item.status}</DemoBadge></header><strong className="od-deadline-expression">{item.timing}</strong><dl className="od-structured-grid"><div><dt>Trigger</dt><dd>{item.trigger}</dd></div><div><dt>Condition</dt><dd>{item.condition}</dd></div><div><dt>Computability</dt><dd>{item.computability}</dd></div></dl><footer><Confidence value={item.confidence}/><button type="button" onClick={()=>openEvidence(getEvidence(item.evidenceId))}>View evidence</button></footer></div></article>)}</div>;
}

function Risks({ contract, getEvidence, openEvidence, investigateRisk }) {
  return <div className="od-finding-grid">{contract.risks.map(risk=><article className="od-finding-card od-risk-card" key={risk.id}><header><div><span>{risk.category} / {risk.type}</span><h2>{risk.title}</h2></div><RiskBadge severity={risk.severity}/></header><p>{risk.rationale}</p><dl className="od-structured-grid"><div><dt>Consequence</dt><dd>{risk.consequence}</dd></div><div><dt>Financial exposure</dt><dd>{risk.financialExposure}</dd></div></dl><footer><Confidence value={risk.confidence}/><div>{risk.evidenceIds.map(evidenceId=><button type="button" key={evidenceId} onClick={()=>openEvidence(getEvidence(evidenceId))}>Trace {evidenceId}</button>)}<button type="button" onClick={()=>investigateRisk(risk.id)}>Investigate relationship</button></div></footer></article>)}</div>;
}

function EvidenceExplorer({ contract, openEvidence }) {
  return <div className="od-evidence-explorer">{contract.evidence.map(item=><EvidenceCard key={item.id} evidence={item} onOpen={()=>openEvidence(item)}/>)}</div>;
}

function AssistantLanding({ contract }) {
  return <MattExperience demo contract={contract}/>;
}

export default function DemoWorkspace() {
  const { id } = useParams();
  const { contracts } = useDemoData();
  const contract = contracts.find(item => item.id === id);
  if (!contract) return <EmptyState title="Demo contract unavailable" description="No synthetic contract or evidence exists for this identifier."/>;
  return <ContractWorkspace key={contract.id} contract={contract}/>;
}

function ContractWorkspace({ contract }) {
  const { section = "overview" } = useParams();
  const location = useLocation();
  const { getEvidence: lookupEvidence } = useDemoData();
  const getEvidence = useCallback(evidenceId => lookupEvidence(contract.id, evidenceId), [contract.id, lookupEvidence]);
  const activeSection = sections.includes(section) ? section : "overview";
  const [selectedEvidence,setSelectedEvidence]=useState(null);
  const [missingEvidence,setMissingEvidence]=useState(false);
  const [focusedRiskId,setFocusedRiskId]=useState(location.state?.focusRiskId);
  const [focusedNode,setFocusedNode]=useState("risk");
  const openEvidence=(evidence,context={})=>{setMissingEvidence(!evidence);setSelectedEvidence(evidence ? {evidence,...context} : null);};
  useEffect(()=>{const evidenceId=location.state?.evidenceId;if(evidenceId)openEvidence(getEvidence(evidenceId));},[getEvidence,location.state]);
  useEffect(()=>{if(location.state?.focusRiskId)setFocusedRiskId(location.state.focusRiskId);},[location.state]);
  useEffect(()=>{if(!selectedEvidence)return;const handleKey=(event)=>event.key==="Escape"&&setSelectedEvidence(null);window.addEventListener("keydown",handleKey);return()=>window.removeEventListener("keydown",handleKey);},[selectedEvidence]);
  const focusInvestigation=(riskId,node="risk")=>{setFocusedRiskId(riskId);setFocusedNode(node);requestAnimationFrame(()=>document.getElementById("contract-investigation")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"}));};
  const investigateRisk=(riskId)=>{focusInvestigation(riskId);trackEvent("demo_risk_open",{contract_id:contract.id,risk_id:riskId,source:"risk_workspace"});};
  const returnToInvestigation=(node)=>{const riskId=selectedEvidence?.riskId;if(!riskId)return;setSelectedEvidence(null);focusInvestigation(riskId,node);trackEvent("demo_evidence_return",{contract_id:contract.id,risk_id:riskId,destination:node});};
  const content = {overview:<><WorkspaceOverview contract={contract}/><AviationCoverage contract={contract} getEvidence={getEvidence} openEvidence={openEvidence}/></>,clauses:<Clauses contract={contract} getEvidence={getEvidence} openEvidence={openEvidence}/>,obligations:<Obligations contract={contract} getEvidence={getEvidence} openEvidence={openEvidence}/>,deadlines:<Deadlines contract={contract} getEvidence={getEvidence} openEvidence={openEvidence}/>,risks:<Risks contract={contract} getEvidence={getEvidence} openEvidence={openEvidence} investigateRisk={investigateRisk}/>,evidence:<EvidenceExplorer contract={contract} openEvidence={openEvidence}/>,"financial-impact":<DemoFinancialImpact contract={contract} getEvidence={getEvidence} openEvidence={openEvidence}/>,assistant:<AssistantLanding contract={contract}/>}[activeSection];
  return <>
    <PageHeader eyebrow={`Synthetic contracts / ${contract.contractId}`} title={contract.title} description={`${contract.lessor} → ${contract.lessee}`} actions={<><DemoBadge tone="success">{contract.status}</DemoBadge><button className="od-icon-button" aria-label="Favourite contract"><Star size={17}/></button><Link className="od-button od-button-primary" to={`/demo/contracts/${contract.id}/assistant`}><Bot size={16}/>Ask Matt</Link></>}><div className="od-contract-meta">{[["Lessor",contract.lessor],["Lessee",contract.lessee],["Contract ID",contract.contractId],["Effective",contract.effective],["Expiry",contract.expiry]].map(([label,value])=><span key={label}><b>{label}</b>{value}</span>)}</div></PageHeader>
    {missingEvidence && <EmptyState title="Synthetic evidence unavailable" description="No evidence for this contract matches the requested source. No other contract’s evidence is substituted."/>}
    {contract.analysisStatus === "synthetic_template" && <EmptyState title="Synthetic template — contract-type analysis not validated" description="This copied non-lease record is a synthetic navigation template only. Lease clauses, findings and evidence are not attributed to this agreement."/>}
    {location.state?.fromLiveTracking ? <Link className="od-aircraft-link" to="/demo/live-tracking"><Plane size={18}/><span><small>Return to Live Tracking</small><strong>Restore aircraft, weather, filters, and contract context</strong></span><ExternalLink size={15}/></Link> : contract.aircraft && <Link className="od-aircraft-link" to="/demo/live-tracking"><Plane size={18}/><span><small>Associated aircraft / demo relationship</small><strong>{contract.aircraft.registration} · {contract.aircraft.model}</strong></span><ExternalLink size={15}/></Link>}
    <nav className="od-workspace-tabs" aria-label="Contract workspace views">{sections.map(item=><NavLink key={item} to={`/demo/contracts/${contract.id}/${item}`} className={activeSection===item?"is-active":""}>{item}</NavLink>)}</nav>
    <div className="od-workspace-content">{contract.analysisStatus !== "synthetic_template" && <><ContractIntelligenceInvestigation contract={contract} getEvidence={getEvidence} openEvidence={openEvidence} initialRiskId={focusedRiskId} initialNode={focusedNode}/><div className="od-section-title"><span className="od-eyebrow">{activeSection.replaceAll("-"," ")} intelligence</span><h2>{activeSection.split("-").map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(" ")}</h2><DemoBadge>SYNTHETIC DEMO</DemoBadge></div>{content || <EmptyState title="No prepared data" description="This demonstration layer has no fixture records."/>}</>}</div>
    {selectedEvidence && <div className="od-drawer-backdrop" role="presentation" onClick={()=>setSelectedEvidence(null)}><aside className="od-evidence-drawer" role="dialog" aria-modal="true" aria-label="Evidence detail" onClick={event=>event.stopPropagation()}><button className="od-icon-button" onClick={()=>setSelectedEvidence(null)} aria-label="Close evidence">×</button><DemoBadge>DEMO EVIDENCE</DemoBadge><h2>{selectedEvidence.evidence.locator}</h2><span>Source document · {contract.title}</span><span>Page {selectedEvidence.evidence.page}</span><blockquote>“{selectedEvidence.evidence.excerpt}”</blockquote><p>This prepared excerpt demonstrates Operion’s evidence and provenance experience. It is not customer contract data.</p>{selectedEvidence.riskId&&<div className="od-evidence-return"><span className="od-eyebrow">Continue the investigation</span><button type="button" className="od-button od-button-secondary" onClick={()=>returnToInvestigation("risk")}>Return to associated risk</button><button type="button" className="od-button od-button-primary" onClick={()=>returnToInvestigation("action")}>View recommended action</button></div>}</aside></div>}
  </>;
}
