import React, { useCallback, useEffect, useRef, useState } from 'react'
import { LayoutDashboard, Building2, Users, Radar, GitBranch, CalendarDays, MessagesSquare, Rocket, ChartNoAxesCombined, History, Settings2, Plus, Search, ArrowRight, X, Archive, Pencil, LogOut, RefreshCw } from 'lucide-react'
import { OCI_MODULES, OCI_STAGES } from '../../../shared/ociContracts.js'
import Auth, { Brand, Notice } from './Auth.jsx'
import { api } from './client.js'

const icons = { dashboard: LayoutDashboard, accounts: Building2, contacts: Users, market: Radar, opportunities: GitBranch, activities: CalendarDays, discovery: MessagesSquare, pilots: Rocket, revenue: ChartNoAxesCombined, audit: History, settings: Settings2 }
const navigation = [{ id: 'dashboard', label: 'Command centre' }, ...OCI_MODULES, { id: 'audit', label: 'Audit trail' }, { id: 'settings', label: 'Stage settings' }]
const titleOf = (record) => record.data?.name || record.data?.title || record.id
const readable = (value) => String(value).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
const display = (value) => value === undefined || value === null || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)
const dateTime = (value) => value ? new Date(value).toLocaleString() : '—'
const money = (value, currency) => {
  if (value === null || value === undefined) return 'Not recorded'
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value)) }
  catch { return `${display(currency)} ${Number(value).toLocaleString()}` }
}
const route = () => navigation.some((item) => item.id === location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard'

function Empty({ title = 'No records yet', children }) {
  return <div className="oci-empty"><Radar size={28} /><h3>{title}</h3><p>{children || 'Create your first real record to begin. OCI never seeds commercial data.'}</p></div>
}

function Dialog({ title, onClose, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    ref.current.showModal()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [])
  return <dialog ref={ref} className="oci-dialog" onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === ref.current) onClose() }}>
    <div className="oci-dialog-head"><h2>{title}</h2><button type="button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>
}

