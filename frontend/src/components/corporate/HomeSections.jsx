import React, { useRef } from "react";
import { ArrowDown, ArrowRight, Check, Search, ShieldCheck } from "lucide-react";
import { Container } from "../ui/Layout";
import Button from "../ui/Button";
import Reveal from "../ui/Reveal";
import { trackEvent } from "../analytics/Analytics";

const AIRCRAFT = "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1800&q=82";
const VIDEO_SRC = "/videos/operion-contract-intelligence.mp4";
const INTELLIGENCE_FLOW = [
  ["Understand", "Contracts are parsed and understood."],
  ["Extract", "Clauses, obligations, deadlines, risks and financial terms are identified."],
  ["Connect", "Contractual information is connected to operational and financial context."],
  ["Assess", "Exposure and potential impact are evaluated."],
  ["Act", "Operion recommends what should happen next."],
];
const SEGMENTS = [
  ["Airlines", "Understand exposure across fleets, suppliers and operational agreements."],
  ["Aircraft Lessors", "Identify obligations, commercial exposure and dependencies across leasing relationships."],
  ["MRO", "Monitor service agreements, SLAs, obligations, deadlines and supplier exposure."],
  ["Ground Handling & Aviation Services", "Understand operational agreements, service obligations and financial consequences."],
];
const RECOMMENDATIONS = ["Review a contractual clause", "Renegotiate a commercial term", "Address an upcoming obligation", "Mitigate supplier exposure", "Restructure a contract", "Diversify a critical dependency"];
const USE_CASES = [
  ["Lease obligations", "Track return conditions, maintenance reserves and time-critical obligations across aircraft leases."],
  ["Supplier exposure", "Connect SLA failures, remedies and dependencies before operational disruption compounds."],
  ["Commercial change", "Assess escalation clauses, volume commitments and renegotiation options as conditions shift."],
  ["Executive review", "Trace material risks and recommended actions back to contract evidence."],
];
const EXECUTIVE_VALUE = ["Earlier visibility of exposure", "Faster evidence-backed decisions", "Clearer accountability for action"];

function Section({ id, label, title, copy, children, dark = false, className = "" }) {
  return <section id={id} className={`op-intel-section${dark ? " op-intel-section-dark" : ""} ${className}`.trim()}><Container><Reveal><p className="op-intel-label">{label}</p><h2>{title}</h2>{copy && <p className="op-intel-copy">{copy}</p>}</Reveal>{children}</Container></section>;
}

