import React from "react";
import { Link } from "react-router-dom";
import { BrainCircuit, CalendarClock, FileCheck2, ListChecks, Scale, ShieldAlert } from "lucide-react";
import { useDemoData } from "../../demo/DemoDataProvider";
import { DemoBadge, GlassCard, MetricCard, PageHeader, RiskBadge } from "../../demo/DemoUI";

export default function DemoIntelligence() {
  const { contracts, budget, primaryContract } = useDemoData();
  const totals = contracts.reduce((sum,contract)=>({clauses:sum.clauses+contract.clauses.length,obligations:sum.obligations+contract.obligations.length,deadlines:sum.deadlines+contract.deadlines.length,risks:sum.risks+contract.risks.length,evidence:sum.evidence+contract.evidence.length}),{clauses:0,obligations:0,deadlines:0,risks:0,evidence:0});
  const categories = [
    [Scale,"Clause Intelligence",totals.clauses,"Structure, categories, source text, and confidence","clauses"],
    [ListChecks,"Obligation Intelligence",totals.obligations,"Actors, actions, objects, modality, timing, and conditions","obligations"],
    [CalendarClock,"Deadline Intelligence",totals.deadlines,"Absolute, relative, recurring, event-based, and ambiguous timing","deadlines"],
    [ShieldAlert,"Risk Intelligence",totals.risks,"Evidence-linked contractual risk without predictive claims","risks"],
    [FileCheck2,"Evidence",totals.evidence,"Auditable excerpts, source locators, and document context","evidence"],
  ];
  return <>
    <PageHeader eyebrow="Intelligence / prepared portfolio" title="What Operion understands" description="Aviation Contract Intelligence grounded in clauses, obligations, deadlines, risks, and evidence." actions={<DemoBadge>DEMO DATA</DemoBadge>} />
    <div className="od-metric-grid od-metric-grid-five">{categories.map(([Icon,title,value,,section],index)=><MetricCard key={title} icon={Icon} label={title.replace(" Intelligence","")} value={value} note="Prepared findings" tone={["purple","blue","green","amber","blue"][index]}/>)}</div>
    <div className="od-intelligence-layout"><div className="od-intelligence-categories">{categories.map(([Icon,title,value,copy,section])=><Link key={title} to={`/demo/contracts/${primaryContract.id}/${section}`}><span><Icon size={22}/></span><div><small>Available intelligence</small><h2>{title}</h2><p>{copy}</p></div><strong>{value}</strong></Link>)}</div><aside><GlassCard title="Risk priorities" eyebrow="Prepared contract portfolio"><div className="od-risk-priorities">{primaryContract.risks.map(risk=><Link key={risk.id} to={`/demo/contracts/${primaryContract.id}/risks`}><div><strong>{risk.title}</strong><small>{risk.category}</small></div><RiskBadge severity={risk.severity}/></Link>)}</div></GlassCard><GlassCard title="AI Intelligence Budget" eyebrow="Synthetic demonstration" className="od-intelligence-budget"><BrainCircuit size={25}/><strong>{budget.remaining.toLocaleString()}</strong><span>Prepared units remaining</span><div><i style={{width:`${Math.round(budget.used/budget.allocated*100)}%`}}/></div><p>Production budget enforcement remains server-authoritative. These values demonstrate the interface only.</p></GlassCard></aside></div>
    <div className="od-honesty-note"><strong>No predictive intelligence is shown</strong><p>Fuel, interest-rate, weather, scenario, and digital-twin capabilities are intentionally excluded from this environment.</p></div>
  </>;
}
