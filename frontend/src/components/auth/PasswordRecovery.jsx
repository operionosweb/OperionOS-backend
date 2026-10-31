import React, { useEffect, useRef, useState } from 'react'
import { clearRecoveryCallback, getRecoveryCallback, isRecoveryRequest } from '../../lib/authCallback.js'

export const recoveryRequest = isRecoveryRequest

export default function PasswordRecovery({ client, callbackPath, callback = false, onBack, className = '' }) {
  const [state, setState] = useState(callback ? 'verifying' : 'request')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [factor, setFactor] = useState(null)
  const started = useRef(false)

  useEffect(() => {
    if (!callback || started.current) return
    started.current = true
    const captured = getRecoveryCallback()
    async function verify() {
      try {
        if (!captured) throw new Error('A recovery callback is required.')
        const { query, fragment: hash } = captured
        if (query.has('error') || hash.has('error')) throw new Error('This recovery link is invalid or expired.')
        let result
        if (query.get('token_hash') && query.get('type') === 'recovery') {
          result = await client.auth.verifyOtp({ token_hash: query.get('token_hash'), type: 'recovery' })
        } else if (query.get('code') && query.get('recovery') === '1') {
          const flowId = query.get('sb_flow_id')
          result = await client.auth.exchangeCodeForSession(query.get('code'), flowId === null ? undefined : { flowId })
          if (!result.error && result.data?.redirectType !== 'recovery') throw new Error('A password recovery session is required.')
        } else if (hash.get('type') === 'recovery' && hash.get('access_token') && hash.get('refresh_token')) {
          result = await client.auth.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') })
        } else {
          throw new Error('This recovery link is incomplete.')
        }
        if (result.error) throw result.error
        if (!result.data?.session) throw new Error('Recovery could not establish a verified session.')
        const verified = await client.auth.getUser()
        if (verified.error) throw verified.error
        if (!verified.data?.user?.id || verified.data.user.id !== result.data.session.user?.id) throw new Error('Recovery identity could not be verified.')
        const factors = await client.auth.mfa.listFactors()
        if (factors.error) throw factors.error
        const enrolled = factors.data.totp?.find(item => item.status === 'verified')
        if (enrolled) { setFactor(enrolled); setState('mfa') } else setState('password')
      } catch {
        setError('This recovery link could not be verified. It may have expired or already been used. Request a new link.')
        setState('invalid')
      } finally { clearRecoveryCredentials() }
    }
    function clearRecoveryCredentials() {
      if (!captured) return
      for (const key of [...captured.query.keys()]) captured.query.delete(key)
      for (const key of [...captured.fragment.keys()]) captured.fragment.delete(key)
    }
    verify()
  }, [callback, client])

  async function request(event) {
    event.preventDefault(); setBusy(true); setError('')
    const email = String(new FormData(event.currentTarget).get('email')).trim()
    try {
      const redirect = new URL(callbackPath, window.location.origin)
      redirect.searchParams.set('recovery', '1')
      const result = await client.auth.resetPasswordForEmail(email, { redirectTo: redirect.toString() })
      if (result.error) throw result.error
      setState('sent')
    } catch { setError('We could not request a reset email. Please try again later.') }
    finally { setBusy(false) }
  }

  async function verifyMfa(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const result = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: new FormData(event.currentTarget).get('code') })
      if (result.error) throw result.error
      setState('password')
    } catch { setError('The authenticator code could not be verified. Try a new code.') }
    finally { setBusy(false) }
  }

  async function save(event) {
    event.preventDefault(); setError('')
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password'))
    if (password.length < 12) { setError('Use at least 12 characters for your new password.'); return }
    if (password !== form.get('confirm')) { setError('The passwords do not match.'); return }
    setBusy(true)
    try {
      const result = await client.auth.updateUser({ password })
      if (result.error) throw result.error
      setState('cleanup')
      await finish()
    } catch { setError('The password update could not complete. Use a different password or request a new recovery link.') }
    finally { setBusy(false) }
  }

  async function finish() {
    try {
      const result = await client.auth.signOut({ scope: 'local' })
      if (result.error) throw result.error
      setError(''); setState('complete')
    } catch {
      setError('Your password was updated, but this recovery session could not be closed. Retry sign out before continuing.')
      setState('cleanup')
    }
  }

  async function back() {
    if (callback && !['complete', 'request', 'sent'].includes(state)) {
      setBusy(true)
      try {
        const result = await client.auth.signOut({ scope: 'local' })
        if (result.error) throw result.error
      } catch { setError('The recovery session could not be closed. Retry before returning to sign in.'); setBusy(false); return }
      setBusy(false)
    }
    clearRecoveryCallback()
    onBack()
  }

  return <section className={className} aria-label="Password recovery">
    <h2>{state === 'password' ? 'Choose a new password' : state === 'mfa' ? 'Verify your authenticator' : 'Password recovery'}</h2>
    {error && <p role="alert">{error}</p>}
    {state === 'verifying' && <p role="status">Verifying your recovery link...</p>}
    {state === 'request' && <form onSubmit={request} className="oci-stack op-recovery-form">
      <label>Email<input name="email" type="email" autoComplete="username" required disabled={busy} /></label>
      <button className="op-btn op-btn-primary oci-primary" disabled={busy}>{busy ? 'Sending reset link...' : 'Send reset link'}</button>
    </form>}
    {state === 'sent' && <p role="status">If an eligible account exists, a recovery email has been requested. Check your inbox and spam folder.</p>}
    {state === 'mfa' && <form onSubmit={verifyMfa} className="oci-stack op-recovery-form">
      <p>Your enrolled authenticator is required. Password recovery does not remove MFA.</p>
      <label>Six-digit code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy} /></label>
      <button className="op-btn op-btn-primary oci-primary" disabled={busy}>{busy ? 'Verifying...' : 'Verify code'}</button>
    </form>}
    {state === 'password' && <form onSubmit={save} className="oci-stack op-recovery-form">
      <label>New password<input name="password" type="password" minLength={12} autoComplete="new-password" required disabled={busy} /></label>
      <label>Confirm new password<input name="confirm" type="password" minLength={12} autoComplete="new-password" required disabled={busy} /></label>
      <button className="op-btn op-btn-primary oci-primary" disabled={busy}>{busy ? 'Updating password...' : 'Update password'}</button>
    </form>}
    {state === 'cleanup' && <button className="op-btn op-btn-secondary" disabled={busy} onClick={async () => { setBusy(true); try { await finish() } catch { setError('Sign out failed. Please retry.') } finally { setBusy(false) } }}>Retry sign out</button>}
    {state === 'invalid' && <button className="op-btn op-btn-secondary" disabled={busy} onClick={async () => {
      setBusy(true)
      try { const result = await client.auth.signOut({ scope: 'local' }); if (result.error) throw result.error; setError(''); setState('request') }
      catch { setError('The recovery session could not be closed. Please retry.') }
      finally { setBusy(false) }
    }}>Request a new link</button>}
    {state === 'complete' && <p role="status">Your password was updated. Sign in again; your existing access permissions and MFA requirements are unchanged.</p>}
    {state !== 'verifying' && <button className="op-btn op-btn-secondary" type="button" disabled={busy} onClick={back}>Back to sign in</button>}
  </section>
}
