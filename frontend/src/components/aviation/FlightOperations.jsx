import React, { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CloudRain, Globe2, Layers, Map, Plane, Radio, Search, ShieldAlert, Wind,
} from "lucide-react";
import { DemoBadge, GlassCard } from "../../demo/DemoUI";
import { getAviationProvider } from "../../demo/aviationDataProvider";
import { DEMO_CONTRACTS } from "../../demo/DemoDataProvider";
import { buildSpatialObjects, getFilterOptions, GLOBE_FILTERS, GLOBE_LAYERS, matchesGlobeFilters } from "./globeSchema";
import AircraftInfoPopup from "./AircraftInfoPopup";

const CesiumFlightGlobe = lazy(() => import("../demoRedesign/CesiumFlightGlobe"));
const aviationProvider = getAviationProvider();

export default function FlightOperations({ onAircraftSelect, selectedAircraftId, contractIds }) {
  const headingId = useId();
  const [aircraft, setAircraft] = useState([]);
  const [weather, setWeather] = useState(null);
  const [selectedId, setSelectedId] = useState("ac-goper");
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState("globe");
  const [mapStyle, setMapStyle] = useState("standard");
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [cloudsEnabled, setCloudsEnabled] = useState(true);
  const [windEnabled, setWindEnabled] = useState(false);
  const [routesEnabled, setRoutesEnabled] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [query, setQuery] = useState("");
  const [loadState, setLoadState] = useState("loading");
  const [filters, setFilters] = useState({});
  const [layers, setLayers] = useState(() => GLOBE_LAYERS.filter((layer) => layer.initial).map((layer) => layer.id));
  const [selectedObject, setSelectedObject] = useState(null);
  const [aircraftPopupOpen, setAircraftPopupOpen] = useState(true);
  const workspaceRef = useRef(null);

  function selectAircraft(id) {
    setSelectedObject(null);
    setSelectedId(id);
    setAircraftPopupOpen(true);
  }

  function closeAircraftPopup() {
    setAircraftPopupOpen(false);
    workspaceRef.current?.querySelector(".od-cesium-globe canvas")?.focus({ preventScroll: true });
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      aviationProvider.getAircraft(),
      aviationProvider.getWeather(),
    ]).then(([nextAircraft, nextWeather]) => {
      if (!active) return;
      setAircraft(nextAircraft);
      setWeather(nextWeather);
      setLoadState("ready");
    }).catch((error) => {
      console.error("Synthetic aviation provider failed", error);
      if (active) setLoadState("error");
    });
    return () => { active = false; };
  }, []);

  const visibleAircraft = useMemo(() => aircraft.filter((item) => {
    const matchesFilter = filter === "all" || (filter === "company" ? item.company
      : filter === "watch" ? item.status !== "On time" : item.status.toLowerCase() === filter);
    const needle = query.toLowerCase().replace(/[^a-z0-9]/g, "");
    const matchesSearch = [item.registration, item.callsign, item.flightNumber, item.icao24, item.operator]
      .some((value) => value.toLowerCase().replace(/[^a-z0-9]/g, "").includes(needle));
    return matchesFilter && matchesSearch && matchesGlobeFilters(item, filters, DEMO_CONTRACTS)
      && (!contractIds || item.contractIds.some((id) => contractIds.includes(id)));
  }), [aircraft, filter, query, filters, contractIds]);
  const visibleIds = useMemo(() => visibleAircraft.map((item) => item.id), [visibleAircraft]);
  const selected = visibleAircraft.find((item) => item.id === selectedId) || visibleAircraft[0] || null;
  const objects = useMemo(() => buildSpatialObjects(visibleAircraft, DEMO_CONTRACTS), [visibleAircraft]);
  const selectedContracts = selected ? DEMO_CONTRACTS.filter((item) => selected.contractIds.includes(item.id)) : [];

  useEffect(() => {
    if (selectedAircraftId) setSelectedId(selectedAircraftId);
  }, [selectedAircraftId]);
  useEffect(() => {
    onAircraftSelect?.(selected || null);
  }, [selected, onAircraftSelect]);
  useEffect(() => { setSelectedObject(null); }, [filters, filter, query, contractIds]);

  function resetFilters() {
    setFilter("all");
    setQuery("");
    setFilters({});
  }

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  if (loadState === "loading") {
    return <GlassCard title="Preparing flight operations" eyebrow="Synthetic aviation feed"><p>Loading the demonstration fleet and route data.</p></GlassCard>;
  }
  if (loadState === "error" || !weather) {
    return <GlassCard title="Flight operations unavailable" eyebrow="Aviation feed error"><p>The synthetic aviation provider could not be loaded. Contract intelligence remains available.</p></GlassCard>;
  }

  return <section ref={workspaceRef} className="od-dashboard-aviation od-aviation-workspace" aria-labelledby={headingId}>
    <header className="od-dashboard-aviation-header">
      <div>
        <span className="od-eyebrow">Spatial operations · synthetic positions</span>
        <h2 id={headingId}>Global Fleet Operations</h2>
        <p>Explore prepared aircraft positions and their contract-linked routes.</p>
      </div>
      <div className="od-dashboard-globe-actions">
        <div className="od-globe-toggle-group" role="group" aria-label="Aircraft filter">
          {[["all", "All flights"], ["company", "Company fleet"], ["watch", "Operational watch"], ["delayed", "Delayed"], ["diverted", "Diverted"]].map(([value, label]) =>
            <button type="button" className={filter === value ? "is-active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)} key={value}>{label}</button>
          )}
        </div>
        <Link className="od-button" to="/demo/live-tracking">Open tracking <Globe2 size={15}/></Link>
      </div>
    </header>
    <div className="od-flight-search">
      <label><Search size={17}/><span>Search simulated aircraft</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Registration, callsign, flight number or ICAO"/></label>
      <button type="button" className="od-button" aria-pressed={playing} onClick={() => setPlaying((value) => !value)}>{playing ? "Pause simulation" : "Play simulation"}</button>
    </div>
    <details className="od-spatial-settings">
      <summary>Layers, filters &amp; legend</summary>
      <fieldset><legend>Spatial layers · prepared demonstration data</legend><div className="od-spatial-layer-grid">
        {GLOBE_LAYERS.map((layer) => <label key={layer.id} title={layer.reason}>
          <input type="checkbox" disabled={!layer.available} checked={layer.id === "weather" ? weatherEnabled : layers.includes(layer.id)}
            onChange={(event) => layer.id === "weather" ? setWeatherEnabled(event.target.checked) : setLayers((current) => event.target.checked ? [...current, layer.id] : current.filter((id) => id !== layer.id))}/>
          <span>{layer.label}{!layer.available && <small>Unavailable: {layer.reason}</small>}</span>
        </label>)}
      </div></fieldset>
      <fieldset><legend>Combine filters</legend><div className="od-spatial-filter-grid">
        {GLOBE_FILTERS.map((field) => <label key={field.id}>{field.label}<select aria-label={field.label} disabled={Boolean(field.unavailable)} value={filters[field.id] || ""}
          onChange={(event) => setFilters((current) => ({ ...current, [field.id]: event.target.value }))}>
          <option value="">{field.unavailable || "All"}</option>
          {!field.unavailable && getFilterOptions(field.id, aircraft, DEMO_CONTRACTS).map((value) => <option key={value}>{value}</option>)}
        </select></label>)}
      </div><button type="button" className="od-button" onClick={resetFilters}>Clear globe filters</button></fieldset>
      <p className="od-spatial-legend">Legend: cyan airports · blue contract assets · amber contractual review · violet illustrative exposure. Markers show prepared associations, not observed regional events. Counterparty records without coordinates remain available through contract links.</p>
    </details>
    <div className="od-provider-notice">
      <p><strong>Live flights unavailable.</strong> No licensed live provider is connected. Search above covers the synthetic fleet only.</p>
      <a href="https://www.flightradar24.com/" target="_blank" rel="noopener noreferrer">Search live flights on Flightradar24 (external)</a>
      <p><strong>Turbulence layer unavailable.</strong> No authorized Turbli forecast feed is connected. The scenario controls below are illustrations; the separate Xweather filters require server configuration and are not turbulence forecasts.</p>
      <a href="https://turbli.com/maps/interactive-turbulence-map/" target="_blank" rel="noopener noreferrer">View Turbli turbulence forecasts (external)</a>
    </div>
    <div className="od-dashboard-globe-layout">
      <section className="od-dashboard-globe-panel" aria-label="Interactive flight globe">
        <div className="od-dashboard-globe-toolbar">
          <span className="od-globe-instructions"><i/>Drag to rotate · scroll to zoom · select an aircraft</span>
          <div className="od-globe-layer-controls">
            <button type="button" className={viewMode === "globe" ? "is-active" : ""} aria-pressed={viewMode === "globe"} onClick={() => setViewMode("globe")}><Globe2 size={14}/>Globe</button>
            <button type="button" className={viewMode === "map" ? "is-active" : ""} aria-pressed={viewMode === "map"} onClick={() => setViewMode("map")}><Map size={14}/>Map</button>
            <button type="button" className={weatherEnabled ? "is-active" : ""} aria-pressed={weatherEnabled} onClick={() => setWeatherEnabled((enabled) => !enabled)}><CloudRain size={14}/>Weather</button>
            <button type="button" aria-pressed={cloudsEnabled} onClick={() => setCloudsEnabled((enabled) => !enabled)}><CloudRain size={14}/>Clouds</button>
            <button type="button" aria-pressed={windEnabled} onClick={() => setWindEnabled((enabled) => !enabled)}><Wind size={14}/>Wind</button>
            <button type="button" aria-pressed={routesEnabled} onClick={() => setRoutesEnabled((enabled) => !enabled)}><Layers size={14}/>Routes</button>
            <button type="button" disabled title="An authorized Turbli forecast feed is not connected">Turbulence unavailable</button>
            <button type="button" className={mapStyle === "satellite" ? "is-active" : ""} aria-pressed={mapStyle === "satellite"} onClick={() => setMapStyle((style) => style === "standard" ? "satellite" : "standard")}>{mapStyle === "satellite" ? "Standard" : "Satellite"}</button>
          </div>
        </div>
        {visibleAircraft.length ? <Suspense fallback={<div className="od-globe-loading"><Plane size={28}/><strong>Loading interactive globe</strong></div>}>
          <CesiumFlightGlobe aircraft={aircraft} visibleIds={visibleIds} selectedId={selected?.id} onSelect={selectAircraft} viewMode={viewMode} mapStyle={mapStyle} weather={weather} weatherEnabled={weatherEnabled} cloudsEnabled={cloudsEnabled} windEnabled={windEnabled} routesEnabled={routesEnabled} playing={playing} spatialObjects={objects} visibleLayers={layers} onObjectSelect={(item) => { setAircraftPopupOpen(false); setSelectedObject(item); }}>
            {selected && aircraftPopupOpen && <AircraftInfoPopup aircraft={selected} contracts={selectedContracts} onClose={closeAircraftPopup}/>}
          </CesiumFlightGlobe>
        </Suspense> : <div className="od-globe-empty"><Plane size={24}/><strong>No aircraft match this search and filter</strong><button type="button" onClick={resetFilters}>Show all flights</button></div>}
        <footer className="od-dashboard-globe-footer"><span><i/>Prepared synthetic positions</span><span role="status">{visibleAircraft.length} aircraft shown</span><span>Not a live aviation feed or navigation aid</span></footer>
      </section>
      <details className="od-dashboard-flight-stats-wrap"><summary>Prepared fleet summary · not portfolio intelligence</summary><div className="od-dashboard-flight-stats" aria-label="Synthetic aviation summary">
        {[
          ["Visible aircraft", visibleAircraft.length, Plane],
          ["Contract-linked aircraft", visibleAircraft.filter((item) => item.contractIds.length).length, Radio],
          ["Prepared routes", new Set(visibleAircraft.map((item) => `${item.origin}-${item.destination}`)).size, Globe2],
          ["Aircraft with alerts", visibleAircraft.filter((item) => item.alerts.length).length, ShieldAlert],
        ].map(([label, value, Icon]) =>
          <div className="od-dashboard-flight-stat" key={label}>
            <span><Icon size={16}/></span><small>{label}</small><strong>{value.toLocaleString()}</strong>
          </div>
        )}
      </div></details>
          {selectedObject && <GlassCard title={selectedObject.title} eyebrow="Selected spatial record · illustrative">
            <p>{selectedObject.description}</p>
            <div className="od-flight-contract-links">{selectedObject.contractIds.map((id) => <Link className="od-button" key={id} to={`/demo/contracts/${id}/${selectedObject.layer === "exposure" ? "financial-impact" : selectedObject.layer === "risks" ? "risks" : "overview"}`}>Inspect {DEMO_CONTRACTS.find((item) => item.id === id)?.title}</Link>)}</div>
            <button type="button" className="od-button" onClick={() => setSelectedObject(null)}>Close spatial record</button>
          </GlassCard>}
          <details className="od-spatial-settings"><summary>Browse visible spatial records (keyboard accessible)</summary>
            <div className="od-spatial-object-list">{objects.filter((item) => layers.includes(item.layer)).map((item) => <button type="button" className="od-button" key={item.id} onClick={() => setSelectedObject(item)}>{item.title} · {item.layer}</button>)}</div>
            {!objects.some((item) => layers.includes(item.layer)) && <p>Enable an available spatial layer to browse its records.</p>}
          </details>
      <aside className="od-dashboard-flight-inspector" aria-label="Aircraft fleet selector">
        {selected ? <>
          <div className="od-dashboard-fleet-card">
          <h3>Explore the fleet</h3>
          <p>Select an aircraft to inspect its route and flight details.</p>
          <div className="od-dashboard-aircraft-list" aria-label="Choose an aircraft">
            {visibleAircraft.map((item) =>
              <button type="button" className={item.id === selected.id ? "is-active" : ""} aria-pressed={item.id === selected.id} onClick={() => selectAircraft(item.id)} key={item.id}>
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
