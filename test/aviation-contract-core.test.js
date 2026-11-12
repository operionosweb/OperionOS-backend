import assert from "node:assert/strict";
import test from "node:test";
import {
  AVIATION_CLAUSE_TAXONOMY,
  buildAviationContractCore,
  evaluateFuelPriceScenario,
} from "../domain/contractIntelligence/aviationContractCore.js";
import { buildContractProfile } from "../services/phase3/intelligence/contractProfileService.js";
import { segmentDeterministicClauses } from "../services/phase3/intelligence/deterministicClauseService.js";
import { createContractProfileRepository } from "../repositories/phase3/contractProfileRepository.js";
import { createContractIntelligencePipeline } from "../services/phase3/analysis/contractIntelligencePipeline.js";

const scope = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  contractId: "22222222-2222-4222-8222-222222222222",
  documentId: "33333333-3333-4333-8333-333333333333",
  documentVersionId: "44444444-4444-4444-8444-444444444444",
  analysisRunId: "55555555-5555-4555-8555-555555555555",
  fence: {
    workerId: "66666666-6666-4666-8666-666666666666",
    executionId: "77777777-7777-4777-8777-777777777777",
    generation: "1",
    token: "a".repeat(64),
  },
};
const fuelText = `1 FUEL SURCHARGE
Base fuel surcharge: USD 1000 per flight
Baseline fuel price: USD 0.80 per litre
Fuel price reference: Example Jet A-1 Index
Adjustment frequency: monthly
Adjusted fuel surcharge = Base fuel surcharge * (Current fuel price / Baseline fuel price).`;
const source = (text = fuelText) => ({
  clauseId: "clause-fuel", clauseNumber: "1", title: "FUEL SURCHARGE", text,
  evidenceId: "evidence-fuel", pageNumber: 3, sourceLocation: "page:3:char:200-450", charStart: 200, charEnd: 450,
});
const mechanismFor = (text = fuelText) => buildAviationContractCore([source(text)]).fuelMechanisms[0];
const input = (overrides = {}) => ({
  kind: "fuel_price", origin: "hypothetical", value: 1.2, currency: "USD", unit: "litre",
  reference: "Example Jet A-1 Index", asOf: "2026-11-01", sourceLabel: "Hypothetical price stress, not a market observation",
  ...overrides,
});
function segment(text) {
  return segmentDeterministicClauses({
    ...scope, text, pageBoundaries: "explicit",
    pages: [{ id: "page-3", page_number: 3, char_start: 0, char_end: text.length }],
    sourceLocator: (start, end) => `page:3:char:${start}-${end}`,
  });
}

test("aviation taxonomy is multi-label, extensible and keeps topic mentions separate from confirmed facts", () => {
  const text = "Payment, termination, renewal, liability, indemnity, insurance, maintenance, delivery, redelivery, maintenance reserves, SLA, performance, compensation, force majeure, governing law and disputes. Fuel surcharge.";
  const core = buildAviationContractCore([source(text)]);
  assert.equal(core.topics.length, 16);
  assert.equal(new Set(AVIATION_CLAUSE_TAXONOMY.map((topic) => topic.id)).size, 16);
  assert.ok(core.topics.every((topic) => topic.status === "identified_for_review"));
  assert.ok(core.topics.every((topic) => topic.evidence[0].originalClauseText === text));
  assert.ok(core.recommendations.every((item) => item.action && item.reason && item.suggestedOwner && item.basis === "interpretation" && item.evidence.length));
  assert.equal(core.marketFeedStatus, "not_connected");
});

test("missing topics, dates and locations remain unknown rather than invented", () => {
  const core = buildAviationContractCore([{ text: "The Lessee shall pay the rent.", clauseId: "c1" }]);
  assert.equal(core.topics.find((item) => item.id === "payment").status, "identified_for_review");
  assert.equal(core.topics.find((item) => item.id === "insurance").status, "not_established");
  assert.deepEqual(core.topics.find((item) => item.id === "insurance").evidence, []);
  assert.equal(core.recommendations.length, 1);
  assert.equal(core.recommendations[0].triggerDeadline, null);
  assert.equal(core.recommendations[0].evidence[0].pageNumber, null);
  assert.equal(core.recommendations[0].evidence[0].sourceLocation, null);
  assert.deepEqual(core.fuelMechanisms, []);
});

