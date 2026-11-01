import assert from "node:assert/strict";
import test from "node:test";
import Cartesian3 from "@cesium/engine/Source/Core/Cartesian3.js";
import {
  advanceAircraftAlongRoute,
  aircraftRouteDistance,
  aircraftRouteHeading,
  aircraftRoutePosition,
  aircraftRoutePositions,
} from "../src/components/aviation/aircraftPose.js";

const routeCases = [
  { origin: [-0.4543, 51.47], destination: [-122.379, 37.621] },
  { origin: [139.779, 35.55], destination: [103.99, 1.36] },
  { origin: [151.177, -33.946], destination: [144.843, -37.673] },
];

test("rendered route geometry is a single accurate geodesic between its airport endpoints", () => {
  for (const { origin, destination } of routeCases) {
    const positions = aircraftRoutePositions(origin, destination);
    assert.equal(positions.length, 65);
    const start = Cartesian3.fromDegrees(origin[0], origin[1], 16000);
    const end = Cartesian3.fromDegrees(destination[0], destination[1], 16000);
    assert.ok(Cartesian3.distance(positions[0], start) < 0.01);
    assert.ok(Cartesian3.distance(positions.at(-1), end) < 0.01);
    for (const fraction of [0, 0.2, 0.5, 0.8, 1]) {
      const sampleIndex = Math.round(fraction * 64);
      const sample = aircraftRoutePosition(origin, destination, sampleIndex / 64);
      const routeSample = positions[sampleIndex];
      assert.ok(Cartesian3.distance(Cartesian3.fromDegrees(sample.longitude, sample.latitude, 16000), routeSample) < 0.02);
    }
  }
});

test("simulated movement advances along the selected geodesic and clamps at destination", () => {
  for (const { origin, destination } of routeCases) {
    const total = aircraftRouteDistance(origin, destination);
    const initialFraction = 0.43;
    const distance = 12345;
    const next = advanceAircraftAlongRoute(origin, destination, initialFraction, distance);
    const expectedFraction = initialFraction + distance / total;
    const expected = aircraftRoutePosition(origin, destination, expectedFraction);
    assert.ok(Math.abs(next.fraction - expectedFraction) < 1e-12);
    assert.ok(Math.abs(next.longitude - expected.longitude) < 1e-9);
    assert.ok(Math.abs(next.latitude - expected.latitude) < 1e-9);
    assert.equal(next.arrived, false);
    assert.ok(Math.abs(next.heading - aircraftRouteHeading(origin, destination, expectedFraction)) < 1e-9);
    const arrived = advanceAircraftAlongRoute(origin, destination, 0.999, total);
    assert.equal(arrived.fraction, 1);
    assert.equal(arrived.arrived, true);
    assert.ok(Math.abs(arrived.longitude - destination[0]) < 1e-9);
    assert.ok(Math.abs(arrived.latitude - destination[1]) < 1e-9);
  }
});
