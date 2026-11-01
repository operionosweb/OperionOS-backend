import React from "react";

export default function MattEnvironment({ phase, onMediaError }) {
  return <section className="matt-environment od-card" aria-label="Matt executive office" data-state={phase}>
    <div className="matt-character"><img src="/matt/executive-office.jpg" width="758" height="503" alt="Matt in his aviation executive office"
      onError={() => onMediaError("Matt's identity reference could not load. Intelligence and evidence controls remain available.")}/></div>
    <div className="matt-nameplate"><span>OPERION / AVIATION INTELLIGENCE</span><h2>Matt</h2><p>Your intelligence colleague.</p></div>
    <div className="matt-character-status"><i aria-hidden="true"/>{phase.toLowerCase()}</div>
    <p className="matt-studio-media-label">APPROVED IDENTITY REFERENCE / LIVE VIDEO NOT CONNECTED</p>
  </section>;
}
