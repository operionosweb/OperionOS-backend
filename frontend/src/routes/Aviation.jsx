import React, { useEffect, useState } from "react";
import { Section, Container } from "../components/ui/Layout";
import Button from "../components/ui/Button";
import Reveal from "../components/ui/Reveal";
import IntelligenceStatus from "../components/intelligence/IntelligenceStatus";
import SpatialStage from "../components/intelligence/spatial/SpatialStage";
import SpatialTransition from "../components/intelligence/spatial/SpatialTransition";
import { INTELLIGENCE_AVAILABILITY } from "../lib/contractIntelligenceModel";

const AVIATION_EVENTS = ["Flight delay", "Cancellation", "Crew disruption", "Aircraft AOG", "Supplier failure", "Weather", "Fuel price change", "Geopolitical disruption"];
const HERO = "https://images.unsplash.com/photo-1570710891163-6d3b5c47248b?auto=format&fit=crop&w=2000&q=84";
const NETWORK_NODES = ["Flight delay", "Ground handling", "Airport", "Crew", "Passenger obligations", "SLA", "Potential penalty", "Financial exposure"];
const AIRLINE_LINKS = ["Ground handling SLAs", "Airport agreements", "Crew obligations", "Passenger-related obligations", "Aircraft utilisation", "Maintenance windows", "Supplier commitments"];
const FOUNDATION = [
  ["Contract Intelligence", "Upload and analyse aviation contracts, structure contract information and understand contractual relationships."],
  ["Clause Intelligence", "Identify important contractual rules, including service levels, thresholds, penalties and rights."],
  ["Obligations Tracker", "Monitor commitments and deadlines connected to their related clauses and contracts."],
  ["Search", "Find relevant contract information across the agreements available to your organisation."],
  ["Contract Workspace", "Review structured contractual intelligence through the existing authenticated workspace."],
];
const ROLES = [
  ["CEO", "Strategic exposure across the organisation."],
  ["CFO", "Potential financial exposure and revenue leakage."],
  ["General Counsel", "Contractual obligations, liabilities and risk."],
  ["Procurement", "Supplier performance and contractual exposure."],
  ["Operations", "Operational events and contractual consequences."],
  ["Fleet / Technical", "Maintenance, lease and technical obligations."],
];
const AVIATION_CAPABILITIES = [
  ["Financial Intelligence", "Connect contractual terms with financial mechanisms and potential exposure.", "Developing"],
  ["Contract Comparison", "Understand which differences across agreements could change obligations, risk or cost.", "Developing"],
  ["AI Assistant", "Ask natural-language questions about contracts and relevant intelligence.", "Developing"],
  ["AI Insights", "Surface information that may require attention based on available organisational data.", "Developing"],
  ["Risk Intelligence", "Connect contractual conditions with potential consequences and prioritisation.", "Developing"],
  ["Recommended Actions", "Move from risk detection toward decision support and possible mitigation.", "Developing"],
];
const CUSTOMER_SCENARIOS = [
  ["Contract exposure", "Which contracts contain the highest potential exposure?", "Available contract understanding supports the foundation; exposure analysis is developing."],
  ["Upcoming obligations", "What commitments require attention?", "Structured obligations and deadlines can be reviewed where returned by the current intelligence model."],
  ["Operational disruption", "Which contracts could be affected by an operational event?", "Future event-to-contract connections are roadmap intelligence."],
  ["Supplier risk", "Which supplier failures could create contractual consequences?", "Supplier risk intelligence is a developing direction, not a live claim."],
  ["Financial exposure", "Where could contractual mechanisms create unexpected costs?", "Financial exposure analysis is in development."],
  ["Future scenarios", "What could happen if external conditions change?", "Scenario Intelligence is illustrative and roadmap."],
];

