import React from "react";
import Reveal from "../ui/Reveal";

const STAGES = [["01", "Understand", "Ingest complex contracts with aerospace-grade accuracy."], ["02", "Structure", "Map obligations and clauses into actionable graph data."], ["03", "Monitor", "Track compliance and performance in real-time dashboards."], ["04", "Predict", "Forecast risks and optimize outcomes before they arise."]];

export default function IntelligencePath() {
  return <section className="op-home-path" aria-labelledby="intelligence-path-title"><div className="op-container"><div className="op-home-section-heading"><p className="op-eyebrow">The intelligence path</p><h2 id="intelligence-path-title">From raw data to strategic clarity.</h2></div><div className="op-home-path-grid">{STAGES.map(([number, title, description]) => <Reveal key={title} className="op-home-path-item"><span className="op-home-path-number">{number}</span><div><h3>{title}</h3><p>{description}</p></div></Reveal>)}</div></div></section>;
}