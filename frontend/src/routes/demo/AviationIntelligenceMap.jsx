import React, {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownToLine,
  CalendarClock,
  CloudRain,
  FileText,
  Filter,
  Gauge,
  GitBranch,
  ListChecks,
  Map,
  Plane,
  Route,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UsersRound,
  Wind,
} from "lucide-react";
import { getAviationProvider } from "../../demo/aviationDataProvider";
import { AVIATION_MAP_STYLES } from "../../demo/aviationMapLayers";
import { useDemoData } from "../../demo/DemoDataProvider";
import {
  Confidence,
  DemoBadge,
  GlassCard,
  PageHeader,
  RiskBadge,
  SkeletonGrid,
} from "../../demo/DemoUI";

const CesiumFlightGlobe = lazy(
  () => import("../../components/demoRedesign/CesiumFlightGlobe"),
);
const ContractDependencyGraph = lazy(
  () => import("../../components/demoRedesign/ContractDependencyGraph"),
);
const ContractPreviewDrawer = lazy(
  () => import("../../components/demoRedesign/ContractPreviewDrawer"),
);
const provider = getAviationProvider();
const statuses = [
  "All",
  "On time",
  "Delayed",
  "Diverted",
  "Weather impact",
  "Maintenance",
  "Alerts",
];
const tabs = ["Flight info", "Aircraft", "Contracts", "Alerts", "History"];
const TRACKING_STATE_KEY = "operion.demo.liveTracking";

function restoreTrackingState() {
  try {
    return JSON.parse(sessionStorage.getItem(TRACKING_STATE_KEY)) || {};
  } catch {
    return {};
  }
}

function openAssistant(
  aircraft,
  relatedContracts,
  relationships,
  selectedContract = null,
  linkedAircraft = [],
) {
  const scopedContracts = selectedContract
    ? [selectedContract]
    : relatedContracts;
  const scopedRelationships = selectedContract
    ? relationships.filter((item) => item.contractId === selectedContract.id)
    : relationships;
  window.dispatchEvent(
    new CustomEvent("operion:assistant", {
      detail: {
        mode: "panel",
        aviation: {
          aircraft,
          relatedContracts: scopedContracts,
          relationships: scopedRelationships,
          selectedContract,
          linkedAircraft,
        },
      },
    }),
  );
}

function SummaryCards({ summary, onAlerts }) {
  const cards = [
    { key: "liveFlights", label: "Live flights", icon: Plane, tone: "green" },
    {
      key: "trackedAircraft",
      label: "Tracked aircraft",
      icon: Gauge,
      tone: "violet",
    },
    { key: "activeRoutes", label: "Active routes", icon: Route, tone: "blue" },
    {
      key: "flightAlerts",
      label: "Flight alerts",
      icon: AlertTriangle,
      tone: "red",
      onClick: onAlerts,
    },
  ];
  return (
    <section
      className="od-flight-summary"
      aria-label="Deterministic demo aviation overview"
    >
      {cards.map(({ key, label, icon: Icon, tone, onClick }) => {
        const delta = summary.deltas?.[key] || 0;
        const Tag = onClick ? "button" : "div";
        return (
          <Tag
            type={onClick ? "button" : undefined}
            onClick={onClick}
            className={`od-flight-stat od-flight-stat-${tone}`}
            key={key}
          >
            <span className="od-flight-stat-icon">
              <Icon size={17} />
            </span>
            <small>{label}</small>
            <strong>{summary[key]?.toLocaleString()}</strong>
            <span className={delta < 0 ? "is-down" : "is-up"}>
              {delta < 0 ? (
                <TrendingDown size={12} />
              ) : (
                <TrendingUp size={12} />
              )}{" "}
              {delta > 0 ? "+" : ""}
              {delta}% vs yesterday
            </span>
            <i aria-hidden="true" />
          </Tag>
        );
      })}
      <DemoBadge>DEMO AGGREGATES</DemoBadge>
    </section>
  );
}

