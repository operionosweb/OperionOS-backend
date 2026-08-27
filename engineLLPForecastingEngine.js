import { requestLegacyAI } from "./services/ai/legacyAIRequest.js";
export async function generateLLPForecast({ contract, organizationId, confirmation = false }) { const result = await requestLegacyAI({ organizationId, operation: "forecast_reasoning", input: JSON.stringify(contract), confirmation, system: "Return structured JSON for an aviation lease-life forecast." }); return result.result; }