export default function HomeSections() {
  const videoRef = useRef(null);
  const playVideo = () => {
    if (!videoRef.current || !videoRef.current.paused) return;
    videoRef.current.play().catch(() => {});
  };

  return <>
    <section className="op-intel-hero op-cinematic-hero" style={{ backgroundImage: `url(${AIRCRAFT})` }}><div className="op-intel-hero-overlay"><Container><Reveal className="op-intel-hero-content"><p className="op-intel-label">OPERION</p><h1>Contract Intelligence for Aviation</h1><p className="op-intel-hero-lead">Turn complex aviation contracts into operational, financial and risk intelligence.</p><p className="op-intel-hero-support">Operion transforms contracts into actionable intelligence, revealing obligations, exposure, risks and recommended actions before they become costly problems.</p><div className="op-intel-actions"><Button to="/request-demo" onClick={() => trackEvent("request_demo_click", { location: "hero" })}>Request a Private Demo <ArrowRight size={16} /></Button><a className="op-btn op-btn-secondary op-intel-hero-secondary" href="#how-it-works" onClick={() => trackEvent("how_it_works_click", { location: "hero" })}>See How Operion Works <ArrowDown size={16} /></a></div></Reveal></Container></div></section>
    <section id="product" className="op-intel-section op-intel-video-section"><Container><Reveal><p className="op-intel-label">AVIATION → CONTRACTS → INTELLIGENCE → RISK &amp; EXPOSURE → FINANCIAL IMPACT → RECOMMENDED ACTION → PREDICTIVE INTELLIGENCE</p><h2>From contracts to intelligence.</h2><p className="op-intel-copy">Operion connects complex aviation contracts with the operational and financial realities that surround them.</p></Reveal></Container><Reveal className="op-intel-video-frame"><video ref={videoRef} autoPlay loop muted playsInline preload="metadata" poster={AIRCRAFT} onCanPlay={playVideo} onPlay={() => trackEvent("video_play", { video_title: "Operion home" })} aria-label="Operion aviation contract intelligence product film"><source src={VIDEO_SRC} type="video/mp4" /></video></Reveal></section>
    <Section id="problem" label="THE BUSINESS PROBLEM" title="Your contracts contain more risk than your spreadsheets can show." copy="Aviation agreements contain obligations, deadlines, penalties, escalation clauses, service levels, volume commitments and dependencies. The information exists inside the contracts, but extracting its business impact manually is slow, fragmented and difficult to monitor continuously."><Reveal className="op-intel-problem-list">{["Obligations & deadlines", "Commercial penalties", "Supplier dependencies", "Financial exposure"].map((item) => <span key={item}><Check size={16} />{item}</span>)}</Reveal></Section>
    <Section id="how-it-works" label="CONTRACT INTELLIGENCE" title="From agreement to action." copy="A structured intelligence process keeps every insight connected to the underlying contract."><Reveal className="op-intel-flow">{INTELLIGENCE_FLOW.map(([title, copy], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{copy}</p></article>)}</Reveal></Section>
    <Section id="financial-impact" label="FINANCIAL IMPACT" title="Know what is at risk. Know what you can save." copy="Operion translates contractual risks into an economic decision path, so teams can see the potential consequence and the action available to them." dark><Reveal className="op-intel-exposure"><div className="op-intel-exposure-value"><span>Illustrative scenario</span><strong>€185,000</strong><p>Potential contractual exposure</p></div><div className="op-intel-impact-path">{["Supplier SLA breach", "Operational disruption", "Contractual exposure", "Potential financial impact", "Recommended action"].map((step) => <div key={step}>{step}<ArrowRight size={15} aria-hidden="true" /></div>)}</div></Reveal></Section>
    <Section id="recommendations" label="DECISION SUPPORT" title="Operion doesn't just identify risk. It recommends what to do next." copy="Evidence-backed recommendations help executives move from risk detection to informed action. Decisions remain with your team."><Reveal className="op-intel-recommendations">{RECOMMENDATIONS.map((item) => <div key={item}><ArrowRight size={16} /><span>{item}</span></div>)}</Reveal></Section>
    <Section id="predictive" label="STRATEGIC DIRECTION" title="What happens to your contracts when the world changes?" copy="Contracts do not exist in isolation. Operion is evolving from Contract Intelligence toward Predictive Contract Intelligence, helping organisations understand how changing conditions can affect contractual exposure."><Reveal className="op-intel-predictive"><div className="op-intel-event-list">Fuel prices · Interest rates · Inflation · Exchange rates · Weather · Supplier risk · Geopolitical events · Operational disruption</div><div className="op-intel-predictive-flow">{["External event", "Affected contracts", "Contractual exposure", "Financial impact", "Recommended action"].map((step) => <span key={step}>{step}</span>)}</div><p>Future direction</p></Reveal></Section>
    <Section id="aviation" label="AVIATION FIRST" title="Built for the complexity of aviation." copy="Purpose-built intelligence for organisations operating across aviation's interconnected commercial and operational environment." className="op-intel-aviation"><Reveal className="op-intel-segments">{SEGMENTS.map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}</Reveal></Section>
    <Section id="use-cases" label="USE CASES" title="Where contract intelligence changes the decision." copy="Operion focuses attention on contractual situations where timing, evidence and financial consequence matter."><Reveal className="op-intel-use-cases">{USE_CASES.map(([title, copy], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{copy}</p></div></article>)}</Reveal></Section>
    <Section id="executive-value" label="EXECUTIVE VALUE" title="A clearer view of risk, impact and action." copy="Operion gives leaders a connected view of what matters now, why it matters and what the organisation should consider next." dark><Reveal className="op-intel-executive-value">{EXECUTIVE_VALUE.map((value) => <div key={value}><Check size={18} /><strong>{value}</strong></div>)}</Reveal></Section>
    <Section id="difference" label="THE DIFFERENCE" title="Not another contract repository." copy="Operion is designed to understand what contracts mean, what they expose your organisation to, and what actions should be considered next." dark><Reveal className="op-intel-comparison"><div><span>Traditional contract management</span><strong>Store → Search → Manage</strong></div><div><span>Operion</span><strong>Understand → Monitor → Assess → Predict → Recommend</strong></div></Reveal></Section>
    <Section id="security" label="ENTERPRISE-READY" title="Designed for responsible enterprise use." copy="Organisation boundaries, access controls and evidence-linked review form the current foundation. Infrastructure, privacy and deployment requirements are assessed for each environment."><Reveal className="op-intel-trust"><ShieldCheck size={30} /><p>Security and governance are described without unsupported certification or uptime claims.</p></Reveal></Section>
    <section className="op-intel-final"><Container><Reveal><Search size={28} /><h2>See what Operion could uncover in your contracts.</h2><p>Discover how Contract Intelligence can reveal obligations, exposure, risks and opportunities hidden inside complex aviation agreements.</p><div className="op-intel-actions"><Button to="/request-demo" onClick={() => trackEvent("request_demo_click", { location: "final_cta" })}>Request a Private Demo <ArrowRight size={16} /></Button><Button to="/request-demo" variant="secondary" onClick={() => trackEvent("contact_click", { location: "final_cta" })}>Talk to Operion</Button></div></Reveal></Container></section>
  </>;
}