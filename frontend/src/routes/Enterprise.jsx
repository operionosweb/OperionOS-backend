import React, { useEffect, useState } from "react";
import { Section } from "../components/ui/Layout";
import Button from "../components/ui/Button";
import Reveal from "../components/ui/Reveal";
import IntelligenceStatus from "../components/intelligence/IntelligenceStatus";
import SpatialStage from "../components/intelligence/spatial/SpatialStage";
import SpatialTransition from "../components/intelligence/spatial/SpatialTransition";
import { INTELLIGENCE_AVAILABILITY } from "../lib/contractIntelligenceModel";

const SOURCES = ["Contracts", "Operational systems", "Financial systems", "Supplier systems", "External data"];
const INTELLIGENCE = ["Contract Intelligence", "Clause Intelligence", "Obligation Intelligence", "Financial Intelligence", "Risk Intelligence", "Predictive Intelligence"];
const DECISIONS = ["Insights", "Alerts", "Scenarios", "Recommendations", "Workflows"];
const PEOPLE = ["CEO", "CFO", "Legal", "Procurement", "Operations", "Technical"];
const CONTRACT_RULES = ["Obligations", "Rights", "Deadlines", "Service levels", "Pricing mechanisms", "Escalation mechanisms", "Penalties", "Termination conditions", "Renewal conditions", "Performance requirements", "Responsibilities"];
const DEVELOPING = [
  ["Financial Intelligence", "Understand contractual economics and potential financial exposure."],
  ["Contract Comparison", "Compare contractual structures and differences that could matter."],
  ["AI Assistant", "Ask questions about contractual information using natural language."],
  ["AI Insights", "Surface relevant contractual patterns and insights."],
  ["Risk Intelligence", "Identify potential areas of contractual exposure."],
  ["Recommended Actions", "Move from identifying risks toward deciding what to do."],
];
const ROLES = [
  ["CEO", "Strategic exposure, major risks and organisational impact."],
  ["CFO", "Financial exposure, revenue leakage and contractual economics."],
  ["General Counsel", "Clauses, obligations, liabilities and contractual risk."],
  ["Procurement", "Supplier performance, commercial terms and exposure."],
  ["Operations", "Operational events and potentially affected contracts."],
  ["Fleet / Technical", "Aircraft, maintenance and technical obligations."],
];
const EXTERNAL_VARIABLES = ["Fuel prices", "Interest rates", "Inflation", "Exchange rates", "Weather", "Geopolitical events", "Supplier risk", "Aviation market conditions"];

