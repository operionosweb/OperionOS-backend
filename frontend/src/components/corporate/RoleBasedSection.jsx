import React from "react";
import { Section } from "../ui/Layout";
import Reveal from "../ui/Reveal";

const ROLES = [
  ["CEO", "Strategic exposure and emerging risks."],
  ["CFO", "Financial exposure and potential revenue leakage."],
  ["Legal", "Contractual obligations, liability and risk."],
  ["Procurement", "Supplier performance and contractual exposure."],
  ["Operations", "Operational events and potential contractual consequences."],
];

export default function RoleBasedSection() {
  return (
    <Section id="roles">
      <Reveal>
        <span className="op-badge op-badge-future" style={{ marginBottom: "var(--op-space-4)" }}>
          Role-Based Intelligence — Roadmap
        </span>
        <h2 className="op-heading-lg" style={{ marginBottom: "var(--op-space-4)" }}>
          The same company. Different decisions. Different intelligence.
        </h2>
        <p className="op-body-lg" style={{ marginBottom: "var(--op-space-7)" }}>
          A CEO, CFO, Legal Counsel, Procurement leader and Operations team may
          work with the same organisation, but they are responsible for
          different decisions. Operion is designed to combine role-based access
          with role-based intelligence, surfacing the priorities most relevant
          to each user's responsibilities.
        </p>
      </Reveal>

      <div className="op-grid op-grid-3 op-home-role-grid">
        {ROLES.map(([role, description]) => (
          <Reveal key={role} className="op-surface" style={{ padding: "var(--op-space-5)" }}>
            <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>{role}</p>
            <p className="op-body">{description}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
