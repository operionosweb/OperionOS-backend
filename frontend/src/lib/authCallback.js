const sensitiveParameters = new Set([
  'access_token', 'refresh_token', 'token_hash', 'token', 'code', 'id_token',
  'provider_token', 'provider_refresh_token', 'sb_flow_id', 'error_description',
])

const query = new URLSearchParams(window.location.search)
const fragment = new URLSearchParams(window.location.hash.slice(1))
const pendingKey = 'operion-password-recovery-pending'
let recoveryCallback = query.get('recovery') === '1' || query.get('type') === 'recovery' || fragment.get('type') === 'recovery'
  ? { query, fragment }
  : null

// Runs during client module initialization, before React, routing or analytics.
if (recoveryCallback) {
  window.sessionStorage.setItem(pendingKey, '1')
  window.history.replaceState(window.history.state, '', window.location.pathname)
} else if (window.sessionStorage.getItem(pendingKey) === '1') {
  recoveryCallback = { query: new URLSearchParams(), fragment: new URLSearchParams() }
}

export function isRecoveryRequest() {
  return recoveryCallback !== null
}

export function getRecoveryCallback() {
  return recoveryCallback
}

export function clearRecoveryCallback() {
  recoveryCallback = null
  window.sessionStorage.removeItem(pendingKey)
}

export function safeAnalyticsLocation() {
  const url = new URL(window.location.href)
  for (const key of [...url.searchParams.keys()]) {
    if (sensitiveParameters.has(key.toLowerCase())) url.searchParams.delete(key)
  }
  url.hash = ''
  return { page_location: url.toString(), page_path: `${url.pathname}${url.search}` }
}

export function hasSensitiveCallbackLocation() {
  return [new URLSearchParams(window.location.search), new URLSearchParams(window.location.hash.slice(1))]
    .some(parameters => [...parameters.keys()].some(key => sensitiveParameters.has(key.toLowerCase())))
}
