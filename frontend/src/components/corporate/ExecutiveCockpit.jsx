import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import FlightOperations from "../aviation/FlightOperations";
import { Container } from "../ui/Layout";

export default function ExecutiveCockpit() {
  return <section className="oaero-cockpit-section" id="executive-cockpit" aria-labelledby="cockpit-preview-title">
    <Container>
      <div className="oaero-section-heading">
        <span className="oaero-pill">PREPARED DEMONSTRATION INTERFACE</span>
        <h2 id="cockpit-preview-title">A real view of the Operion contract intelligence workspace.</h2>
        <p>Explore the same globe, aircraft search and controls as the Demo Dashboard. Aircraft and weather are simulated; live flights, turbulence forecasts and verified aircraft photos are not connected.</p>
        <Link className="op-btn op-btn-secondary" to="/demo/dashboard">Explore the full demo <ArrowRight size={16}/></Link>
      </div>
      <div className="od-shell od-cockpit-embed" aria-label="Executive Cockpit simulator">
        <FlightOperations/>
      </div>
    </Container>
  </section>;
}
