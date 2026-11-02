// Only resolved by matt-live-browser.test.mjs. This is not a real provider acceptance fixture.
export default {
  createCallObject() {
    const listeners = new Map();
    let audio, oscillator, stream, inference, conversationId, seq = 0;
    window.__daily = { sent: [], destroyed: false };
    const emit = (event_type, properties) => listeners.get("app-message")?.({
      fromId: "synthetic-avatar",
      data: { message_type: "conversation", conversation_id: conversationId, event_type, seq: ++seq, inference_id: inference, properties: { role: "pal", ...properties } },
    });
    const call = {
      on(event, handler) { listeners.set(event, handler); },
      off(event) { listeners.delete(event); },
      async join({ url }) {
        conversationId = new URL(url).pathname.slice(1);
        const canvas = document.createElement("canvas");
        canvas.width = 640; canvas.height = 480;
        canvas.getContext("2d").fillRect(0, 0, 640, 480);
        audio = new AudioContext();
        await audio.resume();
        const gain = audio.createGain(), destination = audio.createMediaStreamDestination();
        oscillator = audio.createOscillator(); gain.gain.value = 0.05;
        oscillator.connect(gain); gain.connect(destination); oscillator.start();
        stream = new MediaStream([...canvas.captureStream(10).getTracks(), ...destination.stream.getAudioTracks()]);
      },
      participants() {
        return { avatar: { session_id: "synthetic-avatar", local: false,
          tracks: { audio: { subscribed: true, state: "playable", persistentTrack: stream.getAudioTracks()[0] }, video: { subscribed: true, state: "playable", persistentTrack: stream.getVideoTracks()[0] } } } };
      },
      sendAppMessage(message) {
        window.__daily.sent.push(message);
        if (message.event_type === "conversation.echo") {
          inference = message.properties.inference_id;
          queueMicrotask(() => emit("conversation.started_speaking"));
        } else if (message.event_type === "conversation.interrupt") {
          queueMicrotask(() => emit("conversation.stopped_speaking", { interrupted: true }));
        }
      },
      async leave() { stream?.getTracks().forEach((track) => track.stop()); },
      async destroy() { oscillator?.stop(); await audio?.close(); window.__daily.destroyed = true; },
    };
    window.__dailyFail = () => listeners.get("error")?.({ errorMsg: "Synthetic provider failure" });
    window.__dailyReplaceTracks = () => {
      const previous = stream.getTracks();
      stream = new MediaStream(previous.map((track) => track.clone()));
      listeners.get("participant-updated")?.({ participant: call.participants().avatar });
      previous.forEach((track) => track.stop());
    };
    window.__dailyNetwork = (event) => listeners.get("network-connection")?.({ event });
    return call;
  },
};
