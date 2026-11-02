export function mattSpeechConfiguration(env = process.env) {
  const provider = env.MATT_SPEECH_PROVIDER || "browser";
  if (provider === "browser") return { provider, enabled: true, missing: [] };
  const missing = [
    ["MATT_SPEECH_PROVIDER", provider === "openai-realtime"],
    ["MATT_REALTIME_ENABLED", env.MATT_REALTIME_ENABLED === "true"],
    ["MATT_REALTIME_APPROVAL_ID", Boolean(env.MATT_REALTIME_APPROVAL_ID?.trim())],
    ["MATT_AUDIO_PROCESSING_APPROVED", env.MATT_AUDIO_PROCESSING_APPROVED === "true"],
    ["MATT_REALTIME_BUDGET_APPROVED", env.MATT_REALTIME_BUDGET_APPROVED === "true"],
    ["OPENAI_API_KEY", Boolean(env.OPENAI_API_KEY?.trim())],
  ].filter(([, ready]) => !ready).map(([field]) => field);
  return { provider, enabled: missing.length === 0, missing };
}
