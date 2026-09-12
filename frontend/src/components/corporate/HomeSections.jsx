import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowRight, Check, CloudRain, FileSearch, Fuel, Gauge,
  Landmark, Plane, Radar, ShieldCheck, TrendingUp, Wind,
} from "lucide-react";
import { Container } from "../ui/Layout";
import Button from "../ui/Button";
import Reveal from "../ui/Reveal";
import { trackEvent } from "../analytics/Analytics";

const HERO_IMAGE = "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=2200&q=88";
const AVIATION_IMAGE = "https://images.unsplash.com/photo-1540962351504-03099e0a754b?auto=format&fit=crop&w=1800&q=84";
const FINAL_IMAGE = "https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?auto=format&fit=crop&w=2000&q=86";
const VIDEO_SRC = "/videos/operion-contract-intelligence.mp4";
const CONTRACTS = ["Aircraft leases", "MRO agreements", "Supplier contracts", "Fuel agreements", "Ground handling", "Insurance"];
const VARIABLES = ["Fuel prices", "Interest rates", "Inflation", "Exchange rates", "Weather", "Geopolitics", "Supplier conditions"];
const EXTRACTIONS = [
  ["Clause 8.4", "Maintenance reserves", "High confidence"],
  ["Obligation", "Return aircraft airworthy", "Lessee"],
  ["Deadline", "60 days before redelivery", "Event-based"],
  ["Risk", "Uncapped return exposure", "Review required"],
];
const SIGNALS = [
  [Fuel, "Fuel", "+18%", "Commercial pressure"],
  [TrendingUp, "FX", "EUR/USD -6%", "Lease cost movement"],
  [Landmark, "Rates", "+1.2%", "Financing pressure"],
  [CloudRain, "Weather", "Elevated", "Operational disruption"],
  [Radar, "Supplier", "Watch", "SLA dependency"],
];
const SCENARIOS = [
  { id: "baseline", label: "Baseline", fuel: 0, fx: 0, supplier: "Stable", exposure: 2.4, delta: 0, action: "Continue monitoring contractual thresholds." },
  { id: "fuel", label: "Fuel +25%", fuel: 25, fx: 0, supplier: "Stable", exposure: 2.78, delta: 380, action: "Review fuel escalation and pass-through provisions." },
  { id: "supplier", label: "Supplier disruption", fuel: 0, fx: 0, supplier: "Disrupted", exposure: 3.06, delta: 660, action: "Review SLA remedies and diversify critical supply exposure." },
  { id: "combined", label: "Combined shock", fuel: 25, fx: -8, supplier: "Disrupted", exposure: 3.62, delta: 1220, action: "Escalate commercial review and model mitigation options." },
];
const SEGMENTS = [
  ["Airlines", "Connect disruption to lease, supplier and service obligations."],
  ["Aircraft lessors", "Track maintenance, payment and redelivery exposure."],
  ["MRO organisations", "Monitor turnaround, service-level and parts commitments."],
  ["Aviation consultancies", "Accelerate evidence-backed review across client portfolios."],
  ["Ground handling providers", "Trace SLA thresholds, responsibilities and penalties."],
  ["Airport operators", "Understand concession, infrastructure and service dependencies."],
];
const EVOLUTION = [
  ["Available now", "Contract Intelligence", "Understand what is written."],
  ["In development", "Predictive Risk Intelligence", "Understand what could happen."],
  ["Roadmap", "Scenario Simulation", "Explore alternative futures."],
  ["Roadmap", "Decision Support", "Know what to do next."],
];

function StoryHeading({ index, eyebrow, title, copy, inverse = false }) {
  return <Reveal className={`op-story-heading${inverse ? " is-inverse" : ""}`}><p className="op-story-index">{index}</p><div><p className="op-story-eyebrow">{eyebrow}</p><h2>{title}</h2>{copy && <p className="op-story-copy">{copy}</p>}</div></Reveal>;
}

function IntelligencePulse() {
  return <div className="op-story-pulse" aria-hidden="true"><i /><i /><i /></div>;
}

function StoryCta({ copy, location, inverse = false }) {
  return <Reveal className={`op-story-inline-cta${inverse ? " is-inverse" : ""}`}><p>{copy}</p><Button to="/request-demo" onClick={() => trackEvent("request_demo_click", { location })}>Request a demo <ArrowRight size={16} /></Button></Reveal>;
}

