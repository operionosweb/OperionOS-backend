import React from "react";
import { Section } from "../ui/Layout";
import Reveal from "../ui/Reveal";

export default function FutureVisionSection() {
  return (
    <Section>
      <div className="op-surface op-home-roadmap" style={{ padding: "var(--op-space-8)" }}>
        <Reveal>
          <span className="op-badge op-badge-future" style={{ marginBottom: "var(--op-space-4)" }}>
            Future / Roadmap
          </span>
          <h2 className="op-heading-lg" style={{ maxWidth: 720, margin: "0 auto var(--op-space-4)" }}>
            Reason about uncertainty, not just certainty.
          </h2>
          <p className="op-body-lg" style={{ margin: "0 auto" }}>
            Real-world operations rarely follow a single predictable path.
            Operion's intelligence architecture is being developed to reason
            about uncertainty using probabilistic approaches, Bayesian
            reasoning, Monte Carlo methods and quantum-computing-inspired
            approaches to complex simulation and optimisation.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
