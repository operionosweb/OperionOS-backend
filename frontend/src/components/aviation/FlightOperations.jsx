import React, { lazy, startTransition, Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CloudRain, Globe2, Layers, Map, Plane, Radio, Search, ShieldAlert, Wind, X,
} from "lucide-react";
import { DemoBadge, GlassCard } from "../../demo/DemoUI";
import { getAviationProvider } from "../../demo/aviationDataProvider";
import { DEMO_CONTRACTS } from "../../demo/DemoDataProvider";
import { buildSpatialObjects, getFilterOptions, GLOBE_FILTERS, GLOBE_LAYERS, matchesGlobeFilters } from "./globeSchema";
import AircraftInfoPopup from "./AircraftInfoPopup";
import { GLOBE_DEMO_NOTICE } from "../../demo/globeIntelligenceData";
import { activeFilters, DEFAULT_FLEET_FILTERS, matchesAlert, matchesFleetIntelligence } from "./globeIntelligence";
import { ContractIntelligencePanel, FleetIntelligenceFilters, GlobeAlerts } from "./GlobeIntelligencePanels";
import "../../styles/globe-intelligence.css";

const CesiumFlightGlobe = lazy(() => import("../demoRedesign/CesiumFlightGlobe"));
const aviationProvider = getAviationProvider();

