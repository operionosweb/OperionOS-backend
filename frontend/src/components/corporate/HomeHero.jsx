import React, { useEffect, useRef } from "react";
import { Container } from "../ui/Layout";
import Button from "../ui/Button";
import Reveal from "../ui/Reveal";

const NODES = ["Engine Lease Agreement", "Ground Handling SLA", "PBH Maintenance Contract"];

export default function HomeHero() {
  return (
    <section className="op-home-hero">
      <Container>
        <div className="op-home-hero-grid">
          <Reveal className="op-home-hero-copy">
            <p className="op-eyebrow">Spatial intelligence OS</p>
            <h1>Turn Contracts Into <span>Operational Intelligence.</span></h1>
            <p className="op-home-lead">Operion OS uses AI to understand complex contracts, identify obligations and risks, and connect contractual logic to the operational reality of your business.</p>
            <div className="op-home-actions"><Button to="/demo" variant="primary">Request a Demo</Button><Button to="/platform" variant="secondary">Explore the Platform</Button></div>
          </Reveal>
          <Reveal className="op-contract-visual-wrap"><ContractVisual /></Reveal>
        </div>
      </Container>
    </section>
  );
}

function ContractVisual() {
  const visualRef = useRef(null);

  useEffect(() => {
    const visual = visualRef.current;
    if (!visual || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let frameId;
    const animate = (time) => {
      visual.style.setProperty("--orbit-angle", `${time * 0.018}deg`);
      visual.style.setProperty("--document-lift", `${Math.sin(time * 0.001) * 5}px`);
      frameId = window.requestAnimationFrame(animate);
    };
    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return <div ref={visualRef} className="op-contract-visual" aria-label="Contract document connected to structured intelligence nodes" role="img">
    <div className="op-contract-document"><span className="op-document-bar op-document-bar-short" /><span className="op-document-line" /><span className="op-document-line" /><span className="op-document-line op-document-line-short" /><strong>CONTRACT</strong></div>
    <div className="op-contract-orbit op-contract-orbit-one" />
    <div className="op-contract-orbit op-contract-orbit-two" />
    {NODES.map((node, index) => <span key={node} className={`op-contract-node op-contract-node-${index + 1}`}><i />{node}</span>)}
    <span className="op-contract-core" aria-hidden="true">✦</span>
  </div>;
}