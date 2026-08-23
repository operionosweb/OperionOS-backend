import React from "react";

export default function SpatialModeToggle({ mode = "standard", onChange }) {
  return (
    <div className="op-mode-toggle" role="radiogroup" aria-label="View mode">
      <button
        type="button"
        role="radio"
        aria-checked={mode === "standard"}
        className={`op-mode-option ${mode === "standard" ? "op-mode-option-active" : ""}`.trim()}
        onClick={() => onChange?.("standard")}
      >
        Standard
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === "spatial"}
        className={`op-mode-option ${mode === "spatial" ? "op-mode-option-active" : ""}`.trim()}
        onClick={() => onChange?.("spatial")}
      >
        Spatial
      </button>
    </div>
  );
}
