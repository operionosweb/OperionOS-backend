import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bot } from "lucide-react";
import { useDemoData } from "../../demo/DemoDataProvider";
import { DemoBadge, GlassCard, PageHeader, RiskBadge } from "../../demo/DemoUI";
import FlightOperations from "../../components/aviation/FlightOperations";

const priority = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const money = (amount, currency) => new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

function EvidenceRecord({ contract, evidenceId, clauseId }) {
  const clause = contract.clauses.find((item) => item.id === clauseId || item.evidenceId === evidenceId);
  const evidence = contract.evidence.find((item) => item.id === evidenceId || item.id === clause?.evidenceId);
  return <details className="od-command-evidence"><summary>Inspect supporting evidence</summary>
    <p>{contract.contractId} · {contract.title} · Clause {clause?.number || "unavailable"} · Page {evidence?.page || "unavailable"}</p>
    {evidence ? <blockquote>{evidence.excerpt}</blockquote> : <p>No source excerpt is available for this record.</p>}
    <p>Illustrative prepared evidence · human review required{clause ? ` · extraction confidence ${Math.round(clause.confidence * 100)}% (demo)` : ""}</p>
    <Link to={`/demo/contracts/${contract.id}/evidence`} state={{ evidenceId: evidence?.id }}>Open document evidence</Link>
  </details>;
}

function ReviewEditor({ id, label, values, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ owner: "", status: "Requires review", notes: "" });
  const [feedback, setFeedback] = useState("");
  function start() {
    setDraft(values || { owner: "", status: "Requires review", notes: "" });
    setFeedback("");
    setEditing(true);
  }
  return <div className="od-command-review">
    <p>Owner: {values?.owner || "Unassigned"} · Review: {values?.status || "Requires review"}</p>
    {values?.notes && <p>Review notes: {values.notes}</p>}
    {!editing ? <button className="od-button" type="button" onClick={start}>Edit {label} review</button> :
      <form aria-label={`${label} review editor`} onSubmit={(event) => {
        event.preventDefault();
        if (!draft.owner.trim()) { setFeedback("Enter a responsible owner before saving."); return; }
        onSave(id, { ...draft, owner: draft.owner.trim(), notes: draft.notes.trim() });
        setEditing(false);
        setFeedback("Review saved for this demo visit only. No contract or external system was changed.");
      }}>
        <label>Responsible owner<input aria-label="Responsible owner" value={draft.owner} maxLength={100} onChange={(event) => setDraft({ ...draft, owner: event.target.value })}/></label>
        <label>Review status<select aria-label="Review status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
          {["Requires review", "In review", "Reviewed"].map((status) => <option key={status}>{status}</option>)}
        </select></label>
        <label>Notes / evidence reference<textarea aria-label="Notes / evidence reference" value={draft.notes} maxLength={2000} onChange={(event) => setDraft({ ...draft, notes: event.target.value })}/></label>
        <button className="od-button od-button-primary" type="submit">Save review</button>
        <button className="od-button" type="button" onClick={() => { setEditing(false); setFeedback(""); }}>Cancel</button>
      </form>}
    {feedback && <p role={feedback.startsWith("Enter") ? "alert" : "status"}>{feedback}</p>}
  </div>;
}

