import { requestLegacyAI } from "./ai/legacyAIRequest.js";

function detectParty(text) {
	if (text.includes("lessor")) return "Lessor";
	if (text.includes("lessee")) return "Lessee";
	if (text.includes("club")) return "Club";
	return "Unknown";
}

function detectDeadline(text) {
	return text.match(/within\s+\d+\s+days/i)?.[0] || null;
}

export function localObligationEngine(clauses = []) {
	const obligations = [];
	for (const clause of clauses) {
		const type = String(clause.clause_type || "").toLowerCase();
		const text = String(clause.clause_text || clause.source_text || "").toLowerCase();
		const details = {
			clause_title: clause.clause_title || clause.title,
			responsible_party: detectParty(text),
			obligation_text: `${type || "general"} obligation detected`,
			deadline: detectDeadline(text),
		};
		if (type === "payment") obligations.push({ ...details, obligation_type: "payment", priority: "HIGH", risk_level: "HIGH" });
		if (type === "insurance") obligations.push({ ...details, obligation_type: "insurance", priority: "MEDIUM", risk_level: "MEDIUM" });
		if (type === "compliance") obligations.push({ ...details, obligation_type: "compliance", priority: "HIGH", risk_level: "HIGH" });
	}
	return obligations;
}

export async function extractObligations(clauses, organizationId, confirmation = false) {
	try {
		const result = await requestLegacyAI({
			organizationId,
			operation: "obligation_reasoning",
			input: JSON.stringify(clauses),
			confirmation,
			system: "Return a JSON object with an obligations array. Do not add prose.",
		});
		if (result?.success && result.result !== undefined) return result.result?.obligations || result.result || [];
	} catch (error) {
		console.error("OBLIGATION EXTRACTION FAILURE:", error.message);
	}
	return localObligationEngine(clauses);
}
