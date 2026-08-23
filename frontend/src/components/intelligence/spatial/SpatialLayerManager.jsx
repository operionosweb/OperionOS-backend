import React from "react";
import { useSpatialInteractionBus } from "./SpatialInteractionBus";

export default function SpatialLayerManager({ layers = [] }) {
  const { state, setActiveLayer, toggleLayerVisibility } = useSpatialInteractionBus();

  return (
    <div className="op-stack" aria-label="Spatial layers">
      <p className="op-kicker">Spatial layers</p>
      <div style={{ display: "grid", gap: "var(--op-space-2)" }}>
        {layers.map((layer) => (
          <div key={layer.id} className="op-row" style={{ gap: "var(--op-space-2)" }}>
            <button
              type="button"
              className={`op-btn ${state.activeLayerId === layer.id ? "op-btn-primary" : "op-btn-secondary"}`}
              onClick={() => setActiveLayer(layer.id)}
              style={{ justifyContent: "flex-start", flex: 1 }}
              aria-pressed={state.activeLayerId === layer.id}
            >
              {layer.label}
            </button>
            <button
              type="button"
              className="op-btn op-btn-quiet"
              onClick={() => toggleLayerVisibility(layer.id)}
              aria-label={`${state.hiddenLayerIds.includes(layer.id) ? "Show" : "Hide"} ${layer.label}`}
            >
              {state.hiddenLayerIds.includes(layer.id) ? "Show" : "Hide"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
