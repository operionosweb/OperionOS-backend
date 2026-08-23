import React from "react";

export function LoadingState({ label = "Loading…" }) {
  return (
    <div className="op-surface" role="status" style={{ padding: "var(--op-space-6)", textAlign: "center", color: "var(--op-color-text-muted)" }}>
      {label}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="op-surface" style={{ padding: "var(--op-space-7)", textAlign: "center" }}>
      <h3 className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>{title}</h3>
      {description && <p className="op-body" style={{ maxWidth: 460, margin: "0 auto var(--op-space-4)" }}>{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message = "Something went wrong." }) {
  return (
    <div
      className="op-surface"
      role="alert"
      style={{
        padding: "var(--op-space-6)",
        borderColor: "color-mix(in srgb, var(--op-color-danger) 35%, var(--op-color-border) 65%)",
        color: "var(--op-color-danger)",
      }}
    >
      {message}
    </div>
  );
}

/** Honest boundary for backend capability that does not exist yet. */
export function NotYetIntegrated({ title, note }) {
  return (
    <div className="op-surface-raised" style={{ padding: "var(--op-space-6)" }}>
      <span className="op-badge op-badge-future" style={{ marginBottom: "var(--op-space-3)" }}>
        Not yet connected
      </span>
      <h3 className="op-heading-md" style={{ margin: "var(--op-space-2) 0" }}>{title}</h3>
      <p className="op-body">{note}</p>
    </div>
  );
}
