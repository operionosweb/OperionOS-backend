import React from "react";

export default function ScenarioBranch({ title, branches = [] }) {
  return (
    <div className="op-surface" style={{ padding: "var(--op-space-4)" }}>
      <p className="op-kicker">Scenario branch</p>
      <h4 className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>{title}</h4>
      {!branches.length ? (
        <p className="op-body-sm">Scenario simulation is not connected yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "var(--op-space-2)" }}>
          {branches.map((branch) => (
            <div key={branch.id} className="op-surface-raised" style={{ padding: "var(--op-space-3)" }}>
              <p className="op-body-sm">{branch.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