function RecordForm({ module, stages, record, onClose, onSaved, onFailure }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [links, setLinks] = useState({ accounts: [], opportunities: [] })
  const [loading, setLoading] = useState(module.id !== 'accounts')
  const [accountId, setAccountId] = useState(record?.account_id || '')
  const [opportunityId, setOpportunityId] = useState(record?.opportunity_id || '')
  const linked = module.id !== 'accounts'
  const opportunityLinked = !['accounts', 'opportunities'].includes(module.id)
  const requiresAccount = linked && module.id !== 'market'

  useEffect(() => {
    if (!linked) return
    const controller = new AbortController()
    async function all(kind) {
      const records = []
      for (let page = 1; ; page++) {
        const result = await api(`/records/${kind}?status=active&page=${page}&pageSize=100&sort=updated_at_desc`, { signal: controller.signal })
        records.push(...result.records)
        if (records.length >= result.total || !result.records.length) return records
      }
    }
    Promise.all([all('accounts'), opportunityLinked ? all('opportunities') : Promise.resolve([])])
      .then(([accounts, opportunities]) => { setLinks({ accounts, opportunities }); setLoading(false) })
      .catch((cause) => { if (cause.name !== 'AbortError') { setError(cause.message); setLoading(false); onFailure(cause) } })
    return () => controller.abort()
  }, [module.id])

  async function save(event) {
    event.preventDefault(); setBusy(true); setError('')
    const form = new FormData(event.currentTarget)
    const data = {}
    for (const field of module.fields) {
      const raw = form.get(field.key)
      if (raw === '' || raw === null) delete data[field.key]
      else data[field.key] = field.type === 'number' ? Number(raw) : String(raw).trim()
    }
    const body = { data, ...(linked ? { accountId: accountId || null } : {}), ...(opportunityLinked ? { opportunityId: opportunityId || null } : {}), ...(record ? { version: record.version } : {}) }
    try {
      const result = await api(`/records/${module.id}${record ? `/${encodeURIComponent(record.id)}` : ''}`, { method: record ? 'PATCH' : 'POST', body })
      onSaved(result.record)
    } catch (cause) {
      setError(cause.status === 409 ? 'This record changed since you opened it. Close this dialog and refresh before editing again. Your changes have not been saved.' : cause.message)
      onFailure(cause)
    } finally { setBusy(false) }
  }
  const choices = links.opportunities.filter((item) => !accountId || item.account_id === accountId)
  return <Dialog title={`${record ? 'Edit' : 'Create'} ${module.label.toLowerCase()}`} onClose={busy ? () => {} : onClose}>
    <p className="oci-form-intro">{module.description}</p>
    <Notice>{error}</Notice>
    {loading && <p role="status">Loading live relationship choices…</p>}
    <form className="oci-record-form" onSubmit={save}>
      {linked && <label className="oci-full">Account{requiresAccount && ' *'}<select name="accountId" aria-label="Account" required={requiresAccount} value={accountId} disabled={loading || busy} onChange={(event) => { setAccountId(event.target.value); setOpportunityId('') }}>
        <option value="">{requiresAccount ? 'Select an account' : 'No account link'}</option>
        {record?.account_id && !links.accounts.some((item) => item.id === record.account_id) && <option value={record.account_id}>Current linked account (unavailable)</option>}
        {links.accounts.map((item) => <option key={item.id} value={item.id}>{titleOf(item)}</option>)}
      </select></label>}
      {opportunityLinked && <label className="oci-full">Opportunity<select aria-label="Opportunity" value={opportunityId} onChange={(event) => setOpportunityId(event.target.value)} disabled={loading || busy}><option value="">No opportunity link</option>
        {record?.opportunity_id && !choices.some((item) => item.id === record.opportunity_id) && <option value={record.opportunity_id}>Current linked opportunity (unavailable)</option>}
        {choices.map((item) => <option key={item.id} value={item.id}>{titleOf(item)}</option>)}
      </select></label>}
      {module.fields.map((field) => {
        const props = { name: field.key, 'aria-label': field.label, required: field.required, disabled: busy, defaultValue: record?.data?.[field.key] ?? '', ...(field.type === 'number' ? { min: field.min, max: field.max, step: 'any' } : { maxLength: field.max }) }
        return <label key={field.key} className={field.type === 'textarea' ? 'oci-full' : ''}>{field.label}{field.required ? ' *' : ''}
          {field.type === 'select' ? <select {...props}><option value="">Select…</option>{(field.key === 'stage' ? stages : field.options || []).map((option) => <option key={option}>{option}</option>)}</select>
            : field.type === 'textarea' ? <textarea {...props} rows={3} /> : <input {...props} type={field.type} />}
        </label>
      })}
      <div className="oci-dialog-actions oci-full"><span>* Required fields · Saved to the live OCI store</span><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="oci-primary" disabled={busy || loading || (linked && !!error && !links.accounts.length)}>{busy ? 'Saving…' : 'Save record'}</button></div>
    </form>
  </Dialog>
}

function RecordDetails({ module, record, onClose }) {
  return <Dialog title={titleOf(record)} onClose={onClose}>
    <p className="oci-form-intro">{module.description}</p>
    <span className="oci-tag">{record.status} · Version {record.version}</span>
    <h3 className="oci-details-heading">Recorded information</h3>
    <dl className="oci-details-fields">{module.fields.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{display(record.data[field.key])}</dd></div>)}</dl>
    <h3 className="oci-details-heading">Relationships and provenance</h3>
    <dl className="oci-details-fields">
      <div><dt>Record ID</dt><dd>{record.id}</dd></div>
      <div><dt>Account ID</dt><dd>{record.account_id ? <><a href="#accounts" onClick={onClose}>View accounts</a><br />{record.account_id}</> : 'Not linked'}</dd></div>
      <div><dt>Opportunity ID</dt><dd>{record.opportunity_id ? <><a href="#opportunities" onClick={onClose}>View opportunities</a><br />{record.opportunity_id}</> : 'Not linked'}</dd></div>
      <div><dt>Created</dt><dd>{dateTime(record.created_at)}</dd></div>
      <div><dt>Created by (user ID)</dt><dd>{display(record.created_by)}</dd></div>
      <div><dt>Updated</dt><dd>{dateTime(record.updated_at)}</dd></div>
      <div><dt>Updated by (user ID)</dt><dd>{display(record.updated_by)}</dd></div>
    </dl>
    <div className="oci-dialog-actions"><button onClick={onClose}>Close details</button></div>
  </Dialog>
}

