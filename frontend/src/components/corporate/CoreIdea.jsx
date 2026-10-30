import React, { useState } from "react";
import { ArrowRight, FileText, CalendarClock } from "lucide-react";
import { Container } from "../ui/Layout";
import Reveal from "../ui/Reveal";

const CONNECTIONS = [
  { label: "Maintenance", contract: "Engine maintenance agreement", excerpt: "Turnaround commitments, the agreed workscope and the conditions for returning an engine to service.", signal: "An engine shop visit is delayed", note: "The operations team needs to know whether a spare engine is available and when the aircraft can return to service.", consequence: "Aircraft availability may be affected", action: "Review turnaround commitments, exclusions, remedies and notice requirements." },
  { label: "Fuel", contract: "Fuel supply agreement", excerpt: "The pricing period, the reference index and any agreed cap or adjustment to the supply price.", signal: "The market price of fuel rises", note: "Procurement needs to understand when a market movement reaches the invoice, rather than assuming every change passes through.", consequence: "Procurement costs may change", action: "Check indexation, price caps, pass-through provisions and the applicable pricing period." },
  { label: "Aircraft lease", contract: "Aircraft operating lease", excerpt: "The required return condition, the technical records to deliver and the notice due before redelivery.", signal: "An aircraft approaches redelivery", note: "The technical and leasing teams need time to close records gaps, plan inspections and agree any remaining work.", consequence: "Return condition can create exposure", action: "Inspect maintenance condition, technical records, notice periods and return requirements." },
];

function tiltCard(event) {
  if (event.pointerType !== "mouse" || !window.matchMedia("(min-width: 901px) and (prefers-reduced-motion: no-preference)").matches) return;
  const card = event.currentTarget;
  const bounds = card.getBoundingClientRect();
  card.style.setProperty("--card-turn", `${((event.clientX - bounds.left) / bounds.width - .5) * 8}deg`);
  card.style.setProperty("--card-pitch", `${(.5 - (event.clientY - bounds.top) / bounds.height) * 6}deg`);
}

function resetCard(event) {
  event.currentTarget.style.removeProperty("--card-turn");
  event.currentTarget.style.removeProperty("--card-pitch");
}

export default function CoreIdea() {
  const [active, setActive] = useState(0);
  const connection = CONNECTIONS[active];
  return <section className="op-story-section op-core-idea" id="intelligence" aria-labelledby="core-idea-title"><Container>
    <Reveal className="op-story-heading"><p className="op-story-index">01</p><div>
      <p className="op-story-eyebrow">THE CORE IDEA</p><h2 id="core-idea-title">Contracts don't exist in isolation.</h2>
      <p className="op-story-copy">A delayed shop visit. A higher fuel bill. An aircraft due back to its lessor. The contract only tells half the story. What matters is how its terms apply to the situation your team is facing.</p>
    </div></Reveal>
    <div className="op-core-controls" role="group" aria-label="Explore a contractual connection">
      {CONNECTIONS.map((item, index) => <button key={item.label} type="button" aria-pressed={active === index} onClick={() => setActive(index)}>{item.label}</button>)}
    </div>
    <Reveal className="op-core-stage">
      <article key={`source-${active}`} className="op-core-plane op-core-source" onPointerMove={tiltCard} onPointerLeave={resetCard}><span className="op-core-coordinate">THE TERMS ON PAPER</span><FileText size={25}/><h3>The agreement</h3><strong>{connection.contract}</strong><p>{connection.excerpt}</p><span className="op-core-edge">Start with the signed terms.</span></article>
      <div className="op-core-hub"><span>Read together</span><ArrowRight size={30} aria-hidden="true"/><small>with Operion</small></div>
      <article key={`world-${active}`} className="op-core-plane op-core-world" onPointerMove={tiltCard} onPointerLeave={resetCard}><span className="op-core-coordinate">THE SITUATION IN PRACTICE</span><CalendarClock size={25}/><h3>The working reality</h3><strong>{connection.signal}</strong><p>{connection.note}</p><span className="op-core-edge">Bring the right people and context.</span></article>
    </Reveal>
    <section className="op-core-review" aria-live="polite" aria-label="Illustrative contractual connection">
      <div><small>03 / POTENTIAL CONSEQUENCE</small><h3>{connection.consequence}</h3></div><ArrowRight aria-hidden="true"/>
      <div><small>04 / HUMAN REVIEW</small><p>{connection.action}</p></div>
    </section>
    <p className="op-core-note">Illustrative reasoning paths, not live events or findings from your contracts. The current foundation is evidence-linked Contract Intelligence; external risk and forecasting layers remain in development.</p>
  </Container></section>;
}
