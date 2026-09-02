const aircraft = [
  { id: "ac-goper", callsign: "SKY782", registration: "G-OPER", type: "B787-9", icao24: "406A3D", latitude: 46.2, longitude: 23.8, altitude: 11200, speed: 876, heading: 112, origin: "LHR", destination: "DXB", status: "On time", eta: "23:00 UTC", company: true, contractIds: ["demo-aircraft-lease", "demo-mro-agreement", "demo-insurance-agreement"] },
  { id: "ac-gopra", callsign: "SKY214", registration: "G-OPRA", type: "A320neo", icao24: "407C12", latitude: 48.8, longitude: 8.4, altitude: 10360, speed: 812, heading: 96, origin: "LHR", destination: "FRA", status: "On time", eta: "18:25 UTC", company: true, contractIds: ["demo-ground-handling"] },
  { id: "ac-n712av", callsign: "AVA091", registration: "N712AV", type: "B777-300ER", icao24: "A93F11", latitude: 40.4, longitude: -31.2, altitude: 10970, speed: 902, heading: 78, origin: "JFK", destination: "LHR", status: "Delayed", eta: "20:40 UTC", company: false, contractIds: [] },
  { id: "ac-fhori", callsign: "AFR662", registration: "F-HORI", type: "A350-900", icao24: "39D4A2", latitude: 43.1, longitude: 2.6, altitude: 9750, speed: 840, heading: 142, origin: "CDG", destination: "DXB", status: "On time", eta: "22:10 UTC", company: false, contractIds: [] },
  { id: "ac-a6eoa", callsign: "UAE018", registration: "A6-EOA", type: "A380-800", icao24: "8963A1", latitude: 35.8, longitude: 34.1, altitude: 11880, speed: 910, heading: 119, origin: "MAN", destination: "DXB", status: "Maintenance watch", eta: "22:45 UTC", company: false, contractIds: [] },
];

const nodes = [
  { id: "aircraft", type: "aircraft", label: "G-OPER", subtitle: "B787-9 / SKY782", status: "Tracked aircraft" },
  { id: "lease", type: "contract", contractId: "demo-aircraft-lease", label: "Aircraft Lease Agreement", subtitle: "Aviation Partners Ltd.", status: "Active" },
  { id: "maintenance", type: "contract", contractId: "demo-mro-agreement", label: "Engine Maintenance Agreement", subtitle: "Rolls-Royce plc", status: "Active" },
  { id: "insurance", type: "contract", contractId: "demo-insurance-agreement", label: "Insurance Agreement", subtitle: "AIG Aviation", status: "Active" },
  { id: "hull", type: "contract", label: "Hull Maintenance Agreement", subtitle: "Dubai Aerospace", status: "Active" },
  { id: "engine-supply", type: "supplier", label: "Engine Supply Agreement", subtitle: "Rolls-Royce plc", status: "Active" },
  { id: "shop-visit", type: "supplier", label: "Shop Visit Agreement", subtitle: "Rolls-Royce plc", status: "Active" },
  { id: "reinsurance", type: "contract", label: "Reinsurance Agreement", subtitle: "Munich Re", status: "Active" },
  { id: "broker", type: "supplier", label: "Broker Agreement", subtitle: "Willis Towers Watson", status: "Active" },
  { id: "component", type: "supplier", label: "Component Support Agreement", subtitle: "Dubai Aerospace", status: "Active" },
];

const edges = [
  ["aircraft", "lease", "governed by"], ["lease", "maintenance", "depends on"], ["lease", "insurance", "requires"], ["lease", "hull", "depends on"],
  ["maintenance", "engine-supply", "supports"], ["maintenance", "shop-visit", "includes"], ["insurance", "reinsurance", "insures"], ["insurance", "broker", "supports"], ["hull", "component", "supplies"],
].map(([source, target, relationship], index) => ({ id: `edge-${index}`, source, target, relationship }));

export const SyntheticAviationProvider = {
  mode: "synthetic",
  sourceLabel: "DEMO DATA",
  async getAircraft() { return aircraft; },
  async getFlights() { return aircraft; },
  async getAircraftById(id) { return aircraft.find((item) => item.id === id) || null; },
  async getFlightById(id) { return aircraft.find((item) => item.id === id) || null; },
  async getAircraftContracts(id) { return aircraft.find((item) => item.id === id)?.contractIds || []; },
  async getContractDependencies() { return { nodes, edges, source: "synthetic" }; },
};

export const LiveAviationProvider = {
  mode: "unavailable",
  sourceLabel: "LIVE PROVIDER NOT CONFIGURED",
  async getAircraft() { throw new Error("A licensed live aviation provider is not configured."); },
};

export function getAviationProvider() {
  return SyntheticAviationProvider;
}
