import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { CloudRain, Filter, LocateFixed, Plane, Radio, Route, Search, ShieldAlert, X } from "lucide-react";
import { useOrganization } from "../context/OrganizationContext";
import useAviationTracking from "../hooks/useAviationTracking";
import { getAircraftIntelligence, getAviationWeather } from "../lib/aviationApi";
import { ErrorState, LoadingState } from "../components/ui/States";

const ProductionFlightGlobe = lazy(() => import("../components/aviation/ProductionFlightGlobe"));
const ProductionDependencyGraph = lazy(() => import("../components/aviation/ProductionDependencyGraph"));

const stateCopy = {
  LIVE: ["LIVE", "Aviation provider connected"],
  DATA_DELAYED: ["DATA DELAYED", "The newest provider position is stale"],
  UNAVAILABLE: ["UNAVAILABLE", "Aviation provider not configured"],
  SYNTHETIC: ["SYNTHETIC", "Synthetic aviation data"],
  organization_required: ["UNAVAILABLE", "Select an organization to continue"],
};

export default function ProductionLiveTracking() {
  const { organizationId } = useOrganization();
  const [companyOnly, setCompanyOnly] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [weather, setWeather] = useState({ state: "UNAVAILABLE", updatedAt: null, layers: [] });
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [intelligence, setIntelligence] = useState(null);
  const [dependenciesOpen, setDependenciesOpen] = useState(false);
  const tracking = useAviationTracking(organizationId, companyOnly);
  const visible = useMemo(() => tracking.aircraft.filter((item) => `${item.flightNumber || ""} ${item.callsign || ""} ${item.registration || ""} ${item.origin?.iata || ""} ${item.destination?.iata || ""}`.toLowerCase().includes(query.toLowerCase())), [tracking.aircraft, query]);
  const selected = visible.find((item) => item.id === selectedId) || null;
  const provenance = stateCopy[tracking.state] || [tracking.state, "Aviation connection state"];
  const metrics = {
    flights: tracking.aircraft.filter((item) => item.flightId || item.flightNumber).length,
    aircraft: tracking.aircraft.length,
    routes: tracking.aircraft.filter((item) => item.origin && item.destination).length,
    alerts: tracking.aircraft.filter((item) => ["delayed", "diverted", "grounded", "maintenance"].includes(String(item.status).toLowerCase())).length,
  };

  useEffect(() => {
    if (!organizationId) return;
    getAviationWeather(organizationId).then((response) => setWeather(response.weather)).catch(() => setWeather({ state: "UNAVAILABLE", updatedAt: null, layers: [] }));
  }, [organizationId]);
  useEffect(() => {
    setIntelligence(null);
    if (!selectedId || !organizationId) return;
    getAircraftIntelligence(selectedId, organizationId).then((response) => setIntelligence(response.intelligence)).catch(() => setIntelligence(null));
  }, [selectedId, organizationId]);

  if (tracking.state === "loading") return <LoadingState label="Connecting to aviation services…" />;
  if (tracking.state === "error") return <ErrorState message={tracking.error} />;

  return <div className="op-aviation-page">
    <header className="op-page-heading op-aviation-heading"><div><span className="op-eyebrow">Aviation Intelligence</span><h1>Live Tracking</h1><p>Operational aircraft context connected to contracts, obligations, deadlines, and risks.</p></div><div className={`op-aviation-source is-${tracking.state.toLowerCase()}`}><Radio size={16}/><span><strong>{provenance[0]}</strong><small>{provenance[1]}{tracking.updatedAt ? ` · Updated ${new Date(tracking.updatedAt).toLocaleTimeString()}` : ""}</small></span></div></header>

    <div className="op-metric-grid op-aviation-metrics">{[[Plane,"Flights",metrics.flights],[LocateFixed,"Tracked aircraft",metrics.aircraft],[Route,"Active routes",metrics.routes],[ShieldAlert,"Flight alerts",metrics.alerts]].map(([Icon,label,value])=><article className="op-metric-card" key={label}><span className="op-metric-card-icon"><Icon size={18}/></span><span>{label}</span><strong>{tracking.state === "LIVE" || tracking.state === "DATA_DELAYED" ? value : "—"}</strong><small>{tracking.state === "UNAVAILABLE" || tracking.state === "organization_required" ? "Data unavailable" : "Provider-derived"}</small></article>)}</div>

    <div className="op-aviation-controls"><div className="op-segmented" role="group" aria-label="Aircraft scope"><button className={!companyOnly ? "is-active" : ""} onClick={() => setCompanyOnly(false)}>All Aircraft</button><button className={companyOnly ? "is-active" : ""} onClick={() => setCompanyOnly(true)}>My Company&apos;s Aircraft</button></div><label className="op-aviation-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Flight, callsign, registration or airport"/></label><button className="op-button-secondary" onClick={() => setFiltersOpen(true)}><Filter size={16}/>Filters</button></div>

    <div className={`op-aviation-stage${selected ? " has-selection" : ""}`}>
      <section className="op-globe-stage">
        {visible.length ? <Suspense fallback={<LoadingState label="Loading 3D globe…"/>}><ProductionFlightGlobe aircraft={visible} selectedId={selectedId} onSelect={setSelectedId}/></Suspense> : <div className="op-aviation-unavailable"><Plane size={32}/><span className="op-badge">{provenance[0]}</span><h2>No aviation positions available</h2><p>{tracking.state === "UNAVAILABLE" ? "Configure a server-side aviation provider to display aircraft. No synthetic positions are shown in production." : "No aircraft match the current organization scope and filters."}</p></div>}
        <div className="op-layer-control"><strong>Layers</strong><label><input type="checkbox" checked={visible.length > 0} readOnly/>Aircraft</label><label><input type="checkbox" checked={false} disabled/>Routes</label><label><input type="checkbox" checked={weatherEnabled} disabled={weather.state === "UNAVAILABLE"} onChange={(event) => setWeatherEnabled(event.target.checked)}/>Weather</label><input aria-label="Weather opacity" type="range" min="0" max="100" defaultValue="60" disabled={!weatherEnabled}/><small>{weather.state === "UNAVAILABLE" ? "Weather data temporarily unavailable" : `Updated ${weather.updatedAt ? new Date(weather.updatedAt).toLocaleTimeString() : "time unavailable"}`}</small></div>
      </section>
      {selected && <aside className="op-flight-sheet"><button className="op-sheet-close" onClick={() => setSelectedId(null)} aria-label="Close aircraft details"><X size={18}/></button><span className="op-eyebrow">Selected aircraft</span><h2>{selected.registration || "Registration unavailable"}</h2><p>{selected.manufacturer || "—"} {selected.model || selected.aircraftType || ""}</p><dl><div><dt>Flight</dt><dd>{selected.flightNumber || selected.callsign || "—"}</dd></div><div><dt>Route</dt><dd>{selected.origin?.iata || "—"} → {selected.destination?.iata || "—"}</dd></div><div><dt>Altitude</dt><dd>{selected.position?.altitudeMeters ?? "—"}</dd></div><div><dt>Ground speed</dt><dd>{selected.position?.groundSpeedKph ?? "—"}</dd></div><div><dt>Position time</dt><dd>{selected.position?.timestamp ? new Date(selected.position.timestamp).toLocaleString() : "—"}</dd></div><div><dt>Source</dt><dd>{selected.dataSource || tracking.provider || "—"}</dd></div></dl><section><h3>Contract Intelligence</h3>{intelligence?.contracts?.length ? <><strong>{intelligence.impact.contracts} contracts impacted</strong><p>{intelligence.impact.obligations} obligations · {intelligence.impact.deadlines} deadlines · {intelligence.impact.risks} active risks</p><div>{intelligence.contracts.map((contract)=><a key={contract.contract_id} href={`/app/contracts/${contract.contract_id}`}>{contract.title}</a>)}</div><button className="op-button-primary" onClick={() => setDependenciesOpen(true)}>View Contract Dependency Tree</button></> : <p>Impact analysis unavailable — relationship data has not been configured.</p>}</section></aside>}
    </div>

    {filtersOpen && <div className="op-filter-backdrop" onClick={() => setFiltersOpen(false)}><aside className="op-filter-drawer" role="dialog" aria-modal="true" aria-label="Aviation filters" onClick={(event) => event.stopPropagation()}><button className="op-sheet-close" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={18}/></button><Filter size={22}/><h2>Aircraft filters</h2><p>Status, altitude, speed, airline, region, and aircraft-type filtering become available when the configured provider supplies those fields.</p><button className="op-button-primary" onClick={() => setFiltersOpen(false)}>Done</button></aside></div>}
    <div className="op-aviation-boundary"><CloudRain size={18}/><p><strong>Weather provider unavailable.</strong> No live or synthetic weather is displayed in production.</p></div>
    {dependenciesOpen && selected && intelligence?.contracts?.length > 0 && <Suspense fallback={<LoadingState label="Loading dependency tree…"/>}><ProductionDependencyGraph aircraft={selected} intelligence={intelligence} onClose={() => setDependenciesOpen(false)}/></Suspense>}
  </div>;
}