import React, { lazy, Suspense } from "react";
import { ArrowRight, FileCheck2, Layers3, ShieldCheck } from "lucide-react";
import { Container } from "../ui/Layout";
import Button from "../ui/Button";
import { trackEvent } from "../analytics/Analytics";

const AircraftScene = lazy(() => import("./AircraftScene"));

export default function AeroHero({ eyebrow, title, copy, children, home = false }) {
  return <section className={`oaero-hero${home ? " oaero-hero-home" : " oaero-hero-text"}`}>
    <Container>
      <div className="oaero-hero-grid">
        <div className="oaero-hero-copy">
          <span className="oaero-pill"><i/>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{copy}</p>
          <div className="oaero-hero-actions">
            <Button to="/request-demo" onClick={() => trackEvent("request_demo_click", { location: home ? "home_hero" : "corporate_hero" })}>Request a Demo <ArrowRight size={17}/></Button>
            {children || <Button to="/product" variant="secondary">Discover Operion <ArrowRight size={16}/></Button>}
          </div>
          <div className="oaero-hero-assurance">
            <span><FileCheck2 size={15}/>Evidence-linked</span>
            <span><ShieldCheck size={15}/>Human review</span>
            <span><Layers3 size={15}/>Aviation first</span>
          </div>
        </div>
        {home && <div className="oaero-hero-visual">
          <div className="oaero-visual-label"><span><i/>CONTRACTUAL ECOSYSTEM</span><span>3D ASSET VIEW</span></div>
          <Suspense fallback={<div className="oaero-aircraft-loading" role="status">Preparing aircraft illustration…</div>}><AircraftScene/></Suspense>
          <div className="oaero-asset-tag oaero-asset-tag-lease"><FileCheck2 size={17}/><div><small>Asset governance</small><strong>Aircraft lease</strong></div><i/></div>
          <div className="oaero-asset-tag oaero-asset-tag-mro"><Layers3 size={17}/><div><small>Maintenance obligations</small><strong>Engine &amp; airframe</strong></div><i/></div>
          <div className="oaero-visual-summary"><span><ShieldCheck size={17}/>Source evidence → contractual context → decision</span><small>Illustrative asset relationships</small></div>
        </div>}
      </div>
    </Container>
  </section>;
}
