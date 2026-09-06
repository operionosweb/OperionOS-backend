import React from "react";
import { ArrowDown, ArrowRight, Check } from "lucide-react";
import { SalesCta, SalesFlow, SalesHero, SalesSection } from "../components/corporate/SalesPage";
import Reveal from "../components/ui/Reveal";
import { trackEvent } from "../components/analytics/Analytics";
import { DemoDataProvider } from "../demo/DemoDataProvider";
import DemoDashboard from "./demo/DemoDashboard";

const PRODUCT_IMAGE = "https://images.unsplash.com/photo-1589782182703-2aaa69037b5b?auto=format&fit=crop&w=2000&q=82";
const CAPABILITIES = ["Clauses", "Obligations", "Deadlines", "Financial terms", "Service levels", "Penalties", "Dependencies", "Risks"];
const WORKFLOW = [
  { title: "Understand", copy: "Operion processes complex aviation contracts." },
  { title: "Extract", copy: "Obligations, clauses, deadlines, financial terms and dependencies are identified." },
  { title: "Connect", copy: "Contract intelligence is connected with operational and financial context." },
  { title: "Assess", copy: "Risks and potential exposure become visible." },
  { title: "Recommend", copy: "Operion helps identify appropriate actions." },
];
const IMPACT = ["SLA obligation", "Operational disruption", "Potential contractual penalty", "Financial exposure", "Recommended action"];

export default function Product() {
  return <main className="op-sales-page">
    <SalesHero eyebrow="OPERION PRODUCT" title="Contract Intelligence for Aviation" copy="Transform complex aviation contracts into structured operational, financial and risk intelligence." image={PRODUCT_IMAGE} imageAlt="Aviation contract documentation under professional review">
      <a className="op-btn op-btn-secondary" href="#workflow" onClick={() => trackEvent("how_it_works_click", { location: "product_hero" })}>See How It Works <ArrowDown size={16} /></a>
    </SalesHero>

    <section className="op-sales-product-stage" aria-label="Operion prepared demonstration interface">
      <div className="op-sales-product-stage-copy"><span>Prepared demonstration interface</span><strong>A real view of the Operion contract intelligence workspace.</strong><a href="/demo/dashboard">Explore the live demo <ArrowRight size={15} /></a></div>
      <div className="op-sales-live-product"><DemoDataProvider><DemoDashboard headingLevel="h2" /></DemoDataProvider></div>
    </section>

    <SalesSection eyebrow="UNDERSTAND" title="Understand what your contracts actually contain." copy="Operion helps teams find the contractual information that governs operational commitments and commercial exposure.">
      <Reveal className="op-sales-check-grid">{CAPABILITIES.map((item) => <span key={item}><Check size={16} />{item}</span>)}</Reveal>
    </SalesSection>

    <SalesSection eyebrow="CONTRACT INTELLIGENCE WORKFLOW" title="A clear path from document to decision." id="workflow" className="op-sales-workflow-section">
      <div id="workflow"><SalesFlow items={WORKFLOW} /></div>
    </SalesSection>

    <SalesSection eyebrow="FINANCIAL IMPACT" title="From contractual language to financial impact." copy="A contract clause only becomes truly valuable when an organisation understands what it means operationally and financially." dark>
      <Reveal className="op-sales-impact-example"><div><span>Illustrative scenario</span><strong>Contract-to-impact reasoning</strong></div><ol>{IMPACT.map((item) => <li key={item}>{item}</li>)}</ol></Reveal>
    </SalesSection>

    <SalesSection eyebrow="THE DIFFERENCE" title="More than contract storage." copy="Operion is designed to help organisations understand what contracts mean, not simply where they are stored.">
      <Reveal className="op-sales-comparison"><div><span>Traditional approach</span><strong>Store → Search → Manage</strong></div><div><span>Operion</span><strong>Understand → Monitor → Assess → Recommend</strong></div></Reveal>
    </SalesSection>

    <SalesSection eyebrow="FUTURE EVOLUTION" title="From Contract Intelligence to Predictive Intelligence." copy="Operion is evolving toward understanding how changing external conditions can affect contractual exposure.">
      <Reveal className="op-sales-roadmap"><p>Fuel prices</p><p>Interest rates</p><p>Exchange rates</p><p>Weather</p><p>Supplier risk</p><p>Geopolitical events</p><span>Strategic direction · not presented as universally live functionality</span></Reveal>
    </SalesSection>

    <SalesCta title="See what Operion can uncover in your contracts." />
  </main>;
}
