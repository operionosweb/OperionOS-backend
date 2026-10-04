import React from "react";
import { useOrganization } from "../../context/OrganizationContext";
import { ErrorState, LoadingState } from "../ui/States";

export default function OrganizationGate({ children }) {
  const {
    organizationId,
    setOrganizationId,
    organizations,
    organizationState,
    organizationError,
  } = useOrganization();

  if (organizationState === "loading" || organizationState === "idle") {
    return <LoadingState label="Loading your organization access…" />;
  }
  if (organizationState === "error") return <ErrorState message={organizationError} />;
  if (organizationId && organizations.some((organization) => organization.id === organizationId)) return children;

  if (!organizations.length) {
    return (
      <div className="op-surface" role="status" style={{ padding: "var(--op-space-6)", maxWidth: 560 }}>
        <h3 className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>Organization access required</h3>
        <p className="op-body">
          Your account does not have an active Operion organization membership. Ask your pilot administrator to confirm your access.
        </p>
      </div>
    );
  }

  return (
    <div className="op-surface" style={{ padding: "var(--op-space-6)", maxWidth: 480 }}>
      <h3 className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>
        Choose your organization
      </h3>
      <p className="op-body" style={{ marginBottom: "var(--op-space-4)" }}>
        Your account belongs to more than one organization. Select the workspace you want to open.
      </p>
      <div className="op-stack" style={{ gap: "var(--op-space-2)" }}>
        {organizations.map((organization) => (
          <button
            key={organization.id}
            type="button"
            className="op-btn op-btn-secondary"
            onClick={() => setOrganizationId(organization.id)}
          >
            {organization.name}
          </button>
        ))}
      </div>
    </div>
  );
}