function Records({ module, stages, onFailure }) {
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('active')
  const [sort, setSort] = useState('updated_at_desc')
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [editor, setEditor] = useState(null)
  const [details, setDetails] = useState(null)
  const [archive, setArchive] = useState(null)
  const [erase, setErase] = useState(null)
  const [erasing, setErasing] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [view, setView] = useState('cards')
  const pageSize = 12
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    const params = new URLSearchParams({ search: query, status, sort, page: String(page), pageSize: String(pageSize) })
    api(`/records/${module.id}?${params}`, { signal: controller.signal }).then((result) => {
      setRecords(result.records); setTotal(result.total); setLoading(false)
    }).catch((cause) => { if (cause.name !== 'AbortError') { setError(cause.message); setLoading(false); onFailure(cause) } })
    return () => controller.abort()
  }, [module.id, query, status, sort, page, refresh])

  async function confirmArchive() {
    setArchiving(true); setError('')
    try {
      await api(`/records/${module.id}/${encodeURIComponent(archive.id)}`, { method: 'DELETE', body: { version: archive.version } })
      setArchive(null); setNotice('Record archived. Its audit history is retained.'); setRefresh((value) => value + 1)
    } catch (cause) {
      setError(cause.status === 409 ? 'Archive conflict: this record has changed. Close the dialog and refresh before trying again.' : cause.message)
      onFailure(cause)
    } finally { setArchiving(false) }
  }
  async function confirmErase() {
    setErasing(true); setError('')
    try {
      await api(`/records/contacts/${encodeURIComponent(erase.id)}/erase`, { method: 'POST', body: { version: erase.version } })
      setErase(null); setNotice('Contact personal fields erased and record archived. Related notes, provider logs and backups still require operator privacy review.'); setRefresh((value) => value + 1)
    } catch (cause) {
      setError(cause.status === 409 ? 'Erasure conflict: this contact changed or has already been erased. Close the dialog and refresh before continuing.' : cause.message)
      onFailure(cause)
    } finally { setErasing(false) }
  }
  function card(record) {
    return <article className="oci-record-card" key={record.id}>
      <div className="oci-card-top"><span className="oci-tag">{record.data.stage || record.data.accountStatus || record.data.basis || record.data.pilotStatus || record.data.activityStatus || record.status}</span><small>v{record.version}</small></div>
      <h3>{titleOf(record)}</h3>
      <dl>{module.fields.filter((field) => !['name', 'title'].includes(field.key) && record.data[field.key] !== undefined).slice(0, 5).map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{display(record.data[field.key])}</dd></div>)}</dl>
      <div className="oci-record-next">{record.data.nextAction && <p><ArrowRight size={15} />{record.data.nextAction}</p>}<small>Updated {dateTime(record.updated_at)}</small></div>
      <div className="oci-card-actions"><button onClick={() => setDetails(record)} aria-label={`View ${titleOf(record)}`}>View</button>{!record.data.privacyErased && <><button onClick={() => setEditor({ record })} disabled={record.status === 'archived'} aria-label={`Edit ${titleOf(record)}`}><Pencil size={15} /> Edit</button><button onClick={() => { setError(''); setArchive(record) }} disabled={record.status === 'archived'} aria-label={`Archive ${titleOf(record)}`}><Archive size={15} /> Archive</button>{module.id === 'contacts' && <button className="oci-danger" onClick={() => { setError(''); setErase(record) }} aria-label={`Erase personal fields for ${titleOf(record)}`}>Erase</button>}</>}</div>
    </article>
  }
  return <>
    <header className="oci-page-head"><div><p className="oci-eyebrow">COMMERCIAL WORKSPACE</p><h1>{module.label}</h1><p>{module.description}</p></div><button className="oci-primary" onClick={() => setEditor({ record: null })}><Plus size={18} /> Create record</button></header>
    <section className="oci-toolbar" aria-label="Record controls">
      <form onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); setPage(1) }}><label className="oci-search"><Search size={18} /><input aria-label="Search records" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records…" /></label><button>Search</button></form>
      <label>Status<select aria-label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select></label>
      <label>Sort<select aria-label="Sort" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }}><option value="updated_at_desc">Recently updated</option><option value="updated_at_asc">Oldest updated</option><option value="name_asc">Name A–Z</option><option value="name_desc">Name Z–A</option></select></label>
      <button aria-label="Refresh records" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={17} /></button>
      {module.id === 'opportunities' && <label>View<select aria-label="View" value={view} onChange={(event) => setView(event.target.value)}><option value="cards">Record cards</option><option value="pipeline">Pipeline</option></select></label>}
    </section>
    <Notice>{!archive && !erase && error}</Notice><Notice kind="success">{notice}</Notice>
    {loading ? <div className="oci-loading" role="status">Loading live {module.label.toLowerCase()}…</div> : error && !archive ? <Empty title="Records unavailable">Refresh to retry. Previously loaded records are not shown as current data.</Empty> : !records.length ? <Empty title={query || status !== 'active' ? 'No matching records' : 'No records yet'} /> : view === 'pipeline'
      ? <><p className="oci-footnote">Pipeline shows the current filtered page ({records.length} of {total}), not an unfiltered portfolio total. Stages are persisted; edit a record to move it.</p><div className="oci-pipeline">{[...stages, ...new Set(records.map((item) => item.data.stage).filter((stage) => !stages.includes(stage)))].map((stage) => <section key={stage || 'unset'} className="oci-pipeline-stage"><h2>{stage || 'Unassigned'} <span>{records.filter((item) => item.data.stage === stage).length}</span></h2>{records.filter((item) => item.data.stage === stage).map(card)}</section>)}</div></>
      : <div className="oci-record-grid">{records.map(card)}</div>}
    <footer className="oci-pagination"><span>{total} records · Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span><button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><button disabled={page * pageSize >= total || loading} onClick={() => setPage((value) => value + 1)}>Next</button></footer>
    {editor && <RecordForm module={module} stages={stages} record={editor.record} onClose={() => setEditor(null)} onFailure={onFailure} onSaved={() => { setEditor(null); setNotice('Record saved successfully.'); setRefresh((value) => value + 1) }} />}
    {details && <RecordDetails module={module} record={details} onClose={() => setDetails(null)} />}
    {archive && <Dialog title="Archive this record?" onClose={archiving ? () => {} : () => setArchive(null)}><p><strong>{titleOf(archive)}</strong> will leave active views. Its history remains in the audit trail. This action does not send any communication.</p><Notice>{error}</Notice><div className="oci-dialog-actions"><button disabled={archiving} onClick={() => setArchive(null)}>Cancel</button><button className="oci-danger" disabled={archiving} onClick={confirmArchive}>{archiving ? 'Archiving…' : 'Confirm archive'}</button></div></Dialog>}
    {erase && <Dialog title="Irreversibly erase contact personal fields?" onClose={erasing ? () => {} : () => setErase(null)}><p><strong>{titleOf(erase)}</strong>: this permanently replaces this contact’s personal fields with an erased-contact marker and archives the record. It cannot be undone through OCI. Relationship IDs and change provenance are retained.</p><p className="oci-form-intro">This is not a complete GDPR erasure across all systems. Related notes, provider logs and backups require operator privacy review. Confirm the lawful privacy request and scope before continuing.</p><Notice>{error}</Notice><div className="oci-dialog-actions"><button disabled={erasing} onClick={() => setErase(null)}>Cancel</button><button className="oci-danger" disabled={erasing} onClick={confirmErase}>{erasing ? 'Erasing…' : 'Confirm irreversible erasure'}</button></div></Dialog>}
  </>
}

