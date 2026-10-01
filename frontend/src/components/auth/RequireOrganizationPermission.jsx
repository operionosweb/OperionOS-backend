import React from "react";
import { Navigate } from "react-router-dom";
import { useOrganization } from "../../context/OrganizationContext";
import { LoadingState } from "../ui/States";

export default function RequireOrganizationPermission({ permission, children }) {
  const authorization = useOrganization();
  if (!authorization.organizationId) return children;
  if (authorization.authorizationLoading) {
    return <div style={{ padding: 32 }}><LoadingState label="Verifying organisation access…" /></div>;
  }
  if (!authorization.hasOrganizationPermission(permission)) {
    return <Navigate to="/app/contracts" replace />;
  }
  return children;
}