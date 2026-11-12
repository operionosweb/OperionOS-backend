import React, { useEffect, useRef, useState } from "react";
import Resource from "@cesium/engine/Source/Core/Resource.js";
import UrlTemplateImageryProvider from "@cesium/engine/Source/Scene/UrlTemplateImageryProvider.js";
import WebMercatorTilingScheme from "@cesium/engine/Source/Core/WebMercatorTilingScheme.js";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const LAYERS = [
  ["radar", "Radar (regional coverage)"],
  ["satellite-geocolor", "Satellite / clouds (GeoColor)"],
  ["wind-speeds", "Surface wind speed (10 m)"],
  ["admin", "Administrative boundaries"],
];

export default function WeatherMapLayers({ viewer, accessToken, organizationId, onActivityChange = () => {} }) {
  const [status, setStatus] = useState("loading");
  const [enabled, setEnabled] = useState([]);
  const [error, setError] = useState("");
  const active = useRef(new Map());
  useEffect(() => {
    onActivityChange(enabled.length > 0);
  }, [enabled, onActivityChange]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/api/weather-maps/status`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Weather map configuration could not be checked");
        const data = await response.json();
        if (typeof data.configured !== "boolean") throw new Error("Invalid weather map configuration response");
        setStatus(data.configured ? "configured" : "unavailable");
      }).catch((failure) => {
        if (controller.signal.aborted) return;
        console.warn("Xweather configuration check failed; provider layers are unavailable");
        setStatus("unavailable");
        setError("The weather service is not reachable or configured.");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return undefined;
    const layers = active.current;
    for (const [id, activeLayer] of layers) {
      if (!enabled.includes(id) || activeLayer.accessToken !== accessToken || activeLayer.organizationId !== organizationId) {
        viewer.imageryLayers.remove(activeLayer.layer, true);
        layers.delete(id);
      }
    }
    enabled.forEach((id) => {
      if (layers.has(id)) return;
      const provider = new UrlTemplateImageryProvider({
        url: new Resource({
          url: `${API_BASE}/api/weather-maps/tiles/${id}/{z}/{x}/{y}`,
          headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            ...(organizationId ? { "x-org-id": organizationId } : {}),
          },
        }),
        tilingScheme: new WebMercatorTilingScheme(),
        minimumLevel: 1,
        maximumLevel: 6,
        credit: "Weather imagery: Vaisala Xweather",
      });
      let failed = false;
      provider.errorEvent.addEventListener(() => {
        if (failed) return;
        failed = true;
        console.warn("Xweather imagery failed for layer", id);
        setError("Weather imagery failed to load. Check server credentials, subscription and request limits.");
        setEnabled((current) => current.filter((value) => value !== id));
      });
      const layer = viewer.imageryLayers.addImageryProvider(provider);
      layer.alpha = id === "satellite-geocolor" ? 0.6 : 0.75;
      layers.set(id, { layer, accessToken, organizationId });
    });
    viewer.scene.requestRender();
    return undefined;
  }, [viewer, enabled, accessToken, organizationId]);

  useEffect(() => {
    const layers = active.current;
    return () => {
      if (viewer && !viewer.isDestroyed()) {
        layers.forEach(({ layer }) => viewer.imageryLayers.remove(layer, true));
      }
      layers.clear();
    };
  }, [viewer]);

  return <details className="od-real-weather-layers">
    <summary>Xweather weather layers</summary>
    <section aria-label="Provider weather layer filters">
    <p>{status === "loading" ? "Checking server configuration..." : status === "configured"
      ? "Server credentials and explicit subscription approval are configured. Enable layers individually; tiles may count toward your subscription."
      : "Unavailable until server credentials and explicit Raster Maps subscription approval are configured."}</p>
    {enabled.length > 0 && <p role="status">Provider imagery selected; illustrative scenario weather is hidden.</p>}
    <div>{LAYERS.map(([id, label]) => <button key={id} type="button" disabled={status !== "configured" || !viewer || !accessToken || !organizationId} aria-pressed={enabled.includes(id)}
      onClick={() => { setError(""); setEnabled((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }}>{label}</button>)}</div>
    <p>Surface wind is not flight-level wind or turbulence. <a href="https://turbli.com/maps/world-wind-map/" target="_blank" rel="noopener noreferrer">Open Turbli altitude-aware wind map</a></p>
    <p>Turbli turbulence requires authorized data access. <a href="https://turbli.com/maps/interactive-turbulence-map/" target="_blank" rel="noopener noreferrer">Open Turbli turbulence map</a></p>
    {error && <p role="alert">{error}</p>}
    </section>
  </details>;
}
