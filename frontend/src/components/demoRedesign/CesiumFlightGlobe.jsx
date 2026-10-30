import React, { useEffect, useRef, useState } from "react";
import Cartesian2 from "@cesium/engine/Source/Core/Cartesian2.js";
import Cartesian3 from "@cesium/engine/Source/Core/Cartesian3.js";
import Color from "@cesium/engine/Source/Core/Color.js";
import ColorMaterialProperty from "@cesium/engine/Source/DataSources/ColorMaterialProperty.js";
import ColorBlendMode from "@cesium/engine/Source/Scene/ColorBlendMode.js";
import ShadowMode from "@cesium/engine/Source/Scene/ShadowMode.js";
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
import VerticalOrigin from "@cesium/engine/Source/Scene/VerticalOrigin.js";
import Viewer from "@cesium/widgets/Source/Viewer/Viewer.js";
import { LocateFixed, Maximize2, Minimize2, Minus, Plus } from "lucide-react";
import { getAviationMapStyle } from "../../demo/aviationMapLayers";
import WeatherMapLayers from "../aviation/WeatherMapLayers";
import { AIRCRAFT_MODEL_URL, AIRCRAFT_STATUS_COLORS, advanceAircraftPosition, aircraftOrientation, aircraftRoutePositions } from "../aviation/aircraftPose";
import { attachGlobeTouchControls } from "../aviation/globeTouchControls";
import "cesium/Build/Cesium/Widgets/widgets.css";

