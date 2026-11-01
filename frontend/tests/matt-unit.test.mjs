import test from "node:test";
import assert from "node:assert/strict";
import { INITIAL_MATT_STATE, MATT_STATES, mattReducer, contextualQuestion } from "../src/components/matt/mattState.js";
import { createMattVoice } from "../src/components/matt/mattVoice.js";

test("nine states follow real events; stale responses and interruption retain context", () => {
  assert.equal(MATT_STATES.length, 9);
  let state = mattReducer(INITIAL_MATT_STATE, { type: "REQUEST", requestId: "1", question: "Review risks" });
  assert.equal(state.phase, "PROCESSING");
  state = mattReducer(state, { type: "OPERATION", requestId: "1", activity: "Retrieving evidence" });
  assert.equal(state.phase, "INVESTIGATING");
  assert.equal(mattReducer(state, { type: "RESULT", requestId: "old", result: {} }), state);
  state = mattReducer(state, { type: "RESULT", requestId: "1", result: { answer: "Evidence-backed answer", findings: [] } });
  assert.equal(state.phase, "PRESENTING");
  state = mattReducer(state, { type: "SPEECH_START" });
  assert.equal(state.phase, "SPEAKING");
  assert.equal(mattReducer(state, { type: "REVIEWED" }), state);
  state = mattReducer(state, { type: "SPEECH_END" });
  state = mattReducer(state, { type: "REVIEWED" });
  assert.equal(state.phase, "SUCCESS");
  state = mattReducer(state, { type: "INTERRUPT" });
  assert.equal(state.phase, "INTERRUPTED");
  assert.equal(state.messages.length, 2);
  assert.equal(state.result.answer, "Evidence-backed answer");
  assert.equal(mattReducer(state, { type: "RESULT", requestId: "1", result: {} }), state);
  state = mattReducer(state, { type: "LISTEN" });
  assert.equal(state.phase, "LISTENING");
  state = mattReducer(state, { type: "ERROR", error: "Permission denied" });
  assert.equal(state.phase, "ERROR");
  assert.equal(mattReducer(state, { type: "RESET" }).result, null);
});

test("follow-ups resolve current findings without misreading first-quarter queries", () => {
  const result = { findings: [{ type: "clause", label: "Rent" }, { type: "risk", label: "Insurance lapse" }, { type: "risk", label: "Maintenance records" }] };
  assert.match(contextualQuestion("Explain the second one", result), /risk: Insurance lapse/);
  assert.match(contextualQuestion("Explain the second risk", result), /Maintenance records/);
  assert.equal(contextualQuestion("First quarter fuel exposure", result), "First quarter fuel exposure");
  assert.throws(() => contextualQuestion("Explain the fourth finding", result), /not available/);
  assert.throws(() => contextualQuestion(`Explain the second finding ${"x".repeat(460)}`, result), /500-character/);
});

function voiceFixture() {
  const events = [], transcripts = [], voices = [], instances = [], spoken = [];
  let canceled = 0, removed = 0;
  class Recognition { constructor() { instances.push(this); } start() {} abort() { this.aborted = true; this.onend?.(); } }
  class Utterance { constructor(text) { this.text = text; } }
  const installed = [{ voiceURI: "local-matt", name: "Local voice", lang: "en-GB", localService: true }];
  const environment = { SpeechRecognition: Recognition, SpeechSynthesisUtterance: Utterance, speechSynthesis: {
    getVoices: () => installed, addEventListener() {}, removeEventListener() { removed++; },
    speak: (utterance) => spoken.push(utterance), cancel: () => { canceled++; },
  } };
  const adapter = createMattVoice({ environment, onEvent: (event) => events.push(event), onTranscript: (text) => transcripts.push(text), onVoices: (list) => voices.push(list) });
  return { adapter, events, transcripts, instances, spoken, voices, canceled: () => canceled, removed: () => removed };
}

test("microphone activation is explicit; transcript review does not submit; stale callbacks ignored", () => {
  const fixture = voiceFixture();
  assert.equal(fixture.instances.length, 0);
  fixture.adapter.listen();
  const recognition = fixture.instances[0];
  assert.equal(fixture.events.length, 0);
  recognition.onstart();
  assert.equal(fixture.events.at(-1).type, "LISTEN");
  recognition.onresult({ results: [Object.assign([{ transcript: "Review the maintenance risks" }], { isFinal: true })] });
  assert.deepEqual(fixture.transcripts, ["Review the maintenance risks"]);
  recognition.onend();
  assert.equal(fixture.events.at(-1).type, "TRANSCRIBED");
  fixture.adapter.listen();
  fixture.adapter.stop();
  const count = fixture.events.length;
  fixture.instances[1].onstart();
  fixture.instances[1].onresult({ results: [] });
  assert.equal(fixture.events.length, count);
  fixture.adapter.dispose();
  assert.equal(fixture.removed(), 1);
});

for (const error of ["not-allowed", "audio-capture", "network", "no-speech", "service-not-allowed"]) {
  test(`recognition ${error} is surfaced and text fallback preserved`, () => {
    const fixture = voiceFixture();
    fixture.adapter.listen();
    fixture.instances[0].onerror({ error });
    fixture.instances[0].onend();
    assert.equal(fixture.events.at(-1).type, "ERROR");
    assert.match(fixture.events.at(-1).error, /typing/);
    fixture.adapter.dispose();
  });
}

test("empty recognition end is not reported as a successful transcript", () => {
  const fixture = voiceFixture();
  fixture.adapter.listen();
  fixture.instances[0].onend();
  assert.equal(fixture.events.at(-1).type, "ERROR");
  fixture.adapter.dispose();
});

test("actual synthesis events drive speaking; voice/rate selection, errors and cancellation", () => {
  const fixture = voiceFixture();
  fixture.adapter.speak("Evidence-backed answer", { voiceURI: "local-matt", rate: 0.9 });
  assert.equal(fixture.spoken[0].voice.voiceURI, "local-matt");
  assert.equal(fixture.spoken[0].rate, 0.9);
  assert.equal(fixture.events.length, 0);
  fixture.spoken[0].onstart();
  assert.equal(fixture.events.at(-1).type, "SPEECH_START");
  fixture.adapter.stop();
  const count = fixture.events.length;
  fixture.spoken[0].onend();
  assert.equal(fixture.events.length, count);
  assert.equal(fixture.canceled(), 1);
  fixture.adapter.speak("Another answer");
  fixture.spoken[1].onerror({ error: "audio-busy" });
  assert.equal(fixture.events.at(-1).type, "ERROR");
  fixture.adapter.speak("Resume reading");
  fixture.spoken[2].onstart();
  fixture.spoken[2].onend();
  assert.equal(fixture.events.at(-1).type, "SPEECH_END");
  fixture.adapter.dispose();
});

test("unavailable native services fail explicitly", () => {
  const events = [];
  const adapter = createMattVoice({ environment: {}, onEvent: (event) => events.push(event), onTranscript() {}, onVoices() {} });
  adapter.listen(); adapter.speak("Answer");
  assert.deepEqual(adapter.supported, { input: false, output: false });
  assert.ok(events.every((event) => event.type === "ERROR"));
  adapter.dispose();
});
