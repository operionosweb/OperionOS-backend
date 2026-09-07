import React from "react";
import { Check, Plane } from "lucide-react";
import { SalesCta, SalesFlow, SalesHero, SalesSection } from "../components/corporate/SalesPage";
import Reveal from "../components/ui/Reveal";

const AVIATION_IMAGE = "https://images.unsplash.com/photo-1570710891163-6d3b5c47248b?auto=format&fit=crop&w=1800&q=84";
const SEGMENTS = [
  ["Airlines", ["Aircraft leases", "Engine and maintenance agreements", "Supplier and airport contracts", "Ground handling", "Operational services"]],
  ["Aircraft Leasing Companies", ["Lease agreements", "Maintenance obligations", "Return conditions", "Payment obligations", "Technical requirements"]],
  ["MRO Organisations", ["Maintenance agreements", "Customer obligations", "Supplier contracts", "Turnaround commitments", "Service levels"]],
  ["Ground Handling Providers", ["Service agreements", "Airport contracts", "SLA obligations", "Operational responsibilities", "Performance exposure"]],
  ["Airport Operators", ["Airline agreements", "Concession agreements", "Ground service contracts", "Infrastructure obligations"]],
  ["Aviation Consultancies", ["Accelerated contract review", "Aviation project risk", "Evidence-backed analysis", "Client decision support"]],
];
const CONSEQUENCE_FLOW = ["External event", "Operational consequence", "Affected contracts", "Financial exposure", "Recommended action"];
const LEASE_SCENARIO = ["Maintenance return clause", "Aircraft return obligation", "Condition not evidenced", "Contractual exposure", "Potential financial impact", "Review evidence and remedy options"];

export default function AviationCommercial() {
  return <main className="op-sales-page">
    <SalesHero eyebrow="AVIATION" title="Contract Intelligence Built for Aviation" copy="Aviation contracts connect aircraft, operations, suppliers, maintenance, financing and financial exposure. Operion helps organisations understand those connections." image={AVIATION_IMAGE} imageAlt="Commercial aircraft operating within the aviation ecosystem" />

    <SalesSection eyebrow="WHO OPERION SERVES" title="One industry. Interconnected contractual complexity." copy="Operion is shaped around the agreements that keep aircraft, services and commercial relationships moving.">
      <Reveal className="op-sales-segment-grid">{SEGMENTS.map(([title, items]) => <article key={title}><Plane size={20} /><h3>{title}</h3><ul>{items.map((item) => <li key={item}><Check size={13} />{item}</li>)}</ul></article>)}</Reveal>
    </SalesSection>

    <SalesSection eyebrow="WHY IT MATTERS" title="Aviation contracts don't operate in isolation." copy="Aircraft operations, suppliers, maintenance, fuel, weather, finance and geopolitics can all influence contractual outcomes." dark>
      <SalesFlow items={CONSEQUENCE_FLOW} dark />
      <p className="op-sales-disclosure">The event-to-contract connection represents Operion's direction toward Predictive Contract Intelligence. External integrations are not presented as universally live.</p>
    </SalesSection>

    <SalesSection eyebrow="AVIATION-SPECIFIC EXAMPLE" title="An aircraft lease contains a maintenance return condition." copy="Operion helps a team follow the contractual requirement through the operational event, potential exposure and the action that should be considered next.">
      <Reveal className="op-sales-lease-scenario">{LEASE_SCENARIO.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></div>)}</Reveal>
    </SalesSection>

    <SalesSection eyebrow="AVIATION DECISION SUPPORT" title="See the relationship behind the risk." copy="Operion connects contractual evidence with obligations, potential consequences and the actions a team may consider.">
      <Reveal className="op-sales-evidence-strip"><div><span>Contract evidence</span><strong>Clause 8.4 · Service availability</strong></div><div><span>Operational context</span><strong>Performance threshold at risk</strong></div><div><span>Decision support</span><strong>Review remedy and notice requirements</strong></div></Reveal>
    </SalesSection>

    <SalesCta title="Make your aviation contracts intelligent." copy="Bring a contract, an operational challenge or a question about exposure." />
  </main>;
}
