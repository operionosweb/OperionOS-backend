import React from "react";
import { ArrowRight, Check } from "lucide-react";
import { SalesCta, SalesHero, SalesSection } from "../components/corporate/SalesPage";
import Reveal from "../components/ui/Reveal";
import Button from "../components/ui/Button";

const METHOD_IMAGE = "https://images.unsplash.com/photo-1517479149777-5f3b1511d5ad?auto=format&fit=crop&w=2000&q=82";
const STEPS = [
  ["01", "Upload", "Upload contracts and relevant supporting documents into the Operion workspace.", ["Source document", "Controlled workspace"]],
  ["02", "Understand", "Operion analyses the contractual language and structure while preserving context.", ["Contract structure", "Relevant language"]],
  ["03", "Extract", "Clauses, obligations, deadlines, parties, risks and contractual relationships become structured intelligence.", ["Clauses", "Obligations", "Deadlines", "Relationships"]],
  ["04", "Assess", "The platform helps connect contractual information to potential operational and financial consequences.", ["Contract condition", "Potential consequence", "Exposure context"]],
  ["05", "Recommend", "Operion surfaces evidence-backed actions for mitigation, negotiation or improvement.", ["Review a clause", "Address an obligation", "Mitigate exposure"]],
  ["06", "Predict", "Strategic future capability: evaluate how external changes could affect contractual exposure.", ["Predictive Risk Intelligence", "Future capability", "Human decision-making"]],
];
const PIPELINE = ["Document", "AI Understanding", "Contract Intelligence", "Risk", "Exposure", "Action"];

export default function HowItWorks() {
  return <main className="op-sales-page">
    <SalesHero eyebrow="HOW OPERION WORKS" title="From Contract to Decision" copy="Operion transforms complex aviation contracts into structured intelligence that teams can understand, monitor and act on." image={METHOD_IMAGE} imageAlt="Aircraft operations viewed through a structured aviation workflow">
      <Button to="/demo/dashboard" variant="secondary">Explore the Live Demo <ArrowRight size={16} /></Button>
    </SalesHero>

    <section className="op-method-steps">
      {STEPS.map(([number, title, copy, items], index) => <section key={number} className={index % 2 ? "is-tinted" : ""}><div className="op-container"><Reveal className="op-method-step"><div className="op-method-number">{number}</div><div><h2>{title}</h2><p>{copy}</p></div><div className="op-method-signals">{items.map((item) => <span key={item}><Check size={14} />{item}</span>)}</div></Reveal></div></section>)}
    </section>

    <SalesSection eyebrow="THE OPERION PIPELINE" title="Intelligence remains connected to evidence." copy="Each layer starts with the document and preserves the contractual context needed for accountable review.">
      <Reveal className="op-sales-pipeline">{PIPELINE.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong>{index < PIPELINE.length - 1 && <ArrowRight size={15} aria-hidden="true" />}</div>)}</Reveal>
    </SalesSection>

    <section className="op-method-statement" aria-label="Operion methodology"><div className="op-container"><Reveal>{["Understand.", "Quantify.", "Anticipate.", "Act."].map((word) => <strong key={word}>{word}</strong>)}</Reveal></div></section>
    <SalesCta title="See the method applied to your contracts." />
  </main>;
}
