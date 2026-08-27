import { aiGateway } from "./aiGateway.js";

export async function requestLegacyAI({
  organizationId,
  operation,
  input,
  structured = true,
  provider,
  model,
  confirmation = false,
  system,
  deterministicResult,
  existingIntelligence,
}) {
  return aiGateway.request({
    organizationId,
    operation,
    input,
    structured,
    provider,
    model,
    confirmation,
    system,
    deterministicResult,
    existingIntelligence,
  });
}
