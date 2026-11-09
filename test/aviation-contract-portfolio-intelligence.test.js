import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  deriveAviationContractPortfolioIntelligence,
  readAviationContractPortfolioIntelligence,
} from "../services/phase3/intelligence/aviationContractPortfolioIntelligenceService.js";
import { createAviationContractPortfolioRepository } from "../repositories/phase3/aviationContractPortfolioRepository.js";

const fixtureUrl = new URL("./fixtures/aviation-acceptance/phase57-aviation-contract-portfolio.json", import.meta.url);
const fixture = JSON.parse(await fs.readFile(fixtureUrl, "utf8"));
const { organizationId, asOf } = fixture;

function derive(overrides = {}) {
  return deriveAviationContractPortfolioIntelligence({
    organizationId,
    runs: fixture.runs,
    relationships: fixture.relationships,
    assessmentsByRun: new Map(Object.entries(fixture.assessments)),
    asOf,
    ...overrides,
  });
}

test("connects verified lease and maintenance contracts to an exact shared aircraft", () => {
  const portfolio = derive();
  const aircraft = portfolio.aircraft.find((item) => item.aircraftId === "aircraft-101");

  assert.equal(aircraft.status, "confirmed");
  assert.equal(aircraft.registration, "N-101");
  assert.deepEqual(new Set(aircraft.confirmedContractIds), new Set([
    "22222222-2222-4222-8222-222222222201",
    "22222222-2222-4222-8222-222222222202",
    "22222222-2222-4222-8222-222222222203",
  ]));
  assert.ok(portfolio.relationships.confirmedSharedAircraft.some((item) => item.aircraftId === "aircraft-101"));
  assert.ok(aircraft.contracts.every((item) => item.relationshipStatus === "confirmed"));
  assert.ok(aircraft.contracts.every((item) => item.evidence?.reviewStatus === "verified"));
  const secondAircraft = portfolio.aircraft.find((item) => item.aircraftId === "aircraft-202");
  assert.ok(secondAircraft.confirmedContractIds.includes("22222222-2222-4222-8222-222222222205"));
  assert.deepEqual(secondAircraft.projectedExposureByCurrency, [{ currency: "GBP", amount: 3_000 }]);
});

test("separates current and projected exposure by currency without conversion", () => {
  const portfolio = derive();

  assert.deepEqual(portfolio.financialExposure.currentByCurrency, [{ currency: "USD", amount: 10_000 }]);
  assert.deepEqual(portfolio.financialExposure.projectedByCurrency, [
    { currency: "EUR", amount: 5_000 },
    { currency: "GBP", amount: 3_000 },
    { currency: "USD", amount: 15_000 },
  ]);
  assert.equal(portfolio.financialExposure.findings.filter((item) => item.kind === "current").length, 1);
  assert.equal(portfolio.financialExposure.findings.filter((item) => item.kind === "projected").length, 3);
  assert.match(portfolio.financialExposure.currencyPolicy, /No currency conversion/);
  assert.deepEqual(
    portfolio.financialExposure.byAircraft.find((item) => item.aircraftId === "aircraft-101").projectedByCurrency,
    [{ currency: "EUR", amount: 5_000 }, { currency: "USD", amount: 15_000 }],
  );
});

test("publishes current-run utilization summaries with clause and forecast evidence", () => {
  const portfolio = derive();
  const finding = portfolio.utilisationExposures.find((item) => item.contractId === "22222222-2222-4222-8222-222222222201");

  assert.ok(finding);
  assert.equal(finding.analysisRunId, "55555555-5555-4555-8555-555555552201");
  assert.equal(finding.documentVersionId, "44444444-4444-4444-8444-444444442201");
  assert.equal(finding.clauseId, "clause-alpha");
  assert.equal(finding.unit, "flight_hours");
  assert.equal(finding.financialExposure.contractualProvision.contractVersionId, finding.documentVersionId);
  assert.equal(finding.financialExposure.projected.amount, 15_000);
  assert.ok(finding.contractEvidence.every((item) => item.reviewStatus === "verified"));
  assert.equal(finding.recordedUtilisation, null);
});

test("only allocates a financial finding to an aircraft named in its verified contractual source", () => {
  const assessmentsByRun = new Map(Object.entries(fixture.assessments));
  const alpha = structuredClone(fixture.assessments["55555555-5555-4555-8555-555555552201"]);
  alpha.risks[0].utilisation_exposure.metrics[0].financialExposure.contractualProvision.evidence[0].excerpt =
    "The allowance is 300 flight hours per lease year; excess hours are USD 500 per hour.";
  assessmentsByRun.set("55555555-5555-4555-8555-555555552201", alpha);

  const portfolio = derive({ assessmentsByRun });
  const aircraft = portfolio.aircraft.find((item) => item.aircraftId === "aircraft-101");
  assert.equal(aircraft.financialFindings.some((item) => item.contractId === "22222222-2222-4222-8222-222222222201"), false);
  assert.equal(portfolio.financialExposure.findings.some((item) => item.contractId === "22222222-2222-4222-8222-222222222201"), true);
});

