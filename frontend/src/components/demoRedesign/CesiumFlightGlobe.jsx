import React, { useEffect, useRef } from "react";
import Cartesian2 from "@cesium/engine/Source/Core/Cartesian2.js";
import Cartesian3 from "@cesium/engine/Source/Core/Cartesian3.js";
import Color from "@cesium/engine/Source/Core/Color.js";
import DistanceDisplayCondition from "@cesium/engine/Source/Core/DistanceDisplayCondition.js";
import ContextLimits from "@cesium/engine/Source/Renderer/ContextLimits.js";
import Material from "@cesium/engine/Source/Scene/Material.js";
import PolylineCollection from "@cesium/engine/Source/Scene/PolylineCollection.js";
import ScreenSpaceEventType from "@cesium/engine/Source/Core/ScreenSpaceEventType.js";
import UrlTemplateImageryProvider from "@cesium/engine/Source/Scene/UrlTemplateImageryProvider.js";
import HeightReference from "@cesium/engine/Source/Scene/HeightReference.js";
import HorizontalOrigin from "@cesium/engine/Source/Scene/HorizontalOrigin.js";
import LabelStyle from "@cesium/engine/Source/Scene/LabelStyle.js";
import NearFarScalar from "@cesium/engine/Source/Core/NearFarScalar.js";
import VerticalOrigin from "@cesium/engine/Source/Scene/VerticalOrigin.js";
import Viewer from "@cesium/widgets/Source/Viewer/Viewer.js";
import "cesium/Build/Cesium/Widgets/widgets.css";

const airports = {
  LHR: [-0.4543, 51.47], DXB: [55.3644, 25.2532], FRA: [8.5706, 50.0333],
  JFK: [-73.7781, 40.6413], CDG: [2.55, 49.0097], MAN: [-2.275, 53.3537],
};

export default function CesiumFlightGlobe({ aircraft, selectedId, onSelect }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const setup = (stage, operation) => {
      try { return operation(); }
      catch (error) { console.error(`Cesium setup failed at ${stage}`, error); throw error; }
    };
    const viewer = setup("viewer", () => new Viewer(containerRef.current, {
      animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
      homeButton: false, sceneModePicker: false, navigationHelpButton: false,
      fullscreenButton: false, infoBox: false, selectionIndicator: false,
      shouldAnimate: true, baseLayer: false,
      contextOptions: { webgl: { preserveDrawingBuffer: true } },
    }));
    viewerRef.current = viewer;
    setup("scene", () => {
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.globe.baseColor = Color.fromCssColorString("#08182f");
    viewer.scene.backgroundColor = Color.fromCssColorString("#030815");
    viewer.scene.skyBox.show = true;
    viewer.scene.fog.enabled = true;
    });
    const imagery = new UrlTemplateImageryProvider({
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      credit: "OpenStreetMap contributors",
      maximumLevel: 18,
    });
    setup("imagery", () => viewer.imageryLayers.addImageryProvider(imagery));
    const supportsPolylines = ContextLimits.maximumVertexTextureImageUnits > 0;
    const routes = supportsPolylines ? setup("route collection", () => viewer.scene.primitives.add(new PolylineCollection())) : null;

    aircraft.forEach((item) => {
      const color = item.company ? Color.fromCssColorString("#8a63ff") : Color.fromCssColorString("#d9e2f4");
      setup(`aircraft ${item.id}`, () => viewer.entities.add({
        id: `aircraft-${item.id}`,
        position: Cartesian3.fromDegrees(item.longitude, item.latitude, item.altitude),
        point: { pixelSize: item.company ? 13 : 8, color, outlineColor: Color.WHITE, outlineWidth: 2, heightReference: HeightReference.NONE, scaleByDistance: new NearFarScalar(1.5e6, 1.3, 1.2e7, 0.6) },
        label: { text: item.callsign, font: "600 13px sans-serif", fillColor: Color.WHITE, showBackground: true, backgroundColor: Color.fromCssColorString("#11182cdd"), backgroundPadding: new Cartesian2(8,5), pixelOffset: new Cartesian2(0,-24), style: LabelStyle.FILL, horizontalOrigin: HorizontalOrigin.CENTER, verticalOrigin: VerticalOrigin.BOTTOM, distanceDisplayCondition: new DistanceDisplayCondition(0, 8e6) },
      }));
      const origin = airports[item.origin];
      const destination = airports[item.destination];
      if (routes && origin && destination) setup(`route ${item.id}`, () => routes.add({
        id: `route-${item.id}`,
        positions: [Cartesian3.fromDegrees(origin[0],origin[1],12000),Cartesian3.fromDegrees(item.longitude,item.latitude,item.altitude),Cartesian3.fromDegrees(destination[0],destination[1],12000)],
        width: item.company ? 2.5 : 1,
        material: Material.fromType(Material.ColorType, { color: item.company ? Color.fromCssColorString("#9878ff").withAlpha(0.8) : Color.fromCssColorString("#77a7d9").withAlpha(0.34) }),
      }));
    });

    setup("camera", () => viewer.camera.setView({ destination: Cartesian3.fromDegrees(18, 42, 10500000) }));
    viewer.screenSpaceEventHandler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.position);
      const entityId = picked?.id?.id;
      if (entityId?.startsWith("aircraft-")) onSelectRef.current?.(entityId.replace("aircraft-", ""));
    }, ScreenSpaceEventType.LEFT_CLICK);

    let timer;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timer = window.setInterval(() => {
        aircraft.forEach((item) => {
          const entity = viewer.entities.getById(`aircraft-${item.id}`);
          if (!entity) return;
          const radians = item.heading * Math.PI / 180;
          item.longitude += Math.sin(radians) * 0.008;
          item.latitude += Math.cos(radians) * 0.004;
          entity.position = Cartesian3.fromDegrees(item.longitude, item.latitude, item.altitude);
        });
      }, 1800);
    }
    return () => { if (timer) window.clearInterval(timer); viewer.destroy(); viewerRef.current = null; };
  }, [aircraft]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const selected = aircraft.find((item) => item.id === selectedId);
    if (!viewer || !selected) return;
    aircraft.forEach((item) => {
      const point = viewer.entities.getById(`aircraft-${item.id}`)?.point;
      if (point) point.pixelSize = item.id === selectedId ? 18 : item.company ? 13 : 8;
    });
    viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(selected.longitude, selected.latitude, 8500000), orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 }, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1.1 });
  }, [aircraft, selectedId]);

  return <div className="od-cesium-globe" ref={containerRef} aria-label="Interactive three-dimensional demonstration flight globe" />;
}
