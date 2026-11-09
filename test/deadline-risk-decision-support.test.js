import assert from "node:assert/strict";
import test from "node:test";

import { deriveDeadlineRiskFindings, recommendRiskAction } from "../services/phase3/intelligence/riskDecisionSupport.js";

const DEADLINE = Object.freeze({
  id: "deadline-1",
  source_clause_id: "clause-1",
  source_evidence_id: "evidence-1",
  obligation_id: "obligation-1",
  deadline_type: "notice_period",
  timing_expression: "30 days before the Expiration Date",
  absolute_date: "2026-07-20",
  status: "calculated",
  computability: "calculable",
  review_status: "verified",
  confidence: 0.94,
  condition: null,
});

test("upcoming verified deadline produces a scoped, evidence-linked planning finding", () => {
  const [risk] = deriveDeadlineRiskFindings({
    deadlines: [DEADLINE],
    obligations: [{ id: "obligation-1", consequence: "Option notice may be unavailable after expiry." }],
    asOf: "2026-07-01",
  });

  assert.equal(risk.risk_type, "upcoming_deadline_exposure");
  assert.equal(risk.severity, "medium");
  assert.equal(risk.deadline_monitoring.daysRemaining, 19);
  assert.equal(risk.source_evidence_id, "evidence-1");
  assert.deepEqual(risk.affected_deadline_ids, ["deadline-1"]);
  assert.deepEqual(risk.affected_obligation_ids, ["obligation-1"]);
  assert.match(risk.recommended_action, /extension or notice decision/i);
  assert.match(risk.rationale, /does not establish performance.*breach/i);
  assert.equal(risk.probability, null);
});

test("passed deadline prompts verification without asserting breach", () => {
  const [risk] = deriveDeadlineRiskFindings({
    deadlines: [DEADLINE],
    asOf: "2026-07-21",
  });

  assert.equal(risk.risk_type, "overdue_deadline_exposure");
  assert.equal(risk.severity, "medium");
  assert.match(risk.description, /does not establish whether the action was completed/i);
  assert.match(risk.recommended_action, /does not establish that an option was missed/i);
});

test("redelivery deadlines recommend operational planning from the stored deadline type", () => {
  const [risk] = deriveDeadlineRiskFindings({
    deadlines: [{ ...DEADLINE, deadline_type: "redelivery_date", timing_expression: "Aircraft redelivery date" }],
    asOf: "2026-07-01",
  });

  assert.match(risk.recommended_action, /redelivery workstream owner/i);
  assert.match(risk.recommended_action, /technical, maintenance, and records requirements/i);
});

test("unverified, conditional and unresolved dates remain low severity and actionable", () => {
  const risks = deriveDeadlineRiskFindings({
    deadlines: [
      { ...DEADLINE, review_status: "pending" },
      { ...DEADLINE, id: "conditional-1", absolute_date: null, condition: "if the aircraft is accepted" },
      { ...DEADLINE, id: "unresolved-1", absolute_date: null, status: "awaiting_trigger", computability: "relative_event", trigger_expression: "expiration date" },
    ],
    asOf: "2026-07-01",
  });

  assert.deepEqual(risks.map((risk) => risk.risk_type), [
    "upcoming_deadline_exposure",
    "conditional_deadline_exposure",
    "unresolved_lifecycle_requirement",
  ]);
  assert.ok(risks.every((risk) => risk.severity === "low"));
  assert.ok(risks.every((risk) => risk.recommended_action));
});

test("rejected and unsupported-evidence deadlines do not produce findings", () => {
  const risks = deriveDeadlineRiskFindings({
    deadlines: [
      { ...DEADLINE, review_status: "rejected" },
      { ...DEADLINE, id: "no-evidence", source_evidence_id: null },
    ],
    asOf: "2026-07-01",
  });

  assert.deepEqual(risks, []);
});

test("existing risk linked to a deadline is enriched instead of duplicated", () => {
  const existingRisk = {
    id: "risk-existing",
    affected_deadline_ids: ["deadline-1"],
    metadata: {},
  };
  const result = deriveDeadlineRiskFindings({
    deadlines: [DEADLINE],
    existingRisks: [existingRisk],
    asOf: "2026-07-01",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "risk-existing");
  assert.equal(result[0].deadline_monitoring.daysRemaining, 19);
  assert.ok(result[0].recommended_action);
  assert.equal(existingRisk.deadline_monitoring, undefined);
});

test("risk action templates are deterministic and provide a safe fallback", () => {
  assert.match(recommendRiskAction("insurance_compliance_exposure"), /insurance certificates/i);
  assert.match(recommendRiskAction("unknown-risk"), /cited contractual evidence/i);
});
