import buildModuleUrl from "@cesium/engine/Source/Core/buildModuleUrl.js";
import GeographicTilingScheme from "@cesium/engine/Source/Core/GeographicTilingScheme.js";
import Color from "@cesium/engine/Source/Core/Color.js";
import UrlTemplateImageryProvider from "@cesium/engine/Source/Scene/UrlTemplateImageryProvider.js";
import { getAviationMapStyle } from "../../demo/aviationMapLayers.js";
import { synchronizeGlobeSolarTime } from "./globeSolar.js";

export function attachGlobeImagery(viewer, { mapStyle = "standard", viewMode = "globe", onError }) {
  const layers = [], listeners = [];
  synchronizeGlobeSolarTime(viewer);
  viewer.scene.globe.baseColor = Color.fromCssColorString("#164469");
  viewer.scene.backgroundColor = Color.fromCssColorString("#071a2d");
  viewer.scene.skyBox.show = false;
  function add(provider, message) {
    layers.push(viewer.imageryLayers.addImageryProvider(provider, layers.length));
    listeners.push(provider.errorEvent.addEventListener((error) => {
      console.error(message, error);
      onError(message);
    }));
  }
  // Cesium's bundled geodetic tiles use a south-origin TMS row, unlike web maps.
  add(new UrlTemplateImageryProvider({
    url: buildModuleUrl("Assets/Textures/NaturalEarthII/{z}/{x}/{reverseY}.jpg"),
    tilingScheme: new GeographicTilingScheme(),
    maximumLevel: 2, credit: "Natural Earth",
  }), "The bundled Earth imagery could not load. Reload the page to restore the globe.");
  if (viewMode === "map" || mapStyle !== "standard") {
    const style = getAviationMapStyle(mapStyle);
    add(new UrlTemplateImageryProvider({ url: style.url, credit: style.credit, maximumLevel: style.maximumLevel }),
      "Detailed map imagery is unavailable. The geographic Earth base remains visible.");
  }
  viewer.scene.requestRender();
  return () => {
    listeners.forEach((remove) => remove());
    if (!viewer.isDestroyed()) layers.forEach((layer) => viewer.imageryLayers.remove(layer, true));
  };
}
