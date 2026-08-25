import React from "react";
import { Section } from "../components/ui/Layout";
import Reveal from "../components/ui/Reveal";

export default function PlaceholderPage({ title, description }) {
  return (
    <Section>
      <Reveal>
        <p className="op-eyebrow">Operion</p>
        <h1 className="op-heading-lg" style={{ marginBottom: "var(--op-space-4)" }}>
          {title}
        </h1>
        <p className="op-body-lg">{description}</p>
      </Reveal>
    </Section>
  );
}
