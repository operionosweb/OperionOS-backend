import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build, createServer as createViteServer } from 'vite'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { OCI_MODULES, OCI_STAGES } from '../../shared/ociContracts.js'
import { OCI_ACCOUNT_FIT_CRITERIA } from '../../shared/ociAccountFit.js'

// Production artifacts use only synthetic service configuration and intercepted transports.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const authOrigin = 'http://127.0.0.1:59998'
process.env.VITE_SUPABASE_URL = authOrigin
process.env.VITE_SUPABASE_ANON_KEY = 'oci-offline-anon-key'
process.env.VITE_API_BASE_URL = ''
let server, devServer, browser, origin, devOrigin
const now = Math.floor(Date.now() / 1000)
const userId = '00000000-0000-4000-8000-000000000001'
const token = (aal = 'aal2') => [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: userId, exp: now + 3600, iat: now, role: 'authenticated', aal })).toString('base64url'), Buffer.from('offline-signature').toString('base64url')].join('.')
const user = { id: userId, email: 'admin@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(), factors: [] }
const session = (aal = 'aal2') => ({ access_token: token(aal), refresh_token: 'offline-refresh', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user })
const record = (kind, data, id = `${kind}-1`, accountId = null) => ({ id, kind, data, account_id: accountId, opportunity_id: null, version: 1, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: userId, updated_by: userId })

before(async () => {
  await build({ root, configFile: path.join(root, 'vite.config.js'), mode: 'recovery-offline', logLevel: 'error' })
  await build({ root, configFile: path.join(root, 'vite.oci.config.js'), mode: 'recovery-offline', logLevel: 'error' })
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname
    const candidates = pathname.startsWith('/assets/') || pathname.startsWith('/cesium/')
      ? ['dist', 'dist-oci'].map(folder => path.join(root, folder, pathname))
      : [path.join(root, pathname === '/oci.html' ? 'dist-oci/oci.html' : 'dist/index.html')]
    for (const file of candidates) {
      try {
        const content = await readFile(file)
        const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' }
        response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' })
        response.end(content)
        return
      } catch (error) {
        if (error.code !== 'ENOENT') { response.writeHead(500); response.end('Offline artifact unavailable'); return }
      }
    }
    response.writeHead(404); response.end('Offline asset unavailable')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  devServer = await createViteServer({ root, configFile: path.join(root, 'vite.config.js'), mode: 'recovery-offline', server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' })
  await devServer.listen()
  devOrigin = `http://127.0.0.1:${devServer.httpServer.address().port}`
  browser = await chromium.launch({ headless: true })
})
after(async () => { await browser?.close(); await devServer?.close(); if (server) await new Promise(resolve => server.close(resolve)) })

async function fixture({ restore = true, denial = false, mfa = false, enrolled = true, accessError = false, userError = false, recovery = '', recoveryError = false, pkceFlow = false, publicLogin = false, analyticsConsent = false, coldDelay = 0, loginError = false, identityMismatch = false, expiredSession = false, devStrict = false, records: initial = {}, dashboardData = {}, revenueSummary = { financials: [], pipeline: [] } } = {}) {
  const baseOrigin = devStrict ? devOrigin : origin
  const context = await browser.newContext()
  await context.routeWebSocket('**/*', (socket) => socket.close())
  const page = await context.newPage()
  page.setDefaultTimeout(30000)
  const state = { denial, mfa, accessError, aal: mfa ? 'aal1' : 'aal2', requests: [], auth: [], network: [], javascriptErrors: [], records: structuredClone(initial), stages: [...OCI_STAGES], conflict: false, apiError: false, userError, revoked: false, recoveryError, passwordError: false, logoutError: false, mfaError: false, loginError, identityMismatch, expiredSession }
  page.on('pageerror', error => state.javascriptErrors.push(error.message))
  const storageKey = publicLogin ? `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token` : 'operion-oci-auth'
  if (restore) await context.addInitScript(({ stored, key, isPublic }) => {
    (isPublic ? localStorage : sessionStorage).setItem(key, JSON.stringify(stored))
  }, { stored: { ...session(state.aal), ...(expiredSession ? { expires_at: now - 10 } : {}) }, key: storageKey, isPublic: publicLogin })
  if (analyticsConsent) await context.addInitScript(() => localStorage.setItem('operion-analytics-consent', 'granted'))
  if (pkceFlow) await context.addInitScript(({ key, isPublic }) => {
    const storage = isPublic ? localStorage : sessionStorage
    storage.setItem(`${key}-flow-offline-flow-1-code-verifier`, JSON.stringify('offline-flow-verifier/recovery'))
    storage.setItem(`${key}-code-verifier`, JSON.stringify('wrong-concurrent-verifier/recovery'))
  }, { key: storageKey, isPublic: publicLogin })
  await context.addInitScript(() => {
    window.scrolledAnchors = []
    Element.prototype.scrollIntoView = function () { window.scrolledAnchors.push(this.id) }
    document.addEventListener('DOMContentLoaded', () => {
      const anchor = document.createElement('div')
      anchor.id = 'recovery-test-anchor'
      document.body.appendChild(anchor)
    })
  })
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    state.network.push({ url: request.url(), referrer: request.headers().referer || '' })
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.hostname === 'www.googletagmanager.com') return route.fulfill({ contentType: 'application/javascript', body: '' })
    if (url.origin === authOrigin) {
      state.auth.push({ path: url.pathname, query: url.search, method: request.method(), body: request.postDataJSON() })
      if (url.pathname.endsWith('/recover')) return state.recoveryError ? json({ message: 'Rate limited' }, 429) : json({})
      if (url.pathname === '/auth/v1/verify') return state.recoveryError ? json({ message: 'Expired recovery token' }, 403) : json(session('aal1'))
      if (url.pathname.endsWith('/token')) return state.loginError || state.expiredSession ? json({ message: 'Invalid credentials or expired session' }, 400) : json(session(state.aal))
      if (url.pathname.endsWith('/logout')) return state.logoutError ? json({ message: 'Sign out failed' }, 503) : json({})
      if (url.pathname.endsWith('/user')) {
        if (request.method() === 'PUT') return state.passwordError ? json({ message: 'Password policy' }, 422) : json(user)
        if (state.userError) return json({ message: 'Identity verification failed' }, 401)
        return json({ ...user, ...(state.identityMismatch ? { id: '00000000-0000-4000-8000-000000000099' } : {}), factors: enrolled ? [{ id: 'factor-1', factor_type: 'totp', status: 'verified', friendly_name: 'OCI authenticator' }] : [] })
      }
      if (url.pathname.endsWith('/factors') && request.method() === 'POST') return json({ id: 'factor-new', type: 'totp', totp: { qr_code: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>', secret: 'OFFLINETESTSECRET', uri: 'otpauth://totp/OCI?secret=OFFLINETESTSECRET' } })
      if (url.pathname.endsWith('/challenge')) return json({ id: 'challenge-1', expires_at: now + 300 })
      if (url.pathname.endsWith('/verify')) {
        if (state.mfaError) return json({ message: 'Invalid authenticator code' }, 422)
        state.mfa = false; state.aal = 'aal2'; return json(session('aal2'))
      }
      return json({ all: [], totp: [] })
    }
    if (url.origin === baseOrigin && url.pathname.startsWith('/api/oci')) {
      const path = url.pathname.slice('/api/oci'.length)
      const body = request.postDataJSON()
      state.requests.push({ path, query: url.searchParams, method: request.method(), body, authorization: request.headers().authorization })
      if (path === '/access') {
        if (state.accessError) return json({ success: false, error: 'Access service unavailable' }, 503)
        if (state.denial) return json({ success: false, error: 'OCI access denied', code: 'OCI_ACCESS_DENIED' }, 403)
        if (state.mfa) return json({ success: false, error: 'MFA required', code: 'OCI_MFA_REQUIRED' }, 403)
        return json({ success: true, user, role: 'super_admin', mfaRequired: true, mfaVerified: true })
      }
      if (state.revoked) { state.denial = true; return json({ success: false, error: 'OCI access revoked', code: 'OCI_ACCESS_DENIED' }, 403) }
      assert.equal(state.mfa, false, 'Commercial APIs must not be called while MFA is pending')
      assert.equal(state.denial, false, 'Commercial APIs must not be called after denial')
      if (state.apiError) return json({ success: false, error: 'Offline simulated API failure' }, 500)
      if (path === '/schema') return json({ success: true, modules: OCI_MODULES, stages: state.stages })
      if (path === '/geography/options') {
        const options = (state.records.accounts || []).map((item) => ({
          country_code: item.data.country_code, administrative_region: item.data.administrative_region,
          city: item.data.city, airport: item.data.airport_iata || item.data.airport_icao,
          segment: item.data.segment, company_type: item.data.company_type,
        })).filter((item) => item.country_code || item.city || item.segment || item.company_type)
        return json({ success: true, options, truncated: false })
      }
      if (path === '/dashboard') return json({
        success: true, geographicScope: url.searchParams.get('geoScope') || 'EUROPE',
        metrics: { targetOrganisations: (state.records.accounts || []).length, activeOpportunities: (state.records.opportunities || []).length },
        nextActions: [], revenueSummary, accountsByCountry: [], accountsBySegment: [], opportunitiesByCountry: [],
        pipelineByCountry: [], discoveryByCountry: [], pilotsByCountry: [], revenueByCountry: [],
        priorityOpportunities: [], dataOrigins: [], unresolvedCoverage: [],
        accountVerification: [], accountsAwaitingResearch: [], highPriorityEuropeanAccounts: [],
        validatedCustomerProblems: [], potentialPilotCandidates: [], ...dashboardData,
      })
      if (path === '/settings/stages') {
        if (request.method() === 'PUT') state.stages = body.stages
        return json({ success: true, stages: state.stages })
      }
      if (path === '/audit') return json({ success: true, events: state.requests.filter((item) => ['POST', 'PATCH', 'DELETE', 'PUT'].includes(item.method)).map((item, index) => ({ id: String(index), actor_id: userId, action: item.method, entity_kind: 'records', entity_id: 'test-record', metadata: { version: 1 }, created_at: new Date().toISOString() })) })
      const recommendation = path.match(/^\/recommendations\/(accounts|contacts|discovery|opportunities|pilots|activities)\/([^/]+)\/accept$/)
      if (recommendation && request.method() === 'POST') {
        const source = state.records[recommendation[1]]?.find((item) => item.id === recommendation[2])
        if (!source) return json({ success: false, error: 'Recommendation source unavailable' }, 404)
        return json({ success: true, record: record('activities', {
          title: 'Accepted synthetic recommendation', type: 'Research', activityStatus: 'Planned',
          actionStatus: 'Accepted', dueDate: body.dueDate,
        }, 'accepted-action', source.kind === 'accounts' ? source.id : source.account_id) }, 201)
      }
      const erasure = path.match(/^\/records\/contacts\/([^/]+)\/erase$/)
      if (erasure) {
        const item = state.records.contacts?.find((entry) => entry.id === erasure[1])
        assert.ok(item)
        if (state.conflict || item.data.privacyErased) return json({ success: false, error: 'Version conflict' }, 409)
        assert.equal(body.version, item.version)
        item.data = { name: 'Erased contact', privacyErased: true }
        item.status = 'archived'
        item.version++
        return json({ success: true, record: item })
      }
      const match = path.match(/^\/records\/([^/]+)(?:\/([^/]+))?$/)
      if (match) {
        const [, kind, id] = match
        state.records[kind] ||= []
        if (request.method() === 'GET') {
          let list = state.records[kind].filter((item) => url.searchParams.get('status') === 'all' || item.status === (url.searchParams.get('status') || 'active'))
          const search = url.searchParams.get('search')?.toLowerCase()
          if (search) list = list.filter((item) => JSON.stringify(item.data).toLowerCase().includes(search))
          if (url.searchParams.get('sort')?.startsWith('name_')) list.sort((a, b) => (a.data.name || a.data.title).localeCompare(b.data.name || b.data.title) * (url.searchParams.get('sort') === 'name_desc' ? -1 : 1))
          const size = Number(url.searchParams.get('pageSize') || 12), start = (Number(url.searchParams.get('page') || 1) - 1) * size
          return json({ success: true, records: list.slice(start, start + size), total: list.length })
        }
        if (state.conflict) return json({ success: false, error: 'Version conflict', code: 'OCI_VERSION_CONFLICT' }, 409)
        if (request.method() === 'POST') {
          const created = record(kind, body.data, `${kind}-${state.records[kind].length + 1}`, body.accountId)
          created.opportunity_id = body.opportunityId || null
          state.records[kind].push(created)
          return json({ success: true, record: created })
        }
        const item = state.records[kind].find((item) => item.id === id)
        assert.ok(item)
        assert.equal(body.version, item.version, 'Mutations carry the optimistic version')
        if (request.method() === 'PATCH') Object.assign(item, { data: body.data, account_id: body.accountId ?? item.account_id, opportunity_id: body.opportunityId ?? item.opportunity_id })
        if (request.method() === 'DELETE') item.status = 'archived'
        item.version++
        return json({ success: true, record: item })
      }
      return json({ success: false, error: 'Unknown mocked endpoint' }, 404)
    }
    if (url.origin === baseOrigin && url.pathname.startsWith('/api/')) return json({ roles: [], permissions: [] })
    if (url.origin === baseOrigin) {
      if (coldDelay && /^\/assets\/Login-.*\.js$/.test(url.pathname)) await new Promise(resolve => setTimeout(resolve, coldDelay))
      return route.continue()
    }
    throw new Error(`Unexpected outbound request blocked: ${url.origin}`)
  })
  await page.goto(`${baseOrigin}/${publicLogin ? 'login' : 'oci.html'}${recovery}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  return { page, state, context }
}
async function ready(page) { await page.getByRole('heading', { name: 'Command centre', exact: true }).waitFor() }
async function go(page, id) { await page.locator(`nav a[href="#${id}"]`).click(); await page.getByRole('heading', { name: OCI_MODULES.find((item) => item.id === id)?.label || (id === 'audit' ? 'Audit trail' : 'Pipeline stage settings'), exact: true }).waitFor() }
async function fillRequired(page, module, name) {
  const dialog = page.getByRole('dialog')
  for (const field of module.fields) {
    if (!field.required && !['name', 'title'].includes(field.key)) continue
    const input = dialog.locator(`[name="${field.key}"]`)
    if (field.type === 'select') await input.selectOption({ label: field.options[0] })
    else if (field.type === 'date') await input.fill('2027-01-15')
    else if (field.type === 'number') await input.fill('1')
    else await input.fill(field.key === 'currency' ? 'EUR' : ['name', 'title'].includes(field.key) ? name : 'Verified offline test evidence')
  }
}

test('restore checks getUser and server access before commercial requests; logout is tab-local', { timeout: 120000 }, async () => {
  const { page, state, context } = await fixture()
  try {
    await ready(page)
    assert.ok(state.auth.some((item) => item.path.endsWith('/user')))
    assert.equal(state.requests[0].path, '/access')
    assert.ok(state.requests.every((item) => item.authorization === `Bearer ${token()}`))
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByRole('heading', { name: 'Sign in to OCI' }).waitFor()
    assert.equal(await page.evaluate(() => localStorage.getItem('operion-oci-auth')), null)
    assert.equal(await page.evaluate(() => sessionStorage.getItem('operion-oci-auth')), null)
  } finally { await context.close() }
})

test('Europe is the default shared filter; filters persist across modules and reset without changing scope', async () => {
  const { page, state, context } = await fixture()
  try {
    await ready(page)
    await page.getByRole('combobox', { name: 'Market scope' }).waitFor()
    assert.equal(await page.getByRole('combobox', { name: 'Market scope' }).inputValue(), 'EUROPE')
    assert.ok(state.requests.some((item) => item.path === '/dashboard' && item.query.get('geoScope') === 'EUROPE'))
    await page.getByRole('group', { name: 'Aviation segments' }).getByRole('checkbox', { name: 'Airline', exact: true }).check()
    await page.getByRole('checkbox', { name: 'Spain', exact: true }).check()
    await go(page, 'accounts')
    const list = state.requests.find((item) => item.path === '/records/accounts' && item.query.get('geoCountries') === 'ES')
    assert.ok(list, 'accounts list carries the selected European filter')
    assert.equal(list.query.get('geoSegments'), 'Airline', 'unrelated segment facet is retained')
    await go(page, 'market')
    assert.ok(state.requests.some((item) => item.path === '/records/market' && item.query.get('geoCountries') === 'ES'))
    await page.getByRole('button', { name: 'Reset filters' }).click()
    assert.equal(await page.getByRole('combobox', { name: 'Market scope' }).inputValue(), 'EUROPE')
    assert.equal(await page.getByRole('checkbox', { name: 'Spain', exact: true }).isChecked(), false)
    assert.equal(await page.getByRole('group', { name: 'Aviation segments' }).getByRole('checkbox', { name: 'Airline', exact: true }).isChecked(), false)
    assert.deepEqual(state.javascriptErrors, [])
  } finally { await context.close() }
})

test('Global remains explicitly selectable and geographic context survives a workspace reload', async () => {
  const { page, state, context } = await fixture()
  try {
    await ready(page)
    await page.getByRole('combobox', { name: 'Market scope' }).selectOption('GLOBAL')
    await page.getByRole('checkbox', { name: 'United States', exact: true }).check()
    assert.ok(state.requests.some((item) => item.path === '/dashboard' && item.query.get('geoScope') === 'GLOBAL' && item.query.get('geoCountries') === 'US'))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await ready(page)
    assert.equal(await page.getByRole('combobox', { name: 'Market scope' }).inputValue(), 'GLOBAL')
    assert.equal(await page.getByRole('checkbox', { name: 'United States', exact: true }).isChecked(), true)
    assert.deepEqual(state.javascriptErrors, [])
  } finally { await context.close() }
})

test('country, region, city and airport facets cascade from stored geography', async () => {
  const account = record('accounts', {
    name: 'Located organisation', country: 'Spain', country_code: 'ES',
    administrative_region: 'Community of Madrid', city: 'Madrid', airport_iata: 'MAD',
    segment: 'Airline', company_type: 'Airline',
  }, 'located-account')
  const { page, state, context } = await fixture({ records: { accounts: [account] } })
  try {
    await ready(page)
    await page.getByRole('checkbox', { name: 'Spain', exact: true }).check()
    await page.getByRole('checkbox', { name: 'Community of Madrid', exact: true }).check()
    await page.getByRole('checkbox', { name: 'Madrid', exact: true }).check()
    await page.getByRole('checkbox', { name: 'MAD', exact: true }).check()
    const request = state.requests.find((item) => item.path === '/dashboard' &&
      item.query.get('geoCountries') === 'ES' && item.query.get('geoRegions') === 'Community of Madrid' &&
      item.query.get('geoCities') === 'Madrid' && item.query.get('geoAirports') === 'MAD')
    assert.ok(request, 'the dashboard query carries every narrowed geographic facet')
    assert.deepEqual(state.javascriptErrors, [])
  } finally { await context.close() }
})

test('account-fit form separates hypotheses, verified ratings and unknowns and evidence-gates its score', async () => {
  const { page, state, context } = await fixture()
  try {
    await ready(page)
    await go(page, 'accounts')
    await page.getByRole('button', { name: 'Create record' }).click()
    const dialog = page.getByRole('dialog')
    await fillRequired(page, OCI_MODULES.find((item) => item.id === 'accounts'), 'Synthetic fit account')
    await dialog.getByLabel(OCI_ACCOUNT_FIT_CRITERIA[0].label).selectOption({ label: 'Verified — High' })
    await dialog.getByLabel(OCI_ACCOUNT_FIT_CRITERIA[1].label).selectOption({ label: 'Hypothesis — Medium' })
    await dialog.getByLabel('Professional/public source and evidence references').fill('Public annual report, reviewed 2026-10-31')
    await dialog.getByLabel('Research date').fill('2026-10-31')
    assert.equal(await dialog.locator('.oci-fit-summary h3').textContent(), 'Score unavailable')
    assert.match(await dialog.locator('.oci-fit-summary').innerText(), /Assess at least 3 criteria/)
    await dialog.getByLabel(OCI_ACCOUNT_FIT_CRITERIA[2].label).selectOption({ label: 'Hypothesis — Low' })
    assert.match(await dialog.locator('.oci-fit-summary').innerText(), /Add criterion-specific source references/)
    await dialog.getByLabel('Account-fit evidence and rationale (cite each assessed criterion)').fill(
      'Contract complexity: annual report p. 18. Contract volume: hypothesis from disclosed fleet count. Aviation relevance: public annual report.',
    )
    await dialog.locator('.oci-fit-summary h3').filter({ hasText: /^\d+ \/ 100$/ }).waitFor()
    const rubric = await dialog.locator('.oci-fit-summary').innerText()
    assert.match(rubric, /3 of 9 criteria assessed/)
    assert.match(rubric, /1 evidence-labelled verified/)
    assert.match(rubric, /2 hypotheses/)
    await dialog.getByRole('button', { name: 'Save record', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    const saved = state.records.accounts.find((item) => item.data.name === 'Synthetic fit account')
    assert.equal(saved.data.fitContractComplexity, 'Verified — High')
    assert.equal(saved.data.fitEvidence.includes('annual report'), true)
    assert.equal(saved.data.accountStatus, '', 'fit does not auto-qualify a sales account')
  } finally { await context.close() }
})

test('linked market research starts discovery without promoting research into customer validation', async () => {
  const market = record('market', {
    title: 'Synthetic European leasing research', classification: 'Research finding',
    source: 'https://example.test/research', researchDate: '2026-10-31',
    researchStatus: 'Researched', data_origin: 'Synthetic',
  }, 'research-record', 'account-link')
  const account = record('accounts', {
    name: 'Synthetic leasing account', country: 'Spain', country_code: 'ES',
    accountStatus: 'Target', classification: 'Assumption', data_origin: 'Synthetic',
  }, 'account-link')
  const { page, state, context } = await fixture({ records: { accounts: [account], market: [market] } })
  try {
    await ready(page)
    await go(page, 'market')
    await page.getByRole('button', { name: 'View Synthetic European leasing research' }).click()
    await page.getByRole('button', { name: 'Start customer discovery' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('heading', { name: 'Create customer discovery' }).waitFor()
    await dialog.getByLabel('Account').waitFor()
    assert.equal(await dialog.getByLabel('Account').inputValue(), 'account-link')
    const reference = await dialog.getByLabel('Linked market research reference (not customer validation)').inputValue()
    assert.match(reference, /Synthetic European leasing research/)
    assert.match(reference, /Research remains a hypothesis/)
    await fillRequired(page, OCI_MODULES.find((item) => item.id === 'discovery'), 'Interview after research')
    await dialog.getByLabel('Validation classification').selectOption({ label: 'Internal assumption' })
    await dialog.getByLabel('Validation evidence').fill('Research follow-up interview note, synthetic test')
    await dialog.getByLabel('Problems identified').fill('Synthetic test problem')
    await dialog.getByRole('button', { name: 'Save record', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    const saved = state.records.discovery.find((item) => item.data.title === 'Interview after research')
    assert.equal(saved.account_id, 'account-link')
    assert.equal(saved.data.validation, 'Internal assumption')
    assert.match(saved.data.researchReference, /market research/i)
    assert.equal(state.records.opportunities?.length || 0, 0)
    assert.deepEqual(state.javascriptErrors, [])
  } finally { await context.close() }
})

test('European dashboard renders evidence status, research queue and validated pilot signals with origins', async () => {
  const { page, context } = await fixture({ dashboardData: {
    accountVerification: [{ verificationStatus: 'Verified', count: 2, dataOrigin: 'Real' }, { verificationStatus: 'Unverified / insufficient evidence', count: 1, dataOrigin: 'Synthetic' }],
    highPriorityEuropeanAccounts: [{
      name: 'Synthetic priority airline', countryCode: 'ES', city: 'Madrid', segment: 'Airline',
      researchStatus: 'Needs verification', dataOrigin: 'Synthetic',
      fitAssessment: {
        fitContractComplexity: 'Hypothesis — High', fitContractVolume: 'Unknown',
        fitAviationRelevance: 'Verified — High', fitEvidence: 'Synthetic fixtures only.',
      },
    }],
    accountsAwaitingResearch: [{ name: 'Research queue airline', countryCode: 'FR', segment: 'Airline', researchStatus: 'Not researched', dataOrigin: 'Unclassified' }],
    validatedCustomerProblems: [{ countryCode: 'DE', count: 3, dataOrigin: 'Real' }],
    potentialPilotCandidates: [{ countryCode: 'IE', count: 1, dataOrigin: 'Real' }],
  } })
  try {
    await ready(page)
    await page.getByRole('heading', { name: 'Verified versus unverified accounts' }).waitFor()
    await page.getByText('Synthetic priority airline', { exact: true }).waitFor()
    await page.getByText('Research queue airline', { exact: true }).waitFor()
    await page.getByRole('heading', { name: 'Customer-validated problems' }).waitFor()
    await page.getByRole('heading', { name: 'Potential pilot candidates · discovery evidence only' }).waitFor()
    assert.ok(await page.getByText('Synthetic', { exact: true }).count() >= 1)
    assert.deepEqual(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  } finally { await context.close() }
})

test('Founder action centre explains synthetic recommendations and separates pipeline from classified revenue', async () => {
  const action = {
    id: 'synthetic-opportunity', kind: 'opportunities',
    data: { name: 'Synthetic airline opportunity', stage: 'Qualified', data_origin: 'Synthetic' },
    accountName: 'Synthetic European airline', countryCode: 'ES', city: 'Madrid', segment: 'Airline',
    dueDate: '2026-10-30', urgency: 'Urgent',
    recommendationReason: 'Qualified opportunity follow-up date has passed.',
    recommendedAction: 'Review the opportunity and record a human-approved follow-up.',
    evidence: 'Synthetic test discovery note',
  }
  const { page, state, context } = await fixture({ revenueSummary: {
    financials: [{
      currency: 'EUR', basis: 'Actual', revenueClass: 'Recognised actual', amount: 1250,
      periodDate: '2026-10-01', countryCode: 'ES', segment: 'Airline', dataOrigin: 'Synthetic',
      costComplete: false, marginBasis: 'Unknown',
    }],
    pipeline: [{
      currency: 'EUR', countryCode: 'ES', segment: 'Airline', dataOrigin: 'Synthetic',
      opportunityCount: 1, value: 10000, weightedValue: null, probabilityComplete: false,
    }],
  }, dashboardData: {
    metrics: { activeOpportunities: 1, closedOpportunityWinRate: 50, recognisedRevenueRecords: 1, onHoldOpportunities: 0 },
    nextActions: [action],
    pipelineByCountry: [{
      countryCode: 'ES', segment: 'Airline', currency: 'EUR', value: 10000,
      weightedValue: null, probabilityComplete: false, dataOrigin: 'Synthetic',
    }],
  } })
  try {
    await ready(page)
    await page.getByRole('heading', { name: 'Founder action centre' }).waitFor()
    await page.getByText('Qualified opportunity follow-up date has passed.').waitFor()
    await page.getByText('Synthetic test discovery note').waitFor()
    await page.getByText('Review the opportunity and record a human-approved follow-up.').waitFor()
    await page.getByText(/Recognised actual/).waitFor()
    await page.getByText(/Unweighted opportunity pipeline/).waitFor()
    await page.getByText(/Unavailable — at least one opportunity lacks a documented probability/).waitFor()
    await page.getByText('50%', { exact: true }).waitFor()
    for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no horizontal overflow at ${width}px`)
    }
    assert.deepEqual(state.javascriptErrors, [])
  } finally { await context.close() }
})

