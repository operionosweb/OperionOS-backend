import React, { useState } from "react";

/**
 * Evidence is a foundation-level concept, not yet exposed by any backend
 * route (no GET endpoint for intelligence_evidence exists). This panel is
 * the UI boundary: it shows exactly what would be displayed, and is honest
 * that no live evidence can be fetched yet.
 */
export default function EvidencePanel({ findingLabel }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="op-badge"
        style={{ cursor: "pointer", border: "1px solid var(--op-border-strong)" }}
      >
        {open ? "Hide evidence" : "View evidence"}
      </button>

      {open && (
        <div
          className="op-reveal op-reveal-visible"
          style={{
            marginTop: "var(--op-space-3)",
            padding: "var(--op-space-4)",
            border: "1px solid var(--op-border)",
            borderRadius: "var(--op-radius-md)",
            background: "var(--op-surface-raised)",
          }}
        >
          <p className="op-body" style={{ marginBottom: "var(--op-space-2)" }}>
            <strong style={{ color: "var(--op-text)" }}>{findingLabel}</strong> → Evidence → Source
          </p>
          <p className="op-body">
            No evidence API is available yet — the backend has a verified
            evidence data model (source excerpt, character offsets,
            confidence, source locator), but no route currently exposes it
            to the frontend. This panel is the integration boundary for that
            endpoint once it exists.
          </p>
        </div>
      )}
    </div>
  );
}