function Financials({ summary }) {
  const financials = summary?.financials || []
  const pipeline = summary?.pipeline || []
  if (!financials.length && !pipeline.length) return <Empty title="No revenue recorded">Actuals, forecasts and weighted pipeline appear only after real entries are recorded. Currencies are never combined.</Empty>
  return <div className="oci-financial-grid">
    {financials.map((item, index) => <article className="oci-financial-card" key={`${item.currency}-${item.basis}-${item.periodDate}-${index}`}><span className="oci-tag">{item.basis} · {item.currency}</span><h3>{money(item.amount, item.currency)}</h3><dl><div><dt>Financial period</dt><dd>{item.periodDate || 'Not recorded'}</dd></div><div><dt>Margin basis</dt><dd>{item.marginBasis || 'Unknown'}</dd></div><div><dt>Cost assessment</dt><dd>{item.costComplete === true ? 'Complete' : 'Incomplete / unknown'}</dd></div>{['pilotRevenue', 'subscriptionRevenue', 'mrr', 'arr', 'annualContractValue', 'cost', 'grossMargin', 'acquisitionCost', 'lifetimeValue'].map((key) => <div key={key}><dt>{['mrr', 'arr'].includes(key) ? key.toUpperCase() : readable(key)}</dt><dd>{money(item[key], item.currency)}</dd></div>)}<div><dt>Gross margin %</dt><dd>{item.grossMarginPercent == null ? 'Unknown' : `${display(item.grossMarginPercent)}%`}</dd></div></dl><p className="oci-footnote">Optional metrics total recorded values only; partially supplied entries are not a complete portfolio measure. Financial periods are never combined.</p></article>)}
    {pipeline.map((item) => <article className="oci-financial-card" key={`pipeline-${item.currency}`}><span className="oci-tag">Pipeline · {item.currency}</span><h3>{money(item.value, item.currency)}</h3><p>Weighted value: {money(item.weightedValue, item.currency)}</p><p className="oci-footnote">Weighted by recorded manual probability. Not realized revenue.</p></article>)}
  </div>
}

