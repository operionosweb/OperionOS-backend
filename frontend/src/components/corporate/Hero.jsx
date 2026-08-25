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
          <Reveal className="op-eyebrow">Contract Intelligence for operational industries</Reveal>

          <Reveal as="h1" className="op-heading-xl" style={{ marginBottom: "var(--op-space-5)" }}>
            Turn contracts into operational intelligence.
          </Reveal>

          <Reveal className="op-body-lg" style={{ marginBottom: "var(--op-space-6)" }}>
            Your contracts contain the rules that determine obligations, costs,
            rights, penalties and financial consequences. Your operations are
            constantly changing. Operion is building an intelligence layer that
            connects the two, helping organisations understand risk and act
            before potential losses become realised costs.
          </Reveal>

          <Reveal style={{ display: "flex", gap: "var(--op-space-4)", flexWrap: "wrap" }}>
            <Button to="/demo" variant="primary">Request a Demo</Button>
            <Button to="/platform" variant="secondary">Explore the Platform</Button>
          </Reveal>
        </div>

        <Reveal>
          <ContractGraphic />
        </Reveal>
      </Container>
    </section>
  );
}

function ContractGraphic() {
  return (
    <div className="op-home-flow" aria-label="Contract to operational intelligence flow">
      {["Contract", "Clauses", "Obligations", "Events", "Risk", "Financial impact", "Action"].map((label, index) => (
        <React.Fragment key={label}>
          <div className={index === 0 ? "op-home-flow-node op-home-flow-node-active" : "op-home-flow-node"}>
            <span className="op-kicker">{String(index + 1).padStart(2, "0")}</span>
            <strong>{label}</strong>
          </div>
          {index < 6 && <span className="op-home-flow-arrow" aria-hidden="true">→</span>}
        </React.Fragment>
      ))}
    </div>
  );
}
