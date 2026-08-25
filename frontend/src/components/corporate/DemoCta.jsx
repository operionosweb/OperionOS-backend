import React from "react";
import { Section } from "../ui/Layout";
import Button from "../ui/Button";
import Reveal from "../ui/Reveal";

export default function DemoCta() {
  return (
    <Section>
      <Reveal style={{ textAlign: "center" }}>
        <h2 className="op-heading-lg" style={{ marginBottom: "var(--op-space-5)" }}>
          Don't wait for the penalty to tell you there was a risk.
        </h2>
        <p className="op-body-lg" style={{ margin: "0 auto var(--op-space-5)" }}>
          Explore how Operion can turn your contracts into operational intelligence.
        </p>
        <div className="op-row" style={{ justifyContent: "center", flexWrap: "wrap" }}>
          <Button to="/demo" variant="primary">Request a Demo</Button>
          <Button to="/scenarios" variant="secondary">Bring us a Scenario</Button>
        </div>
      </Reveal>
    </Section>
  );
}
