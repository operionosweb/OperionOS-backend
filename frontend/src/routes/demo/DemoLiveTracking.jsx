import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, ChevronRight, FileText, Gauge, ListChecks, Plane, Route, ShieldAlert } from "lucide-react";
import { getAviationProvider } from "../../demo/aviationDataProvider";
import { useDemoData } from "../../demo/DemoDataProvider";
import { DemoBadge, GlassCard, MetricCard, PageHeader, SkeletonGrid } from "../../demo/DemoUI";

const CesiumFlightGlobe = lazy(()=>import("../../components/demoRedesign/CesiumFlightGlobe"));
const ContractDependencyGraph = lazy(()=>import("../../components/demoRedesign/ContractDependencyGraph"));
const provider = getAviationProvider();

export default function DemoLiveTracking() {
  const navigate=useNavigate();
  const { contracts }=useDemoData();
  const [aircraft,setAircraft]=useState([]);
  const [graph,setGraph]=useState(null);
  const [selectedId,setSelectedId]=useState("ac-goper");
  const [filter,setFilter]=useState("company");
  const [state,setState]=useState("loading");
  useEffect(()=>{let active=true;Promise.all([provider.getAircraft(),provider.getContractDependencies()]).then(([items,nextGraph])=>{if(active){setAircraft(items);setGraph(nextGraph);setState("ready");}}).catch(()=>active&&setState("error"));return()=>{active=false};},[]);
  const visible=useMemo(()=>aircraft.filter(item=>filter==="all"||filter==="company"&&item.company||filter==="contracts"&&item.contractIds.length||filter==="watch"&&item.status!=="On time"),[aircraft,filter]);
  const selected=aircraft.find(item=>item.id===selectedId)||visible[0];
  const related=selected?.contractIds.map(id=>contracts.find(contract=>contract.id===id)).filter(Boolean)||[];
  if(state==="loading")return <><PageHeader eyebrow="Aviation intelligence" title="Live Tracking" description="Preparing the three-dimensional demonstration environment."/><SkeletonGrid/></>;
  if(state==="error")return <GlassCard title="Aviation demonstration unavailable" eyebrow="Loading error"><p>The synthetic aviation provider could not be loaded. Contract Intelligence remains available.</p></GlassCard>;
  return <>
    <PageHeader eyebrow="Aviation intelligence / spatial demo" title="Live Tracking" description="Connect prepared aircraft movement to synthetic contract relationships." actions={<DemoBadge>DEMO DATA · NOT LIVE</DemoBadge>}/>
    <div className="od-metric-grid od-metric-grid-four"><MetricCard icon={Plane} label="Demo flights" value={aircraft.length} note="Synthetic positions" tone="green"/><MetricCard icon={Gauge} label="Tracked aircraft" value={aircraft.filter(item=>item.company).length} note="Prepared company fleet"/><MetricCard icon={Route} label="Active routes" value={aircraft.length} note="Synthetic route arcs" tone="blue"/><MetricCard icon={ShieldAlert} label="Flight watches" value={aircraft.filter(item=>item.status!=="On time").length} note="Prepared statuses" tone="amber"/></div>
    <div className="od-tracking-toolbar" role="group" aria-label="Aircraft filter">{[["company","My Company Aircraft"],["all","All Aircraft"],["contracts","Flights with Contracts"],["watch","Operational Watch"]].map(([value,label])=><button type="button" className={filter===value?"is-active":""} key={value} onClick={()=>setFilter(value)}>{label}</button>)}</div>
    <div className="od-tracking-layout"><section className="od-globe-panel"><div className="od-globe-label"><DemoBadge>DEMO DATA</DemoBadge><span>Drag to rotate · scroll to zoom · select an aircraft</span></div><Suspense fallback={<div className="od-globe-loading"><Plane size={32}/><strong>Loading 3D globe</strong></div>}><CesiumFlightGlobe aircraft={visible} selectedId={selected?.id} onSelect={setSelectedId}/></Suspense></section>{selected&&<aside className="od-aircraft-panel"><header><div><DemoBadge tone="purple">{selected.callsign}</DemoBadge><DemoBadge tone={selected.status==="On time"?"success":"neutral"}>{selected.status}</DemoBadge></div><Plane size={22}/></header><div className="od-flight-route"><strong>{selected.origin}</strong><span><i/><Plane size={16}/></span><strong>{selected.destination}</strong></div><div className="od-aircraft-title"><span><Plane size={20}/></span><div><strong>{selected.registration}</strong><small>{selected.type} · {selected.icao24}</small></div></div><dl className="od-flight-stats"><div><dt>Altitude</dt><dd>{selected.altitude.toLocaleString()} m</dd></div><div><dt>Speed</dt><dd>{selected.speed} km/h</dd></div><div><dt>ETA</dt><dd>{selected.eta}</dd></div><div><dt>Position</dt><dd>{selected.latitude.toFixed(1)}, {selected.longitude.toFixed(1)}</dd></div></dl><section><h3>Contract intelligence <DemoBadge>DEMO</DemoBadge></h3><div className="od-aircraft-counts"><span><FileText size={15}/><strong>{related.length}</strong>Contracts</span><span><ListChecks size={15}/><strong>{related.reduce((sum,c)=>sum+c.obligations.length,0)}</strong>Obligations</span><span><CalendarClock size={15}/><strong>{related.reduce((sum,c)=>sum+c.deadlines.length,0)}</strong>Deadlines</span><span><ShieldAlert size={15}/><strong>{related.reduce((sum,c)=>sum+c.risks.length,0)}</strong>Risks</span></div><div className="od-related-contracts">{related.map(contract=><button key={contract.id} onClick={()=>navigate(`/demo/contracts/${contract.id}/overview`)}><span><strong>{contract.title}</strong><small>{contract.counterparty}</small></span><ChevronRight size={15}/></button>)}</div></section><a href="#dependency-graph" className="od-button od-button-primary">View Contract Dependency Graph</a></aside>}</div>
    <section id="dependency-graph" className="od-dependency-section"><div className="od-section-heading"><div><span className="od-eyebrow">Aircraft → contracts → suppliers</span><h2>Contract Dependency Graph</h2><p>Prepared relationships for demonstration. No production relationship evidence is claimed.</p></div><DemoBadge>DEMO RELATIONSHIPS</DemoBadge></div>{graph&&<Suspense fallback={<div className="od-skeleton"/>}><ContractDependencyGraph graph={graph} onOpenContract={id=>navigate(`/demo/contracts/${id}/overview`)}/></Suspense>}</section>
  </>;
}
