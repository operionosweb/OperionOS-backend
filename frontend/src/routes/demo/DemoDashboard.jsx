import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bot, CalendarClock, CloudRain, FileText, Globe2, ListChecks, Map,
  Plane, Radio, ShieldCheck, ShieldAlert,
} from "lucide-react";
import { useDemoData } from "../../demo/DemoDataProvider";
import { DemoBadge, GlassCard, MetricCard, PageHeader, RiskBadge } from "../../demo/DemoUI";
import { trackEvent } from "../../components/analytics/Analytics";
import { getAviationProvider } from "../../demo/aviationDataProvider";

const CesiumFlightGlobe = lazy(() => import("../../components/demoRedesign/CesiumFlightGlobe"));
const aviationProvider = getAviationProvider();

function DashboardAviation() {
  const [aircraft, setAircraft] = useState([]);
  const [weather, setWeather] = useState(null);
  const [summary, setSummary] = useState(null);
  const [selectedId, setSelectedId] = useState("ac-goper");
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState("globe");
  const [mapStyle, setMapStyle] = useState("standard");
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [loadState, setLoadState] = useState("loading");

  useEffect(() => {
    let active = true;
    Promise.all([
      aviationProvider.getAircraft(),
      aviationProvider.getWeather(),
      aviationProvider.getSummary(),
    ]).then(([nextAircraft, nextWeather, nextSummary]) => {
      if (!active) return;
      setAircraft(nextAircraft);
      setWeather(nextWeather);
      setSummary(nextSummary);
      setLoadState("ready");
    }).catch((error) => {
      console.error("Synthetic aviation provider failed", error);
      if (active) setLoadState("error");
    });
    return () => { active = false; };
  }, []);

  const visibleAircraft = useMemo(() => aircraft.filter((item) => {
    if (filter === "company") return item.company;
    if (filter === "watch") return item.status !== "On time";
    return true;
  }), [aircraft, filter]);
  const selected = visibleAircraft.find((item) => item.id === selectedId) || visibleAircraft[0] || null;

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  if (loadState === "loading") {
    return <GlassCard title="Preparing flight operations" eyebrow="Synthetic aviation feed"><p>Loading the demonstration fleet and route data.</p></GlassCard>;
  }
  if (loadState === "error" || !summary || !weather) {
    return <GlassCard title="Flight operations unavailable" eyebrow="Aviation feed error"><p>The synthetic aviation provider could not be loaded. Contract intelligence remains available.</p></GlassCard>;
  }

  return <section className="od-dashboard-aviation od-aviation-workspace" aria-labelledby="od-dashboard-aviation-title">
    <header className="od-dashboard-aviation-header">
      <div>
        <span className="od-eyebrow">Spatial operations · synthetic positions</span>
        <h2 id="od-dashboard-aviation-title">Global Fleet Operations</h2>
        <p>Explore prepared aircraft positions and their contract-linked routes.</p>
      </div>
      <div className="od-dashboard-globe-actions">
        <div className="od-globe-toggle-group" role="group" aria-label="Aircraft filter">
          {[["all", "All flights"], ["company", "Company fleet"], ["watch", "Operational watch"]].map(([value, label]) =>
            <button type="button" className={filter === value ? "is-active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)} key={value}>{label}</button>
          )}
        </div>
        <Link className="od-button" to="/demo/live-tracking">Open tracking <Globe2 size={15}/></Link>
      </div>
    </header>
    <div className="od-dashboard-globe-layout">
      <section className="od-dashboard-globe-panel" aria-label="Interactive flight globe">
        <div className="od-dashboard-globe-toolbar">
          <span className="od-globe-instructions"><i/>Drag to rotate · scroll to zoom · select an aircraft</span>
          <div className="od-globe-layer-controls">
            <button type="button" className={viewMode === "globe" ? "is-active" : ""} aria-pressed={viewMode === "globe"} onClick={() => setViewMode("globe")}><Globe2 size={14}/>Globe</button>
            <button type="button" className={viewMode === "map" ? "is-active" : ""} aria-pressed={viewMode === "map"} onClick={() => setViewMode("map")}><Map size={14}/>Map</button>
            <button type="button" className={weatherEnabled ? "is-active" : ""} aria-pressed={weatherEnabled} onClick={() => setWeatherEnabled((enabled) => !enabled)}><CloudRain size={14}/>Weather</button>
            <button type="button" className={mapStyle === "satellite" ? "is-active" : ""} aria-pressed={mapStyle === "satellite"} onClick={() => setMapStyle((style) => style === "standard" ? "satellite" : "standard")}>{mapStyle === "satellite" ? "Standard" : "Satellite"}</button>
          </div>
        </div>
        {visibleAircraft.length ? <Suspense fallback={<div className="od-globe-loading"><Plane size={28}/><strong>Loading interactive globe</strong></div>}>
          <CesiumFlightGlobe aircraft={visibleAircraft} selectedId={selected?.id} onSelect={setSelectedId} viewMode={viewMode} mapStyle={mapStyle} weather={weather} weatherEnabled={weatherEnabled}/>
        </Suspense> : <div className="od-globe-empty"><Plane size={24}/><strong>No aircraft match this filter</strong><button type="button" onClick={() => setFilter("all")}>Show all flights</button></div>}
        <footer className="od-dashboard-globe-footer"><span><i/>Prepared synthetic positions</span><span>{visibleAircraft.length} aircraft shown</span><span>Not a live aviation feed</span></footer>
      </section>
      <div className="od-dashboard-flight-stats" aria-label="Synthetic aviation summary">
        {[
          ["Synthetic flights", summary.liveFlights, Plane],
          ["Tracked aircraft", summary.trackedAircraft, Radio],
          ["Active routes", summary.activeRoutes, Globe2],
          ["Flight alerts", summary.flightAlerts, ShieldAlert],
        ].map(([label, value, Icon]) =>
          <div className="od-dashboard-flight-stat" key={label}>
            <span><Icon size={16}/></span><small>{label}</small><strong>{value.toLocaleString()}</strong>
          </div>
        )}
      </div>
      <aside className="od-dashboard-flight-inspector" aria-label="Selected flight details">
        {selected ? <>
          <div className="od-dashboard-flight-details">
          <div className="od-dashboard-selected-heading">
            <span className="od-dashboard-plane-icon"><Plane size={18}/></span>
            <div><small>Selected aircraft</small><h3>{selected.registration}</h3></div>
            <DemoBadge tone={selected.status === "On time" ? "success" : "neutral"}>{selected.status}</DemoBadge>
          </div>
          <p className="od-dashboard-flight-operator">{selected.operator} · {selected.type}</p>
          <div className="od-dashboard-route">
            <span><small>ORIGIN</small><strong>{selected.origin}</strong><em>{selected.departure}</em></span>
            <i aria-hidden="true"/><Plane size={16}/>
            <span><small>DESTINATION</small><strong>{selected.destination}</strong><em>{selected.eta}</em></span>
          </div>
          <dl className="od-dashboard-flight-facts">
            <div><dt>Altitude</dt><dd>{selected.altitude.toLocaleString()} m</dd></div>
            <div><dt>Ground speed</dt><dd>{selected.speed} km/h</dd></div>
            <div><dt>Heading</dt><dd>{selected.heading}°</dd></div>
            <div><dt>Flight phase</dt><dd>{selected.phase}</dd></div>
          </dl>
          </div>
          <div className="od-dashboard-fleet-card">
          <h3>Explore the fleet</h3>
          <p>Select an aircraft to inspect its route and flight details.</p>
          <div className="od-dashboard-aircraft-list" aria-label="Choose an aircraft">
            {visibleAircraft.slice(0, 5).map((item) =>
              <button type="button" className={item.id === selected.id ? "is-active" : ""} aria-pressed={item.id === selected.id} onClick={() => setSelectedId(item.id)} key={item.id}>
                <span className={`od-aircraft-status${item.status === "On time" ? " is-good" : " is-alert"}`}/>
                <span><strong>{item.callsign}</strong><small>{item.origin} → {item.destination}</small></span>
                <span>{item.status}</span>
              </button>
            )}
          </div>
          </div>
        </> : <div className="od-data-unavailable"><Plane size={18}/><strong>No aircraft available in this view.</strong></div>}
      </aside>
    </div>
  </section>;
}

export default function DemoDashboard({ headingLevel }) {
  const { primaryContract: contract } = useDemoData();
  const counts = { obligations: contract.obligations.length, deadlines: contract.deadlines.length, risks: contract.risks.length, documents: 1 };
  const severity = contract.risks.reduce((result, risk) => ({ ...result, [risk.severity]: (result[risk.severity] || 0) + 1 }), {});

  return <div className="od-dashboard-page">
    <PageHeader eyebrow="Executive command / aviation intelligence" title="Executive Cockpit" headingLevel={headingLevel} description="Global asset operations, contract exposure, and evidence-linked intelligence." actions={<><DemoBadge>DEMO DATA</DemoBadge><Link className="od-button od-button-primary" to={`/demo/contracts/${contract.id}/assistant`}><Bot size={16}/>Ask Operion</Link></>} />
    <DashboardAviation/>
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
            <div className="od-risk-bars">{contract.risks.map((risk,index)=><Link to={`/demo/contracts/${contract.id}/risks`} state={{ focusRiskId: risk.id, source: "dashboard" }} onClick={() => trackEvent("demo_risk_open", { contract_id: contract.id, risk_id: risk.id, source: "dashboard" })} key={risk.id}><span>{risk.category}</span><RiskBadge severity={risk.severity}/><i><b style={{width:`${88-index*16}%`}}/></i></Link>)}</div>
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
