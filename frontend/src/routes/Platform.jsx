import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import Reveal from "../components/ui/Reveal";
import { Container } from "../components/ui/Layout";
import IntelligenceStatus from "../components/intelligence/IntelligenceStatus";
import { INTELLIGENCE_AVAILABILITY } from "../lib/contractIntelligenceModel";

const AIRCRAFT = "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=1800&q=82";
const RAMP = "https://images.unsplash.com/photo-1517479149777-5f3b1511d5ad?auto=format&fit=crop&w=1600&q=82";
const LAYERS = [
  ["contract", "Contract", "Start with the agreement: source text, versions, parties and structure.", INTELLIGENCE_AVAILABILITY.AVAILABLE],
  ["intelligence", "Intelligence", "Clauses, obligations, deadlines and relationships made searchable.", INTELLIGENCE_AVAILABILITY.AVAILABLE],
  ["operations", "Operational reality", "Connect contractual rules to events that change their relevance.", INTELLIGENCE_AVAILABILITY.PENDING],
  ["decision", "Decision support", "Move from exposure toward scenarios, recommendations and action.", INTELLIGENCE_AVAILABILITY.PENDING],
];
const FOUNDATION = [
  ["01", "Structure the contract", "Upload and analyse complex aviation agreements, then turn documents into structured contractual information."],
  ["02", "Understand the rules", "Identify clauses, thresholds, conditions, rights, penalties and performance requirements with their source context."],
  ["03", "Track commitments", "Connect obligations and deadlines to the clauses and contracts that created them."],
];
const SCENARIOS = [
  ["Fuel price shock", "Which agreements contain fuel-related escalation mechanisms?"],
  ["Weather disruption", "Which service-level thresholds could become relevant?"],
  ["Supplier failure", "What obligations and potential consequences should be reviewed?"],
];

function PlatformSeo() {
  useEffect(() => {
    const title = "Operion Platform | Contract Intelligence for Aviation";
    const description = "Operion turns aviation contracts into structured intelligence, connecting clauses, obligations, risk and future scenarios.";
    const previousTitle = document.title;
    document.title = title;
    let descriptionTag = document.head.querySelector('meta[name="description"]');
    const wasNew = !descriptionTag;
    const previousDescription = descriptionTag?.content;
    if (!descriptionTag) { descriptionTag = document.createElement("meta"); descriptionTag.name = "description"; document.head.appendChild(descriptionTag); }
    descriptionTag.content = description;
    return () => { document.title = previousTitle; if (wasNew) descriptionTag.remove(); else descriptionTag.content = previousDescription || ""; };
  }, []);
  return null;
}

function PlatformSection({ label, title, copy, children, dark = false, className = "" }) {
  return <section className={`op-platform-editorial-section${dark ? " op-platform-editorial-dark" : ""} ${className}`.trim()}><Container><Reveal><p className="op-platform-editorial-label">{label}</p><h2>{title}</h2>{copy && <p className="op-platform-editorial-copy">{copy}</p>}</Reveal>{children}</Container></section>;
}

