import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../../lib/apiClient";
import { createTavusEchoClient } from "./tavusEchoClient";
import { playMattAudio } from "./mattAudio";

export function useMattLive({ demo, organizationId, scopeKey }) {
  const [state, setState] = useState("READY"), [error, setError] = useState("");
  const [stream, setStream] = useState(null), [consent, setConsent] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(null);
  const [audioState, setAudioState] = useState("WAITING"), [audioError, setAudioError] = useState("");
  const outputEnabled = useRef(true), providerState = useRef("READY"), playbackRevision = useRef(0);
  const current = useRef(null), generation = useRef(0), controller = useRef(null), mediaRef = useRef(null);
  const request = useCallback((path, options = {}) => apiRequest(`/api/matt${path}`, { ...options, organizationId }), [organizationId]);
  const enableAudio = useCallback(async () => {
    if (!mediaRef.current?.srcObject) return false;
    const player = mediaRef.current, revision = ++playbackRevision.current;
    outputEnabled.current = true;
    try {
      await playMattAudio(player);
      if (revision !== playbackRevision.current) return false;
      setAudioState("ENABLED"); setAudioError("");
      if (providerState.current === "SPEAKING") setState("SPEAKING");
      return true;
    } catch (failure) {
      if (revision !== playbackRevision.current) return false;
      player.muted = true;
      setAudioState("BLOCKED");
      setAudioError(failure.name === "NotAllowedError"
        ? "The browser blocked live audio playback. Click Enable Matt audio, then check tab mute, speaker volume and your selected output device."
        : failure.message);
      if (providerState.current === "SPEAKING") setState("READY");
      return false;
    }
  }, []);
  const dispose = useCallback(async () => {
    const active = current.current;
    current.current = null;
    generation.current++;
    playbackRevision.current++;
    controller.current?.abort();
    controller.current = null;
    // Muting and detaching stops audible playback immediately; room termination is also required.
    setStream(null);
    if (mediaRef.current) mediaRef.current.muted = true;
    setAudioState("WAITING"); setAudioError(""); providerState.current = "READY";
    if (!active) return;
    const results = await Promise.allSettled([
      active.client?.dispose(),
      request(`/sessions/${active.id}`, { method: "DELETE", keepalive: true }),
    ]);
    if (results.some((result) => result.status === "rejected")) {
      console.error("Matt live session cleanup failed");
      setError("Live session cleanup could not be confirmed. Do not reconnect until the session expires or an operator confirms termination.");
      setState("ERROR");
    }
  }, [request]);
  useEffect(() => {
    setError(demo ? "Live video is disabled for this public prepared-data demo. No provider session has been created."
      : "Live Matt requires an approved provider identity, fixed voice, processing authority and budget. Connect only after authorization.");
    setState("READY"); setConsent(false); setPendingApproval(null);
    return () => { void dispose(); };
  }, [demo, scopeKey, dispose]);
  useEffect(() => {
    const leave = () => { void dispose(); };
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, [dispose]);
  const connect = useCallback(async () => {
    if (demo || !organizationId || !consent) {
      setError("This context is not authorized to start a live provider session.");
      setState("ERROR"); return;
    }
    if (current.current || controller.current) return;
    const ownGeneration = ++generation.current;
    const abort = new AbortController();
    controller.current = abort;
    setState("RECONNECTING"); setError("");
    try {
      const status = await request("/status", { signal: abort.signal });
      if (!status.enabled) throw new Error(status.message);
      // Do not abort the creation fetch: a late successful room must still be terminated.
      const credentials = await request("/sessions", { method: "POST", body: { consent: true } });
      if (generation.current !== ownGeneration) {
        await request(`/sessions/${credentials.id}`, { method: "DELETE" });
        return;
      }
      current.current = { id: credentials.id, client: null };
      const { default: Daily } = await import("@daily-co/daily-js");
      if (generation.current !== ownGeneration) return;
      const client = createTavusEchoClient({
        createCall: (options) => Daily.createCallObject(options), credentials,
        onStream: (next) => { if (generation.current === ownGeneration) setStream(next); },
        onState: (next) => {
          if (generation.current !== ownGeneration) return;
          providerState.current = next;
          if (next === "SPEAKING") {
            if (outputEnabled.current) void enableAudio();
            else { setAudioState("MUTED"); setState("READY"); }
            return;
          }
          setState(next);
        },
        onError: (failure) => {
          if (generation.current !== ownGeneration) return;
          setError(failure.message); setState("ERROR"); void dispose();
        },
      });
      current.current.client = client;
      await client.connect();
    } catch (failure) {
      if (generation.current === ownGeneration) {
        setError(failure.message || "The live avatar connection failed."); setState("ERROR");
        await dispose();
      }
    } finally { if (controller.current === abort) controller.current = null; }
  }, [demo, organizationId, consent, request, dispose, enableAudio]);
  const interrupt = useCallback(async () => {
    playbackRevision.current++;
    if (mediaRef.current) { mediaRef.current.muted = true; mediaRef.current.pause(); }
    const active = current.current;
    if (!active) return;
    setState("INTERRUPTED");
    const results = await Promise.allSettled([
      request(`/sessions/${active.id}/interrupt`, { method: "POST" }),
      active.client?.interrupt(),
    ]);
    if (results.some((result) => result.status === "rejected")) {
      setError("Live interruption could not be confirmed. The session has been closed.");
      setState("ERROR"); await dispose();
    }
  }, [request, dispose]);
  return { state, setState, error, stream, mediaRef, consent, pendingApproval, audioState, audioError, enableAudio,
    muteAudio() {
      playbackRevision.current++; outputEnabled.current = false;
      if (mediaRef.current) mediaRef.current.muted = true;
      setAudioState("MUTED");
      if (providerState.current === "SPEAKING") setState("READY");
    },
    setConsent(value) { setConsent(value); if (!value) void dispose(); },
    connect: !demo && organizationId ? connect : null,
    connected: Boolean(stream),
    interrupt, dispose,
    async ask(analysisRunId, question, signal, confirmation = false) {
      const active = current.current;
      if (!active?.client || !stream) throw new Error("Live Matt is not connected.");
      const ownGeneration = generation.current;
      setState("PROCESSING");
      setPendingApproval(null);
      let result;
      try {
        result = await request(`/sessions/${active.id}/turns`, { method: "POST", body: { analysisRunId, question, confirmation }, signal });
      } catch (failure) {
        if (failure.payload?.code === "MATT_CONFIRMATION_REQUIRED" && Number.isFinite(failure.payload.estimatedIntelligence)) {
          setPendingApproval({ question, estimatedIntelligence: failure.payload.estimatedIntelligence });
        }
        throw failure;
      }
      setPendingApproval(null);
      signal?.throwIfAborted();
      if (generation.current !== ownGeneration) throw new DOMException("Live context changed", "AbortError");
      const answer = result?.assistant;
      if (!answer || answer.source !== "ai_gateway" || typeof answer.answer !== "string" || !answer.answer.trim()
        || answer.answer.length > 2000 || typeof answer.established !== "boolean" || !Array.isArray(answer.evidence)
        || !Array.isArray(answer.findings) || typeof result.turnId !== "string" || !result.turnId) {
        throw new Error("The generated live response is invalid. No text was sent to the avatar.");
      }
      active.client.speak(result.assistant.answer, result.turnId);
      return result.assistant;
    },
  };
}
