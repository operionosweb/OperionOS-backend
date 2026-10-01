import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { apiRequest } from "../lib/apiClient";
import { hasOrganizationPermission } from "../lib/permissions";

const STORAGE_KEY = "operion.organizationId";

/**
 * Organization/tenant context foundation. Holds the currently selected
 * organization id so the API client and future screens can scope requests.
 * No organization-listing endpoint exists yet, so the id is entered once
 * and persisted locally — this is an explicit integration boundary, not a
 * fabricated organization list.
 */
const OrganizationContext = createContext();

export function OrganizationProvider({ children }) {
  const auth = useAuth();
  const [organizationId, setOrganizationIdState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || ""
  );
  const [organizationRole, setOrganizationRole] = useState(null);
  const [authorizationLoading, setAuthorizationLoading] = useState(false);

  useEffect(() => {
    if (organizationId) localStorage.setItem(STORAGE_KEY, organizationId);
    else localStorage.removeItem(STORAGE_KEY);
  }, [organizationId]);

  useEffect(() => {
    let active = true;
    if (!organizationId || !auth?.isAuthenticated) {
      setOrganizationRole(null);
      setAuthorizationLoading(false);
      return () => { active = false; };
    }
    setAuthorizationLoading(true);
    apiRequest("/api/foundation/context", { organizationId })
      .then((result) => active && setOrganizationRole(result?.organization?.role || null))
      .catch(() => active && setOrganizationRole(null))
      .finally(() => active && setAuthorizationLoading(false));
    return () => { active = false; };
  }, [auth?.isAuthenticated, organizationId]);

  const value = useMemo(
    () => ({
      organizationId,
      setOrganizationId: setOrganizationIdState,
      organizationRole,
      authorizationLoading,
      hasOrganizationPermission: (permission) => hasOrganizationPermission(organizationRole, permission),
    }),
    [authorizationLoading, organizationId, organizationRole]
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  return useContext(OrganizationContext);
}
