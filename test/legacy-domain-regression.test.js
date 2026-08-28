import assert from "node:assert/strict";
import test from "node:test";
import { localRiskEngine } from "../services/contractRiskEngine.js";
import { localClauseExtractor } from "../services/clauseParser.js";
import { localObligationEngine } from "../services/obligationParser.js";
import { buildExecutiveSummary } from "../services/legalCopilot.js";

test("legacy contract risk rules preserve flags, protections, and score cap", () => {
  const result = localRiskEngine([
    { clause_type: "liability", clause_text: "Unlimited liability applies." },
    { clause_type: "insurance", clause_text: "Insurance coverage is required." },
    { clause_type: "termination", clause_text: "Either party may terminate." },
  ], Array.from({ length: 16 }, () => ({})));

  assert.equal(result.contract_risk_score, 100);
  assert.deepEqual(result.critical_flags, [
    "uncapped_liability",
    "missing_insurance_limit",
    "high_operational_burden",
  ]);
  assert.deepEqual(result.missing_protections, ["force_majeure", "governing_law"]);
  assert.match(result.financial_exposure, /uncapped financial exposure/);
  assert.equal(result.operational_risk, "High operational obligation volume detected");
  assert.ok(result.executive_summary.recommended_actions.includes("Negotiate liability caps"));
});

test("legacy contract risk rules accept historical positional arguments", () => {
  const result = localRiskEngine([
    { clause_type: "payment", clause_text: "Rent is payable monthly." },
  ], []);

  assert.equal(result.contract_risk_score, 35);
  assert.deepEqual(result.missing_protections, ["force_majeure", "governing_law", "insurance_clause"]);
});

test("clause fallback preserves numbered segmentation and taxonomy", () => {
  const result = localClauseExtractor([
    "ARTICLE 1 Liability",
    "The lessee has unlimited liability.",
    "",
    "ARTICLE 2 Insurance",
    "The lessee shall maintain coverage within 30 days.",
  ].join("\n"));

  assert.equal(result.length, 2);
  assert.equal(result[0].clause_title, "Liability");
  assert.equal(result[0].clause_type, "LIABILITY");
  assert.equal(result[1].clause_type, "INSURANCE");
  assert.ok(result[1].source_reference);
});

test("obligation fallback preserves parties and deadlines", () => {
  const result = localObligationEngine([
    { clause_title: "Payment", clause_type: "payment", clause_text: "The lessee shall pay within 10 days." },
    { clause_title: "Insurance", clause_type: "insurance", clause_text: "The lessor maintains insurance." },
    { clause_title: "Compliance", clause_type: "compliance", clause_text: "The lessee shall comply." },
  ]);

  assert.equal(result.length, 3);
  assert.deepEqual(result.map((item) => item.responsible_party), ["Lessee", "Lessor", "Lessee"]);
  assert.equal(result[0].deadline, "within 10 days");
  assert.equal(result[1].risk_level, "MEDIUM");
});

test("structured executive summary builder returns metadata, summary, and bullets", () => {
  const result = buildExecutiveSummary({
    title: "Operational intelligence platform",
    context: "We connect contractual obligations to operational realities so teams can act before problems escalate",
    highlights: [
      "Extract obligations from complex aviation agreements",
      "Map operational events to contractual exposure",
      "Recommend next actions based on risk and consequence",
    ],
    tone: "premium",
  });

  assert.equal(result.meta.title, "Operational intelligence platform");
  assert.equal(result.meta.label, "Premium");
  assert.equal(result.bullets.length, 3);
  assert.ok(result.summary.includes("We connect contractual obligations to operational realities"));
  assert.equal(result.bullets[0].id, 1);
  assert.ok(result.bullets[0].text.includes("Extract obligations"));
});