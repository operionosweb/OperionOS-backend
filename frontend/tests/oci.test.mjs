import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
import { OCI_MODULES, OCI_STAGES } from '../../shared/ociContracts.js'

// This suite owns an ephemeral local Vite listener and intercepts every auth/API request.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const authOrigin = 'http://127.0.0.1:59998'
process.env.VITE_SUPABASE_URL = authOrigin
process.env.VITE_SUPABASE_ANON_KEY = 'oci-offline-anon-key'
process.env.VITE_API_BASE_URL = ''
let server, browser, origin
const now = Math.floor(Date.now() / 1000)
const userId = '00000000-0000-4000-8000-000000000001'
const token = (aal = 'aal2') => [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: userId, exp: now + 3600, iat: now, role: 'authenticated', aal })).toString('base64url'), 'offline-signature'].join('.')
const user = { id: userId, email: 'admin@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(), factors: [] }
const session = (aal = 'aal2') => ({ access_token: token(aal), refresh_token: 'offline-refresh', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user })
const record = (kind, data, id = `${kind}-1`, accountId = null) => ({ id, kind, data, account_id: accountId, opportunity_id: null, version: 1, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: userId, updated_by: userId })

before(async () => {
  server = await createServer({ root, configFile: path.join(root, 'vite.oci.config.js'), mode: 'oci-offline', server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false }, logLevel: 'error' })
  await server.listen()
  origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ headless: true })
})
after(async () => { await browser?.close(); await server?.close() })

async function fixture({ restore = true, denial = false, mfa = false, enrolled = true, accessError = false, userError = false, records: initial = {}, revenueSummary = { financials: [], pipeline: [] } } = {}) {
  const context = await browser.newContext()
  await context.routeWebSocket('**/*', (socket) => socket.close())
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const state = { denial, mfa, accessError, aal: mfa ? 'aal1' : 'aal2', requests: [], auth: [], records: structuredClone(initial), stages: [...OCI_STAGES], conflict: false, apiError: false, userError, revoked: false }
  if (restore) await context.addInitScript(({ stored }) => sessionStorage.setItem('operion-oci-auth', JSON.stringify(stored)), { stored: session(state.aal) })
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.origin === authOrigin) {
      state.auth.push({ path: url.pathname, method: request.method(), body: request.postDataJSON() })
      if (url.pathname.endsWith('/token')) return json(session(state.aal))
      if (url.pathname.endsWith('/logout')) return json({})
      if (url.pathname.endsWith('/user')) {
        if (state.userError) return json({ message: 'Identity verification failed' }, 401)
        return json({ ...user, factors: enrolled ? [{ id: 'factor-1', factor_type: 'totp', status: 'verified', friendly_name: 'OCI authenticator' }] : [] })
      }
      if (url.pathname.endsWith('/factors') && request.method() === 'POST') return json({ id: 'factor-new', type: 'totp', totp: { qr_code: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>', secret: 'OFFLINETESTSECRET', uri: 'otpauth://totp/OCI?secret=OFFLINETESTSECRET' } })
      if (url.pathname.endsWith('/challenge')) return json({ id: 'challenge-1', expires_at: now + 300 })
      if (url.pathname.endsWith('/verify')) { state.mfa = false; state.aal = 'aal2'; return json(session('aal2')) }
      return json({ all: [], totp: [] })
    }
    if (url.origin === origin && url.pathname.startsWith('/api/oci')) {
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
      if (path === '/dashboard') return json({ success: true, metrics: { targetOrganisations: (state.records.accounts || []).length, activeOpportunities: (state.records.opportunities || []).length }, nextActions: [], revenueSummary })
      if (path === '/settings/stages') {
        if (request.method() === 'PUT') state.stages = body.stages
        return json({ success: true, stages: state.stages })
      }
      if (path === '/audit') return json({ success: true, events: state.requests.filter((item) => ['POST', 'PATCH', 'DELETE', 'PUT'].includes(item.method)).map((item, index) => ({ id: String(index), actor_id: userId, action: item.method, entity_kind: 'records', entity_id: 'test-record', metadata: { version: 1 }, created_at: new Date().toISOString() })) })
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
    if (url.origin === origin) return route.continue()
    throw new Error(`Unexpected outbound request blocked: ${url.origin}`)
  })
  await page.goto(`${origin}/oci.html`)
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

test('restore checks getUser and server access before commercial requests; logout is tab-local', { timeout: 30000 }, async () => {
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
    assert.deepEqual(state.requests.map((item) => item.path), ['/access'])
    await page.getByLabel('Six-digit code').fill('123456')
    await page.getByRole('button', { name: 'Verify and continue' }).click()
    await ready(page)
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
    assert.equal(state.requests.length, 1)
    await page.getByLabel('Six-digit code').fill('123456')
    await page.getByRole('button', { name: 'Verify and continue' }).click()
    await ready(page)
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
    await page.getByRole('alert').filter({ hasText: 'Offline simulated API failure' }).waitFor()
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
  const { page, context } = await fixture({ revenueSummary: { financials: [{ currency: 'EUR', basis: 'Actual', periodDate: '2026-10-01', amount: null, cost: null, grossMargin: null, grossMarginPercent: null, costComplete: false, marginBasis: 'Unknown', mrr: null }, { currency: 'USD', basis: 'Forecast', periodDate: '2026-11-01', amount: 5000, cost: 0, grossMargin: 5000, grossMarginPercent: 100, costComplete: true, marginBasis: 'Estimated', mrr: 0 }], pipeline: [{ currency: 'GBP', value: 800, weightedValue: 400 }] } })
  try {
    await ready(page)
    await page.getByText('Actual · EUR', { exact: true }).waitFor()
    await page.getByText('Forecast · USD', { exact: true }).waitFor()
    await page.getByText('Pipeline · GBP', { exact: true }).waitFor()
    assert.equal(await page.locator('.oci-financial-card').count(), 3)
    assert.equal(await page.getByText('No revenue recorded', { exact: true }).count(), 0)
    const actual = page.locator('.oci-financial-card').filter({ hasText: 'Actual · EUR' })
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
