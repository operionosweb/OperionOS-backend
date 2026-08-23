import React from "react";
import { useSpatialInteractionBus } from "./SpatialInteractionBus";

export default function SpatialViewport({ title, children, className = "", style }) {
  const { state, setViewport, setContextTransition } = useSpatialInteractionBus();

  function handleKeyDown(event) {
    if (event.key === "+") {
      setViewport({ zoom: Number((state.viewport.zoom + 0.1).toFixed(2)) });
      setContextTransition("navigate");
    }
    if (event.key === "-") {
      setViewport({ zoom: Math.max(0.6, Number((state.viewport.zoom - 0.1).toFixed(2))) });
      setContextTransition("navigate");
    }
  }

  return (
    <section
      className={`op-surface-spatial ${className}`.trim()}
      style={{ padding: "var(--op-space-5)", ...style }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={title || "Spatial viewport"}
    >
      <div className="op-row" style={{ marginBottom: "var(--op-space-4)" }}>
        <h3 className="op-heading-md">{title || "Spatial viewport"}</h3>
        <div className="op-row" style={{ gap: "var(--op-space-2)", justifyContent: "flex-end" }}>
          <span className="op-badge">Mode {state.mode}</span>
          <span className="op-badge">Layer {state.activeLayerId}</span>
          <span className="op-badge">Zoom {state.viewport.zoom.toFixed(1)}x</span>
        </div>
      </div>
      {children}
    </section>
  );
}
