import React from "react";
import { Section } from "../ui/Layout";
import Reveal from "../ui/Reveal";

const CAPABILITIES = [
  { title: "Contract understanding", desc: "Documents, versions and analysis runs form a single traceable record." },
  { title: "Clause extraction", desc: "Deterministic segmentation identifies clause structure and hierarchy." },
  { title: "Obligation identification", desc: "What each party is required to do, and when." },
  { title: "Deadline detection", desc: "Notice periods, renewal dates and time-bound commitments." },
  { title: "Risk identification", desc: "Contractual exposure surfaced from the clauses that create it." },
  { title: "Evidence-backed intelligence", desc: "Every finding links back to the exact source text it came from." },
  { title: "Search", desc: "Find language and clauses across your contract portfolio." },
  { title: "Recommendations", desc: "Clear next actions grounded in the underlying evidence." },
];

export default function ContractIntelligenceSection() {
  return (
    <Section id="intelligence">
      <Reveal>
        <span className="op-badge op-badge-live" style={{ marginBottom: "var(--op-space-4)" }}>
          Current priority
        </span>
        <h2 className="op-heading-lg" style={{ marginBottom: "var(--op-space-3)" }}>
          Contract Intelligence
        </h2>
        <p className="op-body-lg" style={{ marginBottom: "var(--op-space-7)" }}>
          The foundation Operion is building first — before prediction, before
          simulation. Every contract becomes structured, evidence-linked
          intelligence.
        </p>
      </Reveal>

      <div className="op-grid op-grid-3">
        {CAPABILITIES.map((item) => (
          <Reveal key={item.title} className="op-surface" style={{ padding: "var(--op-space-5)" }}>
            <h3 className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>
              {item.title}
            </h3>
            <p className="op-body">{item.desc}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
