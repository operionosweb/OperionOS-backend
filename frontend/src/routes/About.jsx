import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import Reveal from "../components/ui/Reveal";
import { Container } from "../components/ui/Layout";

const HERO = "https://images.unsplash.com/photo-1556388158-158ea5ccacbd?auto=format&fit=crop&w=2000&q=84";
const AIRPORT = "https://images.unsplash.com/photo-1474302770737-173ee21bab63?auto=format&fit=crop&w=1800&q=84";
const CHAPTERS = [
  ["who", "Who we are"],
  ["problem", "The problem"],
  ["insight", "The insight"],
  ["approach", "Our approach"],
  ["story", "Our story"],
  ["ecosystem", "The ecosystem"],
  ["building", "What we are building"],
  ["beliefs", "What we believe"],
  ["future", "The future"],
];
const APPROACH = [
  ["01", "Connect", "Bring fragmented aviation information into a connected context."],
  ["02", "Understand", "Transform complex contractual and operational information into intelligence."],
  ["03", "Anticipate", "Surface emerging obligations, risks and exposure before they become expensive problems."],
  ["04", "Act", "Turn intelligence into clear next actions for the people responsible."],
];
const STORY = [
  ["THE BEGINNING", "Aviation complexity was becoming impossible to manage through disconnected information and reactive processes."],
  ["THE FIRST INSIGHT", "Critical relationships existed across contracts, obligations, operational events and financial consequences, but rarely in one connected view."],
  ["THE BUILD", "We began building an intelligence layer designed specifically around the way aviation organisations actually operate."],
  ["TODAY", "Operion is shaping a clearer operating picture from contractual intelligence, with future layers developing toward risk, scenarios and action."],
  ["WHAT IS NEXT", "Move from understanding what happened to anticipating what happens next, without losing the evidence underneath."],
];
const ECOSYSTEM = ["Airlines", "Aircraft leasing", "MRO", "Consultancies", "Ground handling", "Airport operators", "Suppliers", "Operational systems", "Financial stakeholders"];
const BELIEFS = ["Complexity should become clarity.", "Intelligence should lead to action.", "Risk should be visible before it becomes expensive.", "Aviation deserves technology built around how it actually operates.", "The future of aviation will be increasingly connected."];

