import React from "react";
import { Container } from "../ui/Layout";
import Button from "../ui/Button";
import Reveal from "../ui/Reveal";

export default function Hero() {
  return (
    <section
      style={{
        position: "relative",
        paddingTop: "var(--op-space-9)",
        paddingBottom: "var(--op-space-9)",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(91,140,255,0.16), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <Container>
        <div style={{ maxWidth: 900 }}>
          <Reveal className="op-eyebrow">Aviation Contract Intelligence</Reveal>

          <Reveal as="h1" className="op-heading-xl" style={{ marginBottom: "var(--op-space-5)" }}>
            Understand your contracts.
            <br />
            Predict your exposure.
            <br />
            Make better decisions.
          </Reveal>

          <Reveal className="op-body-lg" style={{ marginBottom: "var(--op-space-6)" }}>
            Operion OS turns aviation contracts into structured, evidence-backed
            intelligence — clauses, obligations, deadlines and risk, traced back
            to the exact source text they came from.
          </Reveal>

          <Reveal style={{ display: "flex", gap: "var(--op-space-4)", flexWrap: "wrap" }}>
            <Button to="/demo" variant="primary">Explore the Demo</Button>
            <Button to="/product" variant="secondary">Discover Operion</Button>
          </Reveal>
        </div>

        <Reveal>
          <ContractGraphic />
        </Reveal>
      </Container>
    </section>
  );
}

/* Understated spatial visual: contracts as nodes, relationships as connecting
   lines, intelligence as the highlighted node. Pure SVG, no external asset. */
function ContractGraphic() {
  return (
    <div
      className="op-surface"
      style={{
        marginTop: "var(--op-space-8)",
        padding: "var(--op-space-6)",
        overflow: "hidden",
      }}
    >
      <svg viewBox="0 0 800 220" width="100%" height="220" role="img" aria-label="Contract relationship and intelligence graphic">
        <defs>
          <linearGradient id="op-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(91,140,255,0.05)" />
            <stop offset="50%" stopColor="rgba(91,140,255,0.55)" />
            <stop offset="100%" stopColor="rgba(91,140,255,0.05)" />
          </linearGradient>
        </defs>
        {[
          [80, 40, 260, 110],
          [260, 110, 430, 60],
          [260, 110, 430, 170],
          [430, 60, 620, 100],
          [430, 170, 620, 100],
          [620, 100, 730, 50],
          [620, 100, 730, 150],
        ].map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#op-line)" strokeWidth="1.5" />
        ))}
        {[
          [80, 40, 5, "var(--op-text-faint)"],
          [260, 110, 7, "var(--op-text-muted)"],
          [430, 60, 5, "var(--op-text-faint)"],
          [430, 170, 5, "var(--op-text-faint)"],
          [620, 100, 10, "var(--op-accent)"],
          [730, 50, 4, "var(--op-text-faint)"],
          [730, 150, 4, "var(--op-text-faint)"],
        ].map(([cx, cy, r, fill], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill={fill} />
        ))}
      </svg>
    </div>
  );
}
