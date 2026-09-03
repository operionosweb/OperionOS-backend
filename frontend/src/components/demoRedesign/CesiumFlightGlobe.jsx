import React, { useEffect, useRef, useState } from "react";
import Cartesian2 from "@cesium/engine/Source/Core/Cartesian2.js";
import Cartesian3 from "@cesium/engine/Source/Core/Cartesian3.js";
import Color from "@cesium/engine/Source/Core/Color.js";
import ColorMaterialProperty from "@cesium/engine/Source/DataSources/ColorMaterialProperty.js";
import DistanceDisplayCondition from "@cesium/engine/Source/Core/DistanceDisplayCondition.js";
import ContextLimits from "@cesium/engine/Source/Renderer/ContextLimits.js";
import Material from "@cesium/engine/Source/Scene/Material.js";
import PolylineCollection from "@cesium/engine/Source/Scene/PolylineCollection.js";
import ScreenSpaceEventType from "@cesium/engine/Source/Core/ScreenSpaceEventType.js";
import SceneMode from "@cesium/engine/Source/Scene/SceneMode.js";
import UrlTemplateImageryProvider from "@cesium/engine/Source/Scene/UrlTemplateImageryProvider.js";
import HeightReference from "@cesium/engine/Source/Scene/HeightReference.js";
import HorizontalOrigin from "@cesium/engine/Source/Scene/HorizontalOrigin.js";
import LabelStyle from "@cesium/engine/Source/Scene/LabelStyle.js";
import NearFarScalar from "@cesium/engine/Source/Core/NearFarScalar.js";
import VerticalOrigin from "@cesium/engine/Source/Scene/VerticalOrigin.js";
import Viewer from "@cesium/widgets/Source/Viewer/Viewer.js";
import { LocateFixed, Maximize2, Minimize2, Minus, Plus } from "lucide-react";
import { getAviationMapStyle } from "../../demo/aviationMapLayers";
import "cesium/Build/Cesium/Widgets/widgets.css";

