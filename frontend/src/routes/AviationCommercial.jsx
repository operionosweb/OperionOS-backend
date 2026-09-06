import React from "react";
import { Check, Plane } from "lucide-react";
import { SalesCta, SalesFlow, SalesHero, SalesSection } from "../components/corporate/SalesPage";
import Reveal from "../components/ui/Reveal";

const AVIATION_IMAGE = "https://images.unsplash.com/photo-1570710891163-6d3b5c47248b?auto=format&fit=crop&w=1800&q=84";
const SEGMENTS = [
  ["Airlines", ["Supplier obligations", "Fleet-related exposure", "SLA commitments", "MRO and ground handling agreements", "Financial exposure"]],
  ["Aircraft Leasing Companies", ["Lease obligations", "Maintenance requirements", "Return conditions", "Commercial exposure", "Contractual dependencies"]],
  ["MRO Organisations", ["Service-level commitments", "Supplier agreements", "Parts-related obligations", "Performance requirements", "Financial exposure"]],
  ["Ground Handling & Aviation Services", ["Service obligations", "SLAs and penalty structures", "Operational dependencies", "Supplier and customer exposure"]],
];
const CONSEQUENCE_FLOW = ["External event", "Operational consequence", "Affected contracts", "Financial exposure", "Recommended action"];

export default function AviationCommercial() {
  return <main className="op-sales-page">
    <SalesHero eyebrow="AVIATION" title="Contract Intelligence for Aviation" copy="Built for organisations where contractual complexity directly affects operational performance and financial outcomes." image={AVIATION_IMAGE} imageAlt="Commercial aircraft operating within the aviation ecosystem" />

    <SalesSection eyebrow="WHO OPERION SERVES" title="One industry. Interconnected contractual complexity." copy="Operion is shaped around the agreements that keep aircraft, services and commercial relationships moving.">
      <Reveal className="op-sales-segment-grid">{SEGMENTS.map(([title, items]) => <article key={title}><Plane size={20} /><h3>{title}</h3><ul>{items.map((item) => <li key={item}><Check size={13} />{item}</li>)}</ul></article>)}</Reveal>
    </SalesSection>

    <SalesSection eyebrow="WHY IT MATTERS" title="Aviation contracts don't operate in isolation." copy="Aircraft operations, suppliers, maintenance, fuel, weather, finance and geopolitics can all influence contractual outcomes." dark>
      <SalesFlow items={CONSEQUENCE_FLOW} dark />
      <p className="op-sales-disclosure">The event-to-contract connection represents Operion's direction toward Predictive Contract Intelligence. External integrations are not presented as universally live.</p>
    </SalesSection>

    <SalesSection eyebrow="FINANCIAL EXPOSURE" title="Understand the financial consequences before they materialise." copy="A structured view helps decision-makers see the scale of potential exposure and the obligations that deserve attention.">
      <Reveal className="op-sales-metric-panel"><p>Illustrative scenario · prepared data</p><div><article><strong>€2.4M</strong><span>Potential exposure</span></article><article><strong>18</strong><span>Contracts affected</span></article><article><strong>7</strong><span>High-risk obligations</span></article><article><strong>5</strong><span>Recommended actions</span></article></div></Reveal>
    </SalesSection>

    <SalesSection eyebrow="AVIATION DECISION SUPPORT" title="See the relationship behind the risk." copy="Operion connects contractual evidence with obligations, potential consequences and the actions a team may consider.">
      <Reveal className="op-sales-evidence-strip"><div><span>Contract evidence</span><strong>Clause 8.4 · Service availability</strong></div><div><span>Operational context</span><strong>Performance threshold at risk</strong></div><div><span>Decision support</span><strong>Review remedy and notice requirements</strong></div></Reveal>
    </SalesSection>

    <SalesCta title="Make your aviation contracts intelligent." copy="Bring a contract, an operational challenge or a question about exposure." />
  </main>;
}
