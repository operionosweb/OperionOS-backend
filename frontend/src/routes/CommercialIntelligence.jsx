import React, { useEffect, useState } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { ArrowRight, Plus, Sparkles } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import {
  createCommercialCompany, createCommercialOpportunity, createCommercialPerson,
  createCommercialSignal, createCommercialSource, getCommercialCompany,
  getCommercialDashboard, getCommercialOpportunity, linkCommercialSource,
  listCommercialCompanies, listCommercialOpportunities, listCommercialPeople,
  reasonCommercialOpportunity, updateCommercialOpportunity,
} from "../lib/commercialIntelligenceApi";

const root = "/app/internal/commercial-intelligence";
const segments = ["Airline", "Aircraft Leasing", "MRO", "Airport", "Ground Handling", "Aviation Consultancy", "Aviation Services", "Aircraft Manufacturer", "Engine Manufacturer", "Aviation Supplier", "Other Aviation"];
const statuses = ["IDENTIFIED", "QUALIFYING", "CONTACTED", "ENGAGED", "PILOT_DISCUSSION", "PILOT", "CUSTOMER", "DISQUALIFIED"];
const nextStatuses = Object.freeze({
  IDENTIFIED: ["QUALIFYING", "DISQUALIFIED"], QUALIFYING: ["CONTACTED", "DISQUALIFIED"],
  CONTACTED: ["ENGAGED", "DISQUALIFIED"], ENGAGED: ["PILOT_DISCUSSION", "DISQUALIFIED"],
  PILOT_DISCUSSION: ["PILOT", "DISQUALIFIED"], PILOT: ["CUSTOMER", "DISQUALIFIED"],
  CUSTOMER: [], DISQUALIFIED: ["QUALIFYING"],
});

const display = (value) => String(value || "Not established").replaceAll("_", " ").toLowerCase().replace(/^./, (character) => character.toUpperCase());

function InternalNav() {
  return <nav className="op-workspace-tabs" aria-label="Commercial Intelligence">
    {[[root, "Overview"], [`${root}/companies`, "Companies"], [`${root}/opportunities`, "Opportunities"], [`${root}/people`, "Key People"]].map(([to, text]) => <NavLink key={to} end={to === root} to={to} className="op-btn op-btn-quiet">{text}</NavLink>)}
  </nav>;
}

function Shell({ kicker, title, description, actions, children }) {
  return <><header className="op-page-heading"><div><span className="op-page-kicker">{kicker}</span><h1>{title}</h1><p>{description}</p></div>{actions && <div className="op-page-actions">{actions}</div>}</header><InternalNav />{children}</>;
}

function Badge({ value }) {
  return <span className={`op-status-badge${value === "VERIFIED_FACT" ? "" : " is-neutral"}`}>{display(value)}</span>;
}

function Field({ title, children }) {
  return <label className="op-body-sm" style={{ display: "grid", gap: 6 }}><strong>{title}</strong>{children}</label>;
}

function Overview() {
  const [result, setResult] = useState(null); const [error, setError] = useState("");
  useEffect(() => { getCommercialDashboard().then(setResult).catch((requestError) => setError(requestError.message)); }, []);
  if (error) return <ErrorState message={error} />;
  if (!result) return <LoadingState label="Prioritising internal intelligence…" />;
  const sections = [
    ["Priority Opportunities", result.priorityOpportunities, (item) => <Link to={`${root}/opportunities/${item.id}`}>{item.title}<ArrowRight size={15} /></Link>],
    ["New Signals", result.newSignals, (item) => <span><strong>{item.company_name}</strong><br />{item.description}</span>],
    ["Companies to Review", result.companiesToReview, (item) => <Link to={`${root}/companies/${item.id}`}>{item.name}<ArrowRight size={15} /></Link>],
    ["Recommended Actions", result.recommendedActions, (item) => <Link to={`${root}/opportunities/${item.opportunityId}`}>{item.action}<ArrowRight size={15} /></Link>],
  ];
  return <Shell kicker="Operion internal" title="Commercial Intelligence" description={result.profile.summaryPrompt}>
    <div className="op-metric-grid">{sections.map(([name, items]) => <article className="op-metric-card" key={name}><span>{name}</span><strong>{items.length}</strong><small>Stored internal intelligence</small></article>)}</div>
    <div className="op-dashboard-grid">{sections.map(([heading, items, render]) => <section className="op-intelligence-panel" key={heading}><div className="op-section-heading"><div><span className="op-page-kicker">RBI prioritised</span><h2>{heading}</h2></div></div>{items.length ? <div className="op-contract-list">{items.map((item) => <div className="op-contract-card" key={item.id || item.opportunityId}>{render(item)}</div>)}</div> : <p>No stored intelligence is available.</p>}</section>)}</div>
  </Shell>;
}