test('Founder can accept an evidenced recommendation and explicitly complete a linked action', async () => {
  const sourceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const accountId = sourceId
  const recommendation = {
    id: sourceId, kind: 'accounts', recommendationId: `accounts:${sourceId}:founder-next-step-v1`,
    relatedRecordKind: 'accounts', relatedRecordId: sourceId, accountId, opportunityId: null,
    actionCategory: 'Research', data: { name: 'Synthetic European lessor', data_origin: 'Synthetic' },
    accountName: 'Synthetic European lessor', countryCode: 'ES', city: 'Madrid', segment: 'Aircraft lessor',
    urgency: 'Routine', recommendationReason: 'The account needs source-backed research.',
    recommendedAction: 'Verify the lessor portfolio from public sources.',
    evidence: 'Synthetic research status: Not researched.',
  }
  const contactRecommendation = {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', kind: 'contacts',
    recommendationId: 'contacts:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:founder-next-step-v1',
    sourceName: 'Synthetic aviation contact', accountName: 'Synthetic European lessor',
    urgency: 'Routine', data: { data_origin: 'Synthetic' },
    recommendationReason: 'A publicly identified contact is recorded.',
    recommendedAction: 'Review the contact and decide whether to reach out.',
    evidence: 'Synthetic public-source evidence.',
  }
  const existingAction = record('activities', {
    title: 'Follow up on the sourced research', type: 'Follow-up', activityStatus: 'Planned',
    actionStatus: 'Accepted', actionCategory: 'Follow-up',
    recommendationId: `accounts:${sourceId}:founder-next-step-v1`,
    recommendationReason: 'A human accepted the recommendation.',
    recommendationEvidence: 'Synthetic source evidence.', expectedObjective: 'Complete research.',
    relatedRecordKind: 'accounts', relatedRecordId: sourceId, actionScope: 'Account geography',
    dueDate: '2026-11-01', nextAction: 'Complete research.',
  }, 'existing-action', accountId)
  const { page, state, context } = await fixture({
    records: { accounts: [record('accounts', { name: 'Synthetic European lessor', country: 'Spain', country_code: 'ES' }, accountId)],
      activities: [existingAction] },
    dashboardData: {
      nextActions: [recommendation, contactRecommendation],
      executionActions: [{
        id: existingAction.id, version: 1, accountId, opportunityId: null, data: existingAction.data,
        accountName: 'Synthetic European lessor', countryCode: 'ES', city: 'Madrid', segment: 'Aircraft lessor',
        geographicStatus: 'Account geography', dataOrigin: 'Synthetic', relatedRecordName: null,
        dueDate: '2026-11-01', timeBucket: 'Today', priority: 'High',
      }],
      metrics: { outstandingActions: 1, overdueActions: 0, actionsDueToday: 1, actionsDueSoon: 0, staleActivityThresholdDays: 30 },
    },
  })
  try {
    await ready(page)
    await page.getByText(/Accepted · High · Account geography · Synthetic/).waitFor()
    await page.getByText(/Relevant contact: Synthetic aviation contact/).waitFor()
    await page.locator('.oci-action-recommendation').first().getByRole('button', { name: 'Accept as action' }).click()
    await page.getByRole('heading', { name: 'Accept recommendation as an action' }).waitFor()
    await page.getByLabel('Due date', { exact: true }).fill('2026-11-06')
    await page.getByRole('button', { name: 'Accept and record action' }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    const accepted = state.requests.find((item) => item.method === 'POST' && item.path === `/recommendations/accounts/${sourceId}/accept`)
    assert.equal(accepted.body.dueDate, '2026-11-06')
    await page.getByRole('button', { name: 'Complete', exact: true }).click()
    await page.getByLabel('Outcome / completion notes').fill('Public portfolio source reviewed and recorded.')
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    const completed = state.requests.find((item) => item.method === 'PATCH' && item.path === '/records/activities/existing-action')
    assert.equal(completed.body.data.actionStatus, 'Completed')
    assert.equal(completed.body.data.activityStatus, 'Completed')
    assert.equal(completed.body.data.outcome, 'Public portfolio source reviewed and recorded.')
    assert.equal(completed.body.data.completedDate, new Date().toISOString().slice(0, 10))
    for (const width of [320, 390, 768, 1024, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no action centre overflow at ${width}px`)
    }
    assert.deepEqual(state.javascriptErrors, [])
  } finally { await context.close() }
})

test('OCI forgot-password requests are validated, generic and surface provider failure', async () => {
  const { page, state, context } = await fixture({ restore: false })
  try {
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    await page.getByRole('button', { name: 'Send reset link' }).click()
    assert.equal(state.auth.filter(item => item.path.endsWith('/recover')).length, 0)
    await page.getByLabel('Email', { exact: true }).fill('admin@example.test')
    state.recoveryError = true
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await page.getByRole('alert').filter({ hasText: 'could not request' }).waitFor()
    state.recoveryError = false
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await page.getByRole('status').filter({ hasText: 'eligible account' }).waitFor()
    const requests = state.auth.filter(item => item.path.endsWith('/recover'))
    assert.equal(requests.at(-1).body.email, 'admin@example.test')
    assert.equal(new URLSearchParams(requests.at(-1).query).get('redirect_to'), `${origin}/?recovery=1`)
    assert.equal(state.requests.length, 0)
    assert.deepEqual(state.javascriptErrors, [])
  } finally { await context.close() }
})

test('expired recovery token is rejected before password changes and recovery forms fit all widths', async () => {
  const failed = await fixture({ restore: false, enrolled: false, recoveryError: true, recovery: '?token_hash=expired-test&type=recovery' })
  try {
    await failed.page.getByRole('button', { name: 'Request a new link' }).waitFor()
    assert.equal(failed.state.requests.length, 0)
    assert.equal(failed.state.auth.some(item => item.method === 'PUT'), false)
  } finally { await failed.context.close() }
  const { page, context, state } = await fixture({ restore: false, enrolled: false, recovery: '?token_hash=offline-recovery&type=recovery' })
  try {
    await page.getByRole('heading', { name: 'Choose a new password' }).waitFor()
    for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px recovery overflow`)
      for (const button of await page.getByRole('button').all()) {
        const box = await button.boundingBox()
        assert.ok(box && box.width >= 44 && box.height >= 42)
      }
    }
    assert.equal(state.requests.length, 0)
  } finally { await context.close() }
})

test('OCI recovery scrubs link, enforces existing MFA, checks passwords and closes session', async () => {
  const { page, state, context } = await fixture({ restore: false, recovery: '?token_hash=offline-recovery&type=recovery' })
  try {
    await page.getByRole('button', { name: 'Verify code', exact: true }).waitFor()
    assert.equal(new URL(page.url()).search, '')
    assert.equal(state.requests.length, 0)
    assert.equal(state.auth.some(item => item.method === 'PUT'), false)
    await page.getByLabel('Six-digit code').fill('123456')
    await page.getByRole('button', { name: 'Verify code', exact: true }).click()
    await page.getByLabel('New password', { exact: true }).fill('new-offline-password')
    await page.getByLabel('Confirm new password').fill('different-password')
    await page.getByRole('button', { name: 'Update password' }).click()
    await page.getByRole('alert').filter({ hasText: 'do not match' }).waitFor()
    assert.equal(state.auth.some(item => item.method === 'PUT'), false)
    await page.getByLabel('Confirm new password').fill('new-offline-password')
    state.passwordError = true
    await page.getByRole('button', { name: 'Update password' }).click()
    await page.getByRole('alert').filter({ hasText: 'could not complete' }).waitFor()
    state.passwordError = false
    state.logoutError = true
    await page.getByRole('button', { name: 'Update password' }).click()
    await page.getByRole('button', { name: 'Retry sign out' }).waitFor()
    state.logoutError = false
    await page.getByRole('button', { name: 'Retry sign out' }).click()
    await page.getByRole('status').filter({ hasText: 'password was updated' }).waitFor()
    assert.equal(await page.evaluate(() => sessionStorage.getItem('operion-oci-auth')), null)
    assert.equal(state.requests.length, 0)
    await page.getByRole('button', { name: 'Back to sign in' }).click()
    await page.getByRole('heading', { name: 'Sign in to OCI' }).waitFor()
  } finally { await context.close() }
})

test('incomplete OCI recovery cannot reuse an existing session or load commercial data', async () => {
  const { page, state, context } = await fixture({ recovery: '?recovery=1' })
  try {
    await page.getByRole('button', { name: 'Request a new link' }).waitFor()
    assert.equal(state.auth.some(item => item.method === 'PUT'), false)
    assert.equal(state.requests.length, 0)
    await page.getByRole('button', { name: 'Request a new link' }).click()
    await page.getByRole('button', { name: 'Send reset link' }).waitFor()
    assert.equal(await page.evaluate(() => sessionStorage.getItem('operion-oci-auth')), null)
  } finally { await context.close() }
})

test('PKCE recovery preserves its flow-specific verifier after URL scrubbing; legacy fragments still work', async () => {
  for (const options of [
    { pkceFlow: true, recovery: '?code=offline-auth-code&recovery=1&sb_flow_id=offline-flow-1' },
    { recovery: `#type=recovery&access_token=${token('aal1')}&refresh_token=offline-refresh` },
  ]) {
    const { page, context, state } = await fixture({ restore: false, enrolled: false, ...options })
    try {
      await page.getByRole('heading', { name: 'Choose a new password' }).waitFor()
      assert.equal(new URL(page.url()).search, '')
      assert.equal(new URL(page.url()).hash, '')
      if (options.pkceFlow) {
        const exchanged = state.auth.find(item => item.path.endsWith('/token'))
        assert.equal(exchanged.body.code_verifier, 'offline-flow-verifier')
        assert.equal(exchanged.body.auth_code, 'offline-auth-code')
      }
      assert.equal(state.requests.length, 0)
      await page.getByRole('button', { name: 'Back to sign in' }).click()
      await page.getByRole('heading', { name: 'Sign in to OCI' }).waitFor()
    } finally { await context.close() }
  }
})

test('public login recovery completes password update rather than redirecting to the dashboard', { timeout: 60000 }, async () => {
  const { page, state, context } = await fixture({ restore: false, enrolled: false, publicLogin: true, recovery: '?token_hash=offline-recovery&type=recovery' })
  try {
    await page.getByRole('heading', { name: 'Choose a new password' }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/login')
    assert.equal(new URL(page.url()).search, '')
    for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px public recovery overflow`)
      for (const button of await page.getByRole('region', { name: 'Password recovery' }).getByRole('button').all()) {
        const box = await button.boundingBox()
        assert.ok(box && box.width >= 44 && box.height >= 42)
      }
    }
    await page.getByLabel('New password', { exact: true }).fill('new-offline-password')
    await page.getByLabel('Confirm new password').fill('new-offline-password')
    await page.getByRole('button', { name: 'Update password' }).click()
    await page.getByRole('status').filter({ hasText: 'password was updated' }).waitFor()
    assert.equal(state.auth.filter(item => item.method === 'PUT').length, 1)
    await page.getByRole('button', { name: 'Back to sign in' }).click()
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    await page.getByLabel('Email', { exact: true }).fill('admin@example.test')
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await page.getByRole('status').filter({ hasText: 'If an eligible account exists' }).waitFor()
    const request = state.auth.find(item => item.path.endsWith('/recover'))
    assert.equal(new URLSearchParams(request.query).get('redirect_to'), `${origin}/login?recovery=1`)
    assert.deepEqual(state.javascriptErrors, [])
  } finally { await context.close() }
})

test('public callbacks are scrubbed before cold lazy loading, consented analytics and referrers', { timeout: 120000 }, async () => {
  for (const options of [
    { recovery: `#type=recovery&access_token=${token('aal1')}&refresh_token=offline-refresh` },
    { pkceFlow: true, recovery: '?code=offline-auth-code&recovery=1&sb_flow_id=offline-flow-1' },
    { recovery: '?token_hash=offline-recovery&type=recovery&error_description=private-detail' },
  ]) {
    const { page, state, context } = await fixture({ restore: true, publicLogin: true, enrolled: false, analyticsConsent: true, coldDelay: 600, ...options })
    try {
      await page.getByRole('heading', { name: 'Choose a new password' }).waitFor()
      assert.equal(await page.locator('meta[name="referrer"]').getAttribute('content'), 'no-referrer')
      assert.equal(new URL(page.url()).search, '')
      assert.equal(new URL(page.url()).hash, '')
      assert.deepEqual(state.javascriptErrors, [])
      assert.equal(state.network.some(item => new URL(item.url).pathname.startsWith('/api/')), false, 'Recovery must not load customer authorization/data')
      await page.waitForFunction(() => window.dataLayer?.some(item => item[0] === 'event' && item[1] === 'page_view'))
      const events = await page.evaluate(() => window.dataLayer.map(item => Array.from(item)))
      for (const item of events.filter(item => ['config', 'event'].includes(item[0]))) {
        assert.equal(item[2].page_referrer, '')
        assert.equal(item[2].page_location, `${origin}/login`)
        assert.equal(item[2].page_path, '/login')
      }
      const serialized = JSON.stringify(events)
      for (const secret of ['offline-refresh', 'offline-auth-code', 'offline-recovery', 'offline-flow-1', 'private-detail', token('aal1')]) {
        assert.equal(serialized.includes(secret), false)
        assert.equal(state.network.some(item => item.referrer.includes(secret)), false, `Synthetic ${secret} found in referrer for ${state.network.filter(item => item.referrer.includes(secret)).map(item => new URL(item.url).pathname).join(', ')}`)
      }
      assert.ok(state.network.every(item => !/(access_token=|refresh_token=|token_hash=|code=|sb_flow_id=|error_description=)/i.test(item.referrer)), 'Module/assets/auth/analytics referrers must contain no callback parameters')
      assert.ok(state.network.filter(item => new URL(item.url).origin === authOrigin || new URL(item.url).hostname === 'www.googletagmanager.com').every(item => !item.referrer))
      if (options.recovery.startsWith('?token_hash')) assert.equal(state.auth.filter(item => item.path === '/auth/v1/verify').length, 1, 'StrictMode must not consume token twice')
      await page.getByRole('button', { name: 'Back to sign in' }).click()
      await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
    } finally { await context.close() }
  }
})

test('ordinary public map tiles receive only the site origin, never URL parameters', async () => {
  const { page, state, context } = await fixture({ restore: false, publicLogin: true, recovery: '?code=unrelated-private-code' })
  try {
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
    assert.equal(await page.locator('meta[name="referrer"]').getAttribute('content'), 'origin')
    let tileReferrer
    await page.route('https://tile.openstreetmap.org/0/0/0.png', async route => {
      tileReferrer = (await route.request().allHeaders()).referer
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9p8AAAAASUVORK5CYII=', 'base64') })
    })
    await page.evaluate(() => new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = resolve
      image.onerror = reject
      image.src = 'https://tile.openstreetmap.org/0/0/0.png'
    }))
    assert.equal(tileReferrer, `${origin}/`)
    assert.ok(state.network.filter(item => item.referrer).every(item => item.referrer === `${origin}/`))
    assert.deepEqual(state.javascriptErrors, [])
  } finally { await context.close() }
})

