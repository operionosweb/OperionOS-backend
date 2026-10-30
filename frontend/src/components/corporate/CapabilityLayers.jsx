import React, { useState } from "react";
import { ChevronDown, FileSearch, Orbit, Radar, Waypoints } from "lucide-react";
import { Container } from "../ui/Layout";

const layers = [
  { title: "Contract Intelligence", status: "Available now", icon: FileSearch, copy: "Turn complex agreements into structured clauses, obligations, deadlines and risks, with each finding connected to the original source for human review." },
  { title: "Aviation Intelligence", status: "In development", icon: Orbit, copy: "Connect contractual requirements to aircraft, maintenance and operational relationships. Prepared demonstrations show the intended connections, not universally live telemetry." },
  { title: "Predictive Risk", status: "In development", icon: Radar, copy: "Explore how changing external conditions may affect contractual exposure. Forecasting and provider-specific integrations require further development and validation." },
  { title: "Scenario Simulation", status: "Strategic roadmap", icon: Waypoints, copy: "Test alternative operating conditions and compare possible consequences. Current scenario examples are illustrative decision-support demonstrations, not live forecasts." },
];

export default function CapabilityLayers() {
  const [open, setOpen] = useState(0);
  return <section className="oaero-capabilities" id="capabilities"><Container>
    <div className="oaero-section-heading"><span className="oaero-pill">PLATFORM ARCHITECTURE</span><h2>Four connected layers.<br/>One intelligence foundation.</h2><p>Start with the contract. Build toward a clearer view of the world around it.</p></div>
    <div className="oaero-layer-grid">{layers.map(({ title, status, icon: Icon, copy }, index) =>
      <article className={`oaero-layer${open === index ? " is-open" : ""}`} key={title}>
        <button type="button" aria-expanded={open === index} aria-controls={`oaero-layer-${index}`} onClick={() => setOpen(open === index ? null : index)}>
          <span className="oaero-layer-number">0{index + 1}</span><Icon size={22}/>
          <span><strong>{title}</strong><small>{status}</small></span><ChevronDown size={18}/>
        </button>
        <div id={`oaero-layer-${index}`} hidden={open !== index}><p>{copy}</p></div>
      </article>
    )}</div>
  </Container></section>;
}
