import React from "react";

export default function Timeline({ events = [] }) {
  return (
    <div className="op-surface" style={{ padding: "var(--op-space-4)" }}>
      <p className="op-kicker">Timeline</p>
      {!events.length ? (
        <p className="op-body-sm">No temporal event stream is connected yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "var(--op-space-2)" }}>
          {events.map((event) => (
            <div key={event.id} className="op-row">
              <span className="op-body-sm" style={{ fontFamily: "var(--op-font-mono)" }}>{event.time}</span>
              <span className="op-body-sm">{event.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
