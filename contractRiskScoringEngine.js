import { requestLegacyAI } from "./services/ai/legacyAIRequest.js";
export async function generateRiskScoring({ contract, organizationId, confirmation = false }) { const result = await requestLegacyAI({ organizationId, operation: "risk_reasoning", input: JSON.stringify(contract), confirmation, system: "Return structured JSON risk scoring for this aviation contract." }); return result.result; }
