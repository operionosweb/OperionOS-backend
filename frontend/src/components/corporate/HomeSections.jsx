import React from "react";
import { Container } from "../ui/Layout";
import Button from "../ui/Button";
import Reveal from "../ui/Reveal";

const AIRCRAFT = "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1800&q=82";
const AIRPORT = "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1400&q=80";
const HOME_FINAL = "https://images.unsplash.com/photo-1529070538774-1843cb3265df?auto=format&fit=crop&w=1800&q=82";
const CORE = [
  ["01", "UPLOAD", "Ingest complex legal documents in any format.", "^"],
  ["02", "EXTRACT", "AI identifies clauses, entities, and obligations.", "o"],
  ["03", "MAP", "Build relationship graphs between contract terms.", "#"],
  ["04", "ANALYZE", "Detect risks, anomalies, and non-standard terms.", "~"],
  ["05", "SIMULATE", "Run scenarios against external market variables.", "O"],
  ["06", "RECOMMEND", "Provide actionable insights for negotiation.", "*"],
];

function StitchSection({ label, title, copy, children, dark = false }) {
  return <section className={`op-stitch-section${dark ? " op-stitch-section-dark" : ""}`}><Container><Reveal><p className="op-stitch-label">{label}</p><h2>{title}</h2>{copy && <p className="op-stitch-copy">{copy}</p>}</Reveal>{children}</Container></section>;
}

function Image({ src, alt, className = "" }) { return <img className={`op-stitch-image ${className}`} src={src} alt={alt} loading="lazy" />; }

export default function HomeSections() {
  return <>
    <section className="op-stitch-hero op-cinematic-hero" style={{ backgroundImage: `url(${AIRCRAFT})` }}><div className="op-stitch-hero-overlay"><Container><Reveal><p className="op-stitch-label">AVIATION CONTRACT INTELLIGENCE</p><h1>Contracts.<br />Understood.</h1><p>The first AI platform built specifically for the complexities of aerospace and aviation contracts.</p><Button to="/demo" variant="primary">Request Demo <span aria-hidden="true">↗</span></Button></Reveal></Container></div></section>
    <StitchSection label="01 / THE PROBLEM" title={<>Aviation changes.<br />Contracts don't.</>} copy="The aerospace industry operates in a constant state of flux. Fuel prices, geopolitical tensions, and supply chain disruptions shift daily. Yet, the contracts governing these multi-million dollar agreements remain static, locked in complex legal language."><div className="op-stitch-variables"><div className="op-stitch-variable-frame" aria-hidden="true" /><div>↗ <span>VARIABLE: FUEL SHOCK</span></div><div>! <span>VARIABLE: SUPPLIER DELAY</span></div><div>◎ <span>VARIABLE: REGULATORY SHIFT</span></div></div></StitchSection>
    <StitchSection label="02 / INTELLIGENCE CORE" title="How Operion Works" copy="A deterministic pipeline that transforms unstructured agreements into structured, queryable intelligence." dark><div className="op-stitch-core">{CORE.map(([number, title, copy, icon]) => <article key={title}><span className="op-stitch-icon" aria-hidden="true">{icon}</span><div><p>{number} / {title}</p><h3>{title}</h3><span>{copy}</span></div></article>)}</div></StitchSection>
    <StitchSection label="03 / AVIATION FIRST" title="Aviation Intelligence" copy="Operion understands the aviation context: from MRO schedules to wet lease agreements, it connects contractual logic to operational reality."><div className="op-stitch-aviation"><Image src={AIRPORT} alt="Busy airport ramp with aircraft and ground handling vehicles" /><div><p className="op-stitch-label">GROUND TRUTH</p><h3>One intelligence layer for a complex operating environment.</h3></div></div></StitchSection>
    <StitchSection label="04 / PREDICTIVE RISK" title="See the shockwaves." copy="Map how an external event cascades through your contractual obligations." dark><div className="op-stitch-cascade"><article><b>EXTERNAL SHOCK</b><span>Global Supply Chain Disruption</span></article><article><b>TIER 1 IMPACT</b><span>OEM Delivery Delays (6+ Months)</span></article><article><b>TIER 2 IMPACT</b><span>Liquidated Damages Triggered</span></article></div></StitchSection>
    <StitchSection label="05 / SCENARIO SIMULATION" title="Test what comes next." copy="Evaluate potential outcomes against active aviation agreements before they occur."><div className="op-stitch-scenarios"><article><b>FUEL PRICE SPIKE</b><h3>40% increase in Jet-A1 prices</h3><p>Simulate impact against wet lease and charter agreements.</p></article><article><b>SUPPLIER INSOLVENCY</b><h3>Critical Tier 2 disruption</h3><p>Analyze exposure if a manufacturing supplier fails.</p></article><article><b>REGULATORY CHANGE</b><h3>New emission standards</h3><p>Evaluate compliance gaps across the portfolio.</p></article></div></StitchSection>
    <section className="op-stitch-final" style={{ backgroundImage: `url(${HOME_FINAL})` }}><div><Container><Reveal><p className="op-stitch-label">06 / TAKE ACTION</p><h2>Ready for departure?</h2><Button to="/demo" variant="primary">Request a Demo <span aria-hidden="true">↗</span></Button></Reveal></Container></div></section>
  </>;
}