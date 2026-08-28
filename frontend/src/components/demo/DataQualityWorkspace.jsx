import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DEMO_CONTRACT_INTELLIGENCE } from "../../lib/demoContractIntelligence";

const contract = DEMO_CONTRACT_INTELLIGENCE["demo-aircraft-lease"];
const clauseById = Object.fromEntries(contract.clauses.map((clause) => [clause.id, clause]));
const recordSets = [
  ["Clauses", contract.clauses], ["Obligations", contract.commitments], ["Risks", contract.riskRecords],
  ["Financial terms", contract.commercialTerms], ["Compliance", contract.complianceRequirements],
  ["Performance", contract.performanceCommitments], ["Lifecycle", contract.lifecycle], ["Recommendations", contract.recommendations],
];
const availability = [
  ["Contract document", "Available"], ["Contract metadata", "Available"], ["Clauses", "Available"], ["Evidence", "Available"],
  ["Obligations", "Available"], ["Risks", "Available"], ["Exposure", "Available"], ["Financial terms", "Available"],
  ["Compliance", "Available"], ["Performance", "Available"], ["Lifecycle", "Available"], ["Negotiation signals", "Partial"],
  ["Amendments", "Not Available"], ["Historical versions", "Not Available"], ["Redlines", "Not Available"], ["Historical financial terms", "Not Available"],
];

