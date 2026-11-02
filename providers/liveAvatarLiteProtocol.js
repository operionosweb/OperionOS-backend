import { randomUUID } from "node:crypto";

// Protocol only: the caller must authorize and own the session, transport and PCM speech source.
export function createLiveAvatarLiteProtocol({ send, onEvent }) {
  if (typeof send !== "function" || typeof onEvent !== "function") {
    throw new TypeError("An authenticated transport sender and event observer are required");
  }
  let connected = false;
  let utteranceId = null;
  let committed = false;
  let pendingInterrupt = null;

  function command(type, payload = {}, eventId = randomUUID()) {
    if (!connected) throw new Error("LiveAvatar session is not connected");
    const message = { type, event_id: eventId, ...payload };
    if (Buffer.byteLength(JSON.stringify(message), "utf8") > 1_000_000) throw new RangeError("LiveAvatar command exceeds the 1 MB packet limit");
    send(JSON.stringify(message));
    return eventId;
  }

  return {
    speak(pcm, { sampleRate, channels, bitsPerSample } = {}) {
      if (!Buffer.isBuffer(pcm) || !pcm.length || pcm.length % 2 !== 0
        || sampleRate !== 24000 || channels !== 1 || bitsPerSample !== 16) {
        throw new TypeError("Speech must be PCM 16-bit, 24 kHz mono with complete samples");
      }
      if (committed) throw new Error("Wait for the current utterance to finish or interrupt it before starting another");
      if (pendingInterrupt) throw new Error("Wait for the provider's interruption acknowledgement");
      const id = utteranceId || randomUUID();
      command("agent.speak", { audio: pcm.toString("base64") }, id);
      utteranceId = id;
      return id;
    },
    commit() {
      if (!utteranceId || committed) throw new Error("An open utterance is required");
      command("agent.speak_end");
      committed = true;
    },
    interrupt() {
      pendingInterrupt = command("agent.interrupt");
      utteranceId = null;
      committed = false;
      onEvent({ type: "interrupt_requested" });
    },
    setListening(listening) {
      if (typeof listening !== "boolean") throw new TypeError("Listening must be explicitly true or false");
      command(listening ? "agent.start_listening" : "agent.stop_listening");
    },
    keepAlive() { command("session.keep_alive"); },
    receive(event) {
      if (!event || typeof event.type !== "string") throw new TypeError("Invalid LiveAvatar event");
      if (event.type === "session.state_updated") {
        if (!["new", "connected", "disconnected"].includes(event.state)) throw new TypeError("Invalid LiveAvatar connection state");
        connected = event.state === "connected";
        if (!connected) { utteranceId = null; committed = false; pendingInterrupt = null; }
        onEvent({ type: "connection", state: event.state });
      } else if (event.type === "error") {
        if (!event.source_event_id || event.source_event_id === utteranceId || event.source_event_id === pendingInterrupt) {
          utteranceId = null;
          committed = false;
          pendingInterrupt = null;
        }
        onEvent({ type: "error", message: event.error?.message || "LiveAvatar reported a provider error" });
      } else if (event.type === "warning") {
        onEvent({ type: "warning", message: event.warning?.message || "LiveAvatar reported a media warning" });
      } else if (event.type === "agent.audio_buffer_cleared") {
        if (!pendingInterrupt || event.source_event_id !== pendingInterrupt) return { ignored: "stale_interrupt" };
        pendingInterrupt = null;
        onEvent({ type: "interrupted" });
      } else if (["agent.speak_started", "agent.speak_ended", "agent.speak_interrupted"].includes(event.type)) {
        if (!connected || !utteranceId || event.source_event_id !== utteranceId) return { ignored: "stale_utterance" };
        onEvent({ type: event.type, utteranceId });
        if (event.type !== "agent.speak_started") { utteranceId = null; committed = false; }
      }
      return { accepted: true };
    },
    disconnect() {
      connected = false;
      utteranceId = null;
      committed = false;
      pendingInterrupt = null;
      onEvent({ type: "connection", state: "disconnected" });
    },
  };
}
