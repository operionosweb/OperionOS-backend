import React, { useEffect, useState } from "react";
import { Section } from "../components/ui/Layout";
import Button from "../components/ui/Button";
import Reveal from "../components/ui/Reveal";
import IntelligenceStatus from "../components/intelligence/IntelligenceStatus";
import ScenarioBranch from "../components/intelligence/ScenarioBranch";
import ImpactPath from "../components/intelligence/ImpactPath";
import Timeline from "../components/intelligence/Timeline";
import SpatialStage from "../components/intelligence/spatial/SpatialStage";
import SpatialTransition from "../components/intelligence/spatial/SpatialTransition";
import { INTELLIGENCE_AVAILABILITY } from "../lib/contractIntelligenceModel";

const SCENARIO_EVENTS = ["Weather", "Fuel price", "Crew disruption", "Supplier failure", "Geopolitical event"];
const SCENARIO_CHAIN = ["Event", "Contract", "Clause", "Impact", "Financial exposure", "Action"];
const CONSEQUENCE_CHAIN = ["Event", "Affected entity", "Contract", "Clause", "Obligation", "Contractual condition", "Potential impact", "Financial exposure", "Probability", "Recommended action", "Potential outcome"];
const EXAMPLE_QUESTIONS = [
  "What happens if fuel prices rise by 20%?",
  "What happens if a critical supplier fails?",
  "What happens if severe weather causes three hours of delays?",
  "What happens if an aircraft becomes unavailable?",
  "What happens if geopolitical disruption affects a route?",
  "What contracts could be affected?",
  "What could the potential exposure be?",
  "What could we do now?",
];
const ROLE_QUESTIONS = [
  ["CEO", "What is our strategic exposure?"],
  ["CFO", "How much could this cost?"],
  ["Legal", "Which contractual provisions could apply?"],
  ["Operations", "What should we do now?"],
  ["Procurement", "Which suppliers are exposed?"],
];
const TRUST_STATES = [
  ["Verified", "Contractual fact"],
  ["Inferred", "Potential relationship"],
  ["Probabilistic", "Estimated likelihood"],
  ["Illustrative", "Example scenario"],
];

function ScenariosSeo() {
  useEffect(() => {
    const title = "Operion Scenarios | Predictive Contract Intelligence";
    const description = "Explore how Operion could connect operational events, contracts, clauses, risks and financial exposure to understand possible future scenarios and support better decisions.";
    const canonicalUrl = "https://operionos.com/scenarios";
    const previousTitle = document.title;
    document.title = title;
    const metadata = [
      ["name", "description", description],
      ["property", "og:title", title],
      ["property", "og:description", description],
      ["property", "og:type", "website"],
      ["property", "og:url", canonicalUrl],
      ["name", "twitter:title", title],
      ["name", "twitter:description", description],
    ];
    const changed = metadata.map(([attribute, key, content]) => {
      let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
      const isNew = !tag;
      const previousContent = tag?.getAttribute("content");
      if (isNew) {
        tag = document.createElement("meta");
        tag.setAttribute(attribute, key);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
      return { tag, isNew, previousContent };
    });
    let canonical = document.head.querySelector('link[rel="canonical"]');
    const canonicalIsNew = !canonical;
    const previousCanonical = canonical?.getAttribute("href");
    if (canonicalIsNew) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
    let structuredData = document.head.querySelector('script[data-operion-page="scenarios"]');
    const structuredDataIsNew = !structuredData;
    if (structuredDataIsNew) {
      structuredData = document.createElement("script");
      structuredData.type = "application/ld+json";
      structuredData.dataset.operionPage = "scenarios";
      document.head.appendChild(structuredData);
    }
    structuredData.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      description,
      url: canonicalUrl,
      isPartOf: { "@type": "WebSite", name: "Operion", url: "https://operionos.com/" },
    });
    return () => {
      document.title = previousTitle;
      changed.forEach(({ tag, isNew, previousContent }) => {
        if (isNew) tag.remove();
        else tag.setAttribute("content", previousContent || "");
      });
      if (canonicalIsNew) canonical.remove();
      else canonical.setAttribute("href", previousCanonical || "");
      if (structuredDataIsNew) structuredData.remove();
    };
  }, []);
  return null;
}

function Status({ children, live = false }) {
  return <span className={live ? "op-badge op-badge-live" : "op-badge op-badge-future"}>{children}</span>;
}

