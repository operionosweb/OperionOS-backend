import React from "react";
import { Section } from "../ui/Layout";
import Reveal from "../ui/Reveal";

const REACTIVE = ["Event happens", "Search for the contract", "Find the relevant clause", "Determine what applies", "Calculate the exposure", "React", "Potential loss"];
const PROACTIVE = ["Contract understood", "Event detected", "Affected contract identified", "Clause / obligation connected", "Risk assessed", "Potential financial impact estimated", "Scenario evaluated", "Action recommended", "Mitigation opportunity"];

function Flow({ title, items, tone }) {
  return (
    <div className={`op-home-process op-home-process-${tone}`}>
      <p className="op-kicker" style={{ marginBottom: "var(--op-space-3)" }}>{title}</p>
      {items.map((item, index) => (
        <React.Fragment key={item}>
          <div className="op-home-process-step">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{item}</strong>
          </div>
          {index < items.length - 1 && <span className="op-home-process-arrow" aria-hidden="true">↓</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function ReactiveProactiveSection() {
  return (
    <Section>
      <Reveal>
        <p className="op-eyebrow">The shift</p>
        <h2 className="op-heading-lg" style={{ marginBottom: "var(--op-space-4)" }}>
          From reactive contract management to proactive operational intelligence.
        </h2>
        <p className="op-body-lg" style={{ marginBottom: "var(--op-space-7)" }}>
          The direction of Operion is to move organisations from fragmented
          response toward an intelligence layer that connects the contract to
          the operational event and the decision that follows.
        </p>
      </Reveal>

      <div className="op-grid op-grid-2">
        <Reveal><Flow title="Traditional reactive process" items={REACTIVE} tone="reactive" /></Reveal>
        <Reveal><Flow title="The direction of Operion" items={PROACTIVE} tone="proactive" /></Reveal>
      </div>
    </Section>
  );
}