export default function CesiumFlightGlobe({ aircraft, selectedId, onSelect, viewMode = "globe", mapStyle = "standard", weather, weatherEnabled = false }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const imageryLayerRef = useRef(null);
  const positionsRef = useRef(new Map());
  const routesRef = useRef(new Map());
  const onSelectRef = useRef(onSelect);
  const [isFullscreen, setIsFullscreen] = useState(false);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const setup = (stage, operation) => {
      try { return operation(); }
      catch (error) { console.error(`Cesium setup failed at ${stage}: ${error?.message || "Unknown error"}`, error); throw error; }
    };
    const viewer = setup("viewer", () => new Viewer(containerRef.current, {
      animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
      homeButton: false, sceneModePicker: false, navigationHelpButton: false,
      fullscreenButton: false, infoBox: false, selectionIndicator: false,
      shouldAnimate: true, baseLayer: false,
      contextOptions: { webgl: { preserveDrawingBuffer: true } },
      sceneMode: viewMode === "map" ? SceneMode.SCENE2D : SceneMode.SCENE3D,
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
    const style = getAviationMapStyle(mapStyle);
    const imagery = new UrlTemplateImageryProvider({ url: style.url, credit: style.credit, maximumLevel: style.maximumLevel });
    imageryLayerRef.current = setup("imagery", () => viewer.imageryLayers.addImageryProvider(imagery));
    const supportsPolylines = ContextLimits.maximumVertexTextureImageUnits > 0;
    const routes = supportsPolylines ? setup("route collection", () => viewer.scene.primitives.add(new PolylineCollection())) : null;

    const routeColors = ["#8b6fe8", "#35a8d4", "#36b77c", "#e19c3a", "#d85b6f", "#6d91df", "#48b4a7", "#ba70cf"];
    const statusColors = { "On time": "#4cd18c", Delayed: "#efad43", Diverted: "#ee5a64", "Weather impact": "#9b7aef", Maintenance: "#58b6dc" };
    aircraft.forEach((item, index) => {
      positionsRef.current.set(item.id, { longitude: item.longitude, latitude: item.latitude });
      const color = Color.fromCssColorString(statusColors[item.status] || "#d9e2f4");
      setup(`aircraft ${item.id}`, () => viewer.entities.add({
        id: `aircraft-${item.id}`,
        position: Cartesian3.fromDegrees(item.longitude, item.latitude, item.altitude),
        point: { pixelSize: item.company ? 13 : 8, color, outlineColor: Color.WHITE, outlineWidth: 2, heightReference: HeightReference.NONE, scaleByDistance: new NearFarScalar(1.5e6, 1.3, 1.2e7, 0.6) },
        label: { text: item.callsign, font: "600 13px sans-serif", fillColor: Color.WHITE, showBackground: true, backgroundColor: Color.fromCssColorString("#11182cdd"), backgroundPadding: new Cartesian2(8,5), pixelOffset: new Cartesian2(0,-24), style: LabelStyle.FILL, horizontalOrigin: HorizontalOrigin.CENTER, verticalOrigin: VerticalOrigin.BOTTOM, distanceDisplayCondition: new DistanceDisplayCondition(0, 8e6) },
      }));
      const origin = item.route?.origin ? [item.route.origin.longitude, item.route.origin.latitude] : null;
      const destination = item.route?.destination ? [item.route.destination.longitude, item.route.destination.latitude] : null;
      if (routes && origin && destination) setup(`route ${item.id}`, () => {
        const route = routes.add({
        id: `route-${item.id}`,
        positions: [Cartesian3.fromDegrees(origin[0],origin[1],12000),Cartesian3.fromDegrees(item.longitude,item.latitude,item.altitude),Cartesian3.fromDegrees(destination[0],destination[1],12000)],
        width: item.company ? 2.5 : 1,
        material: Material.fromType(Material.ColorType, { color: Color.fromCssColorString(routeColors[index % routeColors.length]).withAlpha(item.company ? 0.8 : 0.48) }),
        });
        routesRef.current.set(item.id, { route, origin, destination, color: routeColors[index % routeColors.length] });
        return route;
      });
    });

    (weather?.cells || []).forEach((cell) => setup(`weather ${cell.id}`, () => viewer.entities.add({
      id: `weather-${cell.id}`,
      position: Cartesian3.fromDegrees(cell.longitude, cell.latitude, 18000),
      show: weatherEnabled,
      ellipse: {
        semiMajorAxis: cell.radius,
        semiMinorAxis: cell.radius * 0.62,
        height: 18000,
        material: new ColorMaterialProperty(Color.fromCssColorString(cell.color).withAlpha(cell.type === "cloud" ? 0.28 : 0.5)),
      },
      label: {
        text: `${cell.type.replace("-", " ").toUpperCase()} · ${cell.severity.toUpperCase()}\n${cell.movement}`,
        font: "700 10px sans-serif",
        fillColor: Color.WHITE,
        showBackground: true,
        backgroundColor: Color.fromCssColorString("#07101fcc"),
        backgroundPadding: new Cartesian2(6, 4),
        pixelOffset: new Cartesian2(0, -10),
        distanceDisplayCondition: new DistanceDisplayCondition(0, 1.8e7),
      },
    })));

    setup("camera", () => viewer.camera.setView({ destination: Cartesian3.fromDegrees(18, 42, 10500000) }));
    viewer.screenSpaceEventHandler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.position);
      const entityId = picked?.id?.id;
      if (entityId?.startsWith("aircraft-")) onSelectRef.current?.(entityId.replace("aircraft-", ""));
      if (entityId?.startsWith("route-")) onSelectRef.current?.(entityId.replace("route-", ""));
    }, ScreenSpaceEventType.LEFT_CLICK);

    let timer;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timer = window.setInterval(() => {
        aircraft.forEach((item) => {
          const entity = viewer.entities.getById(`aircraft-${item.id}`);
          if (!entity) return;
          const position = positionsRef.current.get(item.id);
          if (!position || !Number.isFinite(item.heading)) return;
          const radians = item.heading * Math.PI / 180;
          position.longitude += Math.sin(radians) * 0.008;
          position.latitude += Math.cos(radians) * 0.004;
          entity.position = Cartesian3.fromDegrees(position.longitude, position.latitude, item.altitude);
          const routeState = routesRef.current.get(item.id);
          if (routeState) routeState.route.positions = [Cartesian3.fromDegrees(routeState.origin[0],routeState.origin[1],12000),Cartesian3.fromDegrees(position.longitude,position.latitude,item.altitude),Cartesian3.fromDegrees(routeState.destination[0],routeState.destination[1],12000)];
        });
      }, 1800);
    }
    return () => { if (timer) window.clearInterval(timer); viewer.destroy(); viewerRef.current = null; imageryLayerRef.current = null; positionsRef.current.clear(); routesRef.current.clear(); };
  }, [aircraft, weather]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const style = getAviationMapStyle(mapStyle);
    const previous = imageryLayerRef.current;
    const provider = new UrlTemplateImageryProvider({ url: style.url, credit: style.credit, maximumLevel: style.maximumLevel });
    const next = viewer.imageryLayers.addImageryProvider(provider, 0);
    imageryLayerRef.current = next;
    if (previous && !previous.isDestroyed?.()) viewer.imageryLayers.remove(previous, true);
    viewer.scene.requestRender();
  }, [mapStyle]);

  useEffect(() => {
    const syncFullscreen = () => {
      const workspace = containerRef.current?.closest(".od-aviation-workspace");
      setIsFullscreen(Boolean(workspace && document.fullscreenElement === workspace));
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    syncFullscreen();
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    (weather?.cells || []).forEach((cell) => {
      const entity = viewer.entities.getById(`weather-${cell.id}`);
      if (entity) entity.show = weatherEnabled;
    });
    viewer.scene.requestRender();
  }, [weather, weatherEnabled]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (viewMode === "map") viewer.scene.morphTo2D(0.8);
    else viewer.scene.morphTo3D(0.8);
  }, [viewMode]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const selected = aircraft.find((item) => item.id === selectedId);
    if (!viewer || !selected) return;
    aircraft.forEach((item) => {
      const point = viewer.entities.getById(`aircraft-${item.id}`)?.point;
      if (point) point.pixelSize = item.id === selectedId ? 18 : item.company ? 13 : 8;
      const route = routesRef.current.get(item.id)?.route;
      if (route) {
        route.width = item.id === selectedId ? 3 : 0.75;
        route.material = Material.fromType(Material.ColorType, { color: item.id === selectedId ? Color.fromCssColorString("#f2f5ff").withAlpha(0.96) : Color.fromCssColorString(routesRef.current.get(item.id).color).withAlpha(0.32) });
      }
    });
    viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(selected.longitude, selected.latitude, 8500000), orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 }, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1.1 });
  }, [aircraft, selectedId]);

  function resetView() {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(22, 30, viewMode === "map" ? 18000000 : 14500000), duration: 0.8 });
  }

  function zoom(multiplier) {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const amount = Math.max(viewer.camera.positionCartographic.height * 0.25, 100000);
    if (multiplier > 0) viewer.camera.zoomIn(amount); else viewer.camera.zoomOut(amount);
  }

  async function toggleFullscreen() {
    const workspace = containerRef.current?.closest(".od-aviation-workspace");
    if (!workspace) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen?.();
      else await workspace.requestFullscreen?.();
    } catch (error) {
      console.error("Unable to change map fullscreen state", error);
    }
  }

  return <div className="od-cesium-shell"><div className="od-cesium-globe" ref={containerRef} aria-label={`Interactive demonstration flight ${viewMode}`}/><div className="od-map-controls" aria-label="Map controls"><button type="button" onClick={() => zoom(1)} aria-label="Zoom in" title="Zoom in"><Plus size={15}/></button><button type="button" onClick={() => zoom(-1)} aria-label="Zoom out" title="Zoom out"><Minus size={15}/></button><button type="button" onClick={resetView} aria-label="Reset view" title="Reset view"><LocateFixed size={15}/></button><button type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit full screen" : "Full screen"} title={isFullscreen ? "Exit full screen" : "Full screen"}>{isFullscreen ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}</button></div></div>;
}
