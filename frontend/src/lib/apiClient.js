import { supabase } from "./supabaseClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

/**
 * Single request helper: always attaches the live Supabase session token
 * and the active organization id (backend expects the `x-org-id` header â€”
 * see middleware/organizationMiddleware.js), and normalizes error handling.
 * No endpoints are invented here â€” callers pass the real path.
 */
export async function apiRequest(path, { method = "GET", body, organizationId } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  const headers = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (organizationId) headers["x-org-id"] = organizationId;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

/**
 * Multipart variant for the contract upload endpoint
 * (POST /api/contracts/upload â€” see routes/contractRoutes.js).
 */
export async function apiUpload(path, { file, fields = {}, organizationId } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (organizationId) headers["x-org-id"] = organizationId;

  const form = new FormData();
  form.append("file", file);
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, value);
  });

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: form,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(payload?.error || `Upload failed with status ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}
