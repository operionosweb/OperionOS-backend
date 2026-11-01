import test from "node:test";
import assert from "node:assert/strict";
import buildModuleUrl from "@cesium/engine/Source/Core/buildModuleUrl.js";
import { attachGlobeImagery } from "../src/components/aviation/globeImagery.js";

buildModuleUrl.setBaseUrl("http://127.0.0.1/cesium/");
function fixture() {
  const providers = [], removed = [], errors = [], stack = ["existing-weather-overlay"];
  const viewer = {
    scene: { globe: {}, skyBox: {}, requestRender() {} }, clock: {}, isDestroyed: () => false,
    imageryLayers: {
      addImageryProvider(provider, index) { providers.push(provider); stack.splice(index, 0, provider); return provider; },
      remove(layer) { removed.push(layer); stack.splice(stack.indexOf(layer), 1); },
    },
  };
  return { viewer, providers, removed, errors, stack };
}
test("standard 3D globe uses bundled geographic Earth without any external provider", () => {
  const f = fixture();
  const cleanup = attachGlobeImagery(f.viewer, { onError: (error) => f.errors.push(error) });
  const earth = f.providers[0];
  try {
  assert.equal(f.providers.length, 1);
  assert.equal(f.viewer.scene.globe.enableLighting, true);
  assert.equal(f.viewer.scene.globe.showGroundAtmosphere, true);
  assert.equal(f.viewer.clock.shouldAnimate, false, "Solar time is synchronized without a continuous simulation render loop");
  assert.match(earth.url, /^http:\/\/127\.0\.0\.1\/cesium\/Assets\/Textures\/NaturalEarthII\/\{z\}\/\{x\}\/\{reverseY\}\.jpg$/);
  assert.equal(earth.maximumLevel, 2);
  assert.equal(earth.tilingScheme.getNumberOfXTilesAtLevel(0), 2);
  assert.equal(earth.tilingScheme.getNumberOfYTilesAtLevel(0), 1);
  assert.deepEqual(f.stack, [earth, "existing-weather-overlay"]);
  } finally { cleanup(); }
  assert.deepEqual(f.removed, f.providers);
  assert.deepEqual(f.stack, ["existing-weather-overlay"]);
  assert.equal(earth.errorEvent.numberOfListeners, 0);
});
test("satellite, topographic and flat-map detail layers retain Earth beneath them", () => {
  for (const options of [{ mapStyle: "satellite" }, { mapStyle: "topographic" }, { viewMode: "map" }]) {
    const f = fixture();
    const cleanup = attachGlobeImagery(f.viewer, { ...options, onError: (error) => f.errors.push(error) });
    assert.equal(f.providers.length, 2);
    assert.match(f.providers[0].url, /NaturalEarthII/);
    assert.match(f.providers[1].url, /^https:/);
    assert.equal(f.providers[1].errorEvent.numberOfListeners, 1);
    assert.deepEqual(f.stack, [...f.providers, "existing-weather-overlay"], "Weather overlays stay above base/detail imagery on style changes");
    cleanup();
    assert.deepEqual(f.removed, f.providers);
    assert.deepEqual(f.stack, ["existing-weather-overlay"]);
    assert.ok(f.providers.every((provider) => provider.errorEvent.numberOfListeners === 0));
  }
});
test("imagery cleanup remains safe when the viewer was destroyed first", () => {
  const f = fixture();
  const cleanup = attachGlobeImagery(f.viewer, { onError: (error) => f.errors.push(error) });
  f.viewer.isDestroyed = () => true;
  cleanup();
  assert.equal(f.removed.length, 0);
  assert.equal(f.providers[0].errorEvent.numberOfListeners, 0);
});
