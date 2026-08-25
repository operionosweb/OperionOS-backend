import React from "react";
import { Section } from "../ui/Layout";
import Button from "../ui/Button";
import Reveal from "../ui/Reveal";

const SCENARIOS = [
  "Severe weather disrupts operations",
  "A crew member does not show up",
  "Fuel prices increase sharply",
  "A critical supplier fails its SLA",
  "Geopolitical disruption affects a route",
];

const FLOW = ["Event", "Contract", "Clause", "Impact", "Probability", "Action", "Value"];

export default function ScenarioSection() {
  return (
    <Section id="scenarios">
      <Reveal>
        <span className="op-badge op-badge-future" style={{ marginBottom: "var(--op-space-4)" }}>
          Illustrative scenarios
        </span>
        <h2 className="op-heading-lg" style={{ marginBottom: "var(--op-space-4)" }}>
          What happens if X happens?
        </h2>
        <p className="op-body-lg" style={{ marginBottom: "var(--op-space-7)" }}>
          What happens to your contracts, obligations and potential financial
          exposure when operational conditions change? Operion's future
          Scenario Intelligence is designed to explore those connections. This
          is an illustrative model, not a live simulation.
        </p>
      </Reveal>

      <div className="op-grid op-grid-2" style={{ alignItems: "start" }}>
        <Reveal className="op-surface" style={{ padding: "var(--op-space-5)" }}>
          <p className="op-kicker" style={{ marginBottom: "var(--op-space-3)" }}>Questions worth preparing for</p>
          <ul className="op-home-simple-list">
            {SCENARIOS.map((scenario) => <li key={scenario}>{scenario}</li>)}
          </ul>
        </Reveal>

        <Reveal className="op-surface op-home-scenario-flow" style={{ padding: "var(--op-space-5)" }}>
          <p className="op-kicker" style={{ marginBottom: "var(--op-space-3)" }}>Scenario architecture</p>
          <div className="op-home-mini-flow">
            {FLOW.map((step, index) => (
              <React.Fragment key={step}>
                <span>{step}</span>
                {index < FLOW.length - 1 && <b aria-hidden="true">→</b>}
              </React.Fragment>
            ))}
          </div>
          <div className="op-home-illustrative" style={{ marginTop: "var(--op-space-5)" }}>
            <p className="op-kicker">Illustrative scenario</p>
            <p className="op-body-sm">3-hour operational disruption → Service-level agreement → Penalty mechanism activated</p>
            <strong>Illustrative potential exposure: €180,000</strong>
            <p className="op-body-sm">Illustrative scenario. Actual outcomes depend on contractual terms, operational conditions and actions taken.</p>
          </div>
        </Reveal>
      </div>

      <Reveal style={{ marginTop: "var(--op-space-5)" }}>
        <Button to="/scenarios" variant="secondary">Explore Scenarios</Button>
      </Reveal>
    </Section>
  );
}
