import { requestLegacyAI } from "./ai/legacyAIRequest.js";
import { segmentDeterministicClauses } from "./phase3/intelligence/deterministicClauseService.js";

const TAXONOMY = {
	LIABILITY: ["liability", "limitation of liability", "damages"],
	INDEMNITY: ["indemnity", "indemnification", "hold harmless"],
	INSURANCE: ["insurance", "coverage"],
	TERMINATION: ["termination", "cancel", "default"],
	PAYMENT: ["payment", "fees", "financial", "rent"],
	MAINTENANCE: ["maintenance", "repair", "inspection"],
	COMPLIANCE: ["compliance", "regulatory", "aviation authority", "faa", "easa"],
	CONFIDENTIALITY: ["confidential", "non-disclosure", "nda"],
	FORCE_MAJEURE: ["force majeure", "acts of god"],
	GOVERNING_LAW: ["governing law", "jurisdiction", "venue"],
	OPERATIONAL: ["operation", "pilot", "crew", "dispatch"],
	DATA_PROTECTION: ["data protection", "privacy", "gdpr"],
};

function classifyClause(clause) {
	const text = `${clause.title || ""} ${clause.source_text || ""}`.toLowerCase();
	return Object.entries(TAXONOMY).find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))?.[0] || "GENERAL";
}

function normalizeClauses(clauses) {
	return (Array.isArray(clauses) ? clauses : []).map((clause) => {
		const clauseType = classifyClause(clause);
		const text = String(clause.source_text || clause.clause_text || "");
		const matches = (TAXONOMY[clauseType] || []).filter((keyword) => text.toLowerCase().includes(keyword)).length;
		return {
			clause_title: clause.clause_title || clause.title || "Unnamed Clause",
			clause_type: clauseType,
			original_clause_type: clause.original_clause_type || null,
			risk_level: Math.min(100, 50 + matches * 15),
			impact_level: clauseType === "GENERAL" ? "LOW" : "HIGH",
			summary: clause.summary || "",
			clause_text: clause.clause_text || clause.source_text || "",
			confidence_score: clause.confidence_score ?? clause.confidence ?? 0.5,
			source_reference: clause.evidence || null,
		};
	});
}

export function localClauseExtractor(text) {
	if (!text || text.length < 100) return [];
	const clauses = segmentDeterministicClauses({
		text,
		sourceLocator: (charStart, charEnd) => `legacy:text:char:${charStart}-${charEnd}`,
	});
	return normalizeClauses(clauses);
}

export async function extractClauses(text, organizationId, confirmation = false) {
	if (!text || typeof text !== "string") return [];
	try {
		const result = await requestLegacyAI({
			organizationId,
			operation: "clause_interpretation",
			input: text,
			confirmation,
			system: "Return a JSON object with a clauses array. Do not add prose.",
		});
		if (result?.success && result.result !== undefined) {
			return normalizeClauses(result.result?.clauses || result.result || []);
		}
	} catch (error) {
		console.error("CLAUSE EXTRACTION FAILURE:", error.message);
	}
	return localClauseExtractor(text);
}
