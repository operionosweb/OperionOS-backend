import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import Reveal from "../components/ui/Reveal";
import { Container } from "../components/ui/Layout";
import { INTELLIGENCE_AVAILABILITY } from "../lib/contractIntelligenceModel";

const HERO = "https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?auto=format&fit=crop&w=2000&q=84";
const SEGMENT_IMAGES = [
  "https://images.unsplash.com/photo-1540962351504-03099e0a754b?auto=format&fit=crop&w=1400&q=82",
  "https://images.unsplash.com/photo-1559060017-445fb9722f2a?auto=format&fit=crop&w=1400&q=82",
  "https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=1400&q=82",
  "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1400&q=82",
  "https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1400&q=82",
  "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1400&q=82",
];
const SEGMENTS = [
  ["AIRLINES", "Turn fleet complexity into clarity.", "Airlines manage contractual relationships across aircraft, engines, maintenance, suppliers, airports and service providers.", "Aircraft leases", "Maintenance agreements", "Engine contracts", "Supplier SLAs", "Airport agreements", "Service contracts"],
  ["AIRCRAFT LEASING", "See the asset behind the contract.", "Aircraft leases connect financial, operational and technical obligations across the entire asset lifecycle.", "Delivery", "Acceptance", "Maintenance", "Utilisation", "Return"],
  ["MRO", "Every maintenance commitment counts.", "Maintenance contracts contain critical service levels, turnaround requirements, parts obligations and performance conditions.", "Workscope", "SLA", "Turnaround", "Parts", "Warranty", "Compliance"],
  ["CONSULTANCIES", "Turn contract data into strategic advantage.", "Consultancies need to analyse complex contract portfolios, identify exposure and uncover opportunities across aviation assets and relationships.", "Portfolio", "Contracts", "Obligations", "Risk", "Opportunity"],
  ["GROUND HANDLING", "Service levels become operational reality.", "Ground handling agreements contain service levels, turnaround commitments and performance requirements that affect airline and airport operations.", "SLA", "Operational performance", "Contractual condition", "Exposure", "Action"],
  ["AIRPORT OPERATORS", "Connect infrastructure to intelligence.", "Airport operators manage agreements across infrastructure, airlines, concessionaires, service providers and operational partners.", "Airlines", "Ground handling", "MRO", "Retail / concessions", "Infrastructure", "Service providers"],
];
const CHAIN = ["Contract", "Obligation", "Operational event", "Risk", "Financial exposure", "Recommended action"];
const OUTCOMES = ["Reduce contractual exposure", "Identify missed obligations", "Protect revenue", "Improve negotiations", "Anticipate operational impact", "Prioritise action"];
const EXTERNALS = ["Fuel prices", "Interest rates", "Inflation", "Exchange rates", "Weather", "Geopolitical events", "Supplier risk"];

function SolutionsSeo() {
  useEffect(() => {
    const previousTitle = document.title;
    const title = "Operion Solutions | Contract Intelligence for Aviation";
    const description = "See how Operion creates value across airlines, aircraft leasing, MRO, consultancies, ground handling and airport operations.";
    document.title = title;
    let tag = document.head.querySelector('meta[name="description"]');
    const isNew = !tag;
    const previousDescription = tag?.content;
    if (!tag) { tag = document.createElement("meta"); tag.name = "description"; document.head.appendChild(tag); }
    tag.content = description;
    return () => { document.title = previousTitle; if (isNew) tag.remove(); else tag.content = previousDescription || ""; };
  }, []);
  return null;
}

function Section({ label, title, copy, children, dark = false, className = "" }) {
  return <section className={`op-solutions-section${dark ? " op-solutions-dark" : ""} ${className}`.trim()}><Container><Reveal><p className="op-solutions-label">{label}</p><h2>{title}</h2>{copy && <p className="op-solutions-copy">{copy}</p>}</Reveal>{children}</Container></section>;
}

function Chain({ items = CHAIN, numbered = false }) {
  return <div className="op-solutions-chain" aria-label={items.join(" to ")}>{items.map((item, index) => <React.Fragment key={item}><div><span>{numbered ? String(index + 1).padStart(2, "0") : "↓"}</span><strong>{item}</strong></div>{index < items.length - 1 && <b aria-hidden="true">↓</b>}</React.Fragment>)}</div>;
}

function SegmentChapter({ segment, index }) {
  const [label, title, copy, ...items] = segment;
  const image = SEGMENT_IMAGES[index];
  return <article className={`op-solutions-segment op-solutions-segment-${index + 1}`}><div className="op-solutions-segment-image" style={{ backgroundImage: `url(${image})` }} /><div className="op-solutions-segment-content"><p className="op-solutions-label">0{index + 3} / {label}</p><h3>{title}</h3><p>{copy}</p><div className="op-solutions-segment-items">{items.map((item) => <span key={item}>{item}</span>)}</div>{index === 0 && <Button to="/industries/aviation" variant="secondary">Explore airline intelligence <span aria-hidden="true">↗</span></Button>}</div></article>;
}

