import React from "react";

export default function EntityFocus({ title, summary, chips = [] }) {
  return (
    <div className="op-surface" style={{ padding: "var(--op-space-4)" }}>
      <p className="op-kicker">Entity focus</p>
      <h4 className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>{title}</h4>
      {summary && <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>{summary}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--op-space-2)" }}>
        {chips.map((chip) => (
          <span key={chip} className="op-badge">{chip}</span>
        ))}
      </div>
    </div>
  );
}
