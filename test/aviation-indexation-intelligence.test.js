import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { INFLATION_SERIES, parseIndexationTerms, calculateIndexation } from "../shared/aviationIndexation.js";
import { SYNTHETIC_INDEXATION } from "../frontend/src/demo/indexationJourney.js";
import { prepareReviewedInflationObservation } from "../services/phase3/intelligence/inflationObservationReview.js";
import { deriveAviationExternalRiskIntelligence, deriveAviationIndexationScenarios } from "../services/phase3/intelligence/aviationExternalRiskIntelligenceService.js";
import { deriveAviationPredictiveContractRisk } from "../services/phase3/intelligence/aviationPredictiveContractRiskService.js";
import { createExternalAviationObservationRepository } from "../repositories/phase3/externalAviationObservationRepository.js";
import portfolioRoutes from "../routes/portfolioRoutes.js";
import systemRoutes from "../routes/systemRoutes.js";
import { segmentDeterministicClauses } from "../services/phase3/intelligence/deterministicClauseService.js";

const fixture = JSON.parse(await readFile(new URL("./fixtures/aviation-acceptance/phase58-external-risk.json", import.meta.url), "utf8"));
const series = INFLATION_SERIES.CUUR0000SA0;
const excerpt = SYNTHETIC_INDEXATION.excerpt;
const org = fixture.organizationId;
const provision = { ...fixture.provisions[0], excerpt, classification: { status: "confirmed", type: "MRO" } };
const importInput = {
  seriesId: "CUUR0000SA0", value: 315, period: "2026-09",
  publicationTimestamp: "2026-10-15T12:30:00Z", reviewConfirmed: true,
  sourceReference: series.sourceReference, unit: series.unit, geography: series.geography,
};
const observation = {
  ...prepareReviewedInflationObservation(importInput, "2026-11-09T08:00:00Z"),
  id: "synthetic-reviewed-index-record", reviewed_by: org,
  reviewed_at: "2026-11-09T08:00:00Z", update_status: "recorded",
};

test("existing deterministic clause extraction retains the indexation clause and source provenance", () => {
  const clauses = segmentDeterministicClauses({
    organizationId: org, contractId: provision.contract_id,
    documentId: org, documentVersionId: provision.document_version_id,
    analysisRunId: provision.analysis_run_id,
    text: `7.3 Annual CPI Indexation\n${excerpt}`, pages: [],
    pageBoundaries: "derived_unavailable",
    sourceLocator: (start, end) => `source:char:${start}-${end}`,
  });
  assert.equal(clauses.length, 1);
  assert.equal(clauses[0].category, "pricing/escalation");
  assert.match(clauses[0].evidence.excerpt, /CUUR0000SA0/);
  assert.equal(clauses[0].evidence.document_version_id, provision.document_version_id);
  assert.equal(parseIndexationTerms(clauses[0].evidence.excerpt).seriesId, "CUUR0000SA0");
});
function derive(overrides = {}) {
  return deriveAviationExternalRiskIntelligence({
    organizationId: org, provisions: [provision], observations: [observation],
    asOf: "2026-11-09", ...overrides,
  });
}

test("parses exact index, share, protections, adjustment date and notice from verified MRO evidence", () => {
  const assessment = derive().contractualAssessments[0];
  const exposure = assessment.indexationExposure;
  assert.equal(assessment.category, "inflation");
  assert.equal(exposure.terms.classification, "partially_indexed");
  assert.equal(exposure.terms.seriesId, "CUUR0000SA0");
  assert.equal(exposure.terms.indexedSharePercent, 80);
  assert.equal(exposure.terms.capPercent, 3);
  assert.equal(exposure.noticeDate, "2026-12-02");
  assert.equal(exposure.calculation.indexChangePercent, 5);
  assert.equal(exposure.calculation.adjustmentPercent, 3);
  assert.equal(exposure.calculation.revisedPrice, 103000);
  assert.equal(exposure.calculation.incrementalCost, 3000);
  assert.equal(exposure.calculation.recoverability, "customer_contractual_charge_only");
  assert.equal(assessment.organizationId, org);
  assert.equal(assessment.documentVersionId, provision.document_version_id);
  assert.deepEqual(exposure.recommendation.supportingEvidenceIds, [provision.evidence_id, observation.id]);
  assert.match(exposure.recommendation.action, /notice before 2026-12-02/);
});

