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

test("financial impact exposes lease commitments without inventing total recurring exposure", () => {
  const result = buildFinancialImpact(fixture({
    risks: [],
    profile: { metadata: { leaseIntelligence: { commercialTerms: {
      baseRent: { amount: 250000, currency: "USD", frequency: "monthly", evidence: { evidenceId: "rent-evidence", evidenceText: "monthly rent of USD 250,000", sourceLocation: "clause:3", confidence: 0.98 } },
      securityDeposit: { amount: 750000, currency: "USD", evidence: { evidenceId: "security-evidence", evidenceText: "security deposit of USD 750,000", sourceLocation: "clause:3.1", confidence: 0.98 } },
      rentEscalation: { ratePercent: 2.5, formula: "Base Rent shall increase by 2.5 percent", evidence: { evidenceId: "escalation-evidence", evidenceText: "Base Rent shall increase by 2.5 percent", sourceLocation: "clause:3" } },
      maintenanceReserves: [{ coveredComponent: "airframe", rate: { amount: 300, currency: "USD", unit: "flight_hour" }, paymentFrequency: "monthly", evidence: { evidenceId: "reserve-evidence", evidenceText: "USD 300 per flight hour", sourceLocation: "clause:3.2" } }],
    } } } },
  }));
  assert.equal(result.status, "partial");
  assert.match(result.impacts.find((item) => item.category === "base_rent").resultLabel, /250,000(?:\.00)? \/ monthly/);
  assert.equal(result.impacts.find((item) => item.category === "maintenance_reserve").unit, "flight_hour");
  assert.deepEqual(result.summary.currentContractual, { USD: 750000 });
  assert.match(result.missingInputs.join(" "), /Recurring rates are shown but not aggregated/);
});

test("annual fixed rent escalation is reproducible and links its contract inputs", () => {
  const calculationTimestamp = "2026-11-09T08:00:00.000Z";
  const result = buildFinancialImpact(fixture({
    risks: [],
    obligations: [{ id: "rent-obligation", clause_id: "rent-clause", description: "Pay monthly base rent." }],
    deadlines: [
      { id: "rent-deadline", source_clause_id: "rent-clause", timing_expression: "fifth business day of each month", recurrence: { frequency: "monthly" } },
      { id: "unrelated-deadline", source_clause_id: "unrelated-clause", timing_expression: "before delivery" },
    ],
    profile: { metadata: { leaseIntelligence: { commercialTerms: {
      baseRent: {
        amount: 250000, currency: "USD", frequency: "monthly",
        evidence: { evidenceId: "rent-evidence", evidenceText: "Monthly base rent of USD 250,000", sourceLocation: "clause:3", clauseId: "rent-clause", clauseNumber: "3" },
      },
      rentEscalation: {
        ratePercent: 2.5, frequency: "annual", recurrenceRule: "On each anniversary of the Delivery Date",
        formula: "Base Rent shall increase by 2.5 percent",
        evidence: { evidenceId: "escalation-evidence", evidenceText: "On each anniversary of the Delivery Date, Base Rent shall increase by 2.5 percent.", sourceLocation: "clause:4", clauseId: "escalation-clause", clauseNumber: "4" },
      },
      paymentDates: [{
        value: "fifth business day of each month",
        evidence: { evidenceId: "payment-date-evidence", clauseId: "rent-clause" },
      }],
      maintenanceReserves: [{
        coveredComponent: "airframe",
        rate: { amount: 275, currency: "USD", unit: "flight_hour" },
        paymentFrequency: "monthly",
        evidence: { evidenceId: "reserve-evidence", evidenceText: "USD 275 per flight hour monthly", sourceLocation: "clause:5", clauseId: "reserve-clause" },
      }],
    } } } },
    calculationTimestamp,
  }));
  const escalation = result.impacts.find((item) => item.category === "escalation_indexation");
  const rent = result.impacts.find((item) => item.category === "base_rent");
  const reserve = result.impacts.find((item) => item.category === "maintenance_reserve");

  assert.equal(escalation.calculatedAmount, 256250);
  assert.equal(escalation.currency, "USD");
  assert.equal(escalation.calculationMethod, "fixed_annual_rate_one_period");
  assert.equal(escalation.calculationTimestamp, calculationTimestamp);
  assert.match(escalation.calculation, /250,000\.00.*2\.5.*256,250\.00/);
  assert.equal(escalation.calculationInputs[0].inputDate, null);
  assert.equal(escalation.calculationInputs[1].inputDate, null);
  assert.match(escalation.calculationLimitations[0], /effective date and input observation dates are not established/i);
  assert.deepEqual(escalation.provenance.clauses.map((item) => item.id), ["escalation-clause", "rent-clause"]);
  assert.deepEqual(escalation.sourceEvidenceIds, ["escalation-evidence", "rent-evidence"]);
  assert.deepEqual(result.summary.currentContractual, {});
  assert.equal(rent.paymentSchedule.dueRule, "fifth business day of each month");
  assert.equal(rent.paymentSchedule.nextPaymentDate, null);
  assert.equal(rent.paymentSchedule.occurrenceDatesGenerated, false);
  assert.deepEqual(rent.provenance.deadlines.map((item) => item.id), ["rent-deadline"]);
  assert.deepEqual(rent.sourceObligationIds, []);
  assert.equal(reserve.baseAmount, 275);
  assert.equal(reserve.calculatedAmount, null);
  assert.equal(reserve.unit, "flight_hour");
  assert.equal(result.summary.currentContractual.USD, undefined);
});