function AboutSeo() {
  useEffect(() => {
    const previousTitle = document.title;
    const title = "About Operion | Aviation Contract Intelligence";
    const description = "Operion is building the intelligence layer that connects aviation contracts, obligations, events, risks and decisions.";
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

function AboutSection({ id, label, title, copy, children, dark = false, className = "" }) {
  return <section id={id} className={`op-about-section${dark ? " op-about-dark" : ""} ${className}`.trim()}><Container><Reveal><p className="op-about-label">{label}</p><h2>{title}</h2>{copy && <p className="op-about-copy">{copy}</p>}</Reveal>{children}</Container></section>;
}

function ProgressNav({ active }) {
  return <nav className="op-about-progress" aria-label="About page chapters">{CHAPTERS.map(([id, label], index) => <button key={id} type="button" className={active === id ? "op-about-progress-active" : ""} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}><span>0{index + 1}</span>{label}</button>)}</nav>;
}

function Chain({ items }) {
  return <div className="op-about-chain" aria-label={items.join(" to ")}>{items.map((item, index) => <React.Fragment key={item}><div><span>0{index + 1}</span><strong>{item}</strong></div>{index < items.length - 1 && <b aria-hidden="true">↓</b>}</React.Fragment>)}</div>;
}

export default function About() {
  const [active, setActive] = useState("who");
  const sectionRefs = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActive(visible.target.id);
    }, { rootMargin: "-30% 0px -55%", threshold: [0, .2, .5, 1] });
    sectionRefs.current.forEach((section) => section && observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return <div className="op-about-page">
    <AboutSeo />
    <ProgressNav active={active} />
    <section id="who" ref={(node) => { sectionRefs.current[0] = node; }} className="op-about-hero" style={{ backgroundImage: `url(${HERO})` }}><div><Container><Reveal><p className="op-about-label">ABOUT OPERION / WHO WE ARE</p><h1>Aviation runs on complexity.<br /><span>We make it intelligible.</span></h1><p>We build intelligence infrastructure for the commercial aviation ecosystem, connecting contracts, obligations, events, risks and financial exposure so organisations can act before complexity becomes disruption.</p><div className="op-about-actions"><Button to="/solutions" variant="primary">Discover our story <span aria-hidden="true">↗</span></Button><Button to="/platform" variant="secondary">See what we do</Button></div></Reveal><span className="op-about-scroll-cue">Scroll to explore <b aria-hidden="true">↓</b></span></Container></div></section>
    <AboutSection id="problem" label="01 / THE PROBLEM" title={<>Aviation does not lack data.<br />It lacks connected intelligence.</>} copy="Aviation organisations operate across contracts, leases, maintenance programmes, suppliers, operations, compliance, events, financial commitments and risk. The information exists. The critical relationships are simply difficult to see."><div className="op-about-fragments"><div className="op-about-fragment-lines" aria-hidden="true" />{["CONTRACT", "OBLIGATION", "EVENT", "RISK", "FINANCIAL EXPOSURE"].map((item, index) => <span key={item} className={`op-about-fragment op-about-fragment-${index + 1}`}>{item}</span>)}<strong>ONE CONNECTED<br />INTELLIGENCE LAYER</strong></div></AboutSection>
    <AboutSection id="insight" label="02 / THE INSIGHT" title="Aviation intelligence should move at the speed of aviation itself." copy="The most valuable intelligence is not information sitting inside a system. It is the connection between what was agreed, what is happening, what could happen, what it means and what should happen next." dark><div className="op-about-insight-chain"><Chain items={["What was agreed", "What is happening", "What could happen", "What it means", "What happens next"]} /></div></AboutSection>
    <AboutSection id="approach" label="03 / OUR APPROACH" title="Connect. Understand. Anticipate. Act." copy="Each step makes the next one more useful. Contract Intelligence is the foundation; action is the point."><div className="op-about-approach">{APPROACH.map(([number, title, copy], index) => <Reveal key={title} className="op-about-approach-step" style={{ "--about-step": index }}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div><b aria-hidden="true">→</b></Reveal>)}</div></AboutSection>
    <AboutSection id="story" label="04 / OUR STORY" title="A company story still being written." copy="This is the shape of the journey so far. It describes the problem, insight and direction without inventing dates, milestones or claims that have not been established."><div className="op-about-timeline">{STORY.map(([phase, copy], index) => <Reveal key={phase} className="op-about-timeline-item" style={{ "--about-step": index }}><span>{String(index + 1).padStart(2, "0")}</span><div><p>{phase}</p><h3>{copy}</h3></div></Reveal>)}</div></AboutSection>
    <section id="ecosystem" ref={(node) => { sectionRefs.current[5] = node; }} className="op-about-ecosystem" style={{ backgroundImage: `url(${AIRPORT})` }}><div><Container><Reveal><p className="op-about-label">05 / THE ECOSYSTEM</p><h2>We operate in the connections between aviation's participants.</h2><p>Airlines, lessors, MROs, consultancies, ground handlers, airports, suppliers and financial stakeholders each see a different part of the operating picture. Operion is being built around the relationships between them.</p></Reveal><div className="op-about-ecosystem-grid">{ECOSYSTEM.map((item, index) => <span key={item} className={`op-about-ecosystem-node op-about-ecosystem-node-${index + 1}`}>{item}</span>)}<strong>OPERION<br /><small>CONNECTED INTELLIGENCE</small></strong></div></Container></div></section>
    <AboutSection id="building" label="06 / WHAT WE ARE BUILDING" title="From aviation data to aviation intelligence." copy="Our direction is a progressive intelligence layer: start with the contract, connect context, then develop toward prediction and action. Future layers are not represented as fully operational capabilities today."><div className="op-about-building"><div><span>01</span><strong>DATA</strong></div><b>↓</b><div><span>02</span><strong>CONTEXT</strong></div><b>↓</b><div><span>03</span><strong>INTELLIGENCE</strong></div><b>↓</b><div className="op-about-future-step"><span>04</span><strong>PREDICTION</strong><small>Our direction</small></div><b>↓</b><div className="op-about-future-step"><span>05</span><strong>ACTION</strong><small>Our direction</small></div></div></AboutSection>
    <AboutSection id="beliefs" label="07 / WHAT WE BELIEVE" title="A short manifesto." dark><div className="op-about-beliefs">{BELIEFS.map((belief, index) => <Reveal key={belief}><span>0{index + 1}</span><h3>{belief}</h3></Reveal>)}</div></AboutSection>
    <section id="future" ref={(node) => { sectionRefs.current[8] = node; }} className="op-about-future"><Container><Reveal><p className="op-about-label">08 / THE FUTURE</p><h2>The next era of aviation will be connected.</h2><p>Complexity becomes connection. Connection becomes intelligence. Intelligence becomes action. And action creates possibility.</p><div className="op-about-actions"><Button to="/industries/aviation" variant="primary">Explore Aviation Intelligence <span aria-hidden="true">↗</span></Button><Button to="/demo" variant="secondary">Talk to us</Button></div></Reveal></Container></section>
  </div>;
}
