import assert from "node:assert/strict";
import test from "node:test";
import ClockStep from "@cesium/engine/Source/Core/ClockStep.js";
import JulianDate from "@cesium/engine/Source/Core/JulianDate.js";
import { solarSubpointAtUtc, synchronizeGlobeSolarTime } from "../src/components/aviation/globeSolar.js";

test("solar subpoint follows UTC through equinox, solstice and day/night rotation", () => {
  const equinoxNoon = solarSubpointAtUtc("2026-03-20T12:00:00Z");
  const juneSolsticeNoon = solarSubpointAtUtc("2026-06-21T12:00:00Z");
  const decemberSolsticeNoon = solarSubpointAtUtc("2026-12-21T12:00:00Z");
  const equinoxMidnight = solarSubpointAtUtc("2026-03-20T00:00:00Z");
  assert.ok(Math.abs(equinoxNoon.latitude) < 1, `Equinox declination ${equinoxNoon.latitude}`);
  assert.ok(Math.abs(equinoxNoon.longitude) < 5, `Noon subsolar longitude ${equinoxNoon.longitude}`);
  assert.ok(Math.abs(juneSolsticeNoon.latitude - 23.44) < 0.3);
  assert.ok(Math.abs(decemberSolsticeNoon.latitude + 23.44) < 0.3);
  const longitudeShift = Math.abs(equinoxNoon.longitude - equinoxMidnight.longitude);
  assert.ok(Math.abs(longitudeShift - 180) < 5, `12-hour solar shift ${longitudeShift}`);
});

test("Cesium globe lighting is enabled and its clock is initialized to current UTC", () => {
  let renderRequests = 0;
  const viewer = {
    scene: { globe: {}, requestRender: () => { renderRequests++; } },
    clock: {},
  };
  const before = Date.now();
  assert.equal(synchronizeGlobeSolarTime(viewer), true);
  const after = Date.now();
  const clockDate = JulianDate.toDate(viewer.clock.currentTime).getTime();
  assert.ok(Math.abs(clockDate - before) <= 1000 && Math.abs(clockDate - after) <= 1000);
  assert.equal(viewer.clock.clockStep, ClockStep.SYSTEM_CLOCK_MULTIPLIER);
  assert.equal(viewer.clock.multiplier, 1);
  assert.equal(viewer.clock.shouldAnimate, false);
  assert.equal(viewer.scene.globe.enableLighting, true);
  assert.equal(viewer.scene.globe.showGroundAtmosphere, true);
  assert.equal(viewer.scene.globe.lightingFadeInDistance, 1);
  assert.equal(viewer.scene.globe.lightingFadeOutDistance, 0);
  assert.equal(viewer.scene.globe.dynamicAtmosphereLightingFromSun, true);
  assert.equal(renderRequests, 1);
  assert.equal(synchronizeGlobeSolarTime({ isDestroyed: () => true }), false);
});
