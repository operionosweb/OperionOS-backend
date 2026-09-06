import React from "react";
import { ArrowRight, Check } from "lucide-react";
import { SalesCta, SalesHero, SalesSection } from "../components/corporate/SalesPage";
import Reveal from "../components/ui/Reveal";
import Button from "../components/ui/Button";

const METHOD_IMAGE = "https://images.unsplash.com/photo-1517479149777-5f3b1511d5ad?auto=format&fit=crop&w=2000&q=82";
const STEPS = [
  ["01", "Upload", "Bring a complex aviation contract into the Operion workspace.", ["Source document", "Controlled workspace"]],
  ["02", "Understand", "Operion processes the document while preserving the contractual context.", ["Contract structure", "Relevant language"]],
  ["03", "Extract", "Clauses, obligations, deadlines, financial terms, risks and dependencies become structured intelligence.", ["Clauses", "Obligations", "Deadlines", "Dependencies"]],
  ["04", "Assess", "The platform helps connect contractual information to potential operational and financial consequences.", ["Contract condition", "Potential consequence", "Exposure context"]],
  ["05", "Monitor", "Contractual obligations and deadlines can be reviewed as their relevance changes.", ["Deadlines", "Obligation status", "Developing intelligence"]],
  ["06", "Recommend", "Operion helps users determine which evidence-backed actions should be considered.", ["Review a clause", "Address an obligation", "Mitigate exposure"]],
];

export default function HowItWorks() {
  return <main className="op-sales-page">
    <SalesHero eyebrow="HOW OPERION WORKS" title="From contract to decision." copy="Operion transforms complex contractual information into structured intelligence that helps organisations identify exposure, understand consequences and decide what to do next." image={METHOD_IMAGE} imageAlt="Aircraft operations viewed through a structured aviation workflow">
      <Button to="/demo/dashboard" variant="secondary">Explore the Live Demo <ArrowRight size={16} /></Button>
    </SalesHero>

    <section className="op-method-steps">
      {STEPS.map(([number, title, copy, items], index) => <section key={number} className={index % 2 ? "is-tinted" : ""}><div className="op-container"><Reveal className="op-method-step"><div className="op-method-number">{number}</div><div><h2>{title}</h2><p>{copy}</p></div><div className="op-method-signals">{items.map((item) => <span key={item}><Check size={14} />{item}</span>)}</div></Reveal></div></section>)}
    </section>

    <SalesSection eyebrow="THE OPERION METHOD" title="Intelligence remains connected to evidence." copy="Each layer starts with the contract and preserves the context needed for accountable review.">
      <Reveal className="op-sales-evidence-strip"><div><span>Input</span><strong>Contract document</strong></div><div><span>Structure</span><strong>Clause and obligation intelligence</strong></div><div><span>Outcome</span><strong>Evidence-backed decision support</strong></div></Reveal>
    </SalesSection>

    <section className="op-method-statement" aria-label="Operion methodology"><div className="op-container"><Reveal>{["Understand.", "Quantify.", "Anticipate.", "Act."].map((word) => <strong key={word}>{word}</strong>)}</Reveal></div></section>
    <SalesCta title="See the method applied to your contracts." />
  </main>;
}
