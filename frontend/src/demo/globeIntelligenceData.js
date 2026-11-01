import {
  aircraftRouteDistance,
  aircraftRouteHeading,
  aircraftRoutePosition,
} from "../components/aviation/aircraftPose.js";

export const GLOBE_DEMO_NOTICE = "ILLUSTRATIVE DEMONSTRATION DATA — NOT LIVE FLIGHT OR CONTRACT DATA.";
export const SCENARIO_DATE = "2026-11-01";

export function answerFlightQuestion(question, flight) {
  const intelligence = flight?.intelligence;
  const contract = intelligence?.contract;
  if (!flight || !intelligence || !contract) {
    return {
      established: false,
      answer: "No selected flight evidence is available. Select a Globe flight and verify its source records.",
      findings: [], evidence: [], demonstration: true,
      limitations: ["No flight was supplied; no operational or contractual conclusion can be established."],
      reviewRecommendations: [["Select a flight and provide verified source records", null]],
    };
  }

  const prompt = String(question || "").toLowerCase();
  const findings = [], evidence = [];
  const addEvidence = (id, excerpt, sourceLocator) => {
    if (!excerpt || !sourceLocator || evidence.some((item) => item.id === id)) return;
    evidence.push({ id, excerpt, source_locator: sourceLocator, page_number: null });
  };
  let answer;

  if (/legal|law|regulat|jurisdiction|convention|261/.test(prompt)) {
    const candidates = intelligence.legal?.candidates || [];
    candidates.forEach((candidate) => {
      findings.push({ type: "legal_scope_candidate", id: candidate.id, label: candidate.framework });
      addEvidence(candidate.id, `${candidate.basis} ${candidate.scope} Conditions: ${candidate.conditions}`, candidate.source?.url);
    });
    answer = candidates.length
      ? `For the simulated ${flight.origin}–${flight.destination} route, these are conditional legal-scope candidates only: ${candidates.map((candidate) => candidate.framework).join("; ")}. The route alone does not establish applicability, carrier scope, a passenger entitlement, or governing law.`
      : "No legal-scope candidate is supplied for this simulated flight.";
  } else if (/deadline|notice|obligation|time limit/.test(prompt)) {
    const obligation = contract.obligation;
    if (obligation) {
      findings.push({ type: "obligation", id: obligation.id, label: obligation.title });
      addEvidence(obligation.id, `${obligation.title}. Scenario status: ${obligation.status}. Scenario deadline: ${obligation.deadline}.`, contract.clause?.source);
      answer = `The fictional scenario records “${obligation.title}” with status “${obligation.status}” and deadline “${obligation.deadline}”. This is not an executed-contract deadline or verified breach.`;
    } else {
      answer = "No obligation or deadline is supplied for this flight.";
    }
  } else if (/fuel/.test(prompt)) {
    answer = `Fuel exposure for the simulated ${flight.origin}–${flight.destination} route is not quantified. No verified uplift, burn rate, fuel price, actual track or dispatch calculation is supplied. ${flight.rerouting} A general scenario amount cannot be presented as a fuel cost.`;
    addEvidence(`${flight.id}-fuel`, intelligence.event.title, intelligence.event.source);
  } else if (/delay|rerout|diver|liabil|three.hour|3.hour/.test(prompt)) {
    const hypothetical = /three[ -]?hour|3[ -]?hour|180\s*min/.test(prompt);
    answer = `${flight.flightNumber} has ${flight.delayMinutes} fictional delay minutes recorded, not a verified live delay. ${hypothetical ? "A three-hour delay is your hypothetical, not a change to the selected scenario. " : ""}${flight.rerouting} A delay or route change alone establishes neither a contractual breach nor liability. Review the executed agreement, attribution, mitigation, exclusions and notice terms before assessing consequences. ${intelligence.exposure.basis}`;
    findings.push({ type: "scenario_event", id: flight.id, label: intelligence.event.title });
    addEvidence(`${flight.id}-event`, `${intelligence.event.title}; ${flight.delayMinutes} fictional minutes. ${flight.rerouting}`, intelligence.event.source);
    addEvidence(contract.clause.id, contract.clause.text, contract.clause.source);
  } else if (/exposure|cost|financial|credit|penalt|amount/.test(prompt)) {
    const exposure = intelligence.exposure;
    if (exposure) {
      findings.push({ type: "exposure", id: exposure.id || contract.id, label: exposure.state });
      addEvidence(exposure.id || contract.id, `${exposure.basis} ${exposure.assumptions}`, exposure.source_locator || contract.clause?.source);
      answer = exposure.kind === "hypothetical"
        ? `${exposure.state}: ${exposure.currency} ${exposure.amount.toLocaleString()} is scenario arithmetic from invented inputs, not a confirmed contractual amount, invoice, or liability. ${exposure.basis}`
        : `${exposure.state}: ${exposure.basis} No verified cost inputs or applicable contract term were supplied.`;
    } else {
      answer = "No financial exposure record is available for this flight.";
    }
  } else if (/route|distance|origin|destination|where/.test(prompt)) {
    const source = intelligence.event?.source || GLOBE_DEMO_NOTICE;
    const route = `${flight.origin} (${flight.originCountry || "origin country unverified"}) → ${flight.destination} (${flight.destinationCountry || "destination country unverified"})`;
    findings.push({ type: "simulated_flight", id: flight.id, label: `${flight.flightNumber} · ${route}` });
    addEvidence(flight.id, `${route}; ${flight.routeDistanceKm?.toLocaleString?.() || "unknown"} km scenario distance; source: ${source}; timestamp: ${flight.dataTimestamp || "not supplied"}.`, flight.dataTimestamp || source);
    answer = `${flight.flightNumber} is a simulated ${route} route${Number.isFinite(flight.routeDistanceKm) ? ` of approximately ${flight.routeDistanceKm.toLocaleString()} km` : ""}. It is not a live flight position.`;
  } else {
    if (contract.clause) {
      findings.push({ type: "clause", id: contract.clause.id, label: contract.clause.title });
      addEvidence(contract.clause.id, contract.clause.text, contract.clause.source);
    }
    if (contract.obligation) findings.push({ type: "obligation", id: contract.obligation.id, label: contract.obligation.title });
    if (intelligence.event) {
      findings.push({ type: "scenario_event", id: flight.id, label: intelligence.event.title });
      addEvidence(`${flight.id}-event`, `${intelligence.event.title} · ${intelligence.event.at} · ${intelligence.event.source}`, intelligence.event.source);
    }
    answer = `${contract.title} is a fictional scenario agreement, not a supplied or executed contract. ${contract.clause?.text || "No clause text is supplied."} ${intelligence.event?.title || ""}`;
  }

  return {
    established: false, answer, findings, evidence, demonstration: true,
    limitations: [
      GLOBE_DEMO_NOTICE,
      "All contract clauses, operational events, deadlines and monetary inputs are fictional; no live telemetry, executed agreement or legal conclusion is available.",
      "Legal framework entries are conditional research leads only; verify current law, carrier, itinerary, event facts and contract evidence with qualified counsel.",
    ],
    reviewRecommendations: [
      ["Verify the event, timestamp and operational source records", null],
      ["Obtain the executed contract and confirm applicable clauses, notice terms and governing law", null],
    ],
  };
}

