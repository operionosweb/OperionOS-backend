export function createMattVoice({ environment = window, onEvent, onTranscript, onVoices }) {
  let recognition = null, utterance = null, disposed = false, generation = 0;
  const Recognition = environment.SpeechRecognition || environment.webkitSpeechRecognition;
  const synthesis = environment.speechSynthesis;
  const supported = { input: Boolean(Recognition), output: Boolean(synthesis && environment.SpeechSynthesisUtterance) };
  const emit = (event) => { if (!disposed) onEvent(event); };
  function refreshVoices() { if (!disposed) onVoices(synthesis?.getVoices() || []); }
  synthesis?.addEventListener("voiceschanged", refreshVoices);
  refreshVoices();

  function stop() {
    generation++;
    const previous = recognition;
    recognition = null;
    previous?.abort();
    if (utterance) { utterance = null; synthesis.cancel(); }
  }
  function listen(audioTrack) {
    stop();
    if (!supported.input) { emit({ type: "ERROR", error: "Speech recognition is not supported in this browser. Type your request instead." }); return; }
    const current = new Recognition(), ownGeneration = generation;
    recognition = current;
    current.lang = "en-GB";
    current.continuous = false;
    current.interimResults = false;
    const currentSession = () => !disposed && generation === ownGeneration && recognition === current;
    current.onstart = () => {
      if (currentSession()) {
        if (audioTrack && (audioTrack.readyState !== "live" || !audioTrack.enabled)) {
          stop();
          emit({ type: "ERROR", error: "The captured microphone is no longer active. Enable it and retry." });
        } else emit({ type: "LISTEN" });
      }
    };
    let transcribed = false;
    current.onresult = (event) => {
      if (!currentSession()) return;
      const transcript = Array.from(event.results).filter((result) => result.isFinal).map((result) => result[0].transcript).join(" ").trim();
      if (transcript) { transcribed = true; onTranscript(transcript); }
    };
    let failed = false;
    current.onerror = (event) => {
      if (!currentSession()) return;
      failed = true;
      const descriptions = { "not-allowed": "Microphone or speech-service permission was denied.", "service-not-allowed": "The browser speech service is not permitted.", "audio-capture": "No usable microphone is available.", "no-speech": "No speech was detected.", network: "The browser speech service could not connect.", aborted: "Microphone capture was stopped." };
      emit({ type: "ERROR", error: `${descriptions[event.error] || "Speech recognition failed."} You can continue by typing.` });
    };
    current.onend = () => {
      if (!currentSession()) return;
      recognition = null;
      if (!failed) emit(transcribed ? { type: "TRANSCRIBED" } : { type: "ERROR", error: "No usable speech transcript was received. You can continue by typing." });
    };
    try { if (audioTrack) current.start(audioTrack); else current.start(); }
    catch (error) { recognition = null; emit({ type: "ERROR", error: error.message || "Microphone activation failed. Type your request instead." }); }
  }
  function speak(text, { voiceURI = "", rate = 1 } = {}) {
    stop();
    if (!supported.output) { emit({ type: "ERROR", error: "Speech playback is unavailable in this browser. The complete answer remains in text." }); return; }
    const current = new environment.SpeechSynthesisUtterance(text), ownGeneration = generation;
    utterance = current;
    current.lang = "en-GB";
    current.rate = rate;
    current.voice = synthesis.getVoices().find((voice) => voice.voiceURI === voiceURI) || null;
    const currentSession = () => !disposed && generation === ownGeneration && utterance === current;
    current.onstart = () => { if (currentSession()) emit({ type: "SPEECH_START" }); };
    current.onend = () => { if (currentSession()) { utterance = null; emit({ type: "SPEECH_END" }); } };
    current.onerror = (event) => { if (currentSession()) { utterance = null; emit({ type: "ERROR", error: `Speech playback failed (${event.error || "audio unavailable"}). Your text answer is retained.` }); } };
    try { synthesis.speak(current); }
    catch (error) { utterance = null; emit({ type: "ERROR", error: error.message || "Speech playback could not start." }); }
  }
  return { supported, listen, speak, stop, dispose() { stop(); disposed = true; synthesis?.removeEventListener("voiceschanged", refreshVoices); } };
}
