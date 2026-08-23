import React from "react";

export default function SpatialFocus({ focusedLabel, contextLabel }) {
  return (
    <div className="op-surface" style={{ padding: "var(--op-space-4)" }}>
      <p className="op-kicker">Focus</p>
      <p className="op-body-sm" style={{ marginBottom: "var(--op-space-2)" }}>
        Foreground: <strong>{focusedLabel || "No entity selected"}</strong>
      </p>
      <p className="op-body-sm">
        Context: {contextLabel || "Contract intelligence topology"}
      </p>
    </div>
  );
}