const airportRecords = {
  LHR: [-0.4543, 51.47, "United Kingdom", "Northern Europe", "Europe"],
  SFO: [-122.379, 37.621, "United States", "North America", "North America"],
  BER: [13.503, 52.366, "Germany", "Western Europe", "Europe"],
  PEK: [116.408, 40.08, "China", "East Asia", "Asia"],
  DXB: [55.364, 25.253, "United Arab Emirates", "Western Asia", "Asia"],
  SYD: [151.177, -33.946, "Australia", "Oceania", "Oceania"],
  HND: [139.779, 35.55, "Japan", "East Asia", "Asia"],
  SIN: [103.99, 1.36, "Singapore", "Southeast Asia", "Asia"],
  CDG: [2.55, 49.01, "France", "Western Europe", "Europe"],
  JFK: [-73.778, 40.641, "United States", "North America", "North America"],
  MAD: [-3.567, 40.472, "Spain", "Southern Europe", "Europe"],
  GRU: [-46.473, -23.435, "Brazil", "South America", "South America"],
  LIS: [-9.13, 38.77, "Portugal", "Southern Europe", "Europe"],
  JNB: [28.246, -26.136, "South Africa", "Southern Africa", "Africa"],
  YYZ: [-79.624, 43.677, "Canada", "North America", "North America"],
  FRA: [8.57, 50.03, "Germany", "Western Europe", "Europe"],
  DOH: [51.608, 25.273, "Qatar", "Western Asia", "Asia"],
  BCN: [2.08, 41.30, "Spain", "Southern Europe", "Europe"],
  FCO: [12.25, 41.80, "Italy", "Southern Europe", "Europe"],
  AMS: [4.763, 52.31, "Netherlands", "Western Europe", "Europe"],
  ARN: [17.94, 59.65, "Sweden", "Northern Europe", "Europe"],
  ATH: [23.944, 37.936, "Greece", "Southern Europe", "Europe"],
  NBO: [36.927, -1.319, "Kenya", "Eastern Africa", "Africa"],
  LAX: [-118.409, 33.943, "United States", "North America", "North America"],
  BKK: [100.75, 13.69, "Thailand", "Southeast Asia", "Asia"],
  MEL: [144.843, -37.673, "Australia", "Oceania", "Oceania"],
  IST: [28.75, 40.976, "Türkiye", "Western Asia", "Asia"],
  CPT: [18.60, -33.97, "South Africa", "Southern Africa", "Africa"],
  MEX: [-99.072, 19.436, "Mexico", "North America", "North America"],
};

