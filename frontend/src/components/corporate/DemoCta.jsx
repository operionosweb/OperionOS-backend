import React from "react";
import { Section } from "../ui/Layout";
import Button from "../ui/Button";
import Reveal from "../ui/Reveal";

export default function DemoCta() {
  return (
    <Section>
      <Reveal style={{ textAlign: "center" }}>
        <h2 className="op-heading-lg" style={{ marginBottom: "var(--op-space-5)" }}>
          See Contract Intelligence in action
        </h2>
        <Button to="/demo" variant="primary">Explore the Demo</Button>
      </Reveal>
    </Section>
  );
}
