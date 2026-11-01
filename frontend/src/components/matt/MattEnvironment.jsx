import React, { useEffect, useRef, useState } from "react";

export default function MattEnvironment({ phase, onMediaError }) {
  const videoRef = useRef(null);
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const speaking = phase === "SPEAKING" && motionEnabled && !mediaFailed && !reducedMotion;
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let active = true;
    if (speaking && !document.hidden) video.play().catch(() => {
      if (active) { setMediaFailed(true); onMediaError("Matt's motion video could not play. The portrait and all intelligence controls remain available."); }
    });
    else video.pause();
    const visibility = () => {
      if (document.hidden) video.pause();
      else if (speaking) video.play().catch(() => {
        if (active) { setMediaFailed(true); onMediaError("Motion playback failed after returning to the page. The portrait remains available."); }
      });
    };
    document.addEventListener("visibilitychange", visibility);
    return () => { active = false; video.pause(); document.removeEventListener("visibilitychange", visibility); };
  }, [speaking, onMediaError]);
  return <section className="matt-environment" aria-label="Matt executive office" data-state={phase}>
    <div className="matt-character">
      <img src="/matt/executive-office.jpg" width="758" height="503" alt="Matt in his aviation executive office" onError={() => onMediaError("Matt's portrait could not load. Text and voice controls remain available.")}/>
      {motionEnabled && !mediaFailed && !reducedMotion && <video ref={videoRef} className={speaking ? "is-speaking" : ""} src="/matt/reference.mp4" preload="none" muted loop playsInline aria-hidden="true"
        onError={() => { setMediaFailed(true); onMediaError("Matt's reference video is unavailable. Using the supplied portrait instead."); }}/>}
    </div>
    <div className="matt-nameplate"><span>OPERION / CONTRACT INTELLIGENCE</span><h2>Matt</h2><p>Your intelligence colleague.<br/>Evidence first. Always.</p></div>
    <div className="matt-character-status"><i aria-hidden="true"/>{phase.toLowerCase()}</div>
    <label className="matt-motion-choice"><input type="checkbox" checked={motionEnabled} disabled={reducedMotion || mediaFailed} onChange={(event) => setMotionEnabled(event.target.checked)}/>Enable speaking video (17 MB, loaded only on playback)</label>
    <p className="matt-motion-note">{reducedMotion ? "Reduced motion: still portrait." : "Subtle portrait motion; optional supplied speaking footage."} Speaking footage is a generic approximation, not phoneme-synchronised. No mouth playback while silent.</p>
  </section>;
}
