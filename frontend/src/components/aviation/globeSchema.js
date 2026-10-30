// Geographic risk markers are projections of prepared contract records onto
// synthetic aircraft positions, not independently observed regional events.
export const GLOBE_LAYERS = Object.freeze([
  { id: "aircraft", label: "Aircraft and fleet", available: true, initial: true },
  { id: "airports", label: "Airports and aviation hubs", available: true, initial: false },
  { id: "assets", label: "Contract-linked assets", available: true, initial: false },
  { id: "counterparties", label: "Contract counterparties", available: false, reason: "Counterparty locations are not provided." },
  { id: "mro", label: "MRO facilities", available: false, reason: "No verified facility coordinates are available." },
  { id: "handling", label: "Ground handling providers", available: false, reason: "No supplier facility coordinates are available." },
  { id: "fuel", label: "Fuel suppliers", available: false, reason: "No fuel supply agreements or locations are connected." },
  { id: "weather", label: "Weather and environmental conditions", available: true, initial: false },
  { id: "geopolitical", label: "Geopolitical and regional indicators", available: false, reason: "No authorized regional-risk feed is connected." },
  { id: "risks", label: "Contractual risk hotspots", available: true, initial: false },
  { id: "exposure", label: "Financial exposure hotspots", available: true, initial: false },
  { id: "dependencies", label: "Supplier dependencies", available: false, reason: "Relationships are available below; supplier coordinates are unavailable." },
]);

export const GLOBE_FILTERS = Object.freeze([
  { id: "type", label: "Aircraft type" },
  { id: "operator", label: "Airline / operator" },
  { id: "assetCategory", label: "Asset category", unavailable: "Only aircraft records are connected." },
  { id: "contractType", label: "Contract type" },
  { id: "counterparty", label: "Counterparty" },
  { id: "supplier", label: "Supplier" },
  { id: "region", label: "Geographic region", unavailable: "No authoritative region taxonomy is supplied." },
  { id: "risk", label: "Risk level" },
  { id: "exposure", label: "Exposure category" },
  { id: "weather", label: "Weather severity" },
  { id: "status", label: "Contract status" },
]);

export function getFilterOptions(id, aircraft, contracts) {
  const values = id === "type" ? aircraft.map((item) => item.type)
    : id === "operator" ? aircraft.map((item) => item.operator)
      : id === "weather" ? aircraft.map((item) => item.weather?.severity)
        : id === "risk" ? contracts.flatMap((item) => item.risks.map((risk) => risk.severity))
          : id === "exposure" ? contracts.flatMap((item) => item.financialImpact?.items.map((entry) => entry.exposureType) || [])
            : contracts.map((item) => ({ contractType: item.type, counterparty: item.counterparty, supplier: item.counterparty, status: item.status })[id]);
  return [...new Set(values.filter(Boolean))].sort();
}

export function matchesGlobeFilters(aircraft, filters, contracts) {
  if (filters.type && aircraft.type !== filters.type) return false;
  if (filters.operator && aircraft.operator !== filters.operator) return false;
  if (filters.weather && aircraft.weather?.severity !== filters.weather) return false;
  const related = contracts.filter((item) => aircraft.contractIds.includes(item.id));
  // All contract predicates must match the same contract, not unrelated records.
  const contractFilters = ["contractType", "counterparty", "supplier", "risk", "exposure", "status"];
  if (!contractFilters.some((id) => filters[id])) return true;
  return related.some((item) =>
    (!filters.contractType || item.type === filters.contractType)
    && (!filters.counterparty || item.counterparty === filters.counterparty)
    && (!filters.supplier || item.counterparty === filters.supplier)
    && (!filters.status || item.status === filters.status)
    && (!filters.risk || item.risks.some((risk) => risk.severity === filters.risk))
    && (!filters.exposure || item.financialImpact?.items.some((entry) => entry.exposureType === filters.exposure)));
}

export function buildSpatialObjects(aircraft, contracts) {
  const airports = new Map();
  const objects = [];
  aircraft.forEach((item) => {
    const related = contracts.filter((contract) => item.contractIds.includes(contract.id));
    for (const airport of [item.route?.origin, item.route?.destination].filter(Boolean)) {
      if (!airports.has(airport.code)) airports.set(airport.code, {
        id: `airport-${airport.code}`, layer: "airports", title: airport.code,
        longitude: airport.longitude, latitude: airport.latitude, contractIds: [],
        description: "Airport on a prepared route. Route association does not establish an airport service agreement.",
      });
      const entry = airports.get(airport.code);
      entry.contractIds = [...new Set([...entry.contractIds, ...item.contractIds])];
    }
    if (related.length) objects.push({
      id: `asset-${item.id}`, layer: "assets", title: item.registration,
      longitude: item.longitude, latitude: item.latitude, aircraftId: item.id,
      contractIds: related.map((contract) => contract.id),
      description: "Asset-to-contract links from the synthetic aviation provider.",
    });
    const risks = related.flatMap((contract) => contract.risks);
    if (risks.length) objects.push({
      id: `risk-${item.id}`, layer: "risks", title: `${item.registration} / contractual review`,
      longitude: item.longitude + 1.5, latitude: item.latitude, aircraftId: item.id,
      contractIds: related.map((contract) => contract.id),
      description: "Prepared contractual risks projected near the synthetic asset, not a local event or operational incident.",
    });
    if (related.some((contract) => contract.financialImpact?.items.length)) objects.push({
      id: `exposure-${item.id}`, layer: "exposure", title: `${item.registration} / illustrative exposure`,
      longitude: item.longitude - 1.5, latitude: item.latitude, aircraftId: item.id,
      contractIds: related.filter((contract) => contract.financialImpact?.items.length).map((contract) => contract.id),
      description: "Illustrative contract financial assumptions projected near a synthetic asset; not a geographically measured loss.",
    });
  });
  return [...airports.values(), ...objects];
}