function CompanyForm({ onCreated }) {
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try {
      const result = await createCommercialCompany({ name: form.get("name"), legalName: form.get("legalName"), website: form.get("website"), country: form.get("country"), region: form.get("region"), aviationSegment: form.get("aviationSegment"), fleetInformation: form.get("fleetInformation"), operionRelevance: form.get("operionRelevance"), internalNotes: form.get("internalNotes"), knownContractCategories: String(form.get("contractCategories") || "").split(",") });
      event.currentTarget.reset(); onCreated(result.company);
    } catch (requestError) { setError(requestError.message); }
  };
  return <form onSubmit={submit} className="op-intelligence-panel" style={{ display: "grid", gap: 14 }}><div className="op-section-heading"><div><span className="op-page-kicker">Manual record</span><h2>Add aviation company</h2></div></div><div className="op-form-grid"><Field title="Company name"><input required name="name" className="op-input" /></Field><Field title="Legal name"><input name="legalName" className="op-input" /></Field><Field title="Aviation segment"><select required name="aviationSegment" className="op-input" defaultValue=""><option value="" disabled>Select segment</option>{segments.map((segment) => <option key={segment}>{segment}</option>)}</select></Field><Field title="Website"><input name="website" className="op-input" /></Field><Field title="Country"><input name="country" className="op-input" /></Field><Field title="Region"><input name="region" className="op-input" /></Field><Field title="Fleet information"><input name="fleetInformation" className="op-input" /></Field><Field title="Contract categories"><input name="contractCategories" className="op-input" placeholder="Aircraft leases, MRO agreements" /></Field></div><Field title="Operion relevance"><textarea name="operionRelevance" className="op-input" rows="3" /></Field><Field title="Internal notes"><textarea name="internalNotes" className="op-input" rows="3" /></Field><button className="op-primary-action"><Plus size={16} />Add company</button>{error && <p>{error}</p>}</form>;
}

function Companies() {
  const [companies, setCompanies] = useState(null); const [error, setError] = useState(""); const [showForm, setShowForm] = useState(false);
  useEffect(() => { listCommercialCompanies().then((result) => setCompanies(result.companies)).catch((requestError) => setError(requestError.message)); }, []);
  return <Shell kicker="Commercial Intelligence" title="Companies" description="Aviation companies being evaluated for evidence-backed Operion relevance." actions={<button className="op-primary-action" onClick={() => setShowForm((value) => !value)}><Plus size={16} />Add company</button>}>{showForm && <CompanyForm onCreated={(company) => setCompanies((items) => [company, ...(items || [])])} />}{error ? <ErrorState message={error} /> : !companies ? <LoadingState label="Loading companies…" /> : !companies.length ? <EmptyState title="No companies recorded" description="Add the first aviation company. Operion will not create prospects without an internal action." /> : <section className="op-intelligence-panel"><div className="op-contract-list">{companies.map((company) => <Link className="op-contract-card" to={`${root}/companies/${company.id}`} key={company.id}><div><h3>{company.name}</h3><div className="op-contract-card-meta"><span>{company.aviation_segment}</span><span>{company.country || "Country not established"}</span><span>{company.signal_count || 0} signals</span><span>{company.opportunity_count || 0} opportunities</span></div></div><ArrowRight size={18} /></Link>)}</div></section>}</Shell>;
}

