import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { mattLiveConfiguration } from "../services/mattLiveService.js";
import { mattSpeechConfiguration } from "../services/mattSpeechConfiguration.js";
import { mattDemoConfiguration } from "../services/mattDemoConfiguration.js";

export function validateMattLocal(env = process.env) {
  const configuration = mattLiveConfiguration(env);
  const speech = mattSpeechConfiguration(env);
  const demo = mattDemoConfiguration(env);
  const invalid = [];
  for (const name of ["TAVUS_MATT_ECHO_PAL_ID", "TAVUS_MATT_FACE_ID", "TAVUS_MATT_VOICE_ID"]) {
    if (env[name] && !/^[a-zA-Z0-9_-]{1,128}$/.test(env[name])) invalid.push(name);
  }
  for (const name of ["MATT_LIVE_APPROVAL_ID", "MATT_LIVE_ORGANIZATIONS", "TAVUS_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY"]) {
    if (env[name] && !env[name].trim()) invalid.push(name);
  }
  if (env.MATT_LIVE_ORGANIZATIONS && env.MATT_LIVE_ORGANIZATIONS.split(",").some((id) => !id.trim())) {
    invalid.push("MATT_LIVE_ORGANIZATIONS");
  }
  return {
    status: "BLOCKED",
    configurationStatus: configuration.enabled && speech.enabled && !invalid.length ? "VERIFIED" : "BLOCKED",
    missing: configuration.missing,
    invalid: [...new Set(invalid)],
    speech: { provider: ["browser", "openai-realtime"].includes(speech.provider) ? speech.provider : "unsupported", status: speech.enabled ? "VERIFIED" : "BLOCKED", missing: speech.missing },
    demo: { allowed: demo.allowed, readiness: demo.readiness, status: demo.enabled ? "VERIFIED" : "BLOCKED", missing: demo.missing,
      limits: { processSessionAuthorizations: demo.maxSessions, processIntelligenceUnits: demo.intelligenceBudget, concurrentRooms: 1, roomSeconds: 600, answersPerSession: 10, speechAttemptsPerSession: 3 } },
    inspected: "Inherited process environment only; no environment files loaded by this tool.",
    networkRequests: 0,
    liveSessionCreated: false,
    limitations: [
      "Configuration presence and syntax do not verify account access, deployed Echo mode, identity, voice, legal approval or budget.",
      "No model, database, provider API, microphone or speaker was contacted.",
      "Physical speech, actual transcription, genuine provider audio/video and human audibility remain BLOCKED.",
      "Text Echo receives generated answer text, not the user's microphone. Browser speech recognition is a separate processor.",
      "The optional real-time audio adapter is separately gated. No audio or identity is sent by this validator.",
      "Demo uses the same engine with server-only prepared sources. Public usage requires separate approval; quotas are process-local, not account-wide currency caps.",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateMattLocal();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.configurationStatus === "VERIFIED" ? 0 : 1;
}
