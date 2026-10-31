import { createClient } from '@supabase/supabase-js'
import '../lib/authCallback.js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim()
const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
const validEndpoint = (value) => {
  try {
    const endpoint = new URL(value)
    return !endpoint.username && !endpoint.password && ['https:', ...(loopback ? ['http:'] : [])].includes(endpoint.protocol)
  } catch { return false }
}
export const configurationError = !loopback && window.location.hostname !== 'oci.operionos.com'
  ? 'This private workspace is available only at oci.operionos.com.'
  : !url || !key
  ? 'OCI authentication is not configured. Contact the platform administrator.'
  : !validEndpoint(url)
    ? 'OCI authentication endpoint is invalid. Contact the platform administrator.'
  : !configuredBase && !loopback
    ? 'VITE_API_BASE_URL is required for this OCI deployment.'
    : configuredBase && !validEndpoint(configuredBase)
      ? 'OCI requires an HTTPS API endpoint.'
      : null

export const supabase = configurationError ? null : createClient(url, key, {
  auth: {
    storageKey: 'operion-oci-auth',
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
})

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  if (configurationError) throw new Error(configurationError)
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!data.session?.access_token) throw new ApiError('Your session has expired. Sign in again.', 401)
  const response = await fetch(`${(configuredBase || '').replace(/\/$/, '')}/api/oci${path}`, {
    method,
    signal,
    cache: 'no-store',
    credentials: 'omit',
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || result.success !== true) {
    const detail = typeof result.error === 'string' ? result.error : result.error?.message
    throw new ApiError(detail || result.message || `Request failed (${response.status}).`, response.status,
      result.code || result.error?.code || (detail === 'OCI_MFA_REQUIRED' ? detail : undefined))
  }
  return result
}