function AddCompanyIntelligence({ data, reload }) {
  const [kind, setKind] = useState("signal"); const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const companyId = data.company.id;
    try {
      if (kind === "signal") await createCommercialSignal({ companyId, signalType: form.get("signalType"), description: form.get("description"), signalDate: form.get("signalDate"), confidence: form.get("confidence"), relevance: form.get("relevance"), operionImplication: form.get("implication"), verificationStatus: form.get("verificationStatus") });
      if (kind === "person") await createCommercialPerson({ companyId, name: form.get("name"), roleTitle: form.get("roleTitle"), roleCategory: form.get("roleCategory"), relevanceReason: form.get("relevance"), decisionScope: form.get("decisionScope"), verificationStatus: form.get("verificationStatus") });
      if (kind === "opportunity") await createCommercialOpportunity({ companyId, keyPersonId: form.get("keyPersonId") || null, title: form.get("title"), opportunityType: form.get("opportunityType"), aviationSegment: data.company.aviation_segment, potentialContractUseCase: form.get("useCase") });
      if (kind === "source") { const created = await createCommercialSource({ title: form.get("title"), publisher: form.get("publisher"), sourceUrl: form.get("sourceUrl"), excerpt: form.get("excerpt"), sourceType: form.get("sourceType"), verificationStatus: form.get("verificationStatus") }); await linkCommercialSource(created.source.id, { entityType: "COMPANY", entityId: companyId, claim: form.get("claim") }); }
      event.currentTarget.reset(); reload();
    } catch (requestError) { setError(requestError.message); }
  };
  return <section className="op-intelligence-panel"><div className="op-section-heading"><div><span className="op-page-kicker">Internal input</span><h2>Add intelligence</h2></div><select className="op-input" value={kind} onChange={(event) => setKind(event.target.value)}><option value="signal">Signal</option><option value="person">Key person</option><option value="opportunity">Opportunity</option><option value="source">Source</option></select></div><form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
    {kind === "signal" && <><Field title="Signal type"><select name="signalType" className="op-input"><option value="FLEET_EXPANSION">Fleet expansion</option><option value="FLEET_RENEWAL">Fleet renewal</option><option value="PROCUREMENT_ACTIVITY">Procurement activity</option><option value="CONTRACT_ANNOUNCEMENT">Contract announcement</option><option value="OTHER">Other</option></select></Field><Field title="Description"><textarea required name="description" className="op-input" /></Field><Field title="Date"><input type="date" name="signalDate" className="op-input" /></Field><Field title="Confidence (0-1)"><input type="number" min="0" max="1" step="0.01" name="confidence" className="op-input" /></Field><Field title="Relevance"><input name="relevance" className="op-input" /></Field><Field title="Operion implication"><input name="implication" className="op-input" /></Field></>}
    {kind === "person" && <><Field title="Name (if known)"><input name="name" className="op-input" /></Field><Field title="Role title"><input required name="roleTitle" className="op-input" /></Field><Field title="Role category"><select name="roleCategory" className="op-input"><option value="CFO">CFO</option><option value="GENERAL_COUNSEL">General Counsel</option><option value="HEAD_OF_LEASING">Head of Leasing</option><option value="FLEET_DIRECTOR">Fleet Director</option><option value="HEAD_OF_PROCUREMENT">Head of Procurement</option><option value="CEO">CEO</option><option value="OTHER">Other</option></select></Field><Field title="Why relevant"><input name="relevance" className="op-input" /></Field><Field title="Decision scope"><input name="decisionScope" className="op-input" /></Field></>}
    {kind === "opportunity" && <><Field title="Title"><input required name="title" className="op-input" /></Field><Field title="Type"><select name="opportunityType" className="op-input"><option value="CONTRACT_INTELLIGENCE">Contract Intelligence</option><option value="CONTRACT_RISK">Contract Risk</option><option value="CONTRACT_COMPLIANCE">Contract Compliance</option><option value="CONTRACT_RENEWAL">Contract Renewal</option><option value="SUPPLIER_RISK">Supplier Risk</option><option value="AVIATION_OPERATIONAL_RISK">Aviation Operational Risk</option></select></Field><Field title="Potential use case"><input name="useCase" className="op-input" /></Field><Field title="Key person"><select name="keyPersonId" className="op-input"><option value="">Not established</option>{data.people.map((person) => <option key={person.id} value={person.id}>{person.name || person.role_title} · {person.role_title}</option>)}</select></Field></>}
    {kind === "source" && <><Field title="Source title"><input required name="title" className="op-input" /></Field><Field title="Publisher"><input name="publisher" className="op-input" /></Field><Field title="URL"><input name="sourceUrl" className="op-input" /></Field><Field title="Excerpt"><textarea name="excerpt" className="op-input" /></Field><Field title="Claim supported"><input name="claim" className="op-input" /></Field><Field title="Source type"><select name="sourceType" className="op-input"><option value="COMPANY_WEBSITE">Company website</option><option value="NEWS">News</option><option value="REGULATORY">Regulatory</option><option value="PUBLIC_FILING">Public filing</option><option value="INDUSTRY">Industry</option><option value="MANUAL_NOTE">Manual note</option></select></Field></>}
    {kind !== "opportunity" && <Field title="Claim status"><select name="verificationStatus" className="op-input"><option value="UNVERIFIED_SIGNAL">Unverified signal</option><option value="VERIFIED_FACT">Verified fact</option><option value="AI_INFERENCE">AI inference</option></select></Field>}<button className="op-primary-action"><Plus size={16} />Add {kind}</button>{error && <p>{error}</p>}
  </form></section>;
}