function AviationSeo() {
  useEffect(() => {
    const title = "Operion Aviation | Contract Intelligence for Aviation & Aerospace";
    const description = "Operion helps aviation organisations turn contracts into operational intelligence — connecting clauses, obligations, risk and financial exposure across airlines, leasing, MRO, ground handling and aviation suppliers.";
    const canonicalUrl = "https://operionos.com/industries/aviation";
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
    let structuredData = document.head.querySelector('script[data-operion-page="aviation"]');
    const structuredDataIsNew = !structuredData;
    if (structuredDataIsNew) {
      structuredData = document.createElement("script");
      structuredData.type = "application/ld+json";
      structuredData.dataset.operionPage = "aviation";
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
    <div className={`op-aviation-flow ${className}`.trim()} aria-label={items.join(" to ")}>
      {items.map((item, index) => (
        <React.Fragment key={item}>
          <div className="op-aviation-flow-node"><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></div>
          {index < items.length - 1 && <span className="op-aviation-flow-arrow" aria-hidden="true">↓</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function CapabilityCard({ title, description, status = "Available", live = false }) {
  return (
    <Reveal className="op-surface" style={{ padding: "var(--op-space-5)" }}>
      <Status live={live}>{status}</Status>
      <h3 className="op-heading-md" style={{ margin: "var(--op-space-3) 0 var(--op-space-2)" }}>{title}</h3>
      <p className="op-body">{description}</p>
    </Reveal>
  );
}

function ScenarioBlock({ title, status, items, description }) {
  return (
    <Reveal className="op-surface" style={{ padding: "var(--op-space-5)" }}>
      <Status>{status}</Status>
      <h3 className="op-heading-md" style={{ margin: "var(--op-space-3) 0 var(--op-space-2)" }}>{title}</h3>
      <Flow items={items} className="op-aviation-flow-compact" />
      <p className="op-body-sm" style={{ marginTop: "var(--op-space-4)" }}>{description}</p>
    </Reveal>
  );
}

export default function Aviation() {
  const [activeEntity, setActiveEntity] = useState("contract");
  const entities = [
    { id: "aircraft", label: "Aircraft / flight", availability: INTELLIGENCE_AVAILABILITY.AVAILABLE },
    { id: "contract", label: "Contract", availability: INTELLIGENCE_AVAILABILITY.AVAILABLE },
    { id: "clause", label: "Clause", availability: INTELLIGENCE_AVAILABILITY.AVAILABLE },
    { id: "event", label: "Operational event", availability: INTELLIGENCE_AVAILABILITY.PENDING },
    { id: "impact", label: "Financial impact", availability: INTELLIGENCE_AVAILABILITY.PENDING },
    { id: "action", label: "Action", availability: INTELLIGENCE_AVAILABILITY.PENDING },
  ];

  return (
    <>
      <AviationSeo />
      <section className="op-page-hero op-cinematic-hero" style={{ backgroundImage: `url(${HERO})` }}>
        <div className="op-page-hero-overlay">
          <Container>
            <Reveal>
              <p className="op-stitch-label">OPERION / AVIATION &amp; AEROSPACE</p>
              <h1>Contract Intelligence for Aviation &amp; Aerospace.</h1>
              <p>Connect the contractual relationships behind aircraft, operations, suppliers, maintenance and financial exposure.</p>
            </Reveal>
          </Container>
        </div>
      </section>
      <Section className="op-aviation-hero">
        <Reveal>
          <p className="op-eyebrow">Aviation &amp; Aerospace</p>
          <h1 className="op-heading-xl">Contract Intelligence for Aviation &amp; Aerospace.</h1>
          <p className="op-body-lg" style={{ marginTop: "var(--op-space-5)", maxWidth: 800 }}>
            Aviation operates through thousands of interconnected contractual relationships. A delay, disruption, supplier failure, maintenance event or market change can trigger obligations, penalties, costs and operational consequences across those contracts.
          </p>
          <p className="op-body-lg" style={{ marginTop: "var(--op-space-4)", maxWidth: 800 }}>
            Operion is building the intelligence layer that connects those contractual rules with operational reality — helping aviation organisations understand exposure earlier and make better decisions before potential losses become realised costs.
          </p>
        </Reveal>
        <Reveal className="op-aviation-hero-visual" style={{ marginTop: "var(--op-space-7)" }}>
          <div>
            <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Aviation intelligence relationship</p>
            <p className="op-body-sm">Select a layer to see how the conceptual chain deepens from aircraft and flight context toward contractual decision support.</p>
          </div>
          <SpatialStage stages={entities} activeStageId={activeEntity} onSelectStage={(entity) => setActiveEntity(entity.id)} />
          <SpatialTransition kind="navigate">
            <div className="op-aviation-active-layer"><span className="op-kicker">Selected layer</span><strong>{entities.find((entity) => entity.id === activeEntity)?.label}</strong><IntelligenceStatus state={entities.find((entity) => entity.id === activeEntity)?.availability} /></div>
          </SpatialTransition>
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <p className="op-eyebrow">Why aviation?</p>
          <h2 className="op-heading-lg">Aviation is a network of contractual dependencies.</h2>
          <p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>
            Airlines and aviation organisations do not operate through one contract. They operate through interconnected ecosystems of leases, maintenance agreements, service-level agreements, supplier contracts, airport arrangements, ground handling agreements, insurance, financing and operational commitments.
          </p>
          <p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>
            When something changes in operations, the contractual consequences can extend far beyond the original event.
          </p>
        </Reveal>
        <div className="op-aviation-network" style={{ marginTop: "var(--op-space-6)" }}>
          <Status>Illustrative relationship</Status>
          <Flow items={NETWORK_NODES} />
          <p className="op-body-sm">Illustrative relationship. A delay does not necessarily trigger every consequence shown; actual outcomes depend on the applicable agreements and operating conditions.</p>
        </div>
      </Section>

      <Section>
        <Reveal>
          <p className="op-eyebrow">The shift</p>
          <h2 className="op-heading-lg">Aviation is often forced to react after the event.</h2>
        </Reveal>
        <div className="op-grid op-grid-2" style={{ marginTop: "var(--op-space-7)" }}>
          <Reveal className="op-aviation-process op-aviation-process-reactive"><p className="op-kicker">Reactive</p><Flow items={["Event", "Operational disruption", "Contract searched manually", "Clause identified", "Exposure calculated", "Penalty / claim / cost", "Reaction"]} /></Reveal>
          <Reveal className="op-aviation-process op-aviation-process-proactive"><Status>Operion direction</Status><Flow items={["Event", "Potentially affected contracts identified", "Relevant clauses connected", "Obligations evaluated", "Potential exposure assessed", "Scenario considered", "Recommended action"]} /><p className="op-body-sm">The advanced portions of this flow represent development and roadmap intelligence, not a claim that every step is currently live.</p></Reveal>
        </div>
      </Section>

      <Section>
        <Reveal>
          <p className="op-eyebrow">Airlines</p>
          <h2 className="op-heading-lg">For airlines, operational disruption can become contractual exposure.</h2>
          <p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>
            Flight delays, cancellations, crew disruptions, aircraft availability, AOG events, maintenance delays, supplier failures, weather, airport disruption, fuel price changes and geopolitical disruption may interact with different contracts depending on the agreement involved.
          </p>
        </Reveal>
        <div className="op-grid op-grid-2" style={{ marginTop: "var(--op-space-6)" }}>
          <div className="op-surface" style={{ padding: "var(--op-space-5)" }}><p className="op-kicker" style={{ marginBottom: "var(--op-space-3)" }}>Potentially affected relationships</p><ul className="op-aviation-list">{AIRLINE_LINKS.map((item) => <li key={item}>{item}</li>)}</ul></div>
          <div className="op-surface" style={{ padding: "var(--op-space-5)" }}><p className="op-kicker" style={{ marginBottom: "var(--op-space-3)" }}>The question</p><p className="op-body">Which contractual rules could matter when the operation changes? Operion is being built to help teams trace that question from event to agreement, clause, obligation and potential consequence.</p></div>
        </div>
      </Section>

      <Section>
        <Reveal><p className="op-eyebrow">Aircraft leasing</p><h2 className="op-heading-lg">Aircraft leasing</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Aircraft leasing agreements contain detailed contractual requirements around payments, maintenance, utilisation, return conditions, technical status and other obligations. Operion's Contract Intelligence foundation is designed to help organisations understand these requirements and connect them to the contractual exposure they create.</p></Reveal>
        <div className="op-platform-tag-grid" style={{ marginTop: "var(--op-space-6)" }}>{["Lease obligations", "Payment terms", "Maintenance requirements", "Return conditions", "Notice periods", "Financial mechanisms", "Contractual thresholds"].map((item) => <span key={item} className="op-platform-tag">{item}</span>)}</div>
      </Section>

      <Section>
        <Reveal><p className="op-eyebrow">Maintenance, Repair &amp; Overhaul</p><h2 className="op-heading-lg">Maintenance, Repair &amp; Overhaul</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>MRO contracts contain service levels, turnaround requirements, maintenance obligations, parts commitments, warranties, penalties, availability requirements and escalation mechanisms.</p></Reveal>
        <ScenarioBlock title="Maintenance delay" status="Illustrative scenario" items={["Maintenance delay", "Aircraft unavailable", "Operational disruption", "Potentially affected commitments", "Possible financial exposure"]} description="Illustrative scenario. Actual contractual consequences depend on the agreements involved and the operational conditions." />
      </Section>

      <Section>
        <Reveal><p className="op-eyebrow">Power-by-the-Hour</p><h2 className="op-heading-lg">Power-by-the-Hour and performance-based contracts</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>PBH arrangements can contain complex mechanisms around utilisation, maintenance, availability, rates, escalation, performance and claims. Operion can help structure and understand the contractual logic. Advanced predictive scenario analysis remains in development and roadmap.</p></Reveal>
        <div className="op-platform-tag-grid" style={{ marginTop: "var(--op-space-6)" }}>{["Utilisation", "Maintenance", "Availability", "Rates", "Escalation", "Performance", "Claims"].map((item) => <span key={item} className="op-platform-tag">{item}</span>)}</div>
      </Section>

      <Section>
        <Reveal><p className="op-eyebrow">Ground handling &amp; airport services</p><h2 className="op-heading-lg">Ground handling &amp; airport services</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Ground handling agreements may define turnaround times, service levels, responsibilities, performance thresholds, penalties and operational commitments.</p></Reveal>
        <ScenarioBlock title="Ground handling delay" status="Illustrative scenario" items={["Ground handling delay", "Turnaround threshold", "SLA condition", "Potential contractual consequence", "Potential financial exposure"]} description="Illustrative scenario. The relationship shown is conceptual and does not imply that every delay triggers a penalty." />
      </Section>

      <Section>
        <Reveal><p className="op-eyebrow">Supplier contracts</p><h2 className="op-heading-lg">Supplier performance can become contractual risk.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Aviation organisations rely on suppliers for aircraft components, maintenance, fuel, ground services, catering, technology, airport services and operational support. A supplier failure may become relevant through the applicable SLA, operating commitments and possible mitigation options.</p></Reveal>
        <Flow items={["Supplier failure", "SLA breach", "Operational disruption", "Contractual exposure", "Alternative supplier / mitigation"]} />
      </Section>

      <Section>
        <Reveal><p className="op-eyebrow">Illustrative / Roadmap</p><Status>Illustrative / Roadmap</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>What if the weather changes tomorrow?</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Weather can disrupt aircraft movements, crew schedules, airport operations and supply chains. The future Operion intelligence layer is designed to connect external events with the contracts they could affect. Operion does not currently claim live weather integration.</p></Reveal>
        <Flow items={["Severe weather", "Flight delays", "Operational threshold", "Affected contract", "Potential penalty", "Mitigation action"]} />
      </Section>

      <Section><Reveal><p className="op-eyebrow">Illustrative scenario</p><h2 className="op-heading-lg">What if a crew member doesn't show up?</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Actual contractual consequences depend on the agreements involved.</p></Reveal><Flow items={["Crew no-show", "Flight delay", "Operational disruption", "Contractual threshold", "Potential exposure", "Action"]} /></Section>
      <Section><Reveal><p className="op-eyebrow">Illustrative scenario</p><h2 className="op-heading-lg">What if fuel prices increase by 20%?</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>The purpose is not simply to predict the price of fuel. It is to understand which contractual relationships could be affected if the price changes.</p></Reveal><Flow items={["Fuel price +20%", "Affected contracts", "Escalation / indexation clause", "Updated contractual economics", "Potential cost exposure", "Mitigation / negotiation option"]} /></Section>
      <Section><Reveal><p className="op-eyebrow">Illustrative / Roadmap</p><Status>Illustrative / Roadmap</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>What if geopolitical disruption affects a route?</h2></Reveal><Flow items={["Geopolitical event", "Route disruption", "Operational change", "Affected supplier / contract", "Force majeure / termination / alternative provision", "Financial / operational impact", "Recommended action"]} /></Section>

      <Section>
        <Reveal><p className="op-eyebrow">Illustrative scenario</p><h2 className="op-heading-lg">The cost of a disruption is not always visible at the moment it happens.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>A single operational event can create multiple contractual and financial consequences. The challenge is identifying those relationships early enough to act.</p></Reveal>
        <div className="op-aviation-financial" style={{ marginTop: "var(--op-space-6)" }}><Status>Illustrative scenario</Status><Flow items={["3-hour disruption", "Affected service agreement", "Performance threshold", "Illustrative exposure: €180,000", "Potential mitigation before threshold", "Potential value"]} /><p className="op-body-sm">Illustrative scenario. Actual outcomes depend on contractual terms, operational conditions and actions taken. Operion does not guarantee savings.</p></div>
      </Section>

      <Section>
        <Reveal><p className="op-eyebrow">Role-Based Intelligence</p><Status>Roadmap</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Different aviation leaders need different intelligence.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>The long-term Operion experience is designed to combine role-based access with role-based intelligence — delivering the information and recommendations most relevant to each decision-maker.</p></Reveal>
        <div className="op-grid op-grid-3" style={{ marginTop: "var(--op-space-6)" }}>{ROLES.map(([role, description]) => <Reveal key={role} className="op-surface" style={{ padding: "var(--op-space-5)" }}><p className="op-kicker">{role}</p><p className="op-body" style={{ marginTop: "var(--op-space-2)" }}>{description}</p></Reveal>)}</div>
      </Section>

      <Section>
        <Reveal><p className="op-eyebrow">Current foundation</p><h2 className="op-heading-lg">Start with the contracts you already have.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)", marginBottom: "var(--op-space-7)" }}>These are the strongest current Contract Intelligence capabilities in the existing product foundation.</p></Reveal>
        <div className="op-grid op-grid-3">{FOUNDATION.map(([title, description]) => <CapabilityCard key={title} title={title} description={description} live />)}</div>
      </Section>

      <Section>
        <Reveal><p className="op-eyebrow">Aviation intelligence evolution</p><h2 className="op-heading-lg">From contractual understanding toward operational intelligence.</h2></Reveal>
        <div className="op-platform-evolution" style={{ marginTop: "var(--op-space-6)" }}>{[["Today", "Contract Intelligence · Clause Intelligence · Obligations Tracker", "Available"], ["Developing", "Financial Intelligence · Contract Comparison · AI Assistant · AI Insights · Risk Intelligence · Recommended Actions", "Developing"], ["Future", "Real-Time Intelligence · Role-Based Intelligence · Predictive Risk Intelligence · Probabilistic Reasoning · Scenario Intelligence · Advanced Simulation", "Future"], ["Long-term", "Contract Digital Twin", "Long-term"]].map(([stage, items, status]) => <div key={stage} className="op-platform-evolution-row"><div><span className="op-kicker">{stage}</span><strong>{items}</strong></div><Status live={status === "Available"}>{status}</Status></div>)}</div>
      </Section>

      <Section>
        <Reveal><p className="op-eyebrow">What could Operion help an aviation organisation understand?</p><h2 className="op-heading-lg">Questions that connect operations to contracts.</h2></Reveal>
        <div className="op-grid op-grid-3" style={{ marginTop: "var(--op-space-6)" }}>{CUSTOMER_SCENARIOS.map(([title, question, note]) => <Reveal key={title} className="op-surface" style={{ padding: "var(--op-space-5)" }}><h3 className="op-heading-md">{title}</h3><p className="op-body" style={{ margin: "var(--op-space-3) 0" }}>{question}</p><p className="op-body-sm">{note}</p></Reveal>)}</div>
      </Section>

      <Section>
        <Reveal><p className="op-eyebrow">Built for the aviation ecosystem</p><h2 className="op-heading-lg">Built for the aviation ecosystem.</h2></Reveal>
        <div className="op-grid op-grid-3" style={{ marginTop: "var(--op-space-6)" }}>{[["Airlines", "Connect operational disruption with contractual context."], ["Aircraft Leasing", "Understand lease obligations, requirements and thresholds."], ["MRO", "Structure service levels, turnaround and maintenance commitments."], ["Ground Handling", "Make service-level relationships easier to understand."], ["Airport Operators", "Trace operational arrangements and contractual dependencies."], ["Aviation Consultancies", "Create a clearer intelligence layer for complex aviation agreements."]].map(([title, description]) => <Reveal key={title} className="op-surface" style={{ padding: "var(--op-space-5)" }}><h3 className="op-heading-md">{title}</h3><p className="op-body" style={{ marginTop: "var(--op-space-2)" }}>{description}</p></Reveal>)}</div>
      </Section>

      <Section>
        <Reveal className="op-platform-final-cta"><p className="op-eyebrow">Aviation Contract Intelligence</p><h2 className="op-heading-lg">Explore your aviation contracts with Operion.</h2><p className="op-body-lg" style={{ margin: "var(--op-space-4) auto var(--op-space-5)" }}>Bring a real aviation contract, operational challenge or potential disruption scenario and explore how Operion can turn contractual information into intelligence.</p><div className="op-row" style={{ justifyContent: "center", flexWrap: "wrap" }}><Button to="/demo" variant="primary">Request a Demo</Button><Button to="/platform" variant="secondary">Explore the Platform</Button></div></Reveal>
      </Section>
    </>
  );
}
