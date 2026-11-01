export const GLOBE_DEMO_NOTICE = "ILLUSTRATIVE DEMONSTRATION DATA — NOT LIVE FLIGHT OR CONTRACT DATA.";
export const SCENARIO_DATE = "2026-11-01";

export const EUROPEAN_AIRPORTS = Object.freeze({
  BCN: [2.08, 41.30, "Spain", "Southern Europe"], MAD: [-3.56, 40.47, "Spain", "Southern Europe"],
  FRA: [8.57, 50.03, "Germany", "Western Europe"], AMS: [4.77, 52.31, "Netherlands", "Western Europe"],
  CDG: [2.55, 49.01, "France", "Western Europe"], LHR: [-0.45, 51.47, "United Kingdom", "Northern Europe"],
  FCO: [12.24, 41.80, "Italy", "Southern Europe"], LIS: [-9.13, 38.77, "Portugal", "Southern Europe"],
  MUC: [11.79, 48.35, "Germany", "Western Europe"], CPH: [12.65, 55.62, "Denmark", "Northern Europe"],
  MXP: [8.73, 45.63, "Italy", "Southern Europe"], DUB: [-6.27, 53.42, "Ireland", "Northern Europe"],
  BRU: [4.48, 50.90, "Belgium", "Western Europe"],
});

// Fixed scenario clock: never age these fixtures as if they were live observations.
const cases = [
  ["ac-goper", "G-OPER", "BCN", "FRA", "A320neo", "On time", "Routine operation", "No identified exposure", 0, "Resolved"],
  ["ac-gopra", "G-OPRA", "MAD", "AMS", "B737-8", "Delayed", "Departure slot restriction", "Potential contractual exposure", 35, "Action required"],
  ["ac-n712av", "DEMO-003", "CDG", "LHR", "A220-300", "Delayed", "Late inbound aircraft", "Estimated financial exposure", 75, "Awaiting review"],
  ["ac-fhori", "DEMO-004", "AMS", "FCO", "A321neo", "Rerouted", "Airspace restriction", "Unquantified exposure", 45, "Mitigation in progress"],
  ["ac-a6eoa", "DEMO-005", "FRA", "MAD", "E195-E2", "Cancelled", "Technical inspection", "Insufficient evidence", 0, "Under investigation"],
  ["ac-dabqx", "DEMO-006", "LHR", "BCN", "A320neo", "Weather impact", "Illustrative crosswind restriction", "Potential contractual exposure", 50, "Awaiting review"],
  ["ac-vtana", "DEMO-007", "LIS", "CDG", "B737-8", "Maintenance", "Technical inspection delay", "Confirmed contractual obligation", 40, "Action required"],
  ["ac-9vneo", "DEMO-008", "MUC", "CPH", "CRJ900", "Delayed", "Airport movement restriction", "Unquantified exposure", 30, "Under investigation"],
  ["ac-zssxx", "DEMO-009", "MXP", "AMS", "A220-300", "Delayed", "Ground handling disruption", "Estimated financial exposure", 95, "Mitigation in progress"],
  ["ac-vhqas", "DEMO-010", "DUB", "FRA", "E190", "Diverted", "Destination restriction; alternate BRU", "Potential contractual exposure", 60, "Action required"],
];

function time(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")} UTC`;
}