function Dashboard({ onFailure }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError('')
    api('/dashboard', { signal: controller.signal }).then(setData).catch((cause) => { if (cause.name !== 'AbortError') { setError(cause.message); onFailure(cause) } })
    return () => controller.abort()
  }, [refresh])
  return <>
    <header className="oci-page-head"><div><p className="oci-eyebrow">YOUR COMMERCIAL HORIZON</p><h1>Command centre</h1><p>Real relationships. Evidence-led decisions. A clear next move.</p></div><button onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={17} /> Refresh</button></header>
    <Notice>{error}</Notice>
    {!data && !error && <p className="oci-loading" role="status">Loading your commercial position…</p>}
    {data && <><div className="oci-metrics">{Object.entries(data.metrics || {}).map(([key, value]) => <article key={key}><p>{readable(key)}</p><strong>{display(value)}</strong><span>Live OCI records</span></article>)}</div>
      <section className="oci-surface"><div className="oci-section-head"><div><p className="oci-eyebrow">KEEP MOMENTUM</p><h2>Next actions</h2></div><a href="#activities">View activities <ArrowRight size={16} /></a></div>{!data.nextActions?.length ? <Empty title="Your horizon is clear">No recorded next actions. Add follow-ups to accounts, activities or opportunities.</Empty> : <div className="oci-action-list">{data.nextActions.map((record) => <a key={record.id} href={`#${navigation.some((item) => item.id === record.kind) ? record.kind : 'activities'}`}><div><span className="oci-tag">{readable(record.kind)}</span><h3>{titleOf(record)}</h3><p>{record.data?.nextAction || record.data?.title || 'Review recorded activity'}</p></div><span>{display(record.data?.followUpDate || record.data?.dueDate)} <ArrowRight size={16} /></span></a>)}</div>}</section>
      <section className="oci-surface"><div className="oci-section-head"><div><p className="oci-eyebrow">FINANCIAL CLARITY</p><h2>Revenue and pipeline</h2><p>Actuals and forecasts remain separate, grouped by currency and recorded financial period. No inferred exchange rates.</p></div><a href="#revenue">Open revenue <ArrowRight size={16} /></a></div><Financials summary={data.revenueSummary} /></section>
    </>}
  </>
}