function QualityDrawer({ item, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  if (!item) return null;
  const clause = item.clauseId ? clauseById[item.clauseId] : null;
  return <div className="op-quality-drawer-backdrop" role="presentation" onClick={onClose}>
    <aside className="op-quality-drawer" role="dialog" aria-modal="true" aria-labelledby="quality-detail-title" onClick={(event) => event.stopPropagation()}>
      <button type="button" aria-label="Close data quality detail" onClick={onClose}>×</button>
      <span>DATA QUALITY ISSUE</span><h2 id="quality-detail-title">{item.title}</h2>
      <dl><div><dt>Contract</dt><dd>{contract.title}</dd></div><div><dt>Missing / weak data</dt><dd>{item.weakData}</dd></div><div><dt>Priority</dt><dd>{item.priority}</dd></div><div><dt>Impacted intelligence</dt><dd>{item.domains.join(" · ")}</dd></div><div><dt>Evidence</dt><dd>{clause ? `Clause ${clause.number}, page ${clause.page}: ${clause.confidence}` : "No supporting evidence currently available."}</dd></div></dl>
      <p>{item.reason}</p><p><strong>Recommended action:</strong> {item.action}</p>
      <Link to={item.link}>Open related review ↗</Link>
    </aside>
  </div>;
}

export default function DataQualityWorkspace() {
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState(() => JSON.parse(sessionStorage.getItem("operion.qualityNotes") || "[]"));
  const [reviewed, setReviewed] = useState(() => JSON.parse(sessionStorage.getItem("operion.qualityReviewed") || "[]"));
  const [answer, setAnswer] = useState("");
  const allRecords = recordSets.flatMap(([, records]) => records);
  const confidenceRecords = allRecords.filter((record) => record.confidence);
  const evidenceBacked = allRecords.filter((record) => record.clauseId).length;
  const highConfidence = confidenceRecords.filter((record) => Number.parseInt(record.confidence, 10) >= 95).length;
  const lowConfidence = confidenceRecords.filter((record) => Number.parseInt(record.confidence, 10) < 95);
  const remediation = [
    { id: "return-evidence", title: "Return inspection evidence needs review", weakData: "Compliance evidence is marked Missing", priority: "Critical", domains: ["Risk", "Compliance", "Operations"], clauseId: "return", reason: "The return inspection requirement is source-mapped, but the current compliance record marks its supporting evidence as missing.", action: "Assign an owner and confirm the inspection evidence.", link: "/demo/contracts/demo-aircraft-lease" },
    { id: "history", title: "Historical contract versions unavailable", weakData: "No historical source versions", priority: "High", domains: ["Contract Changes", "Negotiation", "Lifecycle"], reason: "Amendment and before/after comparison cannot be supported without historic source versions.", action: "Retain approved versions with effective dates before performing a change comparison.", link: "/demo?view=changes" },
    { id: "redlines", title: "Redlines and amendment records unavailable", weakData: "No amendment or redline records", priority: "Medium", domains: ["Contract Review", "Negotiation"], reason: "Current clauses are evidence-backed, but prior negotiated changes cannot be traced in this demo.", action: "Add approved amendment and redline source records.", link: "/demo?view=review" },
  ];
  const toggleReviewed = (id) => setReviewed((current) => { const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]; sessionStorage.setItem("operion.qualityReviewed", JSON.stringify(next)); return next; });
  const addNote = () => { if (!note.trim()) return; const next = [...notes, note.trim()]; setNotes(next); setNote(""); sessionStorage.setItem("operion.qualityNotes", JSON.stringify(next)); };
  const responses = {
    "How complete is our contract intelligence?": `Current contract document, metadata, clauses, evidence, obligations, risks, financial terms, compliance, performance, and lifecycle records are available for ${contract.title}. Historical intelligence is unavailable.`,
    "Which contracts require human review?": `${contract.title} has a return-inspection evidence gap and requires review before relying on that compliance evidence.`,
    "Where is extraction confidence lowest?": lowConfidence.map((record) => `${record.title || record.event}: ${record.confidence}`).join("; "),
    "What historical information is unavailable?": "Historical versions, amendments, redlines, historical financial terms, historical performance, and historical risk trajectories are not available in the current demo.",
    "What should we fix first?": "Confirm return inspection evidence first because it affects compliance, operational ownership, and €1.2M modeled return-condition exposure.",
  };
  return <section className="op-quality-workspace">
    <header className="op-quality-heading"><div><span>CONTRACT INTELLIGENCE QUALITY</span><h1>Know what Operion knows, and what still needs review.</h1><p>Measure evidence coverage, extraction confidence, completeness, and review readiness across the contract portfolio.</p></div><div><span>TRUST INDICATOR</span><strong>Evidence-first intelligence</strong><small>Current data is traceable; historical change data is unavailable.</small></div></header>
    <section className="op-quality-health"><h2>Intelligence Quality Health</h2><strong>Needs Review</strong><p>Current clause evidence and metadata are available. A missing return-inspection evidence record and unavailable historical contract data limit downstream review.</p></section>
    <section><h2 className="op-quality-section-title">Quality Snapshot</h2><div className="op-quality-metrics">{[["Contracts analyzed", 1], ["Evidence coverage", `${evidenceBacked} / ${allRecords.length} records`], ["High confidence", `${highConfidence} / ${confidenceRecords.length} records`], ["Missing critical data", remediation.filter((item) => item.priority === "Critical").length], ["Review required", remediation.filter((item) => !reviewed.includes(item.id)).length], ["Data availability gaps", availability.filter(([, status]) => status === "Not Available").length]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>
    <section className="op-quality-panel"><h2>Intelligence Availability</h2><div className="op-quality-availability">{availability.map(([label, status]) => <div key={label}><strong>{label}</strong><span>{status}</span><small>{status === "Available" ? "Current demo data available" : status === "Partial" ? "Current signals only" : "Not available in current demo data"}</small></div>)}</div></section>
    <section className="op-quality-panel"><h2>Contract Completeness</h2><div className="op-quality-completeness"><strong>{contract.title}</strong>{[["Metadata", "Complete"], ["Document", "Complete"], ["Clauses", "Complete"], ["Evidence", "Complete"], ["Obligations", "Complete"], ["Financial", "Complete"], ["Risk", "Complete"], ["Compliance", "Partial - return evidence missing"], ["Performance", "Complete"], ["Lifecycle", "Complete"]].map(([label, status]) => <span key={label}>{label}: {status}</span>)}<em>Overall: Partial - historical change intelligence unavailable</em></div></section>
    <div className="op-quality-grid"><section className="op-quality-panel"><h2>Data Remediation Queue</h2>{remediation.map((item) => <button type="button" key={item.id} onClick={() => setSelected(item)}><span>{item.priority} · {reviewed.includes(item.id) ? "Demo review complete" : "Review recommended"}</span><strong>{item.title}</strong><p>{item.reason}</p></button>)}</section><section className="op-quality-panel"><h2>Evidence Coverage</h2>{recordSets.map(([label, records]) => <p key={label}><strong>{label}</strong><span>{records.filter((record) => record.clauseId).length} / {records.length} source-clause linked</span></p>)}<h2>Evidence Gaps</h2><p>Return inspection compliance evidence is unavailable. No supporting evidence currently available for that compliance record.</p></section><section className="op-quality-panel"><h2>Human Review Queue</h2>{lowConfidence.map((item) => { const clause = clauseById[item.clauseId] || item; return <Link key={item.id} to="/demo?view=review"><strong>{item.title || item.event}</strong><span>{item.confidence} · source clause {clause.number} · human review recommended</span></Link>; })}<h2>Document Quality</h2><p>Document, parsed clause text, page information, clause mapping, and evidence mapping are available in the prepared current demo data. Technical parsing quality is not measured in this demo.</p></section></div>
    <div className="op-quality-grid"><section className="op-quality-panel"><h2>Intelligence Dependencies</h2><p>Missing renewal date → Lifecycle → Negotiation → Economics → Executive</p><p>Missing clause evidence → Risk → Compliance → Actions → Monitoring</p><p>Missing contract value → Portfolio → Economics → Executive</p></section><section className="op-quality-panel"><h2>Portfolio & Vendor Coverage</h2><p><strong>{contract.title}</strong><br />Evidence-backed current clauses, obligations, risks, commercial terms, and lifecycle signals.</p><Link to="/demo?view=vendors">Open Vendor Intelligence ↗</Link></section><section className="op-quality-panel"><h2>Recommended Data Actions</h2><Link to="/demo/contracts/demo-aircraft-lease">Confirm return inspection evidence ↗</Link><Link to="/demo?view=changes">Retain historical versions ↗</Link><Link to="/demo?view=review">Review low-confidence records ↗</Link></section></div>
    <section className="op-quality-panel op-quality-notes"><h2>Internal Data-Quality Notes</h2><p>Notes and review states are stored for this browser session only. They are not contract evidence and do not correct production data.</p><textarea aria-label="Add internal data-quality note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add internal data-quality note" /><button type="button" onClick={addNote}>Add internal note</button>{notes.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}<div>{remediation.map((item) => <button type="button" key={item.id} onClick={() => toggleReviewed(item.id)}>{reviewed.includes(item.id) ? "Demo review complete" : "Mark remediation reviewed"}: {item.title}</button>)}</div></section>
    <section className="op-quality-ask"><h2>Ask Operion</h2>{Object.keys(responses).map((question) => <button type="button" key={question} onClick={() => setAnswer(responses[question])}>{question}</button>)}{answer && <div><span>AI ANALYSIS · CURRENT DATA ONLY</span><p>{answer}</p></div>}</section>
    <QualityDrawer item={selected} onClose={() => setSelected(null)} />
  </section>;
}