test("word boundaries avoid incidental substrings and preserve negative mentions as review only", () => {
  const core = buildAviationContractCore([{ text: "A parent company is currently renewing its office. No indemnity is granted." }]);
  assert.equal(core.topics.find((item) => item.id === "payment").status, "not_established");
  assert.equal(core.topics.find((item) => item.id === "renewal").status, "not_established");
  assert.equal(core.topics.find((item) => item.id === "indemnity").status, "identified_for_review");
  assert.match(core.recommendations[0].reason, /does not establish applicability/);
});

test("explicit ratio mechanism retains original clause, page, offsets, base facts and unknown applicable date", () => {
  const mechanism = mechanismFor();
  assert.equal(mechanism.status, "supported");
  assert.deepEqual(mechanism.baseSurcharge, { amount: 1000, currency: "USD", unit: "flight" });
  assert.deepEqual(mechanism.baselineFuelPrice, { amount: 0.8, currency: "USD", unit: "litre" });
  assert.equal(mechanism.reference, "Example Jet A-1 Index");
  assert.equal(mechanism.adjustmentFrequency, "monthly");
  assert.equal(mechanism.applicableDate, null);
  assert.deepEqual(mechanism.missingConditions, []);
  assert.equal(mechanism.evidence[0].originalClauseText, fuelText);
  assert.equal(mechanism.evidence[0].clauseNumber, "1");
  assert.equal(mechanism.evidence[0].pageNumber, 3);
  assert.equal(mechanism.evidence[0].charStart, 200);
});

test("hypothetical and unverified user-supplied inputs produce labelled scenarios, never persisted facts", () => {
  const mechanism = mechanismFor();
  const original = JSON.stringify(mechanism);
  for (const origin of ["hypothetical", "user_supplied"]) {
    const result = evaluateFuelPriceScenario(mechanism, input({ origin }));
    assert.equal(result.status, "computed");
    assert.equal(result.basis, "scenario");
    assert.ok(Math.abs(result.amount - 1500) < 1e-9);
    assert.ok(Math.abs(result.delta - 500) < 1e-9);
    assert.equal(result.currency, "USD");
    assert.equal(result.unit, "flight");
    assert.equal(result.input.origin, origin);
    assert.equal(result.applicableDate, null);
    assert.ok(result.limitations.some((item) => /not independently verified/.test(item)));
    assert.ok(result.limitations.some((item) => /confirmed liability/.test(item)));
  }
  assert.equal(JSON.stringify(mechanism), original);
  const lower = evaluateFuelPriceScenario(mechanism, input({ value: 0.4 }));
  assert.equal(lower.amount, 500);
  assert.equal(lower.delta, -500);
});

const unsupportedClauses = [
  ["missing ratio", fuelText.replace("Adjusted fuel surcharge = Base fuel surcharge * (Current fuel price / Baseline fuel price).", "Fuel surcharge shall be adjusted for market changes.")],
  ["non-ratio formula", fuelText.replace("* (Current fuel price / Baseline fuel price)", "+ (Current fuel price - Baseline fuel price)")],
  ["cap", `${fuelText}\nAdjustment is capped at 10%.`],
  ["floor", `${fuelText}\nA minimum floor of USD 900 applies.`],
  ["threshold", `${fuelText}\nAdjustment applies only above a 5% change.`],
  ["notice", `${fuelText}\nSubject to 30 days notice.`],
  ["discretion", `${fuelText}\nThe parties may agree otherwise.`],
  ["cross-reference", `${fuelText}\nSubject to Schedule 2.`],
  ["negation", `${fuelText}\nNo fuel surcharge adjustment applies.`],
  ["exception", `${fuelText}\nExcept during force majeure.`],
  ["missing baseline", fuelText.replace("Baseline fuel price: USD 0.80 per litre\n", "")],
  ["zero baseline", fuelText.replace("USD 0.80", "USD 0.00")],
  ["currency conversion", fuelText.replace("Baseline fuel price: USD", "Baseline fuel price: EUR")],
  ["missing timing", fuelText.replace("Adjustment frequency: monthly\n", "")],
  ["duplicate conflicting baseline", `${fuelText}\nBaseline fuel price: USD 0.90 per litre`],
  ["ambiguous numeric amount", fuelText.replace("USD 1000", "USD 1,000")],
  ["unsupported unit", fuelText.replace("per litre", "per barrel")],
  ["unbounded number", fuelText.replace("USD 1000", `USD ${"9".repeat(400)}`)],
  ["condition in heading", fuelText.replace("1 FUEL SURCHARGE", "1 NO FUEL SURCHARGE")],
];
for (const [name, text] of unsupportedClauses) {
  test(`fuel pricing refuses ${name} rather than assuming a ratio or ignoring conditions`, () => {
    const mechanism = mechanismFor(text);
    assert.equal(mechanism.status, "requires_review");
    assert.ok(mechanism.missingConditions.length);
    const result = evaluateFuelPriceScenario(mechanism, input());
    assert.equal(result.status, "not_computable");
    assert.equal(result.amount, null);
    assert.equal(result.delta, null);
  });
}

