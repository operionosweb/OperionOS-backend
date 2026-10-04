import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { apiRequest } from "../lib/apiClient";
import { hasOrganizationPermission } from "../lib/permissions";

const STORAGE_KEY = "operion.organizationId";

/**
 * Organization/tenant context foundation. Resolves active memberships for the
 * authenticated user and persists a valid selection for scoped API requests.
 */
const OrganizationContext = createContext();

export function OrganizationProvider({ children }) {
  const auth = useAuth();
  const [organizationId, setOrganizationIdState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || ""
  );
  const [organizations, setOrganizations] = useState([]);
  const [organizationState, setOrganizationState] = useState("idle");
  const [organizationError, setOrganizationError] = useState("");
  const [organizationRole, setOrganizationRole] = useState(null);
  const [authorizationLoading, setAuthorizationLoading] = useState(false);

  useEffect(() => {
    if (organizationId) localStorage.setItem(STORAGE_KEY, organizationId);
    else localStorage.removeItem(STORAGE_KEY);
  }, [organizationId]);

  useEffect(() => {
    let active = true;
    if (!auth?.isAuthenticated) {
      setOrganizations([]);
      setOrganizationState("idle");
      setOrganizationError("");
      setOrganizationRole(null);
      return () => { active = false; };
    }

    setOrganizationState("loading");
    setOrganizationError("");
    apiRequest("/api/foundation/organizations")
      .then((result) => {
        if (!active) return;
        const nextOrganizations = result?.organizations || [];
        setOrganizations(nextOrganizations);
        setOrganizationIdState((current) => {
          if (nextOrganizations.some((organization) => organization.id === current)) return current;
          return nextOrganizations.length === 1 ? nextOrganizations[0].id : "";
        });
        setOrganizationState("ready");
      })
      .catch((error) => {
        if (!active) return;
        setOrganizations([]);
        setOrganizationError(error.message || "Your organizations could not be loaded.");
        setOrganizationState("error");
      });

    return () => { active = false; };
  }, [auth?.isAuthenticated]);

  useEffect(() => {
    let active = true;
    if (!organizationId || !auth?.isAuthenticated || organizationState !== "ready") {
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
  }, [auth?.isAuthenticated, organizationId, organizationState]);

  const value = useMemo(
    () => ({
      organizationId,
      setOrganizationId: setOrganizationIdState,
      organizations,
      organizationState,
      organizationError,
      organizationRole,
      authorizationLoading,
      hasOrganizationPermission: (permission) => hasOrganizationPermission(organizationRole, permission),
    }),
    [authorizationLoading, organizationError, organizationId, organizationRole, organizations, organizationState]
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