export const GLOBAL_AIRPORTS = Object.freeze(Object.fromEntries(
  Object.entries(airportRecords).map(([code, [longitude, latitude, country, region, continent]]) => [
    code, Object.freeze([longitude, latitude, country, region, continent]),
  ]),
));
export const EUROPEAN_AIRPORTS = GLOBAL_AIRPORTS;

const routeScenarios = [
  { origin: "LHR", destination: "SFO", aircraft: "B787-9", status: "Delayed", event: "Simulated transatlantic departure-slot delay", delay: 48, progress: 0.41, notice: 35, threshold: 45, rate: 18, cap: 720, topic: "departure-slot coordination", contractType: "Flight Services", obligation: "Review a departure-slot change and notify the fictional operations partner", risk: "Long-haul connection and crew-duty effects require operational review.", rerouting: "No route change simulated; transatlantic alternates and extra fuel are unassessed.", action: "Compare slot options and preserve the original transatlantic route record." },
  { origin: "BER", destination: "PEK", aircraft: "A350-900", status: "Weather impact", event: "Illustrative upper-air turbulence review on an Asia-bound sector", delay: 32, progress: 0.52, notice: 42, threshold: 60, rate: 22, cap: 1100, topic: "upper-air route review", contractType: "Flight Operations", obligation: "Record the route review and confirm any required supplier notice", risk: "No live weather or turbulence observation is connected.", rerouting: "Any alternate track is hypothetical and is not drawn as the current route.", action: "Check authorized weather and flight-planning sources before action." },
  { origin: "DXB", destination: "SYD", aircraft: "A380-800", status: "On time", event: "Routine simulated long-haul operation; no disruption asserted", delay: 0, progress: 0.48, notice: 50, threshold: 40, rate: 24, cap: 1200, topic: "long-haul service continuity", contractType: "Flight Services", obligation: "No disruption notice is triggered in this scenario", risk: "Fuel, crew, handling and arrival-service terms are not supplied.", rerouting: "No reroute is simulated; diversion cost and suitable alternate status are unknown.", action: "No alert action; confirm operational sources before using outside the demo." },
  { origin: "HND", destination: "SIN", aircraft: "B787-8", status: "Delayed", event: "Simulated airport movement restriction before departure", delay: 26, progress: 0.63, notice: 28, threshold: 20, rate: 12, cap: 480, topic: "airport movement coordination", contractType: "Airport Services", obligation: "Review the movement restriction and log the fictional handler notification", risk: "Airport queue and turn-time impacts are illustrative only.", rerouting: "No reroute is simulated; alternate capacity and fees are unknown.", action: "Verify airport status and the actual handling agreement." },
  { origin: "CDG", destination: "JFK", aircraft: "A330-900", status: "Rerouted", event: "Illustrative North Atlantic track adjustment", delay: 39, progress: 0.56, notice: 32, threshold: 30, rate: 20, cap: 900, topic: "North Atlantic route amendment", contractType: "Flight Operations", obligation: "Review route amendment and retain the scenario's dispatch record", risk: "Track, slot and fuel impacts are not verified.", rerouting: "Track adjustment is a scenario label only; displayed aircraft remains on the CDG–JFK route.", action: "Compare the filed route with authorized dispatch data." },
  { origin: "MAD", destination: "GRU", aircraft: "A330-300", status: "Delayed", event: "Simulated late inbound aircraft affecting a South Atlantic connection", delay: 54, progress: 0.37, notice: 38, threshold: 45, rate: 16, cap: 800, topic: "late inbound aircraft recovery", contractType: "Flight Services", obligation: "Review the connection plan and notify the fictional service partner", risk: "Connection, crew and passenger impacts are unknown without itinerary data.", rerouting: "No alternate track or airport is established.", action: "Validate the inbound leg and passenger connection data." },
  { origin: "JNB", destination: "LHR", aircraft: "B777-300ER", status: "Weather impact", event: "Illustrative destination-weather disruption review", delay: 63, progress: 0.44, notice: 46, threshold: 50, rate: 19, cap: 950, topic: "destination weather recovery", contractType: "Flight Services", obligation: "Review arrival recovery and submit a fictional scenario notice", risk: "No observed weather, airport closure or arrival restriction is available.", rerouting: "Diversion, landing performance and passenger care requirements need separate assessment.", action: "Check current meteorological and airport-authority information." },
  { origin: "SIN", destination: "SYD", aircraft: "A321XLR", status: "On time", event: "Routine simulated regional sector; no disruption asserted", delay: 0, progress: 0.68, notice: 25, threshold: 25, rate: 15, cap: 600, topic: "regional service monitoring", contractType: "Airport Services", obligation: "No disruption notice is triggered in this scenario", risk: "Actual service level and handler performance data are not supplied.", rerouting: "No diversion or route change is simulated.", action: "No alert action; compare with real operating data only after verification." },
  { origin: "YYZ", destination: "FRA", aircraft: "B787-9", status: "Delayed", event: "Simulated ground-handling turnaround delay", delay: 47, progress: 0.58, notice: 34, threshold: 35, rate: 14, cap: 700, topic: "turnaround and ground handling", contractType: "Ground Handling", obligation: "Review turnaround milestones and the fictional handler escalation deadline", risk: "Handling records, service credits and connection effects are unavailable.", rerouting: "No alternate routing is simulated.", action: "Request verified turnaround timestamps and the executed handler terms." },
  { origin: "DOH", destination: "HND", aircraft: "A350-1000", status: "Rerouted", event: "Illustrative airspace restriction and route-planning review", delay: 57, progress: 0.46, notice: 44, threshold: 40, rate: 23, cap: 1150, topic: "airspace restriction mitigation", contractType: "Flight Operations", obligation: "Record a route mitigation review and check the notice window", risk: "No live NOTAM, restriction or fuel uplift data is connected.", rerouting: "Potential track mitigation only; aircraft rendering stays on the scheduled DOH–HND route.", action: "Check current NOTAMs and the authorized dispatch release." },
  { origin: "BCN", destination: "FCO", aircraft: "A220-300", status: "On time", event: "Routine simulated intra-European sector; no disruption asserted", delay: 0, progress: 0.43, notice: 20, threshold: 20, rate: 10, cap: 400, topic: "short-haul turn-time monitoring", contractType: "Airport Services", obligation: "No disruption notice is triggered in this scenario", risk: "No operational irregularity or verified expense is supplied.", rerouting: "No reroute is simulated.", action: "No alert action; no entitlement or claim is inferred from this fixture." },
  { origin: "AMS", destination: "MAD", aircraft: "A320neo", status: "Delayed", event: "Simulated departure queue and slot change", delay: 29, progress: 0.61, notice: 26, threshold: 25, rate: 11, cap: 440, topic: "departure queue mitigation", contractType: "Flight Services", obligation: "Review the fictional slot-notice deadline and document mitigation", risk: "Queue duration, attributions and actual service costs are unknown.", rerouting: "No alternate track is asserted.", action: "Verify airport and network-manager updates before assessing impact." },
  { origin: "FRA", destination: "ARN", aircraft: "E195-E2", status: "Delayed", event: "Illustrative maintenance-support planning review during a simulated sector", delay: 72, progress: 0.49, notice: 55, threshold: 60, rate: 17, cap: 850, topic: "maintenance support coordination", contractType: "Maintenance / MRO", obligation: "Review the fictional maintenance-support and notification workflow", risk: "No aircraft technical log, release status or AOG cost data is provided.", rerouting: "Replacement-aircraft and repositioning options are unknown.", action: "Use approved maintenance records and the executed MRO agreement." },
  { origin: "LHR", destination: "ATH", aircraft: "A321neo", status: "Delayed", event: "Simulated crew-duty recovery review", delay: 41, progress: 0.39, notice: 31, threshold: 35, rate: 13, cap: 650, topic: "crew-duty disruption response", contractType: "Flight Operations", obligation: "Review crew recovery options and the fictional operations notice time", risk: "Roster, duty limits and accommodation data are unavailable.", rerouting: "No diversion is represented; operational legality is not assessed.", action: "Verify approved crew scheduling and duty-time records." },
  { origin: "NBO", destination: "DXB", aircraft: "B737 MAX 8", status: "Diverted", event: "Illustrative diversion contingency planning scenario", delay: 88, progress: 0.54, notice: 49, threshold: 80, rate: 22, cap: 1050, topic: "diversion contingency coordination", contractType: "Flight Operations", obligation: "Review diversion-response contacts and fictional supplier notice obligations", risk: "No diversion has occurred; alternate availability and passenger handling are unknown.", rerouting: "Illustrative contingency only. The aircraft remains on the NBO–DXB displayed route.", action: "Check live aerodrome availability, fuel, permissions and passenger-care requirements." },
  { origin: "GRU", destination: "LIS", aircraft: "A330-200", status: "Delayed", event: "Simulated documentation and departure-readiness delay", delay: 36, progress: 0.45, notice: 33, threshold: 30, rate: 18, cap: 900, topic: "departure readiness and documentation", contractType: "Flight Services", obligation: "Review the fictional readiness checklist and supplier notification window", risk: "No passenger manifest, operating record or documentary exception is supplied.", rerouting: "No alternate routing is simulated.", action: "Confirm the source records and applicable airport procedures." },
  { origin: "LAX", destination: "HND", aircraft: "B787-10", status: "Weather impact", event: "Illustrative Pacific weather and fuel-planning review", delay: 51, progress: 0.60, notice: 40, threshold: 45, rate: 25, cap: 1250, topic: "Pacific route and fuel planning", contractType: "Flight Operations", obligation: "Review the fictional flight-planning notice and mitigation record", risk: "No weather observations, fuel uplift, reserve or dispatch calculation is connected.", rerouting: "No operational reroute is established; any fuel variance remains unknown.", action: "Use an authorized flight plan and verified fuel records." },
  { origin: "BKK", destination: "MEL", aircraft: "A350-900", status: "Delayed", event: "Simulated ground-service handover delay", delay: 44, progress: 0.50, notice: 36, threshold: 35, rate: 16, cap: 800, topic: "cross-station service handover", contractType: "Ground Handling", obligation: "Review the fictional station handover and escalation deadline", risk: "Supplier performance and passenger-service records are unknown.", rerouting: "No reroute or diversion is simulated.", action: "Verify local handler records and the applicable service schedule." },
  { origin: "IST", destination: "CPT", aircraft: "B777-200ER", status: "Rerouted", event: "Illustrative multi-region route amendment review", delay: 67, progress: 0.42, notice: 52, threshold: 55, rate: 20, cap: 1000, topic: "multi-region route amendment", contractType: "Flight Operations", obligation: "Review the fictional route-change notice and preserve decision evidence", risk: "Permissions, fuel, crew and supplier costs across the route are not established.", rerouting: "A route review is illustrative only; aircraft remains on the IST–CPT route line.", action: "Check actual overflight permissions, dispatch documentation and insurance conditions." },
  { origin: "JFK", destination: "MEX", aircraft: "A321neo", status: "Delayed", event: "Simulated arrival-gate and ground-service congestion", delay: 38, progress: 0.57, notice: 29, threshold: 30, rate: 12, cap: 600, topic: "arrival-gate and ground-service recovery", contractType: "Airport Services", obligation: "Review the fictional arrival-service notification timeline", risk: "Gate allocation, handler performance and passenger costs are unknown.", rerouting: "No diversion is simulated.", action: "Verify airport status and actual passenger itinerary information." },
];

