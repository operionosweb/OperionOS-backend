const airports = {
  AMS: [4.77, 52.31], BOM: [72.87, 19.09], CDG: [2.55, 49.01], CPT: [18.6, -33.97],
  DXB: [55.36, 25.25], FRA: [8.57, 50.03], HKG: [113.91, 22.31], JFK: [-73.78, 40.64],
  JNB: [28.25, -26.14], LHR: [-0.45, 51.47], MAD: [-3.56, 40.47], MAN: [-2.28, 53.35],
  NBO: [36.93, -1.32], SIN: [103.99, 1.36], SYD: [151.18, -33.94],
};

const aircraft = [
  { id: "ac-goper", callsign: "SKY782", flightNumber: "SK782", registration: "G-OPER", type: "B787-9", manufacturer: "Boeing", model: "787-9 Dreamliner", operator: "Skyward Airlines", icao24: "406A3D", latitude: 46.2, longitude: 23.8, altitude: 11200, speed: 876, heading: 112, origin: "LHR", destination: "DXB", departure: "14:35 UTC", eta: "23:00 UTC", phase: "Cruise", status: "On time", company: true, weatherCellId: "wx-balkans", contractIds: ["demo-aircraft-lease", "demo-mro-agreement", "demo-insurance-agreement"] },
  { id: "ac-gopra", callsign: "SKY214", flightNumber: "SK214", registration: "G-OPRA", type: "A320neo", manufacturer: "Airbus", model: "A320-251N", operator: "Skyward Airlines", icao24: "407C12", latitude: 48.8, longitude: 8.4, altitude: 10360, speed: 812, heading: 96, origin: "LHR", destination: "FRA", departure: "16:42 UTC", eta: "18:25 UTC", phase: "Descent", status: "On time", company: true, weatherCellId: null, contractIds: ["demo-ground-handling"] },
  { id: "ac-n712av", callsign: "AVA091", flightNumber: "AV091", registration: "N712AV", type: "B777-300ER", manufacturer: "Boeing", model: "777-300ER", operator: "Atlantic Vista", icao24: "A93F11", latitude: 43.4, longitude: -31.2, altitude: 10970, speed: 902, heading: 78, origin: "JFK", destination: "LHR", departure: "12:05 UTC", eta: "20:40 UTC", phase: "Cruise", status: "Delayed", company: false, weatherCellId: "wx-atlantic", contractIds: ["demo-insurance-agreement"] },
  { id: "ac-fhori", callsign: "AFR662", flightNumber: "AF662", registration: "F-HORI", type: "A350-900", manufacturer: "Airbus", model: "A350-941", operator: "Air France", icao24: "39D4A2", latitude: 43.1, longitude: 12.6, altitude: 9750, speed: 840, heading: 142, origin: "CDG", destination: "DXB", departure: "15:15 UTC", eta: "22:10 UTC", phase: "Climb", status: "Weather impact", company: false, weatherCellId: "wx-balkans", contractIds: ["demo-ground-handling"] },
  { id: "ac-a6eoa", callsign: "UAE018", flightNumber: "EK018", registration: "A6-EOA", type: "A380-800", manufacturer: "Airbus", model: "A380-861", operator: "Emirates", icao24: "8963A1", latitude: 35.8, longitude: 34.1, altitude: 11880, speed: 910, heading: 119, origin: "MAN", destination: "DXB", departure: "13:55 UTC", eta: "22:45 UTC", phase: "Cruise", status: "Maintenance", company: false, weatherCellId: null, contractIds: ["demo-mro-agreement"] },
  { id: "ac-dabqx", callsign: "DLH710", flightNumber: "LH710", registration: "D-ABQX", type: "A350-900", manufacturer: "Airbus", model: "A350-941", operator: "Lufthansa", icao24: "3C4B29", latitude: 41.2, longitude: 61.4, altitude: 11600, speed: 894, heading: 87, origin: "FRA", destination: "HKG", departure: "11:20 UTC", eta: "23:50 UTC", phase: "Cruise", status: "On time", company: false, weatherCellId: null, contractIds: ["demo-mro-agreement"] },
  { id: "ac-vtana", callsign: "AIC131", flightNumber: "AI131", registration: "VT-ANA", type: "B787-8", manufacturer: "Boeing", model: "787-8 Dreamliner", operator: "Air India", icao24: "800B31", latitude: 32.9, longitude: 48.6, altitude: 11300, speed: 866, heading: 302, origin: "BOM", destination: "LHR", departure: "09:45 UTC", eta: "19:05 UTC", phase: "Cruise", status: "Diverted", company: false, weatherCellId: "wx-arabian", contractIds: ["demo-ground-handling"] },
  { id: "ac-9vneo", callsign: "SIA322", flightNumber: "SQ322", registration: "9V-NEO", type: "A350-900", manufacturer: "Airbus", model: "A350-941ULR", operator: "Singapore Airlines", icao24: "76C712", latitude: 24.1, longitude: 78.2, altitude: 12040, speed: 920, heading: 302, origin: "SIN", destination: "LHR", departure: "06:10 UTC", eta: "20:15 UTC", phase: "Cruise", status: "On time", company: false, weatherCellId: "wx-india", contractIds: ["demo-insurance-agreement"] },
  { id: "ac-zssxx", callsign: "SAA204", flightNumber: "SA204", registration: "ZS-SXX", type: "A330-300", manufacturer: "Airbus", model: "A330-343", operator: "South African Airways", icao24: "00B291", latitude: -9.8, longitude: 31.4, altitude: 10700, speed: 835, heading: 350, origin: "JNB", destination: "FRA", departure: "17:30 UTC", eta: "04:55 UTC", phase: "Cruise", status: "Delayed", company: false, weatherCellId: "wx-africa", contractIds: ["demo-ground-handling"] },
  { id: "ac-vhqas", callsign: "QFA001", flightNumber: "QF001", registration: "VH-QAS", type: "B787-9", manufacturer: "Boeing", model: "787-9 Dreamliner", operator: "Qantas", icao24: "7C6B42", latitude: -12.6, longitude: 109.8, altitude: 11580, speed: 907, heading: 304, origin: "SYD", destination: "SIN", departure: "03:20 UTC", eta: "11:40 UTC", phase: "Cruise", status: "Weather impact", company: false, weatherCellId: "wx-indonesia", contractIds: ["demo-insurance-agreement"] },
  { id: "ac-ecmxy", callsign: "IBE640", flightNumber: "IB640", registration: "EC-MXY", type: "A321XLR", manufacturer: "Airbus", model: "A321-253XLR", operator: "Iberia", icao24: "3451D2", latitude: 38.9, longitude: -23.5, altitude: 10820, speed: 821, heading: 66, origin: "JFK", destination: "MAD", departure: "18:10 UTC", eta: "05:55 UTC", phase: "Cruise", status: "On time", company: false, weatherCellId: "wx-atlantic", contractIds: ["demo-aircraft-lease"] },
  { id: "ac-5ykqx", callsign: "KQA112", flightNumber: "KQ112", registration: "5Y-KQX", type: "B737 MAX 8", manufacturer: "Boeing", model: "737-8 MAX", operator: "Kenya Airways", icao24: "04C231", latitude: 8.1, longitude: 34.2, altitude: 10100, speed: 794, heading: 168, origin: "NBO", destination: "CPT", departure: "08:30 UTC", eta: "14:35 UTC", phase: "Cruise", status: "Maintenance", company: false, weatherCellId: "wx-africa", contractIds: ["demo-mro-agreement"] },
];

