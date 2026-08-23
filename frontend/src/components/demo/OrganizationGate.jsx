import React from "react";
import { useOrganization } from "../../context/OrganizationContext";

/**
 * No endpoint exists to list a user's organizations yet, so the
 * organization id is entered directly. This is the integration boundary
 * documented for the future organization-selector endpoint.
 */
export default function OrganizationGate({ children }) {
  const { organizationId, setOrganizationId } = useOrganization();

  if (organizationId) return children;

  return (
    <div className="op-surface" style={{ padding: "var(--op-space-6)", maxWidth: 480 }}>
      <h3 className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>
        Set your organization
      </h3>
      <p className="op-body" style={{ marginBottom: "var(--op-space-4)" }}>
        Every request is organization-scoped. No organization directory
        endpoint exists yet, so enter your organization ID to continue.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("organizationId");
          if (value) setOrganizationId(String(value).trim());
        }}
        style={{ display: "flex", gap: "var(--op-space-2)" }}
      >
        <input
          name="organizationId"
          required
          placeholder="Organization UUID"
          style={{
            flex: 1,
            padding: "10px 14px",
            background: "transparent",
            border: "1px solid var(--op-border)",
            borderRadius: "var(--op-radius-sm)",
            color: "var(--op-text)",
          }}
        />
        <button type="submit" className="op-btn op-btn-primary">Continue</button>
      </form>
    </div>
  );
}
