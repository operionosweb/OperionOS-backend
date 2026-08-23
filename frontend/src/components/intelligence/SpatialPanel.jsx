import React from "react";

export default function SpatialPanel({ title, description, children }) {
  return (
    <section className="op-surface-spatial" style={{ padding: "var(--op-space-5)" }}>
      <p className="op-kicker">Spatial intelligence</p>
      <h3 className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>
        {title}
      </h3>
      {description && (
        <p className="op-body-sm" style={{ marginBottom: "var(--op-space-4)" }}>
          {description}
        </p>
      )}
      {children}
    </section>
  );
}