const weatherCells = [
  { id: "wx-atlantic", type: "rain", label: "Atlantic rain band", latitude: 45, longitude: -27, radius: 900000, severity: "moderate", color: "#36c88a", movement: "ENE 42 km/h" },
  { id: "wx-balkans", type: "storm", label: "Balkan convective system", latitude: 43, longitude: 22, radius: 620000, severity: "severe", color: "#ef5b45", movement: "E 28 km/h" },
  { id: "wx-arabian", type: "cloud", label: "Arabian cloud deck", latitude: 28, longitude: 49, radius: 720000, severity: "light", color: "#b9d5de", movement: "NE 18 km/h" },
  { id: "wx-india", type: "heavy-rain", label: "Central India monsoon cell", latitude: 22, longitude: 78, radius: 780000, severity: "heavy", color: "#f3b43f", movement: "NW 35 km/h" },
  { id: "wx-africa", type: "rain", label: "Central Africa rain band", latitude: -7, longitude: 31, radius: 760000, severity: "moderate", color: "#42bd78", movement: "S 22 km/h" },
  { id: "wx-indonesia", type: "storm", label: "Indian Ocean storm cell", latitude: -10, longitude: 108, radius: 850000, severity: "severe", color: "#e94747", movement: "SE 31 km/h" },
];

const relationshipTemplates = {
  "demo-aircraft-lease": { category: "Aircraft Lease", supplier: "Aviation Partners Ltd.", relationship: "governed by", obligationIds: ["ob-return"], deadlineIds: ["dl-return"], riskIds: ["rk-return"] },
  "demo-mro-agreement": { category: "Maintenance / MRO", supplier: "Rolls-Royce plc", relationship: "maintained under", obligationIds: ["ob-records"], deadlineIds: ["dl-records"], riskIds: ["rk-maint"] },
  "demo-insurance-agreement": { category: "Insurance", supplier: "AIG Aviation", relationship: "insured under", obligationIds: ["ob-ins"], deadlineIds: ["dl-ins"], riskIds: ["rk-ins"] },
  "demo-ground-handling": { category: "Ground Handling", supplier: "Dubai Aviation Services", relationship: "handled under", obligationIds: [], deadlineIds: [], riskIds: [] },
};

const relationships = Object.fromEntries(aircraft.map((item) => [item.id, item.contractIds.map((contractId) => ({ contractId, ...relationshipTemplates[contractId] }))]));