test("shares the contractual calculation between production and synthetic Demo without mutating inputs", () => {
  const terms = parseIndexationTerms(excerpt);
  const before = structuredClone(terms);
  assert.equal(calculateIndexation(terms, 294).calculation.adjustmentPercent, 0);
  assert.equal(calculateIndexation(terms, 300.5).calculation.incrementalCost, 0);
  assert.equal(calculateIndexation(terms, 306).calculation.incrementalCost, 1600);
  assert.equal(calculateIndexation(terms, 330).calculation.incrementalCost, 3000);
  assert.deepEqual(terms, before);
});

for (const [label, patch] of [
  ["wrong index", { indicator_id: "inflation.ea20.hicp.cp00.i15" }],
  ["wrong unit", { unit: "percent per annum" }],
  ["wrong geography", { market_applicability: "United Kingdom" }],
  ["wrong source", { source_id: "untrusted" }],
  ["wrong currency", { currency: "GBP" }],
  ["unreviewed", { reviewed_by: null }],
  ["unverified", { data_quality_status: "unverified" }],
  ["missing publication", { publication_timestamp: null }],
  ["future publication", { publication_timestamp: "2027-01-01T00:00:00Z" }],
  ["incompatible period", { observation_date: "2026-10-01" }],
  ["stale", { observation_date: "2026-08-01" }],
]) {
  test(`fails closed for ${label} inflation evidence`, () => {
    const result = derive({ observations: [{ ...observation, ...patch }] }).contractualAssessments[0].indexationExposure;
    assert.equal(result.status, "not_calculated");
    assert.equal(result.calculation, null);
    assert.ok(result.missingInputs.length);
  });
}

for (const [label, text] of [
  ["missing baseline", excerpt.replace("Index baseline: 300 for 2025-09.", "")],
  ["different comparison horizon", excerpt.replace("2025-09", "2024-09")],
  ["unknown index", excerpt.replace("CUUR0000SA0", "UNSUPPORTED")],
  ["missing share", excerpt.replace("Indexed share: 80%.", "")],
  ["missing formula", excerpt.replace("Adjustment formula:", "Unrecognized formula:")],
  ["contradictory protection", excerpt.replace("Adjustment floor: 0%", "Adjustment floor: 5%")],
  ["unquantified floor", excerpt.replace("Adjustment floor: 0%", "Adjustment floor: as agreed")],
  ["retroactivity", `${excerpt} Retroactive adjustments permitted.`],
  ["substitution", `${excerpt} Index substitution is possible.`],
  ["contradictory index family", excerpt.replace("Annual CPI", "Annual HICP")],
  ["duplicate series", `${excerpt} Index series: CUUR0000SA0.`],
]) {
  test(`reports incomplete contractual terms for ${label}`, () => {
    assert.equal(derive({ provisions: [{ ...provision, excerpt: text }] }).contractualAssessments[0].indexationExposure.status, "not_calculated");
  });
}

test("recognizes unsupported labour/material indexation and does not substitute CPI", () => {
  const result = derive({ provisions: [{ ...provision, excerpt: "Labour-cost indexation and material-cost escalation shall be reviewed annually." }] }).contractualAssessments[0];
  assert.equal(result.status, "requires_review");
  assert.equal(result.indexationExposure.calculation, null);
});

test("fixed prices and fixed annual escalation remain distinct from index-linked arrangements", () => {
  const fixed = derive({ provisions: [{ ...provision, excerpt: "Fixed-price arrangement. The price shall remain fixed." }] }).contractualAssessments[0];
  assert.equal(fixed.indexationExposure.status, "fixed_price");
  const escalation = derive({ observations: [], provisions: [{ ...provision, excerpt: "Fixed annual escalation of 3%. Baseline price: USD 100,000 per year. Adjustment frequency: annual. Adjustment date: 2027-01-01." }] }).contractualAssessments[0];
  assert.equal(escalation.indexationExposure.calculation.revisedPrice, 103000);
});

