import React, { useState } from "react";

export default function EvidencePanel({ findingLabel, evidence = [] }) {
  const [open, setOpen] = useState(false);
  const sources = evidence.map((item) => item?.source || item).filter((item) => item?.excerpt);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="op-badge"
        style={{ cursor: "pointer", border: "1px solid var(--op-border-strong)" }}
        disabled={!sources.length}
      >
        {!sources.length ? "Evidence unavailable" : open ? "Hide evidence" : `View evidence (${sources.length})`}
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
          <p className="op-kicker" style={{ marginBottom: "var(--op-space-3)" }}>{findingLabel} / source evidence</p>
          {sources.map((source, index) => (
            <blockquote key={source.id || source.evidence_id || index} style={{ margin: index ? "var(--op-space-4) 0 0" : 0, paddingLeft: "var(--op-space-3)", borderLeft: "3px solid var(--op-signal-info)" }}>
              <p className="op-body-sm" style={{ marginBottom: "var(--op-space-2)" }}>{source.excerpt}</p>
              <cite className="op-body-sm" style={{ fontStyle: "normal", color: "var(--op-color-text-muted)" }}>
                {source.source_locator || (source.page_number ? `Page ${source.page_number}` : "Contract source")}
              </cite>
            </blockquote>
          ))}
        </div>
      )}
    </div>
  );
}
