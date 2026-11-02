import React, { useEffect, useRef, useState } from 'react'
import { ShieldCheck, LogOut } from 'lucide-react'
import logo from '../assets/brand/operion-logo.webp'
import { api, configurationError, supabase } from './client.js'
import PasswordRecovery, { recoveryRequest } from '../components/auth/PasswordRecovery.jsx'

export function Brand() {
  return <div className="oci-brand"><img src={logo} alt="Operion OS" /><span>Commercial<br /><strong>Intelligence</strong></span></div>
}

export function Notice({ children, kind = 'error' }) {
  return children ? <div className={`oci-notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div> : null
}

export default function Auth({ children }) {
  const [state, setState] = useState('restoring')
  const [error, setError] = useState(configurationError || '')
  const [identity, setIdentity] = useState(null)
  const [busy, setBusy] = useState(false)
  const [factor, setFactor] = useState(null)
  const [factorLoading, setFactorLoading] = useState(true)
  const [enrollment, setEnrollment] = useState(null)
  const epoch = useRef(0)
  const [recovering, setRecovering] = useState(recoveryRequest)

  async function check() {
    const current = ++epoch.current
    setState('restoring')
    setError('')
    try {
      const session = await supabase.auth.getSession()
      if (session.error) throw session.error
      if (!session.data.session) { if (current === epoch.current) setState('login'); return }
      if (current === epoch.current) setIdentity(session.data.session.user)
      const user = await supabase.auth.getUser()
      if (user.error) throw user.error
      if (!user.data.user) throw new Error('Unable to verify your identity.')
      if (current !== epoch.current) return
      setIdentity(user.data.user)
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assurance.error) throw assurance.error
      if (assurance.data.currentLevel !== 'aal2') {
        setState('mfa')
        return
      }
      const access = await api('/access')
      if (current !== epoch.current) return
      if (access.role !== 'super_admin') throw new Error('OCI access is restricted to authorised Super Administrators.')
      if (access.mfaRequired !== true || access.mfaVerified !== true) {
        setState('mfa')
      } else {
        setIdentity(access.user)
        setState('ready')
      }
    } catch (cause) {
      if (current !== epoch.current) return
      if (cause.status === 403 && cause.code === 'OCI_MFA_REQUIRED') setState('mfa')
      else { setError(cause.message); setState(cause.status === 403 ? 'denied' : 'error') }
    }
  }

  useEffect(() => {
    if (!supabase) { setState('error'); return }
    if (recovering) return
    check()
    let refreshTimer
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') {
        // Supabase holds its auth lock in this callback; recheck outside it.
        clearTimeout(refreshTimer)
        refreshTimer = setTimeout(() => check(), 0)
      }
      if (event === 'SIGNED_OUT') {
        clearTimeout(refreshTimer)
        ++epoch.current
        setIdentity(null); setEnrollment(null); setFactor(null); setError(''); setState('login')
      }
    })
    return () => { ++epoch.current; clearTimeout(refreshTimer); data.subscription.unsubscribe() }
  }, [recovering])

  useEffect(() => {
    if (state !== 'mfa') return
    let live = true
    setFactor(null)
    setFactorLoading(true)
    supabase.auth.mfa.listFactors().then(({ data, error: cause }) => {
      if (!live) return
      setFactorLoading(false)
      if (cause) setError(cause.message)
      else setFactor(data.totp?.find((item) => item.status === 'verified') || null)
    }).catch((cause) => { if (live) { setError(cause.message); setFactorLoading(false) } })
    return () => { live = false }
  }, [state])

  async function logout() {
    setBusy(true)
    try {
      const { error: cause } = await supabase.auth.signOut({ scope: 'local' })
      if (cause) throw cause
      ++epoch.current
      setIdentity(null); setEnrollment(null); setFactor(null); setError(''); setState('login')
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  async function login(event) {
    event.preventDefault()
    setBusy(true); setError('')
    const form = new FormData(event.currentTarget)
    try {
      const result = await supabase.auth.signInWithPassword({ email: form.get('email'), password: form.get('password') })
      if (result.error) throw result.error
      await check()
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  async function enroll() {
    setBusy(true); setError('')
    try {
      const existing = await supabase.auth.mfa.listFactors()
      if (existing.error) throw existing.error
      // Remove abandoned OCI enrollments, not verified factors.
      for (const item of existing.data.totp || []) {
        if (item.status === 'unverified' && item.friendly_name === 'OCI authenticator') {
          const removed = await supabase.auth.mfa.unenroll({ factorId: item.id })
          if (removed.error) throw removed.error
        }
      }
      const result = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'OCI authenticator' })
      if (result.error) throw result.error
      setEnrollment(result.data)
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  async function verify(event) {
    event.preventDefault(); setBusy(true); setError('')
    const code = new FormData(event.currentTarget).get('code')
    try {
      const result = await supabase.auth.mfa.challengeAndVerify({ factorId: factor?.id || enrollment.id, code })
      if (result.error) throw result.error
      setEnrollment(null)
      await check()
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  if (recovering && supabase) return <div className="oci-auth"><section className="oci-auth-story"><Brand /><p>Password recovery does not grant OCI access or remove MFA.</p></section><main className="oci-auth-panel"><PasswordRecovery client={supabase} callbackPath="/" callback={recovering === true} className="oci-stack" onBack={() => { setRecovering(false); setState('login') }} /></main></div>
  if (state === 'ready') return <><Notice>{error}</Notice>{children({ identity, logout, onUnauthorized: check })}</>
  return <div className="oci-auth">
    <section className="oci-auth-story"><Brand /><div><p className="oci-eyebrow">PRIVATE OPERATING SYSTEM</p><h1>Clarity across your commercial horizon.</h1><p>One secure workspace for relationships, pipeline, discovery and revenue.</p></div><span><ShieldCheck size={18} /> Restricted platform access · Multi-factor protected</span></section>
    <main className="oci-auth-panel">
      <p className="oci-eyebrow">OPERION COMMERCIAL INTELLIGENCE</p>
      <h2>{state === 'login' ? 'Sign in to OCI' : state === 'mfa' ? 'Verify your authenticator' : state === 'restoring' ? 'Verifying secure access' : 'Access unavailable'}</h2>
      <Notice>{error}</Notice>
      {state === 'restoring' && <p role="status">Restoring your session and checking server authorization…</p>}
      {state === 'login' && <form onSubmit={login} className="oci-stack">
        <p>Use your dedicated OCI administrator account. Customer application credentials do not grant OCI access.</p>
        <label>Email<input name="email" type="email" autoComplete="username" required disabled={busy} /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required disabled={busy} /></label>
        <button className="oci-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <button type="button" disabled={busy} onClick={() => setRecovering('request')}>Forgot password?</button>
      </form>}
      {state === 'mfa' && <div className="oci-stack">
        <p>OCI requires a verified TOTP factor. Commercial data remains locked until the server verifies your session.</p>
        {factorLoading && <p role="status">Checking enrolled authenticators…</p>}
        {!factorLoading && !factor && !enrollment && error && <button onClick={check} disabled={busy}>Retry authenticator check</button>}
        {!factor && !enrollment && !factorLoading && <button onClick={enroll} disabled={busy || !!error}>Set up authenticator</button>}
        {enrollment && <><p>Add this account to your authenticator using the QR code or setup key.</p><img className="oci-qr" src={enrollment.totp.qr_code} alt="Authenticator enrollment QR code" /><label>Setup key<input readOnly value={enrollment.totp.secret} /></label></>}
        {(factor || enrollment) && <form onSubmit={verify} className="oci-stack"><label>Six-digit code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label><button className="oci-primary" disabled={busy}>{busy ? 'Verifying…' : 'Verify and continue'}</button></form>}
      </div>}
      {(state === 'denied' || state === 'error') && <p>No commercial data has been loaded. {state === 'denied' ? 'This account is not authorized for OCI.' : 'Check your connection or contact your administrator.'}</p>}
      {state === 'error' && supabase && <button onClick={check} disabled={busy}>Retry access check</button>}
      {identity && <button className="oci-logout" onClick={logout} disabled={busy}><LogOut size={16} /> Sign out</button>}
      <p className="oci-footnote">Private workspace · oci.operionos.com<br />No customer organization context or public demo access.</p>
    </main>
  </div>
}
