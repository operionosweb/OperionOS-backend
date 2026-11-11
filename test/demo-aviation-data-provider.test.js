import assert from "node:assert/strict";
import test from "node:test";

import { SyntheticAviationProvider } from "../frontend/src/demo/aviationDataProvider.js";
import { AVIATION_MAP_STYLES, getAviationMapStyle } from "../frontend/src/demo/aviationMapLayers.js";

test("synthetic aviation provider returns isolated aircraft snapshots", async () => {
  const first = await SyntheticAviationProvider.getAircraft();
  const second = await SyntheticAviationProvider.getAircraft();
  const originalContractIds = [...second[0].contractIds];

  first[0].longitude = 0;
  first[0].contractIds.length = 0;

  assert.notEqual(second[0].longitude, 0);
  assert.ok(originalContractIds.length > 0);
  assert.deepEqual(second[0].contractIds, originalContractIds);
  assert.equal(second.length, 20);
  assert.equal(first.every((aircraft) => aircraft.manufacturer && aircraft.model), true);
  assert.equal(second.every((aircraft) => aircraft.route.origin.latitude && aircraft.route.destination.longitude), true);
  assert.equal(second.every((aircraft) => aircraft.contractIds.length > 0), true);
});

test("dependency graphs are scoped to the selected aircraft", async () => {
  const aircraft = await SyntheticAviationProvider.getAircraft();
  const selected = [aircraft[0], aircraft[2], aircraft[3]];
  for (const item of selected) {
    const graph = await SyntheticAviationProvider.getContractDependencies(item.id);
    assert.equal(graph.aircraftId, item.id);
    assert.equal(graph.nodes.find((node) => node.type === "aircraft").label, item.registration);
    assert.deepEqual(graph.nodes.filter((node) => node.type === "contract").map((node) => node.contractId), item.contractIds);
    assert.equal(graph.nodes.filter((node) => node.type === "dependency").length, item.contractIds.length);
    const linked = graph.nodes.filter((node) => node.type === "linkedAircraft");
    assert.ok(linked.length > 0);
    assert.ok(linked.every((node) => node.aircraftId !== item.id && aircraft.some((other) => other.id === node.aircraftId && other.contractIds.some((id) => item.contractIds.includes(id)))));
    assert.ok(graph.edges.every((edge) => graph.nodes.some((node) => node.id === edge.source) && graph.nodes.some((node) => node.id === edge.target)));
  }
  assert.equal((await SyntheticAviationProvider.getContractDependencies()).aircraftId, aircraft[0].id);
});

test("contract relationships resolve back to isolated linked aircraft", async () => {
  const mroAircraft = await SyntheticAviationProvider.getContractAircraft("demo-mro-agreement");
  const next = await SyntheticAviationProvider.getContractAircraft("demo-mro-agreement");
  const aircraft = await SyntheticAviationProvider.getAircraft();
  mroAircraft[0].contractIds.length = 0;

  assert.ok(next.length > 1);
  assert.deepEqual(next.map((item) => item.id), aircraft.filter((item) => item.contractIds.includes("demo-mro-agreement")).map((item) => item.id));
  assert.equal(next.every((item) => item.route && item.weather), true);
  assert.notEqual(next[0].contractIds.length, 0);
});

test("weather provider returns isolated, explicitly synthetic visual cells", async () => {
  const weather = await SyntheticAviationProvider.getWeather();
  const next = await SyntheticAviationProvider.getWeather();
  weather.cells[0].latitude = 0;

  assert.equal(weather.state, "synthetic");
  assert.match(weather.source, /scenario/i);
  assert.equal(next.cells.length >= 5, true);
  assert.notEqual(next.cells[0].latitude, 0);
  assert.equal(next.cells.some((cell) => cell.type === "storm"), true);
});

test("summary metrics and alert states are internally coherent", async () => {
  const summary = await SyntheticAviationProvider.getSummary();
  const flights = await SyntheticAviationProvider.getFlights();

  assert.equal(summary.state, "synthetic");
  assert.equal(summary.liveFlights, 0, "Synthetic scenarios must not be presented as live flights");
  assert.equal(summary.activeRoutes, new Set(flights.map((item) => `${item.origin}-${item.destination}`)).size);
  assert.deepEqual(new Set(flights.map((item) => item.status)), new Set(["On time", "Delayed", "Diverted", "Weather impact", "Rerouted"]));
  assert.equal(summary.flightAlerts, flights.flatMap((item) => item.alerts).length);
  assert.equal(summary.trackedAircraft, flights.length);
});

test("base map styles are distinct and resolve to a safe default", () => {
  assert.deepEqual(AVIATION_MAP_STYLES.map((style) => style.id), ["standard", "satellite", "topographic"]);
  assert.equal(new Set(AVIATION_MAP_STYLES.map((style) => style.url)).size, 3);
  assert.equal(getAviationMapStyle("satellite").label, "Satellite");
  assert.equal(getAviationMapStyle("missing").id, "standard");
});
