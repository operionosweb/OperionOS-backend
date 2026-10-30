import React, { useState } from "react";
import { ArrowRight, FileText, Globe2, Layers3 } from "lucide-react";
import { Container } from "../ui/Layout";
import Reveal from "../ui/Reveal";

const CONNECTIONS = [
  { label: "Maintenance", contract: "Engine maintenance agreement", signal: "An engine shop visit is delayed", consequence: "Aircraft availability may be affected", action: "Review turnaround commitments, exclusions, remedies and notice requirements." },
  { label: "Fuel", contract: "Fuel supply agreement", signal: "The market price of fuel rises", consequence: "Procurement costs may change", action: "Check indexation, price caps, pass-through provisions and the applicable pricing period." },
  { label: "Aircraft lease", contract: "Aircraft operating lease", signal: "An aircraft approaches redelivery", consequence: "Return condition can create exposure", action: "Inspect maintenance condition, technical records, notice periods and return requirements." },
];

export default function CoreIdea() {
  const [active, setActive] = useState(0);
  const connection = CONNECTIONS[active];
  return <section className="op-story-section op-core-idea" id="intelligence" aria-labelledby="core-idea-title"><Container>
    <Reveal className="op-story-heading"><p className="op-story-index">01</p><div>
      <p className="op-story-eyebrow">THE CORE IDEA</p><h2 id="core-idea-title">Contracts don't exist in isolation.</h2>
      <p className="op-story-copy">An agreement defines the commitments. The world around it changes their significance. Operion connects the two, starting with evidence you can inspect.</p>
    </div></Reveal>
    <div className="op-core-controls" role="group" aria-label="Explore a contractual connection">
      {CONNECTIONS.map((item, index) => <button key={item.label} type="button" aria-pressed={active === index} onClick={() => setActive(index)}>{item.label}</button>)}
    </div>
    <Reveal className="op-core-stage">
      <article className="op-core-plane op-core-source"><span className="op-core-coordinate">01 / SOURCE</span><FileText size={28}/><h3>The agreement</h3><strong>{connection.contract}</strong><p>Clauses · obligations · deadlines<br/>A traceable source, not a disconnected alert.</p><span className="op-core-edge">CONTRACTUAL EVIDENCE</span></article>
      <div className="op-core-hub" aria-label="Operion intelligence layer"><div className="op-core-orbit" aria-hidden="true"/><div className="op-core-orbit is-crossed" aria-hidden="true"/><div className="op-core-kernel"><Layers3 size={30}/><strong>OPERION</strong><small>INTELLIGENCE LAYER</small></div><span>Understand → connect → review</span></div>
      <article className="op-core-plane op-core-world"><span className="op-core-coordinate">02 / CONTEXT</span><Globe2 size={28}/><h3>The changing world</h3><strong>{connection.signal}</strong><p>Assets · markets · operational dependencies<br/>Context that needs validation, not assumed certainty.</p><span className="op-core-edge">RELEVANT CONDITIONS</span></article>
    </Reveal>
    <section className="op-core-review" aria-live="polite" aria-label="Illustrative contractual connection">
      <div><small>03 / POTENTIAL CONSEQUENCE</small><h3>{connection.consequence}</h3></div><ArrowRight aria-hidden="true"/>
      <div><small>04 / HUMAN REVIEW</small><p>{connection.action}</p></div>
    </section>
    <p className="op-core-note">Illustrative reasoning paths, not live events or findings from your contracts. The current foundation is evidence-linked Contract Intelligence; external risk and forecasting layers remain in development.</p>
  </Container></section>;
}
