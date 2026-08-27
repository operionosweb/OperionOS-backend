import React from "react";
import Reveal from "../ui/Reveal";

const DOMAINS = [["✈", "Airlines"], ["▣", "Aircraft Leasing"], ["⌘", "MRO Facilities"], ["▦", "Ground Handling"]];

export default function AviationEcosystem() {
  return <section className="op-home-aviation" aria-labelledby="aviation-ecosystem-title"><div className="op-container op-home-aviation-grid"><Reveal><p className="op-eyebrow">Sector focus</p><h2 id="aviation-ecosystem-title">Built for aviation.<br />Designed for complexity.</h2><p>Aviation contracts are dense, technical, and interconnected networks in the world. Operion was architected to handle this exact level of spatial complexity.</p><div className="op-home-domain-list">{DOMAINS.map(([icon, label]) => <span key={label}><b aria-hidden="true">{icon}</b>{label}</span>)}</div></Reveal><Reveal><div className="op-home-aviation-visual"><div className="op-aviation-center" aria-hidden="true">✈</div><span className="op-aviation-label op-aviation-label-top">Engine Lease Agreement</span><span className="op-aviation-label op-aviation-label-left">Ground Handling SLA</span><span className="op-aviation-label op-aviation-label-bottom">PBH Maintenance Contract</span></div></Reveal></div></section>;
}