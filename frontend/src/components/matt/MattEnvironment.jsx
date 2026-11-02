import React, { useCallback, useEffect, useRef, useState } from "react";

function hasLiveAudioVideo(stream) {
  return stream instanceof MediaStream && stream.getVideoTracks().some((track) => track.readyState === "live")
    && stream.getAudioTracks().some((track) => track.readyState === "live");
}

export default function MattEnvironment({ phase, onMediaError, onMediaStatus, stream = null }) {
  const player = useRef(null);
  const [needsPlayback, setNeedsPlayback] = useState(false);
  const playbackFailed = useCallback(() => {
    player.current?.pause();
    setNeedsPlayback(true);
    onMediaStatus("error");
    onMediaError(stream
      ? "Matt's live media stream is unavailable. Reconnect the authorized session; identity footage will not replace a failed live response."
      : "Matt's identity video could not start. Retry playback; contract evidence remains available. No live avatar connection is claimed.");
  }, [stream, onMediaError, onMediaStatus]);
  useEffect(() => {
    let active = true;
    const video = player.current;
    const play = () => video.play().catch((error) => {
      if (!active) return;
      if (!stream && document.visibilityState === "hidden" && ["AbortError", "NotAllowedError"].includes(error.name)) {
        onMediaStatus("buffering");
        return;
      }
      playbackFailed();
    });
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
      video.pause();
      video.srcObject = null;
    };
  }, [stream, playbackFailed, onMediaError, onMediaStatus]);
  function retry() {
    onMediaError("");
    onMediaStatus("loading");
    if (stream && !hasLiveAudioVideo(stream)) { playbackFailed(); return; }
    if (!stream) player.current.load();
    player.current.play().catch(playbackFailed);
  }
  return <section className="matt-environment od-card" aria-label="Matt video presence" data-state={phase}>
    <div className="matt-character"><video key={stream ? "stream" : "identity"} ref={player} autoPlay loop={!stream} muted={!stream} playsInline preload="metadata" aria-hidden="true" tabIndex={-1}
      onPlaying={() => {
        if (stream && !hasLiveAudioVideo(stream)) { playbackFailed(); return; }
        setNeedsPlayback(false); onMediaError(""); onMediaStatus("playing");
      }}
      onWaiting={() => onMediaStatus("buffering")}
      onError={playbackFailed}>
      {!stream && <source src="/matt/reference.mp4" type="video/mp4"/>}
    </video></div>
    <div className="matt-nameplate"><span>OPERION / AVIATION INTELLIGENCE</span><h2>Matt</h2><p>Your intelligence colleague.</p></div>
    <div className="matt-character-status"><i aria-hidden="true"/>Conversation: {phase.toLowerCase()}</div>
    <p className="matt-studio-media-label">{stream ? "LIVE MEDIA STREAM / REVIEW AUDIO AND VIDEO" : "PRERECORDED IDENTITY PREVIEW / NOT LIVE ANSWER VIDEO"}</p>
    {needsPlayback && <button className="matt-video-retry" type="button" onClick={retry}>Retry Matt video</button>}
  </section>;
}