function ContractList({ relationships, related, navigate }) {
  if (!related.length)
    return (
      <div className="od-data-unavailable">
        <AlertTriangle size={17} />
        <div>
          <strong>No contract relationship established</strong>
          <p>No prepared relationship can be attributed to this aircraft.</p>
        </div>
      </div>
    );
  return (
    <div className="od-ecosystem-list">
      {relationships.map((relationship) => {
        const contract = related.find(
          (item) => item.id === relationship.contractId,
        );
        if (!contract) return null;
        return (
          <button
            type="button"
            key={contract.id}
            onClick={() => navigate(`/demo/contracts/${contract.id}/overview`)}
          >
            <span className="od-ecosystem-icon">
              <FileText size={15} />
            </span>
            <div>
              <small>{relationship.category}</small>
              <strong>{contract.title}</strong>
              <p>
                {relationship.supplier} · {contract.status}
              </p>
            </div>
            <RiskBadge severity={contract.risks[0]?.severity || "Low"} />
          </button>
        );
      })}
    </div>
  );
}

function SelectedAircraftPanel({
  aircraft,
  relationships,
  related,
  activeTab,
  setActiveTab,
  navigate,
}) {
  const alerts = aircraft.alerts || [];
  const obligationCount = relationships.reduce(
    (count, item) => count + item.obligationIds.length,
    0,
  );
  return (
    <aside className="od-selected-flight">
      <header>
        <div>
          <DemoBadge
            tone={aircraft.status === "On time" ? "success" : "neutral"}
          >
            {aircraft.status}
          </DemoBadge>
          <small>{aircraft.operator}</small>
        </div>
        <h2>{aircraft.callsign}</h2>
        <div className="od-selected-route">
          <span>
            <strong>{aircraft.origin}</strong>
            <small>{aircraft.departure}</small>
          </span>
          <i>
            <Plane size={15} />
          </i>
          <span>
            <strong>{aircraft.destination}</strong>
            <small>{aircraft.eta}</small>
          </span>
        </div>
        <p>
          {aircraft.type} · {aircraft.registration} · {aircraft.phase}
        </p>
      </header>
      <nav aria-label="Selected aircraft intelligence">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab}
            className={activeTab === tab ? "is-active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>
      <div className="od-selected-flight-content">
        {activeTab === "Flight info" && (
          <>
            <dl className="od-aviation-facts">
              <div>
                <dt>Altitude</dt>
                <dd>{aircraft.altitude.toLocaleString()} m</dd>
              </div>
              <div>
                <dt>Ground speed</dt>
                <dd>{aircraft.speed} km/h</dd>
              </div>
              <div>
                <dt>Heading</dt>
                <dd>{aircraft.heading}°</dd>
              </div>
              <div>
                <dt>Flight phase</dt>
                <dd>{aircraft.phase}</dd>
              </div>
            </dl>
            <section
              className={`od-route-weather od-route-weather-${aircraft.weather.severity}`}
            >
              <CloudRain size={18} />
              <div>
                <small>Route weather</small>
                <strong>{aircraft.weather.condition}</strong>
                <p>
                  {aircraft.weather.routeImpact} route impact · deterministic
                  scenario
                </p>
              </div>
            </section>
          </>
        )}
        {activeTab === "Aircraft" && (
          <dl className="od-aviation-facts">
            <div>
              <dt>Registration</dt>
              <dd>{aircraft.registration}</dd>
            </div>
            <div>
              <dt>Aircraft type</dt>
              <dd>{aircraft.type}</dd>
            </div>
            <div>
              <dt>Manufacturer</dt>
              <dd>{aircraft.manufacturer}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{aircraft.model}</dd>
            </div>
            <div>
              <dt>ICAO24</dt>
              <dd>{aircraft.icao24}</dd>
            </div>
            <div>
              <dt>Operator</dt>
              <dd>{aircraft.operator}</dd>
            </div>
          </dl>
        )}
        {activeTab === "Contracts" && (
          <>
            <div className="od-contract-tree-metrics">
              <div>
                <strong>{related.length ? 1 : 0}</strong>
                <span>Primary contract</span>
              </div>
              <div>
                <strong>{Math.max(related.length - 1, 0)}</strong>
                <span>Related contracts</span>
              </div>
              <div>
                <strong>{relationships.length * 3 + obligationCount}</strong>
                <span>Dependencies</span>
              </div>
            </div>
            <ContractList
              relationships={relationships}
              related={related}
              navigate={navigate}
            />
          </>
        )}
        {activeTab === "Alerts" && (
          <div className="od-alert-list">
            {alerts.length ? (
              alerts.map((alert) => (
                <button type="button" key={alert.id}>
                  <RiskBadge severity={alert.severity} />
                  <span>
                    <strong>{alert.title}</strong>
                    <small>
                      {alert.type} · {aircraft.callsign}
                    </small>
                  </span>
                </button>
              ))
            ) : (
              <div className="od-clear-state">
                <span>Operationally clear</span>
                <p>No prepared alert signal for this flight.</p>
              </div>
            )}
          </div>
        )}
        {activeTab === "History" && (
          <div className="od-timeline">
            <div>
              <i />
              <span>
                <strong>Position scenario updated</strong>
                <small>Scenario T+00:00</small>
              </span>
            </div>
            <div>
              <i />
              <span>
                <strong>Contract relationships resolved</strong>
                <small>{related.length} connected contracts</small>
              </span>
            </div>
            <div>
              <i />
              <span>
                <strong>Route status assessed</strong>
                <small>{aircraft.status}</small>
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function IntelligenceSummary({
  relationships,
  related,
  aircraft,
  aircraftImpacted,
  navigate,
}) {
  const scoped = relationships
    .map((relationship) => ({
      relationship,
      contract: related.find((item) => item.id === relationship.contractId),
    }))
    .filter((item) => item.contract);
  const obligations = scoped.flatMap(({ contract, relationship }) =>
    contract.obligations
      .filter((item) => relationship.obligationIds.includes(item.id))
      .map((item) => ({ ...item, contract })),
  );
  const risks = scoped.flatMap(({ contract, relationship }) =>
    contract.risks
      .filter((item) => relationship.riskIds.includes(item.id))
      .map((item) => ({ ...item, contract })),
  );
  const suppliers = new Set(relationships.map((item) => item.supplier));
  const countries = new Set([aircraft.origin, aircraft.destination]);
  return (
    <section className="od-impact-intelligence">
      <div className="od-section-heading">
        <div>
          <span>Aircraft → contracts → obligations → risks</span>
          <h2>Operational impact intelligence</h2>
          <p>
            Prepared relationships for {aircraft.registration}. No live
            operational claim is made.
          </p>
        </div>
        <DemoBadge>DETERMINISTIC</DemoBadge>
      </div>
      <div className="od-impact-grid">
        <GlassCard
          title="Impact analysis"
          eyebrow="Selected aircraft ecosystem"
        >
          <div className="od-impact-metrics">
            {[
              [FileText, related.length, "Contracts impacted"],
              [Plane, aircraftImpacted, "Aircraft impacted"],
              [ListChecks, obligations.length, "Obligations affected"],
              [UsersRound, suppliers.size, "Suppliers involved"],
              [Map, countries.size, "Countries involved"],
            ].map(([Icon, value, label]) => (
              <div key={label}>
                <Icon size={16} />
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </GlassCard>
        <GlassCard
          title="Risk and recommended action"
          eyebrow="Evidence-linked decision support"
        >
          <div className="od-recommendation">
            <ShieldAlert size={19} />
            <div>
              <strong>
                {risks.length
                  ? `${risks.length} contract risk signal${risks.length > 1 ? "s" : ""}`
                  : "No established contract risk"}
              </strong>
              <p>
                {aircraft.weather.routeImpact === "High"
                  ? "Review weather-driven delay notice and supplier obligations before the next operational checkpoint."
                  : risks.length
                    ? "Review the highest-severity finding and confirm accountable supplier obligations."
                    : "Maintain monitoring; no evidence-backed intervention is established."}
              </p>
            </div>
          </div>
          {risks.slice(0, 3).map((risk) => (
            <button
              className="od-impact-risk"
              type="button"
              key={`${risk.contract.id}-${risk.id}`}
              onClick={() =>
                navigate(`/demo/contracts/${risk.contract.id}/risks`)
              }
            >
              <RiskBadge severity={risk.severity} />
              <span>
                <strong>{risk.title}</strong>
                <small>
                  {risk.contract.title} · <Confidence value={risk.confidence} />
                </small>
              </span>
            </button>
          ))}
        </GlassCard>
      </div>
    </section>
  );
}

export default function AviationIntelligenceMap() {
  const navigate = useNavigate();
  const { contracts } = useDemoData();
  const filterRef = useRef(null);
  const restoredRef = useRef(restoreTrackingState());
  const [aircraft, setAircraft] = useState([]);
  const [summary, setSummary] = useState({ deltas: {} });
  const [weather, setWeather] = useState({ state: "loading", cells: [] });
  const [selectedId, setSelectedId] = useState(
    restoredRef.current.selectedId || "ac-goper",
  );
  const [statusFilter, setStatusFilter] = useState(
    restoredRef.current.statusFilter || "All",
  );
  const [query, setQuery] = useState(restoredRef.current.query || "");
  const [viewMode, setViewMode] = useState(
    restoredRef.current.viewMode || "globe",
  );
  const [mapStyle, setMapStyle] = useState(
    restoredRef.current.mapStyle || "standard",
  );
  const [weatherEnabled, setWeatherEnabled] = useState(
    restoredRef.current.weatherEnabled ?? true,
  );
  const [activeTab, setActiveTab] = useState(
    restoredRef.current.activeTab || "Contracts",
  );
  const [selectedContractId, setSelectedContractId] = useState(
    restoredRef.current.selectedContractId || null,
  );
  const [showSettings, setShowSettings] = useState(false);
  const [graph, setGraph] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let active = true;
    Promise.all([
      provider.getAircraft(),
      provider.getWeather(),
      provider.getSummary(),
    ])
      .then(([items, weatherData, metrics]) => {
        if (active) {
          setAircraft(items);
          setWeather(weatherData);
          setSummary(metrics);
          setState("ready");
        }
      })
      .catch((error) => {
        console.error("Aviation provider failed", error);
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, []);
  const visible = useMemo(
    () =>
      aircraft.filter(
        (item) =>
          (statusFilter === "All" || statusFilter === "Alerts"
            ? statusFilter !== "Alerts" || item.alerts.length
            : item.status === statusFilter) &&
          `${item.registration} ${item.callsign} ${item.flightNumber} ${item.operator} ${item.origin} ${item.destination}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [aircraft, query, statusFilter],
  );
  const selected =
    aircraft.find((item) => item.id === selectedId) || aircraft[0] || null;
  const related = useMemo(
    () =>
      selected
        ? selected.contractIds
            .map((id) => contracts.find((contract) => contract.id === id))
            .filter(Boolean)
        : [],
    [contracts, selected],
  );
  const previewContract =
    contracts.find((contract) => contract.id === selectedContractId) || null;
  const linkedAircraft = useMemo(
    () =>
      previewContract
        ? aircraft.filter((item) =>
            item.contractIds.includes(previewContract.id),
          )
        : [],
    [aircraft, previewContract],
  );
  const aircraftImpacted = previewContract
    ? linkedAircraft.length
    : new Set(
        aircraft
          .filter((item) =>
            item.contractIds.some((id) => selected?.contractIds.includes(id)),
          )
          .map((item) => item.id),
      ).size;

  useEffect(() => {
    if (!selected) return;
    let active = true;
    Promise.all([
      provider.getContractDependencies(selected.id),
      provider.getAircraftRelationships(selected.id),
    ]).then(([nextGraph, nextRelationships]) => {
      if (active) {
        setGraph(nextGraph);
        setRelationships(nextRelationships);
      }
    });
    return () => {
      active = false;
    };
  }, [selected]);
  useEffect(() => {
    if (selected)
      window.dispatchEvent(
        new CustomEvent("operion:aviation-context", {
          detail: {
            aircraft: selected,
            relatedContracts: previewContract ? [previewContract] : related,
            relationships,
            selectedContract: previewContract,
            linkedAircraft,
          },
        }),
      );
  }, [linkedAircraft, previewContract, related, relationships, selected]);
  useEffect(() => {
    sessionStorage.setItem(
      TRACKING_STATE_KEY,
      JSON.stringify({
        selectedId,
        statusFilter,
        query,
        viewMode,
        mapStyle,
        weatherEnabled,
        activeTab,
        selectedContractId,
      }),
    );
  }, [
    activeTab,
    mapStyle,
    query,
    selectedContractId,
    selectedId,
    statusFilter,
    viewMode,
    weatherEnabled,
  ]);

  function openContractWorkspace(section = "overview", evidenceId = null) {
    if (!previewContract) return;
    sessionStorage.setItem(
      TRACKING_STATE_KEY,
      JSON.stringify({
        selectedId,
        statusFilter,
        query,
        viewMode,
        mapStyle,
        weatherEnabled,
        activeTab,
        selectedContractId,
      }),
    );
    navigate(`/demo/contracts/${previewContract.id}/${section}`, {
      state: { fromLiveTracking: true, aircraftId: selectedId, evidenceId },
    });
  }

  function selectLinkedAircraft(aircraftId) {
    setSelectedId(aircraftId);
    setStatusFilter("All");
    setQuery("");
    setActiveTab("Contracts");
  }

  function exportSnapshot() {
    const payload = JSON.stringify(
      {
        source: provider.sourceLabel,
        exportedAt: "Deterministic scenario",
        selectedAircraft: selected,
        relationships,
        weather,
      },
      null,
      2,
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([payload], { type: "application/json" }),
    );
    link.download = `operion-${selected?.registration || "aviation"}-snapshot.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (state === "loading")
    return (
      <>
        <PageHeader
          eyebrow="Aviation intelligence"
          title="Live Tracking"
          description="Preparing the aviation intelligence workspace."
        />
        <SkeletonGrid />
      </>
    );
  if (state === "error")
    return (
      <GlassCard
        title="Aviation demonstration unavailable"
        eyebrow="Loading error"
      >
        <p>The deterministic aviation provider could not be loaded.</p>
      </GlassCard>
    );
  return (
    <div className="od-aviation-map-page">
      <PageHeader
        eyebrow="Aviation intelligence map"
        title="Live Tracking"
        description="Real-time flight operations and contract intelligence"
        actions={
          <div className="od-live-header-actions">
            <span className="od-live-indicator">
              <i />
              Live demo
            </span>
            <button type="button" onClick={() => filterRef.current?.focus()}>
              <Filter size={14} />
              Filters
            </button>
            <button
              type="button"
              aria-expanded={showSettings}
              onClick={() => setShowSettings((value) => !value)}
            >
              <Settings2 size={14} />
              Settings
            </button>
            <button type="button" onClick={exportSnapshot}>
              <ArrowDownToLine size={14} />
              Export
            </button>
            <button
              type="button"
              className="is-primary"
              onClick={() =>
                selected && openAssistant(selected, related, relationships)
              }
            >
              <Sparkles size={14} />
              Ask Operion
            </button>
          </div>
        }
      />
      {showSettings && (
        <div className="od-map-settings">
          <div>
            <strong>Visualization settings</strong>
            <span>Provider: {provider.sourceLabel}</span>
          </div>
          <label>
            <input
              type="checkbox"
              checked={weatherEnabled}
              onChange={(event) => setWeatherEnabled(event.target.checked)}
            />{" "}
            Show scenario weather
          </label>
          <button type="button" onClick={() => setViewMode("globe")}>
            Reset visualization
          </button>
        </div>
      )}
      <SummaryCards
        summary={summary}
        onAlerts={() => setStatusFilter("Alerts")}
      />
      <section className="od-aviation-workspace">
        <div className="od-map-column">
          <div className="od-map-toolbar">
            <label>
              <Search size={15} />
              <input
                ref={filterRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Flight, registration, route..."
                aria-label="Search aircraft"
              />
            </label>
            <div className="od-view-switch" role="group" aria-label="Map view">
              <button
                type="button"
                className={viewMode === "map" ? "is-active" : ""}
                onClick={() => setViewMode("map")}
              >
                <Map size={14} />
                Map
              </button>
              <button
                type="button"
                className={viewMode === "globe" ? "is-active" : ""}
                onClick={() => setViewMode("globe")}
              >
                <Plane size={14} />
                Globe
              </button>
            </div>
            <button
              type="button"
              className={`od-weather-toggle${weatherEnabled ? " is-requested" : ""}`}
              aria-pressed={weatherEnabled}
              onClick={() => setWeatherEnabled((value) => !value)}
            >
              <CloudRain size={15} />
              Weather <span>{weatherEnabled ? "ON" : "OFF"}</span>
            </button>
          </div>
          {viewMode === "map" && (
            <div
              className="od-map-style-selector"
              role="group"
              aria-label="Map style"
            >
              {AVIATION_MAP_STYLES.map((style) => (
                <button
                  type="button"
                  key={style.id}
                  className={mapStyle === style.id ? "is-active" : ""}
                  aria-pressed={mapStyle === style.id}
                  onClick={() => setMapStyle(style.id)}
                >
                  {style.label}
                </button>
              ))}
            </div>
          )}
          <div
            className="od-status-filter"
            role="group"
            aria-label="Flight status filter"
          >
            {statuses.map((status) => (
              <button
                type="button"
                key={status}
                className={
                  statusFilter === status
                    ? `is-active status-${status.toLowerCase().replaceAll(" ", "-")}`
                    : ""
                }
                onClick={() => setStatusFilter(status)}
              >
                <i />
                {status}
              </button>
            ))}
          </div>
          <div className="od-map-stage">
            <Suspense
              fallback={
                <div className="od-globe-loading">
                  <Plane size={32} />
                  <strong>Loading aviation map</strong>
                </div>
              }
            >
              <CesiumFlightGlobe
                aircraft={visible}
                selectedId={selectedId}
                onSelect={setSelectedId}
                viewMode={viewMode}
                mapStyle={mapStyle}
                weather={weather}
                weatherEnabled={weatherEnabled}
              />
            </Suspense>
            <div className="od-aircraft-roster" aria-label="Trackable aircraft">
              <span>{visible.length} aircraft</span>
              {visible.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={item.id === selectedId ? "is-active" : ""}
                  onClick={() => setSelectedId(item.id)}
                >
                  <i
                    className={`status-${item.status.toLowerCase().replaceAll(" ", "-")}`}
                  />
                  <strong>{item.callsign}</strong>
                  <small>
                    {item.origin} → {item.destination}
                  </small>
                </button>
              ))}
            </div>
            {weatherEnabled && (
              <div className="od-weather-legend">
                <header>
                  <Wind size={14} />
                  <strong>Scenario weather</strong>
                  <DemoBadge>NOT LIVE</DemoBadge>
                </header>
                <div>
                  <span>
                    <i className="cloud" />
                    Cloud
                  </span>
                  <span>
                    <i className="rain" />
                    Rain
                  </span>
                  <span>
                    <i className="heavy" />
                    Heavy rain
                  </span>
                  <span>
                    <i className="storm" />
                    Storm
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        {selected && (
          <SelectedAircraftPanel
            aircraft={selected}
            relationships={relationships}
            related={related}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            navigate={navigate}
          />
        )}
      </section>
      {selected && (
        <IntelligenceSummary
          relationships={relationships}
          related={related}
          aircraft={selected}
              aircraftImpacted={aircraftImpacted}
          navigate={navigate}
        />
      )}
      <section className="od-dependency-section">
        <div className="od-section-heading">
          <div>
            <span>Contract dependency / impact intelligence</span>
            <h2>{selected?.registration} relationship map</h2>
            <p>
              Inspect contracts, suppliers, obligations, and prepared
              dependencies.
            </p>
          </div>
          <button
            type="button"
            className="od-button od-button-primary"
            onClick={() =>
              selected && openAssistant(selected, related, relationships)
            }
          >
            <Sparkles size={15} />
            Ask Operion about this aircraft
          </button>
        </div>
        {graph && (
          <Suspense fallback={<SkeletonGrid />}>
            <ContractDependencyGraph
              graph={graph}
                selectedContractId={selectedContractId}
                onSelectContract={setSelectedContractId}
                onSelectAircraft={selectLinkedAircraft}
            />
          </Suspense>
        )}
      </section>
        {previewContract && selected && (
          <Suspense fallback={null}>
            <ContractPreviewDrawer
              contract={previewContract}
              relationship={relationships.find(
                (item) => item.contractId === previewContract.id,
              )}
              linkedAircraft={linkedAircraft}
              currentAircraftId={selected.id}
              onClose={() => setSelectedContractId(null)}
              onOpenContract={() => openContractWorkspace("overview")}
              onOpenEvidence={(evidenceId) =>
                openContractWorkspace("evidence", evidenceId)
              }
              onSelectAircraft={selectLinkedAircraft}
              onAskOperion={() =>
                openAssistant(
                  selected,
                  related,
                  relationships,
                  previewContract,
                  linkedAircraft,
                )
              }
            />
          </Suspense>
        )}
    </div>
  );
}