function Audit({ onFailure }) {
  const [events, setEvents] = useState(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setEvents(null); setError('')
    api('/audit', { signal: controller.signal }).then((result) => setEvents(result.events)).catch((cause) => { if (cause.name !== 'AbortError') { setError(cause.message); onFailure(cause) } })
    return () => controller.abort()
  }, [refresh])
  return <><header className="oci-page-head"><div><p className="oci-eyebrow">ACCOUNTABILITY</p><h1>Audit trail</h1><p>Server-recorded changes, actors and versions. Read-only history.</p></div><button onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={17} /> Refresh</button></header><Notice>{error}</Notice>{!events && !error ? <p role="status">Loading audit events…</p> : events?.length ? <div className="oci-audit-list">{events.map((event, index) => <article className="oci-surface" key={event.id || index}><h3>{readable(event.action || event.event_type || 'Change')}</h3><dl>{Object.entries(event).filter(([key]) => key !== 'id').map(([key, value]) => <div key={key}><dt>{readable(key)}</dt><dd>{display(value)}</dd></div>)}</dl></article>)}</div> : !error && <Empty title="No audit events yet">Events appear when commercial records or settings change.</Empty>}</>
}

function Settings({ onFailure, onStages }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    api('/settings/stages', { signal: controller.signal }).then((result) => { setText(result.stages.join('\n')); setLoading(false) }).catch((cause) => { if (cause.name !== 'AbortError') { setError(cause.message); setLoading(false); onFailure(cause) } })
    return () => controller.abort()
  }, [])
  async function save(event) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true)
    const stages = text.split('\n').map((value) => value.trim()).filter(Boolean)
    if (!stages.length || new Set(stages).size !== stages.length) { setError('Provide at least one stage, with no duplicate names.'); setBusy(false); return }
    try {
      const result = await api('/settings/stages', { method: 'PUT', body: { stages } })
      onStages(result.stages); setText(result.stages.join('\n')); setNotice('Pipeline stages saved.')
    } catch (cause) { setError(cause.message); onFailure(cause) }
    finally { setBusy(false) }
  }
  return <><header className="oci-page-head"><div><p className="oci-eyebrow">WORKSPACE CONFIGURATION</p><h1>Pipeline stage settings</h1><p>Manage the persisted stages used by opportunity forms and the pipeline.</p></div></header><section className="oci-surface oci-settings"><Notice>{error}</Notice><Notice kind="success">{notice}</Notice>{loading ? <p role="status">Loading stages…</p> : <form onSubmit={save} className="oci-stack"><label>Stages, one per line<textarea rows={16} value={text} onChange={(event) => setText(event.target.value)} required disabled={busy} /></label><p>Removing a stage does not silently move existing opportunities. The server validates changes; update linked opportunities before removing used stages.</p><button className="oci-primary" disabled={busy}>{busy ? 'Saving…' : 'Save stages'}</button></form>}</section></>
}

