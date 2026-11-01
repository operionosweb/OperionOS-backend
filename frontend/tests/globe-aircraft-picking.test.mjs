import assert from "node:assert/strict";
import { test } from "node:test";
import Cartesian3 from "@cesium/engine/Source/Core/Cartesian3.js";
import Ellipsoid from "@cesium/engine/Source/Core/Ellipsoid.js";
import { pickGlobeAircraft } from "../src/components/aviation/pickGlobeAircraft.js";

const property = (value) => ({ getValue: () => value });
function fixture() {
  const entities = [];
  const primitives = [];
  const viewer = {
    entities: { values: entities },
    clock: { currentTime: 0 },
    canvas: { clientWidth: 800 },
    camera: { positionWC: Cartesian3.fromDegrees(0, 0, 10000000), getPixelSize: () => 1000 },
    scene: {
      mode: 3, globe: { ellipsoid: Ellipsoid.WGS84 },
      drawingBufferWidth: 1600, drawingBufferHeight: 1200,
      primitives: { get length() { return primitives.length; }, get: (index) => primitives[index] },
      cartesianToCanvasCoordinates: () => ({ x: 400, y: 300 }),
      pick: () => { throw new Error("Aircraft selection must not read GPU pixels"); },
    },
  };
  function add(id, { visible = true, ready = true, longitude = 0, altitude = 10000, model = true, radius = 1000 } = {}) {
    const world = Cartesian3.fromDegrees(longitude, 0, altitude);
    const entity = { id: `aircraft-${id}`, isShowing: visible, position: property(world),
      ...(model ? { model: { minimumPixelSize: property(44) } } : { point: { pixelSize: property(11) } }) };
    entities.push(entity);
    if (model) primitives.push({ id: entity, ready, boundingSphere: { center: world, radius } });
  }
  return { viewer, add };
}

test("aircraft models and production points are selected without a GPU pick", () => {
  for (const model of [true, false]) {
    const { viewer, add } = fixture();
    add("plane", { model });
    assert.equal(pickGlobeAircraft(viewer, { x: 400, y: 300 }), "plane");
    assert.equal(pickGlobeAircraft(viewer, { x: 500, y: 300 }), undefined);
  }
});

test("hidden, unloaded, occluded and morphing aircraft are not selectable", () => {
  for (const options of [{ visible: false }, { ready: false }, { longitude: 180 }]) {
    const { viewer, add } = fixture();
    add("plane", options);
    assert.equal(pickGlobeAircraft(viewer, { x: 400, y: 300 }), undefined);
  }
  const { viewer, add } = fixture();
  add("plane");
  viewer.scene.mode = 0;
  assert.equal(pickGlobeAircraft(viewer, { x: 400, y: 300 }), undefined);
});

test("overlapping aircraft select the nearest visible plane and respect rendered size and pixel ratio", () => {
  const { viewer, add } = fixture();
  add("farther");
  add("nearer", { altitude: 100000, radius: 200000 });
  assert.equal(pickGlobeAircraft(viewer, { x: 400, y: 300 }), "nearer");
  assert.equal(pickGlobeAircraft(viewer, { x: 490, y: 300 }), "nearer");
  assert.equal(pickGlobeAircraft(viewer, { x: 510, y: 300 }), undefined);
  viewer.scene.mode = 2;
  assert.equal(pickGlobeAircraft(viewer, { x: 400, y: 300 }), "nearer");
});
