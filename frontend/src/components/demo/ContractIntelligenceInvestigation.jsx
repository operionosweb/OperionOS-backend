import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, ExternalLink, FileText, ListChecks, CalendarClock, ShieldAlert, CircleDollarSign, Route } from "lucide-react";
import { trackEvent } from "../analytics/Analytics";
import { DemoBadge, RiskBadge } from "../../demo/DemoUI";

const NODE_ICONS = {
  contract: FileText,
  clause: FileText,
  obligation: ListChecks,
  deadline: CalendarClock,
  risk: ShieldAlert,
  exposure: CircleDollarSign,
  action: Route,
};

function money(amount, currency) {
  if (!Number.isFinite(amount)) return "Not quantified";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export default function ContractIntelligenceInvestigation({ contract, getEvidence, openEvidence, initialRiskId, initialNode = "risk" }) {
  const initialRisk = contract.risks.find((item) => item.id === initialRiskId) || contract.risks[0];
  const [selectedClauseId, setSelectedClauseId] = useState(initialRisk?.clauseId || contract.clauses[0]?.id);
  const [activeNode, setActiveNode] = useState(initialRiskId ? initialNode : "clause");
  const evidenceRef = useRef(null);

  useEffect(() => {
    const risk = contract.risks.find((item) => item.id === initialRiskId);
    if (!risk) return;
    setSelectedClauseId(risk.clauseId);
    setActiveNode(initialNode);
  }, [contract, initialNode, initialRiskId]);

  const clause = contract.clauses.find((item) => item.id === selectedClauseId) || contract.clauses[0];
  const risk = contract.risks.find((item) => item.clauseId === clause?.id);
  const obligation = contract.obligations.find((item) => item.id === risk?.obligationId) || contract.obligations.find((item) => item.clauseId === clause?.id);
  const deadline = contract.deadlines.find((item) => item.id === risk?.deadlineId) || contract.deadlines.find((item) => item.evidenceId === clause?.evidenceId);
  const impact = contract.financialImpact?.items.find((item) => item.riskId === risk?.id);
  const evidence = getEvidence(clause?.evidenceId);
  const currency = contract.financialImpact?.currency || "EUR";

  const nodes = [
    ["contract", "Contract", contract.title],
    ["clause", "Clause", clause ? `${clause.number} · ${clause.title}` : "Not linked"],
    ["obligation", "Obligation", obligation?.title || "Not linked"],
    ["deadline", "Deadline", deadline?.timing || "Not linked"],
    ["risk", "Risk", risk?.severity || "No linked risk"],
    ["exposure", "Exposure", impact ? money(impact.baseAmount, currency) : "Not quantified"],
    ["action", "Action", impact?.action ? "Recommended action" : "Review required"],
  ];

  const nodeEvent = {
    clause: "demo_clause_open",
    risk: "demo_risk_open",
    exposure: "demo_exposure_open",
    action: "demo_recommendation_open",
  };

  const selectNode = (node, source = "chain") => {
    setActiveNode(node);
    if (nodeEvent[node]) trackEvent(nodeEvent[node], { contract_id: contract.id, risk_id: risk?.id || "none", source });
  };

  const selectClause = (clauseId) => {
    setSelectedClauseId(clauseId);
    setActiveNode("clause");
    trackEvent("demo_clause_open", { contract_id: contract.id, clause_id: clauseId, source: "contract_viewer" });
  };

  const focusEvidence = () => {
    setActiveNode("clause");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    evidenceRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
    evidenceRef.current?.focus({ preventScroll: true });
    trackEvent("demo_clause_open", { contract_id: contract.id, clause_id: clause?.id, source: "view_in_contract" });
  };

  const chooseDecisionPath = (node) => {
    setActiveNode(node);
    trackEvent("demo_decision_path_step", { contract_id: contract.id, risk_id: risk?.id || "none", destination: node });
    if (nodeEvent[node]) trackEvent(nodeEvent[node], { contract_id: contract.id, risk_id: risk?.id || "none", source: "decision_path" });
  };

  const detail = {
    contract: <><span className="od-eyebrow">Source agreement</span><h4>{contract.title}</h4><p>{contract.contractId} · {contract.lessor} to {contract.lessee}</p></>,
    clause: <><span className="od-eyebrow">What does the contract say?</span><h4>Clause {clause?.number} · {clause?.title}</h4><p>{clause?.text}</p><button type="button" onClick={() => evidence && openEvidence(evidence, { riskId: risk?.id })}>Open evidence detail <ExternalLink size={14}/></button></>,
    obligation: <><span className="od-eyebrow">What does it require?</span><h4>{obligation?.title || "No linked obligation"}</h4>{obligation && <dl><div><dt>Actor</dt><dd>{obligation.actor}</dd></div><div><dt>Requirement</dt><dd>{obligation.action} {obligation.object}</dd></div><div><dt>Condition</dt><dd>{obligation.condition}</dd></div></dl>}</>,
    deadline: <><span className="od-eyebrow">When does it matter?</span><h4>{deadline?.title || "No linked deadline"}</h4><p>{deadline?.timing || "No deadline identified"}</p>{deadline && <small>{deadline.trigger} · {deadline.status}</small>}</>,
    risk: <><span className="od-eyebrow">What could go wrong, and why?</span><div className="od-investigation-risk-title"><h4>{risk?.title || "No linked risk"}</h4>{risk && <RiskBadge severity={risk.severity}/>}</div><p>{risk?.rationale || "No risk is linked to this clause."}</p>{risk && <button type="button" onClick={focusEvidence}>View in contract <ExternalLink size={14}/></button>}</>,
    exposure: <><span className="od-eyebrow">What could it cost?</span><h4>{impact ? money(impact.baseAmount, currency) : "Not quantified"}</h4><p>{impact ? "Illustrative potential contractual exposure" : "No prepared financial scenario is linked to this risk."}</p>{impact?.breakdown && <dl className="od-investigation-breakdown">{impact.breakdown.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{money(item.amount, currency)}</dd><button type="button" aria-label={`Trace ${item.label} to source evidence`} onClick={() => { openEvidence(evidence, { riskId: risk?.id }); trackEvent("demo_exposure_component_open", { contract_id: contract.id, risk_id: risk?.id, component: item.label }); }}>Trace</button></div>)}<div className="is-total"><dt>Total</dt><dd>{money(impact.baseAmount, currency)}</dd></div></dl>}<small>Representative demo data · not a customer result</small></>,
    action: <><div className="od-action-heading"><DemoBadge tone="success">RECOMMENDED ACTION</DemoBadge><span>Before scheduled redelivery</span></div><h4>{impact?.action || "Review this clause and assign an accountable owner."}</h4>{impact?.actionWhy && <><p>{impact.actionWhy}</p><dl><div><dt>Source</dt><dd>Clause {clause?.number}</dd></div><div><dt>Risk</dt><dd>{risk?.title}</dd></div><div><dt>Exposure</dt><dd>{impact ? money(impact.baseAmount, currency) : "Not quantified"}</dd></div></dl></>}</>,
  }[activeNode];

  return <section id="contract-investigation" className="od-investigation" aria-labelledby="od-investigation-title">
    <header className="od-investigation-header">
      <div><span className="od-eyebrow">Contract Intelligence / connected investigation</span><h2 id="od-investigation-title">Follow the evidence from contract to action.</h2><p>Select a clause or follow the relationship path. Every finding remains connected to prepared source evidence.</p></div>
      <DemoBadge tone="neutral">SYNTHETIC DEMO</DemoBadge>
    </header>
    <div className="od-investigation-split">
      <section className="od-contract-evidence" aria-label="Contract evidence">
        <header><span>Contract / Evidence</span><strong>{contract.pages} pages · v1.0</strong></header>
        <nav aria-label="Representative contract clauses">{contract.clauses.map((item) => <button type="button" key={item.id} aria-pressed={item.id === clause?.id} className={item.id === clause?.id ? "is-active" : ""} onClick={() => selectClause(item.id)}><span>Clause {item.number}</span><strong>{item.title}</strong></button>)}</nav>
        <article ref={evidenceRef} tabIndex="-1" className="od-contract-clause" aria-live="polite"><div><span>Clause {clause?.number}</span><DemoBadge tone="neutral">Page {evidence?.page}</DemoBadge></div><h3>{clause?.title}</h3><p>{clause?.text}</p><button type="button" onClick={() => evidence && openEvidence(evidence, { riskId: risk?.id })}>View source evidence <ExternalLink size={14}/></button></article>
      </section>
      <section className="od-connected-intelligence" aria-label="Operion Intelligence">
        <header><span>Operion Intelligence</span><strong>Evidence-linked</strong></header>
        <ol className="od-intelligence-chain">{nodes.map(([id, label, value], index) => { const Icon = NODE_ICONS[id]; return <li key={id}><button type="button" aria-pressed={activeNode === id} className={activeNode === id ? "is-active" : ""} onClick={() => selectNode(id)}><Icon size={15}/><span>{label}</span><strong>{value}</strong></button>{index < nodes.length - 1 && <ArrowDown size={13} aria-hidden="true"/>}</li>; })}</ol>
        <div className={`od-intelligence-detail${activeNode === "action" ? " is-action" : ""}`} aria-live="polite" aria-atomic="true">{detail}</div>
        {risk && <div className="od-decision-path"><span className="od-eyebrow">Explore return-condition risk</span><h3>What would you like to investigate?</h3><div>{[["clause", "Contract Evidence"], ["obligation", "Obligation"], ["exposure", "Financial Exposure"], ["action", "Recommended Action"]].map(([node, label]) => <button type="button" key={node} onClick={() => chooseDecisionPath(node)}>{label}</button>)}</div></div>}
      </section>
    </div>
  </section>;
}