export default function CesiumFlightGlobe({ aircraft, visibleIds, selectedId, onSelect, viewMode = "globe", mapStyle = "standard", weather, weatherEnabled = false, cloudsEnabled = weatherEnabled, windEnabled = false, routesEnabled = true, playing = true, spatialObjects = [], visibleLayers = ["aircraft"], onObjectSelect, children }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const imageryLayerRef = useRef(null);
  const positionsRef = useRef(new Map());
  const routesRef = useRef(new Map());
  const onSelectRef = useRef(onSelect);
  const objectSelectRef = useRef(onObjectSelect);
  const spatialObjectsRef = useRef(spatialObjects);
  const spatialIdsRef = useRef([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [controlError, setControlError] = useState("");
  const [mapViewer, setMapViewer] = useState(null);
  const [providerWeatherActive, setProviderWeatherActive] = useState(false);
  const [modelsReady, setModelsReady] = useState(0);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  onSelectRef.current = onSelect;
  objectSelectRef.current = onObjectSelect;
  spatialObjectsRef.current = spatialObjects;

  useEffect(() => {
    if (!containerRef.current) return undefined;
    let viewer;
    let timer;
    let modelUrl;
    let disposed = false;
    const assetRequest = new AbortController();
    const modelListeners = [];
    const cleanup = () => {
      disposed = true;
      assetRequest.abort();
      if (timer) window.clearInterval(timer);
      modelListeners.forEach((remove) => remove());
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      if (modelUrl) URL.revokeObjectURL(modelUrl);
      viewerRef.current = null;
      imageryLayerRef.current = null;
      positionsRef.current.clear();
      routesRef.current.clear();
      setMapViewer(null);
    };
    try {
    const setup = (stage, operation) => {
      try { return operation(); }
      catch (error) { console.error(`Cesium setup failed at ${stage}: ${error?.message || "Unknown error"}`, error); throw error; }
    };
    viewer = setup("viewer", () => new Viewer(containerRef.current, {
      animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
      homeButton: false, sceneModePicker: false, navigationHelpButton: false,
      fullscreenButton: false, infoBox: false, selectionIndicator: false,
      shouldAnimate: false, baseLayer: false,
      requestRenderMode: true, maximumRenderTimeChange: Infinity,
      contextOptions: { webgl: { preserveDrawingBuffer: true } },
      sceneMode: viewMode === "map" ? SceneMode.SCENE2D : SceneMode.SCENE3D,
    }));
    setUnavailable(false);
    setModelsReady(0);
    setControlError("");
    viewerRef.current = viewer;
    setMapViewer(viewer);
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
    if (!supportsPolylines) setControlError("This graphics device cannot display route lines. Airport endpoints and aircraft details remain available.");
    const routes = supportsPolylines ? setup("route collection", () => viewer.scene.primitives.add(new PolylineCollection())) : null;
    const readyModels = new Set();
    modelListeners.push(viewer.scene.primitives.primitiveAdded.addEventListener((primitive) => {
      if (!primitive.id?.id?.startsWith("aircraft-") || !primitive.readyEvent) return;
      modelListeners.push(primitive.readyEvent.addEventListener(() => {
        if (disposed) return;
        readyModels.add(primitive.id.id);
        setModelsReady(readyModels.size);
        viewer.scene.requestRender();
      }));
      modelListeners.push(primitive.errorEvent.addEventListener((error) => {
        if (disposed) return;
        console.error("Aircraft 3D model rendering failed", error);
        setControlError("A 3D aircraft could not be rendered. Aircraft selection and contract details remain available through the fleet list.");
      }));
    }));

    const routeColors = ["#8b6fe8", "#35a8d4", "#36b77c", "#e19c3a", "#d85b6f", "#6d91df", "#48b4a7", "#ba70cf"];
    aircraft.forEach((item, index) => {
      positionsRef.current.set(item.id, { longitude: item.longitude, latitude: item.latitude });
      const color = Color.fromCssColorString(AIRCRAFT_STATUS_COLORS[item.status] || "#d9e2f4");
      const position = Cartesian3.fromDegrees(item.longitude, item.latitude, item.altitude);
      setup(`aircraft ${item.id}`, () => viewer.entities.add({
        id: `aircraft-${item.id}`,
        position,
        orientation: aircraftOrientation(position, item.heading),
        model: {
          scale: 8, minimumPixelSize: item.id === selectedId ? 64 : 44, maximumScale: 250000,
          color, colorBlendMode: ColorBlendMode.MIX, colorBlendAmount: 0.5,
          silhouetteColor: color, silhouetteSize: item.id === selectedId ? 2 : 1,
          imageBasedLightingFactor: new Cartesian2(1, 0.5), lightColor: Color.WHITE,
          environmentMapOptions: { enabled: false },
          shadows: ShadowMode.DISABLED, runAnimations: false, incrementallyLoadTextures: false,
        },
        label: { text: item.callsign, font: "600 13px sans-serif", fillColor: Color.WHITE, showBackground: true, backgroundColor: Color.fromCssColorString("#11182cdd"), backgroundPadding: new Cartesian2(8,5), pixelOffset: new Cartesian2(0,-40), style: LabelStyle.FILL, horizontalOrigin: HorizontalOrigin.CENTER, verticalOrigin: VerticalOrigin.BOTTOM, distanceDisplayCondition: new DistanceDisplayCondition(0, 8e6) },
      }));
      const origin = item.route?.origin ? [item.route.origin.longitude, item.route.origin.latitude] : null;
      const destination = item.route?.destination ? [item.route.destination.longitude, item.route.destination.latitude] : null;
      if (routes && origin && destination) setup(`route ${item.id}`, () => {
        const route = routes.add({
        id: `route-${item.id}`,
        positions: aircraftRoutePositions(origin, [item.longitude, item.latitude], destination),
        width: item.company ? 2.5 : 1,
        material: Material.fromType(Material.ColorType, { color: Color.fromCssColorString(routeColors[index % routeColors.length]).withAlpha(item.company ? 0.8 : 0.48) }),
        });
        routesRef.current.set(item.id, { route, origin, destination, color: routeColors[index % routeColors.length] });
        return route;
      });
      if (origin && destination) {
        for (const [kind, coordinates, code] of [["origin", origin, item.origin], ["destination", destination, item.destination]]) {
          viewer.entities.add({
            id: `route-${kind}-${item.id}`, show: routesEnabled && item.id === selectedId,
            position: Cartesian3.fromDegrees(coordinates[0], coordinates[1], 16000),
            point: { pixelSize: 8, color, outlineColor: Color.WHITE, outlineWidth: 2, heightReference: HeightReference.NONE },
            label: { text: `${kind === "origin" ? "FROM" : "TO"} ${code}`, font: "700 12px sans-serif", fillColor: Color.WHITE, showBackground: true, backgroundColor: Color.fromCssColorString("#102b43dd"), pixelOffset: new Cartesian2(0, -18), horizontalOrigin: HorizontalOrigin.CENTER, verticalOrigin: VerticalOrigin.BOTTOM },
          });
        }
      }
    });
    fetch(AIRCRAFT_MODEL_URL, { signal: assetRequest.signal }).then(async (response) => {
      if (!response.ok) throw new Error(`Aircraft asset HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength < 12 || new DataView(bytes).getUint32(0, true) !== 0x46546c67) throw new Error("Aircraft asset is not a binary glTF model");
      if (disposed) return;
      modelUrl = URL.createObjectURL(new Blob([bytes], { type: "model/gltf-binary" }));
      aircraft.forEach((item) => { viewer.entities.getById(`aircraft-${item.id}`).model.uri = modelUrl; });
      viewer.scene.requestRender();
    }).catch((error) => {
      if (assetRequest.signal.aborted) return;
      console.error("Aircraft 3D asset could not be loaded", error);
      setControlError("3D aircraft are unavailable. Select aircraft from the fleet list to inspect their details.");
    });

    (weather?.cells || []).forEach((cell) => setup(`weather ${cell.id}`, () => viewer.entities.add({
      id: `weather-${cell.id}`,
      position: Cartesian3.fromDegrees(cell.longitude, cell.latitude, 18000),
      show: cell.type === "cloud" ? cloudsEnabled : weatherEnabled,
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

    (weather?.cells || []).forEach((cell, index) => viewer.entities.add({
      id: `wind-${cell.id}`,
      position: Cartesian3.fromDegrees(cell.longitude, cell.latitude + 4, 24000),
      show: windEnabled,
      label: {
        text: `${index % 2 ? ">>>" : "<<<"}\nILLUSTRATIVE WIND`,
        font: "600 12px sans-serif",
        fillColor: Color.fromCssColorString("#80dfff"),
        showBackground: true,
        backgroundColor: Color.fromCssColorString("#07101fcc"),
      },
    }));

    setup("camera", () => viewer.camera.setView({ destination: Cartesian3.fromDegrees(18, 42, 10500000) }));
    const selectAtPosition = (position) => {
      const picked = viewer.scene.pick(position);
      const entityId = typeof picked?.id === "string" ? picked.id : picked?.id?.id;
      if (entityId?.startsWith("spatial-")) objectSelectRef.current?.(spatialObjectsRef.current.find((item) => `spatial-${item.id}` === entityId));
      if (entityId?.startsWith("aircraft-")) onSelectRef.current?.(entityId.replace("aircraft-", ""));
      if (entityId?.startsWith("route-origin-")) onSelectRef.current?.(entityId.replace("route-origin-", ""));
      else if (entityId?.startsWith("route-destination-")) onSelectRef.current?.(entityId.replace("route-destination-", ""));
      else if (entityId?.startsWith("route-")) onSelectRef.current?.(entityId.replace("route-", ""));
    };
    viewer.screenSpaceEventHandler.setInputAction((movement) => selectAtPosition(movement.position), ScreenSpaceEventType.LEFT_CLICK);
    modelListeners.push(attachGlobeTouchControls(viewer, selectAtPosition));

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timer = window.setInterval(() => {
        if (!playingRef.current || document.hidden) return;
        aircraft.forEach((item) => {
          const entity = viewer.entities.getById(`aircraft-${item.id}`);
          if (!entity) return;
          const position = positionsRef.current.get(item.id);
          if (!position || !Number.isFinite(item.heading)) return;
          Object.assign(position, advanceAircraftPosition(position, item.heading, item.speed / 3.6 * 1.8));
          const worldPosition = Cartesian3.fromDegrees(position.longitude, position.latitude, item.altitude);
          entity.position = worldPosition;
          entity.orientation = aircraftOrientation(worldPosition, item.heading);
          const routeState = routesRef.current.get(item.id);
          if (routeState) routeState.route.positions = aircraftRoutePositions(routeState.origin, [position.longitude, position.latitude], routeState.destination);
        });
        viewer.scene.requestRender();
      }, 1800);
    }
    return cleanup;
    } catch (error) {
      console.error("Flight globe initialization failed; aircraft details remain available", error);
      cleanup();
      setUnavailable(true);
      return undefined;
    }
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
      const workspace = containerRef.current?.closest(".od-dashboard-globe-panel");
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
      if (entity) entity.show = !providerWeatherActive && (cell.type === "cloud" ? cloudsEnabled : weatherEnabled);
      const wind = viewer.entities.getById(`wind-${cell.id}`);
      if (wind) wind.show = !providerWeatherActive && windEnabled;
    });
    const visible = visibleIds ? new Set(visibleIds) : null;
    aircraft.forEach((item) => {
      const shown = !visible || visible.has(item.id);
      const entity = viewer.entities.getById(`aircraft-${item.id}`);
      if (entity) entity.show = shown && visibleLayers.includes("aircraft");
      const route = routesRef.current.get(item.id)?.route;
      if (route) route.show = routesEnabled && shown;
      for (const kind of ["origin", "destination"]) {
        const endpoint = viewer.entities.getById(`route-${kind}-${item.id}`);
        if (endpoint) endpoint.show = routesEnabled && shown && item.id === selectedId;
      }
    });
    viewer.scene.requestRender();
  }, [aircraft, visibleIds, weather, weatherEnabled, cloudsEnabled, windEnabled, routesEnabled, providerWeatherActive, visibleLayers, selectedId]);

  useEffect(() => {
    if (!mapViewer || mapViewer.isDestroyed()) return;
    spatialIdsRef.current.forEach((id) => mapViewer.entities.removeById(id));
    spatialIdsRef.current = [];
    const colors = { airports: "#16bcd2", assets: "#267cf5", risks: "#e5a528", exposure: "#ad79ed" };
    spatialObjects.filter((item) => visibleLayers.includes(item.layer)).forEach((item) => {
      const id = `spatial-${item.id}`;
      mapViewer.entities.add({
        id,
        position: Cartesian3.fromDegrees(item.longitude, item.latitude, item.layer === "airports" ? 0 : 40000),
        point: { pixelSize: item.layer === "airports" ? 10 : 14, color: Color.fromCssColorString(colors[item.layer]), outlineColor: Color.WHITE, outlineWidth: 2 },
        label: { text: item.title, font: "600 12px sans-serif", fillColor: Color.WHITE, showBackground: true, backgroundColor: Color.fromCssColorString("#102b43dd"), pixelOffset: new Cartesian2(0, -22), distanceDisplayCondition: new DistanceDisplayCondition(0, 7e6) },
      });
      spatialIdsRef.current.push(id);
    });
    mapViewer.scene.requestRender();
  }, [mapViewer, spatialObjects, visibleLayers]);

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
      const model = viewer.entities.getById(`aircraft-${item.id}`)?.model;
      if (model) { model.minimumPixelSize = item.id === selectedId ? 64 : 44; model.silhouetteSize = item.id === selectedId ? 2 : 1; }
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
    const workspace = containerRef.current?.closest(".od-dashboard-globe-panel");
    if (!workspace) return;
    try {
      setControlError("");
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (workspace.requestFullscreen) await workspace.requestFullscreen();
      else throw new Error("Fullscreen is unavailable in this browser.");
    } catch (error) {
      console.error("Unable to change map fullscreen state", error);
      setControlError("Fullscreen is unavailable. The globe controls remain usable in this view.");
    }
  }

  return <div className="od-weather-map-frame"><WeatherMapLayers viewer={mapViewer} onActivityChange={setProviderWeatherActive}/><div className="od-cesium-shell">
    <div className="od-cesium-globe" ref={containerRef} aria-label={`Interactive demonstration flight ${viewMode}`} data-aircraft-models-ready={modelsReady}/>
    {unavailable ? <div className="od-globe-unavailable" role="status"><strong>3D globe unavailable</strong><p>WebGL could not initialize. Select aircraft from the fleet list to inspect their infocards and contract links.</p></div> :
      <div className="od-map-controls" aria-label="Map controls"><button type="button" onClick={() => zoom(1)} aria-label="Zoom in" title="Zoom in"><Plus size={15}/></button><button type="button" onClick={() => zoom(-1)} aria-label="Zoom out" title="Zoom out"><Minus size={15}/></button><button type="button" onClick={resetView} aria-label="Reset view" title="Reset view"><LocateFixed size={15}/></button><button type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit full screen" : "Full screen"} title={isFullscreen ? "Exit full screen" : "Full screen"}>{isFullscreen ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}</button></div>}
    {controlError && <p className="od-globe-control-error" role="alert">{controlError}</p>}
    {children}
  </div></div>;
}
