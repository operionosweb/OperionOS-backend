import React from "react";
import { Section } from "../ui/Layout";
import Reveal from "../ui/Reveal";
import Button from "../ui/Button";

const SEGMENTS = ["Aircraft leasing", "MRO", "PBH", "Ground handling", "Supplier management", "Operational disruption"];

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
            Aviation contracts are interconnected with operational reality. A
            delay, crew disruption, AOG event, supplier failure, weather event
            or fuel price movement can trigger contractual consequences.
            Operion is being built to help aviation organisations understand
            those connections before potential exposure becomes realised cost.
          </p>
          <Button to="/aviation" variant="secondary" style={{ marginTop: "var(--op-space-5)" }}>Explore Aviation</Button>
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
                <span style={{ color: "var(--op-text-faint)", fontSize: "0.85rem" }}>Aviation first</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
