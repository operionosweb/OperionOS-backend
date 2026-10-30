import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CloudRain, Globe2, Layers, Plane, Wind } from "lucide-react";
import { SyntheticAviationProvider } from "../../demo/aviationDataProvider";
import { Container } from "../ui/Layout";

const CockpitGlobe = lazy(() => import("./CockpitGlobe"));
const FILTERS = [["all", "All flights"], ["company", "Company fleet"], ["delayed", "Delayed"], ["diverted", "Diverted"]];
const LAYERS = [["clouds", "Clouds", CloudRain], ["weather", "Weather radar", CloudRain], ["wind", "Wind", Wind], ["airspace", "Airspace", Layers]];

export default function ExecutiveCockpit() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("ac-goper");
  const [layers, setLayers] = useState({ clouds: true, weather: false, wind: false, airspace: true });
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    let active = true;
    Promise.all([SyntheticAviationProvider.getAircraft(), SyntheticAviationProvider.getWeather()])
      .then(([aircraft, weather]) => { if (active) setData({ aircraft, weather }); })
      .catch((error) => { console.error("Executive Cockpit synthetic data failed", error); if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  const visible = useMemo(() => (data?.aircraft || []).filter((item) =>
    filter === "all" || (filter === "company" ? item.company : item.status.toLowerCase() === filter),
  ), [data, filter]);
  const visibleIds = useMemo(() => visible.map((item) => item.id), [visible]);
  const selected = visible.find((item) => item.id === selectedId) || visible[0];
  return <section className="oaero-cockpit-section" id="executive-cockpit" aria-labelledby="cockpit-preview-title">
    <Container>
      <div className="oaero-section-heading">
        <span className="oaero-pill">PREPARED DEMONSTRATION INTERFACE</span>
        <h2 id="cockpit-preview-title">A real view of the Operion contract intelligence workspace.</h2>
        <p>Explore the Executive Cockpit below. Aircraft, weather and routes are simulated; no live aviation feed or forecasting service is connected.</p>
        <Link className="op-btn op-btn-secondary" to="/demo/dashboard">Explore the full demo <ArrowRight size={16}/></Link>
      </div>
      <div className="oaero-cockpit" aria-label="Executive Cockpit simulator">
        <header className="oaero-cockpit-header"><div><span className="oaero-pill">SYNTHETIC AVIATION SCENARIO</span><h3>Executive Cockpit</h3><p>Contract context meets global fleet operations.</p></div><span className="oaero-cockpit-badge">SIMULATION / NOT LIVE</span></header>
        {failed ? <p role="alert">The cockpit data could not be loaded. Please reload to try again.</p> : !data ? <p role="status">Preparing the synthetic flight scenario...</p> : <>
          <div className="oaero-cockpit-toolbar">
            <div role="group" aria-label="Cockpit flight filter">{FILTERS.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
            <button type="button" aria-pressed={playing} onClick={() => setPlaying((value) => !value)}>{playing ? "Pause simulation" : "Play simulation"}</button>
          </div>
          <div className="oaero-cockpit-layout">
            <div className="oaero-cockpit-map">
              <div className="oaero-cockpit-layers" role="group" aria-label="Globe layers">{LAYERS.map(([key, label, Icon]) => <button type="button" key={key} aria-pressed={layers[key]} onClick={() => setLayers((value) => ({ ...value, [key]: !value[key] }))}><Icon size={14}/>{label}</button>)}</div>
              <Suspense fallback={<div className="oaero-cockpit-earth" role="status">Preparing the interactive globe...</div>}>
                <CockpitGlobe aircraft={data.aircraft} weather={data.weather} visibleIds={visibleIds} selectedId={selected?.id} layers={layers} playing={playing} onSelect={setSelectedId}/>
              </Suspense>
              <div className="oaero-cockpit-map-status"><span><Globe2 size={13}/> {visible.length} simulated flights shown</span><span>Drag to orbit / use buttons to zoom</span></div>
              {layers.weather && <p className="oaero-cockpit-legend">Simulated precipitation: <span>light</span> / <span>moderate</span> / <span>severe</span></p>}
            </div>
            <aside className="oaero-cockpit-inspector" aria-label="Cockpit flight details">
              {selected ? <><span className="oaero-pill">SELECTED AIRCRAFT</span><h4>{selected.registration}</h4><p>{selected.callsign} / {selected.type}</p><strong className="oaero-cockpit-route">{selected.origin} <Plane size={18}/> {selected.destination}</strong><dl><div><dt>Scenario status</dt><dd>{selected.status}</dd></div><div><dt>Altitude</dt><dd>{selected.altitude.toLocaleString()} m</dd></div><div><dt>Ground speed</dt><dd>{selected.speed} km/h</dd></div><div><dt>Linked contracts</dt><dd>{selected.contractIds.length}</dd></div></dl><Link className="op-btn op-btn-secondary" to={`/demo/contracts/${selected.contractIds[0]}`}>Inspect contract <ArrowRight size={14}/></Link></> : <p>No flights match this filter.</p>}
              <div className="oaero-cockpit-flight-list" role="group" aria-label="Select a simulated flight">{visible.map((item) => <button type="button" key={item.id} aria-pressed={selected?.id === item.id} onClick={() => setSelectedId(item.id)}><span><strong>{item.callsign}</strong><small>{item.origin} - {item.destination}</small></span><span>{item.status}</span></button>)}</div>
            </aside>
          </div>
          <footer className="oaero-cockpit-footer"><span>Evidence-linked review</span><span>Synthetic data only</span><span>Predictive capabilities remain in development</span></footer>
        </>}
      </div>
    </Container>
  </section>;
}
