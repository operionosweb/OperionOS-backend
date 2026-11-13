import { aiGateway } from "./ai/aiGateway.js";

export function getProviderHealth() {
  return Object.fromEntries(Object.keys(aiGateway.providers).map((provider) => [provider, { healthy: true, last_failure: null }]));
}

export async function analyzeWithProviders(text, providerHint = null, options = {}) {
  const result = await aiGateway.request({
    organizationId: options.organizationId,
    userId: options.userId || null,
    provider: providerHint || undefined,
    operation: options.operation || "full_contract_analysis",
    input: text,
    structured: options.structured !== false,
    system: options.system,
    promptVersion: options.promptVersion || null,
    cache: options.cache !== false,
  });
  if (!result.success) {
    const status = ["INSUFFICIENT_INTELLIGENCE_BUDGET", "CONFIRMATION_REQUIRED", "AI_REQUEST_ALREADY_COMPLETED", "REQUEST_IN_PROGRESS"].includes(result.code) ? 409 : 503;
    throw Object.assign(new Error("AI analysis was not completed; no score was produced."), { code: result.code, status });
  }
  return { provider: result.job?.provider || providerHint || "cache", analysis: result.result };
}
