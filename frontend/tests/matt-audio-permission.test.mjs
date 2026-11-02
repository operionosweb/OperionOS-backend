import test from "node:test";
import assert from "node:assert/strict";
import { createMattMicrophone, supportsMattCapturedSpeech } from "../src/components/matt/mattMicrophone.js";
import { playMattAudio } from "../src/components/matt/mattAudio.js";
import { createMattVoice } from "../src/components/matt/mattVoice.js";

function fixture() {
  const states = [], errors = [], tracks = [], callbacks = new Map();
  let captures = 0, reject = null, resolveCapture = null, revoked = 0;
  const permission = { state: "prompt", addEventListener(name, fn) { callbacks.set(name, fn); }, removeEventListener(name) { callbacks.delete(name); } };
  const environment = { isSecureContext: true, SpeechRecognition: class {}, navigator: {
    userAgent: "Mozilla/5.0 Chrome/156.0.0.0 Safari/537.36",
    permissions: { async query() { return permission; } },
    mediaDevices: { getUserMedia(constraints) {
      captures++;
      assert.equal(constraints.video, false);
      if (reject) return Promise.reject(new DOMException("Test device failure", reject));
      const track = { kind: "audio", readyState: "live", enabled: true, handlers: {},
        stop() { this.readyState = "ended"; }, addEventListener(name, fn) { this.handlers[name] = fn; }, removeEventListener(name) { delete this.handlers[name]; } };
      tracks.push(track);
      const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
      return resolveCapture ? new Promise((resolve) => resolveCapture(resolve, stream)) : Promise.resolve(stream);
    } },
  } };
  const microphone = createMattMicrophone({ environment, onState: (state) => states.push(state), onError: (message) => errors.push(message), onRevoked: () => revoked++ });
  return { environment, microphone, states, errors, tracks, permission, callbacks, captures: () => captures, revoked: () => revoked,
    fail: (name) => { reject = name; }, delay: (handler) => { resolveCapture = handler; } };
}
test("capture starts only on acquire, requests audio only, and reuses a granted stream for follow-ups", async () => {
  const f = fixture();
  assert.equal(f.captures(), 0);
  const pending = f.microphone.acquire();
  assert.equal(f.captures(), 1);
  assert.deepEqual(f.states, ["REQUESTING"]);
  const track = await pending;
  assert.deepEqual(f.states, ["REQUESTING", "GRANTED"]);
  f.microphone.pause();
  assert.equal(track.enabled, false);
  assert.equal(await f.microphone.acquire(), track);
  assert.equal(f.captures(), 1);
  assert.equal(track.enabled, true);
  f.microphone.disable();
  assert.equal(track.readyState, "ended");
  await f.microphone.acquire();
  assert.equal(f.captures(), 2);
  f.microphone.dispose();
});
for (const [name, state, message] of [
  ["NotAllowedError", "DENIED", /site permissions/], ["NotFoundError", "DEVICE_NOT_FOUND", /No microphone/],
  ["NotReadableError", "DEVICE_BUSY", /Another application/], ["UnknownError", "ERROR", /capture failed/],
]) {
  test(`device error ${name} is explicit and retry can succeed`, async () => {
    const f = fixture(); f.fail(name);
    assert.equal(await f.microphone.acquire(), null);
    assert.equal(f.states.at(-1), state);
    assert.match(f.errors.at(-1), message);
    f.fail(null);
    assert.ok(await f.microphone.acquire());
    assert.equal(f.states.at(-1), "GRANTED");
    f.microphone.dispose();
  });
}
test("insecure/unsupported browsers cannot pretend to connect a captured recognition track", async () => {
  for (const agent of ["Mozilla/5.0 Chrome/134.0.0.0", "Mozilla/5.0 Android Chrome/156.0.0.0", "Mozilla/5.0 Version/18.0 Safari/605.1.15"]) {
    const f = fixture(); f.environment.navigator.userAgent = agent;
    assert.equal(supportsMattCapturedSpeech(f.environment), false);
    assert.equal(await f.microphone.acquire(), null);
    assert.equal(f.states.at(-1), "UNSUPPORTED");
    assert.equal(f.captures(), 0);
    f.microphone.dispose();
  }
  const f = fixture(); f.environment.isSecureContext = false;
  assert.equal(await f.microphone.acquire(), null);
  assert.equal(f.captures(), 0);
  f.microphone.dispose();
});
test("pending capture is shared and a late permission grant after disposal releases all tracks", async () => {
  const f = fixture();
  let finish, stream;
  f.delay((resolve, next) => { finish = resolve; stream = next; });
  const pending = f.microphone.acquire();
  assert.equal(f.microphone.acquire(), pending);
  f.microphone.dispose();
  finish(stream);
  assert.equal(await pending, null);
  assert.equal(f.tracks[0].readyState, "ended");
});
test("permission revocation and device disconnection release capture and notify the consumer", async () => {
  const f = fixture();
  await f.microphone.acquire();
  f.permission.state = "denied"; f.callbacks.get("change")();
  assert.equal(f.states.at(-1), "REVOKED");
  assert.equal(f.tracks[0].readyState, "ended");
  assert.equal(f.revoked(), 1);
  f.microphone.dispose();
  assert.equal(f.callbacks.size, 0);
  const g = fixture();
  await g.microphone.acquire(); g.tracks[0].handlers.ended();
  assert.equal(g.states.at(-1), "REVOKED");
  g.microphone.dispose();
});
test("LISTENING waits for recognition to start with the actual captured track", () => {
  let recognition, received;
  const events = [], track = { kind: "audio", readyState: "live", enabled: true };
  class Recognition { constructor() { recognition = this; } start(value) { received = value; } abort() {} }
  const voice = createMattVoice({ environment: { SpeechRecognition: Recognition }, onEvent: (event) => events.push(event), onTranscript() {}, onVoices() {} });
  voice.listen(track);
  assert.equal(received, track);
  assert.equal(events.length, 0);
  recognition.onstart();
  assert.equal(events.at(-1).type, "LISTEN");
  voice.dispose();
});
test("live playback unmutes, restores volume and retries a blocked play without a substitute", async () => {
  let blocked = true, plays = 0;
  const player = { muted: true, volume: 0, paused: true, srcObject: { getAudioTracks: () => [{ readyState: "live", enabled: true }] },
    async play() { plays++; if (blocked) throw new DOMException("Blocked", "NotAllowedError"); this.paused = false; } };
  await assert.rejects(playMattAudio(player), { name: "NotAllowedError" });
  blocked = false;
  await playMattAudio(player);
  assert.equal(player.muted, false); assert.equal(player.volume, 1); assert.equal(player.paused, false);
  await playMattAudio(player);
  assert.equal(plays, 3);
});
test("missing/disabled provider audio and silent playback failure are explicit", async () => {
  await assert.rejects(playMattAudio({ srcObject: { getAudioTracks: () => [] } }), /active audio track/);
  await assert.rejects(playMattAudio({ srcObject: { getAudioTracks: () => [{ readyState: "ended", enabled: true }] } }), /active audio track/);
  await assert.rejects(playMattAudio({ paused: true, srcObject: { getAudioTracks: () => [{ readyState: "live", enabled: true }] }, async play() {} }), /did not start/);
});
