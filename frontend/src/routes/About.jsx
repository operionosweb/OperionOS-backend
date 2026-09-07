import React from "react";
import Button from "../components/ui/Button";
import Reveal from "../components/ui/Reveal";
import { Container } from "../components/ui/Layout";

const HERO = "https://images.unsplash.com/photo-1556388158-158ea5ccacbd?auto=format&fit=crop&w=2000&q=84";
const CONTRACT_CONNECTIONS = [
  "Operations", "Suppliers", "Aircraft", "Maintenance", "Financing", "Fuel",
  "Currencies", "Interest rates", "Weather", "Geopolitical events", "Financial exposure",
];
const EVOLUTION = [
  ["01", "Today", "Contract Intelligence", "Understand contracts, clauses, obligations, deadlines and risks."],
  ["02", "Developing", "Aviation Intelligence", "Connect contractual obligations to aviation operations and financial exposure."],
  ["03", "Next", "Predictive Risk Intelligence", "Develop an understanding of how external variables can affect contractual exposure."],
  ["04", "Future", "Scenario Simulation", "Model alternative futures and ask what happens to contracts if the world changes tomorrow."],
];
const AVIATION_AREAS = ["Airlines", "Aircraft leasing", "MRO", "Ground handling", "Airports", "Aviation services"];
const PRINCIPLES = [
  ["Understand before predicting.", "Reliable foresight begins with evidence and contractual meaning."],
  ["Risk should lead to action.", "Intelligence is useful when it helps people decide what to do next."],
  ["Financial exposure matters.", "Contractual risk becomes material through operational and financial consequences."],
  ["AI should recommend, not merely describe.", "The objective is decision support grounded in the source agreement."],
  ["The future of contract intelligence is predictive.", "The direction is from understanding today toward testing tomorrow."],
];
const MATURITY = [
  ["Current", "Contract Intelligence", ["Contract parsing", "Clause extraction", "Obligation extraction", "Deadline identification", "Risk identification", "Contract summaries", "Contract search", "Recommendations"]],
  ["Next", "Predictive Risk Intelligence", ["External variables", "Financial exposure", "Risk forecasting"]],
  ["Future", "Scenario Simulation", ["Economic changes", "Fuel shocks", "Weather disruption", "Supplier failures", "Geopolitical events", "Operational disruption"]],
];

function AboutSection({ label, title, copy, children, dark = false, className = "" }) {
  return <section className={`op-about-section${dark ? " op-about-dark" : ""} ${className}`.trim()}><Container><Reveal className="op-about-intro"><p className="op-about-label">{label}</p><h2>{title}</h2>{copy && <p className="op-about-copy">{copy}</p>}</Reveal>{children}</Container></section>;
}

export default function About() {
  return <main className="op-about-page">
    <section className="op-about-hero op-cinematic-hero" style={{ backgroundImage: `url(${HERO})` }}><div className="op-about-hero-overlay"><Container><Reveal className="op-about-hero-content"><p className="op-about-label">ABOUT OPERION</p><h1>Building the intelligence layer for aviation contracts.</h1><p>Operion transforms complex aviation contracts into actionable intelligence, helping organisations understand obligations, identify risk, quantify exposure and make better decisions.</p><div className="op-about-actions"><Button to="/request-demo" variant="primary">Request a Demo</Button><Button to="/product" variant="secondary">Explore the Platform</Button></div></Reveal></Container></div></section>

    <AboutSection label="WHY OPERION EXISTS" title="Contracts contain the operating reality of aviation." copy="Aviation organisations depend on thousands of contractual relationships. Inside them sit financial commitments, operational obligations, deadlines, liabilities and dependencies. Traditional contract management can tell teams where documents are. Operion is being built to understand what those contracts mean, and eventually what happens when the world around them changes." className="op-about-story" />

    <AboutSection label="OUR CORE BELIEF" title="Contracts are not static documents." copy="They are connected to the assets, organisations, markets and events that shape operational and financial outcomes." dark className="op-about-connections"><Reveal className="op-about-connection-field">{CONTRACT_CONNECTIONS.map((item) => <span key={item}>{item}</span>)}<strong>The real value is not storing contracts.<br />It is understanding their impact.</strong></Reveal></AboutSection>

    <AboutSection label="THE OPERION EVOLUTION" title="From understanding agreements to testing possible futures." copy="Each stage builds on the evidence beneath it. Current capabilities remain clearly separated from future development." className="op-about-evolution-section"><div className="op-about-evolution">{EVOLUTION.map(([number, stage, title, copy], index) => <Reveal key={title} className={`op-about-evolution-step${index > 1 ? " is-future" : ""}`}><div><span>{number}</span><small>{stage}</small></div><h3>{title}</h3><p>{copy}</p></Reveal>)}</div></AboutSection>

    <AboutSection label="AVIATION FIRST" title="Built for aviation first." copy="Aviation is exceptionally contract-intensive and operationally complex. We start where contractual complexity is highest and where better intelligence can create measurable operational and financial value." className="op-about-aviation"><Reveal className="op-about-aviation-grid">{AVIATION_AREAS.map((area, index) => <div key={area}><span>0{index + 1}</span><strong>{area}</strong></div>)}</Reveal></AboutSection>

    <AboutSection label="WHAT OPERION BELIEVES" title="Principles for useful intelligence." dark className="op-about-principles-section"><div className="op-about-principles">{PRINCIPLES.map(([title, copy], index) => <Reveal key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{copy}</p></div></Reveal>)}</div></AboutSection>

    <AboutSection label="CURRENT AND FUTURE" title="Clear about what exists today and what comes next." copy="Operion's direction is ambitious, but credibility depends on making capability maturity explicit." className="op-about-maturity-section"><div className="op-about-maturity">{MATURITY.map(([stage, title, items]) => <Reveal key={stage} className={stage === "Current" ? "is-current" : "is-future"}><span>{stage}</span><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></Reveal>)}</div></AboutSection>

    <section className="op-about-cta"><Container><Reveal><p className="op-about-label">START WITH THE CONTRACT</p><h2>See what your contracts are really telling you.</h2><p>Discover how Operion turns complex aviation contracts into actionable intelligence.</p><Button to="/request-demo" variant="primary">Request a Demo</Button></Reveal></Container></section>
  </main>;
}
