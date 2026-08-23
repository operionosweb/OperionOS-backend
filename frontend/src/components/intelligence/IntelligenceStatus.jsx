import React from "react";
import { INTELLIGENCE_AVAILABILITY } from "../../lib/contractIntelligenceModel";

const LABELS = {
  [INTELLIGENCE_AVAILABILITY.AVAILABLE]: "Available",
  [INTELLIGENCE_AVAILABILITY.UNAVAILABLE]: "Unavailable",
  [INTELLIGENCE_AVAILABILITY.PENDING]: "Pending",
  [INTELLIGENCE_AVAILABILITY.EMPTY]: "Empty",
};

const CLASS_MAP = {
  [INTELLIGENCE_AVAILABILITY.AVAILABLE]: "op-badge op-badge-live",
  [INTELLIGENCE_AVAILABILITY.UNAVAILABLE]: "op-badge op-badge-unavailable",
  [INTELLIGENCE_AVAILABILITY.PENDING]: "op-badge op-badge-pending",
  [INTELLIGENCE_AVAILABILITY.EMPTY]: "op-badge op-badge-empty",
};

export default function IntelligenceStatus({ state, note }) {
  const label = LABELS[state] || "Unknown";
  const className = CLASS_MAP[state] || "op-badge";

  return (
    <div className="op-stack" style={{ gap: "var(--op-space-1)" }}>
      <span className={className}>{label}</span>
      {note ? <p className="op-body-sm">{note}</p> : null}
    </div>
  );
}
