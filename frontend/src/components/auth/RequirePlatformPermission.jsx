import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { LoadingState } from "../ui/States";

export default function RequirePlatformPermission({ permission, children }) {
  const auth = useAuth();
  if (auth.loading || auth.authorizationLoading) {
    return <div style={{ padding: 32 }}><LoadingState label="Verifying platform access…" /></div>;
  }
  if (!auth.isAuthenticated) return <Navigate to="/login" replace />;
  if (!auth.hasPlatformPermission(permission)) return <Navigate to="/app/dashboard" replace />;
  return children;
}