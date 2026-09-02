import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileText, Search, ShieldAlert, Upload } from "lucide-react";
import { useDemoData } from "../../demo/DemoDataProvider";
import { DemoBadge, MetricCard, PageHeader, RiskBadge } from "../../demo/DemoUI";

export default function DemoContracts() {
  const { contracts } = useDemoData();
  const [query,setQuery] = useState("");
  const [status,setStatus] = useState("All");
  const [risk,setRisk] = useState("All");
  const visible = useMemo(()=>contracts.filter(contract => {
    const matchesQuery = `${contract.title} ${contract.counterparty} ${contract.type} ${contract.aircraft?.registration||""}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (status === "All" || contract.status === status) && (risk === "All" || contract.health === risk);
  }),[contracts,query,status,risk]);
  return <>
    <PageHeader eyebrow="Portfolio / prepared contracts" title="Contracts" description="Explore how Operion connects aviation agreements to clauses, obligations, deadlines, risks, and evidence." actions={<><DemoBadge>DEMO DATA</DemoBadge><Link to="/demo/upload" className="od-button od-button-primary"><Upload size={16}/>Upload contract</Link></>} />
    <div className="od-metric-grid od-metric-grid-four">
      <MetricCard icon={FileText} label="Contracts" value={contracts.length} note="Prepared demo records" />
      <MetricCard icon={FileText} label="Analysed" value={contracts.length} note="Synthetic intelligence" tone="blue" />
      <MetricCard icon={ShieldAlert} label="Needs attention" value={contracts.filter(c=>c.health!=="Low").length} note="Prepared risk status" tone="amber" />
      <MetricCard icon={Upload} label="Recently added" value="2" note="Demonstration timeline" tone="green" />
    </div>
    <section className="od-portfolio">
      <div className="od-filter-bar"><label><Search size={17}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search contracts, counterparties, aircraft..."/></label><select value={status} onChange={event=>setStatus(event.target.value)} aria-label="Filter contract status"><option>All</option><option>Active</option><option>Review</option></select><select value={risk} onChange={event=>setRisk(event.target.value)} aria-label="Filter contract risk"><option>All</option><option>High</option><option>Medium</option><option>Low</option></select></div>
      <div className="od-contract-table-head"><span>Contract</span><span>Counterparty</span><span>Status</span><span>Risk</span><span>Intelligence</span><span/></div>
      <div className="od-contract-rows">{visible.map(contract=><article key={contract.id} className="od-contract-row"><div className="od-contract-name"><span><FileText size={17}/></span><div><strong>{contract.title}</strong><small>{contract.type} · {contract.aircraft ? `${contract.aircraft.registration} / ${contract.aircraft.model}` : "No aircraft linked"}</small></div></div><div className="od-contract-counterparty"><strong>{contract.counterparty}</strong><small>Last analysed {contract.lastAnalysed}</small></div><DemoBadge tone="success">{contract.status}</DemoBadge><RiskBadge severity={contract.health}/><div className="od-contract-counts"><span>{contract.obligations.length} obligations</span><span>{contract.deadlines.length} deadlines</span><span>{contract.risks.length} risks</span></div><Link className="od-row-action" to={`/demo/contracts/${contract.id}/overview`} aria-label={`Open ${contract.title}`}><ArrowRight size={17}/></Link></article>)}</div>
    </section>
  </>;
}