function CompanyDetail() {
  const { companyId } = useParams(); const [data, setData] = useState(null); const [error, setError] = useState("");
  const load = () => getCommercialCompany(companyId).then(setData).catch((requestError) => setError(requestError.message));
  useEffect(load, [companyId]);
  if (error) return <ErrorState message={error} />; if (!data) return <LoadingState label="Loading company intelligence…" />;
  const { company, people, signals, opportunities, sources } = data;
  return <Shell kicker="Company intelligence" title={company.name} description={company.operion_relevance || "Operion relevance has not yet been established."} actions={<Badge value={sources.some((source) => source.verification_status === "VERIFIED_FACT") ? "VERIFIED_FACT" : "UNVERIFIED_SIGNAL"} />}>
    <div className="op-dashboard-grid"><section className="op-intelligence-panel"><div className="op-section-heading"><div><span className="op-page-kicker">Company overview</span><h2>Aviation profile</h2></div></div>{[["Segment", company.aviation_segment], ["Location", [company.country, company.region].filter(Boolean).join(" · ")], ["Fleet / assets", company.fleet_information], ["Contract categories", company.known_contract_categories?.join(", ")]].map(([name, value]) => <div className="op-inspector-kv" key={name}><span>{name}</span><strong>{value || "Not established"}</strong></div>)}</section><AddCompanyIntelligence data={data} reload={load} /></div>
    <div className="op-dashboard-grid"><section className="op-intelligence-panel"><div className="op-section-heading"><div><span className="op-page-kicker">Signals</span><h2>Why now</h2></div></div>{signals.length ? signals.map((signal) => <div className="op-honest-boundary" key={signal.id}><Badge value={signal.verification_status} /><strong>{display(signal.signal_type)}</strong><p>{signal.description}</p></div>) : <p>No signals recorded.</p>}</section><section className="op-intelligence-panel"><div className="op-section-heading"><div><span className="op-page-kicker">Potential use</span><h2>Opportunities</h2></div></div>{opportunities.length ? opportunities.map((opportunity) => <Link className="op-contract-card" key={opportunity.id} to={`${root}/opportunities/${opportunity.id}`}><span>{opportunity.title}</span><Badge value={opportunity.status} /></Link>) : <p>No opportunities recorded.</p>}</section></div>
    <div className="op-dashboard-grid"><section className="op-intelligence-panel"><div className="op-section-heading"><div><span className="op-page-kicker">People</span><h2>Likely relevant contacts</h2></div></div>{people.length ? people.map((person) => <div className="op-honest-boundary" key={person.id}><Badge value={person.verification_status} /><strong>{person.name || "Person not yet identified"}</strong><p>{person.role_title} · {person.relevance_reason || "Relevance requires review."}</p></div>) : <p>No people recorded.</p>}</section><section className="op-intelligence-panel"><div className="op-section-heading"><div><span className="op-page-kicker">Evidence</span><h2>Sources</h2></div></div>{sources.length ? sources.map((source) => <div className="op-honest-boundary" key={source.id}><Badge value={source.verification_status} /><strong>{source.title}</strong><p>{source.claim || source.excerpt}</p>{source.source_url && <a href={source.source_url} target="_blank" rel="noreferrer">Open source</a>}</div>) : <p>No sources linked. Claims remain unverified.</p>}</section></div>
  </Shell>;
}

function Opportunities() {
  const [items, setItems] = useState(null); const [error, setError] = useState("");
  useEffect(() => { listCommercialOpportunities().then((result) => setItems(result.opportunities)).catch((requestError) => setError(requestError.message)); }, []);
  return <Shell kicker="Commercial Intelligence" title="Opportunities" description="Evidence-backed reasons for Operion to engage, ordered through the active internal RBI profile.">{error ? <ErrorState message={error} /> : !items ? <LoadingState label="Loading opportunities…" /> : !items.length ? <EmptyState title="No opportunities identified" description="Create one from a company profile after recording known context." /> : <section className="op-intelligence-panel"><div className="op-contract-list">{items.map((item) => <Link className="op-contract-card" to={`${root}/opportunities/${item.id}`} key={item.id}><div><h3>{item.title}</h3><div className="op-contract-card-meta"><span>{item.company_name}</span><span>{display(item.opportunity_type)}</span><span>{display(item.priority)} priority</span></div></div><Badge value={item.status} /></Link>)}</div></section>}</Shell>;
}