test('development StrictMode consumes a public recovery callback only once', { timeout: 60000 }, async () => {
  const { page, state, context } = await fixture({ devStrict: true, restore: false, publicLogin: true, enrolled: false, recovery: '?token_hash=offline-strict-recovery&type=recovery' })
  try {
    await page.getByRole('heading', { name: 'Choose a new password' }).waitFor()
    assert.equal(state.auth.filter(item => item.path === '/auth/v1/verify').length, 1)
    assert.deepEqual(state.javascriptErrors, [])
    assert.equal(new URL(page.url()).search, '')
  } finally { await context.close() }
})

test('ordinary analytics and ID anchors remain functional; malformed hashes are not selectors', { timeout: 60000 }, async () => {
  const { page, state, context } = await fixture({ restore: false, publicLogin: true, analyticsConsent: true, recovery: '?utm_source=owner-review#recovery-test-anchor' })
  try {
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
    await page.waitForFunction(() => window.dataLayer?.some(item => item[1] === 'page_view'))
    assert.equal(await page.evaluate(() => window.dataLayer.find(item => item[1] === 'page_view')[2].page_path), '/login?utm_source=owner-review')
    assert.ok(await page.evaluate(() => window.scrolledAnchors.includes('recovery-test-anchor')))
    await page.goto(`${origin}/login#invalid[selector`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
    assert.deepEqual(state.javascriptErrors, [])
    await page.goto(`${origin}/login?code=unrelated-private-code`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => JSON.stringify(window.dataLayer || []).includes('unrelated-private-code')), false)
  } finally { await context.close() }
})

