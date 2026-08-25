import React from "react";
import { Section } from "../ui/Layout";
import Reveal from "../ui/Reveal";

const STAGES = [
  { label: "Now", status: "live", title: "Contract Intelligence", desc: "Understand agreements, clauses and obligations." },
  { label: "Developing", status: "future", title: "AI Insights and Financial Intelligence", desc: "Extend structured contract understanding toward exposure and decision support." },
  { label: "Future", status: "future", title: "Real-Time and Scenario Intelligence", desc: "Connect operational events to contractual consequences and probabilities." },
  { label: "Long-term", status: "future", title: "Continuous Decision Intelligence", desc: "Build toward a Contract Digital Twin architecture." },
];

export default function ProgressionSection() {
  return (
    <Section>
      <Reveal>
        <p className="op-eyebrow">Product progression</p>
        <h2 className="op-heading-lg" style={{ marginBottom: "var(--op-space-7)" }}>
          From understanding contracts to understanding what happens next.
        </h2>
      </Reveal>

      <div className="op-grid op-home-evolution-grid">
        {STAGES.map((stage, index) => (
          <Reveal key={stage.label} className="op-surface" style={{ padding: "var(--op-space-5)", position: "relative" }}>
            <span
              className={stage.status === "live" ? "op-badge op-badge-live" : "op-badge op-badge-future"}
              style={{ marginBottom: "var(--op-space-3)" }}
            >
              {stage.status === "live" ? "Available now" : "Coming next"}
            </span>
            <h3 className="op-heading-md" style={{ margin: "var(--op-space-3) 0" }}>
              {stage.label}: {stage.title}
            </h3>
            <p className="op-body">{stage.desc}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
