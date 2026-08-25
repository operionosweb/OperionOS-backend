import React, { useEffect, useState } from "react";
import { Section } from "../components/ui/Layout";
import Button from "../components/ui/Button";
import Reveal from "../components/ui/Reveal";
import IntelligenceStatus from "../components/intelligence/IntelligenceStatus";
import SpatialStage from "../components/intelligence/spatial/SpatialStage";
import SpatialTransition from "../components/intelligence/spatial/SpatialTransition";
import { INTELLIGENCE_AVAILABILITY } from "../lib/contractIntelligenceModel";

const FOUNDATION_CAPABILITIES = [
  ["Contract Intelligence", "Upload contracts, analyse documents, structure contract information, search contents, and identify clauses and obligations.", "Available"],
  ["Clause Intelligence", "Identify the rules inside agreements and understand their structure, hierarchy and source text.", "Available"],
  ["Obligations Tracker", "Turn contractual commitments into structured obligations connected to their clauses and contracts.", "Available"],
  ["Financial Intelligence", "Connect financial mechanisms and potential exposure embedded in contracts.", "In Development"],
];

const COMING_CAPABILITIES = [
  ["Contract Comparison", "Compare clauses, obligations, pricing, liability, service levels, penalties and notice periods by what could matter.", "In Development"],
  ["AI Assistant", "Ask natural-language questions about the contracts and information available to each organisation.", "In Development"],
  ["AI Insights", "Surface relevant insights, unusual obligations, emerging risks and potential exposure instead of requiring every issue to be found manually.", "In Development"],
  ["Risk Intelligence", "Connect contractual conditions with potential consequences and help teams prioritise what deserves attention.", "In Development"],
  ["Recommended Actions", "Move from risk detection toward decision support and help teams understand what they could do next.", "In Development"],
];

const AVIATION_EXAMPLES = ["Aircraft leasing", "MRO", "PBH", "Ground handling", "Suppliers", "Operational disruption"];
const ROLE_EXAMPLES = [
  ["CEO", "Strategic exposure"],
  ["CFO", "Financial exposure"],
  ["Legal", "Contractual risk"],
  ["Procurement", "Supplier performance"],
  ["Operations", "Operational consequences"],
  ["Risk", "Emerging exposure"],
];
const SCENARIOS = [
  ["Fuel price shock", "Fuel prices increase significantly.", "Contracts containing fuel-related escalation mechanisms may be affected."],
  ["Weather disruption", "Severe weather causes operational delays.", "Service-level thresholds or contractual obligations may be triggered."],
  ["Crew disruption", "A crew no-show causes a delay.", "Operational disruption may interact with contractual service obligations."],
  ["Supplier failure", "A critical supplier fails its SLA.", "Credits, penalties, replacement costs or other consequences may become relevant."],
  ["Geopolitical event", "A geopolitical event affects routes or suppliers.", "Force majeure, termination, rerouting or alternative supplier provisions may become relevant."],
];

function PlatformSeo() {
  useEffect(() => {
    const title = "Operion Platform | Contract Intelligence & Operational Intelligence";
    const description = "Explore Operion's Contract Intelligence platform — connecting clauses, obligations, financial exposure, risk and future scenarios to help organisations make better decisions.";
    const canonicalUrl = "https://operionos.com/platform";
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
    const created = metadata.map(([attribute, key, content]) => {
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
    }).filter(Boolean);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    const canonicalWasNew = !canonical;
    const previousCanonical = canonical?.getAttribute("href");
    if (canonicalWasNew) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    return () => {
      created.forEach(({ tag, isNew, previousContent }) => {
        if (isNew) tag.remove();
        else tag.setAttribute("content", previousContent || "");
      });
      if (canonicalWasNew) canonical.remove();
      else canonical.setAttribute("href", previousCanonical || "");
    };
  }, []);

  return null;
}

function StatusLabel({ children, live = false }) {
  return <span className={live ? "op-badge op-badge-live" : "op-badge op-badge-future"}>{children}</span>;
}

function CapabilityCard({ title, description, status }) {
  return (
    <Reveal className="op-surface" style={{ padding: "var(--op-space-5)" }}>
      <StatusLabel live={status === "Available"}>{status}</StatusLabel>
      <h3 className="op-heading-md" style={{ margin: "var(--op-space-3) 0 var(--op-space-2)" }}>{title}</h3>
      <p className="op-body">{description}</p>
    </Reveal>
  );
}

