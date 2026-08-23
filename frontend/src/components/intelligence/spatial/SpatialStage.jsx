import React from "react";

export default function SpatialStage({ stages = [], activeStageId, onSelectStage }) {
  return (
    <div className="op-spatial-stage" role="list" aria-label="Intelligence stages">
      {stages.map((stage) => {
        const active = stage.id === activeStageId;
        const unavailable = stage.availability === "unavailable";
        return (
          <button
            key={stage.id}
            type="button"
            role="listitem"
            aria-pressed={active}
            className={[
              "op-stage-chip",
              active ? "op-stage-chip-active op-motion-focus" : "",
              unavailable ? "op-stage-chip-unavailable" : "",
            ].join(" ").trim()}
            onClick={() => onSelectStage?.(stage)}
          >
            {stage.label}
          </button>
        );
      })}
    </div>
  );
}