export default function FlightOperations({ onAircraftSelect, selectedAircraftId, contractIds, fleetRequest = 0, onAskMatt }) {
  const headingId = useId();
  const [aircraft, setAircraft] = useState([]);
  const [weather, setWeather] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState("globe");
  const [mapStyle, setMapStyle] = useState("standard");
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [cloudsEnabled, setCloudsEnabled] = useState(false);
  const [windEnabled, setWindEnabled] = useState(false);
  const [routesEnabled, setRoutesEnabled] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [query, setQuery] = useState("");
  const [loadState, setLoadState] = useState("loading");
  const [filters, setFilters] = useState({});
  const [layers, setLayers] = useState(() => GLOBE_LAYERS.filter((layer) => layer.initial).map((layer) => layer.id));
  const [selectedObject, setSelectedObject] = useState(null);
  const [aircraftPopupOpen, setAircraftPopupOpen] = useState(false);
  const [intelligenceFilters, setIntelligenceFilters] = useState(DEFAULT_FLEET_FILTERS);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertFilters, setAlertFilters] = useState({});
  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const [contractOpen, setContractOpen] = useState(false);
  const inspectButtonRef = useRef(null);
  const alertsButtonRef = useRef(null);
  const [fleetOpen, setFleetOpen] = useState(false);
  const workspaceRef = useRef(null);
  const fleetButtonRef = useRef(null);
  const fleetSearchRef = useRef(null);
  const fleetId = useId();
  useEffect(() => { if (fleetOpen) fleetSearchRef.current?.focus({ preventScroll: true }); }, [fleetOpen]);
  useEffect(() => {
    if (!fleetRequest || loadState !== "ready") return;
    setFleetOpen(true);
    setAircraftPopupOpen(false);
    workspaceRef.current?.scrollIntoView({ block: "start" });
  }, [fleetRequest, loadState]);

  function selectAircraft(id, alertId = null) {
    startTransition(() => {
      setSelectedObject(null);
      setSelectedId(id);
      setFleetOpen(false);
      setAlertsOpen(false);
      setContractOpen(false);
      setSelectedAlertId(alertId);
      setAircraftPopupOpen(true);
    });
  }

  function closeFleet() {
    setFleetOpen(false);
    fleetButtonRef.current?.focus({ preventScroll: true });
  }

  function closeAircraftPopup() {
    setAircraftPopupOpen(false);
    setContractOpen(false);
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
      && matchesFleetIntelligence(item, intelligenceFilters)
      && (!contractIds || item.contractIds.some((id) => contractIds.includes(id)));
  }), [aircraft, filter, query, filters, contractIds, intelligenceFilters]);
  const visibleIds = useMemo(() => visibleAircraft.map((item) => item.id), [visibleAircraft]);
  const selected = visibleAircraft.find((item) => item.id === selectedId) || null;
  const objects = useMemo(() => buildSpatialObjects(visibleAircraft, DEMO_CONTRACTS), [visibleAircraft]);
  const allAlerts = useMemo(() => aircraft.flatMap((item) => item.alerts.map((alert) => ({ alert, aircraft: item }))), [aircraft]);
  const matchingAlerts = useMemo(() => allAlerts.filter((record) => visibleIds.includes(record.aircraft.id) && matchesAlert(record, alertFilters)), [allAlerts, visibleIds, alertFilters]);
  const filterCount = activeFilters(intelligenceFilters, DEFAULT_FLEET_FILTERS).length + activeFilters(filters).length + (filter !== "all" ? 1 : 0) + (query ? 1 : 0);

  useEffect(() => {
    if (selectedAircraftId) {
      setSelectedId(selectedAircraftId);
      setAircraftPopupOpen(true);
    }
  }, [selectedAircraftId]);
  useEffect(() => {
    onAircraftSelect?.(selected || null);
    window.dispatchEvent(new CustomEvent("operion:aviation-context", { detail: { flight: selected || null } }));
  }, [selected, onAircraftSelect]);
  useEffect(() => { setSelectedObject(null); }, [filters, filter, query, contractIds]);

  function resetFilters() {
    setFilter("all");
    setQuery("");
    setFilters({});
    setIntelligenceFilters(DEFAULT_FLEET_FILTERS);
  }

  useEffect(() => {
    if (selectedId && !selected) {
      setSelectedId(null);
      setAircraftPopupOpen(false);
      setContractOpen(false);
    }
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
        <span className="od-eyebrow">Global · simulated route operations</span>
        <h2 id={headingId}>Global Fleet Operations</h2>
        <p className="od-intelligence-notice">{GLOBE_DEMO_NOTICE}</p>
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
          <span className="od-globe-instructions"><i/>Drag to explore. Pinch or scroll to zoom. Tap an aircraft to select.</span>
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
        <Suspense fallback={<div className="od-globe-loading"><Plane size={28}/><strong>Loading interactive globe</strong></div>}>
          <CesiumFlightGlobe aircraft={aircraft} visibleIds={visibleIds} selectedId={selected?.id} onSelect={selectAircraft} viewMode={viewMode} mapStyle={mapStyle} weather={weather} weatherEnabled={weatherEnabled} cloudsEnabled={cloudsEnabled} windEnabled={windEnabled} routesEnabled={routesEnabled} playing={playing} spatialObjects={objects} visibleLayers={layers} onObjectSelect={(item) => { setAircraftPopupOpen(false); setSelectedObject(item); }}>
            <button ref={fleetButtonRef} type="button" className="od-globe-fleet-toggle" aria-expanded={fleetOpen} aria-controls={fleetId}
              onClick={() => { setFleetOpen((open) => !open); setAircraftPopupOpen(false); setContractOpen(false); setAlertsOpen(false); }}>
              <Plane size={16}/>Explore the fleet <span>{filterCount ? `(${filterCount} filters)` : ""}</span>
            </button>
            <button ref={alertsButtonRef} type="button" className="od-globe-alerts-toggle" aria-expanded={alertsOpen} onClick={() => { setAlertsOpen((open) => !open); setFleetOpen(false); setAircraftPopupOpen(false); setContractOpen(false); }}><ShieldAlert size={16}/>Alerts ({matchingAlerts.length})</button>
            <section id={fleetId} hidden={!fleetOpen} className="od-globe-fleet-popup od-dashboard-fleet-card" role="dialog" aria-modal="false" aria-label="Explore the fleet"
              onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); closeFleet(); } }}
              onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
              <header><h3>Explore the fleet</h3><button type="button" className="od-aircraft-popup-close" onClick={closeFleet} aria-label="Close fleet filters"><X size={18}/></button></header>
              <label className="od-fleet-search">Search fleet<input ref={fleetSearchRef} autoFocus={fleetOpen} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Registration or callsign"/></label>
              <label className="od-fleet-search">Flight status<select aria-label="Flight status" value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="all">All flights</option><option value="company">Company fleet</option><option value="watch">Operational watch</option><option value="delayed">Delayed</option><option value="diverted">Diverted</option>
              </select></label>
              <FleetIntelligenceFilters aircraft={aircraft} filters={intelligenceFilters} onChange={setIntelligenceFilters}/>
              <p role="status">{visibleAircraft.length} aircraft · {filterCount} active filters · {intelligenceFilters.scope || "All markets"}</p>
              <div className="od-dashboard-aircraft-list" aria-label="Choose an aircraft">
                {visibleAircraft.map((item) => <button type="button" className={item.id === selected?.id ? "is-active" : ""} aria-pressed={item.id === selected?.id} onClick={() => selectAircraft(item.id)} key={item.id}>
                  <span className={`od-aircraft-status${item.status === "On time" ? " is-good" : " is-alert"}`}/>
                  <span><strong>{item.registration} · {item.callsign}</strong><small>{item.origin} → {item.destination} · {item.alerts.length} alerts</small></span><span>{item.status}</span>
                </button>)}
              </div>
              {!visibleAircraft.length && <p role="status">No aircraft match these filters.</p>}
              <button type="button" className="od-button" onClick={resetFilters}>Clear fleet filters</button>
            </section>
            {alertsOpen && <GlobeAlerts records={matchingAlerts} allRecords={allAlerts} filters={alertFilters} onChange={setAlertFilters} onSelect={selectAircraft} onClose={() => { setAlertsOpen(false); alertsButtonRef.current?.focus({ preventScroll: true }); }}/>}
            {selected && aircraftPopupOpen && !contractOpen && <div ref={inspectButtonRef}><AircraftInfoPopup key={selected.id} aircraft={selected} onClose={closeAircraftPopup} selectedAlertId={selectedAlertId} onInspectContract={() => setContractOpen(true)} onAskMatt={onAskMatt}/></div>}
            {selected && contractOpen && <ContractIntelligencePanel aircraft={selected} onClose={() => { setContractOpen(false); requestAnimationFrame(() => inspectButtonRef.current?.querySelector(".od-button")?.focus({ preventScroll: true })); }}/>}
          </CesiumFlightGlobe>
        </Suspense>
        <footer className="od-dashboard-globe-footer"><span><i/>{intelligenceFilters.scope || "All markets"} · simulated positions</span><span role="status">{visibleAircraft.length} simulated flights shown</span><span>Not live flight or contract data</span></footer>
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
    </div>
  </section>;
}
