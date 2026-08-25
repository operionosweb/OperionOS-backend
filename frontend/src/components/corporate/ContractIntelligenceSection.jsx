import React from "react";
import { Section } from "../ui/Layout";
import Reveal from "../ui/Reveal";

const CAPABILITIES = [
  { title: "Clause Intelligence", desc: "Identify and understand the clauses that define contractual rules.", status: "Current" },
  { title: "Obligations Tracker", desc: "Structure contractual commitments and required actions.", status: "Current" },
  { title: "Contract Intelligence", desc: "Transform complex agreements into structured, searchable intelligence.", status: "Current" },
  { title: "Financial Intelligence", desc: "Understand financial mechanisms and potential exposure embedded in contracts.", status: "In development" },
];

export default function ContractIntelligenceSection() {
  return (
    <Section id="intelligence">
      <Reveal>
        <span className="op-badge op-badge-live" style={{ marginBottom: "var(--op-space-4)" }}>
          Current priority
        </span>
        <h2 className="op-heading-lg" style={{ marginBottom: "var(--op-space-3)" }}>
          Everything starts with understanding the contract.
        </h2>
        <p className="op-body-lg" style={{ marginBottom: "var(--op-space-7)" }}>
          Before an organisation can predict contractual exposure, simulate
          future outcomes or recommend actions, it must first understand what
          its contracts actually say.
        </p>
      </Reveal>

      <div className="op-grid op-grid-3">
        {CAPABILITIES.map((item) => (
          <Reveal key={item.title} className="op-surface" style={{ padding: "var(--op-space-5)" }}>
            <span className={item.status === "Current" ? "op-badge op-badge-live" : "op-badge op-badge-future"} style={{ marginBottom: "var(--op-space-3)" }}>
              {item.status}
            </span>
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
