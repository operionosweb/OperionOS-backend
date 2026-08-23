import React from "react";
import { Section } from "../ui/Layout";
import Reveal from "../ui/Reveal";

const SEGMENTS = ["Airlines", "Aircraft leasing", "MRO", "Ground handling", "Airport operations"];

export default function AviationSection() {
  return (
    <Section id="aviation">
      <div className="op-grid op-grid-2" style={{ alignItems: "center" }}>
        <Reveal>
          <p className="op-eyebrow">Why aviation first</p>
          <h2 className="op-heading-lg" style={{ marginBottom: "var(--op-space-4)" }}>
            Aviation contracts are dense, technical, and high-stakes.
          </h2>
          <p className="op-body-lg">
            Lease agreements, maintenance reserves, insurance terms and
            operational obligations carry real financial and safety exposure.
            Operion starts here because the complexity is highest — and the
            value of getting it right is greatest.
          </p>
        </Reveal>

        <Reveal>
          <div style={{ display: "grid", gap: "var(--op-space-3)" }}>
            {SEGMENTS.map((segment) => (
              <div
                key={segment}
                className="op-surface"
                style={{
                  padding: "var(--op-space-4) var(--op-space-5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>{segment}</span>
                <span style={{ color: "var(--op-text-faint)", fontSize: "0.85rem" }}>Target segment</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
