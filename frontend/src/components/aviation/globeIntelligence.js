export const FLEET_INTELLIGENCE_FILTERS = [
  ["scope", "Market context"], ["country", "Country"], ["region", "Region"], ["airport", "Airport"], ["route", "Route"],
  ["type", "Aircraft type"], ["model", "Aircraft model"], ["operator", "Operator"], ["registration", "Registration"], ["condition", "Aircraft condition"], ["phase", "Operational status"],
  ["origin", "Origin"], ["destination", "Destination"], ["flightStatus", "Detailed flight status"], ["departureWindow", "Departure window"], ["arrivalWindow", "Arrival window"], ["delay", "Delay duration"],
  ["rerouted", "Rerouted"], ["cancelled", "Cancelled"], ["contract", "Associated contract"], ["contractType", "Linked contract type"],
  ["obligation", "Obligation status"], ["deadline", "Deadline proximity"], ["breach", "Potential breach review"], ["penalty", "Penalty exposure"], ["exposureState", "Exposure assessment"],
  ["unquantified", "Unquantified exposure"], ["highExposure", "High illustrative exposure"], ["recommended", "Recommended action available"],
];
export const ALERT_FILTERS = [
  ["status", "Alert status"], ["category", "Alert category"], ["operational", "Operational category"], ["contractual", "Contractual category"], ["exposure", "Exposure category"],
  ["severity", "Severity"], ["aircraft", "Aircraft"], ["operator", "Operator"], ["country", "Country"], ["route", "Route"],
  ["contract", "Contract"], ["obligation", "Obligation"], ["actionStatus", "Action status"],
];
export const DEFAULT_FLEET_FILTERS = { scope: "Global" };

export function fleetValues(item) {
  const contract = item.intelligence.contract, exposure = item.intelligence.exposure;
  return {
    scope: ["Global", ...item.route.continents], country: item.countries, region: item.regions, airport: [item.origin, item.destination], route: `${item.origin} → ${item.destination}`,
    type: item.type, model: item.model, operator: item.operator, registration: item.registration, condition: item.condition, phase: item.phase,
    origin: item.origin, destination: item.destination, flightStatus: item.status, departureWindow: item.departureWindow, arrivalWindow: item.arrivalWindow,
    delay: item.delayMinutes === 0 ? "No delay" : item.delayMinutes <= 30 ? "1–30 minutes" : item.delayMinutes <= 60 ? "31–60 minutes" : "Over 60 minutes",
    rerouted: item.rerouted ? "Yes" : "No", cancelled: item.cancelled ? "Yes" : "No",
    contract: contract.title, contractType: contract.type, obligation: contract.obligation?.status || "Evidence unavailable",
    deadline: !contract.obligation || item.status === "On time" ? "Not triggered / unavailable" : contract.obligation.remainingMinutes < 0 ? "Passed — review" : contract.obligation.remainingMinutes <= 15 ? "Within 15 minutes" : "Over 15 minutes",
    breach: contract.obligation?.remainingMinutes < 0 ? "Potential — review required" : "Not established",
    penalty: exposure.amount !== null ? "Conditional illustrative service credit" : "No quantified penalty term",
    exposureState: exposure.state, unquantified: exposure.amount === null ? "Yes" : "No",
    highExposure: exposure.amount !== null && exposure.amount >= 300 ? "Yes — scenario ≥ EUR 300" : "No",
    recommended: item.intelligence.recommendations.length ? "Yes" : "No",
  };
}

function includes(value, expected) { return Array.isArray(value) ? value.includes(expected) : value === expected; }
export function matchesFleetIntelligence(item, filters) {
  const values = fleetValues(item);
  return Object.entries(filters).every(([key, value]) => !value || includes(values[key], value));
}
export function filterOptions(records, values, key) {
  return [...new Set(records.flatMap((record) => {
    const value = values(record)[key]; return Array.isArray(value) ? value : [value];
  }).filter(Boolean))].sort();
}
export function activeFilters(filters, defaults = {}) {
  return Object.entries(filters).filter(([key, value]) => value && value !== defaults[key]);
}
export function alertValues({ alert, aircraft }) {
  return {
    status: alert.status, category: alert.category,
    operational: alert.category === "Operational status" ? alert.title : "",
    contractual: alert.category === "Contractual status" ? alert.title : "",
    exposure: alert.category === "Financial exposure" ? alert.title : "",
    severity: alert.severity, aircraft: aircraft.registration, operator: aircraft.operator, country: aircraft.countries,
    route: `${aircraft.origin} → ${aircraft.destination}`, contract: aircraft.intelligence.contract.title,
    obligation: aircraft.intelligence.contract.obligation?.title || "Evidence unavailable", actionStatus: alert.actionStatus,
  };
}
export function matchesAlert(record, filters) {
  const values = alertValues(record);
  return Object.entries(filters).every(([key, value]) => !value || includes(values[key], value));
}