const euCountries = new Set(["France", "Germany", "Spain", "Netherlands", "Italy", "Portugal", "Sweden", "Greece"]);
const nationalLawSources = {
  "United Kingdom": ["UK legislation portal", "https://www.legislation.gov.uk/"],
  "United States": ["U.S. Code / eCFR", "https://uscode.house.gov/"],
  Germany: ["Federal laws portal", "https://www.gesetze-im-internet.de/"],
  China: ["National laws and regulations database", "https://flk.npc.gov.cn/"],
  "United Arab Emirates": ["UAE Legislation", "https://uaelegislation.gov.ae/"],
  Australia: ["Federal Register of Legislation", "https://www.legislation.gov.au/"],
  Japan: ["e-Gov Laws and Regulations", "https://elaws.e-gov.go.jp/"],
  Singapore: ["Singapore Statutes Online", "https://sso.agc.gov.sg/"],
  France: ["Légifrance", "https://www.legifrance.gouv.fr/"],
  Spain: ["Boletín Oficial del Estado", "https://www.boe.es/"],
  Brazil: ["Presidency of the Republic — legislation", "https://www.planalto.gov.br/ccivil_03/"],
  "South Africa": ["South African Government — legislation", "https://www.gov.za/documents"],
  Canada: ["Justice Laws Website", "https://laws-lois.justice.gc.ca/"],
  Qatar: ["Al Meezan — Qatar Legal Portal", "https://www.almeezan.qa/"],
  Italy: ["Normattiva", "https://www.normattiva.it/"],
  Netherlands: ["Dutch legislation portal", "https://wetten.overheid.nl/"],
  Sweden: ["Swedish Parliament — laws", "https://www.riksdagen.se/"],
  Greece: ["National Printing Office", "https://www.et.gr/"],
  Kenya: ["Kenya Law", "https://kenyalaw.org/"],
  Thailand: ["Royal Gazette", "https://ratchakitcha.soc.go.th/"],
  Türkiye: ["Official Gazette", "https://www.resmigazete.gov.tr/"],
  Mexico: ["Chamber of Deputies — legislation", "https://www.diputados.gob.mx/LeyesBiblio/"],
};