function OpportunityDetail() {
  const { opportunityId } = useParams(); const [data, setData] = useState(null); const [error, setError] = useState(""); const [working, setWorking] = useState(false);
  const load = () => getCommercialOpportunity(opportunityId).then(setData).catch((requestError) => setError(requestError.message)); useEffect(load, [opportunityId]);
  const setStatus = async (event) => { setWorking(true); try { await updateCommercialOpportunity(opportunityId, { status: event.target.value, markReviewed: true }); await load(); } catch (requestError) { setError(requestError.message); } finally { setWorking(false); } };
  const reason = async () => { setWorking(true); try { await reasonCommercialOpportunity(opportunityId); await load(); } catch (requestError) { setError(requestError.message); } finally { setWorking(false); } };
  if (!data) return error ? <ErrorState message={error} /> : <LoadingState label="Loading opportunity intelligence…" />;
  const item = data.opportunity; const blocks = [["Why this company", item.why_company], ["Why now", item.why_now], ["Why Operion", item.why_operion], ["Potential use case", item.potential_contract_use_case], ["Key person", item.key_person_name || item.key_person_role], ["Why this person", item.why_person], ["Recommended approach", item.recommended_approach?.approachAngle || item.recommended_approach?.reason], ["Suggested message", item.suggested_outreach?.linkedin], ["Primary next action", item.primary_next_action]];
  const availableStatuses = [item.status, ...(nextStatuses[item.status] || [])];
  return <Shell kicker="Opportunity intelligence" title={item.title} description={`${item.company_name} · ${display(item.opportunity_type)}`} actions={<><select aria-label="Opportunity status" className="op-input" value={item.status} disabled={working} onChange={setStatus}>{statuses.filter((status) => availableStatuses.includes(status)).map((status) => <option value={status} key={status}>{display(status)}</option>)}</select><button className="op-primary-action" disabled={working} onClick={reason}><Sparkles size={16} />Build grounded reasoning</button></>}>
    {error && <p>{error}</p>}<div className="op-metric-grid"><article className="op-metric-card"><span>Status</span><strong>{display(item.status)}</strong><small>Simple internal lifecycle</small></article><article className="op-metric-card"><span>Priority</span><strong>{display(item.priority)}</strong><small>{item.priority_reasons?.join(" · ") || "Reasoning not generated"}</small></article><article className="op-metric-card"><span>Reasoning</span><strong>{display(item.reasoning_method)}</strong><small>{data.sources.length} linked sources</small></article></div>
    <div className="op-dashboard-grid">{blocks.map(([heading, content]) => <section className="op-intelligence-panel" key={heading}><span className="op-page-kicker">{heading}</span><h2>{content || "Not established"}</h2>{!content && <p>Record evidence or run grounded reasoning. Operion will not invent this answer.</p>}</section>)}</div><section className="op-intelligence-panel"><div className="op-section-heading"><div><span className="op-page-kicker">Evidence</span><h2>Sources</h2></div></div>{data.sources.length ? data.sources.map((source) => <div className="op-honest-boundary" key={source.id}><Badge value={source.verification_status} /><strong>{source.title}</strong><p>{source.claim || source.excerpt}</p></div>) : <p>No supporting sources are linked. Reasoning will remain uncertain.</p>}</section>
  </Shell>;
}

function People() {
  const [people, setPeople] = useState(null); const [error, setError] = useState(""); useEffect(() => { listCommercialPeople().then((result) => setPeople(result.people)).catch((requestError) => setError(requestError.message)); }, []);
  return <Shell kicker="Commercial Intelligence" title="Key People" description="Verified individuals and likely relevant roles connected to aviation opportunities.">{error ? <ErrorState message={error} /> : !people ? <LoadingState label="Loading key people…" /> : !people.length ? <EmptyState title="No key people recorded" description="Add a verified person or likely relevant role from a company profile." /> : <section className="op-intelligence-panel"><div className="op-contract-list">{people.map((person) => <Link to={`${root}/companies/${person.company_id}`} className="op-contract-card" key={person.id}><div><h3>{person.name || "Person not yet identified"}</h3><div className="op-contract-card-meta"><span>{person.role_title}</span><span>{person.company_name}</span><span>{person.decision_scope || "Decision scope not established"}</span></div></div><Badge value={person.verification_status} /></Link>)}</div></section>}</Shell>;
}

export default function CommercialIntelligence({ page = "overview" }) {
  if (page === "companies") return <Companies />;
  if (page === "company") return <CompanyDetail />;
  if (page === "opportunities") return <Opportunities />;
  if (page === "opportunity") return <OpportunityDetail />;
  if (page === "people") return <People />;
  return <Overview />;
}