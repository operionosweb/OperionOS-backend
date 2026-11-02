import test from "node:test";
import assert from "node:assert/strict";
import { createMattRealtimeSpeech } from "../src/components/matt/mattRealtimeSpeech.js";

const settle = () => new Promise((resolve) => setImmediate(resolve));
function fixture(options = {}) {
  const events = [], transcripts = [], interruptions = [], calls = [];
  const track = { kind: "audio", readyState: "live", enabled: true };
  let peer;
  class Peer {
    constructor() {
      peer = this; this.connectionState = "new"; this.bytes = 0;
      this.channel = { readyState: "connecting", close() { this.readyState = "closed"; } };
    }
    addTransceiver(captured, config) {
      assert.equal(captured, track); assert.equal(config.direction, "sendonly");
      return { sender: { getStats: async () => new Map([["audio", { type: "outbound-rtp", kind: "audio", bytesSent: this.bytes }]]) } };
    }
    createDataChannel(name) { assert.equal(name, "oai-events"); return this.channel; }
    async createOffer() { return { type: "offer", sdp: "v=0\r\nm=audio" }; }
    async setLocalDescription(offer) { this.localDescription = offer; }
    async setRemoteDescription(answer) { this.answer = answer; }
    close() { this.connectionState = "closed"; }
  }
  const client = createMattRealtimeSpeech({
    environment: { isSecureContext: true, navigator: { mediaDevices: { getUserMedia() {} } }, RTCPeerConnection: Peer },
    negotiate: async (sdp) => { calls.push(sdp); return { sdp: "v=0\r\nm=audio", expiresAt: new Date(Date.now() + 600000).toISOString() }; },
    terminate: async () => calls.push("end"),
    onEvent: (event) => events.push(event), onTranscript: (text) => transcripts.push(text),
    onSpeechStart: () => interruptions.push("interrupt"),
    ...options,
  });
  return {
    client, track, events, transcripts, interruptions, calls,
    peer: () => peer,
    connect() { peer.connectionState = "connected"; peer.channel.readyState = "open"; peer.onconnectionstatechange(); },
    event(type, fields = {}) { peer.channel.onmessage({ data: JSON.stringify({ type, ...fields }) }); },
  };
}
test("audio-only WebRTC sends the existing captured track; LISTENING requires outbound packets, not local permission", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  await f.client.listen(f.track);
  assert.equal(f.track.enabled, false);
  f.connect();
  t.mock.timers.tick(250); await settle();
  assert.equal(f.events.some(({ type }) => type === "LISTEN"), false);
  f.peer().bytes = 100;
  t.mock.timers.tick(250); await settle();
  assert.equal(f.track.enabled, true);
  assert.equal(f.events.at(-1).type, "LISTEN");
  f.client.dispose();
  assert.equal(f.track.enabled, false);
  assert.equal(f.peer().connectionState, "closed");
});
test("provider VAD interrupts first; only matching final transcripts invoke Operion, including follow-ups", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  await f.client.listen(f.track); f.connect(); f.peer().bytes = 100;
  t.mock.timers.tick(250); await settle();
  f.event("input_audio_buffer.speech_started", { item_id: "one" });
  f.event("conversation.item.input_audio_transcription.completed", { item_id: "wrong", transcript: "Wrong transcript" });
  f.event("conversation.item.input_audio_transcription.completed", { item_id: "one", transcript: "Which obligation applies?" });
  f.event("conversation.item.input_audio_transcription.completed", { item_id: "one", transcript: "Duplicate transcript" });
  await settle();
  assert.deepEqual(f.transcripts, ["Which obligation applies?"]);
  f.event("input_audio_buffer.speech_started", { item_id: "two" });
  f.event("conversation.item.input_audio_transcription.completed", { item_id: "two", transcript: "What evidence supports that?" });
  await settle();
  assert.equal(f.interruptions.length, 2);
  assert.deepEqual(f.transcripts, ["Which obligation applies?", "What evidence supports that?"]);
  assert.equal(f.track.enabled, true);
  f.client.dispose();
});
test("an interrupted turn cannot submit a stale transcript after a newer speech turn starts", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let release;
  const f = fixture({ onSpeechStart: () => new Promise((resolve) => { release = resolve; }) });
  await f.client.listen(f.track); f.connect(); f.peer().bytes = 100;
  t.mock.timers.tick(250); await settle();
  f.event("input_audio_buffer.speech_started", { item_id: "one" });
  await settle();
  f.event("conversation.item.input_audio_transcription.completed", { item_id: "one", transcript: "Old question" });
  const old = release;
  f.event("input_audio_buffer.speech_started", { item_id: "two" });
  old(); await settle();
  assert.deepEqual(f.transcripts, []);
  f.client.dispose();
});
test("temporary disconnect mutes capture; recovery requires new packets and preserves the same session", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  await f.client.listen(f.track); f.connect(); f.peer().bytes = 100;
  t.mock.timers.tick(250); await settle();
  f.peer().connectionState = "disconnected"; f.peer().onconnectionstatechange();
  assert.equal(f.track.enabled, false);
  assert.equal(f.events.at(-1).type, "RECONNECTING");
  f.connect(); t.mock.timers.tick(250); await settle();
  assert.equal(f.events.at(-1).type, "RECONNECTING");
  f.peer().bytes += 100; t.mock.timers.tick(250); await settle();
  assert.equal(f.events.at(-1).type, "LISTEN");
  assert.equal(f.calls.length, 1);
  f.client.dispose();
});
test("unexpected provider inference, failed transcription and malformed events close input without fallback", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const type of ["response.created", "error", "conversation.item.input_audio_transcription.failed"]) {
    const f = fixture();
    await f.client.listen(f.track);
    f.event(type);
    assert.equal(f.events.at(-1).type, "ERROR");
    assert.equal(f.track.enabled, false);
    assert.equal(f.peer().connectionState, "closed");
    assert.deepEqual(f.transcripts, []);
  }
});
test("stopping during SDP negotiation releases transmission and closes any late provider session", async () => {
  let release;
  const f = fixture({ negotiate: () => new Promise((resolve) => { release = resolve; }) });
  const connecting = f.client.listen(f.track);
  await settle();
  f.client.stop();
  release({ sdp: "v=0\r\nm=audio", expiresAt: new Date(Date.now() + 600000).toISOString() });
  await connecting;
  assert.equal(f.track.enabled, false);
  assert.equal(f.calls.filter((value) => value === "end").length, 2);
  assert.deepEqual(f.transcripts, []);
});
test("failed interruption closes input and prevents the queued final transcript reaching Operion", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture({ onSpeechStart: async () => { throw new Error("Unconfirmed cancellation"); } });
  await f.client.listen(f.track); f.connect(); f.peer().bytes = 100;
  t.mock.timers.tick(250); await settle();
  f.event("input_audio_buffer.speech_started", { item_id: "one" });
  f.event("conversation.item.input_audio_transcription.completed", { item_id: "one", transcript: "Do not submit this question" });
  await settle();
  assert.equal(f.events.at(-1).type, "ERROR");
  assert.equal(f.track.enabled, false);
  assert.deepEqual(f.transcripts, []);
});