function time(minutes) {
  const total = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")} UTC`;
}

function haversineDistanceKm(origin, destination) {
  const [lon1, lat1] = origin, [lon2, lat2] = destination;
  const radians = (value) => value * Math.PI / 180;
  const latitudeDelta = radians(lat2 - lat1), longitudeDelta = radians(lon2 - lon1);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function legalScopeCandidates(origin, destination) {
  const candidates = [{
    id: "montreal-1999",
    framework: "Montreal Convention 1999",
    basis: `International carriage candidate for the ${origin.code} (${origin.country})–${destination.code} (${destination.country}) itinerary.`,
    scope: "Potentially relevant only if the carriage meets the Convention's international-carriage definition and the claim falls within its subject matter.",
    conditions: "Verify operator, ticket/contract of carriage, itinerary, parties, applicable treaty status, claim type, limitation periods and available defences.",
    source: { title: "ICAO — Convention for the Unification of Certain Rules for International Carriage by Air (1999)", url: "https://www.icao.int/secretariat/legal/List%20of%20Parties/Mtl99_EN.pdf" },
    confidence: "Candidate only — facts and legal scope unverified",
  }];
  const euAirport = [origin, destination].find((airport) => euCountries.has(airport.country));
  if (euAirport) candidates.push({
    id: "eu-261-2004",
    framework: "Regulation (EC) No 261/2004",
    basis: `${euAirport.code} (${euAirport.country}) is an itinerary endpoint in the scenario.`,
    scope: "Departure from an EU airport may be in scope; arrival from a third country depends on carrier and other Regulation conditions. A route endpoint alone is not a determination.",
    conditions: "Verify airport/territory, operating air carrier, journey and booking facts, disruption cause, notice and all statutory conditions/exceptions.",
    source: { title: "EUR-Lex — Regulation (EC) No 261/2004", url: "https://eur-lex.europa.eu/eli/reg/2004/261/oj/eng" },
    confidence: "Potential territorial candidate — carrier and event facts unknown",
  });
  const ukAirport = [origin, destination].find((airport) => airport.country === "United Kingdom");
  if (ukAirport) candidates.push({
    id: "uk-261",
    framework: "UK passenger-rights regime (UK261 candidate)",
    basis: `${ukAirport.code} is a United Kingdom itinerary endpoint in the scenario.`,
    scope: "Territorial and carrier rules depend on direction of travel and operating-carrier facts; this fixture does not establish coverage.",
    conditions: "Verify the current UK statutory text, departure/arrival facts, operating carrier, disruption cause and applicable exceptions.",
    source: { title: "UK legislation — Air Passenger Rights and Air Travel Organisers' Licensing (Amendment) (EU Exit) Regulations 2019", url: "https://www.legislation.gov.uk/uksi/2019/278/contents" },
    confidence: "Potential territorial candidate — current law and carrier facts need review",
  });
  for (const airport of [origin, destination]) {
    const [title, url] = nationalLawSources[airport.country] || ["Official national legislation portal", "https://www.icao.int/"];
    candidates.push({
      id: `national-${airport.country.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      framework: `${airport.country} national aviation / passenger-rights law`,
      basis: `${airport.code} (${airport.country}) is an itinerary endpoint; no specific national provision has been identified.`,
      scope: "Jurisdictional research lead only. The portal is a source locator, not evidence that a national rule applies to this flight.",
      conditions: "Identify the relevant statute and current text; verify territorial reach, carrier, claim, contract and interaction with any international convention.",
      source: { title, url },
      confidence: "Unassessed research lead — not a legal conclusion",
    });
  }
  return candidates;
}

function scenarioExposure(scenario, index) {
  const calculatedCases = new Set([0, 1, 3, 4, 5, 8, 9, 12, 14, 16, 18, 19]);
  const assumptions = "All inputs are invented for this demonstration. No invoice, rate card, executed contract, observed delay, passenger record or verified liability is available.";
  const id = `illustrative-exposure-${index + 1}`;
  if (!calculatedCases.has(index)) return {
    id, kind: "unknown", state: "Unknown / unavailable", amount: null, currency: null, confirmedAmount: null,
    confidence: "No verified amount or applicable contract term supplied",
    basis: `Potential ${scenario.topic} cost cannot be quantified from available information.`,
    assumptions, source_locator: `Fictional scenario ${index + 1}; no financial evidence supplied`,
    components: ["Delay cost: unknown", "Rerouting and fuel: unknown", "Passenger impact: unknown", "Supplier / handling: unknown"],
  };
  const amount = Math.min(scenario.cap, Math.max(0, scenario.delay - scenario.threshold) * scenario.rate);
  return {
    id, kind: "hypothetical", state: "Hypothetical scenario calculation", amount, currency: "EUR", confirmedAmount: null,
    confidence: "Arithmetic only; all monetary inputs and contractual entitlement are hypothetical",
    basis: `Illustrative service-credit arithmetic: min(EUR ${scenario.cap} cap, max(0, ${scenario.delay} scenario minutes − ${scenario.threshold} threshold) × EUR ${scenario.rate}/minute) = EUR ${amount}.`,
    assumptions, source_locator: `Fictional scenario ${index + 1}; not a verified contract or financial source`,
    components: ["Delay: hypothetical scenario input only", "Rerouting and fuel: unknown", "Passenger impact: unknown", "Supplier / handling: not verified"],
  };
}

export function createDemonstrationAircraft() {
  return routeScenarios.map((scenario, index) => {
    const [originLongitude, originLatitude, originCountry, originRegion, originContinent] = GLOBAL_AIRPORTS[scenario.origin];
    const [destinationLongitude, destinationLatitude, destinationCountry, destinationRegion, destinationContinent] = GLOBAL_AIRPORTS[scenario.destination];
    const originPosition = [originLongitude, originLatitude], destinationPosition = [destinationLongitude, destinationLatitude];
    const routePosition = aircraftRoutePosition(originPosition, destinationPosition, scenario.progress);
    const routeDistanceKm = haversineDistanceKm(originPosition, destinationPosition);
    const routeDuration = Math.round(routeDistanceKm / 820 * 60);
    const departureMinute = 7 * 60 + index * 19;
    const noticeRemaining = scenario.notice - scenario.delay;
    const contractId = `illustrative-flight-contract-${index + 1}`;
    const clauseId = `${contractId}-clause`;
    const obligationId = `${contractId}-obligation`;
    const exposure = scenarioExposure(scenario, index);
    const fictionalProvider = `Fictional ${scenario.contractType.toLowerCase()} provider ${String(index + 1).padStart(2, "0")}`;
    const contract = {
      id: contractId,
      title: `Illustrative ${scenario.contractType.toLowerCase()} scenario ${String(index + 1).padStart(2, "0")}`,
      type: scenario.contractType,
      status: "Fictional example only — no executed contract supplied",
      counterparty: `Operion demonstration scenario / ${fictionalProvider}`,
      clause: {
        id: clauseId,
        title: `Illustrative clause ${index + 1}.1 — ${scenario.topic}`,
        text: `Fictional example only: review ${scenario.topic} and send a notice within ${scenario.notice} scenario minutes. A service credit would require verified attribution, the agreed service definition and review of exclusions and mitigation. No automatic breach or payment is established.`,
        source: `${contractId}, fictional scenario excerpt ${index + 1}.1; not an uploaded or executed contract`,
      },
      obligation: {
        id: obligationId,
        title: scenario.obligation,
        status: scenario.delay === 0 ? "Not triggered in this scenario" : noticeRemaining < 0 ? "Illustrative deadline passed — verify" : "Illustrative review window",
        deadline: scenario.delay === 0 ? "No disruption notice triggered in this scenario" : `${Math.max(0, noticeRemaining)} fictional scenario minutes remaining${noticeRemaining < 0 ? "; scenario deadline passed" : ""}`,
      },
      provisions: {
        "Delay / service level": `Only the fictional ${scenario.notice}-minute review window is described; no verified SLA supplied.`,
        "Force majeure / exclusions": "Not supplied in an executed agreement. The fictional example requires exclusions and mitigation to be reviewed; it does not classify an event.",
        "Rerouting / diversion": "No executed provision supplied; route changes, alternates and mitigation terms are unknown.",
        "Liability / indemnity": "Unknown — no verified agreement or liability cap supplied.",
        "Insurance": "Unknown — no policy, insured parties, limits or notice terms supplied.",
        "Governing law": "Unknown — no executed agreement or governing-law clause supplied.",
      },
    };
    const eventTimestamp = `${SCENARIO_DATE}T${time(departureMinute).slice(0, 5)}:00Z`;
    const legalCandidates = legalScopeCandidates(
      { code: scenario.origin, country: originCountry },
      { code: scenario.destination, country: destinationCountry },
    );
    const conditionItems = [
      { category: "Delay", assessment: `${scenario.delay ? `${scenario.delay} scenario minutes` : "No delay asserted"}; ${scenario.event}.` },
      { category: "Rerouting / diversion", assessment: scenario.rerouting },
      { category: "Weather", assessment: "No live meteorological observation or forecast is connected; weather impact is unknown unless expressly named as an illustrative scenario." },
      { category: "Fuel", assessment: "No fuel uplift, price, reserve or consumption record supplied; additional fuel exposure is unknown." },
      { category: "Airport / handling", assessment: `${scenario.origin} origin / ${scenario.destination} destination ground-service performance and fees are unverified.` },
      { category: "Aircraft-on-ground / maintenance", assessment: "No verified technical log, maintenance release or aircraft-on-ground status supplied." },
      { category: "Suppliers", assessment: `${fictionalProvider} is a fictional scenario counterparty; no real supplier obligation or penalty is established.` },
    ];
    const categories = scenario.delay === 0 ? [] : [
      ["Operational status", scenario.event],
      ["Financial exposure", exposure.kind === "hypothetical" ? "Hypothetical scenario arithmetic — not confirmed" : "Unquantified; inputs unavailable"],
      ["Contractual status", contract.obligation.status],
      ["Action status", noticeRemaining < 0 ? "Under investigation" : "Review suggested"],
    ];
    const recommendations = scenario.delay === 0 ? [] : [
      { id: `${contractId}-review`, title: "Verify the operational event and source records", reason: `${scenario.event} is a simulated scenario only; obtain reliable operating evidence before assessing any consequence.` },
      { id: `${contractId}-terms`, title: "Check the executed agreement and notice terms", reason: "The displayed clause is fictional. Confirm the actual counterparty, applicable clause, deadline, exclusions and governing law." },
      { id: `${contractId}-legal`, title: "Request a jurisdiction-specific legal review", reason: "The route lists only conditional legal-scope candidates. Carrier, itinerary, event and claim facts are missing; this is not legal advice." },
    ];
    const routeContinent = [...new Set([originContinent, destinationContinent])];
    const routeRegion = [...new Set([originRegion, destinationRegion])];
    const id = `ac-demo-${String(index + 1).padStart(3, "0")}`;
    return {
      id, registration: `SIM-${String(index + 1).padStart(3, "0")}`,
      callsign: `SIM${String(index + 1).padStart(3, "0")}`,
      flightNumber: `DEMO-OPS-${String(index + 1).padStart(3, "0")}`,
      icao24: `simulated-${String(index + 1).padStart(3, "0")}`,
      type: scenario.aircraft, model: scenario.aircraft,
      manufacturer: scenario.aircraft.startsWith("A") ? "Airbus (illustrative)" : scenario.aircraft.startsWith("B") ? "Boeing (illustrative)" : "Embraer (illustrative)",
      operator: "Operion simulated scenario",
      lessor: "Not supplied", manufactureYear: null, condition: "Unknown — no airframe record supplied",
      longitude: routePosition.longitude, latitude: routePosition.latitude,
      altitude: 10300, speed: 780, heading: aircraftRouteHeading(originPosition, destinationPosition, scenario.progress),
      routeProgress: scenario.progress, simulationRate: 30,
      origin: scenario.origin, destination: scenario.destination,
      originCountry, destinationCountry,
      departure: time(departureMinute), eta: time(departureMinute + routeDuration + scenario.delay),
      scheduledDeparture: time(departureMinute),
      estimatedDeparture: time(departureMinute + Math.min(scenario.delay, 35)),
      scheduledArrival: time(departureMinute + routeDuration),
      estimatedArrival: time(departureMinute + routeDuration + scenario.delay),
      departureWindow: `Scenario ${time(departureMinute)}`,
      arrivalWindow: `Scenario ${time(departureMinute + routeDuration + scenario.delay)}`,
      routeDistanceKm,
      delayMinutes: scenario.delay, rerouted: ["Rerouted", "Diverted"].includes(scenario.status),
      cancelled: false, rerouting: scenario.rerouting, phase: "Cruise",
      status: scenario.status, company: index < 2, weatherCellId: null,
      route: {
        origin: { code: scenario.origin, longitude: originLongitude, latitude: originLatitude },
        destination: { code: scenario.destination, longitude: destinationLongitude, latitude: destinationLatitude },
        distanceKm: routeDistanceKm, progress: scenario.progress,
        continents: routeContinent,
      },
      scope: routeContinent.length > 1 ? "Global" : routeContinent[0],
      countries: [...new Set([originCountry, destinationCountry])],
      regions: routeRegion,
      provenance: GLOBE_DEMO_NOTICE,
      dataTimestamp: `${SCENARIO_DATE} ${time(departureMinute)} (fixed fictional scenario record)`,
      scenarioDate: SCENARIO_DATE,
      intelligence: {
        event: { title: scenario.event, at: eventTimestamp, source: "Deterministic fictional scenario; no live telemetry", verified: false },
        contract, exposure,
        contracts: [contract],
        clauses: [contract.clause],
        obligations: contract.obligation ? [contract.obligation] : [],
        deadlines: contract.obligation ? [{
          id: obligationId, title: contract.obligation.title,
          deadline: contract.obligation.deadline, status: contract.obligation.status,
          source_locator: contract.clause.source,
        }] : [],
        risks: conditionItems.map((item, riskIndex) => ({
          id: `${contractId}-risk-${riskIndex + 1}`,
          category: item.category, title: `${item.category} scenario review`,
          assessment: item.assessment, source: "Fictional operational scenario; no live observation",
          verified: false,
        })),
        evidence: [{
          id: clauseId, excerpt: contract.clause.text,
          source_locator: contract.clause.source,
          status: "Fictional scenario excerpt — not uploaded or executed evidence",
        }],
        exposures: [exposure],
        operationalExposure: conditionItems,
        legal: {
          notice: "Conditional jurisdiction and legal-scope candidates only. No legal opinion or applicable-law determination.",
          candidates: legalCandidates,
          governingLaw: "Unknown — no executed contract or governing-law clause supplied.",
        },
        recommendations,
      },
      alerts: categories.map(([category, title], alertIndex) => ({
        id: `${id}-alert-${alertIndex}`, aircraftId: id, category, type: category, title,
        severity: exposure.kind === "hypothetical" ? "Medium" : "Review",
        status: "Open", actionStatus: noticeRemaining < 0 ? "Under investigation" : "Review suggested",
        contractId, obligationId, evidence: contract.clause.source, synthetic: true,
      })),
      contractIds: index % 4 === 3 ? ["demo-ground-handling"] : index % 4 === 2 ? ["demo-mro-agreement"] : ["demo-aircraft-lease"],
    };
  });
}
