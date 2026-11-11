import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/apiClient";
import { useAuth } from "../context/AuthContext";
import "../styles/admin.css";

const base = "/api/platform-admin";
const links = [
  ["/app/admin", "Command Centre"], ["/app/admin/users", "Users"],
  ["/app/admin/organizations", "Companies & tenants"], ["/app/admin/analytics", "Analytics"],
  ["/app/internal/commercial-intelligence", "Commercial Intelligence"], ["/app/admin/blog", "Publishing Studio"],
];
function Panel({ title, children }) {
  return <section className="op-admin-panel"><h2>{title}</h2>{children}</section>;
}
function ErrorNotice({ error }) { return error ? <p role="alert" className="op-admin-error">{error}</p> : null; }
function DateValue({ value }) { return value ? <time dateTime={value}>{new Date(value).toLocaleString()}</time> : "Not recorded"; }
function Pagination({ page, total, onPage }) {
  return <div className="op-admin-actions"><button disabled={page === 1} onClick={() => onPage(page - 1)}>Previous</button><span>Page {page} / {Math.max(1, Math.ceil(total / 25))}</span><button disabled={page * 25 >= total} onClick={() => onPage(page + 1)}>Next</button></div>;
}
function Events({ events = [] }) {
  return events.length ? <ol className="op-admin-events">{events.map(event => <li key={event.id}><strong>{event.action.replaceAll("_", " ")}</strong><small>{event.entity_type} <DateValue value={event.created_at} /></small></li>)}</ol> : <p>No recorded activity in this scope.</p>;
}
function ContractIntelligence() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    apiRequest(`${base}/contract-intelligence`, { signal: controller.signal }).then(setData).catch(e => {
      if (!controller.signal.aborted) setError(e.message);
    });
    return () => controller.abort();
  }, []);
  return <Panel title="Global contract intelligence">
    <p>Platform-wide aggregate records only; no customer contract text or individual identities are shown. Historical analysis runs can produce repeated findings.</p>
    <ErrorNotice error={error} />
    {!data && !error && <p role="status">Loading contract intelligence...</p>}
    {data && <><p className="op-admin-muted">Generated <DateValue value={data.generatedAt} />. Missing source tables are unavailable, not zero.</p>
      <div className="op-admin-metrics">{data.metrics.map(metric => <article key={metric.key}>
        <span>{metric.label}</span><strong className={metric.available ? undefined : "op-admin-metric-unavailable"}>{metric.available ? metric.value : "Unavailable"}</strong><small>{metric.source}</small>
      </article>)}</div></>}
    <p>Cross-customer peer benchmarking is unavailable until an approved disclosure policy, eligible data and audited privacy controls are in place.</p>
  </Panel>;
}
function Overview({ analytics = false }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [health, setHealth] = useState(null);
  const healthRequest = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError("");
    apiRequest(`${base}/summary?days=${days}`, { signal: controller.signal }).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [days]);
  async function checkHealth() {
    const request = ++healthRequest.current;
    setError(""); setHealth(null);
    try {
      const result = await apiRequest("/api/admin/health");
      if (request === healthRequest.current) setHealth(result);
    } catch (e) {
      if (request === healthRequest.current) setError(e.message);
    }
  }
  return <>
    <div className="op-admin-actions"><label>Activity window <select value={days} onChange={e => setDays(Number(e.target.value))}>{[7, 30, 90].map(n => <option key={n} value={n}>{n} days</option>)}</select></label><button onClick={checkHealth}>Check protected API health</button>{health && <span role="status">Admin access: {health.admin_system} · <DateValue value={health.timestamp} />. Blog and OCI persistence not checked.</span>}</div>
    <ErrorNotice error={error} />
    <ContractIntelligence />
    {!data && !error && <p role="status">Loading verified platform aggregates...</p>}
    {data && <>
      <p className="op-admin-muted">Actual database counts, generated <DateValue value={data.generatedAt} />. Window applies to sign-ins and administrative events; inventory totals are all-time.</p>
      <div className="op-admin-metrics">{Object.entries(data.metrics).map(([key, value]) => <article key={key}><span>{key.replaceAll("_", " ")}</span><strong>{value}</strong><small>{data.sources[key]}</small></article>)}</div>
      <div className="op-admin-columns"><Panel title="Administrative activity · UTC">
        {data.activity.length ? <figure className="op-admin-chart"><figcaption>Recorded events per day; absent days have no recorded events.</figcaption>{data.activity.map(item => <div key={item.day}><span>{item.day}</span><meter min="0" max={Math.max(1, ...data.activity.map(a => a.events))} value={item.events}>{item.events}</meter><strong>{item.events}</strong></div>)}</figure> : <p>No recorded administrative events in this window.</p>}
      </Panel><Panel title="Recent administrative events"><Events events={data.events} /></Panel></div>
      <Panel title="Readiness and source boundaries"><ul>{data.dependencies.map(d => <li key={d.name}><code>{d.name}</code>: {d.available ? "Schema object present; not a data-quality certification" : "Unavailable: schema object not found"}</li>)}</ul>{data.unavailable.map(item => <p key={item}>{item}</p>)}</Panel>
      {analytics && <Panel title="Intelligence workspaces"><p>Customer contract, aviation, fuel, indexation and risk analysis remain membership-scoped. Platform aggregates do not authorize reading customer documents.</p><div className="op-admin-actions"><Link to="/app/aviation">Aviation intelligence</Link><Link to="/app/contracts">Contract analytics</Link><Link to="/app/internal/commercial-intelligence">Commercial analytics</Link><Link to="/demo/intelligence">Clearly labelled synthetic Demo</Link></div><p>Outcome backtesting, external observations and durable recommendations require their approved schema and real evidence. No calibrated forecast or unavailable conversion metric is fabricated.</p></Panel>}
    </>}
  </>;
}
function Users() {
  const { user: actor } = useAuth();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError("");
    apiRequest(`${base}/users?page=${page}&search=${encodeURIComponent(search)}&status=${status}`, { signal: controller.signal }).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [page, search, status, revision]);
  async function inspect(id) {
    setError("");
    try { setSelected(await apiRequest(`${base}/users/${id}`)); } catch (e) { setError(e.message); }
  }
  async function action(path, method, body) {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await apiRequest(`${base}${path}`, { method, body });
      setMessage(result.message || "Change recorded. Refresh profile to inspect the current account.");
      setRevision(n => n + 1); setSelected(null);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function userAction(event, user) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const operation = f.get("operation");
    const reason = f.get("reason");
    if (!window.confirm(`Confirm ${operation} for ${user.email}? This is an auditable administrative operation.`)) return;
    if (operation === "recovery") action(`/users/${user.id}/recovery`, "POST", { reason });
    if (operation === "deactivate" || operation === "reactivate") action(`/users/${user.id}/status`, "PATCH", { active: operation === "reactivate", reason });
    if (operation === "grant-superadmin" || operation === "revoke-superadmin") action(`/users/${user.id}/platform-role`, "PUT", { status: operation === "grant-superadmin" ? "active" : "revoked", reason });
  }
  return <>
    <ErrorNotice error={error} />{message && <p role="status">{message}</p>}
    <div className="op-admin-columns"><Panel title="Auth account directory">
      <label>Search users<input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label><label>Account status<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>{["all", "active", "deactivated", "unconfirmed"].map(s => <option key={s}>{s}</option>)}</select></label>
      {!data && !error && <p role="status">Loading accounts...</p>}
      {data && <><div className="op-admin-table"><table><thead><tr><th>User</th><th>Status</th><th>Organizations</th><th>Registered</th><th>Last sign-in</th></tr></thead><tbody>{data.users.map(u => <tr key={u.id}><td><button className="op-admin-link" onClick={() => inspect(u.id)}>{u.full_name || "Profile incomplete"}</button><small>{u.email}</small><small>{u.roles.filter(r => r.status === "active").map(r => r.role).join(", ") || "No platform role"}</small></td><td>{u.deactivated ? "Deactivated" : u.email_confirmed_at ? "Confirmed" : "Awaiting email confirmation"}</td><td>{u.organizations.map(o => `${o.name} (${o.status})`).join(", ") || "No assignment"}</td><td><DateValue value={u.created_at} /></td><td><DateValue value={u.last_sign_in_at} /></td></tr>)}</tbody></table></div>{!data.users.length && <p>No matching Auth accounts.</p>}<Pagination page={page} total={data.total} onPage={setPage} /></>}
    </Panel><Panel title="Create account & request setup email">
      <p>Uses Supabase Auth Admin API, no supplied password or auto-confirmation. The recipient establishes their own password. SMTP delivery and signup callback prerequisites still apply.</p>
      <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); action("/users", "POST", Object.fromEntries(f)); }}>
        <label>Business email<input type="email" name="email" required maxLength={254} /></label><label>Full name<input name="full_name" maxLength={120} /></label><label>Administrative reason<textarea name="reason" required maxLength={500} /></label><button disabled={busy}>Create Auth account & send setup</button>
      </form>
    </Panel></div>
    {selected && <Panel title={selected.user.full_name || "User profile incomplete"}><p>{selected.user.email} · <code>{selected.user.id}</code></p><p>No password, token or Auth secret is exposed.</p>
      <form onSubmit={e => userAction(e, selected.user)}><label>Operation<select name="operation"><option value="recovery">Send setup/recovery email</option>{selected.user.id !== actor?.id && <><option value="deactivate">Deactivate account</option><option value="reactivate">Reactivate account</option><option value="grant-superadmin">Grant SUPERADMIN</option><option value="revoke-superadmin">Revoke SUPERADMIN</option></>}</select></label><label>Reason<textarea name="reason" required maxLength={500} /></label><button disabled={busy}>Review & confirm change</button></form><h3>Recorded audit history</h3><Events events={selected.history} />
    </Panel>}
  </>;
}
function Organizations() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController(); setData(null); setError("");
    apiRequest(`${base}/organizations?page=${page}&search=${encodeURIComponent(search)}`, { signal: c.signal }).then(setData).catch(e => { if (!c.signal.aborted) setError(e.message); });
    return () => c.abort();
  }, [page, search, revision]);
  async function inspect(id) {
    try { setSelected(await apiRequest(`${base}/organizations/${id}`)); } catch (e) { setError(e.message); }
  }
  async function save(event, path, method) {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    if (!window.confirm("Confirm this auditable organization/membership change? Membership grants access to this tenant's data.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const target = path.endsWith("/members") ? `${path}/${encodeURIComponent(input.user_id)}` : path;
      await apiRequest(`${base}${target}`, { method, body: input });
      setMessage("Change recorded."); setRevision(n => n + 1); if (selected) await inspect(selected.organization.id);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <>
    <ErrorNotice error={error} />{message && <p role="status">{message}</p>}
    <p>Organizations are the existing company/tenant identity. Commercial prospects remain separate; no duplicate tenant table is created. Subscription and payment status are unavailable without a verified billing source.</p>
    <div className="op-admin-columns"><Panel title="Company & tenant directory"><label>Search companies<input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label>
      {!data && !error && <p role="status">Loading organizations...</p>}{data && <><div className="op-admin-table"><table><thead><tr><th>Company / tenant</th><th>Status</th><th>Active members</th><th>Contracts</th></tr></thead><tbody>{data.organizations.map(o => <tr key={o.id}><td><button className="op-admin-link" onClick={() => inspect(o.id)}>{o.name}</button><small>{o.slug}</small></td><td>{o.status}</td><td>{o.users}</td><td>{o.contracts}</td></tr>)}</tbody></table></div><Pagination page={page} total={data.total} onPage={setPage} /></>}
    </Panel><Panel title="Create company / organization"><form onSubmit={e => save(e, "/organizations", "POST")}><label>Name<input name="name" required maxLength={160} /></label><label>Unique slug<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} /></label><label>Reason<textarea name="reason" required maxLength={500} /></label><button disabled={busy}>Create company</button></form></Panel></div>
    {selected && <Panel title={selected.organization.name}>
      <form key={selected.organization.id + selected.organization.updated_at} onSubmit={e => save(e, `/organizations/${selected.organization.id}`, "PUT")}><label>Company name<input name="name" required defaultValue={selected.organization.name} /></label><label>Slug<input name="slug" required defaultValue={selected.organization.slug} /></label><label>Status<select name="status" defaultValue={selected.organization.status}><option>active</option><option>suspended</option></select></label><label>Reason<textarea name="reason" required maxLength={500} /></label><button disabled={busy}>Save company details</button></form>
      <h3>Tenant membership</h3><ul>{selected.members.map(m => <li key={m.user_id}>{m.full_name || m.email} · <code>{m.user_id}</code> · {m.role} / {m.status}</li>)}</ul>
      <form onSubmit={e => save(e, `/organizations/${selected.organization.id}/members`, "PUT")}><label>Existing Auth user UUID<input name="user_id" required /></label><label>Organization role<select name="role"><option>CUSTOMER_USER</option><option>CUSTOMER_ADMIN</option></select></label><label>Membership status<select name="status"><option>active</option><option>suspended</option><option>removed</option></select></label><label>Reason<textarea name="reason" required maxLength={500} /></label><button disabled={busy}>Assign / update membership</button></form><h3>Organization activity</h3><Events events={selected.events} />
    </Panel>}
  </>;
}
export default function AdminCommandCentre({ section = "overview" }) {
  return <div className="op-admin"><header className="op-admin-hero"><p>OPERION / PLATFORM OPERATIONS</p><h1>{({ overview: "Super Admin Command Centre", users: "User administration", organizations: "Companies & tenants", analytics: "Intelligence & platform analytics" })[section]}</h1><p>Verified sources. Deliberate access. Aviation intelligence operations.</p></header>
    <nav className="op-admin-tabs" aria-label="Super Admin sections">{links.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}</nav>
    {section === "users" ? <Users /> : section === "organizations" ? <Organizations /> : <Overview analytics={section === "analytics"} />}
  </div>;
}
