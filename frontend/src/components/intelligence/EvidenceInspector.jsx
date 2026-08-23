import React from "react";

export default function EvidenceInspector({ items = [] }) {
  return (
    <div className="op-surface" style={{ padding: "var(--op-space-4)" }}>
      <p className="op-kicker">Evidence inspector</p>
      {!items.length ? (
        <p className="op-body-sm">
          No evidence read endpoint is connected yet. When available, this panel
          will show source excerpts, locators, confidence, and linked entities.
        </p>
      ) : (
        <div className="op-stack" style={{ gap: "var(--op-space-2)" }}>
          {items.map((item) => (
            <div key={item.id} className="op-surface-raised" style={{ padding: "var(--op-space-3)" }}>
              <p className="op-body-sm" style={{ fontFamily: "var(--op-font-evidence)" }}>{item.excerpt}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
