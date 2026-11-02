const origin = "https://api.openai.com/v1/realtime/calls";
const failure = (code, message) => Object.assign(new Error(message), { code, status: 502 });

export function mattSpeechSessionConfiguration() {
  return {
    type: "realtime",
    model: "gpt-realtime",
    output_modalities: ["text"],
    instructions: "Transcribe input only. Operion generates all answers separately. Never generate a response or call a tool.",
    tools: [],
    audio: { input: {
      transcription: { model: "gpt-4o-mini-transcribe" },
      turn_detection: { type: "server_vad", threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 600, create_response: false, interrupt_response: false },
    } },
  };
}

export function createOpenaiMattSpeechProvider({ apiKey, fetchImpl = fetch } = {}) {
  async function end(id) {
    if (!/^rtc_[a-zA-Z0-9_-]{1,160}$/.test(id)) throw failure("MATT_SPEECH_INVALID_CALL", "Invalid speech call identifier.");
    const response = await fetchImpl(`${origin}/${id}/hangup`, {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(20000), redirect: "error",
    });
    if (!response.ok) throw failure("MATT_SPEECH_CLEANUP_FAILED", "Speech call termination could not be confirmed. Ask an operator to check the account before reconnecting.");
  }
  return {
    async create(sdp) {
      if (!apiKey?.trim()) throw failure("MATT_SPEECH_NOT_CONFIGURED", "Approved server-side speech credentials are missing.");
      const body = new FormData();
      body.set("sdp", sdp);
      body.set("session", JSON.stringify(mattSpeechSessionConfiguration()));
      // Do not cancel creation on browser disconnect: retain the returned call ID for cleanup.
      let response;
      try { response = await fetchImpl(origin, {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body, signal: AbortSignal.timeout(20000), redirect: "error",
      }); } catch {
        throw Object.assign(failure("MATT_SPEECH_CREATION_UNCERTAIN", "Speech creation could not be confirmed. An operator must check possible account usage before retrying."), { uncertain: true });
      }
      if (!response.ok) throw failure("MATT_SPEECH_PROVIDER_FAILED", "The speech provider refused session creation. Check approved account configuration.");
      const location = response.headers.get("location") || "";
      const id = /^\/v1\/realtime\/calls\/(rtc_[a-zA-Z0-9_-]{1,160})$/.exec(location)?.[1]
        || /^https:\/\/api\.openai\.com\/v1\/realtime\/calls\/(rtc_[a-zA-Z0-9_-]{1,160})$/.exec(location)?.[1];
      if (!id) throw Object.assign(failure("MATT_SPEECH_INVALID_CALL", "The speech provider did not return a valid call handle. An operator must check possible orphan usage."), { uncertain: true });
      let answer;
      try {
        answer = await response.text();
        if (answer.length > 60000 || !answer.startsWith("v=0") || !answer.includes("m=audio")) throw failure("MATT_SPEECH_INVALID_SDP", "Invalid speech answer.");
      } catch {
        try { await end(id); }
        catch { throw Object.assign(failure("MATT_SPEECH_CLEANUP_FAILED", "Invalid speech answer and unconfirmed cleanup. An operator must check account usage."), { uncertain: true }); }
        throw failure("MATT_SPEECH_INVALID_SDP", "The speech provider returned an invalid session answer.");
      }
      return { id, sdp: answer };
    },
    end,
  };
}
