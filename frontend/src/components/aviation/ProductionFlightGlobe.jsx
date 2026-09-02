import React, { useEffect, useRef } from "react";
import Cartesian2 from "@cesium/engine/Source/Core/Cartesian2.js";
import Cartesian3 from "@cesium/engine/Source/Core/Cartesian3.js";
import Color from "@cesium/engine/Source/Core/Color.js";
import HorizontalOrigin from "@cesium/engine/Source/Scene/HorizontalOrigin.js";
import LabelStyle from "@cesium/engine/Source/Scene/LabelStyle.js";
import ScreenSpaceEventType from "@cesium/engine/Source/Core/ScreenSpaceEventType.js";
import VerticalOrigin from "@cesium/engine/Source/Scene/VerticalOrigin.js";
import Viewer from "@cesium/widgets/Source/Viewer/Viewer.js";
import "cesium/Build/Cesium/Widgets/widgets.css";

function validPosition(position) {
  return Number.isFinite(position?.longitude) && Number.isFinite(position?.latitude);
}

export default function ProductionFlightGlobe({ aircraft, selectedId, onSelect }) {
  const hostRef = useRef(null);
  const viewerRef = useRef(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const viewer = new Viewer(hostRef.current, {
      animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
      homeButton: false, sceneModePicker: false, navigationHelpButton: false,
      fullscreenButton: false, infoBox: false, selectionIndicator: false,
      contextOptions: { webgl: { preserveDrawingBuffer: true } },
    });
    viewerRef.current = viewer;
    viewer.scene.globe.enableLighting = true;
    aircraft.filter((item) => validPosition(item.position)).forEach((item) => {
      viewer.entities.add({
        id: `aircraft-${item.id}`,
        position: Cartesian3.fromDegrees(item.position.longitude, item.position.latitude, item.position.altitudeMeters || 0),
        point: { pixelSize: 11, color: Color.fromCssColorString("#6848dc"), outlineColor: Color.WHITE, outlineWidth: 2 },
        label: { text: item.callsign || item.registration || "Aircraft", font: "600 13px sans-serif", fillColor: Color.WHITE, showBackground: true, backgroundColor: Color.fromCssColorString("#11182c"), backgroundPadding: new Cartesian2(7, 4), pixelOffset: new Cartesian2(0, -22), style: LabelStyle.FILL, horizontalOrigin: HorizontalOrigin.CENTER, verticalOrigin: VerticalOrigin.BOTTOM },
      });
    });
    viewer.camera.setView({ destination: Cartesian3.fromDegrees(10, 35, 14_000_000), orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 } });
    viewer.screenSpaceEventHandler.setInputAction(({ position }) => {
      const id = viewer.scene.pick(position)?.id?.id;
      if (id?.startsWith("aircraft-")) selectRef.current?.(id.slice(9));
    }, ScreenSpaceEventType.LEFT_CLICK);
    return () => { viewer.destroy(); viewerRef.current = null; };
  }, [aircraft]);

  useEffect(() => {
    const selected = aircraft.find((item) => item.id === selectedId);
    if (!viewerRef.current || !validPosition(selected?.position)) return;
    viewerRef.current.camera.flyTo({
      destination: Cartesian3.fromDegrees(selected.position.longitude, selected.position.latitude, 3_500_000),
      orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1,
    });
  }, [aircraft, selectedId]);

  return <div className="op-aviation-globe" ref={hostRef} aria-label="Interactive production aviation globe" />;
}