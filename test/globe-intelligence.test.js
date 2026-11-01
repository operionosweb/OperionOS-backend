import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createDemonstrationAircraft, GLOBE_DEMO_NOTICE, EUROPEAN_AIRPORTS } from "../frontend/src/demo/globeIntelligenceData.js";
import { activeFilters, alertValues, DEFAULT_FLEET_FILTERS, filterOptions, fleetValues, FLEET_INTELLIGENCE_FILTERS, matchesAlert, matchesFleetIntelligence } from "../frontend/src/components/aviation/globeIntelligence.js";
import { SyntheticAviationProvider } from "../frontend/src/demo/aviationDataProvider.js";

const fleet = createDemonstrationAircraft();
test("ten distinct European flights have explicit fictional provenance and coherent ground/airborne states", () => {
  assert.equal(fleet.length, 10);
  for (const key of ["id", "registration", "flightNumber"]) assert.equal(new Set(fleet.map((item) => item[key])).size, 10);
  assert.equal(new Set(fleet.map((item) => `${item.origin}-${item.destination}`)).size, 10);
  for (const item of fleet) {
    assert.equal(item.provenance, GLOBE_DEMO_NOTICE);
    assert.match(item.operator, /^Fictional .* Demo Air$/);
    assert.ok(EUROPEAN_AIRPORTS[item.origin] && EUROPEAN_AIRPORTS[item.destination]);
    assert.equal(item.scope, "Europe");
    assert.ok(item.intelligence.event.title && item.intelligence.event.source);
    assert.equal(item.intelligence.event.verified, false);
    if (item.phase === "Ground") { assert.equal(item.speed, 0); assert.equal(item.altitude, 0); }
    if (item.cancelled) assert.match(item.estimatedArrival, /Cancelled/);
    assert.ok(Number.isFinite(item.heading) && item.heading >= 0 && item.heading < 360);
  }
});

test("all six exposure states remain distinct; scenario amounts require supplied terms and never establish liability", () => {
  assert.deepEqual(new Set(fleet.map((item) => item.intelligence.exposure.state)), new Set(["No identified exposure", "Potential contractual exposure", "Estimated financial exposure", "Unquantified exposure", "Insufficient evidence", "Confirmed contractual obligation"]));
  const quantified = fleet.filter((item) => item.intelligence.exposure.amount !== null);
  assert.deepEqual(quantified.map((item) => item.intelligence.exposure.amount), [150, 350]);
  for (const item of fleet) {
    const { exposure, contract, recommendations } = item.intelligence;
    assert.match(exposure.assumptions, /No actual customer liability or confirmed breach/);
    if (exposure.amount !== null) {
      assert.equal(exposure.amount, Math.min(500, Math.max(0, item.delayMinutes - 60) * 10));
      assert.equal(exposure.currency, "EUR");
      assert.match(contract.clause.text, /EUR 10 per excess minute/);
      assert.match(exposure.basis, /before exclusions/);
    } else assert.equal(exposure.basis, "Exposure not yet quantified.");
    if (exposure.state === "Insufficient evidence") { assert.equal(contract.clause, null); assert.equal(contract.obligation, null); }
    assert.ok(recommendations.every((action) => action.reason.length > 40));
  }
});

test("fleet facets combine on the same aircraft and contextual contract; contradictory filters return no records", () => {
  assert.equal(fleet.filter((item) => matchesFleetIntelligence(item, DEFAULT_FLEET_FILTERS)).length, 10);
  assert.equal(fleet.filter((item) => matchesFleetIntelligence(item, { scope: "Global" })).length, 10);
  assert.deepEqual(fleet.filter((item) => matchesFleetIntelligence(item, { country: "Spain", flightStatus: "Delayed" })).map((item) => item.registration), ["G-OPRA"]);
  assert.equal(fleet.filter((item) => matchesFleetIntelligence(item, { cancelled: "Yes", flightStatus: "On time" })).length, 0);
  assert.equal(fleet.filter((item) => matchesFleetIntelligence(item, { contract: fleet[1].intelligence.contract.title, operator: fleet[2].operator })).length, 0);
  assert.equal(fleet.filter((item) => matchesFleetIntelligence(item, { highExposure: "Yes — scenario ≥ EUR 300" })).length, 1);
  for (const [key] of FLEET_INTELLIGENCE_FILTERS) assert.ok(filterOptions(fleet, fleetValues, key).length, `${key} has supplied selectable values`);
  assert.equal(activeFilters({ scope: "Europe", flightStatus: "Delayed", country: "Spain" }, DEFAULT_FLEET_FILTERS).length, 2);
  assert.equal(activeFilters({ scope: "Global" }, DEFAULT_FLEET_FILTERS).length, 1);
});

test("alerts link one aircraft, clause and obligation; category filters cannot cross-match separate alerts", () => {
  const alerts = fleet.flatMap((aircraft) => aircraft.alerts.map((alert) => ({ aircraft, alert })));
  assert.ok(alerts.length >= 20);
  assert.equal(new Set(alerts.map(({ alert }) => alert.id)).size, alerts.length);
  for (const { aircraft, alert } of alerts) {
    assert.equal(alert.aircraftId, aircraft.id);
    assert.equal(alert.contractId, aircraft.intelligence.contract.id);
    assert.equal(alert.synthetic, true);
    assert.ok(alert.evidence);
    if (alert.obligationId) assert.equal(alert.obligationId, aircraft.intelligence.contract.obligation.id);
  }
  assert.ok(alerts.filter((record) => matchesAlert(record, { severity: "High", aircraft: "DEMO-009" })).length);
  assert.equal(alerts.filter((record) => matchesAlert(record, { operational: fleet[1].intelligence.event.title, category: "Financial exposure" })).length, 0);
  assert.ok(filterOptions(alerts, alertValues, "country").includes("Spain"));
});

test("provider clones nested intelligence and alerts without mutating or seeding any customer records", async () => {
  const first = await SyntheticAviationProvider.getAircraft();
  first[1].intelligence.contract.clause.text = "modified";
  first[1].alerts.length = 0;
  first[1].countries.length = 0;
  const next = await SyntheticAviationProvider.getAircraft();
  assert.notEqual(next[1].intelligence.contract.clause.text, "modified");
  assert.ok(next[1].alerts.length && next[1].countries.length);
});

test("all demo surfaces default to no selection; customer globe remains synthetic-free and contract inspection is in-place", () => {
  const read = (file) => fs.readFileSync(new URL(`../frontend/src/${file}`, import.meta.url), "utf8");
  const shared = read("components/aviation/FlightOperations.jsx");
  assert.match(shared, /\[selectedId, setSelectedId\] = useState\(null\)/);
  assert.match(shared, /\[aircraftPopupOpen, setAircraftPopupOpen\] = useState\(false\)/);
  assert.match(shared, /<ContractIntelligencePanel/);
  assert.doesNotMatch(read("components/aviation/AircraftInfoPopup.jsx"), /react-router|href=|to=/);
  assert.match(read("routes/demo/AviationIntelligenceMap.jsx"), /\[selectedId, setSelectedId\] = useState\(null\)/);
  assert.doesNotMatch(read("routes/ProductionLiveTracking.jsx"), /SyntheticAviationProvider|globeIntelligenceData|href=\{`\/app\/contracts/);
  for (const file of ["components/demoRedesign/CesiumFlightGlobe.jsx", "components/aviation/ProductionFlightGlobe.jsx"]) {
    const renderer = read(file);
    assert.match(renderer, /enableLighting = false/);
    assert.match(renderer, /#eef5fb/);
    assert.match(renderer, /pickGlobeAircraft/);
  }
});
