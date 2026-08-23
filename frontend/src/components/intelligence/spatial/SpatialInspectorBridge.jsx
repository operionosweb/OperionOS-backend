import React from "react";
import { useSpatialInteractionBus } from "./SpatialInteractionBus";
import IntelligenceStatus from "../IntelligenceStatus";
import { INTELLIGENCE_AVAILABILITY } from "../../../lib/contractIntelligenceModel";

export default function SpatialInspectorBridge({ emptyMessage }) {
  const { state } = useSpatialInteractionBus();
  const target = state.inspectionTarget;
  const metadata = target?.metadata || {};
  const entityType = metadata.entity_type || target?.type || "entity";
  const parentRelationship = metadata.parent_relationship || "No parent relationship exposed";
  const availabilityState = metadata.availability_state || INTELLIGENCE_AVAILABILITY.AVAILABLE;

  const identityRows = Object.entries(metadata).filter(
    ([key]) => !["relationships", "available_actions", "unavailable_layers", "note", "relationship"].includes(key)
  );

  const relationships = Array.isArray(metadata.relationships)
    ? metadata.relationships
    : metadata.relationships
      ? [metadata.relationships]
      : [];

  const actions = metadata.available_actions
    ? String(metadata.available_actions).split(",").map((value) => value.trim()).filter(Boolean)
    : [];

  const unavailable = metadata.unavailable_layers
    ? String(metadata.unavailable_layers).split(",").map((value) => value.trim()).filter(Boolean)
    : [];

  if (!target) {
    return (
      <div className="op-surface-inspector op-motion-inspector" style={{ padding: "var(--op-space-5)" }}>
        <p className="op-kicker">Inspector</p>
        <p className="op-body-sm">{emptyMessage || "Select an entity to inspect details."}</p>
      </div>
    );
  }

  return (
    <div className="op-surface-inspector op-motion-inspector" style={{ padding: "var(--op-space-5)" }}>
      <p className="op-kicker">Inspector</p>
      <h4 className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>
        {target.label || target.id}
      </h4>
      <div className="op-stack" style={{ gap: "var(--op-space-3)" }}>
        <div className="op-inspector-section" style={{ borderTop: "none", paddingTop: 0 }}>
          <p className="op-kicker">Identity</p>
          <div className="op-inspector-kv">
            <span className="op-body-sm">entity_type</span>
            <span className="op-body-sm" style={{ fontFamily: "var(--op-font-evidence)" }}>
              {entityType}
            </span>
          </div>
          {!identityRows.length ? (
            <p className="op-body-sm">No identity metadata is currently exposed for this entity.</p>
          ) : (
            identityRows.map(([key, value]) => (
              <div key={key} className="op-inspector-kv">
                <span className="op-body-sm">{key}</span>
                <span className="op-body-sm" style={{ fontFamily: "var(--op-font-evidence)" }}>
                  {String(value)}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="op-inspector-section">
          <p className="op-kicker">Relationship</p>
          <p className="op-body-sm">{parentRelationship}</p>
          {!relationships.length ? (
            <p className="op-body-sm">No explicit relationship data is currently available.</p>
          ) : (
            <div style={{ display: "grid", gap: "var(--op-space-1)" }}>
              {relationships.map((relationship) => (
                <span key={relationship} className="op-body-sm">{relationship}</span>
              ))}
            </div>
          )}
        </div>

        <div className="op-inspector-section">
          <p className="op-kicker">Available intelligence</p>
          <IntelligenceStatus state={availabilityState} />
          {!actions.length ? (
            <p className="op-body-sm">No direct actions are exposed for this entity in the current route.</p>
          ) : (
            <div style={{ display: "grid", gap: "var(--op-space-1)" }}>
              {actions.map((action) => (
                <span key={action} className="op-body-sm">{action}</span>
              ))}
            </div>
          )}
        </div>

        <div className="op-inspector-section">
          <p className="op-kicker">Unavailable intelligence</p>
          {!unavailable.length ? (
            <p className="op-body-sm">No unavailable intelligence layers are reported for this entity.</p>
          ) : (
            <div style={{ display: "grid", gap: "var(--op-space-1)" }}>
              {unavailable.map((capability) => (
                <span key={capability} className="op-body-sm">{capability}</span>
              ))}
            </div>
          )}
        </div>

        <div className="op-inspector-section">
          <p className="op-kicker">Actions</p>
          <p className="op-body-sm">
            Use Select, Focus, or Inspect in the active workspace plane to change context.
          </p>
        </div>

        {metadata.note && (
          <div className="op-inspector-note">
            <p className="op-body-sm">{metadata.note}</p>
          </div>
        )}
      </div>
    </div>
  );
}
