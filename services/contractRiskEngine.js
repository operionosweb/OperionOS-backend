import { requestLegacyAI } from "./ai/legacyAIRequest.js";

function textOf(clause) {
	return String(clause?.clause_text || clause?.source_text || "").toLowerCase();
}

function typeOf(clause) {
	return String(clause?.clause_type || clause?.category || "").toLowerCase();
}

export function localRiskEngine(clauses = [], obligations = []) {
	let score = 0;
	const risks = [];
	const criticalFlags = [];
	const missingProtections = [];
	const clauseTypes = clauses.map(typeOf);

	for (const clause of clauses) {
		const type = typeOf(clause);
		const text = textOf(clause);

		if (type.includes("liability")) {
			score += 20;
			risks.push({ category: "liability", severity: "HIGH", issue: "Liability exposure detected" });
			if (text.includes("unlimited")) {
				score += 25;
				criticalFlags.push("uncapped_liability");
			}
		}
		if (text.includes("indemnify") || text.includes("indemnification")) {
			score += 15;
			risks.push({ category: "indemnity", severity: "HIGH", issue: "Broad indemnification obligations" });
			criticalFlags.push("broad_indemnification");
		}
		if (type.includes("termination")) {
			score += 10;
			risks.push({ category: "termination", severity: "MEDIUM", issue: "Termination clause risk detected" });
		}
		if (type.includes("insurance") && !text.includes("$") && !text.includes("million")) {
			score += 20;
			criticalFlags.push("missing_insurance_limit");
		}
	}

	if (!clauseTypes.some((type) => type.includes("force majeure"))) {
		missingProtections.push("force_majeure");
		score += 10;
	}
	if (!clauseTypes.some((type) => type.includes("governing"))) {
		missingProtections.push("governing_law");
		score += 10;
	}
	if (!clauseTypes.some((type) => type.includes("insurance"))) {
		missingProtections.push("insurance_clause");
		score += 15;
	}
	if (obligations.length > 15) {
		score += 10;
		criticalFlags.push("high_operational_burden");
	}

	const cappedScore = Math.min(100, score);
	const concerns = [
		...risks.map((risk) => risk.issue),
		...criticalFlags,
		...missingProtections.map((item) => `Missing protection: ${item}`),
	].slice(0, 10);
	const recommendations = [];
	if (criticalFlags.includes("uncapped_liability")) recommendations.push("Negotiate liability caps");
	if (criticalFlags.includes("missing_insurance_limit")) recommendations.push("Define minimum insurance coverage limits");
	if (missingProtections.includes("force_majeure")) recommendations.push("Add force majeure protections");
	if (missingProtections.includes("governing_law")) recommendations.push("Define governing law and jurisdiction");

	return {
		contract_risk_score: cappedScore,
		executive_summary: {
			overall_assessment: cappedScore >= 70
				? "High contractual risk exposure detected."
				: cappedScore >= 40
					? "Moderate contractual risk exposure detected."
					: "Low contractual risk exposure detected.",
			key_concerns: concerns,
			recommended_actions: recommendations,
		},
		financial_exposure: criticalFlags.includes("uncapped_liability")
			? "Potential uncapped financial exposure identified."
			: "No major financial exposure identified.",
		compliance_exposure: risks.some((risk) => risk.category === "compliance")
			? "Compliance obligations and regulatory exposure identified."
			: "No major compliance exposure identified.",
		operational_risk: obligations.length > 15
			? "High operational obligation volume detected"
			: "Operational obligation load within acceptable range",
		missing_protections: missingProtections,
		risks,
		critical_flags: criticalFlags,
	};
}

export async function analyzeContractRisk(input, legacyObligations) {
	const { clauses = [], obligations = [], organizationId, confirmation = false } = Array.isArray(input)
		? { clauses: input, obligations: legacyObligations || [] }
		: (input || {});

	try {
		const result = await requestLegacyAI({
			organizationId,
			operation: "risk_reasoning",
			input: JSON.stringify({ clauses, obligations }),
			confirmation,
			system: "Return structured JSON risk analysis.",
		});
		if (result?.success && result.result !== undefined) return result.result;
	} catch (error) {
		console.error("RISK ENGINE FAILURE:", error.message);
	}
	return localRiskEngine(clauses, obligations);
}
