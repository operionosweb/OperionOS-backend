import React from "react";
import { Section } from "../components/ui/Layout";
import Reveal from "../components/ui/Reveal";
import AeroHero from "../components/corporate/AeroHero";

export default function PlaceholderPage({ title, description }) {
  return (
    <>
      <AeroHero eyebrow="AVIATION INTELLIGENCE" title={title} copy={description}/>

      <Section>
        <Reveal>
          <p className="op-eyebrow">Operion</p>
          <h2 className="op-heading-lg" style={{ marginBottom: "var(--op-space-4)" }}>
            {title}
          </h2>
          <p className="op-body-lg">{description}</p>
        </Reveal>
      </Section>
    </>
  );
}
