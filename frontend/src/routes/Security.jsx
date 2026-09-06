import React from "react";
import { Check, FileSearch, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { SalesCta, SalesHero, SalesSection } from "../components/corporate/SalesPage";
import Reveal from "../components/ui/Reveal";

const SECURITY_IMAGE = "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=2000&q=82";
const VERIFIED_CONTROLS = [
  [KeyRound, "Authenticated application access", "Private application routes require an authenticated user session."],
  [ShieldCheck, "Organisation boundaries", "Backend requests carry organisation context so access decisions can be scoped to the active organisation."],
  [LockKeyhole, "Role-based controls", "Authorisation middleware supports role checks for protected application functions."],
  [FileSearch, "Evidence-linked intelligence", "Contract findings are designed to remain connected to the source evidence used for review."],
];
const REVIEW_AREAS = ["Identity and access requirements", "Data handling and retention", "Hosting and data location", "AI provider configuration", "Integration boundaries", "Operational monitoring"];

export default function Security() {
  return <main className="op-sales-page">
    <SalesHero eyebrow="SECURITY" title="Enterprise security for sensitive contractual intelligence." copy="Operion is designed around controlled access, organisation boundaries and evidence-backed review, with deployment controls assessed against each organisation's requirements." image={SECURITY_IMAGE} imageAlt="Protected enterprise data infrastructure in a secure technical environment" />

    <SalesSection eyebrow="CURRENT ARCHITECTURE" title="Security controls that can be explained." copy="Operion distinguishes implemented application controls from deployment-specific requirements and future assurance work.">
      <Reveal className="op-security-grid">{VERIFIED_CONTROLS.map(([Icon, title, copy]) => <article key={title}><Icon size={21} /><h3>{title}</h3><p>{copy}</p></article>)}</Reveal>
    </SalesSection>

    <SalesSection eyebrow="DATA AND AI" title="Sensitive data deserves explicit boundaries." copy="Credentials remain server-side. Browser requests use scoped session credentials, while provider and infrastructure settings are configured in the deployment environment." dark>
      <Reveal className="op-security-principles"><div><strong>Access</strong><p>Authentication and authorisation are applied before protected application functions.</p></div><div><strong>Isolation</strong><p>Organisation context is carried through backend requests. Any provider-specific data isolation terms must be verified for the selected deployment.</p></div><div><strong>Auditability</strong><p>Evidence-linked outputs support accountable review. Operion does not describe current logs as immutable.</p></div></Reveal>
    </SalesSection>

    <SalesSection eyebrow="ENTERPRISE DEPLOYMENT" title="Review the controls that matter for your environment." copy="Security and privacy requirements differ by organisation, jurisdiction and deployment. Operion reviews these areas during a technical evaluation.">
      <Reveal className="op-sales-check-grid">{REVIEW_AREAS.map((item) => <span key={item}><Check size={16} />{item}</span>)}</Reveal>
    </SalesSection>

    <SalesSection eyebrow="ASSURANCE" title="Trust starts with accurate claims." copy="Operion does not claim ISO 27001 or SOC 2 certification, guaranteed uptime, completed penetration testing, fixed data residency, immutable audit logs or universal AI isolation unless those controls are documented for the applicable deployment." />

    <SalesCta title="Discuss your security requirements with Operion." copy="Bring your access, deployment, privacy and governance questions to a focused technical conversation." />
  </main>;
}