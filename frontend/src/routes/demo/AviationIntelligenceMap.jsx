import React, {
  lazy,
  Suspense,
  useCallback,
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
  GitBranch,
  ListChecks,
  Map,
  Plane,
  ShieldAlert,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { getAviationProvider } from "../../demo/aviationDataProvider";
import FlightOperations from "../../components/aviation/FlightOperations";
import { useDemoData } from "../../demo/DemoDataProvider";
import {
  Confidence,
  DemoBadge,
  GlassCard,
  PageHeader,
  RiskBadge,
  SkeletonGrid,
} from "../../demo/DemoUI";

const ContractDependencyGraph = lazy(
  () => import("../../components/demoRedesign/ContractDependencyGraph"),
);
const ContractPreviewDrawer = lazy(
  () => import("../../components/demoRedesign/ContractPreviewDrawer"),
);
const provider = getAviationProvider();
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
  const restoredRef = useRef(restoreTrackingState());
  const [aircraft, setAircraft] = useState([]);
  const [weather, setWeather] = useState({ state: "loading", cells: [] });
  const [selectedId, setSelectedId] = useState(
    restoredRef.current.selectedId || "ac-goper",
  );
  const [activeTab, setActiveTab] = useState(
    restoredRef.current.activeTab || "Contracts",
  );
  const [selectedContractId, setSelectedContractId] = useState(
    restoredRef.current.selectedContractId || null,
  );
  const [graph, setGraph] = useState(null);
  const [fleetRequest, setFleetRequest] = useState(0);
  const [relationships, setRelationships] = useState([]);
  const [state, setState] = useState("loading");
  const syncSelectedAircraft = useCallback((item) => { if (item) setSelectedId(item.id); }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      provider.getAircraft(),
      provider.getWeather(),
    ])
      .then(([items, weatherData]) => {
        if (active) {
          setAircraft(items);
          setWeather(weatherData);
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
        activeTab,
        selectedContractId,
      }),
    );
  }, [
    activeTab,
    selectedContractId,
    selectedId,
  ]);

  function openContractWorkspace(section = "overview", evidenceId = null) {
    if (!previewContract) return;
    sessionStorage.setItem(
      TRACKING_STATE_KEY,
      JSON.stringify({
        selectedId,
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
        description="Prepared aircraft relationships and evidence-linked contract intelligence. No live flight feed is connected."
        actions={
          <div className="od-live-header-actions">
            <span className="od-live-indicator">
              <i />
              Synthetic demo
            </span>
            <button type="button" onClick={() => setFleetRequest((request) => request + 1)}>
              <Filter size={14} />
              Filters
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
      <FlightOperations selectedAircraftId={selectedId} onAircraftSelect={syncSelectedAircraft} fleetRequest={fleetRequest}/>
      <details className="od-tracking-contract-context">
        <summary>Additional aircraft contract workspace</summary>
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
      </details>
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
