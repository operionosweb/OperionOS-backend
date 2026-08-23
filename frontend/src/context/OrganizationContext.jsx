import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

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
  const [organizationId, setOrganizationIdState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || ""
  );

  useEffect(() => {
    if (organizationId) localStorage.setItem(STORAGE_KEY, organizationId);
    else localStorage.removeItem(STORAGE_KEY);
  }, [organizationId]);

  const value = useMemo(
    () => ({ organizationId, setOrganizationId: setOrganizationIdState }),
    [organizationId]
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
