export const providerState = {
  mistral: { status: "unknown", latency: null },
  openrouter: { status: "unknown", latency: null },
};

export async function runProviderHealthCheck() {
  for (const provider of Object.keys(providerState)) {
    const configured = provider === "mistral" ? process.env.MISTRAL_API_KEY : process.env.OPENROUTER_API_KEY;
    providerState[provider] = { status: configured ? "configured" : "missing_key", latency: null };
  }
  return providerState;
}

export function getHealthyProviders() {
  return Object.entries(providerState).filter(([, value]) => value.status === "healthy").map(([key]) => key);
}