function Chain({ items, className = "" }) {
  return (
    <div className={`op-platform-chain ${className}`.trim()} aria-label={items.join(" to ")}>
      {items.map((item, index) => (
        <React.Fragment key={item}>
          <div className="op-platform-chain-node"><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></div>
          {index < items.length - 1 && <span className="op-platform-chain-arrow" aria-hidden="true">↓</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function Platform() {
  const [activeLayer, setActiveLayer] = useState("intelligence");
  const layers = [
    { id: "contract", label: "Contract", availability: INTELLIGENCE_AVAILABILITY.AVAILABLE },
    { id: "intelligence", label: "Intelligence", availability: INTELLIGENCE_AVAILABILITY.AVAILABLE },
    { id: "operations", label: "Operational reality", availability: INTELLIGENCE_AVAILABILITY.PENDING },
    { id: "decision", label: "Decision", availability: INTELLIGENCE_AVAILABILITY.PENDING },
  ];

  return (
    <>
      <PlatformSeo />
      <Section className="op-platform-hero">
        <Reveal>
          <p className="op-eyebrow">The Operion platform</p>
          <h1 className="op-heading-xl">Contract Intelligence, reimagined as an operating intelligence layer.</h1>
          <p className="op-body-lg" style={{ marginTop: "var(--op-space-5)", maxWidth: 760 }}>
            Operion transforms complex contracts into structured intelligence — connecting clauses, obligations, financial exposure and operational reality to help organisations understand risk, explore what could happen next and make better decisions.
          </p>
        </Reveal>
        <Reveal className="op-platform-opening" style={{ marginTop: "var(--op-space-7)" }}>
          <div>
            <p className="op-kicker" style={{ marginBottom: "var(--op-space-3)" }}>A connected intelligence layer</p>
            <p className="op-body-sm">Operion is not simply a contract repository or traditional CLM. It begins with contractual understanding, then is designed to connect the rules in an agreement to operational reality and decisions.</p>
          </div>
          <SpatialStage stages={layers} activeStageId={activeLayer} onSelectStage={(layer) => setActiveLayer(layer.id)} />
          <SpatialTransition kind="navigate">
            <div className="op-platform-layer-focus">
              <span className="op-kicker">Active layer</span>
              <strong>{layers.find((layer) => layer.id === activeLayer)?.label}</strong>
              <IntelligenceStatus state={layers.find((layer) => layer.id === activeLayer)?.availability} />
            </div>
          </SpatialTransition>
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <p className="op-eyebrow">The foundation</p>
          <h2 className="op-heading-lg">Everything starts with understanding the contract.</h2>
          <p className="op-body-lg" style={{ marginTop: "var(--op-space-4)", marginBottom: "var(--op-space-7)" }}>
            Before an organisation can predict contractual exposure, simulate future outcomes or recommend actions, it must first understand what its contracts actually say.
          </p>
          <p className="op-body-lg" style={{ marginBottom: "var(--op-space-7)" }}>
            Operion structures complex agreements into clauses, obligations, deadlines, financial terms and contractual relationships — turning documents into intelligence that can be searched, analysed and acted upon.
          </p>
        </Reveal>
        <div className="op-grid op-grid-2">
          {FOUNDATION_CAPABILITIES.map(([title, description, status]) => <CapabilityCard key={title} title={title} description={description} status={status} />)}
        </div>
      </Section>

      <Section>
        <Reveal>
          <p className="op-eyebrow">Clause Intelligence</p>
          <StatusLabel live>Available</StatusLabel>
          <h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Understand the rules inside the contract.</h2>
          <p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>
            Operion identifies and structures the clauses that define contractual rights, obligations, thresholds, conditions, penalties and other important rules. This is structured intelligence, not legal advice.
          </p>
        </Reveal>
        <div className="op-platform-tag-grid" style={{ marginTop: "var(--op-space-6)" }}>
          {["SLA clauses", "Maintenance obligations", "Payment terms", "Escalation mechanisms", "Penalty mechanisms", "Termination rights", "Notice periods", "Performance requirements"].map((item) => <span key={item} className="op-platform-tag">{item}</span>)}
        </div>
      </Section>

      <Section>
        <Reveal>
          <p className="op-eyebrow">Obligations Tracker</p>
          <StatusLabel live>Available</StatusLabel>
          <h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Know what needs to happen — and when.</h2>
          <p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>
            Contracts create commitments. Operion turns those commitments into structured obligations so teams can understand what is required, when it is due and where attention may be needed.
          </p>
        </Reveal>
        <div className="op-platform-obligation" style={{ marginTop: "var(--op-space-6)" }}>
          {["Obligation", "Responsible party", "Deadline", "Status", "Related clause", "Related contract"].map((field) => <div key={field}><span className="op-kicker">{field}</span><p className="op-body-sm">Structured from the contract</p></div>)}
        </div>
      </Section>

      <Section>
        <Reveal>
          <p className="op-eyebrow">The intelligence layer</p>
          <h2 className="op-heading-lg">From understanding contracts to understanding exposure.</h2>
          <p className="op-body-lg" style={{ marginTop: "var(--op-space-4)", marginBottom: "var(--op-space-7)" }}>
            Contract risk is rarely isolated. A clause becomes important because something happens — internally, operationally, financially or externally. Operion is developing a Risk Intelligence layer that connects contractual conditions with potential consequences and helps teams prioritise what deserves attention.
          </p>
        </Reveal>
        <div className="op-grid op-grid-3">
          {COMING_CAPABILITIES.map(([title, description, status]) => <CapabilityCard key={title} title={title} description={description} status={status} />)}
        </div>
      </Section>

      <Section className="op-platform-chain-section">
        <Reveal>
          <p className="op-eyebrow">The connected model</p>
          <h2 className="op-heading-lg">From contract language to business consequence.</h2>
          <p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>
            The long-term value of Operion comes from connecting these layers instead of treating them as separate systems.
          </p>
        </Reveal>
        <Chain items={["Contract", "Clause", "Obligation", "Event", "Risk", "Financial impact", "Scenario", "Action", "Outcome"]} />
      </Section>

      <Section>
        <Reveal>
          <p className="op-eyebrow">Real-Time Intelligence</p>
          <StatusLabel>Roadmap</StatusLabel>
          <h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Connect contracts to what is happening now.</h2>
          <p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>
            Contracts do not exist in isolation from operations. A flight delay, crew disruption, supplier failure, weather event or geopolitical disruption can change the relevance of contractual clauses and obligations. Operion's future intelligence layer is designed to connect operational events with contractual consequences as they happen.
          </p>
        </Reveal>
        <div className="op-platform-tag-grid" style={{ marginTop: "var(--op-space-6)" }}>
          {["Flight delays", "Cancellations", "Crew disruptions", "AOG", "Weather", "Supplier failures", "Geopolitical events", "Fuel price changes"].map((item) => <span key={item} className="op-platform-tag">{item}</span>)}
        </div>
      </Section>

      <Section>
        <Reveal>
          <p className="op-eyebrow">Role-Based Intelligence</p>
          <StatusLabel>Roadmap</StatusLabel>
          <h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>The same company. Different decisions. Different intelligence.</h2>
          <p className="op-body-lg" style={{ marginTop: "var(--op-space-4)", marginBottom: "var(--op-space-7)" }}>
            A CEO, CFO, Legal Counsel, Procurement leader and Operations team may work with the same organisation, but they are responsible for different decisions. Operion is designed to combine role-based access with role-based intelligence — adapting the insights, recommendations, priorities and alerts presented to each user.
          </p>
        </Reveal>
        <div className="op-grid op-grid-3">
          {ROLE_EXAMPLES.map(([role, description]) => <Reveal key={role} className="op-surface" style={{ padding: "var(--op-space-5)" }}><p className="op-kicker">{role}</p><p className="op-body" style={{ marginTop: "var(--op-space-2)" }}>{description}</p></Reveal>)}
        </div>
      </Section>

      <Section>
        <Reveal>
          <p className="op-eyebrow">Probabilistic Intelligence</p>
          <StatusLabel>Roadmap</StatusLabel>
          <h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Not everything is certain.</h2>
          <p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>
            Real-world operations rarely follow one predictable path. Operion's future intelligence architecture is being developed to reason about uncertainty using probabilistic approaches including Bayesian reasoning and Monte Carlo methods.
          </p>
        </Reveal>
        <div className="op-platform-probability" style={{ marginTop: "var(--op-space-6)" }}>
          <span>This is a conceptual future capability.</span>
          <strong>There is a 65% probability that this scenario creates contractual exposure above the defined threshold.</strong>
        </div>
      </Section>

      <Section>
        <Reveal>
          <p className="op-eyebrow">Advanced approaches</p>
          <StatusLabel>Roadmap</StatusLabel>
          <h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Exploring more complex possibilities.</h2>
          <p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>
            Operion is also exploring quantum-computing-inspired approaches to complex optimisation and scenario modelling. This is a future strategic direction, not production quantum computing.
          </p>
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <p className="op-eyebrow">Scenario Intelligence</p>
          <StatusLabel>Illustrative / Roadmap</StatusLabel>
          <h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>What happens if X happens?</h2>
          <p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>
            The long-term differentiator of Operion is the ability to understand how changes in the real world could affect contracts, obligations and financial exposure.
          </p>
        </Reveal>
        <Chain items={["Event", "Affected contract", "Relevant clause", "Probability", "Financial exposure", "Recommended action", "Potential outcome"]} className="op-platform-chain-compact" />
        <div className="op-grid op-grid-3" style={{ marginTop: "var(--op-space-6)" }}>
          {SCENARIOS.map(([title, event, consequence]) => <Reveal key={title} className="op-surface" style={{ padding: "var(--op-space-4)" }}><p className="op-kicker">Illustrative scenario</p><h3 className="op-heading-md" style={{ margin: "var(--op-space-2) 0" }}>{title}</h3><p className="op-body-sm">{event}</p><p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>{consequence}</p></Reveal>)}
        </div>
      </Section>

      <Section>
        <Reveal>
          <p className="op-eyebrow">Illustrative scenario</p>
          <h2 className="op-heading-lg">See the potential cost before it becomes the actual cost.</h2>
        </Reveal>
        <div className="op-platform-financial" style={{ marginTop: "var(--op-space-6)" }}>
          <Chain items={["3-hour operational disruption", "Affected service agreement", "Service-level threshold", "Potential contractual penalty", "€180,000", "Mitigation before threshold", "Potential value"]} />
          <p className="op-body-sm">Illustrative scenario. Actual outcomes depend on contractual terms, operational conditions and actions taken.</p>
        </div>
      </Section>

      <Section>
        <Reveal>
          <p className="op-eyebrow">Platform evolution</p>
          <h2 className="op-heading-lg">From understanding contracts to understanding what happens next.</h2>
        </Reveal>
        <div className="op-platform-evolution" style={{ marginTop: "var(--op-space-6)" }}>
          {["Foundation|Contract Intelligence|Available", "Intelligence|Financial Intelligence · Contract Comparison · AI Assistant · AI Insights · Risk Intelligence · Recommended Actions|Developing", "Predictive|Real-Time Intelligence · Role-Based Intelligence · Probabilistic Intelligence|Future", "Simulation|Scenario Intelligence · Advanced Simulation · Monte Carlo · Bayesian reasoning · Quantum-computing-inspired approaches|Future", "Long-term|Contract Digital Twin · Continuous Decision Intelligence|Long-term"].map((entry) => { const [stage, items, status] = entry.split("|"); return <div key={stage} className="op-platform-evolution-row"><div><span className="op-kicker">{stage}</span><strong>{items}</strong></div><StatusLabel live={status === "Available"}>{status}</StatusLabel></div>; })}
        </div>
      </Section>

      <Section>
        <Reveal>
          <p className="op-eyebrow">Aviation &amp; Aerospace</p>
          <h2 className="op-heading-lg">Built for aviation complexity.</h2>
          <p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>
            Aviation contracts do not exist separately from aviation operations. Aircraft leases, MRO agreements, PBH arrangements, ground handling contracts, supplier agreements and operational commitments all contain rules that can become financially important when real-world events occur.
          </p>
        </Reveal>
        <div className="op-platform-tag-grid" style={{ marginTop: "var(--op-space-6)" }}>
          {AVIATION_EXAMPLES.map((item) => <span key={item} className="op-platform-tag">{item}</span>)}
        </div>
        <Button to="/aviation" variant="secondary" style={{ marginTop: "var(--op-space-5)" }}>Explore Aviation</Button>
      </Section>

      <Section>
        <Reveal className="op-platform-final-cta">
          <p className="op-eyebrow">The decision layer</p>
          <h2 className="op-heading-lg">Intelligence should lead to action.</h2>
          <p className="op-body-lg" style={{ margin: "var(--op-space-4) auto var(--op-space-5)" }}>
            Identifying a risk is only the beginning. Operion is being developed to move from risk detection toward decision support — helping teams understand what they could do next.
          </p>
          <div className="op-row" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <Button to="/demo" variant="primary">Request a Demo</Button>
            <Button to="/aviation" variant="secondary">Explore Aviation</Button>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
