import { aiGateway } from "./ai/aiGateway.js";

export async function generateEmbedding(text = "", organizationId) {
  if (!text) return null;
  const result = await aiGateway.request({
    organizationId,
    operation: "embedding",
    input: text,
    structured: true,
    system: "Return a JSON object containing an embedding array for the supplied text.",
  });
  return result.result?.embedding || result.result || null;
}