test('public normal login, invalid credentials, session restoration and logout remain intact', { timeout: 120000 }, async () => {
  const { page, state, context } = await fixture({ restore: false, publicLogin: true, loginError: true })
  try {
    await page.getByLabel('Business email').fill('admin@example.test')
    await page.getByLabel('Password', { exact: true }).fill('offline-test-password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'could not sign you in' }).waitFor()
    state.loginError = false
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.getByRole('heading', { name: 'Good morning' }).waitFor()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Good morning' }).waitFor()
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
    assert.deepEqual(state.javascriptErrors, [])
  } finally { await context.close() }
  const expired = await fixture({ publicLogin: true, expiredSession: true })
  try {
    await expired.page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
    assert.equal(expired.state.network.some(item => new URL(item.url).pathname.startsWith('/api/')), false)
  } finally { await expired.context.close() }
})

test('customer Globe inspects scoped associations in place, rejects stale responses and surfaces relationship errors', { timeout: 120000 }, async () => {
  const { page, state, context } = await fixture({ publicLogin: true })
  let releaseFirst, firstRequested = false, firstRequests = 0
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.route('https://tile.openstreetmap.org/**', route => route.abort())
    await page.route('**/api/**', async route => {
      assert.equal(route.request().method(), 'GET', 'Customer acceptance performs no mutations')
      const pathname = new URL(route.request().url()).pathname
      const json = (body, status = 200) => route.fulfill({ status, json: body })
      if (pathname === '/api/platform/context') return json({ roles: [], permissions: [] })
      if (pathname === '/api/foundation/organizations') return json({ organizations: [{ id: 'offline-org', name: 'Offline organization' }] })
      if (pathname === '/api/foundation/context') return json({ organization: { id: 'offline-org', role: 'admin' } })
      if (pathname === '/api/aviation/weather') return json({ weather: { state: 'UNAVAILABLE', layers: [] } })
      if (pathname === '/api/aviation/aircraft') return json({
        state: 'LIVE', provider: 'Intercepted offline fixture', aircraft: ['one', 'two'].map(id => ({
          id, registration: `OFFLINE-${id}`, position: { longitude: 10, latitude: 35, altitudeMeters: 10000, groundSpeedKph: 780 },
          origin: { iata: 'BCN' }, destination: { iata: 'FRA' }, dataSource: 'Intercepted offline fixture',
        })),
      })
      if (pathname.endsWith('/intelligence')) {
        const id = pathname.split('/')[4]
        if (id === 'one') {
          firstRequests++
          if (firstRequests > 1) return json({ error: 'Relationship fixture unavailable' }, 503)
          firstRequested = true
          await new Promise(resolve => { releaseFirst = resolve })
        }
        return json({ intelligence: { contracts: [{ contract_id: `contract-${id}`, title: `Scoped agreement ${id}`, relationship_type: 'lease', confidence: 0.9 }], impact: { contracts: 1, obligations: 0, deadlines: 0, risks: 0 } } })
      }
      return json({})
    })
    await page.goto(`${origin}/app/live-tracking`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Close Matt panel', exact: true }).click()
    const canvas = page.locator('.op-aviation-globe canvas')
    await canvas.waitFor()
    assert.equal(await page.locator('.op-flight-sheet').count(), 0)
    async function select(id) {
      await page.getByPlaceholder('Flight, callsign, registration or airport').fill(`OFFLINE-${id}`)
      await page.waitForTimeout(300)
      await canvas.scrollIntoViewIfNeeded()
      const bounds = await canvas.boundingBox()
      await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
      await page.locator('.op-flight-sheet').getByRole('heading', { name: `OFFLINE-${id}`, exact: true }).waitFor()
    }
    await select('one')
    await page.waitForFunction(() => !!document.querySelector('.op-flight-sheet'))
    for (let attempt = 0; !firstRequested && attempt < 100; attempt++) await page.waitForTimeout(20)
    assert.ok(firstRequested, 'Selecting the first aircraft requests its own associations')
    await select('two')
    await page.getByRole('button', { name: 'Scoped agreement two', exact: true }).waitFor()
    releaseFirst()
    await page.waitForTimeout(200)
    assert.equal(await page.getByRole('button', { name: 'Scoped agreement one', exact: true }).count(), 0)
    const frame = await canvas.elementHandle(), url = page.url()
    await page.getByRole('button', { name: 'Scoped agreement two', exact: true }).click()
    await page.getByRole('region', { name: 'In-place customer contract inspection' }).waitFor()
    assert.ok(await page.getByText(/not clause excerpts or financial terms/).count())
    assert.equal(await page.locator('.op-aviation-globe canvas').evaluate((node, original) => node === original, frame), true)
    assert.equal(page.url(), url)
    await page.getByRole('button', { name: 'Return to aircraft', exact: true }).click()
    await select('one')
    await page.getByRole('alert').filter({ hasText: 'Relationship fixture unavailable' }).waitFor()
    assert.deepEqual(state.javascriptErrors, [])
  } finally { releaseFirst?.(); await context.close() }
})

test('recovery identity mismatch and failed provider identity checks reject updates', async () => {
  for (const option of [{ identityMismatch: true }, { userError: true }]) {
    const { page, state, context } = await fixture({ restore: false, enrolled: false, recovery: '?token_hash=offline-recovery&type=recovery', ...option })
    try {
      await page.getByRole('button', { name: 'Request a new link' }).waitFor()
      assert.equal(state.auth.some(item => item.method === 'PUT'), false)
      assert.equal(state.requests.length, 0)
    } finally { await context.close() }
  }
})

test('recovery MFA failure, interrupted session, cleanup retry and reused token fail closed', { timeout: 120000 }, async () => {
  for (const publicLogin of [false, true]) {
    const { page, state, context } = await fixture({ restore: false, publicLogin, recovery: '?token_hash=offline-recovery&type=recovery' })
    try {
      await page.getByRole('button', { name: 'Verify code', exact: true }).waitFor()
      state.mfaError = true
      await page.getByLabel('Six-digit code').fill('111111')
      await page.getByRole('button', { name: 'Verify code', exact: true }).click()
      await page.getByRole('alert').filter({ hasText: 'could not be verified' }).waitFor()
      assert.equal(state.auth.some(item => item.method === 'PUT'), false)
      assert.equal(state.network.some(item => new URL(item.url).pathname.startsWith('/api/')), false)
      state.mfaError = false
      await page.getByRole('button', { name: 'Verify code', exact: true }).click()
      await page.getByRole('heading', { name: 'Choose a new password' }).waitFor()
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: 'Request a new link' }).waitFor()
      assert.equal(state.network.some(item => new URL(item.url).pathname.startsWith('/api/')), false)
      state.logoutError = true
      await page.getByRole('button', { name: 'Request a new link' }).click()
      await page.getByRole('alert').filter({ hasText: 'could not be closed' }).waitFor()
      state.logoutError = false
      await page.getByRole('button', { name: 'Request a new link' }).click()
      await page.getByRole('button', { name: 'Send reset link' }).waitFor()
      state.recoveryError = true
      await page.goto(`${origin}/${publicLogin ? 'login' : 'oci.html'}?token_hash=offline-recovery&type=recovery`, { waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: 'Request a new link' }).waitFor()
      assert.equal(state.auth.some(item => item.method === 'PUT'), false)
      assert.deepEqual(state.javascriptErrors, [])
    } finally { await context.close() }
  }
})

