import React from "react";
import { Link } from "react-router-dom";
import { Bot, CalendarClock, FileCheck2, ListChecks, Scale, ShieldAlert } from "lucide-react";

const KINDS = [
  { title: "Clause Intelligence", copy: "Browse deterministic clause segmentation, categories, source text, and evidence in a selected contract.", icon: Scale, hash: "clauses" },
  { title: "Obligation Intelligence", copy: "Inspect actors, actions, objects, modality, timing, conditions, confidence, and source evidence.", icon: ListChecks, hash: "obligations" },
  { title: "Deadline Intelligence", copy: "Review absolute, relative, recurring, conditional, and non-computable temporal findings without invented dates.", icon: CalendarClock, hash: "deadlines" },
  { title: "Risk Intelligence", copy: "Understand deterministic risk findings, severity, rationale, consequence, relationships, and available evidence.", icon: ShieldAlert, hash: "risks" },
  { title: "Evidence", copy: "Trace findings to excerpts, source locators, pages, and document context where provenance is available.", icon: FileCheck2, hash: "evidence" },
  { title: "Contract Assistant", copy: "Ask grounded questions within a selected contract. Insufficient evidence is returned explicitly.", icon: Bot, hash: "assistant" },
];

export default function ProductionIntelligence() {
  return <><header className="op-page-heading"><div><span className="op-page-kicker">Available intelligence</span><h1>What Operion understands</h1><p>Production Contract Intelligence only. No predictive or simulated conclusions.</p></div><div className="op-page-actions"><Link className="op-primary-action" to="/app/contracts">Choose a contract</Link></div></header><div className="op-intelligence-grid">{KINDS.map(({ title, copy, icon: Icon }) => <article className="op-intelligence-kind" key={title}><Icon size={24} strokeWidth={1.6} /><h2>{title}</h2><p>{copy}</p><Link to="/app/contracts">Open contract portfolio</Link></article>)}</div><div className="op-honest-boundary" style={{ marginTop: 18 }}><strong>Portfolio aggregation is not yet exposed</strong><p>Current intelligence endpoints are scoped to an analysis run within a contract. This page does not fabricate cross-contract totals or retrieve every analysis into the browser.</p></div></>;
}
