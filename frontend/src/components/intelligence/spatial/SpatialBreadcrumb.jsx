import React from "react";

export default function SpatialBreadcrumb({ items = [], onNavigate }) {
  return (
    <nav aria-label="Spatial context breadcrumb">
      <ol className="op-spatial-breadcrumb">
        {items.map((item, index) => (
          <li key={item.id || item.label} className="op-spatial-breadcrumb-item">
            <button
              type="button"
              className="op-btn op-btn-quiet"
              onClick={() => onNavigate?.(item, index)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
