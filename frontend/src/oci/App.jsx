import React, { useCallback, useEffect, useRef, useState } from 'react'
import { LayoutDashboard, Building2, Users, Radar, GitBranch, CalendarDays, MessagesSquare, Rocket, ChartNoAxesCombined, History, Settings2, Plus, Search, ArrowRight, X, Archive, Pencil, LogOut, RefreshCw } from 'lucide-react'
import { OCI_MODULES, OCI_STAGES } from '../../../shared/ociContracts.js'
import { scoreOciAccountFit } from '../../../shared/ociAccountFit.js'
import { appendOciGeographicParams, countryLabel, countryMatchesScope, normalizeOciGeographicFilters, OCI_AVIATION_SEGMENTS, OCI_COMPANY_TYPES, OCI_COUNTRY_CODES, OCI_DEFAULT_MARKET, OCI_GEOGRAPHIC_SCOPES, serializeOciRecordForm } from '../../../shared/ociGeography.js'
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
const defaultGeography = () => ({ scope: OCI_DEFAULT_MARKET, countries: [], regions: [], cities: [], airports: [], segments: [], companyTypes: [] })
function readGeography() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('operion-oci-geography') || 'null')
    if (saved && Object.hasOwn(OCI_GEOGRAPHIC_SCOPES, saved.scope)) {
      const normalized = normalizeOciGeographicFilters({
        geoScope: saved.scope, geoCountries: saved.countries, geoRegions: saved.regions,
        geoCities: saved.cities, geoAirports: saved.airports, geoSegments: saved.segments,
        geoCompanyTypes: saved.companyTypes,
      })
      return { scope: normalized.scope, countries: normalized.countries, regions: normalized.regions,
        cities: normalized.cities, airports: normalized.airports, segments: normalized.segments,
        companyTypes: normalized.companyTypes }
    }
  } catch { /* Invalid persisted filter state is safely reset. */ }
  return defaultGeography()
}
function geographicParams(filters) {
  return appendOciGeographicParams(new URLSearchParams(), {
    scope: filters.scope, countries: filters.countries, regions: filters.regions,
    cities: filters.cities, airports: filters.airports, segments: filters.segments,
    companyTypes: filters.companyTypes,
  })
}

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

function RecordForm({ module, stages, record, initialAccountId = '', initialResearchReference = '', onClose, onSaved, onFailure }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [links, setLinks] = useState({ accounts: [], opportunities: [] })
  const [loading, setLoading] = useState(module.id !== 'accounts')
  const [accountId, setAccountId] = useState(record?.account_id || initialAccountId)
  const [opportunityId, setOpportunityId] = useState(record?.opportunity_id || '')
  const [fitDraft, setFitDraft] = useState(record?.data || {})
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
    try {
      const data = serializeOciRecordForm(module, new FormData(event.currentTarget), record?.data)
      const body = { data, ...(linked ? { accountId: accountId || null } : {}), ...(opportunityLinked ? { opportunityId: opportunityId || null } : {}), ...(record ? { version: record.version } : {}) }
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
      {module.fields.filter((field) => !field.internalOnly).map((field) => {
        const props = { name: field.key, 'aria-label': field.label, required: field.required, disabled: busy || field.readOnly,
          defaultValue: record?.data?.[field.key] ?? (module.id === 'revenue' && field.key === 'revenueClass' && record
            ? 'Unclassified legacy' : field.key === 'researchReference' ? initialResearchReference : ''),
          ...(field.type === 'number' ? { min: field.min, max: field.max, step: 'any' } : { maxLength: field.max }),
          ...(field.key.startsWith('fit') ? { onChange: (event) => setFitDraft((current) => ({ ...current, [field.key]: event.target.value })) } : {}) }
        return <label key={field.key} className={field.type === 'textarea' ? 'oci-full' : ''}>{field.label}{field.required ? ' *' : ''}
          {field.type === 'select' ? <select {...props}><option value="">Select…</option>{(field.key === 'stage' ? stages : (field.options || []).filter((option) => option !== 'Unclassified legacy' || (module.id === 'revenue' && record && !record.data?.revenueClass))).map((option) => <option key={option}>{option}</option>)}</select>
            : field.type === 'textarea' ? <textarea {...props} rows={3} /> : <input {...props} type={field.type} />}
        </label>
      })}
      {module.id === 'accounts' && <AccountFitSummary className="oci-full" data={fitDraft} />}
      {module.id === 'discovery' && initialResearchReference && <p className="oci-form-intro oci-full">This linked market research is a starting reference only, not customer validation. Record interview evidence and validation separately.</p>}
      <div className="oci-dialog-actions oci-full"><span>* Required fields · Saved to the live OCI store</span><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="oci-primary" disabled={busy || loading || (linked && !!error && !links.accounts.length)}>{busy ? 'Saving…' : 'Save record'}</button></div>
    </form>
  </Dialog>
}

function AccountFitSummary({ data, className = '' }) {
  const result = scoreOciAccountFit(data)
  return <section className={`oci-fit-summary ${className}`}>
    <p className="oci-eyebrow">EXPLAINABLE COMMERCIAL FIT · NOT SALES QUALIFICATION</p>
    <h3>{result.score === null ? 'Score unavailable' : `${result.score} / 100`}</h3>
    <p>{result.assessed} of {result.criteriaCount} criteria assessed · {result.verified} evidence-labelled verified · {result.hypotheses} hypotheses · {result.unknown} unknown</p>
    {result.score === null && result.assessed < result.minimumAssessments && <p role="status">Assess at least {result.minimumAssessments} criteria before a score is shown.</p>}
    {result.score === null && result.assessed >= result.minimumAssessments && !result.evidenceRecorded && <p role="status">Add criterion-specific source references and rationale before a score is shown.</p>}
    <dl>{result.assessments.map((item) => <div key={item.key}><dt>{item.label}</dt><dd>{item.confidence} · {item.level}</dd></div>)}</dl>
    {result.evidenceRecorded && <p className="oci-fit-evidence">{data.fitEvidence}</p>}
    <small>Weighted indicative fit only; rating labels and evidence are human-entered. Matching the aviation segment never creates a sales opportunity.</small>
  </section>
}

function RecordDetails({ module, record, onClose, onStartDiscovery }) {
  return <Dialog title={titleOf(record)} onClose={onClose}>
    <p className="oci-form-intro">{module.description}</p>
    <span className="oci-tag">{record.status} · Version {record.version}</span>
    <h3 className="oci-details-heading">Recorded information</h3>
    <dl className="oci-details-fields">{module.fields.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{display(record.data[field.key])}</dd></div>)}</dl>
    {module.id === 'accounts' && <AccountFitSummary data={record.data} />}
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
    <div className="oci-dialog-actions">{module.id === 'market' && record.account_id && <button className="oci-primary" onClick={() => onStartDiscovery(record)}>Start customer discovery</button>}<button onClick={onClose}>Close details</button></div>
  </Dialog>
}

