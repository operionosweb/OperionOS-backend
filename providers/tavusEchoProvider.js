const API = "https://tavusapi.com/v2";

export function createTavusEchoProvider({ apiKey, palId, faceId, voiceId, fetchImpl = fetch }) {
  async function request(path, body, method = "POST") {
    const response = await fetchImpl(`${API}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: method === "GET" ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Object.assign(new Error("The live video provider request failed"), { code: "MATT_PROVIDER_FAILED" });
    if (path.endsWith("/end")) return;
    return response.json();
  }
  return {
    async create() {
      if (![palId, faceId, voiceId].every((id) => /^[a-zA-Z0-9_-]{1,128}$/.test(id || "")) || !apiKey) {
        throw Object.assign(new Error("Approved provider identity and fixed voice are missing"), { code: "MATT_NOT_CONFIGURED", status: 503 });
      }
      const pal = await request(`/pals/${palId}`, null, "GET");
      if (pal.layers?.tts?.voice_id !== voiceId || pal.layers?.tts?.external_voice_id || pal.greeting || pal.dynamic_greeting) {
        throw Object.assign(new Error("The approved PAL must use the fixed voice and no automatic greeting"), { code: "MATT_PAL_MISMATCH" });
      }
      const result = await request("/conversations", {
        pal_id: palId, face_id: faceId, require_auth: true,
        conversation_name: "Operion Matt", dynamic_greeting: false,
        properties: { max_call_duration: 600, participant_left_timeout: 0, participant_absent_timeout: 30, enable_recording: false },
      });
      try {
        const url = new URL(result.conversation_url);
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(result.conversation_id || "")
          || url.protocol !== "https:" || url.hostname !== "tavus.daily.co" || url.search || url.hash
          || url.username || url.password || !result.meeting_token || typeof result.meeting_token !== "string") {
          throw new Error("Invalid private provider session");
        }
        return { conversationId: result.conversation_id, url: url.href, token: result.meeting_token };
      } catch {
        if (/^[a-zA-Z0-9_-]{1,128}$/.test(result.conversation_id || "")) {
          await request(`/conversations/${result.conversation_id}/end`, {});
        }
        throw Object.assign(new Error("The provider returned an invalid private session"), { code: "MATT_PROVIDER_FAILED" });
      }
    },
    async end(conversationId) {
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(conversationId)) throw new TypeError("Invalid conversation identifier");
      await request(`/conversations/${conversationId}/end`, {});
    },
  };
}
