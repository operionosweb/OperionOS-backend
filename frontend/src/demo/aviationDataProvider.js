import { createDemonstrationAircraft, GLOBAL_AIRPORTS, GLOBE_DEMO_NOTICE } from "./globeIntelligenceData.js";

const aircraft = createDemonstrationAircraft();
const weatherCells = [
  { id: "wx-europe", type: "cloud", label: "Illustrative European cloud deck", latitude: 50, longitude: 8, radius: 320000, severity: "light", color: "#b9d5de", movement: "Scenario NE 18 km/h" },
  { id: "wx-iberia", type: "rain", label: "Illustrative Iberian rain", latitude: 41, longitude: -3, radius: 220000, severity: "moderate", color: "#36c88a", movement: "Scenario E 12 km/h" },
  { id: "wx-north", type: "storm", label: "Illustrative northern storm", latitude: 54, longitude: 10, radius: 160000, severity: "severe", color: "#ef5b45", movement: "Scenario NE 15 km/h" },
  { id: "wx-west", type: "heavy-rain", label: "Illustrative western rain", latitude: 49, longitude: 2, radius: 170000, severity: "heavy", color: "#f3b43f", movement: "Scenario E 10 km/h" },
  { id: "wx-south", type: "cloud", label: "Illustrative southern cloud", latitude: 43, longitude: 12, radius: 180000, severity: "light", color: "#b9d5de", movement: "Scenario N 8 km/h" },
];
const relationshipTemplates = {
  "demo-aircraft-lease": { title: "Aircraft Lease Agreement", category: "Aircraft Lease", supplier: "Aviation Partners Ltd.", relationship: "governed by", obligationIds: ["ob-return"], deadlineIds: ["dl-return"], riskIds: ["rk-return"] },
  "demo-mro-agreement": { title: "Engine Maintenance Agreement", category: "Maintenance / MRO", supplier: "Rolls-Royce plc", relationship: "maintained under", obligationIds: ["ob-records"], deadlineIds: ["dl-records"], riskIds: ["rk-maint"] },
  "demo-insurance-agreement": { title: "Aviation Hull Insurance Agreement", category: "Insurance", supplier: "AIG Aviation", relationship: "insured under", obligationIds: ["ob-ins"], deadlineIds: ["dl-ins"], riskIds: ["rk-ins"] },
  "demo-ground-handling": { title: "Ground Handling Services Agreement", category: "Ground Handling", supplier: "Dubai Aviation Services", relationship: "handled under", obligationIds: [], deadlineIds: [], riskIds: [] },
};
const relationships = Object.fromEntries(aircraft.map((item) => [item.id, item.contractIds.map((contractId) => ({ contractId, ...relationshipTemplates[contractId], source: "synthetic" }))]));
const contractAircraft = Object.fromEntries(Object.keys(relationshipTemplates).map((contractId) => [contractId, aircraft.filter((item) => item.contractIds.includes(contractId)).map((item) => item.id)]));

