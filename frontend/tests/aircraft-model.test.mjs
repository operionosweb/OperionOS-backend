import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import Cartesian3 from "@cesium/engine/Source/Core/Cartesian3.js";
import Cartographic from "@cesium/engine/Source/Core/Cartographic.js";
import Matrix3 from "@cesium/engine/Source/Core/Matrix3.js";
import Matrix4 from "@cesium/engine/Source/Core/Matrix4.js";
import Transforms from "@cesium/engine/Source/Core/Transforms.js";
import Axis from "@cesium/engine/Source/Scene/Axis.js";
import ModelUtility from "@cesium/engine/Source/Scene/Model/ModelUtility.js";
import { AIRCRAFT_STATUS_COLORS, advanceAircraftPosition, aircraftOrientation, aircraftRoutePositions } from "../src/components/aviation/aircraftPose.js";

test("packaged aircraft preserves the detailed Home model with five batched materials and embedded livery", async () => {
  const buffer = await readFile(new URL("../public/models/operion-airliner.glb", import.meta.url));
  assert.equal(buffer.readUInt32LE(0), 0x46546c67);
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString().trim());
  assert.equal(gltf.meshes.length, 5, "Material batching avoids dozens of engine fan draw calls per aircraft");
  assert.ok(gltf.meshes.every((mesh) => mesh.primitives.every((primitive) => primitive.attributes.NORMAL !== undefined)));
  const vertices = gltf.meshes.reduce((sum, mesh) => sum + gltf.accessors[mesh.primitives[0].attributes.POSITION].count, 0);
  assert.ok(vertices > 20000, "Use the detailed Home fuselage, wings, engines and glazing, not a symbolic aircraft mesh");
  assert.ok(gltf.images.length > 0 && gltf.images.every((image) => image.bufferView !== undefined && !image.uri));
  assert.ok(gltf.buffers.every((entry) => !entry.uri), "No external asset or texture URLs");
  const root = gltf.nodes.find((node) => node.name === "Operion Home 3D Asset View Airliner");
  assert.deepEqual(root.extras, { source: "AircraftScene.buildAircraft", forwardAxis: "+Z", upAxis: "+Y", illustrative: true });
  assert.ok(buffer.length < 2_000_000, "Shared model transfer remains bounded");
});

test("3D aircraft nose follows true bearings in the local geographic frame at different globe positions", () => {
  const correction = ModelUtility.getAxisCorrectionMatrix(Axis.Y, Axis.Z, new Matrix4());
  const correctedNose = Matrix4.multiplyByPointAsVector(correction, Cartesian3.UNIT_Z, new Cartesian3());
  const correctedUp = Matrix4.multiplyByPointAsVector(correction, Cartesian3.UNIT_Y, new Cartesian3());
  assert.ok(Cartesian3.equalsEpsilon(correctedNose, Cartesian3.UNIT_X, 1e-10));
  assert.ok(Cartesian3.equalsEpsilon(correctedUp, Cartesian3.UNIT_Z, 1e-10));
  for (const [longitude, latitude] of [[0, 0], [23.8, 46.2], [179.8, -60]]) {
    const position = Cartesian3.fromDegrees(longitude, latitude, 11200);
    const frame = Transforms.eastNorthUpToFixedFrame(position);
    for (const heading of [0, 45, 90, 112, 180, 270, 350]) {
      const actual = Matrix3.multiplyByVector(Matrix3.fromQuaternion(aircraftOrientation(position, heading)), correctedNose, new Cartesian3());
      const radians = heading * Math.PI / 180;
      const expected = Matrix4.multiplyByPointAsVector(frame, new Cartesian3(Math.sin(radians), Math.cos(radians), 0), new Cartesian3());
      assert.ok(Cartesian3.equalsEpsilon(actual, expected, 1e-10), `Bearing ${heading} at ${longitude},${latitude}`);
    }
  }
});

test("geodesic routes connect both airport endpoints through the aircraft without cutting through Earth", () => {
  for (const [origin, current, destination] of [
    [[-0.45, 51.47], [23.8, 46.2], [55.36, 25.25]],
    [[170, 45], [-179, 50], [-150, 40]],
    [[0, 0], [0, 0], [1, 1]],
  ]) {
    const positions = aircraftRoutePositions(origin, current, destination);
    assert.equal(positions.length, 65);
    for (const [index, endpoint] of [[0, origin], [32, current], [64, destination]]) {
      assert.ok(Cartesian3.distance(positions[index], Cartesian3.fromDegrees(endpoint[0], endpoint[1], 16000)) < 0.01);
    }
    positions.forEach((position, index) => {
      assert.ok(Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z));
      if (index) {
        const midpoint = Cartesian3.midpoint(positions[index - 1], position, new Cartesian3());
        assert.ok(Cartographic.fromCartesian(midpoint).height > 0, "Even line segments stay above the ellipsoid");
      }
    });
  }
});

test("all existing flight-status colours are retained for 3D model tint and silhouette", () => {
  assert.deepEqual(AIRCRAFT_STATUS_COLORS, {
    "On time": "#4cd18c", Delayed: "#efad43", Diverted: "#ee5a64",
    "Weather impact": "#9b7aef", Maintenance: "#58b6dc",
  });
});

test("illustrative movement follows the same geographic heading as the model, including date-line crossings", () => {
  for (const position of [{ longitude: 23.8, latitude: 46.2 }, { longitude: 179.999, latitude: -60 }]) {
    for (const heading of [0, 90, 112, 180, 270, 350]) {
      const next = advanceAircraftPosition(position, heading, 450);
      const lat1 = position.latitude * Math.PI / 180, lat2 = next.latitude * Math.PI / 180;
      const delta = (next.longitude - position.longitude) * Math.PI / 180;
      const bearing = (Math.atan2(Math.sin(delta) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(delta)) * 180 / Math.PI + 360) % 360;
      assert.ok(Math.abs(((bearing - heading + 540) % 360) - 180) < 1e-7);
      assert.ok(next.longitude >= -180 && next.longitude <= 180);
    }
  }
});