function Records({ module, stages, geography, discoverySeed, onSeedConsumed, onStartDiscovery, onFailure, onRecordsChanged }) {
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
  const [editor, setEditor] = useState(() => discoverySeed ? { record: null, seed: discoverySeed } : null)
  const [details, setDetails] = useState(null)
  const [archive, setArchive] = useState(null)
  const [erase, setErase] = useState(null)
  const [erasing, setErasing] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [view, setView] = useState('cards')
  const pageSize = 12
  const invalidateGeography = () => { if (['accounts', 'market'].includes(module.id)) onRecordsChanged() }
  useEffect(() => { if (discoverySeed) onSeedConsumed() }, [discoverySeed, onSeedConsumed])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    const params = new URLSearchParams({ search: query, status, sort, page: String(page), pageSize: String(pageSize) })
    appendOciGeographicParams(params, geography)
    api(`/records/${module.id}?${params}`, { signal: controller.signal }).then((result) => {
      setRecords(result.records); setTotal(result.total); setLoading(false)
    }).catch((cause) => { if (cause.name !== 'AbortError') { setError(cause.message); setLoading(false); onFailure(cause) } })
    return () => controller.abort()
  }, [module.id, query, status, sort, page, refresh, geography])

  async function confirmArchive() {
    setArchiving(true); setError('')
    try {
      await api(`/records/${module.id}/${encodeURIComponent(archive.id)}`, { method: 'DELETE', body: { version: archive.version } })
      setArchive(null); setNotice('Record archived. Its audit history is retained.'); invalidateGeography(); setRefresh((value) => value + 1)
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
    {editor && <RecordForm module={module} stages={stages} record={editor.record}
      initialAccountId={editor.seed?.accountId} initialResearchReference={editor.seed?.researchReference}
      onClose={() => setEditor(null)} onFailure={onFailure} onSaved={() => { setEditor(null); setNotice('Record saved successfully.'); invalidateGeography(); setRefresh((value) => value + 1) }} />}
    {details && <RecordDetails module={module} record={details} onClose={() => setDetails(null)} onStartDiscovery={(research) => { setDetails(null); onStartDiscovery(research) }} />}
    {archive && <Dialog title="Archive this record?" onClose={archiving ? () => {} : () => setArchive(null)}><p><strong>{titleOf(archive)}</strong> will leave active views. Its history remains in the audit trail. This action does not send any communication.</p><Notice>{error}</Notice><div className="oci-dialog-actions"><button disabled={archiving} onClick={() => setArchive(null)}>Cancel</button><button className="oci-danger" disabled={archiving} onClick={confirmArchive}>{archiving ? 'Archiving…' : 'Confirm archive'}</button></div></Dialog>}
    {erase && <Dialog title="Irreversibly erase contact personal fields?" onClose={erasing ? () => {} : () => setErase(null)}><p><strong>{titleOf(erase)}</strong>: this permanently replaces this contact’s personal fields with an erased-contact marker and archives the record. It cannot be undone through OCI. Relationship IDs and change provenance are retained.</p><p className="oci-form-intro">This is not a complete GDPR erasure across all systems. Related notes, provider logs and backups require operator privacy review. Confirm the lawful privacy request and scope before continuing.</p><Notice>{error}</Notice><div className="oci-dialog-actions"><button disabled={erasing} onClick={() => setErase(null)}>Cancel</button><button className="oci-danger" disabled={erasing} onClick={confirmErase}>{erasing ? 'Erasing…' : 'Confirm irreversible erasure'}</button></div></Dialog>}
  </>
}

function Financials({ summary }) {
  const financials = summary?.financials || []
  const pipeline = summary?.pipeline || []
  if (!financials.length && !pipeline.length) return <Empty title="No revenue recorded">Actuals, forecasts and weighted pipeline appear only after real entries are recorded. Currencies are never combined.</Empty>
  return <div className="oci-financial-grid">
    {financials.map((item, index) => <article className="oci-financial-card" key={`${item.currency}-${item.basis}-${item.revenueClass}-${item.periodDate}-${item.dataOrigin}-${index}`}><span className="oci-tag">{item.revenueClass || 'Unclassified legacy'} · {item.basis} · {item.currency} · {item.countryCode ? `${item.countryCode} · ` : ''}{item.segment ? `${item.segment} · ` : ''}{item.dataOrigin || 'Unclassified'}</span><h3>{money(item.amount, item.currency)}</h3><dl><div><dt>Financial period</dt><dd>{item.periodDate || 'Not recorded'}</dd></div><div><dt>Margin basis</dt><dd>{item.marginBasis || 'Unknown'}</dd></div><div><dt>Cost assessment</dt><dd>{item.costComplete === true ? 'Complete' : 'Incomplete / unknown'}</dd></div>{['pilotRevenue', 'subscriptionRevenue', 'mrr', 'arr', 'annualContractValue', 'cost', 'grossMargin', 'acquisitionCost', 'lifetimeValue'].map((key) => <div key={key}><dt>{['mrr', 'arr'].includes(key) ? key.toUpperCase() : readable(key)}</dt><dd>{money(item[key], item.currency)}</dd></div>)}<div><dt>Gross margin %</dt><dd>{item.grossMarginPercent == null ? 'Unknown' : `${display(item.grossMarginPercent)}%`}</dd></div></dl><p className="oci-footnote">Optional metrics total recorded values only; partially supplied entries are not a complete portfolio measure. Financial periods are never combined.</p></article>)}
    {pipeline.map((item, index) => <article className="oci-financial-card" key={`pipeline-${item.currency}-${item.countryCode}-${item.segment}-${item.dataOrigin}-${index}`}><span className="oci-tag">Unweighted opportunity pipeline · {item.currency} · {item.countryCode || 'Unresolved'} · {item.segment || 'Unclassified segment'} · {item.dataOrigin || 'Unclassified'}</span><h3>{money(item.value, item.currency)}</h3><p>{item.opportunityCount} open opportunities</p><p>Weighted: {item.probabilityComplete ? money(item.weightedValue, item.currency) : 'Unavailable — at least one opportunity lacks a documented probability'}</p><p className="oci-footnote">Weighted only by recorded manual probabilities and their assumptions. This is not contracted or realized revenue.</p></article>)}
  </div>
}

function Breakdown({ title, rows, columns, empty }) {
  return <section className="oci-surface">
    <div className="oci-section-head"><div><p className="oci-eyebrow">EUROPEAN COMMERCIAL INTELLIGENCE</p><h2>{title}</h2></div></div>
    {!rows?.length ? <Empty title="No geographic records">{empty}</Empty> : <div className="oci-table-wrap"><table className="oci-data-table"><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.countryCode || row.segment || row.currency || row.kind}-${row.dataOrigin || row.origin}-${index}`}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : display(row[column.key])}</td>)}</tr>)}</tbody></table></div>}
  </section>
}

function RecommendationAcceptDialog({ recommendation, onClose, onAccepted, onFailure }) {
  const [dueDate, setDueDate] = useState(recommendation.dueDate || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function accept(event) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      await api(`/recommendations/${recommendation.kind}/${encodeURIComponent(recommendation.id)}/accept`, {
        method: 'POST',
        body: { dueDate },
      })
      onAccepted()
    } catch (cause) {
      setError(cause.status === 409 ? 'This recommendation already has a recorded action. Refresh the command centre.' : cause.message)
      onFailure(cause)
    } finally { setBusy(false) }
  }
  return <Dialog title="Accept recommendation as an action" onClose={busy ? () => {} : onClose}>
    <p className="oci-form-intro">Acceptance creates a versioned activity with its evidence and source relationship. It does not send a message or change an opportunity stage.</p>
    <div className="oci-action-evidence"><p><strong>Suggested:</strong> {recommendation.recommendedAction}</p><p><strong>Why:</strong> {recommendation.recommendationReason}</p><p><strong>Evidence:</strong> {recommendation.evidence}</p></div>
    <Notice>{error}</Notice>
    <form className="oci-stack" onSubmit={accept}>
      <label>Due date (optional)<input aria-label="Due date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={busy} /></label>
      <p className="oci-footnote">{recommendation.countryCode || 'Geography unresolved'} · {recommendation.data?.data_origin || 'Unclassified'} provenance</p>
      <div className="oci-dialog-actions"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="oci-primary" disabled={busy}>{busy ? 'Recording…' : 'Accept and record action'}</button></div>
    </form>
  </Dialog>
}

function ActionTransition({ action, onChanged, onFailure }) {
  const [mode, setMode] = useState('')
  const [reason, setReason] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const currentStatus = action.data.actionStatus
  const writableData = () => Object.fromEntries(OCI_MODULES.find((item) => item.id === 'activities').fields
    .filter((field) => !field.internalOnly && !field.readOnly && Object.hasOwn(action.data, field.key))
    .map((field) => [field.key, action.data[field.key]]))
  async function transition(nextStatus, extra = {}) {
    setBusy(true); setError('')
    const activityStatus = nextStatus === 'Completed' ? 'Completed'
      : nextStatus === 'Dismissed' ? 'Cancelled' : 'Planned'
    const data = { ...writableData(), actionStatus: nextStatus, activityStatus, ...extra }
    try {
      await api(`/records/activities/${encodeURIComponent(action.id)}`, {
        method: 'PATCH',
        body: { version: action.version, accountId: action.accountId, opportunityId: action.opportunityId, data },
      })
      setMode('')
      onChanged()
    } catch (cause) {
      setError(cause.status === 409 ? 'This action changed elsewhere. Refresh before updating it again.' : cause.message)
      onFailure(cause)
    } finally { setBusy(false) }
  }
  async function submit(event) {
    event.preventDefault()
    if (mode === 'complete') await transition('Completed', { completedDate: date, outcome: reason })
    if (mode === 'dismiss') await transition('Dismissed', { dismissalReason: reason })
    if (mode === 'snooze') await transition('Snoozed', { reviewDate: date })
  }
  const openAction = currentStatus !== 'Completed' && currentStatus !== 'Dismissed'
  return <>
    {openAction && <div className="oci-action-controls">
      {currentStatus !== 'In progress' && <button onClick={() => transition('In progress')}>Start</button>}
      <button onClick={() => { setError(''); setReason(''); setDate(new Date().toISOString().slice(0, 10)); setMode('complete') }}>Complete</button>
      <button onClick={() => { setError(''); setReason(''); setMode('dismiss') }}>Dismiss</button>
      <button onClick={() => { setError(''); setDate(''); setMode('snooze') }}>Snooze</button>
    </div>}
    {mode && <Dialog title={mode === 'complete' ? 'Complete this action' : mode === 'dismiss' ? 'Dismiss this action' : 'Snooze this action'} onClose={busy ? () => {} : () => setMode('')}>
      <p className="oci-form-intro">This records a human decision against the existing activity. The action history and audit version are retained.</p>
      <Notice>{error}</Notice>
      <form className="oci-stack" onSubmit={submit}>
        {mode === 'complete' && <label>Completion date<input type="date" aria-label="Completion date" value={date} onChange={(event) => setDate(event.target.value)} required disabled={busy} /></label>}
        {mode === 'snooze' && <label>Review date<input type="date" aria-label="Review date" value={date} onChange={(event) => setDate(event.target.value)} required disabled={busy} /></label>}
        {mode !== 'snooze' && <label>{mode === 'complete' ? 'Outcome / completion notes' : 'Reason for dismissal'}<textarea aria-label={mode === 'complete' ? 'Outcome / completion notes' : 'Reason for dismissal'} value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={4000} disabled={busy} /></label>}
        <div className="oci-dialog-actions"><button type="button" disabled={busy} onClick={() => setMode('')}>Cancel</button><button className="oci-primary" disabled={busy}>{busy ? 'Saving…' : 'Confirm'}</button></div>
      </form>
    </Dialog>}
  </>
}

function DailyActions({ data, onChanged, onFailure }) {
  const actions = data.executionActions || []
  const grouped = [
    ['Overdue actions', actions.filter((action) => action.timeBucket === 'Overdue')],
    ["Today's actions", actions.filter((action) => action.timeBucket === 'Today')],
    ['Upcoming actions', actions.filter((action) => action.timeBucket === 'Upcoming' || action.timeBucket === 'Unscheduled')],
  ]
  return <section className="oci-surface">
    <div className="oci-section-head"><div><p className="oci-eyebrow">HUMAN-RECORDED EXECUTION</p><h2>Daily action workspace</h2><p>Actions inherit the account geography. Global and unresolved actions remain visible and are labelled; completion, dismissal and snoozing require a human decision.</p></div><a href="#activities">View activity history <ArrowRight size={16} /></a></div>
    <div className="oci-action-summary" aria-label="Commercial action summary">
      <span>{data.metrics?.outstandingActions ?? 0} outstanding</span><span>{data.metrics?.overdueActions ?? 0} overdue</span>
      <span>{data.metrics?.actionsDueToday ?? 0} due today</span><span>{data.metrics?.actionsDueSoon ?? 0} due within 7 days</span>
    </div>
    {grouped.map(([heading, items]) => <section className="oci-action-group" key={heading}><h3>{heading}</h3>
      {!items.length ? <p className="oci-footnote">No {heading.toLowerCase()} in this geographic scope.</p> : items.map((action) => <article className="oci-execution-action" key={action.id}>
        <div><span className="oci-tag">{action.data.actionStatus || action.data.activityStatus} · {action.priority} · {action.geographicStatus} · {action.dataOrigin || 'Unclassified provenance'}</span>
          <h4>{action.data.title}</h4><p><strong>Account:</strong> {action.accountName || 'Linked account unavailable'}</p>
          {action.relatedRecordName && <p><strong>{action.data.relatedRecordKind === 'contacts' ? 'Related contact' : 'Source record'}:</strong> {action.relatedRecordName}</p>}
          <p><strong>Next step:</strong> {action.data.nextAction || action.data.title}</p>
          {action.data.recommendationReason && <p><strong>Why:</strong> {action.data.recommendationReason}</p>}
          {action.data.recommendationEvidence && <p><strong>Evidence:</strong> {action.data.recommendationEvidence}</p>}
          <p className="oci-footnote">{action.countryCode || 'Geography unresolved'}{action.city ? ` · ${action.city}` : ''}{action.segment ? ` · ${action.segment}` : ''} · {action.dueDate ? `Due ${action.dueDate}` : 'No date recorded'}</p>
        </div><ActionTransition action={action} onChanged={onChanged} onFailure={onFailure} />
      </article>)}
    </section>)}
    {!!data.waitingForResponse?.length && <section className="oci-action-group"><h3>Waiting for response</h3>{data.waitingForResponse.map((item) => <article className="oci-execution-action" key={item.id}>
      <div><span className="oci-tag">Recorded completed interaction · {item.geographicStatus} · {item.dataOrigin || 'Unclassified provenance'}</span><h4>{item.title}</h4>
        <p><strong>Account:</strong> {item.accountName || 'Linked account unavailable'}</p><p><strong>Interaction outcome:</strong> {item.outcome}</p>
        <p className="oci-footnote">{item.countryCode || 'Geography unresolved'}{item.city ? ` · ${item.city}` : ''} · Follow up {item.followUpDate}</p></div>
      <a href="#activities">Review activity <ArrowRight size={16} /></a>
    </article>)}</section>}
    <p className="oci-footnote">“Stale activity” means the last recorded opportunity interaction is at least {data.metrics?.staleActivityThresholdDays ?? 30} calendar days old. No interaction date is not classified as stale.</p>
  </section>
}

function Dashboard({ geography, onFailure }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [accepting, setAccepting] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError('')
    api(`/dashboard?${geographicParams(geography)}`, { signal: controller.signal }).then(setData).catch((cause) => { if (cause.name !== 'AbortError') { setError(cause.message); onFailure(cause) } })
    return () => controller.abort()
  }, [refresh, geography])
  const country = (row) => row.countryCode ? `${countryLabel(row.countryCode)} (${row.countryCode})` : 'Unresolved'
  const origin = (row) => row.dataOrigin || row.origin || 'Unclassified'
  const metricDescriptions = {
    outstandingActions: 'Accepted, in-progress, snoozed and legacy planned activity records in scope.',
    overdueActions: 'Outstanding actions whose due or snooze review date is before today.',
    actionsDueToday: 'Outstanding actions due or scheduled for review today.',
    actionsDueSoon: 'Outstanding actions due within the next seven calendar days.',
    actionsCompletedThisMonth: 'Actions recorded complete since the first day of this calendar month.',
    followUpCompletionRate: 'Completed ÷ non-cancelled activities due month-to-date; current calendar month.',
    opportunitiesWithNextAction: 'Open opportunities with a recorded next-action description.',
    opportunitiesWithoutNextAction: 'Open opportunities without a recorded next-action description.',
    opportunitiesWithoutRecentActivity: 'Open opportunities whose recorded last interaction is at least 30 calendar days old.',
    staleActivityThresholdDays: 'Documented inactivity threshold, in calendar days.',
    proposalsAwaitingDecision: 'Proposal records explicitly marked Awaiting customer.',
    pilotsAwaitingCustomerDecision: 'Pilot records explicitly proposed and awaiting customer decision.',
    validatedDiscoveriesLinkedToOpportunity: 'Customer-validated discovery records with a linked open opportunity; not a conversion rate.',
  }
  return <>
    <header className="oci-page-head"><div><p className="oci-eyebrow">YOUR COMMERCIAL HORIZON</p><h1>Command centre</h1><p>Real relationships. Evidence-led decisions. A clear next move.</p></div><button onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={17} /> Refresh</button></header>
    <Notice>{error}</Notice>
    {!data && !error && <p className="oci-loading" role="status">Loading your commercial position…</p>}
    {data && <><p className="oci-footnote">Scope: {OCI_GEOGRAPHIC_SCOPES[data.geographicScope || geography.scope]}. Metric totals are persisted records across provenance classes; see the by-origin counts below. No market estimates are inferred.</p><div className="oci-metrics">{Object.entries(data.metrics || {}).map(([key, value]) => <article key={key}><p>{readable(key)}</p><strong>{['closedOpportunityWinRate', 'followUpCompletionRate'].includes(key) && value !== null ? `${display(value)}%` : display(value)}</strong><span>{metricDescriptions[key] || (key === 'closedOpportunityWinRate' ? 'Won ÷ decided (won + lost) records · not a cohort conversion rate' : 'Selected-scope persisted records · origin breakdown below')}</span></article>)}</div>
      <Breakdown title="Target organisations by country and aviation segment" rows={data.accountsByCountry} columns={[
        { key: 'countryCode', label: 'Country', render: country }, { key: 'segment', label: 'Aviation segment' },
        { key: 'count', label: 'Organisations' }, { key: 'dataOrigin', label: 'Data origin', render: origin },
      ]} empty="Target accounts appear here once they have verified or explicitly classified account geography." />
      <Breakdown title="Target organisations by aviation segment" rows={data.accountsBySegment} columns={[
        { key: 'segment', label: 'Aviation segment' }, { key: 'count', label: 'Organisations' },
        { key: 'dataOrigin', label: 'Data origin', render: origin },
      ]} empty="No target organisation segments are recorded in this scope." />
      <Breakdown title="Verified versus unverified accounts" rows={data.accountVerification} columns={[
        { key: 'verificationStatus', label: 'Evidence status' },
        { key: 'count', label: 'Accounts' }, { key: 'dataOrigin', label: 'Data origin', render: origin },
      ]} empty="Account verification counts appear when account records exist. A verified classification requires a source and research date." />
      <Breakdown title="High-priority European target accounts" rows={data.highPriorityEuropeanAccounts} columns={[
        { key: 'name', label: 'Organisation' }, { key: 'countryCode', label: 'Country', render: country },
        { key: 'city', label: 'City' }, { key: 'segment', label: 'Aviation segment' },
        { key: 'researchStatus', label: 'Research status' },
        { key: 'fitAssessment', label: 'Commercial fit', render: (row) => {
          const fit = scoreOciAccountFit(row.fitAssessment || {})
          return fit.score === null ? `Not scored · ${fit.assessed}/${fit.criteriaCount} assessed` :
            `${fit.score}/100 · ${fit.verified} verified-labelled · ${fit.hypotheses} hypotheses · ${fit.unknown} unknown`
        } },
        { key: 'dataOrigin', label: 'Data origin', render: origin },
      ]} empty="No explicitly high-priority European target accounts match the selected filters." />
      <Breakdown title="Accounts awaiting research or verification" rows={data.accountsAwaitingResearch} columns={[
        { key: 'name', label: 'Organisation' }, { key: 'countryCode', label: 'Country', render: country },
        { key: 'segment', label: 'Aviation segment' }, { key: 'researchStatus', label: 'Research status' },
        { key: 'dataOrigin', label: 'Data origin', render: origin },
      ]} empty="No target accounts are marked as not researched or needing verification." />
      <Breakdown title="Qualified opportunities by country" rows={data.opportunitiesByCountry} columns={[
        { key: 'countryCode', label: 'Country', render: country }, { key: 'count', label: 'Qualified opportunities' },
        { key: 'dataOrigin', label: 'Data origin', render: origin },
      ]} empty="Qualified opportunity records inherit geography from their linked account." />
      <Breakdown title="Commercial pipeline by country and currency" rows={data.pipelineByCountry} columns={[
        { key: 'countryCode', label: 'Country', render: country }, { key: 'segment', label: 'Aviation segment' }, { key: 'currency', label: 'Currency' },
        { key: 'value', label: 'Pipeline', render: (row) => money(row.value, row.currency) },
        { key: 'weightedValue', label: 'Weighted', render: (row) => row.probabilityComplete ? money(row.weightedValue, row.currency) : 'Unavailable · incomplete probability coverage' },
        { key: 'dataOrigin', label: 'Data origin', render: origin },
      ]} empty="Open opportunities with account geography and recorded currency/value appear here." />
      <Breakdown title="Discovery activity by country" rows={data.discoveryByCountry} columns={[
        { key: 'countryCode', label: 'Country', render: country }, { key: 'count', label: 'Discovery records' },
        { key: 'dataOrigin', label: 'Data origin', render: origin },
      ]} empty="Discovery records inherit geography from their linked account." />
      <Breakdown title="Customer-validated problems" rows={data.validatedCustomerProblems} columns={[
        { key: 'countryCode', label: 'Country', render: country }, { key: 'count', label: 'Validated problems' },
        { key: 'dataOrigin', label: 'Data origin', render: origin },
      ]} empty="Only discovery records with customer validation, evidence and a recorded problem are counted." />
      <Breakdown title="Potential pilot candidates · discovery evidence only" rows={data.potentialPilotCandidates} columns={[
        { key: 'countryCode', label: 'Country', render: country }, { key: 'count', label: 'Linked accounts' },
        { key: 'dataOrigin', label: 'Data origin', render: origin },
      ]} empty="Candidates require customer-validated problems, evidence, a Contract Intelligence need and a validated use case; this does not create an opportunity or pilot." />
      <Breakdown title="Pilots and proposals by country" rows={data.pilotsByCountry} columns={[
        { key: 'countryCode', label: 'Country', render: country }, { key: 'offerType', label: 'Type' },
        { key: 'count', label: 'Records' }, { key: 'dataOrigin', label: 'Data origin', render: origin },
      ]} empty="Pilots and proposals inherit geography from their linked account." />
      <Breakdown title="Revenue by country, segment, currency and classification" rows={data.revenueByCountry} columns={[
        { key: 'countryCode', label: 'Country', render: country }, { key: 'segment', label: 'Aviation segment' }, { key: 'currency', label: 'Currency' },
        { key: 'revenueClass', label: 'Commercial classification' }, { key: 'basis', label: 'Historical / forecast basis' }, { key: 'periodDate', label: 'Period' },
        { key: 'amount', label: 'Amount', render: (row) => money(row.amount, row.currency) },
        { key: 'dataOrigin', label: 'Data origin', render: origin },
      ]} empty="Revenue is shown only when its linked account has a resolved country; currencies and actual/forecast basis remain separate." />
      <Breakdown title="Priority European opportunities" rows={data.priorityOpportunities} columns={[
        { key: 'accountName', label: 'Organisation' }, { key: 'name', label: 'Opportunity' },
        { key: 'countryCode', label: 'Country', render: country }, { key: 'priority', label: 'Account priority' },
        { key: 'currency', label: 'Currency' }, { key: 'value', label: 'Value', render: (row) => money(row.value, row.currency) },
        { key: 'dataOrigin', label: 'Data origin', render: origin },
      ]} empty="No open opportunity has an explicit account priority yet; OCI does not infer a ranking." />
      <Breakdown title="Data provenance in selected scope" rows={data.dataOrigins} columns={[
        { key: 'origin', label: 'Data origin' }, { key: 'records', label: 'All records' },
        { key: 'targetOrganisations', label: 'Target organisations' },
        { key: 'qualifiedOpportunities', label: 'Qualified opportunities' },
        { key: 'openOpportunities', label: 'Open opportunities' },
        { key: 'discoveryRecords', label: 'Discovery' },
        { key: 'pilotProposalRecords', label: 'Pilots / proposals' },
        { key: 'revenueRecords', label: 'Revenue records' },
      ]} empty="No active records match this scope." />
      {!!data.unresolvedCoverage?.length && <Breakdown title="Unresolved geographic records (outside selected-scope totals)" rows={data.unresolvedCoverage} columns={[
        { key: 'kind', label: 'Record type', render: (row) => readable(row.kind) },
        { key: 'records', label: 'Records' }, { key: 'origin', label: 'Data origin', render: origin },
      ]} empty="All records have resolved geography." />}
      <section className="oci-surface"><div className="oci-section-head"><div><p className="oci-eyebrow">HUMAN-APPROVED COMMERCIAL WORK</p><h2>Founder action centre</h2><p>Prioritised from explicit record status, dates and evidence. Recommendations stay proposed until a human accepts them; OCI never sends messages or changes stages automatically.</p></div><a href="#activities">View activities <ArrowRight size={16} /></a></div>{!data.nextActions?.length ? <Empty title="No action recommendations">Record research, decision dates and follow-ups to generate evidence-based next steps.</Empty> : <div className="oci-action-list">      {data.nextActions.map((recommendation) => <article key={recommendation.recommendationId || recommendation.id} className="oci-action-recommendation"><div><span className="oci-tag">{readable(recommendation.kind)} · {recommendation.urgency} · {recommendation.data?.data_origin || 'Review provenance'}</span><h3>{recommendation.accountName || titleOf(recommendation)}</h3>{recommendation.kind === 'contacts' && recommendation.sourceName && <p><strong>Relevant contact:</strong> {recommendation.sourceName}</p>}<p><strong>Why:</strong> {recommendation.recommendationReason}</p><p><strong>Evidence:</strong> {recommendation.evidence}</p><p><strong>Suggested action:</strong> {recommendation.recommendedAction}</p><p className="oci-footnote">{recommendation.countryCode || 'Geography unresolved'}{recommendation.city ? ` · ${recommendation.city}` : ''}{recommendation.segment ? ` · ${recommendation.segment}` : ''}{recommendation.dueDate ? ` · Due ${recommendation.dueDate}` : ''}</p></div><div className="oci-recommendation-controls"><a href={`#${navigation.some((item) => item.id === recommendation.kind) ? recommendation.kind : 'activities'}`} aria-label={`Review ${titleOf(recommendation)}`}>Review <ArrowRight size={16} /></a><button className="oci-primary" onClick={() => setAccepting(recommendation)}>Accept as action</button></div></article>)}</div>}</section>
      <DailyActions data={data} onChanged={() => setRefresh((value) => value + 1)} onFailure={onFailure} />
      <section className="oci-surface"><div className="oci-section-head"><div><p className="oci-eyebrow">FINANCIAL CLARITY</p><h2>Revenue and pipeline</h2><p>Actuals and forecasts remain separate, grouped by currency and recorded financial period. No inferred exchange rates.</p></div><a href="#revenue">Open revenue <ArrowRight size={16} /></a></div><Financials summary={data.revenueSummary} /></section>
    </>}
    {accepting && <RecommendationAcceptDialog recommendation={accepting} onClose={() => setAccepting(null)}
      onAccepted={() => { setAccepting(null); setRefresh((value) => value + 1) }} onFailure={onFailure} />}
  </>
}