test("conflicting base-rent terms remain unquantified with all candidate evidence", () => {
  const result = buildFinancialImpact(fixture({
    risks: [],
    profile: { metadata: { leaseIntelligence: { commercialTerms: {
      baseRent: null,
      financialTermConflicts: [{
        field: "base_rent",
        description: "Multiple incompatible base-rent amounts or frequencies were found.",
        candidates: [
          { evidence: { evidenceId: "rent-evidence-1", evidenceText: "Monthly rent of USD 100,000", clauseId: "rent-clause-1" } },
          { evidence: { evidenceId: "rent-evidence-2", evidenceText: "Monthly base rent of USD 125,000", clauseId: "rent-clause-2" } },
        ],
      }],
    } } } },
  }));
  const conflict = result.impacts.find((item) => item.category === "financial_term_conflict");

  assert.equal(conflict.baseAmount, null);
  assert.deepEqual(conflict.sourceEvidenceIds, ["rent-evidence-1", "rent-evidence-2"]);
  assert.deepEqual(conflict.provenance.clauses.map((item) => item.id), ["rent-clause-1", "rent-clause-2"]);
  assert.ok(result.missingInputs.some((item) => /Conflicting base-rent terms/.test(item)));
});

test("conflicting escalation mechanisms are not calculated and retain candidate provenance", () => {
  const result = buildFinancialImpact(fixture({
    risks: [],
    profile: { metadata: { leaseIntelligence: { commercialTerms: {
      baseRent: { amount: 250000, currency: "USD", evidence: { evidenceId: "rent-evidence", evidenceText: "Monthly rent of USD 250,000", clauseId: "rent-clause" } },
      rentEscalation: {
        ratePercent: null,
        formulaType: "conflicting",
        formula: "Conflicting rent adjustment mechanisms were found; human review is required.",
        evidence: null,
        evidenceCandidates: [
          { evidenceId: "fixed-evidence", evidenceText: "Base Rent shall increase by 2 percent annually.", clauseId: "fixed-clause" },
          { evidenceId: "indexed-evidence", evidenceText: "Base Rent shall be adjusted annually by CPI.", clauseId: "indexed-clause" },
        ],
      },
    } } } },
    calculationTimestamp: "2026-11-09T08:00:00.000Z",
  }));
  const escalation = result.impacts.find((item) => item.category === "escalation_indexation");

  assert.equal(escalation.calculatedAmount, null);
  assert.equal(escalation.calculationMethod, "contractual_formula_requires_inputs");
  assert.ok(escalation.calculationLimitations.some((item) => /Conflicting rent-adjustment mechanisms/.test(item)));
  assert.deepEqual(escalation.sourceEvidenceIds, ["fixed-evidence", "indexed-evidence", "rent-evidence"]);
});

test("conflicting payment due rules remain visible and do not produce a payment date", () => {
  const result = buildFinancialImpact(fixture({
    risks: [],
    profile: { metadata: { leaseIntelligence: { commercialTerms: {
      baseRent: { amount: 250000, currency: "USD", evidence: { evidenceId: "rent-evidence", evidenceText: "Monthly rent of USD 250,000", clauseId: "rent-clause" } },
      paymentDates: [
        { value: "fifth business day of each month", evidence: { evidenceId: "payment-rule-1", evidenceText: "Payment due on the fifth business day", clauseId: "rent-clause" } },
        { value: "tenth calendar day of each month", evidence: { evidenceId: "payment-rule-2", evidenceText: "Payment due on the tenth calendar day", clauseId: "rent-clause" } },
      ],
    } } } },
  }));
  const rent = result.impacts.find((item) => item.category === "base_rent");

  assert.equal(rent.paymentSchedule.status, "requires_review");
  assert.equal(rent.paymentSchedule.dueRule, null);
  assert.deepEqual(rent.paymentSchedule.dueRuleCandidates, ["fifth business day of each month", "tenth calendar day of each month"]);
  assert.equal(rent.paymentSchedule.nextPaymentDate, null);
  assert.ok(rent.sourceEvidenceIds.includes("payment-rule-1"));
  assert.ok(rent.sourceEvidenceIds.includes("payment-rule-2"));
  assert.ok(result.missingInputs.some((item) => /Conflicting payment due rules/.test(item)));
});

