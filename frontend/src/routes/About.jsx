import React from "react";
import { ArrowRight, Linkedin } from "lucide-react";
import Button from "../components/ui/Button";
import Reveal from "../components/ui/Reveal";
import { Container } from "../components/ui/Layout";
import AeroHero from "../components/corporate/AeroHero";
import founderPhoto from "../assets/brand/founder-meelis-paloson.jpg";

const EVOLUTION = [
  ["01", "Available foundation", "Contract Intelligence", "Understand what is written.", ["Contract ingestion and clause extraction", "Obligations, deadlines and risk identification", "Evidence-linked summaries and contract search", "Recommendations for human review"]],
  ["02", "In development", "Aviation Intelligence", "Understand what surrounds the contract.", ["Aircraft and fleet relationships", "Suppliers and counterparties", "Airports and aviation dependencies", "Contract-to-asset relationships and relevant external conditions"]],
  ["03", "In development", "Predictive Risk Intelligence", "Understand what could happen.", ["Fuel prices, interest rates and inflation", "Currency movements", "Weather and geopolitical developments", "Supplier risk and potential contractual exposure"]],
  ["04", "Strategic roadmap", "Scenario Simulation", "Explore alternative futures.", ["Economic and fuel-price shocks", "Aircraft delivery delays", "Supplier failures", "Weather, operational and geopolitical disruption"]],
];
const PRINCIPLES = [
  ["Understand before predicting", "Reliable intelligence begins with understanding the underlying contract."],
  ["Evidence before assumptions", "Findings must be traceable to source documents and relevant evidence."],
  ["Intelligence before complexity", "Build meaningful Contract Intelligence before introducing advanced simulations."],
  ["Recommendations, not just alerts", "Identifying a risk is the beginning. Help people understand what they can do about it."],
  ["Human judgement remains essential", "AI should support important decisions, not pretend to replace human accountability."],
  ["Depth before breadth", "Build deep aviation intelligence before expanding to other industries."],
];
const CONNECTIONS = [
  ["Contracts", "Begin with clauses, obligations and financial commitments in the source agreement."],
  ["Intelligence", "Extract findings and keep a traceable path back to the evidence."],
  ["Aviation context", "Connect aircraft, suppliers, counterparties and operational dependencies."],
  ["Risk", "Investigate how relevant external developments could affect those commitments."],
  ["Financial exposure", "Understand potential consequences without presenting assumptions as established losses."],
  ["Action", "Recommend a next step, with judgement and accountability remaining with people."],
];

function AboutSection({ label, title, copy, children, dark = false, className = "" }) {
  return <section className={`op-about-section${dark ? " op-about-dark" : ""} ${className}`.trim()}><Container>
    <Reveal className="op-about-intro"><p className="op-about-label">{label}</p><h2>{title}</h2>{copy && <p className="op-about-copy">{copy}</p>}</Reveal>
    {children}
  </Container></section>;
}

