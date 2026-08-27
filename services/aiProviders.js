import { aiGateway } from "./ai/aiGateway.js";

export function getProviderHealth() {
  return Object.fromEntries(Object.keys(aiGateway.providers).map((provider) => [provider, { healthy: true, last_failure: null }]));
}

export async function analyzeWithProviders(text, providerHint = null, options = {}) {
  const result = await aiGateway.request({
    organizationId: options.organizationId,
    provider: providerHint || undefined,
    operation: options.operation || "full_contract_analysis",
    input: text,
    structured: options.structured !== false,
    system: options.system,
  });
  return { provider: result.job?.provider || providerHint || "cache", analysis: result.result };
}
