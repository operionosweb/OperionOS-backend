import React from "react";
import { Container } from "../components/ui/Layout";

function PolicyPage({ eyebrow, title, intro, sections }) {
  return <main className="op-policy-page"><section className="op-policy-hero"><Container><p className="op-sales-label">{eyebrow}</p><h1>{title}</h1><p>{intro}</p></Container></section><section className="op-policy-content"><Container>{sections.map(([heading, copy]) => <section key={heading}><h2>{heading}</h2><p>{copy}</p></section>)}</Container></section></main>;
}

export function PrivacyPage() {
  return <PolicyPage eyebrow="PRIVACY" title="Privacy at Operion." intro="This notice explains how the public Operion website handles information." sections={[
    ["Demo requests", "When you request a demonstration, the details you provide are sent to Operion so we can respond. Delivery is handled by our configured transactional email provider."],
    ["Analytics", "Google Analytics is loaded only after analytics consent. You can change that choice through Analytics preferences in the footer."],
    ["Data minimisation", "Do not submit confidential contract content through the public contact form. Operion does not use the form to collect passwords, payment details or sensitive contract documents."],
    ["Contact", "Questions about website privacy can be sent to info@operionos.com."],
  ]} />;
}

export function LegalPage() {
  return <PolicyPage eyebrow="LEGAL" title="Website terms." intro="The Operion website provides product information and prepared demonstrations." sections={[
    ["Informational content", "Website content and demonstrations are provided for general information and product evaluation. They are not legal, financial or operational advice."],
    ["Illustrative material", "Scenarios, exposure figures and prepared demo data are illustrative unless explicitly identified otherwise. Actual outcomes depend on the applicable contract and circumstances."],
    ["Product direction", "Roadmap and future-direction content does not represent a commitment that a capability is currently available or will be delivered on a particular date."],
    ["Contact", "Questions about these terms can be sent to info@operionos.com."],
  ]} />;
}