test('password-only login denial does not load schema or records', { timeout: 30000 }, async () => {
  const { page, state, context } = await fixture({ restore: false, denial: true })
  try {
    await page.getByRole('heading', { name: 'Sign in to OCI' }).waitFor()
    await page.getByLabel('Email', { exact: true }).fill('admin@example.test')
    await page.getByLabel('Password', { exact: true }).fill('offline-password-not-real')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'OCI access denied' }).waitFor()
    assert.deepEqual(state.requests.map((item) => item.path), ['/access'])
    assert.equal(state.auth.find((item) => item.path.endsWith('/token')).body.email, 'admin@example.test')
    assert.equal(await page.getByRole('link', { name: 'Accounts', exact: true }).count(), 0)
  } finally { await context.close() }
})

test('access error is explicit and retry is fail-closed', { timeout: 30000 }, async () => {
  const { page, state, context } = await fixture({ accessError: true })
  try {
    await page.getByRole('alert').filter({ hasText: 'Access service unavailable' }).waitFor()
    assert.equal(state.requests.length, 1)
    state.accessError = false
    await page.getByRole('button', { name: 'Retry access check' }).click()
    await ready(page)
  } finally { await context.close() }
})

test('TOTP challenge guards all commercial data and uses elevated live bearer afterward', { timeout: 30000 }, async () => {
  const { page, state, context } = await fixture({ mfa: true })
  try {
    await page.getByLabel('Six-digit code').waitFor()
    assert.deepEqual(state.requests, [])
    await page.getByLabel('Six-digit code').fill('123456')
    await page.getByRole('button', { name: 'Verify and continue' }).click()
    await ready(page)
    assert.equal(state.requests[0].path, '/access')
    assert.ok(state.auth.some((item) => item.path.endsWith('/challenge')))
    assert.ok(state.auth.some((item) => item.path.endsWith('/verify')))
    assert.ok(state.requests.filter((item) => item.path !== '/access').every((item) => item.authorization === `Bearer ${token('aal2')}`))
  } finally { await context.close() }
})

