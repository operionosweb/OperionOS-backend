import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import AeroHero from "../components/corporate/AeroHero";
import CapabilityLayers from "../components/corporate/CapabilityLayers";
import { SalesCta, SalesFlow, SalesSection } from "../components/corporate/SalesPage";
import Reveal from "../components/ui/Reveal";

const WORKFLOW = [
  { title: "Understand", copy: "Preserve the source document and contractual context." },
  { title: "Extract", copy: "Structure clauses, obligations, deadlines and risks." },
  { title: "Connect", copy: "Relate findings to parties, aircraft and supporting evidence." },
  { title: "Review", copy: "Inspect the evidence and keep judgment with your team." },
];

export default function Intelligence() {
  return <div className="op-sales-page">
    <AeroHero eyebrow="OPERION INTELLIGENCE" title={<>Start with the contract.<br/><span>See the connections.</span></>} copy="Evidence-linked Contract Intelligence is the foundation. Aviation context, predictive risk and scenario simulation describe the next stages of Operion's development."/>
    <CapabilityLayers/>
    <SalesSection eyebrow="CONTRACT INTELLIGENCE / AVAILABLE NOW" title="Every finding needs a path back to evidence." copy="Explore the existing workflow for understanding contractual language, extracting responsibilities and reviewing the source behind a finding.">
      <SalesFlow items={WORKFLOW}/>
      <Reveal className="oaero-page-links"><Link className="op-btn op-btn-secondary" to="/product">Explore the platform <ArrowRight size={16}/></Link><Link className="op-btn op-btn-secondary" to="/demo/intelligence">Inspect prepared intelligence <ArrowRight size={16}/></Link></Reveal>
    </SalesSection>
    <SalesSection eyebrow="DIRECTION, NOT A LIVE FORECAST" title="A more connected view of exposure." copy="Predictive Risk Intelligence is in development. Scenario Simulation and the Contract Digital Twin are strategic evolution, not mature production capabilities." dark>
      <Reveal className="oaero-resource-grid">
        <article><span className="oaero-pill">IN DEVELOPMENT</span><h3>Predictive Risk Intelligence</h3><p>Explore how fuel, interest rates, foreign exchange, weather and supplier conditions may change contractual exposure.</p><Link to="/aviation">Explore aviation context <ArrowRight size={16}/></Link></article>
        <article><span className="oaero-pill">STRATEGIC ROADMAP</span><h3>Scenario Simulation</h3><p>Compare illustrative operating conditions and possible consequences without presenting estimates as certainty.</p><Link to="/scenarios">Review illustrative scenarios <ArrowRight size={16}/></Link></article>
      </Reveal>
    </SalesSection>
    <SalesCta title="Make the evidence part of the decision." copy="See the current Contract Intelligence workflow in a private demonstration."/>
  </div>;
}
