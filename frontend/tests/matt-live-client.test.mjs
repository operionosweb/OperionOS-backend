import test from "node:test";
import assert from "node:assert/strict";
import { createTavusEchoClient } from "../src/components/matt/tavusEchoClient.js";

function fixture() {
  const handlers = new Map(), sent = [], states = [], errors = [], streams = [];
  const audio = { kind: "audio", readyState: "live" }, video = { kind: "video", readyState: "live" };
  const participant = { session_id: "avatar", local: false, tracks: { audio: { persistentTrack: audio }, video: { persistentTrack: video } } };
  const call = {
    on(name, fn) { handlers.set(name, fn); }, off(name) { handlers.delete(name); },
    async join(options) { assert.equal(options.token, "private-room-token"); },
    participants: () => ({ avatar: participant }),
    sendAppMessage(data, recipient) { sent.push({ data, recipient }); },
    async leave() { sent.push("leave"); }, async destroy() { sent.push("destroy"); },
  };
  const client = createTavusEchoClient({ createCall: (options) => { assert.equal(options.audioSource, false); return call; },
    credentials: { conversationId: "conversation", url: "https://tavus.daily.co/room", token: "private-room-token" },
    onStream: (value) => streams.push(value), onState: (value) => states.push(value), onError: (error) => errors.push(error.message),
    createStream: (tracks) => ({ getAudioTracks: () => [tracks[0]], getVideoTracks: () => [tracks[1]] }),
  });
  const event = (event_type, seq, extras = {}) => handlers.get("app-message")({ fromId: "avatar", data: { message_type: "conversation", event_type, seq, inference_id: "provider-normalized-id", properties: { role: "pal" }, ...extras } });
  return { client, call, handlers, sent, states, errors, streams, event };
}
test("Daily adapter sends the exact orchestration answer, receives one audio/video stream and cleans up", async () => {
  const f = fixture();
  await f.client.connect();
  f.client.speak("This exact authorized answer must be spoken.", "turn-one");
  assert.equal(f.sent[0].data.properties.text, "This exact authorized answer must be spoken.");
  assert.equal(f.sent[0].data.event_type, "conversation.echo");
  assert.equal(f.sent[0].recipient, "avatar");
  f.event("conversation.started_speaking", 1);
  assert.equal(f.states.at(-1), "SPEAKING");
  f.event("conversation.stopped_speaking", 2);
  assert.equal(f.states.at(-1), "READY");
  assert.equal(f.streams[0].getAudioTracks()[0].kind, "audio");
  assert.equal(f.streams[0].getVideoTracks()[0].kind, "video");
  await f.client.dispose();
  assert.equal(f.handlers.size, 0);
  assert.deepEqual(f.sent.slice(-2), ["leave", "destroy"]);
});
test("interruption sends the real protocol command and waits for stopped speech before a follow-up", async () => {
  const f = fixture();
  await f.client.connect();
  f.client.speak("First answer", "turn-one");
  f.event("conversation.started_speaking", 1);
  const interrupted = f.client.interrupt();
  assert.equal(f.sent.at(-1).data.event_type, "conversation.interrupt");
  assert.throws(() => f.client.speak("Too soon", "turn-two"), /not ready/);
  f.event("conversation.stopped_speaking", 2, { properties: { role: "pal", interrupted: true } });
  await interrupted;
  f.client.speak("Follow-up answer", "turn-two");
  assert.equal(f.sent.at(-1).data.properties.text, "Follow-up answer");
  await f.client.dispose();
});
test("forged, malformed, wrong-conversation and stale provider events cannot change speaking state", async () => {
  const f = fixture();
  await f.client.connect();
  f.client.speak("Answer", "turn");
  f.handlers.get("app-message")({ fromId: "attacker", data: { event_type: "conversation.started_speaking" } });
  f.event("conversation.started_speaking", 1, { conversation_id: "other" });
  f.event("conversation.started_speaking", 1, { properties: { role: "user" } });
  assert.equal(f.states.at(-1), "PROCESSING");
  f.event("conversation.started_speaking", 2);
  f.event("conversation.stopped_speaking", 1);
  assert.equal(f.states.at(-1), "SPEAKING");
  await f.client.dispose();
});
test("Daily 4 KB packet limit is enforced before sending Unicode answer text", async () => {
  const f = fixture();
  await f.client.connect();
  assert.throws(() => f.client.speak("\u20ac".repeat(2000), "turn"), /4 KB/);
  assert.equal(f.sent.length, 0);
  await f.client.dispose();
});
