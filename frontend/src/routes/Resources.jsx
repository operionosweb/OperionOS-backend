import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, FileSearch, ShieldCheck } from "lucide-react";
import AeroHero from "../components/corporate/AeroHero";
import { SalesCta, SalesSection } from "../components/corporate/SalesPage";
import Reveal from "../components/ui/Reveal";

const RESOURCES = [
  { title: "From contract to decision", copy: "Follow the existing upload, understanding, extraction and review workflow.", to: "/how-it-works", label: "Explore the workflow", icon: BookOpen },
  { title: "Prepared contract examples", copy: "Explore the public demo portfolio using prepared, non-customer aviation agreements.", to: "/demo/contracts", label: "Inspect demo contracts", icon: FileSearch },
  { title: "Aviation scenario library", copy: "Review illustrative contractual exposure scenarios. Simulation examples describe roadmap direction, not live forecasts.", to: "/scenarios", label: "Review scenarios", icon: BookOpen },
  { title: "Security and governance", copy: "Understand current access boundaries, evidence-linked review and deployment-specific considerations.", to: "/security", label: "Review security", icon: ShieldCheck },
  { title: "Enterprise evaluation", copy: "Explore organisation governance, integration boundaries and the approach to a controlled pilot.", to: "/enterprise", label: "Explore enterprise", icon: ShieldCheck },
  { title: "Privacy and legal information", copy: "Review the published privacy policy and evaluation terms, including their review notices.", to: "/privacy", label: "Read privacy information", icon: FileSearch },
];

export default function Resources() {
  return <div className="op-sales-page">
    <AeroHero eyebrow="OPERION RESOURCES" title={<>Understand the evidence.<br/><span>Explore the platform.</span></>} copy="A practical starting point for Operion's workflows, prepared demonstrations, aviation scenarios and governance information."/>
    <SalesSection eyebrow="EXPLORE & LEARN" title="A clear path through Operion." copy="Explore product material, prepared demonstrations and governance information in one place.">
      <Reveal className="oaero-resource-grid">{RESOURCES.map(({ title, copy, to, label, icon: Icon }) => <article key={title}><Icon size={24}/><h3>{title}</h3><p>{copy}</p><Link to={to}>{label}<ArrowRight size={16}/></Link></article>)}</Reveal>
    </SalesSection>
    <SalesCta title="Explore Operion with your team." copy="Bring an aviation contract or a question about exposure to a focused private demonstration."/>
  </div>;
}
