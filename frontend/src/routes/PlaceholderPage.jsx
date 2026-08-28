import React from "react";
import { Section, Container } from "../components/ui/Layout";
import Reveal from "../components/ui/Reveal";
import Button from "../components/ui/Button";

const HERO = "https://images.unsplash.com/photo-1521727857535-28d204a2f5a7?auto=format&fit=crop&w=1800&q=82";

export default function PlaceholderPage({ title, description }) {
  return (
    <>
      <section className="op-page-hero op-cinematic-hero" style={{ backgroundImage: `url(${HERO})` }}>
        <div className="op-page-hero-overlay">
          <Container>
            <Reveal>
              <p className="op-stitch-label">OPERION / AVIATION INTELLIGENCE</p>
              <h1>{title}</h1>
              <p>{description}</p>
              <Button to="/demo" variant="primary">Request a Demo <span aria-hidden="true">↗</span></Button>
            </Reveal>
          </Container>
        </div>
      </section>

      <Section>
        <Reveal>
          <p className="op-eyebrow">Operion</p>
          <h1 className="op-heading-lg" style={{ marginBottom: "var(--op-space-4)" }}>
            {title}
          </h1>
          <p className="op-body-lg">{description}</p>
        </Reveal>
      </Section>
    </>
  );
}