function EnterpriseSeo() {
  useEffect(() => {
    const title = "Operion Enterprise | Contract Intelligence for Business Decisions";
    const description = "Operion connects contracts with operational, financial and external context to help organisations understand contractual exposure and move toward predictive decision intelligence.";
    const canonicalUrl = "https://operionos.com/enterprise";
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
    let structuredData = document.head.querySelector('script[data-operion-page="enterprise"]');
    const structuredDataIsNew = !structuredData;
    if (structuredDataIsNew) {
      structuredData = document.createElement("script");
      structuredData.type = "application/ld+json";
      structuredData.dataset.operionPage = "enterprise";
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
    <div className={`op-enterprise-flow ${className}`.trim()} aria-label={items.join(" to ")}>
      {items.map((item, index) => (
        <React.Fragment key={item}>
          <div className="op-enterprise-flow-node"><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></div>
          {index < items.length - 1 && <span className="op-enterprise-flow-arrow" aria-hidden="true">↓</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function ListPanel({ title, items, tone = "" }) {
  return <div className={`op-enterprise-list-panel ${tone}`.trim()}><p className="op-kicker">{title}</p><div>{items.map((item) => <span key={item}>{item}</span>)}</div></div>;
}

export default function Enterprise() {
  const [activeNode, setActiveNode] = useState("Contracts");
  const nodes = ["Contracts", "Operations", "Finance", "Suppliers", "Assets", "People", "External events"].map((label) => ({ id: label.toLowerCase().replaceAll(" ", "-"), label, availability: label === "Contracts" ? INTELLIGENCE_AVAILABILITY.AVAILABLE : INTELLIGENCE_AVAILABILITY.PENDING }));
  return (
    <>
      <EnterpriseSeo />
      <Section className="op-enterprise-hero">
        <Reveal><p className="op-eyebrow">Enterprise architecture</p><h1 className="op-heading-xl">The intelligence layer between contracts and decisions.</h1><p className="op-body-lg" style={{ marginTop: "var(--op-space-5)", maxWidth: 820 }}>Contracts do not operate in isolation. They interact with operations, suppliers, finance, people, assets, markets and external events. Operion is building an intelligence layer that connects those relationships — starting with understanding the contract and evolving toward predictive risk intelligence, scenario analysis and decision support.</p></Reveal>
        <Reveal className="op-enterprise-hero-visual" style={{ marginTop: "var(--op-space-7)" }}><div><p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Conceptual enterprise architecture</p><p className="op-body-sm">Select a surrounding context to see how the intended intelligence layer relates to Operion. These are architectural relationships, not claimed live integrations.</p></div><SpatialStage stages={nodes} activeStageId={nodes.find((node) => node.label === activeNode)?.id} onSelectStage={(node) => setActiveNode(node.label)} /><SpatialTransition kind="navigate"><div className="op-enterprise-active-node"><span className="op-kicker">Selected context</span><strong>{activeNode}</strong><IntelligenceStatus state={activeNode === "Contracts" ? INTELLIGENCE_AVAILABILITY.AVAILABLE : INTELLIGENCE_AVAILABILITY.PENDING} /></div></SpatialTransition><Flow items={["Contracts", "Clauses", "Obligations", "Operational context", "Financial context", "External events", "Risk", "Scenarios", "Decisions"]} /></Reveal>
        <Reveal style={{ marginTop: "var(--op-space-5)" }}><div className="op-row" style={{ flexWrap: "wrap" }}><Button to="/demo" variant="primary">Request a Demo</Button><Button to="/platform" variant="secondary">Explore the Platform</Button></div></Reveal>
      </Section>

      <Section><Reveal><p className="op-eyebrow">The enterprise problem</p><h2 className="op-heading-lg">Business systems know different pieces of the story.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>ERP systems understand financial transactions. Operational systems understand what is happening. Procurement systems understand suppliers. HR systems understand people. CRM systems understand customers. Contract repositories contain the rules that govern many of those relationships. But the contractual consequences often remain disconnected from the operational context in which decisions are made.</p></Reveal><Flow items={["Systems", "Data", "Contracts", "Decisions"]} /><p className="op-body-sm op-enterprise-callout">Operion's intended role is the intelligence layer connecting these relationships, not another system of record.</p></Section>

      <Section><Reveal><p className="op-eyebrow">Contractual logic</p><h2 className="op-heading-lg">Contracts contain the rules behind business relationships.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Understanding those rules is the foundation for understanding how business events can create contractual consequences.</p></Reveal><div className="op-platform-tag-grid" style={{ marginTop: "var(--op-space-6)" }}>{CONTRACT_RULES.map((item) => <span key={item} className="op-platform-tag">{item}</span>)}</div></Section>

      <Section><Reveal><p className="op-eyebrow">Current foundation</p><Status live>Available</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Start with understanding the contract.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)", marginBottom: "var(--op-space-7)" }}>These are the current verified foundations: upload and analyse contracts, identify clauses and obligations, search relevant information and review structured contractual intelligence in the Contract Workspace.</p></Reveal><div className="op-grid op-grid-3">{[["Contract Intelligence", "Upload and analyse contracts."], ["Clause Intelligence", "Identify and understand relevant clauses."], ["Obligations Tracker", "Monitor contractual commitments and deadlines."], ["Contract Search", "Find relevant information across contracts."], ["Contract Workspace", "Review structured contractual intelligence."]].map(([title, description]) => <Reveal key={title} className="op-surface" style={{ padding: "var(--op-space-5)" }}><Status live>Available</Status><h3 className="op-heading-md" style={{ margin: "var(--op-space-3) 0 var(--op-space-2)" }}>{title}</h3><p className="op-body">{description}</p></Reveal>)}</div></Section>

      <Section><Reveal><p className="op-eyebrow">Developing intelligence</p><Status>Current but in development</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Then connect contractual intelligence to business impact.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)", marginBottom: "var(--op-space-7)" }}>Maturity varies across these capabilities. They represent the direction of the intelligence layer and should not be understood as universally production-ready.</p></Reveal><div className="op-grid op-grid-3">{DEVELOPING.map(([title, description]) => <Reveal key={title} className="op-surface" style={{ padding: "var(--op-space-5)" }}><Status>In Development</Status><h3 className="op-heading-md" style={{ margin: "var(--op-space-3) 0 var(--op-space-2)" }}>{title}</h3><p className="op-body">{description}</p></Reveal>)}</div></Section>

      <Section><Reveal><p className="op-eyebrow">Natural language</p><Status>In Development</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Ask Operion in your own words.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Business users should not need to learn a query language or search through hundreds of documents. The future Operion experience is designed around natural-language questions, while current search and Contract Intelligence remain the verified foundation.</p></Reveal><div className="op-enterprise-question-grid" style={{ marginTop: "var(--op-space-6)" }}>{["Which contracts could expose us to penalties this month?", "Which supplier agreements contain the highest service-level exposure?", "What obligations are due in the next 30 days?", "Show me contracts with fuel-related escalation mechanisms.", "What happens if this supplier fails?", "What should I review before renewing this agreement?"].map((question) => <p key={question}>“{question}”</p>)}</div></Section>

      <Section><Reveal><p className="op-eyebrow">Role-Based Intelligence</p><Status>Roadmap</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>The same business. Different intelligence.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Traditional software often changes what users can access. Operion's longer-term vision is to change what intelligence each user receives based on the decisions they are responsible for making.</p></Reveal><div className="op-enterprise-rbi" style={{ marginTop: "var(--op-space-6)" }}><strong>RBAC</strong><span>+</span><strong>RBI</strong><span>=</span><strong>Role-Based Intelligence</strong><p className="op-body-sm">Role-Based Access Control determines what a user can access. Role-Based Intelligence is a future direction for determining what intelligence is most relevant to that user's decisions.</p></div><div className="op-grid op-grid-3" style={{ marginTop: "var(--op-space-6)" }}>{ROLES.map(([role, description]) => <Reveal key={role} className="op-surface" style={{ padding: "var(--op-space-5)" }}><p className="op-kicker">{role}</p><p className="op-body" style={{ marginTop: "var(--op-space-2)" }}>{description}</p></Reveal>)}</div></Section>

      <Section><Reveal><p className="op-eyebrow">Enterprise data flow</p><h2 className="op-heading-lg">From fragmented information to connected intelligence.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Layers 2–4 progressively expand over the roadmap. The source systems below are conceptual architecture, not claims that all integrations currently exist.</p></Reveal><div className="op-enterprise-layers" style={{ marginTop: "var(--op-space-6)" }}><ListPanel title="Layer 1 — Sources" items={SOURCES} /><ListPanel title="Layer 2 — Intelligence" items={INTELLIGENCE} tone="op-enterprise-layer-future" /><ListPanel title="Layer 3 — Decision support" items={DECISIONS} tone="op-enterprise-layer-future" /><ListPanel title="Layer 4 — People" items={PEOPLE} tone="op-enterprise-layer-future" /></div></Section>

      <Section><Reveal><p className="op-eyebrow">Aviation example</p><Status>Illustrative scenario</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>See how this could work in aviation.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>This example connects the Enterprise page back to Aviation and Scenarios. Future stages are roadmap concepts.</p></Reveal><Flow items={["Weather disruption", "Operations: flights delayed", "Contract Intelligence: affected agreements", "Clause: relevant SLA / threshold", "Financial Intelligence: potential exposure", "Scenario Intelligence: alternative outcomes", "Recommended Action: mitigation options"]} /><p className="op-body-sm op-enterprise-callout">Illustrative scenario. Actual consequences depend on the applicable agreement, operational conditions and actions taken.</p></Section>

      <Section><Reveal><p className="op-eyebrow">Integration architecture</p><h2 className="op-heading-lg">Operion does not need to replace your existing systems.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>The long-term objective is not to replace the systems organisations already depend on. It is to make contractual intelligence more useful by connecting it with the business context around those contracts.</p></Reveal><Status>Future / Integration architecture</Status><Flow items={["ERP", "CRM", "TMS / Operations", "Procurement", "HR", "Finance", "Data sources", "Operion", "Contractual + risk intelligence", "Decision-makers"]} /></Section>

      <Section><Reveal><p className="op-eyebrow">External context</p><Status>Roadmap</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Contracts are affected by a world that keeps changing.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Future predictive intelligence could connect external variables with contractual structures to identify where changing conditions may create exposure. Operion does not claim live feeds here.</p></Reveal><div className="op-platform-tag-grid" style={{ marginTop: "var(--op-space-6)" }}>{EXTERNAL_VARIABLES.map((item) => <span key={item} className="op-platform-tag">{item}</span>)}</div></Section>

      <Section><Reveal><p className="op-eyebrow">Real-time intelligence</p><Status>Roadmap</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Intelligence should evolve as reality changes.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>In the future, Operion could continuously reassess contractual exposure as new events and information emerge.</p></Reveal><Flow items={["Event occurs", "New data", "Affected contracts", "Risk updated", "Scenario updated", "Recommendation updated"]} /></Section>

      <Section><Reveal><p className="op-eyebrow">Predictive intelligence</p><Status>Roadmap</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Move from understanding risk to anticipating it.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Historical: “What happened?” Current: “What does the contract say?” Developing: “What risks exist?” Future: “What could happen?” Then: “What should we do?”</p></Reveal><div className="op-enterprise-progression" style={{ marginTop: "var(--op-space-6)" }}><Flow items={["Understand", "Detect", "Predict", "Simulate", "Recommend", "Act"]} /></div></Section>

      <Section><Reveal><p className="op-eyebrow">Probabilistic reasoning</p><Status>Roadmap</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>The future is uncertain.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Future business conditions rarely have one certain outcome. Operion's long-term architecture is intended to reason across uncertainty rather than relying only on deterministic predictions.</p></Reveal><div className="op-enterprise-equation" style={{ marginTop: "var(--op-space-6)" }}><strong>Probability + Impact + Exposure + Mitigation = Decision Intelligence</strong><p className="op-body-sm">This is a conceptual model, not a production probabilistic engine.</p></div></Section>

      <Section><Reveal><p className="op-eyebrow">Simulation</p><Status>Roadmap</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Explore alternative futures.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Scenario simulation is the long-term direction of Operion's intelligence architecture. Organisations could compare possible outcomes under different assumptions and ask what action produces the best risk-adjusted outcome.</p></Reveal><div className="op-grid op-grid-3" style={{ marginTop: "var(--op-space-6)" }}>{[["Scenario A", "Stable conditions"], ["Scenario B", "Moderate disruption"], ["Scenario C", "Severe disruption"]].map(([title, condition]) => <Reveal key={title} className="op-surface" style={{ padding: "var(--op-space-5)" }}><p className="op-kicker">{title}</p><h3 className="op-heading-md" style={{ marginTop: "var(--op-space-2)" }}>{condition}</h3></Reveal>)}</div></Section>

      <Section><Reveal><p className="op-eyebrow">Advanced approaches</p><Status>Roadmap</Status><h2 className="op-heading-lg" style={{ marginTop: "var(--op-space-3)" }}>Designed for complex decision spaces.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Operion is exploring quantum-computing-inspired approaches for future optimisation and scenario modelling where many variables and possible outcomes interact. This makes no claim about quantum hardware or production quantum computation.</p></Reveal></Section>

      <Section><Reveal><p className="op-eyebrow">Decision support</p><h2 className="op-heading-lg">Intelligence should lead to action.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Operion's evolution is intended to move from understanding to detecting, predicting, simulating, recommending and acting. The following are examples of that future decision-support direction.</p></Reveal><div className="op-platform-tag-grid" style={{ marginTop: "var(--op-space-6)" }}>{["Review a clause", "Contact a supplier", "Renegotiate terms", "Prepare a notice", "Diversify suppliers", "Change operational plans", "Escalate an obligation", "Restructure contractual terms"].map((item) => <span key={item} className="op-platform-tag">{item}</span>)}</div></Section>

      <Section><Reveal><p className="op-eyebrow">Enterprise trust</p><h2 className="op-heading-lg">Enterprise intelligence must be explainable.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Operion should distinguish facts, evidence, inferences, probabilities, scenarios and recommendations so decision-makers can understand how an intelligence outcome was formed.</p></Reveal><div className="op-grid op-grid-3" style={{ marginTop: "var(--op-space-6)" }}>{[["Verified fact", "What the contract actually says."], ["Evidence", "The clause or obligation supporting the conclusion."], ["Inference", "A relationship inferred from available information."], ["Probability", "An assessment of possible future outcomes."], ["Scenario", "A modelled or illustrative future condition."], ["Recommendation", "A proposed action based on available evidence."]].map(([title, description]) => <Reveal key={title} className="op-surface" style={{ padding: "var(--op-space-5)" }}><p className="op-kicker">{title}</p><p className="op-body" style={{ marginTop: "var(--op-space-2)" }}>{description}</p></Reveal>)}</div></Section>

      <Section><Reveal><p className="op-eyebrow">Security and governance</p><h2 className="op-heading-lg">Built for controlled enterprise intelligence.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>The current architecture verifies organisation boundaries, role-based access controls, controlled data access and evidence-linked contractual intelligence. Broader enterprise connectors, SSO, certifications and compliance claims are not presented here because they are not verified as current capabilities.</p></Reveal><div className="op-platform-tag-grid" style={{ marginTop: "var(--op-space-6)" }}>{["Organisation boundaries", "Role-based access", "Controlled data access", "Auditability", "Evidence-linked intelligence"].map((item) => <span key={item} className="op-platform-tag">{item}</span>)}</div></Section>

      <Section><Reveal><p className="op-eyebrow">Aviation first</p><h2 className="op-heading-lg">Start focused. Build for scale.</h2><p className="op-body-lg" style={{ marginTop: "var(--op-space-4)" }}>Operion's first commercial focus is Aviation &amp; Aerospace. The intelligence architecture is being designed so that the same underlying principles can eventually support other industries where contracts, operations, financial exposure and external events interact.</p></Reveal><Flow items={["Today: Aviation Contract Intelligence", "Next: Predictive Aviation Intelligence", "Future: Scenario Intelligence", "Long-term: Contract Digital Twin"]} /><div className="op-enterprise-coming" style={{ marginTop: "var(--op-space-6)" }}><Status>Coming soon</Status><span>Maritime &amp; Shipping</span><span>Offshore &amp; Energy</span><span>Rail &amp; Logistics</span></div></Section>

      <Section><Reveal><p className="op-eyebrow">Enterprise value</p><h2 className="op-heading-lg">Why this matters to an enterprise.</h2></Reveal><div className="op-grid op-grid-3" style={{ marginTop: "var(--op-space-6)" }}>{[["Reduce reactive work", "Find relevant contractual information faster."], ["Surface exposure", "Identify obligations, clauses and potential risk."], ["Connect decisions", "Bring contractual intelligence closer to operational and financial decisions."], ["Anticipate change", "Future intelligence can explore how external conditions could affect contracts."], ["Act earlier", "Turn intelligence into recommended mitigation."]].map(([title, description]) => <Reveal key={title} className="op-surface" style={{ padding: "var(--op-space-5)" }}><h3 className="op-heading-md">{title}</h3><p className="op-body" style={{ marginTop: "var(--op-space-2)" }}>{description}</p></Reveal>)}</div></Section>

      <Section><Reveal className="op-platform-final-cta"><p className="op-eyebrow">Enterprise Contract Intelligence</p><h2 className="op-heading-lg">See what Operion could uncover in your contracts.</h2><p className="op-body-lg" style={{ margin: "var(--op-space-4) auto var(--op-space-5)" }}>Start with the contracts you already have. Explore how Contract Intelligence can help your organisation understand clauses, obligations, exposure and the decisions they affect.</p><div className="op-row" style={{ justifyContent: "center", flexWrap: "wrap" }}><Button to="/demo" variant="primary">Request a Demo</Button><Button to="/platform" variant="secondary">Explore the Platform</Button></div></Reveal></Section>
    </>
  );
}
