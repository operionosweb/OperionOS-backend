import React from "react";
import { ArrowDown, ArrowRight, Check } from "lucide-react";
import { SalesCta, SalesFlow, SalesHero, SalesSection } from "../components/corporate/SalesPage";
import Reveal from "../components/ui/Reveal";
import { trackEvent } from "../components/analytics/Analytics";
import ExecutiveCockpit from "../components/corporate/ExecutiveCockpit";

const CAPABILITIES = [
  ["Contract Understanding", "Analyse complex aviation contracts and supporting documents while preserving their structure and context."],
  ["Clause Intelligence", "Identify commercial, operational and risk-related provisions and keep each insight linked to evidence."],
  ["Obligation Extraction", "Surface responsibilities, conditions and commitments across contracts."],
  ["Deadline Intelligence", "Identify deadlines, notice periods, renewal windows and other time-sensitive events."],
  ["Risk Detection", "Highlight contractual risks, unusual provisions and potential areas of exposure for review."],
  ["Contract Search", "Search structured contract intelligence and locate relevant clauses and evidence quickly."],
  ["Executive Summaries", "Turn complex contractual material into concise, decision-ready intelligence."],
  ["Recommended Actions", "Support mitigation, negotiation and contract improvement with evidence-backed recommendations."],
];
const WORKFLOW = [
  { title: "Understand", copy: "Operion processes complex aviation contracts." },
  { title: "Extract", copy: "Obligations, clauses, deadlines, financial terms and dependencies are identified." },
  { title: "Connect", copy: "Contract intelligence is connected with operational and financial context." },
  { title: "Assess", copy: "Risks and potential exposure become visible." },
  { title: "Recommend", copy: "Operion helps identify appropriate actions." },
];
const IMPACT = ["SLA obligation", "Operational disruption", "Potential contractual penalty", "Financial exposure", "Recommended action"];
const INTELLIGENCE_CHAIN = ["Contract", "Clause", "Obligation", "Risk", "Exposure", "Financial Impact", "Recommended Action"];
const BUSINESS_CONTEXT = ["Aircraft lease obligations", "Maintenance requirements", "Supplier commitments", "Payment obligations", "Termination rights", "Renewal windows", "Service-level requirements"];
const ROADMAP = [
  ["Today", "Contract Intelligence", "Understand contracts, obligations, risks and exposure."],
  ["Next", "Predictive Risk Intelligence", "Connect relevant external variables to potential contractual exposure."],
  ["Future", "Scenario Simulation", "Explore what could happen to contracts when operating conditions change."],
  ["Long-term vision", "Contract Digital Twin", "A living intelligence model of contractual relationships and consequences."],
];

export default function Product() {
  return <main className="op-sales-page">
    <SalesHero eyebrow="OPERION PRODUCT" title="Contract Intelligence for Aviation" copy="Turn complex aviation contracts into operational, financial and risk intelligence.">
      <a className="op-btn op-btn-secondary" href="#workflow" onClick={() => trackEvent("how_it_works_click", { location: "product_hero" })}>See How It Works <ArrowDown size={16} /></a>
    </SalesHero>

    <ExecutiveCockpit/>

    <SalesSection eyebrow="CURRENT CAPABILITIES" title="Understand what your contracts actually contain." copy="Operion helps teams find the contractual information that governs operational commitments and commercial exposure.">
      <Reveal className="op-sales-capability-grid">{CAPABILITIES.map(([title, copy]) => <article key={title}><Check size={17} /><h3>{title}</h3><p>{copy}</p></article>)}</Reveal>
    </SalesSection>

    <SalesSection eyebrow="CONTRACT INTELLIGENCE WORKFLOW" title="A clear path from document to decision." id="workflow" className="op-sales-workflow-section">
      <div id="workflow"><SalesFlow items={WORKFLOW} /></div>
    </SalesSection>

    <SalesSection eyebrow="FINANCIAL & OPERATIONAL INTELLIGENCE" title="Understand what your contracts mean for the business." copy="Contracts should not be analysed in isolation. Operion connects contractual language with operational obligations, potential disruption and financial consequence." dark>
      <Reveal className="op-sales-impact-example"><div><span>Illustrative scenario</span><strong>Contract-to-impact reasoning</strong></div><ol>{IMPACT.map((item) => <li key={item}>{item}</li>)}</ol></Reveal>
      <Reveal className="op-sales-context-list">{BUSINESS_CONTEXT.map((item) => <span key={item}><Check size={14} />{item}</span>)}</Reveal>
    </SalesSection>

    <SalesSection eyebrow="THE DIFFERENCE" title="Most systems store contracts. Operion understands them." copy="Traditional systems primarily support storage, administration and retrieval. Operion extracts intelligence and connects contractual information with operational and financial consequences.">
      <Reveal className="op-sales-intelligence-chain">{INTELLIGENCE_CHAIN.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong>{index < INTELLIGENCE_CHAIN.length - 1 && <ArrowRight size={15} aria-hidden="true" />}</div>)}</Reveal>
    </SalesSection>

    <SalesSection eyebrow="STRATEGIC EVOLUTION" title="From Contract Intelligence to Predictive Intelligence." copy="Operion is evolving toward understanding how fuel prices, interest rates, inflation, exchange rates, weather, supplier risk and geopolitical events may affect contractual exposure.">
      <Reveal className="op-sales-evolution">{ROADMAP.map(([stage, title, copy]) => <article key={stage}><span>{stage}</span><h3>{title}</h3><p>{copy}</p></article>)}</Reveal>
      <p className="op-sales-roadmap-note">Predictive Risk Intelligence, Scenario Simulation and the Contract Digital Twin are strategic evolution, not presented as mature production capabilities.</p>
    </SalesSection>

    <SalesCta title="See what Operion can uncover in your contracts." />
  </main>;
}
