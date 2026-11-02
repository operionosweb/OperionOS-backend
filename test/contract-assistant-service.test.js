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

test("overlapping words cannot attach an unrelated source to an unlinked finding", () => {
  const result = answerContractQuestion({
    question: "What is the maintenance obligation?",
    obligations: [{ id: "unsupported", description: "Lessee shall fund all engine maintenance.", actor: "Lessee", action: "fund", object: "engine maintenance" }],
    evidence: [{ id: "other-clause", excerpt: "Lessor shall provide maintenance records.", source_locator: "clause:8" }],
  });
  assert.equal(result.established, false);
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.evidence, []);
  assert.match(result.limitations[0], /explicit evidence relationship/);
});

test("linked findings retain source identities and unsupported rankings cannot hide supported results", () => {
  const linkedSource = { id: "linked", excerpt: "Lessee shall inspect records.", source_locator: "section:7.2", page_number: 4 };
  const result = answerContractQuestion({
    question: "What are the key maintenance obligations?",
    obligations: [
      ...Array.from({ length: 5 }, (_, i) => ({ id: `unlinked-${i}`, description: "Key maintenance obligation", obligation_type: "maintenance" })),
      { id: "supported", description: "Inspect records", source_evidence_id: linkedSource.id },
    ],
    evidence: [linkedSource],
  });
  assert.equal(result.established, true);
  assert.deepEqual(result.findings.map(({ id }) => id), ["supported"]);
  assert.deepEqual(result.findings[0].evidence_ids, ["linked"]);
  assert.equal(result.findings[0].review_status, "requires_review");
  assert.equal(result.evidence[0].source_locator, "section:7.2");
});