function Flow({ items, className = "" }) {
  return (
    <div className={`op-scenario-flow ${className}`.trim()} aria-label={items.join(" to ")}>
      {items.map((item, index) => (
        <React.Fragment key={item}>
          <div className="op-scenario-flow-node"><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></div>
          {index < items.length - 1 && <span className="op-scenario-flow-arrow" aria-hidden="true">↓</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function ScenarioCard({ title, children, items, note }) {
  return (
    <Reveal className="op-surface op-scenario-card" style={{ padding: "var(--op-space-5)" }}>
      <Status>Illustrative scenario</Status>
      <h3 className="op-heading-md" style={{ margin: "var(--op-space-3) 0 var(--op-space-2)" }}>{title}</h3>
      {children}
      <Flow items={items} className="op-scenario-flow-compact" />
      <p className="op-body-sm" style={{ marginTop: "var(--op-space-4)" }}>{note}</p>
    </Reveal>
  );
}

function CapabilityRow({ stage, description, status, live = false }) {
  return (
    <div className="op-scenario-capability-row">
      <div><span className="op-kicker">{stage}</span><strong>{description}</strong></div>
      <Status live={live}>{status}</Status>
    </div>
  );
}

export default function Scenarios() {
  const [activeEvent, setActiveEvent] = useState("Weather");
  const eventStages = SCENARIO_EVENTS.map((event) => ({
    id: event.toLowerCase().replaceAll(" ", "-"),
    label: event,
    availability: INTELLIGENCE_AVAILABILITY.PENDING,
  }));
  const activeEventLabel = eventStages.find((event) => event.label === activeEvent)?.label;

  return (
    <>
      <ScenariosSeo />
      <Section className="op-scenario-hero">
        <Reveal>
          <p className="op-eyebrow">Scenario Intelligence</p>
          <h1 className="op-heading-xl">What happens if the world changes tomorrow?</h1>
          <p className="op-body-lg" style={{ marginTop: "var(--op-space-5)", maxWidth: 820 }}>
            Contracts are written for a defined set of conditions. Operations rarely stay that way. Operion is being developed to connect contracts with changing operational and external conditions — helping organisations understand which agreements could be affected, what the potential consequences could be and what actions may reduce exposure.
          </p>
        </Reveal>
        <Reveal className="op-scenario-hero-visual" style={{ marginTop: "var(--op-space-7)" }}>
          <div><Status>Illustrative scenario</Status><p className="op-body-sm" style={{ marginTop: "var(--op-space-3)" }}>Choose an event to explore the intended direction of the intelligence architecture. This is not a live event feed.</p></div>
          <div className="op-scenario-normal-state"><span className="op-kicker">Starting point</span><strong>Normal operations</strong></div>
          <SpatialStage stages={eventStages} activeStageId={eventStages.find((event) => event.label === activeEvent)?.id} onSelectStage={(event) => setActiveEvent(event.label)} />
          <SpatialTransition kind="navigate"><div className="op-scenario-event-state"><span className="op-kicker">Selected event</span><strong>{activeEventLabel}</strong><IntelligenceStatus state={INTELLIGENCE_AVAILABILITY.PENDING} /></div></SpatialTransition>
          <Flow items={SCENARIO_CHAIN} />
        </Reveal>
        <Reveal style={{ marginTop: "var(--op-space-5)" }}><div className="op-row" style={{ flexWrap: "wrap" }}><Button to="/demo" variant="primary">Request a Demo</Button><Button to="/platform" variant="secondary">Explore the Platform</Button></div></Reveal>
      </Section>

      <Section>
        <Reveal><p className="op-eyebrow">The problem</p><h2 className="op-heading-lg">Most organisations discover contractual exposure after the event.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>A disruption happens. Teams search for the relevant contract. Someone identifies the clause. Finance calculates the exposure. Legal determines what applies. Operations tries to mitigate the impact. By then, the opportunity to prevent or reduce the consequence may already be smaller.</p></Reveal>
        <div className="op-grid op-grid-2" style={{ marginTop: "var(--op-space-7)" }}>
          <Reveal className="op-scenario-process op-scenario-process-reactive"><p className="op-kicker">Reactive</p><Flow items={["Event", "Investigate", "Interpret", "Calculate", "React"]} /></Reveal>
          <Reveal className="op-scenario-process op-scenario-process-proactive"><Status>Future intelligence direction</Status><Flow items={["Possible event", "Affected contracts", "Relevant clauses", "Potential exposure", "Scenario", "Action"]} /><p className="op-body-sm">The proactive flow represents the future direction of Operion's intelligence architecture, not a claim that every step is live today.</p></Reveal>
        </div>
      </Section>

      <Section>
        <Reveal><p className="op-eyebrow">The core question</p><h2 className="op-heading-lg">What if you could ask the contract before the event happens?</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Instead of asking what a contract says after a disruption, the future Operion intelligence layer is designed to explore what the contract could mean under different conditions.</p></Reveal>
        <div className="op-scenario-question-grid" style={{ marginTop: "var(--op-space-6)" }}>{EXAMPLE_QUESTIONS.map((question) => <p key={question} className="op-scenario-question">“{question}”</p>)}</div>
      </Section>

      <Section className="op-scenario-chain-section">
        <Reveal><p className="op-eyebrow">Scenario engine concept</p><h2 className="op-heading-lg">From an event to a chain of consequences.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Each stage is intended to make a possible future understandable without pretending that the outcome is known in advance.</p></Reveal>
        <Flow items={CONSEQUENCE_CHAIN} />
        <div className="op-grid op-grid-3" style={{ marginTop: "var(--op-space-6)" }}><ImpactPath steps={[{ id: "event", label: "Event changes the operating context" }, { id: "contract", label: "Potentially affected contractual relationships" }, { id: "impact", label: "Potential consequences become visible" }]} /><ScenarioBranch title="Possible paths" branches={[{ id: "moderate", label: "Moderate disruption" }, { id: "severe", label: "Severe disruption" }]} /><Timeline events={[{ id: "one", time: "01", label: "Initial condition" }, { id: "two", time: "02", label: "New evidence changes the scenario" }]} /></div>
      </Section>

      <Section><Reveal><p className="op-eyebrow">Weather</p><Status>Illustrative scenario</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Scenario: Severe weather disrupts operations.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Severe weather affects an airport. Flights are delayed. Potential service-level thresholds may become relevant depending on the contract.</p></Reveal><Flow items={["Severe weather affects an airport", "Flights delayed", "Potential service-level thresholds", "Applicable performance / penalty clause", "Illustrative potential exposure", "Mitigation before threshold"]} /></Section>
      <Section><Reveal><p className="op-eyebrow">Crew disruption</p><Status>Illustrative scenario</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Scenario: A crew disruption causes a delay.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>The purpose of this scenario is to show how an operational event could propagate into contractual consequences. Actual consequences depend on the agreements involved.</p></Reveal><Flow items={["Crew no-show", "Flight delay", "Operational disruption", "Affected contracts", "Relevant SLA / obligation", "Potential exposure", "Mitigation"]} /></Section>
      <Section><Reveal><p className="op-eyebrow">Fuel price shock</p><Status>Illustrative scenario</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Scenario: Fuel prices increase by 20%.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>The intelligence opportunity is not simply predicting fuel prices. It is understanding which contractual relationships could be affected if fuel prices change.</p></Reveal><Flow items={["Fuel +20%", "Contracts with fuel-related mechanisms", "Escalation / indexation clause", "Updated contractual economics", "Potential cost exposure", "Negotiation / mitigation option"]} /></Section>
      <Section><Reveal><p className="op-eyebrow">Supplier failure</p><Status>Illustrative scenario</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Scenario: A critical supplier fails its SLA.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Actual consequences depend on contractual terms. This scenario connects to a future Supplier Risk Intelligence layer.</p></Reveal><Flow items={["Supplier failure", "SLA breach", "Operational impact", "Affected contracts", "Potential credits / penalties / costs", "Alternative supplier / mitigation"]} /></Section>
      <Section><Reveal><p className="op-eyebrow">Geopolitical disruption</p><Status>Illustrative scenario</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Scenario: Geopolitical disruption affects a route.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Possible force majeure, termination or alternative provisions may become relevant depending on the applicable agreement. This is not legal advice.</p></Reveal><Flow items={["Geopolitical event", "Route disruption", "Operational change", "Affected contractual relationships", "Possible agreement provisions", "Financial + operational impact", "Action"]} /></Section>
      <Section><Reveal><p className="op-eyebrow">Aircraft availability</p><Status>Illustrative scenario</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Scenario: An aircraft becomes unavailable.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>This scenario connects airline operations, aircraft leasing, MRO and suppliers through the Contract Intelligence foundation.</p></Reveal><Flow items={["Aircraft unavailable", "Flight / network impact", "Lease / MRO / supplier contracts", "Obligations / thresholds", "Potential exposure", "Mitigation options"]} /></Section>

      <Section>
        <Reveal><p className="op-eyebrow">Financial impact</p><h2 className="op-heading-lg">From operational event to potential financial exposure.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>A single operational event can create multiple contractual and financial consequences. The challenge is identifying those relationships early enough to act.</p></Reveal>
        <div className="op-scenario-financial" style={{ marginTop: "var(--op-space-6)" }}><Status>Illustrative scenario</Status><Flow items={["3-hour operational disruption", "Service agreement", "Performance threshold", "Penalty mechanism", "Illustrative exposure: €180,000", "Mitigation before threshold"]} /><p className="op-body-sm">Illustrative example only. Actual contractual consequences and financial exposure depend on the specific agreement, operational conditions and actions taken. Operion does not guarantee savings.</p></div>
      </Section>

      <Section><Reveal><p className="op-eyebrow">Probability</p><Status>Roadmap</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Not every possible future is equally likely.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Future scenarios involve uncertainty. The objective is not simply to list everything that could happen, but to understand which scenarios are more plausible and which could have the greatest impact.</p></Reveal><div className="op-scenario-equation" style={{ marginTop: "var(--op-space-6)" }}><strong>Probability × Impact = Priority</strong><p className="op-body-sm">A future intelligence layer is intended to combine probability, contractual exposure, operational impact, financial impact and potential mitigation. This is a conceptual model, not a production probability calculation.</p></div></Section>
      <Section><Reveal><p className="op-eyebrow">Bayesian reasoning</p><Status>Roadmap</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Update the risk as evidence changes.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>A scenario does not remain equally likely forever. New information changes what we believe about the future. Operion's future architecture is designed to update scenario assessments as new evidence becomes available.</p></Reveal><div className="op-scenario-evidence" style={{ marginTop: "var(--op-space-6)" }}><span>Initial probability: 30%</span><span>New information: supplier performance deteriorates</span><strong>Updated assessment: higher scenario probability</strong><p className="op-body-sm">Illustrative explanation only. No live Bayesian engine is claimed.</p></div></Section>
      <Section><Reveal><p className="op-eyebrow">Monte Carlo</p><Status>Roadmap</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Explore thousands of possible outcomes.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Some contractual risks cannot be understood through a single forecast. A future simulation layer could evaluate many possible combinations of events and conditions to estimate a range of potential outcomes.</p></Reveal><Flow items={["Scenario", "Many possible futures", "Distribution of outcomes", "Potential exposure range"]} /></Section>
      <Section><Reveal><p className="op-eyebrow">Advanced approaches</p><Status>Roadmap</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Explore more complex combinations of possibilities.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Operion is exploring quantum-computing-inspired approaches for complex optimisation and scenario modelling where many variables interact. This is not quantum hardware or a production capability.</p></Reveal></Section>
      <Section><Reveal><p className="op-eyebrow">Real-time scenario tracking</p><Status>Roadmap</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>What if the scenario changes while it is happening?</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>In the future, Operion is designed to continuously reassess scenarios as events unfold. New operational information could change the affected contracts, probability, financial exposure and recommended actions.</p></Reveal><Flow items={["Weather event", "Initial delay", "More flights affected", "Scenario changes", "Exposure updated", "Action updated"]} /></Section>

      <Section><Reveal><p className="op-eyebrow">Decision support</p><Status>Current but in development</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>The goal is not prediction. The goal is better decisions.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>A risk estimate is only useful if it helps someone decide what to do. Operion is being developed to move from risk detection toward decision support.</p></Reveal><div className="op-platform-tag-grid" style={{ marginTop: "var(--op-space-6)" }}>{["Renegotiate a clause", "Contact a supplier", "Diversify suppliers", "Change operational plans", "Escalate an obligation", "Prepare a contractual notice", "Review alternative provisions", "Prepare mitigation"].map((item) => <span key={item} className="op-platform-tag">{item}</span>)}</div></Section>
      <Section><Reveal><p className="op-eyebrow">Role-Based Scenario Intelligence</p><Status>Roadmap</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>One scenario. Different decisions.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Future Role-Based Intelligence will adapt scenario insights to the decisions each user is responsible for making.</p></Reveal><div className="op-grid op-grid-3" style={{ marginTop: "var(--op-space-6)" }}>{ROLE_QUESTIONS.map(([role, question]) => <Reveal key={role} className="op-surface" style={{ padding: "var(--op-space-5)" }}><p className="op-kicker">{role}</p><p className="op-body" style={{ marginTop: "var(--op-space-2)" }}>{question}</p></Reveal>)}</div></Section>
      <Section><Reveal><p className="op-eyebrow">Scenario comparison</p><Status>Roadmap</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Compare possible futures.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>The future experience could compare different conditions and ask: what action changes the outcome? No numerical probabilities are fabricated here.</p></Reveal><div className="op-grid op-grid-3" style={{ marginTop: "var(--op-space-6)" }}>{[["Scenario A", "No disruption", "Potential exposure: Low"], ["Scenario B", "Moderate disruption", "Potential exposure: Medium"], ["Scenario C", "Severe disruption", "Potential exposure: High"]].map(([title, condition, exposure]) => <Reveal key={title} className="op-surface" style={{ padding: "var(--op-space-5)" }}><p className="op-kicker">{title}</p><h3 className="op-heading-md" style={{ margin: "var(--op-space-2) 0" }}>{condition}</h3><p className="op-body-sm">{exposure}</p></Reveal>)}</div></Section>

      <Section><Reveal><p className="op-eyebrow">Aviation first</p><h2 className="op-heading-lg">Designed around real aviation decisions.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>The initial scenario architecture is being shaped around flight disruption, crew availability, aircraft availability, weather, fuel, MRO, suppliers, ground handling, airport operations and geopolitical events.</p></Reveal><div className="op-platform-tag-grid" style={{ marginTop: "var(--op-space-6)" }}>{["Flight disruption", "Crew availability", "Aircraft availability", "Weather", "Fuel", "MRO", "Suppliers", "Ground handling", "Airport operations", "Geopolitical events"].map((item) => <span key={item} className="op-platform-tag">{item}</span>)}</div></Section>
      <Section><Reveal><p className="op-eyebrow">Contract Intelligence evolution</p><h2 className="op-heading-lg">The evolution of Contract Intelligence.</h2></Reveal><div className="op-platform-evolution" style={{ marginTop: "var(--op-space-6)" }}><CapabilityRow stage="1. Understand" description="What does the contract say?" status="Available" live /><CapabilityRow stage="2. Monitor" description="What obligations and deadlines exist?" status="Available" live /><CapabilityRow stage="3. Detect" description="What risks are emerging?" status="Developing" /><CapabilityRow stage="4. Predict" description="What could happen?" status="Future" /><CapabilityRow stage="5. Simulate" description="What happens under different conditions?" status="Future" /><CapabilityRow stage="6. Recommend" description="What should we do?" status="Developing" /><CapabilityRow stage="7. Optimise" description="Which action could produce the best outcome?" status="Future" /></div></Section>
      <Section><Reveal><p className="op-eyebrow">Long-term vision</p><Status>Roadmap</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>The long-term vision: a living contractual model.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>The long-term vision is a Contract Digital Twin that continuously represents contractual relationships, obligations, operational events, financial exposure and possible future outcomes.</p><p className="op-body-sm" style={{ marginTop: "var(--op-space-4)" }}>Digital Twin is a future phase of the Operion roadmap and is not a current product capability.</p></Reveal></Section>
      <Section><Reveal><p className="op-eyebrow">Trust and transparency</p><h2 className="op-heading-lg">Intelligence should be transparent about what it knows.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Operion should distinguish between verified contractual facts, inferred relationships, assumptions, probabilities and illustrative scenarios.</p></Reveal><div className="op-grid op-grid-4 op-scenario-trust-grid" style={{ marginTop: "var(--op-space-6)" }}>{TRUST_STATES.map(([label, description]) => <Reveal key={label} className="op-surface" style={{ padding: "var(--op-space-4)" }}><p className="op-kicker">{label}</p><p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>{description}</p></Reveal>)}</div></Section>
      <Section><Reveal className="op-platform-final-cta"><p className="op-eyebrow">Bring us a scenario</p><h2 className="op-heading-lg">Bring us a scenario.</h2><p className="op-body-lg" style={{ margin: "var(--op-space-4) auto var(--op-space-5)" }}>Tell us what could disrupt your operations, which contracts concern you and what outcome you want to avoid. We can explore how Operion's Contract Intelligence approach could help structure the problem.</p><div className="op-row" style={{ justifyContent: "center", flexWrap: "wrap" }}><Button to="/demo" variant="primary">Request a Demo</Button><Button to="/platform" variant="secondary">Explore the Platform</Button></div></Reveal></Section>
    </>
  );
}