test("bounded scenarios preserve evidence, version scope and baseline without statistical claims", () => {
  const assessment = derive().contractualAssessments[0];
  const before = structuredClone(assessment);
  const scenarios = deriveAviationIndexationScenarios(assessment, [{ label: "Lower index", indexValue: 306 }, { label: "Higher index", indexValue: 330 }], org);
  assert.equal(scenarios[0].signedDifference, -1400);
  assert.equal(scenarios[1].signedDifference, 0);
  assert.equal(scenarios[0].documentVersionId, provision.document_version_id);
  assert.equal(scenarios[0].notForecast, true);
  assert.deepEqual(assessment, before);
  assert.throws(() => deriveAviationIndexationScenarios(assessment, [], org), /One to four/);
  assert.throws(() => deriveAviationIndexationScenarios(assessment, [{ label: "Invalid", indexValue: 0 }], org), /One to four/);
  assert.throws(() => deriveAviationIndexationScenarios(assessment, [{ label: "Other tenant", indexValue: 320 }], "99999999-9999-4999-8999-999999999999"), /scope mismatch/);
});

test("rejects cross-organization clauses, unverified clauses and evidence lacking location", () => {
  assert.throws(() => derive({ provisions: [{ ...provision, organization_id: "other" }] }), /cross-organization/);
  assert.equal(derive({ provisions: [{ ...provision, clause_review_status: "unverified" }] }).contractualAssessments.length, 0);
  const result = derive({ provisions: [{ ...provision, page_number: null, source_locator: null }] });
  assert.equal(result.contractualAssessments[0].indexationExposure.status, "not_calculated");
});

test("predictive-risk carries indexation independently and preserves original evidence", () => {
  const externalRisk = derive();
  const result = deriveAviationPredictiveContractRisk({ organizationId: org, externalRisk, asOf: externalRisk.asOf });
  const assessment = result.contracts[0].components.find((item) => item.factor === "inflation").exposureAssessment;
  assert.equal(assessment.result.financial[0].amount, 3000);
  assert.equal(assessment.contract.documentVersionId, provision.document_version_id);
  assert.equal(result.sensitivity.status, "not_calculated");
});

test("publication review validates exact source, period, units, geography and explicit human confirmation", () => {
  for (const patch of [{ reviewConfirmed: false }, { sourceReference: "https://example.com" }, { unit: "percent" }, { period: "2026-13" }, { value: 0 }, { geography: "UK" }, { publicationTimestamp: "2026-09-10T00:00:00Z" }]) {
    assert.throws(() => prepareReviewedInflationObservation({ ...importInput, ...patch }), /required/);
  }
});

test("reviewed source records are append-only and platform-superadmin protected", async () => {
  const calls = [];
  const repository = createExternalAviationObservationRepository({
    async query(sql, values) { calls.push({ sql, values }); return { rowCount: 1 }; },
  });
  await repository.insertReviewedInflationObservation(observation, org);
  assert.match(calls[0].sql, /on conflict do nothing/i);
  assert.doesNotMatch(calls[0].sql, /do update/i);
  assert.match(calls[0].sql, /reviewed_by, reviewed_at/);
  assert.equal(calls[0].values[16], org);
  assert.equal(systemRoutes.stack.filter((layer) => !layer.route).length, 2, "authentication and superadmin middleware protect source review");
});

test("scenario endpoint validates malformed input before any contract read", async () => {
  const route = portfolioRoutes.stack.find((layer) => layer.route?.path.endsWith("/indexation-sensitivity")).route;
  let status;
  let body;
  await route.stack[0].handle({ body: { assessmentId: "sample", scenarios: [{ label: "Invalid", indexValue: -1 }] } }, {
    status(value) { status = value; return this; }, json(value) { body = value; return this; },
  });
  assert.equal(status, 400);
  assert.equal(body.success, false);
});