export default function Solutions() {
  return <>
    <SolutionsSeo />
    <section className="op-solutions-hero" style={{ backgroundImage: `url(${HERO})` }}><div><Container><Reveal><p className="op-solutions-label">SOLUTIONS</p><h1>Intelligence<br />for the aviation<br /><span>ecosystem.</span></h1><p>Every aviation organisation operates through complex contracts, obligations and dependencies. Operion turns that complexity into intelligence that helps teams understand exposure, anticipate change and act earlier.</p><div className="op-solutions-actions"><Button to="/demo" variant="primary">Enter Operion OS <span aria-hidden="true">↗</span></Button><Button to="/industries/aviation" variant="secondary">Explore your sector</Button></div></Reveal></Container></div></section>
    <Section label="01 / THE CHALLENGE" title={<>Every sector<br />has complexity.</>} copy="Airlines, lessors, MROs, airports and service providers operate under thousands of contractual relationships. The rules are distributed across teams and systems, but the consequences still move through one operating environment."><div className="op-solutions-ecosystem"><div className="op-solutions-ecosystem-core"><strong>OPERION</strong><span>One intelligence layer</span></div>{["Aircraft", "Contract", "Supplier", "Maintenance", "Finance", "Operations"].map((item, index) => <div key={item} className={`op-solutions-ecosystem-node op-solutions-ecosystem-node-${index + 1}`}><b>{String(index + 1).padStart(2, "0")}</b>{item}</div>)}</div></Section>
    <Section label="02 / AVIATION ECOSYSTEM" title="One industry. Six operating realities." copy="Different environments create different obligations, dependencies and exposures. The intelligence system underneath them is shared."><div className="op-solutions-segments">{SEGMENTS.map((segment, index) => <SegmentChapter key={segment[0]} segment={segment} index={index} />)}</div></Section>
    <Section label="09 / ONE INTELLIGENCE LAYER" title="Different problems. One intelligence system." copy="The value is not six disconnected solutions. It is one contractual intelligence foundation that understands the shape of each aviation environment."><div className="op-solutions-unified"><div className="op-solutions-unified-sectors">{SEGMENTS.map(([label]) => <span key={label}>{label}</span>)}</div><div className="op-solutions-unified-engine">OPERION<br /><small>CONTRACT INTELLIGENCE</small></div><div className="op-solutions-unified-layers"><span>Obligation Intelligence</span><span>Risk Intelligence</span><span>Predictive Intelligence</span><span>Decision Support</span></div></div></Section>
    <Section label="10 / FROM CONTRACT TO CONSEQUENCE" title={<>See what<br />the contract<br />sets in motion.</>} copy="Operion connects contractual rules to the conditions that make them matter. The current foundation begins with contract understanding; predictive and simulation layers are developing directions."><div className="op-solutions-consequence"><Chain numbered /><div className="op-solutions-consequence-note"><span>ILLUSTRATIVE CHAIN</span><strong>Aircraft delivery delay</strong><p>Contractual obligation missed. Potential penalty or liability. Financial exposure. Recommended action: review delivery provisions and initiate the appropriate contractual notice.</p></div></div></Section>
    <Section label="11 / BUSINESS IMPACT" title="Turn hidden exposure into decision value." copy="The intended value is earlier understanding and better prioritisation, without inventing outcomes or promising a particular financial result."><div className="op-solutions-outcomes">{OUTCOMES.map((outcome, index) => <Reveal key={outcome} className="op-solutions-outcome"><span>0{index + 1}</span><strong>{outcome}</strong><i aria-hidden="true">↗</i></Reveal>)}</div></Section>
    <Section label="12 / RISK TO ACTION" title="Don't wait for the contract to become a problem." dark><div className="op-solutions-action-chain"><Chain items={["Risk detected", "Impact assessed", "Stakeholder identified", "Action recommended", "Outcome monitored"]} numbered /><div className="op-solutions-action-callout"><span>EXAMPLE / AIRCRAFT DELIVERY DELAY</span><p>Potential contractual exposure identified. Legal and Fleet Management notified.</p><strong>Review delivery provisions and initiate contractual notice.</strong></div></div></Section>
    <Section label="13 / WHAT COMES NEXT" title="When the world changes, your contracts change with it." copy="Future predictive intelligence could connect external events with contractual structures to identify where changing conditions may create exposure. These are roadmap concepts, not live feeds."><div className="op-solutions-future"><div className="op-solutions-external-list">{EXTERNALS.map((item) => <span key={item}>{item}</span>)}</div><Chain items={["External event", "Operational impact", "Contractual impact", "Financial exposure"]} numbered /></div></Section>
    <Section label="14 / SCENARIO SIMULATION" title={<>Ask:<br />“What happens if the world changes tomorrow?”</>} copy="Scenario Simulation is the long-term differentiator: compare possible conditions, understand how exposure could propagate and move toward a better-informed action. It is not presented as a fully operational capability today."><div className="op-solutions-scenarios"><div><span>FUEL +20%</span><p>Contracts → obligations → operations → exposure → action</p></div><div><span>DELIVERY DELAY</span><p>Contracts → obligations → operations → exposure → action</p></div><div><span>SUPPLIER FAILURE</span><p>Contracts → obligations → operations → exposure → action</p></div><div><span>SEVERE WEATHER</span><p>Contracts → obligations → operations → exposure → action</p></div><div><span>GEOPOLITICAL DISRUPTION</span><p>Contracts → obligations → operations → exposure → action</p></div></div></Section>
    <section className="op-solutions-final" style={{ backgroundImage: `url(${"https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1800&q=84"})` }}><div><Container><Reveal><p className="op-solutions-label">15 / THE AVIATION STATEMENT</p><h2>Aviation doesn't<br />operate in isolation.</h2><p>Neither should its intelligence. Operion connects contracts, obligations, operational realities and future risk into one intelligence layer.</p><div className="op-solutions-actions"><Button to="/demo" variant="primary">Enter Operion OS <span aria-hidden="true">↗</span></Button><Button to="/demo" variant="secondary">Request access</Button></div></Reveal></Container></div></section>
  </>;
}
