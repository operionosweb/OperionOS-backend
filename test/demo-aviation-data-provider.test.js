import assert from "node:assert/strict";
import test from "node:test";

import { SyntheticAviationProvider } from "../frontend/src/demo/aviationDataProvider.js";
import { AVIATION_MAP_STYLES, getAviationMapStyle } from "../frontend/src/demo/aviationMapLayers.js";

test("synthetic aviation provider returns isolated aircraft snapshots", async () => {
  const first = await SyntheticAviationProvider.getAircraft();
  const second = await SyntheticAviationProvider.getAircraft();

  first[0].longitude = 0;
  first[0].contractIds.length = 0;

  assert.notEqual(second[0].longitude, 0);
  assert.equal(second[0].contractIds.length, 3);
  assert.equal(second.length >= 10, true);
  assert.equal(first.every((aircraft) => aircraft.manufacturer && aircraft.model), true);
  assert.equal(second.every((aircraft) => aircraft.route.origin.latitude && aircraft.route.destination.longitude), true);
  assert.equal(second.every((aircraft) => aircraft.contractIds.length > 0), true);
});

test("dependency graphs are scoped to the selected aircraft", async () => {
  const primary = await SyntheticAviationProvider.getContractDependencies("ac-goper");
  const secondary = await SyntheticAviationProvider.getContractDependencies("ac-gopra");
  const longHaul = await SyntheticAviationProvider.getContractDependencies("ac-n712av");

  assert.equal(primary.aircraftId, "ac-goper");
  assert.equal(primary.nodes.length, 13);
  assert.equal(secondary.nodes.length, 4);
  assert.equal(longHaul.nodes.length, 5);
  assert.equal(primary.nodes.filter((node) => node.type === "contract").length, 3);
  assert.equal(primary.nodes.filter((node) => node.type === "obligation").length, 3);
  assert.equal(primary.nodes.filter((node) => node.type === "dependency").length, 3);
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
  assert.equal(summary.liveFlights >= summary.trackedAircraft, true);
  assert.equal(summary.activeRoutes >= summary.trackedAircraft, true);
  assert.deepEqual(new Set(flights.map((item) => item.status)), new Set(["On time", "Delayed", "Diverted", "Weather impact", "Maintenance"]));
});

test("base map styles are distinct and resolve to a safe default", () => {
  assert.deepEqual(AVIATION_MAP_STYLES.map((style) => style.id), ["standard", "satellite", "topographic"]);
  assert.equal(new Set(AVIATION_MAP_STYLES.map((style) => style.url)).size, 3);
  assert.equal(getAviationMapStyle("satellite").label, "Satellite");
  assert.equal(getAviationMapStyle("missing").id, "standard");
});
