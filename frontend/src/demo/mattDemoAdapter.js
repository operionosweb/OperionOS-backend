import { DEMO_CONTRACTS } from "./DemoDataProvider";
import { answerContractQuestion } from "../../../services/phase3/intelligence/contractAssistantService.js";

export const MATT_DEMO_CATALOG = DEMO_CONTRACTS.slice(0, 1);

export function askMattDemo(contractId, question) {
  const contract = MATT_DEMO_CATALOG.find((item) => item.id === contractId);
  if (!contract) throw new Error("Select the supported illustrative lease. Other demo agreements reuse sample evidence and are not independently analysed.");
  const evidence = contract.evidence.map((source) => ({ id: source.id, excerpt: source.excerpt, source_locator: source.locator, page_number: source.page }));
  if (/\bfuel\b/i.test(question) && !evidence.some((source) => /\bfuel\b/i.test(source.excerpt))) {
    return { ...answerContractQuestion({ question }), demonstration: true };
  }
  return {
    ...answerContractQuestion({
      question, evidence,
      clauses: contract.clauses.map((item) => ({ id: item.id, title: item.title, clause_number: item.number, category: item.category, source_text: item.text, source_evidence_id: item.evidenceId })),
      obligations: contract.obligations.map((item) => ({ id: item.id, description: item.title, actor: item.actor, action: item.action, object: item.object, condition: item.condition, timing_expression: item.timing, source_evidence_id: item.evidenceId })),
      deadlines: contract.deadlines.map((item) => ({ id: item.id, timing_expression: item.timing, trigger_expression: item.trigger, status: item.status, computability: item.computability, source_evidence_id: item.evidenceId })),
      risks: contract.risks.map((item) => ({ id: item.id, title: item.title, rationale: item.rationale, consequence: item.consequence, source_evidence_id: item.evidenceIds[0] })),
    }),
    demonstration: true,
  };
}
