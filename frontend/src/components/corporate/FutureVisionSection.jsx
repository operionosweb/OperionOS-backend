import React from "react";
import { Section } from "../ui/Layout";
import Reveal from "../ui/Reveal";

export default function FutureVisionSection() {
  return (
    <Section>
      <div className="op-surface" style={{ padding: "var(--op-space-8)", textAlign: "center" }}>
        <Reveal>
          <span className="op-badge op-badge-future" style={{ marginBottom: "var(--op-space-4)" }}>
            Next evolution — not yet built
          </span>
          <h2 className="op-heading-lg" style={{ maxWidth: 720, margin: "0 auto var(--op-space-4)" }}>
            What happens to my contracts if the world changes tomorrow?
          </h2>
          <p className="op-body-lg" style={{ margin: "0 auto" }}>
            Once Contract Intelligence is solid, Operion extends into
            Predictive Risk Intelligence and Scenario Simulation — modeling
            how fuel prices, regulation, counterparty risk and market shifts
            ripple through your contractual obligations. This is the
            direction we are building toward, not a capability available
            today.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