export function createDemonstrationAircraft() {
  return cases.map(([id, registration, origin, destination, type, status, condition, exposureState, delay, actionStatus], index) => {
    const start = EUROPEAN_AIRPORTS[origin], end = EUROPEAN_AIRPORTS[destination];
    const ground = ["Cancelled", "Maintenance"].includes(status) || index === 1 || index === 7;
    const fraction = ground ? 0 : (index === 2 ? 0.86 : 0.45);
    const departure = 14 * 60 + index * 10;
    const duration = [130, 155, 80, 145, 155, 130, 145, 100, 110, 115][index];
    const estimated = exposureState === "Estimated financial exposure";
    const hasClause = exposureState !== "Insufficient evidence";
    const contractId = `illustrative-flight-contract-${index + 1}`;
    const clauseId = `${contractId}-notice`;
    const obligationId = `${contractId}-obligation`;
    const notificationMinutes = index === 6 ? 15 : 30;
    const noticeRemaining = notificationMinutes - (index === 0 ? 0 : index === 6 ? 10 : delay);
    const operator = `Fictional ${["Iberian Horizon", "Northern Connect", "Continental Link"][index % 3]} Demo Air`;
    const contract = {
      id: contractId, title: `Illustrative ${index === 8 ? "ground handling" : "flight services"} agreement ${index + 1}`,
      type: index === 8 ? "Ground Handling" : index === 6 ? "Maintenance / MRO" : "Flight Services",
      status: "Illustrative only", counterparty: `${operator} / fictional service partner`,
      clause: hasClause ? {
        id: clauseId, title: `Scenario clause 4.${index + 1} — notice and service review`,
        text: `In this fictional agreement, notify the service counterparty within ${notificationMinutes} minutes of a material disruption. ${estimated ? "An attributable arrival delay exceeding 60 minutes may qualify for an illustrative EUR 10 per excess minute service credit, capped at EUR 500, after review." : "Any service consequence requires separate review; no monetary penalty is specified here."} Excluded events and reasonable mitigation must be reviewed. Weather is not automatically force majeure.`,
        source: `${contractId}, fictional scenario excerpt 4.${index + 1}`,
      } : null,
      obligation: hasClause ? { id: obligationId, title: "Review disruption and notify the fictional counterparty", status: status === "On time" ? "Not triggered" : noticeRemaining < 0 ? "Potentially overdue — verify" : "At risk — review", noticeMinutes: notificationMinutes, remainingMinutes: noticeRemaining, deadline: status === "On time" ? "No disruption notice triggered" : `${Math.max(0, noticeRemaining)} scenario minutes remaining${noticeRemaining < 0 ? "; illustrative deadline passed" : ""}` } : null,
      provisions: { delay: estimated ? "Conditional service credit; not automatic liability" : "Review notice provision; no specified financial term", cancellation: "No supplied cancellation penalty; review full agreement", rerouting: "No supplied rerouting penalty; verify mitigation obligations", exclusions: "Attribution, exclusions and mitigation must be verified before any breach conclusion" },
    };
    const rate = 10, threshold = 60, cap = 500;
    const amount = estimated ? Math.min(cap, Math.max(0, delay - threshold) * rate) : null;
    const recommendations = status === "On time" ? [] : [
      { id: `${id}-review`, title: hasClause ? "Review the disruption notification deadline" : "Obtain the applicable contract evidence", reason: hasClause ? `${condition}; the fictional clause calls for notice within ${notificationMinutes} minutes. This does not confirm an actual breach.` : "No applicable clause has been supplied, so neither liability nor a notice requirement can be established.", obligationId: hasClause ? obligationId : null },
      { id: `${id}-mitigate`, title: "Review exclusions and mitigation options", reason: `${condition}; verify event attribution, alternative operation and any applicable exclusions before assessing a service consequence.`, obligationId: hasClause ? obligationId : null },
    ];
    const exposure = {
      state: exposureState, amount, currency: estimated ? "EUR" : null,
      confidence: estimated ? "Scenario arithmetic only; liability unverified" : hasClause ? "Illustrative clause supplied; operational attribution unverified" : "Insufficient evidence",
      basis: estimated ? `min(EUR ${cap}, max(0, ${delay} − ${threshold}) minutes × EUR ${rate}/minute) = EUR ${amount}; assumed attributable arrival delay, before exclusions` : "Exposure not yet quantified.",
      assumptions: "Fictional provisions and operational events only. No actual customer liability or confirmed breach.",
    };
    const categories = [
      status === "On time" ? null : ["Operational status", condition],
      hasClause && status !== "On time" ? ["Contractual status", noticeRemaining < 0 ? "Contractual deadline missed — scenario review" : "Notification deadline approaching"] : null,
      status !== "On time" ? ["Financial exposure", estimated ? "Exposure quantified" : "Exposure unquantified"] : null,
      status !== "On time" ? ["Action status", actionStatus] : null,
    ].filter(Boolean);
    return {
      id, registration, callsign: `DEMO${String(index + 1).padStart(3, "0")}`, flightNumber: `DEMO-F${index + 1}`,
      icao24: `synthetic-${index + 1}`, type, manufacturer: type.startsWith("A") ? "Airbus" : type.startsWith("B") ? "Boeing" : type.startsWith("E") ? "Embraer" : "Bombardier", model: type,
      operator, lessor: "Not provided", manufactureYear: null, condition: ground ? "Inspection / ground status — illustrative" : "No verified airframe condition",
      latitude: start[1] + (end[1] - start[1]) * fraction, longitude: start[0] + (end[0] - start[0]) * fraction,
      altitude: ground ? 0 : 10300, speed: ground ? 0 : 780 + index * 8, heading: (Math.atan2(end[0] - start[0], end[1] - start[1]) * 180 / Math.PI + 360) % 360,
      origin, destination, departure: time(departure), eta: status === "Cancelled" ? "Cancelled — no estimate" : time(departure + duration + delay),
      scheduledDeparture: time(departure), estimatedDeparture: status === "Cancelled" ? "Cancelled — no estimate" : time(departure + (ground || index === 6 ? delay : 0)),
      scheduledArrival: time(departure + duration), estimatedArrival: status === "Cancelled" ? "Cancelled — no estimate" : time(departure + duration + delay),
      departureWindow: departure < 15 * 60 ? "14:00–15:00 UTC" : "15:00–16:00 UTC", arrivalWindow: departure + duration + delay < 17 * 60 ? "Before 17:00 UTC" : "17:00 UTC or later",
      delayMinutes: delay, rerouted: ["Rerouted", "Diverted"].includes(status), cancelled: status === "Cancelled",
      rerouting: index === 9 ? "Illustrative alternate BRU; intended destination FRA" : index === 3 ? "Illustrative routing around restricted airspace; destination FCO unchanged" : "None in scenario",
      phase: ground ? "Ground" : index === 2 ? "Descent" : "Cruise", status, company: index < 2, weatherCellId: null,
      contractIds: index === 0 ? ["demo-aircraft-lease", "demo-mro-agreement", "demo-insurance-agreement"] : [index === 8 ? "demo-ground-handling" : [4, 6].includes(index) ? "demo-mro-agreement" : "demo-aircraft-lease"],
      scope: "Europe", countries: [...new Set([start[2], end[2]])], regions: [...new Set([start[3], end[3]])],
      provenance: GLOBE_DEMO_NOTICE, scenarioDate: SCENARIO_DATE,
      intelligence: { event: { title: condition, at: `${SCENARIO_DATE} scenario T+00:00`, source: "Deterministic fictional operation", verified: false }, contract, exposure, recommendations },
      alerts: categories.map(([category, title], alertIndex) => ({ id: `${id}-alert-${alertIndex}`, aircraftId: id, category, type: category, title, severity: estimated || cancelledStatus(status) ? "High" : "Medium", status: actionStatus === "Resolved" ? "Resolved" : "Open", actionStatus, contractId, obligationId: hasClause ? obligationId : "", evidence: hasClause ? contract.clause.source : "No applicable clause supplied; review required", synthetic: true })),
    };
  });
}

function cancelledStatus(status) { return status === "Cancelled"; }