test("conditions in a recognised structural heading cannot be omitted", () => {
  const text = fuelText.replace("FUEL SURCHARGE", "FUEL SURCHARGE SUBJECT TO CAP");
  const core = buildAviationContractCore([{ ...source(text), title: "FUEL SURCHARGE SUBJECT TO CAP" }]);
  assert.equal(core.fuelMechanisms[0].status, "requires_review");
});

test("fuel conditions or conflicting mechanisms in separate clauses block all calculations", () => {
  for (const other of [
    "The fuel surcharge adjustment is capped at 10%.",
    "No fuel surcharge applies.",
    fuelText.replace("USD 0.80", "USD 0.90"),
  ]) {
    const core = buildAviationContractCore([source(), { ...source(other), clauseId: "clause-2", clauseNumber: "2" }]);
    assert.equal(core.fuelMechanisms.length, 1);
    assert.equal(core.fuelMechanisms[0].candidateClauseCount, 2);
    assert.ok(core.fuelMechanisms.every((item) => item.status === "requires_review"));
    assert.ok(core.fuelMechanisms.every((item) => item.evidence.length === 2));
    assert.ok(core.fuelMechanisms.every((item) => evaluateFuelPriceScenario(item, input()).status === "not_computable"));
  }
});

test("topic citations and ambiguous fuel output remain bounded without hiding identified counts", () => {
  const sources = Array.from({ length: 20 }, (_, index) => ({ ...source(), clauseId: `fuel-${index}` }));
  const core = buildAviationContractCore(sources);
  assert.equal(core.fuelMechanisms.length, 1);
  assert.equal(core.fuelMechanisms[0].candidateClauseCount, 20);
  assert.equal(core.fuelMechanisms[0].evidence.length, 3);
  assert.equal(core.topics.find((item) => item.id === "payment").identifiedClauseCount, 20);
  assert.equal(core.topics.find((item) => item.id === "payment").evidence.length, 3);
  assert.ok(core.recommendations.length <= 17);
});

test("strict variable types, provenance, observation dates, reference and units are mandatory", () => {
  for (const overrides of [
    { value: "1.2" }, { value: 0 }, { value: -1 }, { value: NaN }, { value: Infinity },
    { origin: "live" }, { kind: "oil_price" }, { asOf: "2026-02-30" }, { asOf: "" },
    { sourceLabel: "" }, { sourceLabel: "x".repeat(201) },
    { unit: "gallon" }, { currency: "EUR" }, { reference: "Different oil index" },
  ]) {
    const result = evaluateFuelPriceScenario(mechanismFor(), input(overrides));
    assert.equal(result.status, "not_computable", JSON.stringify(overrides));
    assert.equal(result.amount, null);
    assert.ok(result.issues.length);
  }
});

test("incomplete evidence and numeric overflow cannot create a scenario", () => {
  assert.equal(evaluateFuelPriceScenario(null, null).status, "not_computable");
  const mechanism = mechanismFor();
  assert.equal(evaluateFuelPriceScenario({ ...mechanism, evidence: [] }, input()).status, "not_computable");
  const overflow = evaluateFuelPriceScenario(mechanism, input({ value: Number.MAX_VALUE }));
  assert.equal(overflow.status, "not_computable");
  assert.equal(overflow.amount, null);
});

