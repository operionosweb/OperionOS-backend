import React from "react";
import { Section } from "../ui/Layout";
import Reveal from "../ui/Reveal";

const FRICTIONS = [
  { title: "Contract reality", text: "Obligations, thresholds, rights, penalties and financial consequences are defined in agreements." },
  { title: "Operational reality", text: "Events change constantly across aircraft, suppliers, crews, routes and service delivery." },
  { title: "The gap", text: "When these worlds are disconnected, a contractual consequence can surface only after the triggering event has happened." },
];

export default function ProblemSection() {
  return (
    <Section>
      <div className="op-grid op-grid-2" style={{ alignItems: "start" }}>
        <Reveal>
          <p className="op-eyebrow">The problem</p>
          <h2 className="op-heading-lg" style={{ marginBottom: "var(--op-space-4)" }}>
            Your contracts know what could happen. Your operations know what is happening.
          </h2>
          <p className="op-body-lg">
            Contracts define obligations, thresholds, rights, penalties and
            financial consequences. Operations are constantly changing. The
            problem is that these two worlds are often disconnected.
          </p>
        </Reveal>

        <Reveal>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--op-space-3)" }}>
            {FRICTIONS.map((item) => (
              <li
                key={item.title}
                className="op-surface"
                style={{ padding: "var(--op-space-4) var(--op-space-5)", color: "var(--op-text-muted)" }}
              >
                <strong style={{ display: "block", color: "var(--op-color-text-primary)", marginBottom: "var(--op-space-1)" }}>{item.title}</strong>
                {item.text}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  );
}
