import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createDemonstrationAircraft, GLOBE_DEMO_NOTICE, GLOBAL_AIRPORTS } from "../frontend/src/demo/globeIntelligenceData.js";
import { activeFilters, alertValues, DEFAULT_FLEET_FILTERS, filterOptions, fleetValues, FLEET_INTELLIGENCE_FILTERS, matchesAlert, matchesFleetIntelligence } from "../frontend/src/components/aviation/globeIntelligence.js";
import { SyntheticAviationProvider } from "../frontend/src/demo/aviationDataProvider.js";

const fleet = createDemonstrationAircraft();
test("twenty distinct global flights have explicit fictional provenance and coherent ground/airborne states", () => {
  assert.equal(fleet.length, 20);
  for (const key of ["id", "registration", "flightNumber"]) assert.equal(new Set(fleet.map((item) => item[key])).size, 20);
  assert.equal(new Set(fleet.map((item) => `${item.origin}-${item.destination}`)).size, 20);
  assert.deepEqual(new Set(fleet.flatMap((item) => item.route.continents)), new Set(["Europe", "North America", "South America", "Africa", "Asia", "Oceania"]));
  for (const item of fleet) {
    assert.equal(item.provenance, GLOBE_DEMO_NOTICE);
    assert.equal(item.operator, "Operion simulated scenario");
    assert.ok(GLOBAL_AIRPORTS[item.origin] && GLOBAL_AIRPORTS[item.destination]);
    assert.ok(item.route.continents.length >= 1);
    assert.ok(item.intelligence.event.title && item.intelligence.event.source);
    assert.equal(item.intelligence.event.verified, false);
    if (item.phase === "Ground") { assert.equal(item.speed, 0); assert.equal(item.altitude, 0); }
    if (item.cancelled) assert.match(item.estimatedArrival, /Cancelled/);
    assert.ok(Number.isFinite(item.heading) && item.heading >= 0 && item.heading < 360);
  }
});

test("hypothetical and unknown exposure remain distinct; amounts never establish liability", () => {
  assert.deepEqual(new Set(fleet.map((item) => item.intelligence.exposure.state)), new Set(["Hypothetical scenario calculation", "Unknown / unavailable"]));
  const quantified = fleet.filter((item) => item.intelligence.exposure.amount !== null);
  assert.equal(quantified.length, 12);
  assert.equal(fleet.find((item) => item.registration === "SIM-010").intelligence.exposure.amount, 391);
  for (const item of fleet) {
    const { exposure, contract, recommendations } = item.intelligence;
    assert.match(exposure.assumptions, /inputs are invented.*No invoice.*verified liability/i);
    assert.equal(exposure.confirmedAmount, null);
    if (exposure.amount !== null) {
      const inputs = exposure.basis.match(/min\(EUR (\d+) cap, max\(0, (\d+) scenario minutes − (\d+) threshold\) × EUR (\d+)\/minute\) = EUR (\d+)/);
      assert.ok(inputs, "Hypothetical amount exposes its scenario inputs");
      const [, cap, delay, threshold, rate, displayedAmount] = inputs.map(Number);
      assert.equal(delay, item.delayMinutes);
      assert.equal(exposure.amount, Math.min(cap, Math.max(0, delay - threshold) * rate));
      assert.equal(exposure.amount, displayedAmount);
      assert.equal(exposure.currency, "EUR");
      assert.equal(exposure.kind, "hypothetical");
      assert.match(contract.clause.text, /No automatic breach or payment is established/);
    } else {
      assert.equal(exposure.kind, "unknown");
      assert.equal(exposure.currency, null);
      assert.match(exposure.basis, /cannot be quantified/);
    }
    assert.ok(recommendations.every((action) => action.reason.length > 40));
  }
});

test("fleet facets combine on the same aircraft and contextual contract; contradictory filters return no records", () => {
  assert.equal(fleet.filter((item) => matchesFleetIntelligence(item, DEFAULT_FLEET_FILTERS)).length, 20);
  assert.equal(fleet.filter((item) => matchesFleetIntelligence(item, { scope: "Global" })).length, 20);
  assert.equal(fleet.filter((item) => matchesFleetIntelligence(item, { scope: "Europe" })).length, 11);
  assert.deepEqual(fleet.filter((item) => matchesFleetIntelligence(item, { country: "Spain", flightStatus: "Delayed" })).map((item) => item.registration), ["SIM-006", "SIM-012"]);
  assert.equal(fleet.filter((item) => matchesFleetIntelligence(item, { cancelled: "Yes", flightStatus: "On time" })).length, 0);
  assert.equal(fleet.filter((item) => matchesFleetIntelligence(item, { contract: fleet[1].intelligence.contract.title, registration: fleet[2].registration })).length, 0);
  assert.equal(fleet.filter((item) => matchesFleetIntelligence(item, { highExposure: "Yes — scenario ≥ EUR 300" })).length, 1);
  for (const [key] of FLEET_INTELLIGENCE_FILTERS) assert.ok(filterOptions(fleet, fleetValues, key).length, `${key} has supplied selectable values`);
  assert.equal(activeFilters({ scope: "Global", flightStatus: "Delayed", country: "Spain" }, DEFAULT_FLEET_FILTERS).length, 2);
  assert.equal(activeFilters({ scope: "Europe" }, DEFAULT_FLEET_FILTERS).length, 1);
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
  assert.equal(alerts.filter((record) => matchesAlert(record, { severity: "Medium", aircraft: "SIM-010" })).length, 4);
  assert.equal(alerts.filter((record) => matchesAlert(record, { severity: "High", aircraft: "SIM-010" })).length, 0);
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
  const popup = read("components/aviation/AircraftInfoPopup.jsx");
  assert.doesNotMatch(popup, /react-router|(?:href|to)=\{?`?["']?\/(?:app|demo)\/contracts/);
  assert.match(popup, /onClick=\{onInspectContract\}/);
  assert.match(popup, /href=\{candidate\.source\.url\} target="_blank" rel="noopener noreferrer"/);
  assert.match(read("routes/demo/AviationIntelligenceMap.jsx"), /\[selectedId, setSelectedId\] = useState\(null\)/);
  assert.doesNotMatch(read("routes/ProductionLiveTracking.jsx"), /SyntheticAviationProvider|globeIntelligenceData|href=\{`\/app\/contracts/);
  for (const file of ["components/demoRedesign/CesiumFlightGlobe.jsx", "components/aviation/ProductionFlightGlobe.jsx"]) {
    const renderer = read(file);
    assert.match(renderer, /attachGlobeImagery/);
    assert.match(renderer, /pickGlobeAircraft/);
  }
  assert.match(read("components/aviation/globeImagery.js"), /synchronizeGlobeSolarTime\(viewer\)/);
  assert.match(read("components/aviation/globeSolar.js"), /globe\.enableLighting = false/);
});