test('TOTP enrollment stays gated until challenge verification', { timeout: 30000 }, async () => {
  const { page, state, context } = await fixture({ mfa: true, enrolled: false })
  try {
    await page.getByRole('button', { name: 'Set up authenticator' }).click()
    await page.getByLabel('Setup key').waitFor()
    assert.equal(state.requests.length, 0)
    await page.getByLabel('Six-digit code').fill('123456')
    await page.getByRole('button', { name: 'Verify and continue' }).click()
    await ready(page)
    assert.equal(state.requests[0].path, '/access')
    assert.ok(state.auth.some((item) => item.path.endsWith('/factors') && item.method === 'POST'))
  } finally { await context.close() }
})

test('accounts CRUD, search, pagination, sort, archive confirmation, version conflicts, audit and settings', { timeout: 60000 }, async () => {
  const accounts = Array.from({ length: 13 }, (_, index) => record('accounts', { name: `Organisation ${String(index + 1).padStart(2, '0')}`, classification: 'Verified fact' }, `account-${index}`))
  const { page, state, context } = await fixture({ records: { accounts } })
  try {
    await ready(page); await go(page, 'accounts')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByText('Page 2 of 2', { exact: false }).waitFor()
    await page.getByLabel('Sort', { exact: true }).selectOption('name_desc')
    await page.getByText('Page 1 of 2', { exact: false }).waitFor()
    await page.getByLabel('Search records').fill('Organisation 13')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await page.getByText('1 records · Page 1 of 1').waitFor()
    await page.getByLabel('Search records').fill('')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await page.getByRole('button', { name: 'Create record' }).click()
    await fillRequired(page, OCI_MODULES[0], 'New real account')
    await page.getByRole('button', { name: 'Save record', exact: true }).click()
    await page.getByText('Record saved successfully.').waitFor()
    await page.getByLabel('Search records').fill('New real account')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await page.getByRole('button', { name: 'Edit New real account' }).click()
    await page.getByRole('dialog').locator('[name="name"]').fill('Edited account')
    state.conflict = true
    await page.getByRole('button', { name: 'Save record', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'changed since' }).waitFor()
    await page.getByRole('button', { name: 'Close dialog' }).click()
    state.conflict = false
    await page.getByRole('button', { name: 'Refresh records' }).click()
    await page.getByRole('button', { name: 'Edit New real account' }).click()
    await page.getByRole('dialog').locator('[name="name"]').fill('Edited account')
    await page.getByRole('button', { name: 'Save record', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page.getByLabel('Search records').fill('Edited account')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await page.getByRole('button', { name: 'Archive Edited account' }).click()
    assert.equal(state.records.accounts.find((item) => item.data.name === 'Edited account').status, 'active')
    await page.getByRole('button', { name: 'Confirm archive' }).click()
    await page.getByText('Record archived. Its audit history is retained.').waitFor()
    await page.getByLabel('Status', { exact: true }).selectOption('archived')
    await page.getByRole('heading', { name: 'Edited account' }).waitFor()
    await go(page, 'audit')
    await page.getByRole('heading', { name: 'PATCH', exact: true }).first().waitFor()
    await go(page, 'settings')
    await page.getByLabel('Stages, one per line').fill(`${OCI_STAGES.join('\n')}\nReview pending`)
    await page.getByRole('button', { name: 'Save stages' }).click()
    await page.getByText('Pipeline stages saved.').waitFor()
    assert.equal(state.stages.at(-1), 'Review pending')
    state.apiError = true
    await go(page, 'contacts')
    await page.locator('.oci-main > .oci-notice.error').filter({ hasText: 'Offline simulated API failure' }).waitFor()
  } finally { await context.close() }
})

test('all eight authoritative module forms persist API data and live relationships; pipeline stages', { timeout: 60000 }, async () => {
  const { page, state, context } = await fixture({ records: { accounts: [record('accounts', { name: 'Real relationship account', classification: 'Verified fact' }, 'account-link')], opportunities: [record('opportunities', { name: 'Real linked opportunity', stage: 'Qualified', currency: 'EUR' }, 'opportunity-link', 'account-link')] } })
  try {
    await ready(page)
    for (const module of OCI_MODULES) {
      await go(page, module.id)
      await page.getByRole('button', { name: 'Create record' }).click()
      await fillRequired(page, module, `Test ${module.id}`)
      if (module.id !== 'accounts') {
        await page.getByRole('dialog').locator('[name="accountId"]').selectOption('account-link')
        if (module.id !== 'opportunities') await page.getByRole('dialog').getByLabel('Opportunity', { exact: true }).selectOption('opportunity-link')
      }
      await page.getByRole('button', { name: 'Save record', exact: true }).click()
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
      assert.ok(state.records[module.id].some((item) => item.data.name === `Test ${module.id}` || item.data.title === `Test ${module.id}`))
    }
    await go(page, 'opportunities')
    await page.getByLabel('View', { exact: true }).selectOption('pipeline')
    await page.locator('.oci-pipeline').waitFor()
    assert.equal(await page.locator('.oci-pipeline-stage').count(), OCI_STAGES.length)
    assert.ok(state.requests.filter((item) => item.method === 'POST' && !item.path.endsWith('/accounts')).every((item) => item.body.accountId === 'account-link'))
  } finally { await context.close() }
})

test('320–1920 responsive layouts, 2px mobile card gutters and keyboard modal focus', { timeout: 60000 }, async () => {
  const { page, context } = await fixture({ records: { accounts: [record('accounts', { name: 'A very long organisation name '.repeat(8), classification: 'Verified fact', researchNotes: 'Evidence '.repeat(40) })] } })
  try {
    await ready(page)
    for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      await page.evaluate(() => { location.hash = 'dashboard' })
      await ready(page)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Dashboard overflow at ${width}`)
      if (width <= 768) {
        for (const metric of await page.locator('.oci-metrics article').all()) {
          const bounds = await metric.boundingBox()
          assert.equal(Math.round(bounds.x), 2, `Metric left gutter at ${width}`)
          assert.equal(Math.round(width - bounds.x - bounds.width), 2, `Metric right gutter at ${width}`)
          assert.ok(bounds.height < 110, `Metric remains compact at ${width}`)
        }
      }
      await go(page, 'accounts')
      await page.locator('.oci-record-card').waitFor()
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Records overflow at ${width}`)
      if (width <= 768) {
        const bounds = await page.locator('.oci-record-card').first().boundingBox()
        assert.equal(Math.round(bounds.x), 2)
      }
      await page.getByRole('button', { name: 'Create record' }).click()
      await page.getByRole('dialog').waitFor()
      assert.ok(await page.evaluate(() => document.activeElement.closest('dialog') !== null))
      for (let index = 0; index < 30; index++) await page.keyboard.press('Tab')
      assert.ok(await page.evaluate(() => document.activeElement.closest('dialog') !== null), `Dialog focus escapes at ${width}`)
      const dialog = await page.getByRole('dialog').boundingBox()
      assert.ok(dialog.x >= 0 && dialog.x + dialog.width <= width)
      await page.keyboard.press('Escape')
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
      assert.equal(await page.getByRole('button', { name: 'Create record' }).evaluate((element) => element === document.activeElement), true)
    }
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true)
  } finally { await context.close() }
})