function GeographyFilters({ filters, onChange, onFailure, dataRevision }) {
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [countrySearch, setCountrySearch] = useState('')
  const [citySearch, setCitySearch] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    api(`/geography/options?geoScope=${encodeURIComponent(filters.scope)}`, { signal: controller.signal })
      .then((result) => { setOptions(result.options || []); setTruncated(result.truncated === true); setLoading(false) })
      .catch((cause) => { if (cause.name !== 'AbortError') { setError(cause.message); setLoading(false); onFailure(cause) } })
    return () => controller.abort()
  }, [filters.scope, onFailure, refresh, dataRevision])
  const scopedCountries = OCI_COUNTRY_CODES.filter((code) => filters.scope === 'GLOBAL' || countryMatchesScope(code, filters.scope))
  const visibleCountries = scopedCountries.filter((code) => `${countryLabel(code)} ${code}`.toLowerCase().includes(countrySearch.toLowerCase()))
  const selectedCountrySet = new Set(filters.countries)
  const filteredOptions = options.filter((item) => (!filters.countries.length || filters.countries.includes(item.country_code)) &&
    (!filters.regions.length || filters.regions.includes(item.administrative_region)))
  const regions = [...new Set(filteredOptions.map((item) => item.administrative_region).filter(Boolean))].sort()
  const cities = [...new Set(filteredOptions.filter((item) => !filters.regions.length || filters.regions.includes(item.administrative_region)).map((item) => item.city).filter(Boolean))].sort()
  const airports = [...new Set(filteredOptions.filter((item) => !filters.cities.length || filters.cities.includes(item.city)).flatMap((item) => item.airports || [item.airport]).filter(Boolean))].sort()
  const toggle = (key, value, clear = []) => {
    const selected = filters[key].includes(value)
    onChange({ ...filters, ...Object.fromEntries(clear.map((item) => [item, []])), [key]: selected ? filters[key].filter((item) => item !== value) : [...filters[key], value] })
  }
  const clearGeography = (scope) => onChange({ ...defaultGeography(), scope })
  return <section className="oci-geography" aria-label="Geographic filters">
    <div className="oci-geography-heading"><div><p className="oci-eyebrow">COMMERCIAL MARKET SCOPE</p><strong>{OCI_GEOGRAPHIC_SCOPES[filters.scope]}</strong><span>{filters.countries.length ? filters.countries.map(countryLabel).join(', ') : 'All countries in selected scope'}</span></div>
      <button type="button" onClick={() => clearGeography(OCI_DEFAULT_MARKET)}>Reset filters</button></div>
    <div className="oci-geography-controls">
      <label>Market scope<select aria-label="Market scope" value={filters.scope} onChange={(event) => {
        const scope = event.target.value
        const countries = filters.countries.filter((code) => scope === 'GLOBAL' || countryMatchesScope(code, scope))
        onChange({ ...filters, scope, countries, regions: [], cities: [], airports: [] })
      }}>{Object.entries(OCI_GEOGRAPHIC_SCOPES).map(([value, label]) => <option key={value} value={value}>{label}{value === 'GLOBAL' ? ' · secondary' : ''}</option>)}</select></label>
      <label>Search countries<input aria-label="Search countries" value={countrySearch} onChange={(event) => setCountrySearch(event.target.value)} placeholder="Country or ISO code" /></label>
      <label>Search cities<input aria-label="Search cities" value={citySearch} onChange={(event) => setCitySearch(event.target.value)} placeholder="City" /></label>
    </div>
    <div className="oci-geography-facets">
      <fieldset><legend>Countries · multi-select</legend><div className="oci-geography-options">{visibleCountries.map((code) => <label key={code}><input type="checkbox" checked={selectedCountrySet.has(code)} onChange={() => toggle('countries', code, ['regions', 'cities', 'airports'])} />{countryLabel(code)}</label>)}</div></fieldset>
      <fieldset><legend>Regions / states</legend><div className="oci-geography-options">{(loading ? [] : regions).map((region) => <label key={region}><input type="checkbox" checked={filters.regions.includes(region)} onChange={() => toggle('regions', region, ['cities', 'airports'])} />{region}</label>)}</div>{!loading && !regions.length && <small>Region data unavailable for this scope.</small>}</fieldset>
      <fieldset><legend>Cities</legend><div className="oci-geography-options">{(loading ? [] : cities.filter((city) => city.toLowerCase().includes(citySearch.toLowerCase()))).map((city) => <label key={city}><input type="checkbox" checked={filters.cities.includes(city)} onChange={() => toggle('cities', city, ['airports'])} />{city}</label>)}</div>{!loading && !cities.length && <small>City data unavailable for this scope.</small>}</fieldset>
      <fieldset><legend>Airports</legend><div className="oci-geography-options">{(loading ? [] : airports).map((airport) => <label key={airport}><input type="checkbox" checked={filters.airports.includes(airport)} onChange={() => toggle('airports', airport)} />{airport}</label>)}</div>{!loading && !airports.length && <small>Airport data unavailable for this scope.</small>}</fieldset>
      {[[ 'segments', 'Aviation segments', OCI_AVIATION_SEGMENTS ], ['companyTypes', 'Company types', OCI_COMPANY_TYPES ]].map(([key, label, values]) => <fieldset key={key}><legend>{label}</legend><div className="oci-geography-options">{values.map((value) => <label key={value}><input type="checkbox" checked={filters[key].includes(value)} onChange={() => toggle(key, value)} />{value}</label>)}</div></fieldset>)}
    </div>
    {loading && <p role="status">Loading available account geography…</p>}
    {error && <Notice>{error}</Notice>}
    {error && <button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} /> Retry geographic options</button>}
    {truncated && <p className="oci-geography-active" role="status">Geographic choices are limited to the first 2,000 stored facets.</p>}
    <p className="oci-geography-active">Active filters: {[...filters.countries.map(countryLabel), ...filters.regions, ...filters.cities, ...filters.airports, ...filters.segments, ...filters.companyTypes].join(' · ') || 'None beyond market scope'}{!loading && options.some((item) => item.kind === 'market') ? ' · Market entries show research coverage, not verified company locations.' : ''}</p>
  </section>
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
  const [geography, setGeography] = useState(readGeography)
  const [geographyRevision, setGeographyRevision] = useState(0)
  const [discoverySeed, setDiscoverySeed] = useState(null)
  const [schema, setSchema] = useState(null)
  const [stages, setStages] = useState(OCI_STAGES)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const fail = useCallback((cause) => { if (cause.status === 401 || cause.status === 403) onUnauthorized() }, [onUnauthorized])
  const consumeDiscoverySeed = useCallback(() => setDiscoverySeed(null), [])
  const startDiscoveryFromResearch = useCallback((research) => {
    if (!research.account_id) return
    const data = research.data || {}
    setDiscoverySeed({
      accountId: research.account_id,
      researchReference: [
        `Market research record: ${data.title || research.id}`,
        `Source: ${data.source || 'Not recorded'}`,
        `Research date: ${data.researchDate || 'Not recorded'}`,
        "Research remains a hypothesis until independently validated with a customer.",
      ].join("\n"),
    })
    location.hash = "discovery"
  }, [])
  useEffect(() => { sessionStorage.setItem('operion-oci-geography', JSON.stringify(geography)) }, [geography])
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
      {schema && !['audit', 'settings'].includes(current) && <GeographyFilters filters={geography} onChange={setGeography} onFailure={fail} dataRevision={geographyRevision} />}
      {schema && (module ? <Records key={module.id} module={module} stages={stages} geography={geography}
        discoverySeed={current === 'discovery' ? discoverySeed : null} onSeedConsumed={consumeDiscoverySeed}
        onStartDiscovery={startDiscoveryFromResearch} onFailure={fail}
        onRecordsChanged={() => setGeographyRevision((value) => value + 1)} /> : current === 'audit' ? <Audit onFailure={fail} /> : current === 'settings' ? <Settings onFailure={fail} onStages={setStages} /> : <Dashboard geography={geography} onFailure={fail} />)}
      <footer className="oci-workspace-foot">Operion OS · Commercial Intelligence · Human-led planning, evidence-labelled research.<br />No automated outreach, AI requests or customer contract storage.</footer>
    </main>
  </div>
}

export default function App() {
  return <div className="oci-app"><a className="oci-skip" href="#oci-content">Skip to workspace</a><Auth>{(props) => <Workspace {...props} />}</Auth></div>
}