function buildDependencyGraph(id) {
  const selected = aircraft.find((item) => item.id === id);
  const links = relationships[id] || [];
  const nodes = [{ id: "aircraft", type: "aircraft", label: selected?.registration || "Aircraft", subtitle: selected ? `${selected.type} / ${selected.callsign}` : "Data unavailable", status: "Selected asset" }];
  const edges = [];
  links.forEach((link, index) => {
    const contractNode = `contract-${index}`;
    const supplierNode = `supplier-${index}`;
    const dependencyNode = `dependency-${index}`;
    nodes.push({ id: contractNode, type: "contract", contractId: link.contractId, label: link.category, subtitle: link.supplier, status: "Prepared relationship" });
    nodes.push({ id: supplierNode, type: "supplier", label: link.supplier, subtitle: link.category, status: "Counterparty" });
    nodes.push({ id: dependencyNode, type: "dependency", label: `${link.category} continuity`, subtitle: "Operational dependency", status: "Monitored" });
    edges.push({ id: `aircraft-contract-${index}`, source: "aircraft", target: contractNode, relationship: link.relationship });
    edges.push({ id: `contract-supplier-${index}`, source: contractNode, target: supplierNode, relationship: "counterparty" });
    if (link.obligationIds.length) {
      link.obligationIds.forEach((obligationId, obligationIndex) => {
        const obligationNode = `obligation-${index}-${obligationIndex}`;
        const labels = { "ob-return": "Return condition obligation", "ob-records": "Records delivery obligation", "ob-ins": "Coverage obligation" };
        nodes.push({ id: obligationNode, type: "obligation", label: labels[obligationId] || "Contract obligation", subtitle: link.category, status: "Evidence linked" });
        edges.push({ id: `supplier-obligation-${index}-${obligationIndex}`, source: supplierNode, target: obligationNode, relationship: "supports" });
        edges.push({ id: `obligation-dependency-${index}-${obligationIndex}`, source: obligationNode, target: dependencyNode, relationship: "enables" });
      });
    } else {
      edges.push({ id: `supplier-dependency-${index}`, source: supplierNode, target: dependencyNode, relationship: "supports" });
    }
  });
  return { nodes, edges, source: "synthetic", aircraftId: id };
}

function cloneAircraft(item) {
  if (!item) return null;
  const weather = weatherCells.find((cell) => cell.id === item.weatherCellId);
  return {
    ...item,
    contractIds: [...item.contractIds],
    route: { origin: { code: item.origin, longitude: airports[item.origin][0], latitude: airports[item.origin][1] }, destination: { code: item.destination, longitude: airports[item.destination][0], latitude: airports[item.destination][1] } },
    weather: weather ? { cellId: weather.id, condition: weather.label, severity: weather.severity, routeImpact: weather.severity === "severe" ? "High" : weather.severity === "heavy" ? "Medium" : "Low" } : { cellId: null, condition: "No material weather cell", severity: "none", routeImpact: "Low" },
    alerts: [item.status !== "On time" ? { id: `${item.id}-operational`, type: item.status, severity: item.status === "Diverted" || item.status === "Weather impact" ? "High" : "Medium", title: `${item.status} operational signal` } : null, weather && weather.severity !== "light" ? { id: `${item.id}-weather`, type: "Weather", severity: weather.severity === "severe" ? "High" : "Medium", title: weather.label } : null].filter(Boolean),
  };
}

export const SyntheticAviationProvider = {
  mode: "synthetic",
  sourceLabel: "DETERMINISTIC DEMO DATA",
  async getSummary() { return { state: "synthetic", liveFlights: 1245, trackedAircraft: 312, activeRoutes: 428, flightAlerts: 32, deltas: { liveFlights: 8, trackedAircraft: 5, activeRoutes: 12, flightAlerts: -5 } }; },
  async getAircraft() { return aircraft.map(cloneAircraft); },
  async getFlights() { return aircraft.map(cloneAircraft); },
  async getAircraftById(id) { return cloneAircraft(aircraft.find((item) => item.id === id)); },
  async getFlightById(id) { return cloneAircraft(aircraft.find((item) => item.id === id)); },
  async getAircraftContracts(id) { return [...(aircraft.find((item) => item.id === id)?.contractIds || [])]; },
  async getAircraftRelationships(id) { return (relationships[id] || []).map((item) => ({ ...item, obligationIds: [...item.obligationIds], deadlineIds: [...item.deadlineIds], riskIds: [...item.riskIds] })); },
  async getContractDependencies(id = "ac-goper") { return buildDependencyGraph(id); },
  async getWeather() { return { state: "synthetic", source: "Deterministic scenario weather", observedAt: "Scenario T+00:00", cells: weatherCells.map((cell) => ({ ...cell })), legend: ["Cloud", "Light rain", "Moderate rain", "Heavy rain", "Storm"] }; },
};

export const LiveAviationProvider = {
  mode: "unavailable",
  sourceLabel: "LIVE PROVIDER NOT CONFIGURED",
  async getAircraft() { throw new Error("A licensed live aviation provider is not configured."); },
};

export function getAviationProvider() {
  return SyntheticAviationProvider;
}