function LayerRail({ activeLayer, onSelect }) {
  return <div className="op-platform-layer-rail" role="tablist" aria-label="Platform intelligence layers">{LAYERS.map(([id, label, copy, status], index) => <button key={id} type="button" role="tab" aria-selected={activeLayer === id} className={activeLayer === id ? "op-platform-layer-active" : ""} onClick={() => onSelect(id)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong><small>{status === INTELLIGENCE_AVAILABILITY.AVAILABLE ? "Available" : "In development"}</small><em>{copy}</em></button>)}</div>;
}

function PlatformPill({ children, future = false }) { return <span className={`op-platform-editorial-pill${future ? " op-platform-editorial-pill-future" : ""}`}>{children}</span>; }

export default function Platform() {
  const [activeLayer, setActiveLayer] = useState("intelligence");
  const layer = LAYERS.find((item) => item[0] === activeLayer) || LAYERS[1];

  return <>
    <PlatformSeo />
    <section className="op-platform-editorial-hero" style={{ backgroundImage: `url(${AIRCRAFT})` }}><div><Container><Reveal><p className="op-platform-editorial-label">OPERION PLATFORM / AVIATION INTELLIGENCE</p><h1>From contract<br /><span>to consequence.</span></h1><p>Operion understands the agreements behind aviation, then shows how their rules could matter when reality changes.</p><div className="op-platform-editorial-actions"><Button to="/demo" variant="primary">Enter Operion OS <span aria-hidden="true">↗</span></Button><Button to="/industries/aviation" variant="secondary">Explore Aviation</Button></div></Reveal></Container></div></section>

    <PlatformSection label="01 / THE FOUNDATION" title={<>Every decision starts with what<br />the contract says.</>} copy="Before an organisation can assess exposure, simulate outcomes or recommend action, it needs a reliable understanding of its agreements. Operion begins with Contract Intelligence: turning complex documents into structured, searchable information."><div className="op-platform-foundation-grid">{FOUNDATION.map(([number, title, copy]) => <Reveal key={number} className="op-platform-foundation-item"><span>{number}</span><h3>{title}</h3><p>{copy}</p></Reveal>)}</div></PlatformSection>

    <PlatformSection label="02 / THE INTELLIGENCE LAYER" title="See the system behind the system." copy="The platform is designed as a progression. Contract Intelligence is the verified foundation; operational, predictive and decision layers represent the direction in which that foundation can grow." dark><div className="op-platform-layer-experience"><LayerRail activeLayer={activeLayer} onSelect={setActiveLayer} /><div className="op-platform-layer-detail" role="tabpanel"><p className="op-platform-editorial-label">{layer[1]} / {layer[3] === INTELLIGENCE_AVAILABILITY.AVAILABLE ? "AVAILABLE" : "IN DEVELOPMENT"}</p><h3>{layer[2]}</h3><IntelligenceStatus state={layer[3]} /></div></div></PlatformSection>

    <PlatformSection label="03 / CONTRACT INTELLIGENCE" title="Find the rules hidden in complexity." copy="Aviation agreements contain the conditions that govern leases, maintenance, service levels, suppliers and operations. Operion structures those rules without losing their source context."><div className="op-platform-contract-map"><div className="op-platform-document"><span>MSA / AIRCRAFT LEASE</span><i /><i /><i /><b>CLAUSE INTELLIGENCE</b></div><div className="op-platform-contract-nodes"><PlatformPill>Obligations</PlatformPill><PlatformPill>Service levels</PlatformPill><PlatformPill>Deadlines</PlatformPill><PlatformPill>Penalty mechanisms</PlatformPill><PlatformPill>Termination rights</PlatformPill></div></div></PlatformSection>

    <section className="op-platform-editorial-image-section"><div className="op-platform-editorial-image" style={{ backgroundImage: `url(${RAMP})` }} /><Container><Reveal><p className="op-platform-editorial-label">04 / AVIATION FIRST</p><h2>Contracts do not operate in isolation.</h2><p>A ground delay, maintenance event, supplier failure or fuel shock can change the importance of a contractual rule. Operion is shaped around the language and relationships that keep aviation moving.</p><div className="op-platform-sector-list"><Link to="/industries/aviation">Airlines <span>↗</span></Link><Link to="/industries/aviation">Aircraft leasing <span>↗</span></Link><Link to="/industries/aviation">MRO and PBH <span>↗</span></Link><Link to="/industries/aviation">Ground handling <span>↗</span></Link></div></Reveal></Container></section>

    <PlatformSection label="05 / PREDICTIVE DIRECTION" title="Ask what could happen next." copy="The longer-term intelligence layer connects contractual conditions with changing operational and external context. These capabilities are developing and are presented as direction, not as universally live functionality."><div className="op-platform-scenario-grid">{SCENARIOS.map(([title, question]) => <Reveal key={title} className="op-platform-scenario"><PlatformPill future>Illustrative scenario</PlatformPill><h3>{title}</h3><p>{question}</p><span aria-hidden="true">→</span></Reveal>)}</div></PlatformSection>

    <PlatformSection label="06 / PRODUCT EVOLUTION" title="Understand. Detect. Predict. Simulate. Act." copy="Operion's progression keeps Contract Intelligence at the centre while expanding toward predictive risk intelligence, scenario simulation and decision support."><div className="op-platform-evolution-rail"><div><span>01</span><strong>Understand</strong><small>Contract Intelligence</small></div><div><span>02</span><strong>Detect</strong><small>Emerging exposure</small></div><div><span>03</span><strong>Predict</strong><small>Possible outcomes</small></div><div><span>04</span><strong>Simulate</strong><small>Alternative futures</small></div><div><span>05</span><strong>Act</strong><small>Decision support</small></div></div></PlatformSection>

    <section className="op-platform-editorial-cta"><Container><Reveal><p className="op-platform-editorial-label">07 / SEE IT IN CONTEXT</p><h2>Start with the contracts<br />you already have.</h2><p>Explore how Operion can help your organisation understand clauses, obligations and the decisions they affect.</p><div className="op-platform-editorial-actions"><Button to="/demo" variant="primary">Request a Demo <span aria-hidden="true">↗</span></Button><Button to="/enterprise" variant="secondary">Enterprise architecture</Button></div></Reveal></Container></section>
  </>;
}