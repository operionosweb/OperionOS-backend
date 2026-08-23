import React from "react";
import { Section } from "../ui/Layout";
import Reveal from "../ui/Reveal";

const STAGES = [
  { label: "Understand", status: "live", desc: "Structured clauses, obligations and evidence." },
  { label: "Monitor", status: "live", desc: "Deadlines and risk surfaced from your contracts." },
  { label: "Predict", status: "future", desc: "Forward-looking exposure as circumstances change." },
  { label: "Simulate", status: "future", desc: "Model contractual outcomes before they happen." },
];

export default function ProgressionSection() {
  return (
    <Section>
      <Reveal>
        <p className="op-eyebrow">Product progression</p>
        <h2 className="op-heading-lg" style={{ marginBottom: "var(--op-space-7)" }}>
          Understand → Monitor → Predict → Simulate
        </h2>
      </Reveal>

      <div className="op-grid op-grid-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {STAGES.map((stage, index) => (
          <Reveal key={stage.label} className="op-surface" style={{ padding: "var(--op-space-5)", position: "relative" }}>
            <span
              className={stage.status === "live" ? "op-badge op-badge-live" : "op-badge op-badge-future"}
              style={{ marginBottom: "var(--op-space-3)" }}
            >
              {stage.status === "live" ? "Available now" : "Coming next"}
            </span>
            <h3 className="op-heading-md" style={{ margin: "var(--op-space-3) 0" }}>
              {index + 1}. {stage.label}
            </h3>
            <p className="op-body">{stage.desc}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
