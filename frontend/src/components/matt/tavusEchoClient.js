// Daily carries both tracks from the same private-room participant. No local TTS is used.
export function createTavusEchoClient({ createCall, credentials, onStream, onState, onError, createStream = (tracks) => new MediaStream(tracks) }) {
  const url = new URL(credentials.url);
  if (url.protocol !== "https:" || url.hostname !== "tavus.daily.co" || url.username || url.password || url.search || url.hash
    || typeof credentials.token !== "string" || !credentials.token || typeof credentials.conversationId !== "string") {
    throw new Error("Invalid private avatar room credentials.");
  }
  const call = createCall({ audioSource: false, videoSource: false, startAudioOff: true, startVideoOff: true });
  let disposed = false, participantId = null, stream = null, pending = false, speaking = false;
  let inference = null, sequence = -1, timer = null, interruption = null;
  const handlers = [];
  function bind(name, fn) { call.on(name, fn); handlers.push([name, fn]); }
  function fail(message) { if (!disposed) { clearTimeout(timer); onError(new Error(message)); } }
  function deadline(message, ms = 20000) { clearTimeout(timer); timer = setTimeout(() => fail(message), ms); }
  function send(event_type, properties) {
    const data = { message_type: "conversation", event_type, conversation_id: credentials.conversationId, ...(properties ? { properties } : {}) };
    if (new TextEncoder().encode(JSON.stringify(data)).length > 4096) throw new Error("The answer exceeds the live transport's 4 KB message limit.");
    call.sendAppMessage(data, participantId);
  }
  function update({ participant }) {
    if (disposed || participant.local) return;
    if (participantId && participant.session_id !== participantId) { fail("Unexpected participant in the private avatar room. Reconnect after review."); return; }
    participantId = participant.session_id;
    const audio = participant.tracks?.audio?.persistentTrack, video = participant.tracks?.video?.persistentTrack;
    if (audio?.readyState === "live" && video?.readyState === "live") {
      if (!stream || stream.getAudioTracks()[0] !== audio || stream.getVideoTracks()[0] !== video) {
        stream = createStream([audio, video]); onStream(stream);
      }
      if (!pending && !speaking) { clearTimeout(timer); onState("READY"); }
    } else if (stream) fail("The avatar's synchronized audio/video tracks were lost. No introduction footage will replace them.");
  }
  bind("participant-joined", update);
  bind("participant-updated", update);
  bind("participant-left", ({ participant }) => { if (participant.session_id === participantId) fail("The live avatar left the session."); });
  bind("error", () => fail("The live avatar transport failed. Reconnect the authorized session."));
  bind("left-meeting", () => fail("The live avatar session disconnected."));
  bind("network-connection", (event) => {
    if (event.event === "interrupted") { onState("RECONNECTING"); deadline("The live avatar could not reconnect."); }
    if (event.event === "connected" && stream && !pending && !speaking) onState("READY");
  });
  bind("app-message", ({ data, fromId }) => {
    if (disposed || fromId !== participantId || !data || data.message_type !== "conversation"
      || (data.conversation_id && data.conversation_id !== credentials.conversationId)
      || data.properties?.role !== "pal" || !Number.isSafeInteger(data.seq) || data.seq <= sequence
      || typeof data.inference_id !== "string") return;
    if (!["conversation.started_speaking", "conversation.stopped_speaking"].includes(data.event_type)) return;
    if (data.event_type === "conversation.started_speaking") {
      if (!pending || interruption) return;
      sequence = data.seq;
      inference = data.inference_id;
      pending = false; speaking = true;
      deadline("The avatar did not report completion of this answer.", 120000);
      onState("SPEAKING");
    } else {
      if (inference && data.inference_id !== inference) return;
      if (!pending && !speaking && !interruption) return;
      sequence = data.seq;
      pending = false; speaking = false; inference = null;
      clearTimeout(timer);
      if (interruption) { interruption.resolve(); interruption = null; onState("INTERRUPTED"); }
      else onState("READY");
    }
  });
  return {
    async connect() {
      deadline("The provider did not deliver synchronized audio/video tracks.");
      await call.join({ url: credentials.url, token: credentials.token });
      if (disposed) return;
      Object.values(call.participants()).forEach((participant) => update({ participant }));
    },
    speak(text, turnId) {
      if (disposed || !stream || pending || speaking || interruption) throw new Error("The live avatar is not ready for a new answer.");
      send("conversation.echo", { modality: "text", text, inference_id: turnId, done: true });
      pending = true;
      deadline("The avatar did not start speaking the generated answer.");
      onState("PROCESSING");
    },
    interrupt() {
      if (disposed || !stream || (!pending && !speaking)) return Promise.resolve();
      if (interruption) return interruption.promise;
      send("conversation.interrupt");
      let resolve;
      const promise = new Promise((done) => { resolve = done; });
      interruption = { promise, resolve };
      onState("INTERRUPTED");
      deadline("The provider did not acknowledge interruption. Reconnect before sending another answer.", 5000);
      return promise;
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(timer);
      interruption?.resolve();
      interruption = null;
      handlers.forEach(([name, fn]) => call.off(name, fn));
      onStream(null);
      try { await call.leave(); } finally { await call.destroy(); }
    },
  };
}
