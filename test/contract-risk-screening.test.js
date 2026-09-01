import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { screenDeterministicRiskCandidates } from "../services/phase3/intelligence/contractRiskIntelligenceService.js";

function clause(sourceText) {
  return { id: crypto.randomUUID(), source_text: sourceText, source_evidence_id: crypto.randomUUID() };
}

test("deterministic screening finds material exposure and suppresses ordinary obligations", () => {
  const clauses = [
    clause("The Lessee shall maintain maintenance records."),
    clause("The Lessor may inspect the Aircraft."),
    clause("The parties shall cooperate."),
    clause("Late payment incurs a fee of EUR 100,000."),
    clause("The Lessee indemnifies the Lessor for all losses."),
  ];

  const first = screenDeterministicRiskCandidates({ clauses });
  const second = screenDeterministicRiskCandidates({ clauses });

  assert.deepEqual(first, second);
  assert.equal(first.length, 2);
  assert.deepEqual(first.map((risk) => risk.risk_type).sort(), ["broad_indemnity", "penalty_exposure"]);
  assert.deepEqual(first.find((risk) => risk.risk_type === "penalty_exposure").financial_exposure, {
    type: "quantified", currency: "EUR", amount: 100000, expression: "EUR 100,000",
  });
  assert.equal(first.find((risk) => risk.risk_type === "broad_indemnity").financial_exposure.amount, null);
  assert.ok(first.every((risk) => risk.probability === null));
});

test("contradictory notice periods cite both clauses without deciding control", () => {
  const clauses = [
    clause("The Lessee shall provide notice within 5 days after damage."),
    clause("The Lessee shall provide notice within 10 days after damage."),
  ];
  const risks = screenDeterministicRiskCandidates({ clauses });
  const contradiction = risks.find((risk) => risk.title === "Potential inconsistency between notice periods");

  assert.ok(contradiction);
  assert.equal(contradiction.source_clause_ids.length, 2);
  assert.match(contradiction.rationale, /does not determine which clause controls/i);
});

test("missing schedule language remains bounded to the analysed document", () => {
  const risks = screenDeterministicRiskCandidates({
    clauses: [clause("Maintenance standards are set out in Schedule 7.")],
  });

  assert.equal(risks.length, 1);
  assert.equal(risks[0].risk_type, "information_dependency");
  assert.equal(risks[0].description, "Schedule 7 was not located in the analysed document.");
  assert.equal(risks[0].status, "requires_review");
});

test("liability cap carve-outs preserve the stated cap without legal conclusions", () => {
  const risks = screenDeterministicRiskCandidates({
    clauses: [clause("Liability is capped at EUR 1 million except for fraud, confidentiality and indemnification.")],
  });
  const risk = risks.find((item) => item.title === "Liability cap carve-outs may remain uncapped");

  assert.ok(risk);
  assert.equal(risk.financial_exposure.cap.amount, 1_000_000);
  assert.equal(risk.financial_exposure.cap.currency, "EUR");
  assert.match(risk.description, /may remain uncapped/i);
});

test("termination, cure and renewal mechanisms preserve discretion and relative timing", () => {
  const terminationClause = clause("The Lessor may terminate following an uncured payment default after 10 days.");
  const renewalClause = clause("The Agreement automatically renews for one year unless either party provides notice at least 90 days before expiry.");
  const risks = screenDeterministicRiskCandidates({ clauses: [terminationClause, renewalClause] });
  const termination = risks.find((item) => item.risk_type === "cure_period_exposure");
  const renewal = risks.find((item) => item.risk_type === "automatic_renewal");

  assert.ok(termination);
  assert.match(termination.description, /may terminate/i);
  assert.doesNotMatch(termination.description, /will terminate|shall terminate/i);
  assert.match(termination.description, /10 days/i);
  assert.ok(renewal);
  assert.match(renewal.description, /90 days before expiry/i);
  assert.doesNotMatch(renewal.description, /\d{4}-\d{2}-\d{2}/);
});

test("deadline ambiguity is consumed without rewriting the contractual fact", () => {
  const source = clause("The Lessee shall notify the Lessor promptly after an incident.");
  const deadline = {
    id: crypto.randomUUID(), source_clause_id: source.id, deadline_type: "ambiguous",
    timing_expression: "promptly", computability: "ambiguous", confidence: 0.99,
  };
  const risks = screenDeterministicRiskCandidates({ clauses: [source], deadlines: [deadline] });
  const risk = risks.find((item) => item.risk_type === "ambiguous_deadline");

  assert.ok(risk);
  assert.equal(risk.affected_deadline_ids[0], deadline.id);
  assert.doesNotMatch(JSON.stringify(risk), /\b\d+\s+(calendar|business)?\s*days?\b/i);
});