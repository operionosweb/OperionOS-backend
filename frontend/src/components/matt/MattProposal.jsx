import React from "react";
import { Link } from "react-router-dom";
import { FileText, ShieldAlert } from "lucide-react";
import { GlassCard, DemoBadge } from "../../demo/DemoUI";

export default function MattProposal({ result, demo, onCompose }) {
  const risks = result.findings.filter((finding) => finding.type === "risk");
  return <section className="matt-proposal" aria-label="Contract review proposal">
    <header><FileText size={20} aria-hidden="true"/><div><h3>Proposal / contract review</h3><DemoBadge tone="neutral">Decision support / not approved or executed</DemoBadge></div></header>
    <div className="matt-proposal-status"><strong>{result.established ? "Evidence available for review" : "Insufficient evidence"}</strong>
      <p>{demo ? "Prepared demonstration data, not verified customer findings." : result.source === "ai_gateway" ? "Generated interpretation of selected-contract evidence; human review required." : "Selected-contract structured intelligence; human review required."}</p>
    </div>
    <GlassCard className="matt-proposal-card" title="Recommendations">
      {result.reviewRecommendations?.length ? <><DemoBadge tone="neutral">Prepared review suggestions / not generated approval</DemoBadge><ul>{result.reviewRecommendations.map(([label, to]) => <li key={label}>{to ? <Link to={to}>{label}</Link> : label}</li>)}</ul></>
        : <p>The existing assistant supplies findings, not a generated mitigation proposal. No AI recommendation, savings calculation or notice draft has been supplied.</p>}
    </GlassCard>
    <GlassCard className="matt-proposal-card" title="Identified risks" action={<ShieldAlert size={16} aria-hidden="true"/>}>
      {risks.length ? <ul>{risks.map((risk) => <li key={risk.id}>{risk.label}</li>)}</ul>
        : <p>No risk finding was returned for this question. This does not establish that the contract is risk-free.</p>}
    </GlassCard>
    <GlassCard className="matt-proposal-card" title="Proposed review actions">
      <p>Operion review suggestions, not AI-generated or approved actions: inspect the supplied sources, confirm applicability and clarify unresolved findings with the existing assistant.</p>
      {result.findings[0] && <button type="button" onClick={() => onCompose(`Explain ${result.findings[0].type}: ${result.findings[0].label}`.slice(0, 500))}>Clarify first finding</button>}
      {result.contractId && <Link to={`${demo ? "/demo" : "/app"}/contracts/${encodeURIComponent(result.contractId)}${demo ? "/evidence" : "#evidence"}`}>Review contract evidence</Link>}
    </GlassCard>
    <GlassCard className="matt-proposal-card" title="Assumptions and missing information">
      <p>Evidence is limited to the selected response. Validate dates, amounts, attribution, exceptions and source completeness. Only explicitly labeled illustrative flight calculations are available; no customer liability is calculated here.</p>
    </GlassCard>
    <footer><h4>Document actions / unavailable</h4><p>Notice drafting and transmission, PDF notice export, DocuSign, escrow and notary verification are not connected to this interface. No notice has been sent or approved.</p></footer>
  </section>;
}