test('every OCI module has usable empty states and creation dialogs on desktop and narrow mobile', { timeout: 60000 }, async () => {
  const { page, context } = await fixture();
  try {
    await ready(page);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const module of OCI_MODULES) {
        await go(page, module.id);
        await page.locator(".oci-empty").waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${module.id} overflow at ${width}`);
        await page.getByRole("button", { name: "Create record", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await dialog.waitFor();
        const bounds = await dialog.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, `${module.id} dialog at ${width}`);
        await dialog.getByRole("button", { name: "Close dialog", exact: true }).click();
        await dialog.waitFor({ state: "hidden" });
      }
    }
  } finally { await context.close(); }
});

test('fine desktop cards tilt gently without inline styles and reset for reduced motion/mobile', { timeout: 30000 }, async () => {
  const { page, context } = await fixture()
  try {
    await ready(page)
    await page.setViewportSize({ width: 1440, height: 1000 })
    const card = page.locator('.oci-metrics article').first()
    const bounds = await card.boundingBox()
    await page.mouse.move(bounds.x + bounds.width - 15, bounds.y + 15)
    await page.waitForFunction(() => !!document.querySelector('.oci-tilt'))
    assert.equal(await card.getAttribute('data-tilt-x'), 'negative')
    assert.equal(await card.getAttribute('data-tilt-y'), 'positive')
    assert.equal(await card.getAttribute('style'), null)
    await page.mouse.move(0, 0)
    await page.waitForFunction(() => !document.querySelector('.oci-tilt'))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.mouse.move(bounds.x + 15, bounds.y + 15)
    await page.waitForTimeout(50)
    assert.equal(await page.locator('.oci-tilt').count(), 0)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setViewportSize({ width: 390, height: 900 })
    await card.hover()
    await page.waitForTimeout(50)
    assert.equal(await page.locator('.oci-tilt').count(), 0)
  } finally { await context.close() }
})

test('failed getUser blocks access calls; revoked API permission immediately hides commercial workspace', { timeout: 30000 }, async () => {
  const failed = await fixture({ userError: true })
  try {
    await failed.page.getByRole('alert').filter({ hasText: 'Identity verification failed' }).waitFor()
    assert.equal(failed.state.requests.length, 0)
    await failed.page.getByRole('button', { name: 'Sign out', exact: true }).waitFor()
  } finally { await failed.context.close() }
  const { page, state, context } = await fixture({ records: { accounts: [record('accounts', { name: 'Private account', classification: 'Verified fact' })] } })
  try {
    await ready(page); await go(page, 'accounts')
    await page.getByRole('heading', { name: 'Private account' }).waitFor()
    state.revoked = true
    await page.getByRole('button', { name: 'Refresh records' }).click()
    await page.getByRole('alert').filter({ hasText: 'OCI access denied' }).waitFor()
    assert.equal(await page.locator('.oci-workspace').count(), 0)
    assert.equal(await page.getByRole('heading', { name: 'Private account' }).count(), 0)
  } finally { await context.close() }
})

test('revenue actual/forecast and currencies render separately without invented totals', { timeout: 30000 }, async () => {
  const { page, context } = await fixture({ revenueSummary: { financials: [{ currency: 'EUR', basis: 'Actual', revenueClass: 'Recognised actual', dataOrigin: 'Unclassified', periodDate: '2026-10-01', amount: null, cost: null, grossMargin: null, grossMarginPercent: null, costComplete: false, marginBasis: 'Unknown', mrr: null }, { currency: 'USD', basis: 'Forecast', revenueClass: 'Speculative forecast', dataOrigin: 'Unclassified', periodDate: '2026-11-01', amount: 5000, cost: 0, grossMargin: 5000, grossMarginPercent: 100, costComplete: true, marginBasis: 'Estimated', mrr: 0 }], pipeline: [{ currency: 'GBP', countryCode: 'Unresolved', segment: 'Unclassified segment', dataOrigin: 'Unclassified', opportunityCount: 1, value: 800, weightedValue: 400, probabilityComplete: true }] } })
  try {
    await ready(page)
    await page.getByText('Recognised actual · Actual · EUR · Unclassified', { exact: true }).waitFor()
    await page.getByText('Speculative forecast · Forecast · USD · Unclassified', { exact: true }).waitFor()
    await page.getByText(/Unweighted opportunity pipeline · GBP/).waitFor()
    assert.equal(await page.locator('.oci-financial-card').count(), 3)
    assert.equal(await page.getByText('No revenue recorded', { exact: true }).count(), 0)
    const actual = page.locator('.oci-financial-card').filter({ hasText: 'Recognised actual · Actual · EUR · Unclassified' })
    assert.equal(await actual.locator('h3').textContent(), 'Not recorded')
    assert.equal(await actual.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Cost$/ }) }).locator('dd').textContent(), 'Not recorded')
    assert.equal(await actual.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Gross Margin$/ }) }).locator('dd').textContent(), 'Not recorded')
    assert.equal(await actual.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^MRR$/ }) }).locator('dd').textContent(), 'Not recorded')
    await actual.getByText('2026-10-01', { exact: true }).waitFor()
    await page.getByText('2026-11-01', { exact: true }).waitFor()
    assert.equal(await page.getByText('Optional metrics total recorded values only;', { exact: false }).count(), 2)
    await page.getByText('Estimated', { exact: true }).waitFor()
  } finally { await context.close() }
})

test('read-only record details expose full evidence, linked IDs and provenance without mutations', { timeout: 30000 }, async () => {
  const item = record('discovery', { title: 'Verified discovery', participants: 'Professional stakeholder', requirements: 'Complete implementation requirements', validatedUseCases: 'Human verified use case', validation: 'Customer-validated', validationEvidence: 'Interview reference' }, 'discovery-details', '00000000-0000-4000-8000-000000000002')
  item.opportunity_id = '00000000-0000-4000-8000-000000000003'
  const { page, state, context } = await fixture({ records: { discovery: [item] } })
  try {
    await ready(page); await go(page, 'discovery')
    await page.getByRole('button', { name: 'View Verified discovery' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByText('Complete implementation requirements', { exact: true }).waitFor()
    await dialog.getByText('Interview reference', { exact: true }).waitFor()
    await dialog.getByText(item.account_id, { exact: false }).waitFor()
    await dialog.getByText(item.opportunity_id, { exact: false }).waitFor()
    await dialog.getByText('Created by (user ID)', { exact: true }).waitFor()
    await dialog.getByText('Updated by (user ID)', { exact: true }).waitFor()
    assert.equal(await dialog.locator('input,textarea,select').count(), 0)
    assert.equal(state.requests.filter((request) => request.method !== 'GET').length, 0)
    await dialog.getByRole('button', { name: 'Close details' }).click()
    await dialog.waitFor({ state: 'hidden' })
  } finally { await context.close() }
})

test('contact privacy erasure requires irreversible confirmation, preserves IDs and disables later mutations', { timeout: 30000 }, async () => {
  const item = record('contacts', { name: 'Professional contact', email: 'professional@example.test', notes: 'Personal professional notes' }, 'contact-erase', 'account-link')
  item.status = 'archived'
  const { page, state, context } = await fixture({ records: { contacts: [item] } })
  try {
    await ready(page); await go(page, 'contacts')
    await page.getByLabel('Status', { exact: true }).selectOption('archived')
    await page.getByRole('button', { name: 'Erase personal fields for Professional contact' }).click()
    await page.getByRole('dialog').getByText('Related notes, provider logs and backups require operator privacy review.', { exact: false }).waitFor()
    assert.equal(state.requests.filter((request) => request.path.endsWith('/erase')).length, 0)
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.equal(state.records.contacts[0].data.email, 'professional@example.test')
    await page.getByRole('button', { name: 'Erase personal fields for Professional contact' }).click()
    state.conflict = true
    await page.getByRole('button', { name: 'Confirm irreversible erasure' }).click()
    await page.getByRole('alert').filter({ hasText: 'Erasure conflict' }).waitFor()
    await page.getByRole('button', { name: 'Close dialog' }).click()
    state.conflict = false
    await page.getByRole('button', { name: 'Refresh records' }).click()
    await page.getByRole('button', { name: 'Erase personal fields for Professional contact' }).click()
    await page.getByRole('button', { name: 'Confirm irreversible erasure' }).click()
    await page.getByRole('heading', { name: 'Erased contact', exact: true }).waitFor()
    assert.deepEqual(state.records.contacts[0].data, { name: 'Erased contact', privacyErased: true })
    assert.equal(state.records.contacts[0].account_id, 'account-link')
    assert.equal(state.records.contacts[0].created_by, userId)
    const card = page.locator('.oci-record-card').filter({ hasText: 'Erased contact' })
    assert.deepEqual(await card.getByRole('button').allTextContents(), ['View'])
  } finally { await context.close() }
})

test('public/customer host fails closed without any auth or commercial calls', { timeout: 30000 }, async () => {
  const context = await browser.newContext()
  await context.routeWebSocket('**/*', (socket) => socket.close())
  try {
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    let external = 0
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (url.hostname === 'app.operionos.com') {
        const response = await route.fetch({ url: `${origin}${url.pathname}${url.search}` })
        return route.fulfill({ response })
      }
      external++
      return route.abort()
    })
    await page.goto('https://app.operionos.com/oci.html')
    await page.getByRole('alert').filter({ hasText: 'available only at oci.operionos.com' }).waitFor()
    assert.equal(await page.locator('.oci-workspace').count(), 0)
    assert.equal(external, 0)
  } finally { await context.close() }
})