test("keeps potential and unresolved aircraft links separate from verified relationships", () => {
  const portfolio = derive();
  const potential = portfolio.aircraft.find((item) => item.aircraftId === "aircraft-potential");
  const unresolved = portfolio.aircraft.find((item) => item.aircraftId === "aircraft-unresolved");

  assert.equal(potential.status, "potential");
  assert.equal(potential.financialFindings.length, 0);
  assert.equal(unresolved.status, "unresolved");
  assert.equal(unresolved.financialFindings.length, 0);
  assert.equal(portfolio.relationships.potentialCount, 1);
  assert.equal(portfolio.relationships.unresolvedCount, 1);
});

test("does not merge similar counterparties or claim unverified party identities", () => {
  const portfolio = derive();
  assert.equal(portfolio.counterparties.status, "unresolved");
  assert.deepEqual(portfolio.counterparties.entities, []);
  assert.match(portfolio.counterparties.reason, /similar names are not merged/i);
});

test("suppresses duplicate aircraft links and ignores missing or cross-organization identifiers", () => {
  const portfolio = derive({
    relationships: [...fixture.relationships, fixture.relationships[0]],
  });
  const aircraft = portfolio.aircraft.find((item) => item.aircraftId === "aircraft-101");

  assert.equal(aircraft.contracts.filter((item) => item.contractId === "22222222-2222-4222-8222-222222222201").length, 1);
  assert.equal(portfolio.aircraft.some((item) => item.aircraftId === "aircraft-other-tenant"), false);
  assert.equal(portfolio.aircraft.some((item) => item.registration === "N-404"), false);
});

test("does not confirm aircraft relationships supported by a previous contract version", () => {
  const portfolio = derive({
    relationships: [{
      ...fixture.relationships[0],
      id: "rel-stale-version",
      aircraft_id: "aircraft-stale-version",
      evidence_document_version_id: "44444444-4444-4444-8444-444444440000",
    }],
  });
  const stale = portfolio.aircraft.find((item) => item.aircraftId === "aircraft-stale-version");
  assert.equal(stale.status, "unresolved");
  assert.equal(stale.confirmedContractIds.length, 0);
});

test("clusters verified coincident deadlines without inferring obligation dependencies", () => {
  const portfolio = derive();
  assert.equal(portfolio.deadlineClusters.length, 1);
  assert.equal(portfolio.deadlineClusters[0].date, "2026-12-01");
  assert.equal(portfolio.deadlineClusters[0].type, "temporal_coincidence");
  assert.equal(portfolio.deadlineClusters[0].contractIds.length, 2);
  assert.match(portfolio.deadlineClusters[0].explanation, /no dependency/);
  assert.equal(portfolio.recommendations.some((item) => item.type === "coordinate_contract_deadlines"), true);
});

test("does not cluster unverified or past deadlines", () => {
  const assessmentsByRun = new Map(Object.entries(fixture.assessments));
  for (const [runId, assessment] of assessmentsByRun) {
    const copy = structuredClone(assessment);
    copy.risks[0].deadline_information.reviewRequired = true;
    assessmentsByRun.set(runId, copy);
  }
  assert.equal(derive({ assessmentsByRun }).deadlineClusters.length, 0);
});

test("recommendations explain shared exposure and retain contract and evidence traceability", () => {
  const portfolio = derive();
  const recommendation = portfolio.recommendations.find((item) => item.type === "review_interconnected_aircraft_exposure");

  assert.ok(recommendation);
  assert.equal(recommendation.aircraftId, "aircraft-101");
  assert.equal(recommendation.contractIds.length, 2);
  assert.equal(recommendation.supportingFindings.length, 3);
  assert.ok(recommendation.supportingEvidence.some((item) => item.evidenceId === "ev-contract-alpha"));
  assert.ok(recommendation.supportingEvidence.some((item) => item.evidenceId === "ev-forecast-beta"));
  assert.match(recommendation.uncertainty, /original currencies/);
  assert.ok(portfolio.prioritizedFindings.some((item) => item.priority === "current_review"));
  assert.ok(portfolio.prioritizedFindings.some((item) => item.priority === "projected_monitoring"));
});

