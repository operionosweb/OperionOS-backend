import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiRequest } from "../lib/apiClient";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [platformAuthorization, setPlatformAuthorization] = useState({ roles: [], permissions: [] });
  const [authorizationLoading, setAuthorizationLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreAuthorization(nextSession) {
      if (!active) return;
      setSession(nextSession);
      setAuthorizationLoading(Boolean(nextSession));
      if (!nextSession) {
        setPlatformAuthorization({ roles: [], permissions: [] });
        setAuthorizationLoading(false);
        return;
      }
      try {
        const result = await apiRequest("/api/platform/context");
        if (active) setPlatformAuthorization({
          roles: result?.roles || [],
          permissions: result?.permissions || [],
        });
      } catch {
        if (active) setPlatformAuthorization({ roles: [], permissions: [] });
      } finally {
        if (active) setAuthorizationLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => restoreAuthorization(data?.session || null))
      .finally(() => active && setLoading(false));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      restoreAuthorization(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
  }

  const value = {
    session,
    user: session?.user || null,
    loading,
    isAuthenticated: Boolean(session),
    platformRoles: platformAuthorization.roles,
    platformPermissions: platformAuthorization.permissions,
    authorizationLoading,
    hasPlatformPermission: (permission) => platformAuthorization.permissions.includes(permission),
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
