import { askMattDemo, MATT_DEMO_CATALOG } from "../../demo/mattDemoAdapter";
import { buildDocumentSearchIndex } from "../../lib/demoDocumentSearch";
import { makeAnswer } from "./mattWorkspaceIntelligence";
import { answerQuestion } from "./mattRelationshipIntelligence";

let index;
export function askMattWorkspace(question, contractId, contract) {
  if (contractId !== "demo-aircraft-lease") {
    if (!contract || contract.id !== contractId) throw new Error("The selected demonstration contract is unavailable.");
    return normalizeRelationship(answerQuestion(question, { contract, relatedContracts: [contract] }));
  }
  if (/\bfuel\b/i.test(question)) return askMattDemo(contractId, question);
  if (/summary|summar/i.test(question)) {
    const selected = MATT_DEMO_CATALOG[0];
    return normalizeRelationship(answerQuestion(question, { contract: selected, relatedContracts: [selected] }));
  }
  if (/key obligations|maintenance risks|trigger dates|\b(first|second|third|fourth)\b|Explain (risk|clause|obligation|deadline):/i.test(question)) return askMattDemo(contractId, question);
  index ||= buildDocumentSearchIndex().filter((item) => item.contractId === contractId);
  const response = makeAnswer(question, index);
  if (response.intent === "Unsupported" && /summary|summar|clauses|deadlines/i.test(question)) return askMattDemo(contractId, question);
  return {
    established: response.intent !== "Unsupported" && response.citations.length > 0,
    answer: response.content, demonstration: true,
    findings: response.records.map((record, i) => ({ type: response.intent.toLowerCase(), id: `${response.intent}-${i}`, label: `${record.label}: ${record.value}`, to: record.to })),
    evidence: response.citations.map((citation, i) => ({ id: `${citation.clauseId}-${i}`, excerpt: citation.evidence, source_locator: citation.clause, page_number: citation.page })),
    reviewRecommendations: response.recommendedActions, limitations: response.limitations,
    followUps: response.followUps, reasoning: response.reasoning,
  };
}
function normalizeRelationship(response) {
  return {
    established: response.type !== "unsupported" && response.evidence.length > 0,
    answer: response.summary, demonstration: true,
    findings: response.items.map((item, i) => ({ type: response.type, id: item.id || String(i), label: [item.title, item.rationale, item.timing].filter(Boolean).join(" - ") })),
    evidence: response.evidence.map((item) => ({ id: item.id, excerpt: item.excerpt, source_locator: item.locator, page_number: item.page })),
    reviewRecommendations: response.recommendation ? [[response.recommendation, null]] : [],
    limitations: ["Prepared demonstration relationship only. Other agreements reuse illustrative excerpts, not independently verified contract analyses."],
  };
}
