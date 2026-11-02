export function supportsMattRealtimeSpeech(environment = window) {
  return Boolean(environment.isSecureContext && environment.RTCPeerConnection && environment.navigator?.mediaDevices?.getUserMedia);
}

export function createMattRealtimeSpeech({ negotiate, terminate, onEvent, onTranscript, onSpeechStart, environment = window }) {
  let peer = null, channel = null, track = null, sender = null, revision = 0, ready = false;
  let timer = null, poll = null, expiry = null, activeItem = null, pendingInterrupt = Promise.resolve();
  let lastBytes = 0;
  let connection = null;
  let disposed = false;
  const completed = new Set();
  function stop() {
    const active = Boolean(peer);
    const previousConnection = connection;
    connection = null;
    revision++; ready = false; activeItem = null;
    clearTimeout(timer); clearTimeout(poll); clearTimeout(expiry);
    if (track) track.enabled = false;
    track = null;
    if (channel) { channel.onclose = null; channel.onerror = null; channel.onmessage = null; channel.close(); }
    if (peer) { peer.onconnectionstatechange = null; peer.ontrack = null; peer.close(); }
    peer = null; channel = null; sender = null;
    if (active && !disposed) onEvent({ type: "INPUT_STOPPED" });
    const stoppedRevision = revision;
    if (active) void terminate(previousConnection).catch(() => {
      console.error("Matt speech cleanup could not be confirmed");
      if (!disposed && revision === stoppedRevision) onEvent({ type: "ERROR", error: "Speech cleanup could not be confirmed. Disconnect Matt and ask an operator to check usage." });
    });
  }
  function fail(message) {
    stop();
    onEvent({ type: "ERROR", error: message });
  }
  function deadline(message) { clearTimeout(timer); timer = setTimeout(() => fail(message), 15000); }
  async function observe(ownRevision) {
    if (revision !== ownRevision || !peer || !sender) return;
    if (peer.connectionState === "connected" && channel?.readyState === "open" && track?.readyState === "live" && track.enabled) {
      try {
        const stats = await sender.getStats();
        if (revision !== ownRevision) return;
        const bytes = [...stats.values()].filter((report) => report.type === "outbound-rtp" && (report.kind === "audio" || report.mediaType === "audio")).reduce((total, report) => total + (report.bytesSent || 0), 0);
        if (bytes > lastBytes) {
          if (!ready) { ready = true; clearTimeout(timer); onEvent({ type: "LISTEN" }); }
        }
        lastBytes = bytes;
      } catch {
        if (revision === ownRevision) fail("Microphone transmission statistics are unavailable. Listening cannot be verified.");
        return;
      }
    }
    if (revision === ownRevision) poll = setTimeout(() => { void observe(ownRevision); }, 250);
  }
  function receive(message, ownRevision) {
    if (revision !== ownRevision) return;
    let event;
    try { event = JSON.parse(message.data); }
    catch { fail("The speech provider sent an invalid event."); return; }
    if (!event || typeof event.type !== "string") { fail("The speech provider sent an invalid event."); return; }
    if (event.type === "error" || event.type === "conversation.item.input_audio_transcription.failed") {
      fail("Real-time speech processing failed. No transcript was submitted."); return;
    }
    if (event.type === "response.created") { fail("Unexpected autonomous speech-provider response. Operion must generate every answer."); return; }
    if (!ready) return;
    if (event.type === "input_audio_buffer.speech_started") {
      if (typeof event.item_id !== "string" || !event.item_id || event.item_id.length > 200) { fail("The speech provider sent an invalid turn identifier."); return; }
      activeItem = event.item_id;
      try { pendingInterrupt = Promise.resolve(onSpeechStart()); }
      catch { fail("The current answer could not be interrupted. Speech input was stopped."); return; }
      pendingInterrupt = pendingInterrupt.catch(() => { if (revision === ownRevision) fail("The current answer could not be interrupted. Speech input was stopped."); });
    }
    if (event.type !== "conversation.item.input_audio_transcription.completed" || event.item_id !== activeItem || completed.has(event.item_id)) return;
    if (typeof event.transcript !== "string" || event.transcript.trim().length < 3 || event.transcript.length > 500) {
      fail("The speech transcript must contain 3 to 500 characters. Please reconnect speech input and ask a shorter question."); return;
    }
    completed.add(event.item_id);
    if (completed.size > 200) completed.delete(completed.values().next().value);
    const item = activeItem;
    void pendingInterrupt.then(() => {
      if (revision !== ownRevision || !ready || item !== activeItem) return;
      onEvent({ type: "TRANSCRIBED" });
      onTranscript(event.transcript.trim());
    });
  }
  return {
    supported: { input: supportsMattRealtimeSpeech(environment), output: false },
    async listen(capturedTrack) {
      if (disposed) return;
      stop();
      const ownRevision = revision;
      lastBytes = 0;
      if (!supportsMattRealtimeSpeech(environment) || capturedTrack?.kind !== "audio" || capturedTrack.readyState !== "live") {
        onEvent({ type: "ERROR", error: "Real-time speech requires a live captured microphone and WebRTC over HTTPS or localhost." }); return;
      }
      track = capturedTrack;
      track.enabled = false;
      onEvent({ type: "OPERATION", activity: "Connecting approved real-time speech; not yet transmitting." });
      try {
        peer = new environment.RTCPeerConnection();
        sender = peer.addTransceiver(track, { direction: "sendonly" }).sender;
        channel = peer.createDataChannel("oai-events");
        channel.onmessage = (event) => receive(event, ownRevision);
        channel.onerror = () => fail("The real-time speech event channel failed.");
        channel.onclose = () => fail("The real-time speech event channel closed.");
        peer.ontrack = () => fail("Unexpected speech-provider output track. Only Matt's approved avatar may supply output.");
        peer.onconnectionstatechange = () => {
          if (revision !== ownRevision) return;
          if (peer.connectionState === "failed" || peer.connectionState === "closed") { fail("The real-time audio connection failed. Reconnect speech input explicitly."); return; }
          if (peer.connectionState === "disconnected") {
            ready = false; track.enabled = false; activeItem = null;
            onEvent({ type: "RECONNECTING" });
            deadline("The real-time speech connection did not recover. Reconnect speech input.");
          }
          if (peer.connectionState === "connected") track.enabled = true;
        };
        deadline("The microphone did not establish an active real-time audio connection.");
        const offer = await peer.createOffer();
        if (revision !== ownRevision) return;
        await peer.setLocalDescription(offer);
        if (revision !== ownRevision) return;
        const answer = await negotiate(peer.localDescription.sdp);
        if (revision !== ownRevision) { await terminate(answer); return; }
        connection = answer;
        const expires = Date.parse(answer.expiresAt);
        if (!Number.isFinite(expires) || expires <= Date.now() || expires > Date.now() + 610000 || typeof answer.sdp !== "string") throw new Error("Invalid speech session lifetime or answer.");
        await peer.setRemoteDescription({ type: "answer", sdp: answer.sdp });
        if (revision !== ownRevision) return;
        expiry = setTimeout(() => fail("The approved speech session expired. Disconnect and reconnect Matt before continuing."), expires - Date.now());
        void observe(ownRevision);
      } catch {
        if (revision === ownRevision) fail("The approved real-time speech connection could not be established. Check configuration and reconnect explicitly.");
        else console.error("Matt cancelled speech negotiation or late cleanup failed");
      }
    },
    stop,
    dispose() { disposed = true; stop(); },
  };
}
