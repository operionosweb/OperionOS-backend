import React, { useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useOrganization } from "../../context/OrganizationContext";
import { clearMattSessions } from "./mattSessions";
import { ORGANIZATION_PERMISSIONS } from "../../lib/permissions";

export default function MattSessionBoundary({ children }) {
  const { user } = useAuth();
  const { organizationId, organizationRole, authorizationLoading, hasOrganizationPermission } = useOrganization();
  const permitted = hasOrganizationPermission(ORGANIZATION_PERMISSIONS.CONTRACT_READ);
  useEffect(() => () => clearMattSessions(), [user?.id, organizationId, organizationRole, authorizationLoading, permitted]);
  return children;
}
