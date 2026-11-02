import React, { useCallback, useEffect, useRef, useState } from "react";
import { useMattIntroduction } from "./mattIntroduction";

function hasLiveAudioVideo(stream) {
  return stream instanceof MediaStream && stream.getVideoTracks().some((track) => track.readyState === "live")
    && stream.getAudioTracks().some((track) => track.readyState === "live");
}

export default function MattEnvironment({ phase, onMediaError, onMediaStatus, stream = null, introductionKey = "demo", onIntroductionComplete, live = null }) {
  const introduction = useMattIntroduction(introductionKey);
  const introductionRef = useRef(introduction);
  introductionRef.current = introduction;
  const owner = useRef(Symbol("Matt introduction"));
  const player = useRef(null);
  const [needsPlayback, setNeedsPlayback] = useState(false);
  const [introAudio, setIntroAudio] = useState(false);
  const isIntroduction = !introduction.completed && !stream;
  useEffect(() => {
    if (introduction.completed) onIntroductionComplete?.();
  }, [introduction.completed, onIntroductionComplete]);
  useEffect(() => { if (stream) introductionRef.current.complete(); }, [stream]);
  const playbackFailed = useCallback(() => {
    player.current?.pause();
    onMediaStatus("error");
    onMediaError(stream
      ? "Matt's live media stream is unavailable. Reconnect the authorized session; identity footage will not replace a failed live response."
      : "Matt's introduction could not play. Continuing to the live assistant connection; no prerecorded response will be substituted.");
    if (stream) setNeedsPlayback(true);
    else introductionRef.current.complete();
  }, [stream, onMediaError, onMediaStatus]);
  useEffect(() => {
    if (!isIntroduction && !stream) { setNeedsPlayback(false); return; }
    let active = true;
    const video = player.current;
    const currentIntroduction = introductionRef.current;
    if (!stream && !currentIntroduction.claim(owner.current)) return;
    if (live?.mediaRef) live.mediaRef.current = video;
    const restoreTime = () => { if (!stream) video.currentTime = Math.min(currentIntroduction.resumeTime(), video.duration); };
    video.addEventListener("loadedmetadata", restoreTime);
    const play = () => {
      if (stream && live?.enableAudio) { void live.enableAudio(); return; }
      return video.play().catch((error) => {
      if (!active) return;
      if (!stream && document.visibilityState === "hidden" && ["AbortError", "NotAllowedError"].includes(error.name)) {
        onMediaStatus("buffering");
        return;
      }
      playbackFailed();
      });
    };
    const resumePreview = () => {
      if (!stream && document.visibilityState === "visible" && video.paused && !video.error) play();
    };
    onMediaError("");
    onMediaStatus("loading");
    if (stream) {
      if (!hasLiveAudioVideo(stream)) {
        playbackFailed();
        return;
      }
      video.srcObject = stream;
    }
    const ended = () => { if (active) playbackFailed(); };
    const tracks = stream?.getTracks() || [];
    for (const track of tracks) track.addEventListener("ended", ended);
    stream?.addEventListener("removetrack", ended);
    stream?.addEventListener("inactive", ended);
    document.addEventListener("visibilitychange", resumePreview);
    play();
    return () => {
      active = false;
      for (const track of tracks) track.removeEventListener("ended", ended);
      stream?.removeEventListener("removetrack", ended);
      stream?.removeEventListener("inactive", ended);
      document.removeEventListener("visibilitychange", resumePreview);
      const time = video.currentTime;
      video.pause();
      video.srcObject = null;
      if (live?.mediaRef?.current === video) live.mediaRef.current = null;
      video.removeEventListener("loadedmetadata", restoreTime);
      if (!stream) currentIntroduction.release(owner.current, time);
    };
  }, [stream, isIntroduction, introductionKey, isIntroduction ? introduction.revision : 0, playbackFailed, onMediaError, onMediaStatus]);
  function retry() {
    onMediaError("");
    onMediaStatus("loading");
    if (stream && !hasLiveAudioVideo(stream)) { playbackFailed(); return; }
    if (stream && live?.enableAudio) { void live.enableAudio(); return; }
    if (!stream) player.current.load();
    player.current.play().catch(playbackFailed);
  }
  return <section className="matt-environment od-card" aria-label="Matt video presence" data-state={isIntroduction ? "INTRODUCTION" : live?.state || phase}>
    <div className="matt-character">{(isIntroduction || stream) ? <video key={stream ? "stream" : "introduction"} ref={player} autoPlay={false} loop={false} muted={!stream && !introAudio} playsInline preload="metadata" aria-label={stream ? "Matt live audio and video" : "Matt introduction"} tabIndex={-1}
      onPlaying={() => {
        if (stream && !hasLiveAudioVideo(stream)) { playbackFailed(); return; }
        setNeedsPlayback(false); onMediaError(""); onMediaStatus("playing");
      }}
      onWaiting={() => onMediaStatus("buffering")}
      onTimeUpdate={(event) => { if (!stream) introduction.checkpoint(event.currentTarget.currentTime); }}
      onEnded={() => { if (!stream) introduction.complete(); }}
      onError={playbackFailed}>
      {!stream && <source src="/matt/reference.mp4" type="video/mp4"/>}
    </video> : <div className="matt-live-unavailable" role="status"><h2>{live?.state === "RECONNECTING" ? "Connecting live Matt" : "Live Matt unavailable"}</h2><p>{live?.error || "No live video provider is connected. The introduction will not be replayed as an answer."}</p>
      {live?.connect && <><label><input type="checkbox" checked={live.consent} onChange={(event) => live.setConsent(event.target.checked)}/>I am authorized to send questions and contract evidence to the approved model service, and answer text to the approved avatar service.</label><button type="button" disabled={!live.consent || live.state === "RECONNECTING"} onClick={live.connect}>Connect live Matt</button></>}
    </div>}</div>
    <div className="matt-nameplate"><span>OPERION / AVIATION INTELLIGENCE</span><h2>Matt</h2><p>Your intelligence colleague.</p></div>
    <div className="matt-character-status"><i aria-hidden="true"/>Conversation: {isIntroduction ? "introduction" : (live?.state || phase).toLowerCase()}</div>
    <p className="matt-studio-media-label">{stream ? "LIVE PROVIDER AUDIO / VIDEO" : isIntroduction ? "ONE-TIME INTRODUCTION / NOT AN ANSWER" : "LIVE SESSION NOT CONNECTED / NO VIDEO SUBSTITUTE"}</p>
    {isIntroduction && <div className="matt-intro-controls"><button type="button" onClick={() => { setIntroAudio(true); player.current.muted = false; player.current.play().catch(playbackFailed); }}>Enable introduction sound</button><button type="button" onClick={() => introduction.complete()}>Skip introduction</button></div>}
    {needsPlayback && <button className="matt-video-retry" type="button" onClick={retry}>Retry Matt video</button>}
  </section>;
}
