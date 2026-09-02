import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { LoadingState } from "../ui/States";

export default function RequireAuth({ children }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth?.loading) return <div style={{ padding: 32 }}><LoadingState label="Restoring your secure session…" /></div>;

  if (!auth?.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