export default function DemoDashboard({ headingLevel }) {
  const { contracts } = useDemoData();
  const [query, setQuery] = useState("");
  const [contractId, setContractId] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [sort, setSort] = useState("title");
  const [activeArea, setActiveArea] = useState("all");
  const [reviews, setReviews] = useState({});
  const [timelineView, setTimelineView] = useState("all");
  const [allActions, setAllActions] = useState(false);
  const [allDeadlines, setAllDeadlines] = useState(false);
  const filtered = useMemo(() => contracts.filter((contract) =>
    (!contractId || contract.id === contractId)
    && (!riskLevel || contract.risks.some((risk) => risk.severity === riskLevel))
    && `${contract.title} ${contract.contractId} ${contract.counterparty} ${contract.aircraft?.registration || ""}`.toLowerCase().includes(query.trim().toLowerCase())
  ).sort((a, b) => sort === "expiry" ? Date.parse(a.expiry) - Date.parse(b.expiry) : String(a[sort]).localeCompare(String(b[sort]))), [contracts, contractId, riskLevel, query, sort]);
  const contractIds = useMemo(() => filtered.map((contract) => contract.id), [filtered]);
  const risks = filtered.flatMap((contract) => contract.risks.map((risk) => ({ ...risk, contract }))).sort((a, b) => priority[a.severity] - priority[b.severity]);
  const obligations = filtered.flatMap((contract) => contract.obligations.map((obligation) => ({ ...obligation, contract })));
  const deadlines = filtered.flatMap((contract) => contract.deadlines.map((deadline) => ({ ...deadline, contract })));
  const financial = filtered.flatMap((contract) => (contract.financialImpact?.items || []).map((item) => ({ ...item, currency: contract.financialImpact.currency, contract })));
  const dated = deadlines.filter((item) => item.type === "Absolute");
  const show = (area) => activeArea === "all" || activeArea === area;
  const saveReview = (id, value) => setReviews((current) => ({ ...current, [id]: value }));

  return <div className="od-dashboard-page od-command-centre">
    <PageHeader eyebrow="Aviation Contract Intelligence Command Centre" title="Executive Cockpit" headingLevel={headingLevel}
      description="Understand the agreement. Locate the asset. Review the evidence. Decide the next action."
      actions={<><DemoBadge>ILLUSTRATIVE DEMO</DemoBadge><Link className="od-button od-button-primary" to="/demo/intelligence"><Bot size={16}/>Contract intelligence</Link></>}/>
    <p className="od-command-disclosure">Synthetic demonstration records, not customer findings. Non-lease records are synthetic templates, not validated contract-type analysis; no lease findings or evidence are attributed to them. Amounts, risk and confidence labels are illustrative, not measured customer data. Forecasts, scenario simulation and digital twins are not operational. Review edits last only for this visit.</p>
    <section className="od-command-overview" aria-label="Aviation Contract Intelligence Overview">
      <div className="od-command-filters">
        <label>Search portfolio<input aria-label="Search portfolio" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Contract, asset or counterparty"/></label>
        <label>Contract<select aria-label="Contract" value={contractId} onChange={(event) => setContractId(event.target.value)}><option value="">All contracts</option>{contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.title}</option>)}</select></label>
        <label>Portfolio risk<select aria-label="Portfolio risk" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)}><option value="">All risk levels</option>{Object.keys(priority).map((level) => <option key={level}>{level}</option>)}</select></label>
        <button className="od-button" type="button" onClick={() => { setQuery(""); setContractId(""); setRiskLevel(""); setActiveArea("all"); }}>Clear dashboard filters</button>
      </div>
      <div className="od-command-indicators">
        {[
          ["Prepared contracts", filtered.length, "portfolio", "Open the underlying prepared records; not newly analysed customer documents."],
          ["Obligations to review", obligations.length, "obligations", "Extracted sample commitments; performance and completion are not verified."],
          ["Risks requiring review", risks.length, "actions", "Prepared evidence-linked contractual issues, not predicted events."],
          ["Deadline rules", deadlines.length, "obligations", "Conditional and recurring rules included. Imminence cannot be confirmed without trigger dates."],
          ["Exposure assumptions", financial.length, "exposure", "Separate current obligations from conditional scenarios; do not aggregate into actual liability."],
          ["Contracts to review", filtered.filter((contract) => contract.status === "Review").length, "portfolio", "Records explicitly marked Review in the prepared portfolio."],
        ].map(([label, value, area, explanation]) => <button type="button" key={label} aria-pressed={activeArea === area} onClick={() => setActiveArea(area)}><small>{label}</small><strong>{value}</strong><span>{explanation}</span></button>)}
      </div>
      <nav className="od-command-area-nav" aria-label="Command centre areas">{[["all", "All intelligence"], ["actions", "Priority actions"], ["exposure", "Financial exposure"], ["obligations", "Obligations & events"], ["portfolio", "Portfolio & dependencies"]].map(([value, label]) => <button className="od-button" type="button" key={value} aria-pressed={activeArea === value} onClick={() => setActiveArea(value)}>{label}</button>)}</nav>
      {!filtered.length && <p role="status">No prepared contracts match these filters. Clear the filters to restore the portfolio.</p>}
    </section>
    <FlightOperations contractIds={contractIds}/>
    <div className="od-command-sections">
      {show("actions") && <section aria-label="Priority Action Centre">
        <GlassCard title="Priority Action Centre" eyebrow="Human-authorised review · no automatic execution">
          <p>Recommendations are review steps, not legal determinations. No action changes a contract, sends a message or triggers a payment.</p>
          <div className="od-command-records">{(allActions ? risks : risks.slice(0, 3)).map((risk) => {
            const evidenceId = risk.evidenceIds[0];
            const clause = risk.contract.clauses.find((item) => item.id === risk.clauseId);
            const deadline = risk.contract.deadlines.find((item) => item.id === risk.deadlineId);
            const financialItem = risk.contract.financialImpact?.items.find((item) => item.riskId === risk.id);
            return <article key={`${risk.contract.id}-${risk.id}`}>
              <header><h3>{risk.title}</h3><RiskBadge severity={risk.severity}/></header>
              <p>{risk.contract.title} · Clause {clause?.number || "unavailable"}</p>
              <p><strong>Why review:</strong> {risk.rationale}</p>
              <p><strong>Potential consequence:</strong> {risk.consequence}</p>
              <p><strong>Financial consequence:</strong> {financialItem ? `${money(financialItem.baseAmount, risk.contract.financialImpact.currency)} — illustrative, conditional assumption only` : "Unquantified; no supported calculation available."}</p>
              <p><strong>Recommended review:</strong> {financialItem?.action || "Review the referenced clause and supporting evidence with the responsible contract owner."}</p>
              <p><strong>Timing:</strong> {deadline?.timing || "Not specified"} · {deadline?.computability || "Requires review"}</p>
              <EvidenceRecord contract={risk.contract} clauseId={risk.clauseId} evidenceId={evidenceId}/>
              <ReviewEditor id={`action-${risk.contract.id}-${risk.id}`} label="action" values={reviews[`action-${risk.contract.id}-${risk.id}`]} onSave={saveReview}/>
              <Link to={`/demo/contracts/${risk.contract.id}/risks`} state={{ focusRiskId: risk.id, source: "command-centre" }}>Open related risk and contract</Link>
            </article>;
          })}</div>
          {!risks.length && <p>No risk records match the portfolio filter.</p>}
          {risks.length > 3 && <button className="od-button" type="button" aria-expanded={allActions} onClick={() => setAllActions((value) => !value)}>{allActions ? "Show priority actions only" : `Show all ${risks.length} actions`}</button>}
        </GlassCard>
      </section>}
      {show("exposure") && <section aria-label="Contractual Financial Exposure">
        <GlassCard title="Contractual Financial Exposure" eyebrow="Current obligations ≠ conditional estimates ≠ unquantified risk">
          <p>All amounts below are existing synthetic assumptions, not validated liabilities or predictions. Amounts are not summed across categories or currencies.</p>
          <div className="od-command-records">{financial.map((item) => <article key={`${item.contract.id}-${item.id}`}>
            <header><h3>{item.title}</h3><DemoBadge>{item.exposureType}</DemoBadge></header>
            <strong className="od-command-amount">{money(item.baseAmount, item.currency)}</strong>
            <p>{item.contract.contractId} · {item.currency} · Illustrative / not validated</p>
            <p><strong>Calculation:</strong> {item.calculation}</p>
            <p><strong>Applicable period / event:</strong> {item.event}</p>
            <p><strong>Condition:</strong> {item.condition}</p>
            <ul>{item.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
            <EvidenceRecord contract={item.contract} clauseId={item.clauseId} evidenceId={item.evidenceId}/>
            <Link to={`/demo/contracts/${item.contract.id}/financial-impact`}>Inspect calculation and evidence</Link>
          </article>)}</div>
          <details><summary>Unquantified exposure and unsupported categories</summary>
            <p>Maintenance reserve, PBH, SLA/service credits, fuel indexing, FX, interest rates and supplier concentration lack validated calculation inputs. Insurance-related obligations are available, but not a quantified insurance-loss forecast.</p>
            {risks.filter((risk) => !risk.contract.financialImpact?.items.some((item) => item.riskId === risk.id)).map((risk) => <p key={`${risk.contract.id}-${risk.id}`}><Link to={`/demo/contracts/${risk.contract.id}/risks`}>{risk.contract.contractId} · {risk.title}</Link> — unquantified</p>)}
          </details>
          {!financial.length && <p>No financial calculation is available for the selected contracts.</p>}
        </GlassCard>
      </section>}
      {show("obligations") && <section aria-label="Obligations and Critical Events">
        <GlassCard title="Obligations & Critical Events" eyebrow="Evidence-linked timing, not invented calendar dates">
          <div className="od-command-area-nav">{[["all", "All timing rules"], ["dated", "Known absolute dates"]].map(([value, label]) => <button className="od-button" type="button" key={value} aria-pressed={timelineView === value} onClick={() => setTimelineView(value)}>{label}</button>)}</div>
          <p>Trigger dates, holiday calendars and policy expiries are not connected. A recurring or conditional rule does not establish that an event is currently overdue or approaching.</p>
          <div className="od-command-timeline">{(timelineView === "dated" ? dated : allDeadlines ? deadlines : deadlines.slice(0, 4)).map((item) => {
            const obligation = item.contract.obligations.find((entry) => entry.evidenceId === item.evidenceId);
            return <article key={`${item.contract.id}-${item.id}`}>
              <header><h3>{item.title}</h3><DemoBadge>{item.type}</DemoBadge></header>
              <p><strong>{item.timing}</strong> · {item.status} · {item.computability}</p>
              <p>{item.contract.contractId} · Responsible party: {obligation?.actor || "Not specified"} · {obligation?.title}</p>
              <p>Trigger: {item.trigger} · Condition: {item.condition}</p>
              <p>Consequence: {item.contract.risks.find((risk) => risk.deadlineId === item.id)?.consequence || "Not quantified in the available evidence; review the source clause."}</p>
              <EvidenceRecord contract={item.contract} evidenceId={item.evidenceId}/>
              <ReviewEditor id={`deadline-${item.contract.id}-${item.id}`} label="obligation" values={reviews[`deadline-${item.contract.id}-${item.id}`]} onSave={saveReview}/>
              <Link to={`/demo/contracts/${item.contract.id}/deadlines`}>Open deadline workspace</Link>
            </article>;
          })}</div>
          {!deadlines.length && <p>No deadline rules match the portfolio filter.</p>}
          {timelineView === "all" && deadlines.length > 4 && <button className="od-button" type="button" aria-expanded={allDeadlines} onClick={() => setAllDeadlines((value) => !value)}>{allDeadlines ? "Show initial timing rules" : `Show all ${deadlines.length} timing rules`}</button>}
        </GlassCard>
      </section>}
      {show("portfolio") && <section aria-label="Contract Portfolio and Supplier Dependencies">
        <GlassCard title="Contract Portfolio & Supplier Dependencies" eyebrow="Prepared relationships · not supplier performance scores">
          <label>Sort portfolio<select aria-label="Sort portfolio" value={sort} onChange={(event) => setSort(event.target.value)}><option value="title">Contract title</option><option value="counterparty">Counterparty</option><option value="expiry">Expiry date</option></select></label>
          <div className="od-command-records">{filtered.map((contract) => <article key={contract.id}>
            <header><h3>{contract.title}</h3><DemoBadge>{contract.status}</DemoBadge></header>
            <p>{contract.contractId} · {contract.type} · {contract.counterparty}</p>
            <p>Associated asset: {contract.aircraft?.registration || "Not provided"} · {contract.aircraft?.model || "Asset category unavailable"}</p>
            <p>Effective {contract.effective} · Expiry {contract.expiry} · Renewal notice: not extracted</p>
            <p>{contract.obligations.length} sample obligations · {contract.risks.length} sample risks · {contract.financialImpact ? "Illustrative exposure calculation available" : "Financial exposure not quantified"}</p>
            <p>Analysis: prepared demonstration, requires human review. Shared sample evidence is not a validated analysis of this contract type.</p>
            <div className="od-flight-contract-links"><Link to={`/demo/contracts/${contract.id}/overview`}>Open contract</Link><Link to="/demo/live-tracking">Inspect supplier and asset dependencies</Link><button className="od-button" type="button" onClick={() => { setContractId(contract.id); document.querySelector(".od-dashboard-aviation")?.scrollIntoView({ block: "start" }); }}>Locate linked assets on globe</button></div>
          </article>)}</div>
        </GlassCard>
      </section>}
      <section aria-label="External Risk Intelligence">
        <GlassCard title="External Risk Intelligence" eyebrow="Connectivity and interpretation are separate">
          <div className="od-command-signals">
            <article><h3>Weather observations</h3><p>Xweather raster overlays are optional through server configuration. Inspect layer availability on the globe. Provider timestamps and contractual impact are not inferred from an image.</p><p>Asset linkage / impact confidence: not assessed. Review contract force-majeure, insurance and operational obligations before drawing conclusions.</p></article>
            <article><h3>Fuel, rates, inflation & exchange rates</h3><p>Unavailable: no licensed feed, source observation or timestamp is connected. No financial prediction is presented.</p></article>
            <article><h3>Geopolitical & supplier risk</h3><p>Unavailable: no verified event source or performance record is connected. Contract counterparties are available in the portfolio; concentration losses are not calculated.</p></article>
          </div>
        </GlassCard>
      </section>
    </div>
  </div>;
}
