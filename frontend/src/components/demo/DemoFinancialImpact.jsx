import React, { useEffect, useState } from "react";
import { ArrowDown, Calculator, CircleDollarSign, ExternalLink, ShieldCheck, X } from "lucide-react";
import { DemoBadge, EmptyState } from "../../demo/DemoUI";

function money(amount, currency) {
  if (!Number.isFinite(amount)) return "Not quantified";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function impactPath(item, contract) {
  const clause = contract.clauses.find((entry) => entry.id === item.clauseId);
  const obligation = contract.obligations.find((entry) => entry.id === item.obligationId);
  return [
    ["Event", item.event],
    ["Contract condition", item.condition],
    ["Clause / obligation", `Clause ${clause?.number || "not linked"} · ${obligation?.title || "Obligation unavailable"}`],
    ["Financial consequence", item.calculation],
    ["Mitigation action", item.action || "No mitigation action assigned"],
    ["Remaining exposure", money(item.exposureAfterAction, contract.financialImpact.currency)],
    ["Potential protected value", money(item.protectedValue, contract.financialImpact.currency)],
  ];
}

function ImpactDrawer({ contract, item, getEvidence, openEvidence, close }) {
  const path = impactPath(item, contract);
  const [selectedStep, setSelectedStep] = useState(path[0]);
  const clause = contract.clauses.find((entry) => entry.id === item.clauseId);
  const obligation = contract.obligations.find((entry) => entry.id === item.obligationId);
  const evidence = getEvidence(item.evidenceId);

  useEffect(() => {
    const handleKey = (event) => event.key === "Escape" && close();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [close]);

  return <div className="od-drawer-backdrop" role="presentation" onMouseDown={close}>
    <aside className="od-financial-drawer" role="dialog" aria-modal="true" aria-label={`Why ${item.title}`} onMouseDown={event=>event.stopPropagation()}>
      <header><div><DemoBadge>DEMO / SYNTHETIC ASSUMPTIONS</DemoBadge><h2>{item.title}</h2><p>{item.exposureType}</p></div><button type="button" className="od-icon-button" aria-label="Close financial impact" onClick={close}><X size={17}/></button></header>
      <section className="od-financial-result"><span>Estimated financial impact</span><strong>{money(item.baseAmount, contract.financialImpact.currency)}</strong><small>Transparent synthetic calculation · not a prediction</small></section>
      <section><h3>Financial Impact Tree</h3><p>Select each step to inspect the exposure path.</p><ol className="od-impact-path">{path.map((step,index)=><li key={step[0]}><button type="button" aria-pressed={selectedStep[0]===step[0]} className={selectedStep[0]===step[0]?"is-active":""} onClick={()=>setSelectedStep(step)}><small>{step[0]}</small><strong>{step[1]}</strong></button>{index<path.length-1&&<ArrowDown size={13}/>}</li>)}</ol><div className="od-impact-step" role="status"><small>{selectedStep[0]}</small><strong>{selectedStep[1]}</strong></div></section>
      <section><h3>Calculation and assumptions</h3><p className="od-impact-formula"><Calculator size={15}/>{item.calculation}</p><dl className="od-impact-variables">{item.variables.map(variable=><div key={variable.label}><dt>{variable.label}</dt><dd>{variable.value}</dd></div>)}</dl>{item.assumptions.map(assumption=><p key={assumption} className="od-assumption">Synthetic assumption: {assumption.replace(/^The /,"The ")}</p>)}</section>
      <section><h3>Contract provenance</h3><dl className="od-detail-list"><div><dt>Clause</dt><dd>{clause ? `${clause.number} · ${clause.title}` : "Not linked"}</dd></div><div><dt>Obligation</dt><dd>{obligation?.title || "Not linked"}</dd></div><div><dt>Consequence</dt><dd>{item.consequence}</dd></div></dl>{evidence&&<button type="button" className="od-button od-button-secondary" onClick={()=>{close();openEvidence(evidence);}}>Inspect source evidence <ExternalLink size={14}/></button>}</section>
      <section><h3>Recommended action to potential value</h3><p>{item.action || "No action assigned for this current obligation."}</p><div className="od-value-flow"><span><small>Before action</small><strong>{money(item.baseAmount,contract.financialImpact.currency)}</strong></span><span><small>After action</small><strong>{money(item.exposureAfterAction,contract.financialImpact.currency)}</strong></span><span><small>Potential protected value</small><strong>{money(item.protectedValue,contract.financialImpact.currency)}</strong></span></div><p className="od-assumption">Potential protected value is an illustrative estimate, not guaranteed savings.</p></section>
    </aside>
  </div>;
}

export default function DemoFinancialImpact({ contract, getEvidence, openEvidence }) {
  const [selectedImpact, setSelectedImpact] = useState(null);
  const data = contract.financialImpact;
  if (!data?.items?.length) return <EmptyState title="No quantifiable financial exposure found" description="This prepared demo contract has no financial impact assumptions."/>;
  const metrics = [
    ["Current financial exposure",data.currentContractualExposure,"Current contract state"],
    ["Event-driven potential exposure",data.eventDrivenExposure,"Defined events only"],
    ["Potential avoidable exposure",data.potentialAvoidableExposure,"Synthetic mitigation assumptions"],
    ["Potential protected value",data.potentialProtectedValue,"Illustrative, not guaranteed"],
  ];
  return <>
    <div className="od-financial-metrics">{metrics.map(([label,value,note])=><article key={label}><span><CircleDollarSign size={15}/></span><div><small>{label}</small><strong>{money(value,data.currency)}</strong><p>{note}</p></div></article>)}</div>
    <div className="od-financial-disclosure"><ShieldCheck size={17}/><p>All figures below use prepared synthetic aviation assumptions. They are designed to demonstrate transparent contract-to-value reasoning and are not customer data or forecasts.</p></div>
    <div className="od-financial-list">{data.items.map(item=><article key={item.id} className="od-card od-financial-card"><header><div><span className="od-eyebrow">{item.category}</span><h2>{item.title}</h2></div><DemoBadge tone={item.exposureType.startsWith("Current")?"success":"neutral"}>{item.exposureType}</DemoBadge></header><strong className="od-financial-amount">{money(item.baseAmount,data.currency)}</strong><dl><div><dt>Event</dt><dd>{item.event}</dd></div><div><dt>Clause</dt><dd>{contract.clauses.find(clause=>clause.id===item.clauseId)?.number||"Not linked"}</dd></div><div><dt>Action</dt><dd>{item.action||"No action assigned"}</dd></div><div><dt>Potential protected value</dt><dd>{money(item.protectedValue,data.currency)}</dd></div></dl><button type="button" className="od-button od-button-secondary" onClick={()=>setSelectedImpact(item)}><Calculator size={15}/>WHY? View calculation</button></article>)}</div>
    {selectedImpact&&<ImpactDrawer contract={contract} item={selectedImpact} getEvidence={getEvidence} openEvidence={openEvidence} close={()=>setSelectedImpact(null)}/>} 
  </>;
}