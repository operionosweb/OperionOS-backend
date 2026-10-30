import React, { useState } from "react";
import { ArrowRight, CloudRain, Fuel, Landmark, Radar, TrendingUp } from "lucide-react";
import { Container } from "../ui/Layout";
import Reveal from "../ui/Reveal";

const CONTEXTS = [
  { label: "Maintenance & suppliers", icon: Radar, setting: "An aircraft waiting on an engine", condition: "A shop visit takes longer than planned.", detail: "The engine is not back when operations expected it. A replacement may be needed to keep the aircraft available.", agreement: "Engine maintenance & support", mechanism: "Agreed turnaround, spare-engine support, exclusions and notice periods.", question: "Who needs to act before the next commitment is missed?", review: "Compare the revised delivery date with the agreed terms. Check support options and notify the responsible teams." },
  { label: "Fuel", icon: Fuel, setting: "A fuel purchase for the next operating period", condition: "The reference fuel price moves.", detail: "A market move matters only if the supply agreement carries it into the price paid, and at the relevant time.", agreement: "Fuel supply agreement", mechanism: "Reference index, pricing window, caps and pass-through provisions.", question: "When would the change reach the invoice?", review: "Check the pricing formula and reset date before assessing the cost effect. Do not equate a market move with an automatic liability." },
  { label: "Currency", icon: TrendingUp, setting: "A lease paid in a different currency", condition: "The payment currency strengthens.", detail: "An airline earning revenue in one currency may pay aircraft rent in another. The payment obligation and treasury position need to be read together.", agreement: "Aircraft lease & payment terms", mechanism: "Payment currency, due dates and any applicable currency provisions.", question: "Which upcoming payments need a treasury review?", review: "Confirm the currency and payment schedule, then review the actual hedging position with treasury. The lease alone does not establish net exposure." },
  { label: "Interest rates", icon: Landmark, setting: "An aircraft financing payment", condition: "A benchmark interest rate changes.", detail: "The impact depends on whether the agreement uses a floating rate, when it resets and whether protection applies.", agreement: "Aircraft financing agreement", mechanism: "Benchmark, margin, reset dates, floors and caps.", question: "Does this agreement actually reprice?", review: "Verify the rate mechanism and next reset. Distinguish fixed-rate commitments from floating-rate amounts before drawing a conclusion." },
  { label: "Weather", icon: CloudRain, setting: "A disrupted airport turnaround", condition: "Severe weather interrupts operations.", detail: "A disruption can affect a planned departure and the services around it. Responsibility depends on the agreement and the facts of the event.", agreement: "Ground handling & airport services", mechanism: "Service levels, disruption procedures, exclusions and notice requirements.", question: "Which obligations still apply during the disruption?", review: "Establish what happened, check the relevant exclusions and follow the agreed notification procedure. Weather alone does not prove a breach." },
];

export default function AviationContext() {
  const [active, setActive] = useState(0);
  const context = CONTEXTS[active];
  return <section className="op-story-section op-story-aviation" aria-labelledby="aviation-context-title"><Container>
    <Reveal className="op-story-heading"><p className="op-story-index">03</p><div>
      <p className="op-story-eyebrow">AVIATION CONTEXT / IN DEVELOPMENT</p>
      <h2 id="aviation-context-title">Then it understands what surrounds it.</h2>
      <p className="op-story-copy">Not every change is a contractual risk. Start with a working situation, find the agreement it touches, and decide what needs a closer look.</p>
    </div></Reveal>
    <div className="op-context-controls" role="group" aria-label="Explore aviation conditions">
      {CONTEXTS.map(({ label, icon: Icon }, index) => <button key={label} type="button" aria-pressed={active === index} aria-controls="aviation-context-example" onClick={() => setActive(index)}><Icon size={17} aria-hidden="true"/>{label}</button>)}
    </div>
    <Reveal className="op-context-case" id="aviation-context-example">
      <header className="op-context-setting"><span>ONE WORKING EXAMPLE</span><h3>{context.setting}</h3><small>Illustrative, not a live operational event</small></header>
      <div className="op-context-path" aria-live="polite">
        <article className="op-context-step"><span>01 / WHAT CHANGES</span><h4>{context.condition}</h4><p>{context.detail}</p></article>
        <ArrowRight className="op-context-arrow" aria-hidden="true"/>
        <article className="op-context-step"><span>02 / WHERE TO LOOK</span><h4>{context.agreement}</h4><p>{context.mechanism}</p></article>
        <ArrowRight className="op-context-arrow" aria-hidden="true"/>
        <article className="op-context-step op-context-decision"><span>03 / THE TEAM'S NEXT QUESTION</span><h4>{context.question}</h4><p>{context.review}</p></article>
      </div>
      <footer>Conditions are context, not conclusions. Source evidence and human review determine what the agreement means in practice.</footer>
    </Reveal>
    <p className="op-core-note">These examples explain the product direction. External feeds and predictive connections are in development; no live weather, market or supplier data is connected in this section.</p>
  </Container></section>;
}
