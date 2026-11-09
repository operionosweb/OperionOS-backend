import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { deriveRedeliveryReview } from "../frontend/src/lib/redeliveryIntelligence.js";
import { buildContractProfile } from "../services/phase3/intelligence/contractProfileService.js";
import { segmentDeterministicClauses } from "../services/phase3/intelligence/deterministicClauseService.js";

function profileFor(text) {
  const clauses = segmentDeterministicClauses({
    text,
    organizationId: "11111111-1111-4111-8111-111111111111",
    contractId: "22222222-2222-4222-8222-222222222222",
    documentId: "33333333-3333-4333-8333-333333333333",
    documentVersionId: "44444444-4444-4444-8444-444444444444",
    analysisRunId: "55555555-5555-4555-8555-555555555555",
    pageBoundaries: "derived_unavailable",
    sourceLocator: (start, end) => `document:char:${start}-${end}`,
  });
  return buildContractProfile({ clauses });
}

test("redelivery extraction preserves explicit condition candidates and clause provenance", async () => {
  const profile = profileFor([
    "SYNTHETIC AIRCRAFT LEASE AGREEMENT",
    "1. RETURN CONDITIONS",
    "On the Expiration Date, the Lessee shall return the Aircraft to London Heathrow Airport in an airworthy condition.",
    "Each engine shall have 2,000 cycles remaining on each life limited part.",
    "The APU shall be serviceable and the landing gear shall have no outstanding overhaul.",
    "The Lessee shall provide complete technical records and airworthiness documentation.",
    "All approved modifications shall remain installed; damage and defects shall be repaired before return.",
    "The Lessor may inspect the Aircraft during the 20 days before redelivery.",
    "2. RECORDS DURING TERM",
    "Within five days after each shop visit, the Lessee shall provide maintenance records.",
  ].join("\n"));

  const redelivery = profile.redelivery;
  assert.equal(redelivery.returnLocation.value, "London Heathrow Airport");
  assert.equal(redelivery.returnLocation.status, "explicit");
  for (const category of [
    "aircraft_condition",
    "engine_condition",
    "llp",
    "apu_condition",
    "landing_gear_condition",
    "technical_records",
    "airworthiness_documentation",
    "modifications_repairs",
    "damage_defects",
    "inspection_acceptance",
    "preparation_notice",
  ]) {
    assert.ok(redelivery.requirements.some((item) => item.category === category), `Expected ${category}`);
  }
  assert.ok(redelivery.requirements.every((item) => item.evidence?.clauseId && item.evidence?.sourceLocation));
  assert.ok(redelivery.requirements.every((item) => item.evidence.evidenceText));
  assert.ok(redelivery.requirements.every((item) => !/after each shop visit/i.test(item.requirement)));
});

test("conflicting return locations remain source-linked and are not arbitrarily selected", () => {
  const profile = profileFor([
    "SYNTHETIC AIRCRAFT LEASE AGREEMENT",
    "1. RETURN CONDITIONS",
    "At redelivery, the Lessee shall return the Aircraft to London Heathrow Airport in an airworthy condition.",
    "2. SUPPLEMENTAL RETURN CONDITIONS",
    "At redelivery, the Lessee shall return the Aircraft to Shannon Airport in an airworthy condition.",
  ].join("\n"));

  assert.equal(profile.redelivery.returnLocation.status, "conflicting");
  assert.equal(profile.redelivery.returnLocation.value, null);
  assert.deepEqual(
    profile.redelivery.returnLocation.candidates.map((candidate) => candidate.value),
    ["London Heathrow Airport", "Shannon Airport"]
  );
  assert.ok(profile.redelivery.returnLocation.candidates.every((candidate) => candidate.evidence.length));
});

test("redelivery review maps only same-clause obligations and their existing deadlines, risks, evidence, and current actions", () => {
  const redelivery = {
    returnLocation: { value: null, status: "conflicting", candidates: [] },
    requirements: [{
      category: "technical_records",
      requirement: "Provide complete technical records at redelivery.",
      important: true,
      evidence: { clauseId: "clause-return", evidenceId: "evidence-contract", clauseNumber: "7", evidenceText: "Provide complete technical records at redelivery." },
    }],
  };
  const review = deriveRedeliveryReview({
    redelivery,
    obligations: [
      { id: "obligation-return", clause_id: "clause-return", description: "Provide return technical records." },
      { id: "obligation-other", clause_id: "clause-maintenance", description: "Provide shop visit records." },
    ],
    deadlines: [
      { id: "deadline-return", obligation_id: "obligation-return", timing_expression: "before redelivery" },
      { id: "deadline-other", obligation_id: "obligation-other", timing_expression: "after shop visit" },
    ],
    risks: [
      { id: "risk-return", obligation_id: "obligation-return", assessment_status: "pending_evidence", operational_evidence: [] },
      { id: "risk-other", obligation_id: "obligation-other", assessment_status: "fulfilled" },
    ],
    financialImpacts: [
      { id: "financial-return", sourceClauseId: "clause-return", description: "Return compensation", resultLabel: "USD 1,000" },
      { id: "financial-other", sourceClauseId: "clause-maintenance", description: "Unrelated reserve", resultLabel: "USD 2,000" },
    ],
    recommendations: [
      { id: "recommendation-current", source_risk_key: "risk-return", is_current: true, action: "Request the records." },
      { id: "recommendation-history", source_risk_key: "risk-return", is_current: false, action: "Old action." },
      { id: "recommendation-other", source_risk_key: "risk-other", is_current: true, action: "Unrelated action." },
    ],
  });

  const [condition] = review.requirements;
  assert.equal(condition.multipleStatements, false);
  assert.deepEqual(condition.obligations.map((item) => item.id), ["obligation-return"]);
  assert.deepEqual(condition.deadlines.map((item) => item.id), ["deadline-return"]);
  assert.deepEqual(condition.risks.map((item) => item.id), ["risk-return"]);
  assert.deepEqual(condition.recommendations.map((item) => item.id), ["recommendation-current"]);
  assert.deepEqual(condition.financialImpacts.map((item) => item.id), ["financial-return"]);
  assert.equal(review.returnLocation.status, "conflicting");
});

test("Workspace mounts redelivery review only for existing lease intelligence and keeps version scope explicit", async () => {
  const [workspace, panel] = await Promise.all([
    fs.readFile(new URL("../frontend/src/routes/ContractWorkspace.jsx", import.meta.url), "utf8"),
    fs.readFile(new URL("../frontend/src/components/intelligence/AviationRedeliveryIntelligence.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, /leaseIntelligence\.redelivery && <AviationRedeliveryIntelligence/);
  assert.match(workspace, /redelivery=\{leaseIntelligence\.redelivery\}/);
  assert.match(workspace, /leaseAssessment=\{aviationLeaseAssessment\}/);
  assert.match(panel, /currently selected contract analysis/);
  assert.match(panel, /No date has been inferred from lease expiry/);
  assert.match(panel, /Missing evidence is not proof of non-fulfilment/);
  assert.match(panel, /Suggested action — not a contractual requirement/);
  assert.match(panel, /Existing clause-linked financial analysis/);
  assert.match(workspace, /financialImpact=\{financialImpact\}/);
});
