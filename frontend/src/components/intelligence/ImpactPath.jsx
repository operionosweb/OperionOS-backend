import React from "react";

export default function ImpactPath({ steps = [] }) {
  return (
    <div className="op-surface" style={{ padding: "var(--op-space-4)" }}>
      <p className="op-kicker">Impact path</p>
      {!steps.length ? (
        <p className="op-body-sm">No causal chain endpoint connected yet.</p>
      ) : (
        <ol style={{ margin: 0, paddingLeft: "1.15rem", display: "grid", gap: "var(--op-space-2)" }}>
          {steps.map((step) => (
            <li key={step.id} className="op-body-sm">{step.label}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