function Workspace({ identity, logout, onUnauthorized }) {
  const workspaceRef = useRef(null)
  const [current, setCurrent] = useState(route)
  const [schema, setSchema] = useState(null)
  const [stages, setStages] = useState(OCI_STAGES)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const fail = useCallback((cause) => { if (cause.status === 401 || cause.status === 403) onUnauthorized() }, [onUnauthorized])
  useEffect(() => {
    const surface = workspaceRef.current
    const eligible = matchMedia('(min-width: 769px) and (pointer: fine) and (hover: hover) and (prefers-reduced-motion: no-preference)')
    let frame = 0, active = null, pointer = null
    const reset = () => {
      if (active) { active.classList.remove('oci-tilt'); delete active.dataset.tiltX; delete active.dataset.tiltY }
      active = null
    }
    const move = (event) => {
      if (!eligible.matches || event.pointerType === 'touch') { reset(); return }
      pointer = { target: event.target, x: event.clientX, y: event.clientY }
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const card = pointer.target.closest('.oci-record-card, .oci-metrics article, .oci-financial-card')
        if (!card || !surface.contains(card)) { reset(); return }
        if (active !== card) { reset(); active = card }
        const bounds = card.getBoundingClientRect()
        const direction = (value) => value < -.2 ? 'negative' : value > .2 ? 'positive' : 'neutral'
        card.classList.add('oci-tilt')
        card.dataset.tiltX = direction((pointer.y - bounds.top) / bounds.height - .5)
        card.dataset.tiltY = direction((pointer.x - bounds.left) / bounds.width - .5)
      })
    }
    const leave = () => { cancelAnimationFrame(frame); frame = 0; reset() }
    surface.addEventListener('pointermove', move)
    surface.addEventListener('pointerleave', leave)
    eligible.addEventListener('change', leave)
    return () => {
      leave()
      surface.removeEventListener('pointermove', move)
      surface.removeEventListener('pointerleave', leave)
      eligible.removeEventListener('change', leave)
    }
  }, [])
  useEffect(() => {
    const listener = () => setCurrent(route())
    window.addEventListener('hashchange', listener)
    return () => window.removeEventListener('hashchange', listener)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setSchema(null); setError('')
    api('/schema', { signal: controller.signal }).then((result) => {
      if (!Array.isArray(result.modules) || !Array.isArray(result.stages) || !OCI_MODULES.every((item) => result.modules.some((module) => module.id === item.id && Array.isArray(module.fields)))) throw new Error('The OCI server returned an incompatible form schema.')
      setSchema(result.modules); setStages(result.stages)
    }).catch((cause) => { if (cause.name !== 'AbortError') { setError(cause.message); fail(cause) } })
    return () => controller.abort()
  }, [refresh])
  const module = schema?.find((item) => item.id === current)
  return <div className="oci-workspace" ref={workspaceRef}>
    <aside className="oci-sidebar"><Brand /><p className="oci-eyebrow">PRIVATE COMMERCIAL WORKSPACE</p><nav aria-label="OCI modules">{navigation.map((item) => { const Icon = icons[item.id]; return <a key={item.id} href={`#${item.id}`} aria-current={current === item.id ? 'page' : undefined}><Icon size={19} /><span>{item.label}</span></a> })}</nav><div className="oci-sidebar-bottom"><span className="oci-tag">Super administrator</span><p>{identity.email}</p><button onClick={logout}><LogOut size={17} /> Sign out</button></div></aside>
    <main className="oci-main" id="oci-content" tabIndex={-1}><div className="oci-topbar"><span><span className="oci-live-dot" /> Authorized private session</span><span>OCI / {navigation.find((item) => item.id === current)?.label}</span></div>
      <Notice>{error}</Notice>{error && <button onClick={() => setRefresh((value) => value + 1)}>Retry schema load</button>}
      {!schema && !error && <p className="oci-loading" role="status">Loading authorized workspace schema…</p>}
      {schema && (module ? <Records key={module.id} module={module} stages={stages} onFailure={fail} /> : current === 'audit' ? <Audit onFailure={fail} /> : current === 'settings' ? <Settings onFailure={fail} onStages={setStages} /> : <Dashboard onFailure={fail} />)}
      <footer className="oci-workspace-foot">Operion OS · Commercial Intelligence · Human-led planning, evidence-labelled research.<br />No automated outreach, AI requests or customer contract storage.</footer>
    </main>
  </div>
}

export default function App() {
  return <div className="oci-app"><a className="oci-skip" href="#oci-content">Skip to workspace</a><Auth>{(props) => <Workspace {...props} />}</Auth></div>
}
