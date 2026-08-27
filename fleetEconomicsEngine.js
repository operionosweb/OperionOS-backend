import { requestLegacyAI } from "./services/ai/legacyAIRequest.js";
export async function generateFleetEconomics({ contract, organizationId, confirmation = false }) { const result = await requestLegacyAI({ organizationId, operation: "fleet_economics_reasoning", input: JSON.stringify(contract), confirmation, system: "Return structured JSON for aviation fleet economics." }); return result.result; }
