import React from "react";
import { Link } from "react-router-dom";
import { Bot, CalendarClock, FileText, ListChecks, ShieldCheck, ShieldAlert } from "lucide-react";
import { useDemoData } from "../../demo/DemoDataProvider";
import { DemoBadge, GlassCard, MetricCard, PageHeader, RiskBadge } from "../../demo/DemoUI";

export default function DemoDashboard() {
  const { primaryContract: contract } = useDemoData();
  const counts = { obligations: contract.obligations.length, deadlines: contract.deadlines.length, risks: contract.risks.length, documents: 1 };
  const severity = contract.risks.reduce((result, risk) => ({ ...result, [risk.severity]: (result[risk.severity] || 0) + 1 }), {});

  return <div className="od-dashboard-page">
    <PageHeader eyebrow="Dashboard / contract intelligence" title="Good morning, John" description="Your aviation contract intelligence command centre." actions={<><DemoBadge>DEMO DATA</DemoBadge><Link className="od-button od-button-primary" to={`/demo/contracts/${contract.id}/assistant`}><Bot size={16}/>Ask Operion</Link></>} />
    <div className="od-dashboard-layout od-dashboard-layout-wide">
      <div className="od-dashboard-center">
        <div className="od-metric-grid od-metric-grid-five">
          <MetricCard icon={ShieldCheck} label="Contract Health" value={contract.health} note="Prepared risk profile" tone="green" />
          <MetricCard icon={ListChecks} label="Obligations" value={counts.obligations} note="Structured commitments" />
          <MetricCard icon={CalendarClock} label="Deadlines" value={counts.deadlines} note="Temporal findings" tone="blue" />
          <MetricCard icon={ShieldAlert} label="Risks" value={counts.risks} note={`${severity.Critical || 0} critical`} tone="amber" />
          <MetricCard icon={FileText} label="Document" value={contract.pages} note="Pages / v1.0" tone="blue" />
        </div>
        <div className="od-grid-two od-dashboard-risk-grid">
          <GlassCard title="Risk Exposure" eyebrow="Demonstration distribution" action={<Link to={`/demo/contracts/${contract.id}/risks`}>View risks</Link>}>
            <div className="od-risk-visual"><div className="od-risk-donut"><div><strong>{contract.risks.length}</strong><span>Total risks</span></div></div><ul>{[["Critical",severity.Critical||0],["High",severity.High||0],["Medium",severity.Medium||0],["Low",severity.Low||0]].map(([label,value])=><li key={label}><i className={`is-${label.toLowerCase()}`}/><span>{label}</span><strong>{value}</strong></li>)}</ul></div>
          </GlassCard>
          <GlassCard title="Top Risk Areas" eyebrow="Evidence-linked" action={<Link to={`/demo/contracts/${contract.id}/risks`}>View all</Link>}>
            <div className="od-risk-bars">{contract.risks.map((risk,index)=><Link to={`/demo/contracts/${contract.id}/risks`} key={risk.id}><span>{risk.category}</span><RiskBadge severity={risk.severity}/><i><b style={{width:`${88-index*16}%`}}/></i></Link>)}</div>
          </GlassCard>
        </div>
        <div className="od-grid-two">
          <GlassCard title="Recent Obligations" eyebrow="Structured intelligence" action={<Link to={`/demo/contracts/${contract.id}/obligations`}>View all</Link>}>
            <div className="od-compact-list">{contract.obligations.map((item)=><Link to={`/demo/contracts/${contract.id}/obligations`} key={item.id}><span className="od-list-icon"><ListChecks size={15}/></span><div><strong>{item.title}</strong><small>Clause {contract.clauses.find(c=>c.id===item.clauseId)?.number}</small></div><DemoBadge tone={item.modality === "Mandatory" ? "success" : "neutral"}>{item.modality}</DemoBadge></Link>)}</div>
          </GlassCard>
          <GlassCard title="Upcoming Deadlines" eyebrow="Temporal intelligence" action={<Link to={`/demo/contracts/${contract.id}/deadlines`}>View all</Link>}>
            <div className="od-compact-list">{contract.deadlines.map((item)=><Link to={`/demo/contracts/${contract.id}/deadlines`} key={item.id}><span className="od-list-icon"><CalendarClock size={15}/></span><div><strong>{item.title}</strong><small>{item.timing}</small></div><DemoBadge tone="neutral">{item.type}</DemoBadge></Link>)}</div>
          </GlassCard>
        </div>
      </div>
    </div>
  </div>;
}
