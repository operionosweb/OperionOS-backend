import assert from "node:assert/strict";
import test from "node:test";

import { answerContractQuestion } from "../services/phase3/intelligence/contractAssistantService.js";

const evidence = [{
  id: "evidence-1",
  excerpt: "If the Aircraft is returned late, Lessee shall pay EUR 25,000 for each day of delay.",
  page_number: 18,
  source_locator: "page:18:char:240-330",
}];

const intelligence = {
  clauses: [{ id: "clause-1", clause_number: "12.4", title: "Late redelivery", category: "delivery/redelivery", source_text: evidence[0].excerpt }],
  obligations: [{ id: "obligation-1", actor: "Lessee", action: "pay", object: "EUR 25,000 for each day of delay", modality: "mandatory", timing_expression: "for each day after the return date" }],
  deadlines: [{ id: "deadline-1", timing_expression: "on the scheduled return date", status: "unresolved", source_evidence_id: "evidence-1" }],
  risks: [{
    id: "risk-1",
    title: "Late aircraft return fee",
    risk_category: "financial",
    rationale: "Late redelivery creates an explicit daily payment obligation.",
    consequence: "EUR 25,000 is payable for each day of delay.",
    evidence: [{ evidence_id: "evidence-1", source: evidence[0] }],
  }],
  evidence,
};

test("answers a contract question from structured intelligence with source evidence", () => {
  const result = answerContractQuestion({ question: "What happens if we return the aircraft late?", ...intelligence });

  assert.equal(result.established, true);
  assert.equal(result.source, "structured_intelligence");
  assert.equal(result.intelligenceConsumption, 0);
  assert.match(result.answer, /EUR 25,000/);
  assert.equal(result.evidence[0].page_number, 18);
  assert.equal(result.evidence[0].source_locator, "page:18:char:240-330");
  assert.ok(result.findings.some((finding) => finding.id === "risk-1"));
});

test("does not answer when relevant intelligence has no evidence", () => {
  const result = answerContractQuestion({
    question: "What are the termination rights?",
    clauses: [{ id: "clause-2", title: "Termination", source_text: "Either party may terminate." }],
  });

  assert.equal(result.established, false);
  assert.match(result.answer, /does not establish/i);
  assert.deepEqual(result.evidence, []);
});

test("does not answer from unrelated contract intelligence", () => {
  const result = answerContractQuestion({ question: "Who provides hull insurance?", ...intelligence });
  assert.equal(result.established, false);
});

test("rejects empty and oversized questions", () => {
  assert.throws(() => answerContractQuestion({ question: " " }), (error) => error.code === "INVALID_ASSISTANT_QUESTION");
  assert.throws(() => answerContractQuestion({ question: "x".repeat(501) }), (error) => error.code === "INVALID_ASSISTANT_QUESTION");
});
