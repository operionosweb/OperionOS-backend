import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { SyntheticAviationProvider } from "../frontend/src/demo/aviationDataProvider.js";
import { buildSpatialObjects, GLOBE_FILTERS, GLOBE_LAYERS, matchesGlobeFilters } from "../frontend/src/components/aviation/globeSchema.js";

const contracts = [
  { id: "demo-aircraft-lease", type: "Lease", counterparty: "Lessor", status: "Active", risks: [{ severity: "Critical" }], financialImpact: { items: [{ exposureType: "Conditional" }] } },
  { id: "demo-mro-agreement", type: "MRO", counterparty: "Maintainer", status: "Review", risks: [{ severity: "Low" }] },
];

test("one authoritative globe schema exposes all twelve layers without fabricated availability", () => {
  assert.equal(GLOBE_LAYERS.length, 12);
  assert.equal(new Set(GLOBE_LAYERS.map((layer) => layer.id)).size, 12);
  assert.ok(GLOBE_LAYERS.filter((layer) => !layer.available).every((layer) => layer.reason));
  assert.equal(GLOBE_FILTERS.length, 11);
  assert.equal(GLOBE_LAYERS.find((layer) => layer.id === "geopolitical").available, false);
});

test("combined filters must match the same linked contract", async () => {
  const [aircraft] = await SyntheticAviationProvider.getAircraft();
  assert.equal(matchesGlobeFilters(aircraft, { contractType: "Lease", counterparty: "Maintainer" }, contracts), false);
  assert.equal(matchesGlobeFilters(aircraft, { contractType: "Lease", counterparty: "Lessor", risk: "Critical" }, contracts), true);
  assert.equal(matchesGlobeFilters(aircraft, { exposure: "Conditional", status: "Review" }, contracts), false);
  assert.equal(matchesGlobeFilters(aircraft, { type: "B787-9" }, contracts), false);
  assert.equal(matchesGlobeFilters(aircraft, { operator: aircraft.operator, weather: aircraft.weather.severity }, contracts), true);
});

test("spatial records use known route and aircraft positions and deduplicate airports", async () => {
  const aircraft = await SyntheticAviationProvider.getAircraft();
  const objects = buildSpatialObjects(aircraft, contracts);
  assert.equal(new Set(objects.map((item) => item.id)).size, objects.length);
  assert.ok(objects.every((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)));
  assert.ok(objects.filter((item) => item.layer === "risks").every((item) => /not a local event/.test(item.description)));
  assert.ok(objects.filter((item) => item.layer === "exposure").every((item) => item.contractIds.includes("demo-aircraft-lease")));
  assert.deepEqual(buildSpatialObjects([], contracts), []);
});

test("every routed globe consumes FlightOperations and only it imports the renderer", () => {
  for (const path of [
    "frontend/src/routes/demo/DemoDashboard.jsx",
    "frontend/src/routes/demo/AviationIntelligenceMap.jsx",
    "frontend/src/components/corporate/ExecutiveCockpit.jsx",
  ]) {
    const source = fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /<FlightOperations/);
    assert.doesNotMatch(source, /<CesiumFlightGlobe/);
  }
  const legacy = fs.readFileSync(new URL("../frontend/src/routes/demo/DemoLiveTracking.jsx", import.meta.url), "utf8");
  assert.match(legacy, /export \{ default \} from "\.\/AviationIntelligenceMap"/);
  const shared = fs.readFileSync(new URL("../frontend/src/components/aviation/FlightOperations.jsx", import.meta.url), "utf8");
  assert.match(shared, /GLOBE_FILTERS, GLOBE_LAYERS/);
  assert.match(shared, /<CesiumFlightGlobe/);
});
