import assert from "node:assert/strict";
import test from "node:test";
import { createDemonstrationAircraft, GLOBE_DEMO_NOTICE } from "../src/demo/globeIntelligenceData.js";
import { DEFAULT_FLEET_FILTERS, matchesFleetIntelligence } from "../src/components/aviation/globeIntelligence.js";
import { SyntheticAviationProvider } from "../src/demo/aviationDataProvider.js";

const expectedRoutes = [
  "LHR-SFO", "BER-PEK", "DXB-SYD", "HND-SIN", "CDG-JFK", "MAD-GRU", "JNB-LHR",
  "SIN-SYD", "YYZ-FRA", "DOH-HND", "BCN-FCO", "AMS-MAD", "FRA-ARN", "LHR-ATH",
  "NBO-DXB", "GRU-LIS", "LAX-HND", "BKK-MEL", "IST-CPT", "JFK-MEX",
];

test("the demonstration Globe has 20 unique routes spanning all six inhabited continents", () => {
  const flights = createDemonstrationAircraft();
  assert.equal(flights.length, 20);
  assert.deepEqual(flights.map(({ origin, destination }) => `${origin}-${destination}`), expectedRoutes);
  assert.equal(new Set(flights.map(({ id }) => id)).size, 20);
  assert.equal(new Set(flights.map(({ flightNumber }) => flightNumber)).size, 20);
  assert.equal(new Set(flights.map(({ registration }) => registration)).size, 20);
  assert.deepEqual(new Set(flights.flatMap(({ route }) => route.continents)), new Set([
    "Europe", "North America", "South America", "Africa", "Asia", "Oceania",
  ]));
  assert.ok(flights.every((flight) => flight.provenance === GLOBE_DEMO_NOTICE));
  assert.ok(flights.every((flight) => flight.flightNumber.startsWith("DEMO-OPS-") && flight.status));
  assert.ok(flights.every((flight) => flight.routeDistanceKm > 0 && flight.routeProgress > 0 && flight.routeProgress < 1));
  assert.ok(flights.every((flight) => matchesFleetIntelligence(flight, DEFAULT_FLEET_FILTERS)), "Global default leaves every simulated route visible");
  assert.equal(flights.filter((flight) => matchesFleetIntelligence(flight, { scope: "Europe" })).length, 11);
});

test("each flight carries unique, fictional contract evidence and conditional legal-scope candidates", () => {
  const flights = createDemonstrationAircraft();
  const ids = flights.map(({ intelligence }) => [
    intelligence.contract.id, intelligence.contract.clause.id, intelligence.contract.obligation.id,
  ]);
  assert.equal(new Set(ids.flat()).size, flights.length * 3);
  assert.equal(new Set(flights.map(({ intelligence }) => intelligence.contract.clause.text)).size, flights.length);
  assert.ok(flights.every((flight) => flight.intelligence.contract.status.includes("Fictional")));
  for (const flight of flights) {
    const { legal, contract, clauses, obligations, deadlines, risks, evidence, exposures } = flight.intelligence;
    assert.match(legal.notice, /not a legal opinion|no legal opinion/i);
    assert.match(legal.governingLaw, /Unknown/);
    assert.ok(legal.candidates.length >= 3);
    assert.ok(legal.candidates.every((candidate) => candidate.confidence && candidate.conditions
      && candidate.source.title && candidate.source.url.startsWith("https://")));
    assert.ok(contract.clause.source.includes("fictional scenario"));
    assert.match(contract.provisions["Liability / indemnity"], /Unknown/);
    assert.match(contract.provisions["Governing law"], /Unknown/);
    assert.equal(clauses[0].id, contract.clause.id);
    assert.equal(obligations[0].id, contract.obligation.id);
    assert.equal(deadlines[0].source_locator, contract.clause.source);
    assert.ok(risks.every((risk) => risk.verified === false));
    assert.equal(evidence[0].source_locator, contract.clause.source);
    assert.equal(exposures[0].kind, flight.intelligence.exposure.kind);
  }
});

test("financial values are typed hypothetical arithmetic or explicitly unavailable, never confirmed", () => {
  const flights = createDemonstrationAircraft();
  const exposures = flights.map(({ intelligence }) => intelligence.exposure);
  assert.ok(exposures.some(({ kind }) => kind === "hypothetical"));
  assert.ok(exposures.some(({ kind }) => kind === "unknown"));
  assert.ok(exposures.every((item) => item.confirmedAmount === null));
  const hypotheticalAmounts = exposures.filter((item) => item.kind === "hypothetical").map((item) => item.amount);
  assert.equal(new Set(hypotheticalAmounts).size, hypotheticalAmounts.length, "Each calculated scenario has distinct route-specific arithmetic");
  for (const exposure of exposures) {
    if (exposure.kind === "unknown") {
      assert.equal(exposure.amount, null);
      assert.match(exposure.state, /Unknown/);
    } else {
      assert.ok(Number.isFinite(exposure.amount) && exposure.amount >= 0);
      assert.equal(exposure.currency, "EUR");
      assert.match(exposure.state, /Hypothetical/);
      assert.match(exposure.basis, /Illustrative service-credit arithmetic/);
      assert.match(exposure.assumptions, /invented/);
    }
  }
});

test("the configured synthetic provider preserves all global route metadata", async () => {
  const flights = await SyntheticAviationProvider.getAircraft();
  const summary = await SyntheticAviationProvider.getSummary();
  assert.equal(flights.length, 20);
  assert.equal(summary.liveFlights, 0);
  assert.equal(summary.trackedAircraft, 20);
  assert.ok(flights.every((flight) => flight.route.origin.longitude !== undefined
    && flight.route.destination.latitude !== undefined
    && flight.route.continents.length >= 1
    && Number.isFinite(flight.routeProgress)));
  assert.equal(flights.filter((flight) => matchesFleetIntelligence(flight, DEFAULT_FLEET_FILTERS)).length, 20);
});