export default function HomeSections() {
  const [scenarioId, setScenarioId] = useState("baseline");
  const productVideoRef = useRef(null);
  const scenario = SCENARIOS.find((item) => item.id === scenarioId) || SCENARIOS[0];
  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPlayback = () => {
      if (!productVideoRef.current) return;
      productVideoRef.current.muted = true;
      if (motionPreference.matches) productVideoRef.current.pause();
      else productVideoRef.current.play().catch(() => {});
    };
    syncPlayback();
    motionPreference.addEventListener("change", syncPlayback);
    return () => motionPreference.removeEventListener("change", syncPlayback);
  }, []);
  const selectAdjacentScenario = (event, currentIndex) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? SCENARIOS.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + SCENARIOS.length) % SCENARIOS.length;
    setScenarioId(SCENARIOS[nextIndex].id);
    event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[nextIndex]?.focus();
  };

  return <>
    <section className="op-story-hero op-cinematic-hero" style={{ backgroundImage: `url(${HERO_IMAGE})` }}><div className="op-story-hero-shade"><Container className="op-story-hero-layout"><Reveal className="op-story-hero-copy"><p className="op-story-eyebrow">OPERION / AVIATION CONTRACT INTELLIGENCE</p><h1>Understand your contracts.<br /><span>See what&apos;s coming.</span></h1><p className="op-story-hero-lead">AI-powered Contract Intelligence for Aviation that reveals obligations, exposure and what to do next.</p><div className="op-story-actions"><Button to="/request-demo" onClick={() => trackEvent("request_demo_click", { location: "home_hero" })}>Request a demo <ArrowRight size={16} /></Button><a className="op-btn op-btn-secondary" href="#product">Explore the platform <ArrowDown size={16} /></a></div></Reveal><Reveal className="op-story-hero-system"><div className="op-story-system-top"><span>OPERION INTELLIGENCE / LIVE VIEW</span><b>CONTRACT INGESTED</b></div><div className="op-story-document-mini"><FileSearch size={20} /><div><strong>Aircraft Lease Agreement</strong><small>184 pages / source preserved</small></div><IntelligencePulse /></div><div className="op-story-system-flow">{["Clauses", "Obligations", "Deadlines", "Risks"].map((item, index) => <div key={item}><span>0{index + 1}</span><strong>{item}</strong><i /></div>)}</div><div className="op-story-system-foot"><span>Evidence linked</span><span>Human review visible</span></div></Reveal></Container><div className="op-story-hero-rail"><Container>{["CONTRACT", "UNDERSTANDING", "RISK", "CONTEXT", "SCENARIO", "ACTION"].map((item, index) => <span key={item}><b>0{index + 1}</b>{item}</span>)}</Container></div></div></section>

    <section className="op-story-section op-story-isolation" id="intelligence"><Container><StoryHeading index="01" eyebrow="THE CORE IDEA" title="Contracts don't exist in isolation." copy="Aviation agreements define the rules. Markets, aircraft, suppliers and operational conditions determine when those rules matter. Operion is the intelligence layer between them." /><Reveal className="op-story-bridge"><div className="op-story-bridge-list"><p>CONTRACTS</p>{CONTRACTS.map((item) => <span key={item}>{item}</span>)}</div><div className="op-story-bridge-core"><div><Plane size={24} /><strong>OPERION</strong><small>INTELLIGENCE LAYER</small></div><span className="op-story-flight-path" /></div><div className="op-story-bridge-list is-world"><p>THE WORLD</p>{VARIABLES.map((item) => <span key={item}>{item}</span>)}</div></Reveal></Container></section>

    <section className="op-story-section op-story-contract"><Container><StoryHeading index="02" eyebrow="CONTRACT INTELLIGENCE / AVAILABLE NOW" title="First, Operion understands the contract." copy="Operion turns dense aviation agreements into clauses, obligations, deadlines and risks, each linked to source evidence." /><Reveal className="op-story-contract-stage"><div className="op-story-paper"><div className="op-story-paper-head"><span>LEASE AGREEMENT</span><b>PAGE 47 / 184</b></div><h3>8.4 Maintenance &amp; Redelivery</h3><p>The Lessee shall maintain the Aircraft in an airworthy condition and deliver all technical records no later than sixty (60) days prior to the scheduled redelivery date...</p><p>The obligations set out herein survive any operational interruption unless otherwise agreed in writing.</p><span className="op-story-paper-highlight">SOURCE CLAUSE DETECTED</span></div><div className="op-story-transform" aria-hidden="true"><i /><ArrowRight size={22} /></div><div className="op-story-extractions"><div className="op-story-panel-label"><span>STRUCTURED INTELLIGENCE</span><b>4 FINDINGS</b></div>{EXTRACTIONS.map(([type, value, status], index) => <div key={type} className="op-story-extraction"><span>0{index + 1}</span><div><small>{type}</small><strong>{value}</strong></div><em>{status}</em></div>)}</div></Reveal><StoryCta copy="See how Operion works with your contracts." location="home_contract_value" /></Container></section>

    <section className="op-story-section op-story-aviation"><div className="op-story-aviation-image" style={{ backgroundImage: `url(${AVIATION_IMAGE})` }} aria-hidden="true" /><Container><StoryHeading index="03" eyebrow="AVIATION CONTEXT / DIRECTION" title="Then it understands what surrounds it." copy="Operion is being built to connect contractual intelligence with the aviation variables that can change its significance. External feeds shown here represent product direction." inverse /><Reveal className="op-story-signal-grid">{SIGNALS.map(([Icon, label, value, meaning], index) => <div key={label} className={`op-story-signal signal-${index + 1}`}><Icon size={18} /><span>{label}</span><strong>{value}</strong><small>{meaning}</small></div>)}</Reveal></Container></section>

    <section className="op-story-section op-story-risk"><Container><StoryHeading index="04" eyebrow="PREDICTIVE RISK / IN DEVELOPMENT" title="See risk before it becomes exposure." copy="Operion's direction goes beyond identifying a clause. It connects the contractual mechanism to changing conditions and shows the potential decision impact without presenting estimates as certainty." /><Reveal className="op-story-exposure-stage"><div className="op-story-exposure-contract"><span>AIRCRAFT LEASE</span><strong>Current exposure</strong><b>€2.40M</b><small>Illustrative contractual baseline</small></div><div className="op-story-exposure-conditions"><p>CHANGING CONDITIONS</p><div><Fuel size={17} /><span>Fuel</span><strong>+18%</strong></div><div><Wind size={17} /><span>EUR / USD</span><strong>-6%</strong></div><div><Landmark size={17} /><span>Interest rates</span><strong>+1.2%</strong></div></div><div className="op-story-exposure-result"><span>POTENTIAL EXPOSURE</span><strong>€3.08M</strong><p>+€680K modelled change</p><small>Illustrative scenario, not a forecast</small></div></Reveal></Container></section>

    <section className="op-story-scenario" id="scenarios"><Container><StoryHeading index="05" eyebrow="SCENARIO SIMULATION / ROADMAP DEMONSTRATION" title="What happens if the world changes tomorrow?" copy="See how a change in operating conditions could alter contractual exposure and the action a team should consider. Illustrative roadmap demonstration, not a live forecast." inverse /><Reveal className="op-story-scenario-console"><div className="op-story-scenario-chain" aria-label="Scenario value chain"><span>Aircraft contract</span><ArrowRight aria-hidden="true" /><span>World changes</span><ArrowRight aria-hidden="true" /><span>Exposure changes</span><ArrowRight aria-hidden="true" /><span>Action recommended</span></div><div className="op-story-scenario-tabs" role="tablist" aria-label="Illustrative exposure scenarios">{SCENARIOS.map((item, index) => <button key={item.id} id={`scenario-tab-${item.id}`} type="button" role="tab" aria-controls="scenario-panel" aria-selected={item.id === scenarioId} tabIndex={item.id === scenarioId ? 0 : -1} onClick={() => setScenarioId(item.id)} onKeyDown={(event) => selectAdjacentScenario(event, index)}>{item.label}</button>)}</div><div id="scenario-panel" className="op-story-scenario-body" role="tabpanel" aria-live="polite" aria-labelledby={`scenario-tab-${scenario.id}`}><div className="op-story-variable-stack"><p>INPUT CONDITIONS</p><dl><div><dt>Fuel price</dt><dd className={scenario.fuel ? "is-alert" : ""}>{scenario.fuel ? `+${scenario.fuel}%` : "Baseline"}</dd></div><div><dt>FX movement</dt><dd className={scenario.fx ? "is-alert" : ""}>{scenario.fx ? `${scenario.fx}%` : "Baseline"}</dd></div><div><dt>Supplier state</dt><dd className={scenario.supplier === "Disrupted" ? "is-alert" : ""}>{scenario.supplier}</dd></div></dl></div><div className="op-story-scenario-gauge"><Gauge size={23} /><span>MODELLED EXPOSURE</span><strong>€{scenario.exposure.toFixed(2)}M</strong><div><i style={{ width: `${Math.min(100, (scenario.exposure / 4) * 100)}%` }} /></div><small>{scenario.delta ? `+€${scenario.delta.toLocaleString()}K from baseline` : "Current illustrative baseline"}</small></div><div className="op-story-recommended"><Check size={19} /><span>RECOMMENDED ACTION</span><strong>{scenario.action}</strong><small>Decision support only. Not legal advice.</small></div></div></Reveal><StoryCta copy="Explore how Operion can identify contractual exposure before it becomes a problem." location="home_scenario_value" inverse /></Container></section>

    <section className="op-story-section op-story-action"><Container><StoryHeading index="06" eyebrow="DECISION SUPPORT" title={<>Don&apos;t just detect the risk.<br />Know what to do next.</>} copy="Every material insight should lead to a clear, evidence-backed decision path while keeping judgment with your team." /><Reveal className="op-story-action-path"><div><span>01</span><small>RISK</small><strong>Supplier concentration threatens SLA performance</strong></div><ArrowRight /><div><span>02</span><small>EVIDENCE</small><strong>Clause 12.2 / sole-source dependency</strong></div><ArrowRight /><div className="is-action"><span>03</span><small>ACTION</small><strong>Review SLA remedies and supplier diversification</strong></div></Reveal><Reveal className="op-story-action-list">{["Clause improvement", "Negotiation strategy", "Risk mitigation", "Contract restructuring", "Supplier diversification"].map((item) => <span key={item}><Check size={15} />{item}</span>)}</Reveal></Container></section>

    <section className="op-story-product" id="product"><Container><StoryHeading index="07" eyebrow="THE OPERION PLATFORM / REAL PRODUCT" title="Intelligence you can inspect, not just accept." copy="Upload a contract. Extract clauses, obligations, deadlines and risks. Search the analysis and trace every important finding back to evidence." /></Container><Reveal className="op-story-product-frame"><video ref={productVideoRef} controls loop muted playsInline preload="metadata" aria-label="Operion contract intelligence product demonstration"><source src={VIDEO_SRC} type="video/mp4" /></video></Reveal></section>

    <section className="op-story-section op-story-segments"><Container><StoryHeading index="08" eyebrow="AVIATION FIRST" title="Built for the complexity of aviation." copy="One Contract Intelligence foundation, shaped around six aviation operating environments." /><Reveal className="op-story-segment-system"><div className="op-story-segment-core"><Plane size={25} /><strong>OPERION</strong><small>AVIATION INTELLIGENCE</small></div>{SEGMENTS.map(([title, copy], index) => <div key={title} className={`op-story-segment segment-${index + 1}`}><span>0{index + 1}</span><strong>{title}</strong><p>{copy}</p></div>)}</Reveal></Container></section>

    <section className="op-story-section op-story-evolution"><Container><StoryHeading index="09" eyebrow="THE OPERION DIFFERENCE" title="One foundation. A more intelligent future." copy="The roadmap is a progression, not a claim that every layer is live today." /><Reveal className="op-story-evolution-rail">{EVOLUTION.map(([status, title, copy], index) => <div key={title}><span>0{index + 1}</span><small>{status}</small><strong>{title}</strong><p>{copy}</p></div>)}</Reveal><Reveal className="op-story-trust"><ShieldCheck size={22} /><p>Current intelligence is evidence-linked and reviewable. Predictive and simulation layers are clearly identified as developing or roadmap capabilities.</p></Reveal></Container></section>

    <section className="op-story-final" style={{ backgroundImage: `url(${FINAL_IMAGE})` }}><div><Container><Reveal><p className="op-story-eyebrow">OPERION / REQUEST A PRIVATE DEMONSTRATION</p><h2>Turn your contracts<br />into intelligence.</h2><p>Bring an aviation contract or a question about exposure. See how Operion structures the evidence and supports the decision.</p><div className="op-story-actions"><Button to="/request-demo" onClick={() => trackEvent("request_demo_click", { location: "home_final" })}>Request a demo <ArrowRight size={16} /></Button><Button to="/product" variant="secondary">Explore the platform</Button></div></Reveal></Container></div></section>
  </>;
}