test("withholds financial findings without verified contractual and operational citations", () => {
  const assessmentsByRun = new Map(Object.entries(fixture.assessments));
  const alpha = structuredClone(fixture.assessments["55555555-5555-4555-8555-555555552201"]);
  alpha.risks[0].utilisation_exposure.metrics[0].financialExposure.projected.sources[0].reviewStatus = "pending";
  assessmentsByRun.set("55555555-5555-4555-8555-555555552201", alpha);

  const portfolio = derive({ assessmentsByRun });
  assert.equal(portfolio.financialExposure.findings.some((item) => item.kind === "projected" && item.contractId === "22222222-2222-4222-8222-222222222201"), false);
  assert.ok(portfolio.financialExposure.omittedUncitedFindings > 0);
});

test("does not include unconfirmed analyses or stale-version financial assessments", () => {
  const assessmentsByRun = new Map(Object.entries(fixture.assessments));
  const alpha = structuredClone(fixture.assessments["55555555-5555-4555-8555-555555552201"]);
  alpha.risks[0].utilisation_exposure.metrics[0].financialExposure.contractualProvision.contractVersionId = "44444444-4444-4444-8444-444444449999";
  assessmentsByRun.set("55555555-5555-4555-8555-555555552201", alpha);

  const portfolio = derive({ assessmentsByRun });
  assert.equal(portfolio.contracts.some((item) => item.title === "Unreviewed Lease"), false);
  assert.equal(portfolio.financialExposure.findings.some((item) => item.contractId === "22222222-2222-4222-8222-222222222201"), false);
});

test("returns a clear empty-state result without fabricating portfolio data", () => {
  const portfolio = derive({ runs: [], relationships: [], assessmentsByRun: new Map() });
  assert.equal(portfolio.status, "no_verified_aviation_analysis");
  assert.equal(portfolio.contracts.length, 0);
  assert.equal(portfolio.financialExposure.currentByCurrency.length, 0);
  assert.equal(portfolio.recommendations.length, 0);
});

test("reads only organization-scoped supported runs and bounds analysis assessment work", async () => {
  const calls = [];
  const portfolio = await readAviationContractPortfolioIntelligence({
    organizationId,
    asOf,
    repository: {
      async listLatestCompletedRuns(orgId) {
        assert.equal(orgId, organizationId);
        return fixture.runs;
      },
      async listAircraftRelationships(orgId) {
        assert.equal(orgId, organizationId);
        return fixture.relationships;
      },
    },
    async readLeaseAssessment(input) {
      calls.push(input.analysisRunId);
      return fixture.assessments[input.analysisRunId] ? { applicable: true, risks: fixture.assessments[input.analysisRunId].risks } : { applicable: false, risks: [] };
    },
  });

  assert.equal(calls.length, 3);
  assert.equal(portfolio.contracts.length, 4);
  assert.equal(portfolio.financialExposure.findings.length, 4);
});

test("marks bounded results incomplete rather than implying full-portfolio coverage", async () => {
  const runs = Array.from({ length: 201 }, (_, index) => ({
    organization_id: organizationId,
    contract_id: `contract-${index}`,
    analysis_run_id: `run-${index}`,
    document_version_id: `version-${index}`,
    contract_title: `MRO ${index}`,
    classification: { type: "MRO", status: "confirmed" },
  }));
  const portfolio = await readAviationContractPortfolioIntelligence({
    organizationId,
    repository: {
      async listLatestCompletedRuns() { return runs; },
      async listAircraftRelationships() { return []; },
    },
    async readLeaseAssessment() {
      throw new Error("Non-lease analyses must not be read for utilization assessment.");
    },
  });

  assert.equal(portfolio.contracts.length, 200);
  assert.equal(portfolio.coverage.runsTruncated, true);
  assert.equal(portfolio.coverage.portfolioInventoryComplete, false);
});

test("portfolio retrieval queries enforce organization and evidence-version joins", async () => {
  const statements = [];
  const repository = createAviationContractPortfolioRepository({
    async query(sql, values) {
      statements.push({ sql, values });
      return { rows: [] };
    },
  });
  await repository.listLatestCompletedRuns(organizationId);
  await repository.listAircraftRelationships(organizationId);

  assert.equal(statements.length, 2);
  assert.ok(statements.every(({ values }) => values[0] === organizationId));
  assert.match(statements[0].sql, /run\.organization_id = \$1/);
  assert.match(statements[0].sql, /contract\.organization_id = run\.organization_id/);
  assert.match(statements[1].sql, /relationship\.organization_id = \$1/);
  assert.match(statements[1].sql, /evidence\.organization_id = relationship\.organization_id/);
  assert.match(statements[1].sql, /evidence\.contract_id = relationship\.contract_id/);
  assert.match(statements[1].sql, /evidence\.document_version_id as evidence_document_version_id/);
});
