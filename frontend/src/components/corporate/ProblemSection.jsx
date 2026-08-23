import React from "react";
import { Section } from "../ui/Layout";
import Reveal from "../ui/Reveal";

const FRICTIONS = [
  "Obligations buried in clause text nobody re-reads",
  "Deadlines tracked in spreadsheets, if at all",
  "Contractual risk discovered only after it materializes",
  "Fragmented documents, versions and amendments",
  "No way to see future exposure until it becomes a present problem",
];

export default function ProblemSection() {
  return (
    <Section>
      <div className="op-grid op-grid-2" style={{ alignItems: "start" }}>
        <Reveal>
          <p className="op-eyebrow">The problem</p>
          <h2 className="op-heading-lg" style={{ marginBottom: "var(--op-space-4)" }}>
            Contracts today are static documents.
            <br />
            Operion turns them into intelligence.
          </h2>
          <p className="op-body-lg">
            Aviation contracts govern maintenance, leasing, insurance and
            operations — yet most organizations still treat them as PDFs to be
            filed, not structured intelligence to be acted on.
          </p>
        </Reveal>

        <Reveal>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--op-space-3)" }}>
            {FRICTIONS.map((item) => (
              <li
                key={item}
                className="op-surface"
                style={{ padding: "var(--op-space-4) var(--op-space-5)", color: "var(--op-text-muted)" }}
              >
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  );
}
