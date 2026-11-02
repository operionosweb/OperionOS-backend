import assert from "node:assert/strict";
import test from "node:test";
import { createLiveAvatarLiteProtocol } from "../providers/liveAvatarLiteProtocol.js";

const format = { sampleRate: 24000, channels: 1, bitsPerSample: 16 };
function fixture() {
  const sent = [], events = [];
  const protocol = createLiveAvatarLiteProtocol({ send: (message) => sent.push(JSON.parse(message)), onEvent: (event) => events.push(event) });
  return { protocol, sent, events };
}

test("LITE cannot send commands before the provider confirms a connected session", () => {
  const f = fixture();
  assert.throws(() => f.protocol.speak(Buffer.alloc(48), format), /not connected/);
  assert.deepEqual(f.sent, []);
  f.protocol.receive({ type: "session.state_updated", state: "connected" });
  const id = f.protocol.speak(Buffer.alloc(48), format);
  f.protocol.speak(Buffer.alloc(48), format);
  f.protocol.commit();
  assert.equal(f.sent[0].type, "agent.speak");
  assert.equal(f.sent[0].event_id, id);
  assert.equal(f.sent[1].event_id, id);
  assert.equal(f.sent[2].type, "agent.speak_end");
  assert.equal(Buffer.from(f.sent[0].audio, "base64").length, 48);
  assert.throws(() => f.protocol.speak(Buffer.alloc(48), format), /current utterance/);
});

test("LITE validates PCM format, sample alignment and complete packet size", () => {
  const f = fixture();
  f.protocol.receive({ type: "session.state_updated", state: "connected" });
  for (const [pcm, metadata] of [[Buffer.alloc(1), format], [Buffer.alloc(0), format], [Buffer.alloc(48), { ...format, sampleRate: 16000 }], [Buffer.alloc(48), { ...format, channels: 2 }]]) {
    assert.throws(() => f.protocol.speak(pcm, metadata), /PCM 16-bit/);
  }
  assert.throws(() => f.protocol.speak(Buffer.alloc(800000), format), /packet limit/);
  assert.deepEqual(f.sent, []);
});

test("interruptions invalidate late speaking events and allow a fresh utterance", () => {
  const f = fixture();
  f.protocol.receive({ type: "session.state_updated", state: "connected" });
  const old = f.protocol.speak(Buffer.alloc(48), format);
  f.protocol.receive({ type: "agent.speak_started", source_event_id: old });
  f.protocol.interrupt();
  assert.equal(f.sent.at(-1).type, "agent.interrupt");
  assert.equal(f.events.at(-1).type, "interrupt_requested");
  assert.throws(() => f.protocol.speak(Buffer.alloc(48), format), /acknowledgement/);
  assert.deepEqual(f.protocol.receive({ type: "agent.speak_started", source_event_id: old }), { ignored: "stale_utterance" });
  f.protocol.receive({ type: "agent.audio_buffer_cleared", source_event_id: f.sent.at(-1).event_id });
  assert.equal(f.events.at(-1).type, "interrupted");
  const current = f.protocol.speak(Buffer.alloc(48), format);
  assert.notEqual(current, old);
  assert.deepEqual(f.protocol.receive({ type: "agent.speak_ended", source_event_id: old }), { ignored: "stale_utterance" });
  f.protocol.receive({ type: "agent.speak_ended", source_event_id: current });
  assert.equal(f.events.at(-1).utteranceId, current);
});

test("provider errors, warnings and disconnections are explicit without retrying paid sessions", () => {
  const f = fixture();
  f.protocol.receive({ type: "session.state_updated", state: "connected" });
  f.protocol.receive({ type: "warning", warning: { message: "Video starvation" } });
  assert.equal(f.events.at(-1).message, "Video starvation");
  f.protocol.receive({ type: "error", error: { message: "Renderer failed" } });
  assert.equal(f.events.at(-1).message, "Renderer failed");
  f.protocol.disconnect();
  assert.throws(() => f.protocol.interrupt(), /not connected/);
  assert.throws(() => f.protocol.receive({ type: "session.state_updated", state: "invented" }), /Invalid/);
  assert.deepEqual(f.sent, []);
});

test("listening and heartbeat commands are explicit, with no autonomous spending or retry", () => {
  const f = fixture();
  f.protocol.receive({ type: "session.state_updated", state: "connected" });
  f.protocol.setListening(true);
  f.protocol.setListening(false);
  f.protocol.keepAlive();
  assert.deepEqual(f.sent.map(({ type }) => type), ["agent.start_listening", "agent.stop_listening", "session.keep_alive"]);
  assert.throws(() => f.protocol.setListening("true"), /explicitly/);
});
