import assert from "node:assert/strict";
import test from "node:test";

import { buildFinancialImpact } from "../services/phase3/intelligence/financialImpactService.js";
import { readAnalysisRunFinancialImpact } from "../routes/analysisRunRoutes.js";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "33333333-3333-4333-8333-333333333333";

function fixture(overrides = {}) {
  return {
    contractId: "contract-1",
    analysisRunId: RUN_ID,
    clauses: [{ id: "clause-1", clause_number: "12.4", title: "Delay damages", source_text: "EUR 100,000 becomes payable following a supplier delay." }],
    obligations: [{ id: "obligation-1", description: "Supplier must meet the delivery milestone.", obligation_type: "delivery" }],
    deadlines: [{ id: "deadline-1", timing_expression: "21 days after scheduled delivery" }],
    risks: [{
      id: "risk-1",
      clause_id: "clause-1",
      affected_obligation_ids: ["obligation-1"],
      affected_deadline_ids: ["deadline-1"],
      title: "Supplier delay penalty",
      risk_category: "operational",
      severity: "high",
      confidence: 0.92,
      probability: null,
      condition: "Supplier misses the scheduled delivery date",
      consequence: "Contractual delay damages may become payable.",
      financial_exposure: { type: "quantified", amount: 100000, currency: "EUR", estimated_after_mitigation: 35000 },
      evidence: [{ evidence_id: "evidence-1", source: { id: "evidence-1", excerpt: "EUR 100,000 becomes payable following a supplier delay.", source_locator: "page:7", page_number: 7 } }],
    }],
    profile: { recommendations: [{ id: "recommendation-1", riskId: "risk-1", action: "Renegotiate the delay damages cap." }] },
    ...overrides,
  };
}

test("financial impact deterministically traces quantified event exposure and protected value", () => {
  const result = buildFinancialImpact(fixture());
  assert.equal(result.status, "quantified");
  assert.deepEqual(result.summary.eventDriven, { EUR: 100000 });
  assert.deepEqual(result.summary.protectedValue, { EUR: 65000 });
  assert.equal(result.impacts[0].calculationMethod, "direct_contract_amount");
  assert.equal(result.impacts[0].provenance.clause.number, "12.4");
  assert.equal(result.impacts[0].provenance.obligations[0].id, "obligation-1");
  assert.equal(result.impacts[0].provenance.evidence[0].evidenceId, "evidence-1");
  assert.deepEqual(result.impacts[0].path.map((node) => node.type), ["event", "condition", "clause", "financial_consequence", "mitigation", "remaining_exposure", "protected_value"]);
});

test("financial impact keeps currencies separate and does not invent mitigation value", () => {
  const input = fixture();
  delete input.risks[0].financial_exposure.estimated_after_mitigation;
  input.risks.push({ id: "risk-2", title: "Minimum rent", risk_category: "financial", severity: "medium", financial_exposure: { type: "quantified", amount: 50000, currency: "USD" }, evidence: [] });
  const result = buildFinancialImpact(input);
  assert.deepEqual(result.summary.totalQuantified, { EUR: 100000, USD: 50000 });
  assert.deepEqual(result.summary.protectedValue, {});
  assert.equal(result.actions[0].estimatedProtectedValue, null);
  assert.match(result.missingInputs.join(" "), /Post-mitigation amounts/);
});

test("financial impact reports empty and unquantified states honestly", () => {
  assert.equal(buildFinancialImpact(fixture({ risks: [] })).status, "empty");
  const result = buildFinancialImpact(fixture({ risks: [{ id: "risk-3", title: "Maintenance exposure", risk_category: "operational", severity: "high", financial_exposure: { type: "unquantified" }, evidence: [] }] }));
  assert.equal(result.status, "unquantified");
  assert.equal(result.impacts[0].baseAmount, null);
  assert.match(result.missingInputs[0], /No evidence-backed monetary amount/);
});

test("financial impact maps aviation late-return exposure without changing the amount", () => {
  const input = fixture();
  input.risks[0].title = "Late aircraft return";
  input.risks[0].risk_category = "Return conditions";
  const first = buildFinancialImpact(input);
  const second = buildFinancialImpact(input);
  assert.equal(first.impacts[0].category, "grounding_downtime");
  assert.equal(first.impacts[0].baseAmount, 100000);
  assert.deepEqual(first, second);
});

test("financial impact does not treat a whitespace-only condition as an event", () => {
  const input = fixture();
  input.risks[0].condition = "   ";
  const result = buildFinancialImpact(input);
  assert.equal(result.impacts[0].exposureType, "current_contractual");
  assert.equal(result.impacts[0].triggerEvent, null);
  assert.deepEqual(result.summary.currentContractual, { EUR: 100000 });
});

test("financial impact reader passes the authoritative tenant scope to every source", async () => {
  const calls = [];
  const reader = (name, value) => async (scope) => { calls.push([name, scope]); return value; };
  const result = await readAnalysisRunFinancialImpact({
    organizationId: ORG_ID,
    analysisRunId: RUN_ID,
    analysisRunRepository: { async getById(analysisRunId, organizationId) {
      assert.equal(analysisRunId, RUN_ID);
      assert.equal(organizationId, ORG_ID);
      return { id: RUN_ID, organization_id: ORG_ID, contract_id: "contract-1" };
    } },
    readers: {
      clauses: reader("clauses", []), obligations: reader("obligations", []), deadlines: reader("deadlines", []),
      risks: reader("risks", []), profile: reader("profile", null),
    },
  });
  assert.equal(result.status, "empty");
  assert.equal(result.contractId, "contract-1");
  assert.equal(calls.length, 5);
  assert.ok(calls.every(([, scope]) => scope.organizationId === ORG_ID && scope.analysisRunId === RUN_ID));
});

test("financial impact reader rejects a foreign analysis run before querying intelligence", async () => {
  let called = false;
  const unreachable = async () => { called = true; return []; };
  await assert.rejects(() => readAnalysisRunFinancialImpact({
    organizationId: ORG_ID,
    analysisRunId: RUN_ID,
    analysisRunRepository: { async getById() { return { id: RUN_ID, organization_id: "22222222-2222-4222-8222-222222222222" }; } },
    readers: { clauses: unreachable, obligations: unreachable, deadlines: unreachable, risks: unreachable, profile: unreachable },
  }), (error) => error.code === "ANALYSIS_RUN_NOT_FOUND");
  assert.equal(called, false);
});