export default function About() {
  return <div className="op-about-page">
    <AeroHero eyebrow="ABOUT OPERION" title="What happens to my contracts if the world changes tomorrow?"
      copy="Contracts are not static documents. They are living business commitments exposed to a constantly changing world. That is why we are building Operion."/>

    <AboutSection label="WHY OPERION EXISTS" title="Contracts don't exist in isolation."
      copy="Aviation is built on an interconnected network of commercial commitments. But the agreements behind it are often analysed separately.">
      <Reveal className="op-about-story-grid">
        <div><p>An airline may depend on aircraft leases, engine maintenance, fuel, insurance, financing, airport agreements, ground handling and supplier relationships. Each agreement contains obligations, deadlines, dependencies and financial consequences.</p>
          <p>The challenge is not simply knowing what a contract says. It is understanding what happens when circumstances change.</p></div>
        <div><p>A fuel-price increase, delayed aircraft delivery, supplier failure, interest-rate movement or geopolitical disruption can affect several contractual relationships at once.</p>
          <p>Teams frequently have to connect these consequences manually, across documents, spreadsheets, departments and disconnected systems. That is the problem Operion is being built to address.</p></div>
      </Reveal>
    </AboutSection>

    <AboutSection label="THE IDEA BEHIND OPERION" title="From managing contracts to understanding their consequences."
      copy="Operion is an AI-powered Contract Intelligence and Predictive Risk Intelligence platform, starting with aviation. It is not another Contract Lifecycle Management platform." dark>
      <Reveal className="op-about-thesis"><p>Traditional contract management primarily organises and administers agreements. We are building an intelligence layer that understands their content and connects it to the world around them.</p>
        <p>First, understand what is written: clauses, obligations, deadlines, risks and financial commitments. Then connect that intelligence to aviation assets, counterparties, suppliers and relevant developments.</p>
        <strong>Not just what a contract says. What its commitments could mean for the business.</strong></Reveal>
    </AboutSection>

    <AboutSection label="AVIATION FIRST" title="Starting with one of the world's most interconnected industries."
      copy="In aviation, commercial agreements, physical assets, operational dependencies and financial commitments are closely connected.">
      <Reveal className="op-about-story-grid"><div><p>An aircraft lease can depend on maintenance performance, insurance coverage, technical records, redelivery conditions and financing arrangements. An MRO agreement can influence aircraft availability and operational commitments.</p></div>
        <div><p>Fuel prices, interest rates, foreign exchange and geopolitical developments can change the financial significance of existing agreements. Aviation needs more than another place to store contracts: it needs a better way to understand the relationships within them.</p></div></Reveal>
      <p className="op-about-focus-label">Initial focus, not a claim of existing customers</p>
      <Reveal className="op-about-aviation-grid">{["Airlines", "Aircraft leasing companies", "MRO organisations", "Aviation consultancies", "Ground handling providers", "Airport operators"].map((area, index) => <div key={area}><span>0{index + 1}</span><strong>{area}</strong></div>)}</Reveal>
    </AboutSection>

    <AboutSection label="HOW OPERION IS EVOLVING" title="Build the foundation. Then connect the possibilities."
      copy="A development progression, not four fully operational products. Every new layer must build on reliable contractual evidence." className="op-about-evolution-section">
      <div className="op-about-roadmap">{EVOLUTION.map(([number, status, title, purpose, items]) => <Reveal as="article" key={number}>
        <header><span>{number}</span><small>{status}</small></header><h3>{title}</h3><p>{purpose}</p><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
      </Reveal>)}</div>
      <p className="op-about-maturity-note">Prepared aviation and scenario demonstrations illustrate intended relationships; they are not licensed live feeds or validated forecasts. Contract Digital Twins remain a longer-term ambition.</p>
    </AboutSection>

    <section className="op-about-section op-about-founder" aria-labelledby="founder-heading"><Container>
      <Reveal className="op-founder-grid">
        <figure><img src={founderPhoto} width="400" height="400" loading="lazy" decoding="async" alt="Meelis Paloson, founder of Operion OS, speaking into a microphone at an event."/><figcaption>Meelis Paloson · Founder, Operion OS<br/>Barcelona, Spain</figcaption></figure>
        <div className="op-founder-story"><p className="op-about-label">THE FOUNDER BEHIND THE VISION</p><h2 id="founder-heading">Meelis Paloson</h2><p className="op-founder-title">Founder, Operion OS · Barcelona, Spain</p>
          <blockquote>“Why do organisations have so much technology to manage contracts, but so little technology to understand what happens because of them?”</blockquote>
          <p>Operion started with a question that I couldn't stop thinking about. For years, I have been interested in the intersection of business, technology, entrepreneurship and the way organisations solve complex problems.</p>
          <p>My professional journey has included more than 15 years of B2B sales experience, building commercial relationships and working with people and businesses across different markets.</p>
          <p>I am originally from Estonia and moved to Barcelona in 2004. Building a life and career across different cultures has shaped how I approach business, communication and problem-solving.</p>
          <details className="op-founder-more"><summary>Read the story behind Operion</summary>
            <p>My entrepreneurial journey has also included founding Petinder, a technology platform created around a problem I identified in the pet adoption and animal welfare ecosystem.</p>
            <p>That experience reinforced something I strongly believe: meaningful technology starts by understanding a real problem, not by simply adding more features.</p>
            <p>With Operion, I wanted to apply that thinking to a much more complex commercial environment. Aviation contracts contain obligations, dependencies, risks and financial consequences that extend far beyond the documents themselves.</p>
            <p>I believe the next generation of contract technology must be able to understand those relationships. That is why we are starting with Contract Intelligence, building towards Predictive Risk Intelligence and ultimately Scenario Simulation.</p>
            <p>I am also continuing to deepen my understanding of artificial intelligence and its practical business applications through my studies in Generative AI at NETT Digital School.</p>
            <p>My ambition is not to build another contract management platform. It is to build technology that helps organisations understand what could happen next — and make better decisions before risks materialise. That is the vision behind Operion.</p>
          </details>
          <a className="op-founder-link" href="https://www.linkedin.com/in/meelispaloson" target="_blank" rel="noopener noreferrer"><Linkedin size={18}/>Connect with Meelis on LinkedIn<ArrowRight size={16}/></a>
        </div>
      </Reveal>
    </Container></section>

    <AboutSection label="OUR PHILOSOPHY" title="Principles for useful, accountable intelligence." dark>
      <div className="op-about-principles">{PRINCIPLES.map(([title, copy], index) => <Reveal key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{copy}</p></div></Reveal>)}</div>
    </AboutSection>

    <AboutSection label="WHAT MAKES OPERION DIFFERENT" title="Not another place to manage contracts. A new way to understand them."
      copy="We are designing the connections between the source agreement, its aviation context, potential consequences and recommended actions.">
      <Reveal><ol className="op-about-intelligence-path">{CONNECTIONS.map(([title, copy], index) => <li key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></li>)}</ol></Reveal>
    </AboutSection>

    <AboutSection label="THE LONG-TERM VISION" title="Understand today. Anticipate tomorrow." dark
      copy="Imagine a fuel-price shock. A connected view should help teams ask the questions that matter before deciding how to respond.">
      <Reveal className="op-about-vision"><ul>{["Which agreements are affected?", "Which clauses contain escalation mechanisms?", "Which suppliers are exposed?", "Which financial commitments may change?", "Which obligations could become more expensive?", "What actions could reduce the exposure?"].map((question) => <li key={question}>{question}</li>)}</ul>
        <p>This is the direction we are building towards, not a claim of an operational forecasting engine. Today's foundation is evidence-linked Contract Intelligence; predictive risk and simulation require further development and validation.</p></Reveal>
    </AboutSection>

    <section className="op-about-cta"><Container><Reveal><p className="op-about-label">START WITH UNDERSTANDING</p><h2>A clearer view of your commitments.</h2><p>Explore the foundation. Help shape what comes next.</p>
      <div className="oaero-hero-actions"><Button to="/product">Explore Operion<ArrowRight size={16}/></Button><Button to="/request-demo" variant="secondary">Discuss Aviation Contract Intelligence<ArrowRight size={16}/></Button></div>
    </Reveal></Container></section>
  </div>;
}
