import React from "react";

export default function SpatialEntity({
  entity,
  selected,
  focused,
  onSelect,
  onFocus,
  onHover,
  onInspect,
  expanded,
  onExpand,
  onCollapse,
}) {
  return (
    <article
      className={[
        "op-spatial-entity",
        selected ? "op-spatial-entity-selected op-motion-focus" : "",
        focused ? "op-spatial-entity-focused" : "",
      ].join(" ").trim()}
      tabIndex={0}
      aria-label={`${entity.type || "entity"} ${entity.label}`}
      onMouseEnter={() => onHover?.(entity.id)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(entity.id)}
      onBlur={() => onHover?.(null)}
    >
      <header className="op-row" style={{ marginBottom: "var(--op-space-2)" }}>
        <p className="op-kicker">{entity.type || "entity"}</p>
        <span className="op-badge">{entity.availability || "available"}</span>
      </header>
      <h4 className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>{entity.label}</h4>
      <div className="op-row" style={{ justifyContent: "flex-start", gap: "var(--op-space-2)", flexWrap: "wrap" }}>
        <button type="button" className="op-btn op-btn-secondary" onClick={() => onSelect?.(entity)}>
          Select
        </button>
        <button type="button" className="op-btn op-btn-secondary" onClick={() => onFocus?.(entity)}>
          Focus
        </button>
        <button type="button" className="op-btn op-btn-secondary" onClick={() => onInspect?.(entity)}>
          Inspect
        </button>
        <button
          type="button"
          className="op-btn op-btn-quiet"
          onClick={() => (expanded ? onCollapse?.(entity.id) : onExpand?.(entity.id))}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
    </article>
  );
}