function buildDependencyGraph(id) {
  const selected = aircraft.find((item) => item.id === id);
  const links = relationships[id] || [];
  const nodes = [{ id: "aircraft", type: "aircraft", label: selected?.registration || "Aircraft", subtitle: selected ? `${selected.type} / ${selected.callsign}` : "Data unavailable", status: "Selected asset" }];
  const edges = [];
  links.forEach((link, index) => {
    const contractNode = `contract-${index}`, supplierNode = `supplier-${index}`, dependencyNode = `dependency-${index}`;
    const linkedAircraft = contractAircraft[link.contractId] || [];
    nodes.push({ id: contractNode, type: "contract", contractId: link.contractId, label: link.title, subtitle: link.supplier, status: "Illustrative relationship", linkedAircraftCount: linkedAircraft.length });
    nodes.push({ id: supplierNode, type: "supplier", label: link.supplier, subtitle: link.category, status: "Demonstration counterparty" });
    nodes.push({ id: dependencyNode, type: "dependency", label: `${link.category} continuity`, subtitle: "Operational dependency", status: "Monitored" });
    edges.push({ id: `aircraft-contract-${index}`, source: "aircraft", target: contractNode, relationship: link.relationship });
    edges.push({ id: `contract-supplier-${index}`, source: contractNode, target: supplierNode, relationship: "counterparty" });
    linkedAircraft.filter((aircraftId) => aircraftId !== id).forEach((aircraftId, aircraftIndex) => {
      const linked = aircraft.find((item) => item.id === aircraftId), linkedNode = `linked-aircraft-${index}-${aircraftIndex}`;
      nodes.push({ id: linkedNode, type: "linkedAircraft", aircraftId, label: linked.registration, subtitle: `${linked.type} / ${linked.origin} → ${linked.destination}`, status: linked.status });
      edges.push({ id: `contract-aircraft-${index}-${aircraftIndex}`, source: contractNode, target: linkedNode, relationship: "also affects" });
    });
    link.obligationIds.forEach((obligationId, obligationIndex) => {
      const obligationNode = `obligation-${index}-${obligationIndex}`;
      const labels = { "ob-return": "Return condition obligation", "ob-records": "Records delivery obligation", "ob-ins": "Coverage obligation" };
      nodes.push({ id: obligationNode, type: "obligation", label: labels[obligationId] || "Contract obligation", subtitle: link.category, status: "Sample evidence linked" });
      edges.push({ id: `supplier-obligation-${index}-${obligationIndex}`, source: supplierNode, target: obligationNode, relationship: "supports" });
      edges.push({ id: `obligation-dependency-${index}-${obligationIndex}`, source: obligationNode, target: dependencyNode, relationship: "enables" });
    });
    if (!link.obligationIds.length) edges.push({ id: `supplier-dependency-${index}`, source: supplierNode, target: dependencyNode, relationship: "supports" });
  });
  return { nodes, edges, source: "synthetic", aircraftId: id };
}

function cloneAircraft(item) {
  if (!item) return null;
  const routeAirport = (code) => ({ code, longitude: GLOBAL_AIRPORTS[code][0], latitude: GLOBAL_AIRPORTS[code][1] });
  return {
    ...structuredClone(item),
    route: { ...structuredClone(item.route || {}), origin: routeAirport(item.origin), destination: routeAirport(item.destination) },
    weather: { cellId: null, condition: item.status === "Weather impact" ? item.intelligence.event.title : "No verified weather observations", severity: item.status === "Weather impact" ? "moderate" : "none", routeImpact: item.status === "Weather impact" ? "Illustrative review" : "Unknown" },
  };
}

export const SyntheticAviationProvider = {
  mode: "synthetic", sourceLabel: GLOBE_DEMO_NOTICE,
  async getSummary() { return { state: "synthetic", liveFlights: 0, trackedAircraft: aircraft.length, activeRoutes: aircraft.length, flightAlerts: aircraft.flatMap((item) => item.alerts).length, deltas: { liveFlights: 0, trackedAircraft: 0, activeRoutes: 0, flightAlerts: 0 } }; },
  async getAircraft() { return aircraft.map(cloneAircraft); },
  async getFlights() { return aircraft.map(cloneAircraft); },
  async getAircraftById(id) { return cloneAircraft(aircraft.find((item) => item.id === id)); },
  async getFlightById(id) { return cloneAircraft(aircraft.find((item) => item.id === id)); },
  async getAircraftContracts(id) { return [...(aircraft.find((item) => item.id === id)?.contractIds || [])]; },
  async getAircraftRelationships(id) { return structuredClone(relationships[id] || []); },
  async getContractAircraft(contractId) { return (contractAircraft[contractId] || []).map((id) => cloneAircraft(aircraft.find((item) => item.id === id))); },
  async getContractDependencies(id = "ac-goper") { return buildDependencyGraph(id); },
  async getWeather() { return { state: "synthetic", source: "Deterministic scenario weather, not observed conditions", observedAt: "Scenario T+00:00", cells: structuredClone(weatherCells), legend: ["Illustrative cloud"] }; },
};
export const LiveAviationProvider = {
  mode: "unavailable", sourceLabel: "LIVE PROVIDER NOT CONFIGURED",
  async getAircraft() { throw new Error("A licensed live aviation provider is not configured."); },
};
export function getAviationProvider() { return SyntheticAviationProvider; }
