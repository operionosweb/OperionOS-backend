import React from "react";

export default function SpatialConnection({ from, to, relation, unavailable = false }) {
  return (
    <div className={`op-spatial-connection ${unavailable ? "op-spatial-connection-unavailable" : ""}`.trim()}>
      <span className="op-body-sm" style={{ fontFamily: "var(--op-font-mono)" }}>{from}</span>
      <span aria-hidden="true" className="op-spatial-connection-arrow">→</span>
      <span className="op-body-sm" style={{ fontFamily: "var(--op-font-mono)" }}>{to}</span>
      <span className="op-badge" style={{ marginLeft: "var(--op-space-2)" }}>{relation}</span>
    </div>
  );
}
