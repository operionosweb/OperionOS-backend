import React, { useState } from "react";
import { Link } from "react-router-dom";
import { DEMO_CONTRACT_INTELLIGENCE } from "../../lib/demoContractIntelligence";

const WORKSPACES = {
  "Contract Ownership": "/demo?view=portfolio",
  "Obligation Management": "/demo/contracts/demo-aircraft-lease",
  "Risk Management": "/demo?view=exposure",
  "Compliance Evidence": "/demo?view=compliance",
  "Performance Monitoring": "/demo?view=performance",
  "Lifecycle Management": "/demo?view=lifecycle",
  "Action Management": "/demo?view=actions",
  "Evidence Traceability": "/demo/contracts/demo-aircraft-lease",
};

function GovernanceDrawer({ item, onClose }) {
  if (!item) return null;
  return <div className="op-gov-drawer-backdrop" role="presentation" onClick={onClose}><aside className="op-gov-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><button type="button" aria-label="Close governance detail" onClick={onClose}>×</button><span>GOVERNANCE DETAIL</span><h2>{item.control}</h2><dl>{[["Status", item.status], ["Priority", item.priority], ["Owner", item.owner], ["Deadline", item.deadline], ["Exposure", item.exposure]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>{item.reason}</p><p>Recommended next step: {item.action}</p><Link to={WORKSPACES[item.control]}>Open related intelligence ↗</Link></aside></div>;
}

export default function GovernanceControlsWorkspace() {
  const contract = DEMO_CONTRACT_INTELLIGENCE["demo-aircraft-lease"];
  const [selected, setSelected] = useState(null);
  const [answer, setAnswer] = useState("");
  const controls = [
    ["Contract Ownership", "Covered", 0, "Low", contract.owner, "Not available", contract.exposure, "A contract owner is represented in the demo data.", "Review portfolio ownership."],
    ["Obligation Management", "Attention Required", contract.commitments.filter((item) => item.owner === "Unassigned" || item.status === "Overdue").length, "Critical", "Unassigned", "12 Sep 2026", "€1.2M", "Unassigned and overdue commitments require accountable follow-up.", "Assign owner and review commitment evidence."],
    ["Risk Management", "Attention Required", contract.riskRecords.filter((item) => item.status === "Open").length, "Critical", "Legal", "01 Sep 2026", "€1.51M", "Open critical risks remain linked to material exposure.", "Review mitigation and escalation context."],
    ["Compliance Evidence", "Attention Required", contract.complianceRequirements.filter((item) => item.evidenceStatus !== "Available").length, "High", "Risk & Compliance", "22 Sep 2026", "€1.2M", "A requirement lacks evidence and another needs review.", "Verify and link supporting evidence."],
    ["Performance Monitoring", "Attention Required", contract.performanceCommitments.filter((item) => item.status !== "On Track").length, "High", "Engineering", "30 Sep 2026", "€660K", "Performance commitments include breached, at-risk, and unmeasured states.", "Review target and observed performance."],
    ["Lifecycle Management", "Covered", 0, "Medium", "Legal", "01 Sep 2026", "€1.2M", "Renewal and notice dates are represented in the demo data.", "Prepare the renewal decision."],
    ["Action Management", "Attention Required", contract.recommendations.filter((item) => !["Completed", "Dismissed"].includes(item.status)).length, "High", "Unassigned", "12 Sep 2026", "€2.22M", "Priority actions remain open, including one without a current owner.", "Assign and progress the priority action queue."],
    ["Evidence Traceability", "Covered", 0, "Low", "Fleet Legal", "Not available", contract.exposure, "Material intelligence records are linked to source clauses.", "Open contract evidence."],
  ].map(([control, status, issues, priority, owner, deadline, exposure, reason, action]) => ({ control, status, issues, priority, owner, deadline, exposure, reason, action }));
  const gaps = controls.filter((item) => item.status === "Attention Required");
  const respond = (prompt) => setAnswer({
    "Are my contracts under control?": "Most major controls are represented, but ownership, risk mitigation, compliance evidence, performance monitoring, and action follow-up require attention.",
    "Show me the biggest governance gaps.": gaps.map((item) => item.control).join("; "),
    "Which contracts need management attention?": `${contract.title} has overlapping governance signals tied to exposure, renewal timing, and unassigned commitments.`,
    "Where is evidence missing?": contract.complianceRequirements.filter((item) => item.evidenceStatus === "Missing").map((item) => item.title).join("; "),
    "What should we fix first?": "Assign the return inspection owner and review the overdue default notice, then confirm insurance and performance evidence.",
  }[prompt]);

  return <section className="op-gov-workspace"><div className="op-gov-heading"><div><span>CONTRACT GOVERNANCE & CONTROLS</span><h1>Keep contract intelligence under control.</h1><p>Detect → assign → monitor → evidence → escalate → resolve.</p></div><div><span>GOVERNANCE HEALTH</span><strong>Watch</strong><small>{gaps.length} control areas require attention; absent data is not presented as failed control.</small></div></div><div className="op-gov-metrics">{[["Contracts governed", 1], ["Governance issues", gaps.reduce((total, item) => total + item.issues, 0)], ["Critical gaps", gaps.filter((item) => item.priority === "Critical").length], ["Unassigned items", contract.commitments.filter((item) => item.owner === "Unassigned").length]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="op-gov-matrix"><header><h2>Governance Control Matrix</h2><span>Coverage, ownership, priority and issue state</span></header>{controls.map((item) => <button type="button" key={item.control} onClick={() => setSelected(item)}><strong>{item.control}</strong><span>{item.status}</span><em>{item.issues} issues · {item.priority}</em><b>{item.owner}</b></button>)}</div><div className="op-gov-grid"><div><h3>Contracts Requiring Governance Attention</h3>{gaps.slice(0, 3).map((item) => <button type="button" key={item.control} onClick={() => setSelected(item)}><strong>{contract.title}</strong><span>{item.control} · {item.exposure}</span><em>{item.reason}</em></button>)}</div><div><h3>Unassigned / Accountability Gaps</h3>{contract.commitments.filter((item) => item.owner === "Unassigned").map((item) => <Link key={item.id} to="/demo/contracts/demo-aircraft-lease"><strong>{item.title}</strong><span>{item.status} · {item.dueDate}</span></Link>)}</div><div><h3>Management Controls</h3>{Object.entries(WORKSPACES).map(([label, to]) => <Link key={label} to={to}>{label} ↗</Link>)}</div></div><section className="op-gov-brief"><h2>Governance Briefing</h2><p><strong>Ownership:</strong> contract ownership is represented, but selected commitments and actions remain unassigned.</p><p><strong>Management focus:</strong> assign return inspection ownership, review the overdue default notice, and prepare the renewal decision.</p><p>Historical governance snapshots are not available in the current demo dataset.</p></section><section className="op-gov-ask"><h2>Ask Operion</h2>{["Are my contracts under control?", "Show me the biggest governance gaps.", "Which contracts need management attention?", "Where is evidence missing?", "What should we fix first?"].map((prompt) => <button type="button" key={prompt} onClick={() => respond(prompt)}>{prompt}</button>)}{answer && <div><span>AI ANALYSIS · GOVERNANCE CONTROLS</span><p>{answer}</p></div>}</section><GovernanceDrawer item={selected} onClose={() => setSelected(null)} /></section>;
}