test("actual deterministic segmentation and contract profile carry additive topics, citations and actions", () => {
  const clauses = segment(fuelText);
  assert.equal(clauses.length, 1);
  const profile = buildContractProfile({ clauses });
  assert.equal(profile.metadata.aviationCore.fuelMechanisms[0].status, "supported");
  assert.equal(profile.metadata.effectiveDate, null);
  assert.equal(profile.metadata.expirationDate, null);
  assert.equal(profile.metadata.aviationCore.fuelMechanisms[0].evidence[0].pageNumber, 3);
  assert.equal(profile.metadata.aviationCore.fuelMechanisms[0].evidence[0].originalClauseText, fuelText);
  assert.ok(profile.recommendations.some((item) => item.topicId === "fuel_price" && item.reason && item.evidence.length));
  assert.equal(clauses[0].category, "commercial/payment");
  assert.equal(profile.metadata.leaseIntelligence, null);
});

test("profile repository persists the increment inside existing scoped metadata JSON without a new schema", async () => {
  const profile = buildContractProfile({ clauses: segment(fuelText) });
  let savedMetadata;
  const calls = [];
  const client = {
    async query(sql, values) {
      calls.push(sql);
      if (sql.includes("insert into contract_intelligence_profiles")) {
        savedMetadata = JSON.parse(values[5]);
        assert.equal(values[0], scope.organizationId);
        assert.equal(values[4], scope.analysisRunId);
        return { rows: [{ id: "profile", metadata: savedMetadata }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const repository = createContractProfileRepository({ connect: async () => client });
  const saved = await repository.persist({ scope, profile });
  assert.equal(saved.metadata.aviationCore.version, "aviation-core-v1");
  assert.equal(saved.metadata.aviationCore.fuelMechanisms[0].status, "supported");
  assert.ok(calls.includes("begin") && calls.includes("commit"));
  assert.ok(calls.every((sql) => !/\b(alter|create)\b/i.test(sql)));
});

test("real pipeline persists and exposes the core with injected offline stage/repository doubles", async () => {
  const clauses = segment(fuelText);
  const evidence = clauses.map((clause, index) => ({ ...clause.evidence, id: `evidence-${index}`, clause_id: clause.id }));
  let run = { id: scope.analysisRunId, document_version_id: scope.documentVersionId, status: "queued" };
  let saved;
  const pipeline = createContractIntelligencePipeline({
    withLock: async (_keys, operation) => operation(),
    analysisRunRepository: {
      getById: async () => run,
      claimQueued: async () => {
        if (run.status !== "queued") return null;
        run = { ...run, status: "processing" };
        return {
          run,
          fenceContext: {
            workerId: "66666666-6666-4666-8666-666666666666",
            executionId: "77777777-7777-4777-8777-777777777777",
            generation: "1",
            token: "a".repeat(64),
          },
        };
      },
      updateStatus: async ({ status }) => { run = { ...run, status }; return run; },
    },
    profileRepository: { persist: async ({ profile }) => { saved = profile; return { id: "profile-new", metadata: profile.metadata }; } },
    searchRepository: { replaceForRun: async ({ chunks }) => chunks },
    sourceService: { load: async () => ({ contractId: scope.contractId, documentId: scope.documentId }) },
    clauseStage: async () => ({ clauses, evidence }),
    obligationService: { runStage: async () => ({ obligations: [] }) },
    deadlineService: { runStage: async () => ({ deadlines: [] }) },
    riskService: { runStage: async () => ({ risks: [] }) },
    aviationRelationshipRepository: { materializeContractRelationships: async () => [] },
  });
  const result = await pipeline.run(scope);
  assert.equal(result.status, "completed");
  assert.equal(result.profile.metadata.aviationCore.fuelMechanisms[0].status, "supported");
  assert.equal(result.profile.metadata.aviationCore.fuelMechanisms[0].evidence[0].pageNumber, 3);
  assert.ok(saved.recommendations.some((item) => item.topicId === "fuel_price"));
});
