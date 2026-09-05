import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useParams } from "react-router-dom";
import { Atom, Bot, CalendarClock, ExternalLink, FileText, ListChecks, Plane, ShieldAlert, Sparkles, Star } from "lucide-react";
import { useDemoData } from "../../demo/DemoDataProvider";
import { Confidence, DemoBadge, EmptyState, EvidenceCard, GlassCard, MetricCard, PageHeader, RiskBadge } from "../../demo/DemoUI";
import DemoFinancialImpact from "../../components/demo/DemoFinancialImpact";

const sections = ["overview","clauses","obligations","deadlines","risks","evidence","financial-impact","assistant"];

function WorkspaceOverview({ contract }) {
  const severity = contract.risks.reduce((result,risk)=>({...result,[risk.severity]:(result[risk.severity]||0)+1}),{});
  return <>
    <div className="od-metric-grid od-metric-grid-five"><MetricCard icon={ShieldAlert} label="Contract Health" value={contract.health} note="Prepared risk profile" tone="green"/><MetricCard icon={ListChecks} label="Obligations" value={contract.obligations.length} note="Structured findings"/><MetricCard icon={CalendarClock} label="Deadlines" value={contract.deadlines.length} note="Temporal findings" tone="blue"/><MetricCard icon={ShieldAlert} label="Risks" value={contract.risks.length} note={`${severity.Critical||0} critical`} tone="amber"/><MetricCard icon={FileText} label="Document" value={contract.pages} note="Pages / v1.0" tone="blue"/></div>
    <div className="od-grid-two"><GlassCard title="Top risk areas" eyebrow="Evidence-linked"><div className="od-risk-bars">{contract.risks.map((risk,index)=><Link key={risk.id} to={`../risks`} relative="path"><span>{risk.category}</span><RiskBadge severity={risk.severity}/><i><b style={{width:`${90-index*18}%`}}/></i></Link>)}</div></GlassCard><GlassCard title="Contract identity" eyebrow="Prepared aviation context"><dl className="od-detail-list"><div><dt>Lessor</dt><dd>{contract.lessor}</dd></div><div><dt>Lessee</dt><dd>{contract.lessee}</dd></div><div><dt>Aircraft</dt><dd>{contract.aircraft ? `${contract.aircraft.registration} / ${contract.aircraft.model}` : "Association unavailable"}</dd></div><div><dt>Effective</dt><dd>{contract.effective}</dd></div><div><dt>Expiry</dt><dd>{contract.expiry}</dd></div></dl></GlassCard></div>
    <div className="od-grid-two"><GlassCard title="Recent obligations" eyebrow="Contract intelligence"><div className="od-compact-list">{contract.obligations.map(item=><Link to="../obligations" relative="path" key={item.id}><span className="od-list-icon"><ListChecks size={15}/></span><div><strong>{item.title}</strong><small>{item.actor} · {item.timing}</small></div><DemoBadge tone="neutral">{item.modality}</DemoBadge></Link>)}</div></GlassCard><GlassCard title="Deadline intelligence" eyebrow="No invented dates"><div className="od-compact-list">{contract.deadlines.map(item=><Link to="../deadlines" relative="path" key={item.id}><span className="od-list-icon"><CalendarClock size={15}/></span><div><strong>{item.title}</strong><small>{item.timing}</small></div><DemoBadge tone="neutral">{item.type}</DemoBadge></Link>)}</div></GlassCard></div>
  </>;
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

function Risks({ contract, getEvidence, openEvidence }) {
  return <div className="od-finding-grid">{contract.risks.map(risk=><article className="od-finding-card od-risk-card" key={risk.id}><header><div><span>{risk.category} / {risk.type}</span><h2>{risk.title}</h2></div><RiskBadge severity={risk.severity}/></header><p>{risk.rationale}</p><dl className="od-structured-grid"><div><dt>Consequence</dt><dd>{risk.consequence}</dd></div><div><dt>Financial exposure</dt><dd>{risk.financialExposure}</dd></div></dl><footer><Confidence value={risk.confidence}/><button type="button" onClick={()=>openEvidence(getEvidence(risk.evidenceIds[0]))}>Trace evidence</button></footer></article>)}</div>;
}

function EvidenceExplorer({ contract, openEvidence }) {
  return <div className="od-evidence-explorer">{contract.evidence.map(item=><EvidenceCard key={item.id} evidence={item} onOpen={()=>openEvidence(item)}/>)}</div>;
}

function AssistantLanding({ contract }) {
  const openAssistant=()=>window.dispatchEvent(new CustomEvent("operion:assistant",{detail:{mode:"full"}}));
  return <section className="oa-route-landing"><div className="oa-route-mark"><span><Atom size={31}/></span><i/><i/></div><div><span className="od-eyebrow">Operion AI / contract connected</span><h2>Intelligence Assistant</h2><p>Explore prepared clauses, obligations, deadlines, risks, evidence, and the aircraft relationship for {contract.title}.</p></div><div className="oa-route-signals">{[[ShieldAlert,"Risks",contract.risks.length],[ListChecks,"Obligations",contract.obligations.length],[CalendarClock,"Deadlines",contract.deadlines.length]].map(([Icon,label,value])=><span key={label}><Icon size={16}/><b>{value}</b>{label}</span>)}</div><button type="button" className="od-button od-button-primary" onClick={openAssistant}><Sparkles size={16}/>Open Intelligence Workspace</button><small>Prepared synthetic data / evidence-grounded demo responses</small></section>;
}

export default function DemoWorkspace() {
  const { id, section = "overview" } = useParams();
  const location = useLocation();
  const { getContract, getEvidence } = useDemoData();
  const contract = getContract(id);
  const activeSection = sections.includes(section) ? section : "overview";
  const [selectedEvidence,setSelectedEvidence]=useState(null);
  useEffect(()=>{const evidenceId=location.state?.evidenceId;if(evidenceId)setSelectedEvidence(getEvidence(evidenceId));},[getEvidence,location.state]);
  const content = {overview:<WorkspaceOverview contract={contract}/>,clauses:<Clauses contract={contract} getEvidence={getEvidence} openEvidence={setSelectedEvidence}/>,obligations:<Obligations contract={contract} getEvidence={getEvidence} openEvidence={setSelectedEvidence}/>,deadlines:<Deadlines contract={contract} getEvidence={getEvidence} openEvidence={setSelectedEvidence}/>,risks:<Risks contract={contract} getEvidence={getEvidence} openEvidence={setSelectedEvidence}/>,evidence:<EvidenceExplorer contract={contract} openEvidence={setSelectedEvidence}/>,"financial-impact":<DemoFinancialImpact contract={contract} getEvidence={getEvidence} openEvidence={setSelectedEvidence}/>,assistant:<AssistantLanding contract={contract}/>}[activeSection];
  return <>
    <PageHeader eyebrow={`Contracts / ${contract.contractId}`} title={contract.title} description={`${contract.lessor} → ${contract.lessee}`} actions={<><DemoBadge tone="success">{contract.status}</DemoBadge><button className="od-icon-button" aria-label="Favourite contract"><Star size={17}/></button><Link className="od-button od-button-primary" to={`../assistant`} relative="path"><Bot size={16}/>Ask Operion</Link></>}><div className="od-contract-meta">{[["Lessor",contract.lessor],["Lessee",contract.lessee],["Contract ID",contract.contractId],["Effective",contract.effective],["Expiry",contract.expiry]].map(([label,value])=><span key={label}><b>{label}</b>{value}</span>)}</div></PageHeader>
    {location.state?.fromLiveTracking ? <Link className="od-aircraft-link" to="/demo/live-tracking"><Plane size={18}/><span><small>Return to Live Tracking</small><strong>Restore aircraft, weather, filters, and contract context</strong></span><ExternalLink size={15}/></Link> : contract.aircraft && <Link className="od-aircraft-link" to="/demo/live-tracking"><Plane size={18}/><span><small>Associated aircraft / demo relationship</small><strong>{contract.aircraft.registration} · {contract.aircraft.model}</strong></span><ExternalLink size={15}/></Link>}
    <nav className="od-workspace-tabs" aria-label="Contract workspace views">{sections.map(item=><NavLink key={item} to={`/demo/contracts/${contract.id}/${item}`} className={activeSection===item?"is-active":""}>{item}</NavLink>)}</nav>
    <div className="od-workspace-content"><div className="od-section-title"><span className="od-eyebrow">{activeSection.replaceAll("-"," ")} intelligence</span><h2>{activeSection.split("-").map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(" ")}</h2><DemoBadge>DEMO DATA</DemoBadge></div>{content || <EmptyState title="No prepared data" description="This demonstration layer has no fixture records."/>}</div>
    {selectedEvidence && <div className="od-drawer-backdrop" role="presentation" onClick={()=>setSelectedEvidence(null)}><aside className="od-evidence-drawer" role="dialog" aria-modal="true" aria-label="Evidence detail" onClick={event=>event.stopPropagation()}><button className="od-icon-button" onClick={()=>setSelectedEvidence(null)} aria-label="Close evidence">×</button><DemoBadge>DEMO EVIDENCE</DemoBadge><h2>{selectedEvidence.locator}</h2><span>Source document · {contract.title}</span><span>Page {selectedEvidence.page}</span><blockquote>“{selectedEvidence.excerpt}”</blockquote><p>This prepared excerpt demonstrates Operion’s evidence and provenance experience. It is not customer contract data.</p></aside></div>}
  </>;
}