test("indexed escalation mechanisms remain unquantified without sourced index observations", () => {
  const mechanisms = [
    ["cpi_index", /CPI\/index observations/],
    ["interest_rate_index", /benchmark observations/],
    ["foreign_exchange_index", /exchange-rate observations/],
  ];
  for (const [formulaType, limitation] of mechanisms) {
    const result = buildFinancialImpact(fixture({
      risks: [],
      profile: { metadata: { leaseIntelligence: { commercialTerms: {
        baseRent: { amount: 250000, currency: "USD", evidence: { evidenceId: "rent-evidence" } },
        rentEscalation: {
          ratePercent: null,
          formulaType,
          formula: "Base Rent shall be adjusted annually by the contractual index.",
          frequency: "annual",
          evidence: { evidenceId: `adjustment-${formulaType}`, evidenceText: "Base Rent shall be adjusted annually by the contractual index." },
        },
      } } } },
      calculationTimestamp: "2026-11-09T08:00:00.000Z",
    }));
    const escalation = result.impacts.find((item) => item.category === "escalation_indexation");

    assert.equal(escalation.calculatedAmount, null);
    assert.equal(escalation.calculationMethod, "contractual_formula_requires_inputs");
    assert.match(escalation.calculationLimitations.join(" "), limitation);
  }
});

test("rent escalation fails closed when annual cadence or base rent is missing", () => {
  const result = buildFinancialImpact(fixture({
    risks: [],
    profile: { metadata: { leaseIntelligence: { commercialTerms: {
      rentEscalation: {
        ratePercent: 2.5, formula: "Rent shall increase by 2.5 percent",
        evidence: { evidenceId: "escalation-evidence", evidenceText: "Rent shall increase by 2.5 percent" },
      },
    } } } },
  }));
  const escalation = result.impacts.find((item) => item.category === "escalation_indexation");

  assert.equal(escalation.calculatedAmount, null);
  assert.equal(escalation.calculationMethod, "contractual_formula_requires_inputs");
  assert.ok(result.missingInputs.some((item) => /annual escalation interval/.test(item)));
  assert.ok(result.missingInputs.some((item) => /base rent amount and currency/.test(item)));
});

test("fixed rent escalation requires a valid calculation timestamp", () => {
  const result = buildFinancialImpact(fixture({
    risks: [],
    profile: { metadata: { leaseIntelligence: { commercialTerms: {
      baseRent: { amount: 100000, currency: "USD", evidence: { evidenceId: "rent-evidence" } },
      rentEscalation: {
        ratePercent: 2, formula: "Base Rent shall increase by 2 percent annually",
        formulaType: "fixed_percentage", frequency: "annual",
        evidence: { evidenceId: "escalation-evidence", evidenceText: "Base Rent shall increase by 2 percent annually" },
      },
    } } } },
  }));
  const escalation = result.impacts.find((item) => item.category === "escalation_indexation");

  assert.equal(escalation.calculatedAmount, null);
  assert.ok(escalation.calculationLimitations.some((item) => /calculation timestamp was not supplied/i.test(item)));
});

test("rent escalation does not treat null or blank numeric inputs as zero", () => {
  const result = buildFinancialImpact(fixture({
    risks: [],
    profile: { metadata: { leaseIntelligence: { commercialTerms: {
      baseRent: { amount: null, currency: "USD", evidence: { evidenceId: "rent-evidence" } },
      rentEscalation: {
        ratePercent: null, frequency: "annual", formula: "Rent shall increase by a stated annual percentage",
        evidence: { evidenceId: "escalation-evidence", evidenceText: "Annual fixed rent adjustment" },
      },
    } } } },
  }));
  const escalation = result.impacts.find((item) => item.category === "escalation_indexation");

  assert.equal(escalation.calculatedAmount, null);
  assert.equal(escalation.calculationMethod, "contractual_formula_requires_inputs");
  assert.ok(result.missingInputs.some((item) => /valid non-negative fixed escalation rate/.test(item)));
  assert.ok(result.missingInputs.some((item) => /base rent amount and currency/.test(item)));
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