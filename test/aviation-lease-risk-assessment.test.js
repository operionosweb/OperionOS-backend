import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { createObligationFulfilmentRepository } from "../repositories/phase3/obligationFulfilmentRepository.js";
import { createRiskRepository } from "../repositories/phase3/riskRepository.js";
import { deriveAviationLeaseRecommendations } from "../services/phase3/intelligence/aviationLeaseRecommendationService.js";
import { deriveAviationLeaseRiskAssessment } from "../services/phase3/intelligence/aviationLeaseRiskAssessmentService.js";
import { buildDeterministicObligationCandidates } from "../services/phase3/intelligence/deterministicObligationService.js";
import { readAnalysisRunAviationLeaseRiskAssessment } from "../routes/analysisRunRoutes.js";

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ORGANIZATION_ID = "99999999-9999-4999-8999-999999999999";
const CONTRACT_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";
const RUN_ID = "55555555-5555-4555-8555-555555555555";

const profile = {
  classification: {
    type: "AIRCRAFT_LEASE",
    status: "confirmed",
    confidence: 1,
  },
};

function obligation(id, type, description, clauseId = `clause-${id}`) {
  return {
    id,
    contract_id: CONTRACT_ID,
    obligation_type: type,
    description,
    action: "perform",
    object: description,
    clause_id: clauseId,
    confidence: 0.96,
    review_status: "verified",
  };
}

function clause(id, title, sourceText, evidenceId = `evidence-${id}`, confidence = 0.96) {
  return {
    id,
    title,
    category: title,
    source_text: sourceText,
    confidence,
    review_status: confidence < 0.85 ? "requires_review" : "verified",
    evidence: [{
      evidence_id: evidenceId,
      support_type: "supports",
      is_primary: true,
      source: {
        id: evidenceId,
        source_locator: `Clause ${id}`,
        page_number: 4,
        excerpt: sourceText,
        confidence,
        review_status: confidence < 0.85 ? "requires_review" : "verified",
        ambiguity_reason: confidence < 0.85 ? "Aircraft asset scope needs confirmation." : null,
      },
    }],
  };
}

function runAssessment(overrides = {}) {
  const clauses = [
    clause("clause-delivery", "Aircraft delivery", "Lessor shall provide aircraft delivery documentation and technical records."),
    clause("clause-maintenance", "Maintenance", "Lessee shall perform scheduled aircraft maintenance and retain technical records."),
    clause("clause-reserve", "Maintenance reserves", "Lessee shall pay monthly maintenance reserve amounts at the stated rate."),
    clause("clause-insurance", "Insurance", "Lessee shall maintain aircraft hull insurance and provide current certificates."),
    clause("clause-redelivery", "Redelivery", "Lessee shall redeliver the aircraft with required records and maintenance status."),
    clause("clause-rent", "Rent", "Lessee shall pay monthly aircraft rent by the contractual due date."),
  ];
  const obligations = [
    obligation("delivery", "delivery", "Provide aircraft delivery documents"),
    obligation("maintenance", "maintenance", "Perform scheduled aircraft maintenance"),
    obligation("reserve", "payment", "Pay monthly maintenance reserve"),
    obligation("insurance", "insurance", "Maintain aircraft hull insurance"),
    obligation("redelivery", "redelivery", "Return aircraft in required condition"),
    obligation("rent", "payment", "Pay monthly aircraft rent"),
  ];
  return {
    profile,
    scope: { organizationId: ORGANIZATION_ID, contractId: CONTRACT_ID },
    clauses,
    obligations,
    deadlines: [],
    latestAssessments: [],
    asOf: "2026-11-06",
    ...overrides,
  };
}

function cumulativeUtilizationHistory({
  status = "fulfilled",
  readings = [
    { start: "2026-01-01", end: "2026-01-31", hours: 100, cycles: 100 },
    { start: "2026-02-01", end: "2026-02-28", hours: 150, cycles: 300 },
    { start: "2026-03-01", end: "2026-03-31", hours: 220, cycles: 450 },
  ],
} = {}) {
  return [...readings].reverse().map((reading, index) => ({
    id: `assessment-history-${index}`,
    status: index === 0 ? status : "fulfilled",
    evidence: [{
      id: `utilization-history-${index}`,
      documentName: "Synthetic aircraft utilization ledger",
      versionNumber: 1,
      sourceLocator: `Monthly ledger ${index + 1}`,
      pageNumber: index + 1,
      excerpt: `Recorded flight hours: ${reading.hours}; cumulative flight hours: ${reading.hours}; recorded flight cycles: ${reading.cycles}; cumulative flight cycles: ${reading.cycles}. Reporting period: ${reading.start} to ${reading.end}.`,
      reviewStatus: "verified",
      relationship: "supports",
      periodStatus: "matches",
      confidence: 0.99,
    }],
  }));
}

test("assesses supported aviation lease risk categories with clause provenance and actions", () => {
  const result = deriveAviationLeaseRiskAssessment(runAssessment());
  assert.equal(result.applicable, true);
  assert.deepEqual(result.risks.map((risk) => risk.risk_category), [
    "delivery/redelivery",
    "maintenance/operational",
    "financial",
    "insurance",
    "delivery/redelivery",
    "financial",
  ]);
  assert.ok(result.risks.every((risk) => risk.priority === "INFORMATIONAL"));
  for (const risk of result.risks) {
    assert.equal(risk.contract_id, CONTRACT_ID);
    assert.equal(risk.affected_obligation_ids[0], risk.obligation_id);
    assert.equal(risk.contract_evidence.length, 1);
    assert.match(risk.recommended_action, /aircraft|lease/i);
    assert.equal(risk.probability, null);
    assert.equal(risk.metadata.confidence_is_not_probability, true);
    assert.match(risk.description, /not proof of non-fulfilment|evidence gap/i);
  }
  assert.match(result.risks.find((risk) => risk.obligation_id === "insurance").recommended_action, /insurance certificates/i);
  assert.match(result.risks.find((risk) => risk.obligation_id === "redelivery").recommended_action, /lease-return owner/i);
  assert.match(result.risks.find((risk) => risk.obligation_id === "reserve").recommended_action, /maintenance-reserve payment/i);
});

test("extracts and reviews explicit aircraft flight-hour and cycle limits without inferring overuse", () => {
  const sourceText = "The Lessee shall not exceed 300 flight hours or 500 flight cycles during each lease year.";
  const sourceClause = clause("clause-utilization", "Aircraft Utilization", sourceText, "evidence-utilization");
  const [candidate] = buildDeterministicObligationCandidates({ source_text: sourceText });
  assert.equal(candidate.action, "exceed");
  assert.equal(candidate.modality, "prohibited");
  assert.match(candidate.object, /300 flight hours or 500 flight cycles/i);

  const linkedObligation = {
    ...candidate,
    ...obligation("utilization", "other", candidate.description, sourceClause.id),
  };
  const assessment = deriveAviationLeaseRiskAssessment(runAssessment({
    clauses: [sourceClause],
    obligations: [linkedObligation],
  }));
  assert.equal(assessment.risks.length, 1);
  const [risk] = assessment.risks;
  assert.equal(risk.risk_type, "aviation_lease_utilization_review");
  assert.equal(risk.assessment_status, "not_assessed");
  assert.equal(risk.priority, "INFORMATIONAL");
  assert.equal(risk.probability, null);
  assert.match(risk.description, /no period-matched utilization records/i);
  assert.match(risk.description, /does not establish that the limit has been reached or exceeded/i);
  assert.match(risk.rationale, /contractual ceiling is derived from the cited clause/i);
  assert.match(risk.rationale, /verified reviewer-approved historical evidence/i);
  assert.match(risk.rationale, /Neither a projection nor an approaching threshold establishes breach or a charge/i);
  assert.equal(risk.contract_evidence[0].pageNumber, 4);
  assert.equal(risk.contract_evidence[0].evidenceId, "evidence-utilization");

  const recommendations = deriveAviationLeaseRecommendations({
    scope: { organizationId: ORGANIZATION_ID, contractId: CONTRACT_ID },
    risks: assessment.risks,
  });
  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].owner_role, "AIRCRAFT_OPERATIONS");
  assert.match(recommendations[0].action, /period-matched flight-hour and flight-cycle records/i);
  assert.equal(recommendations[0].evidence[0].pageNumber, 4);
  assert.match(recommendations[0].business_rationale, /Clause clause-utilization/i);

  const unboundedClause = clause(
    "clause-utilization-records",
    "Utilization Records",
    "The Lessee shall maintain flight-hour and flight-cycle records during the lease.",
  );
  const unboundedObligation = {
    ...obligation("utilization-records", "maintenance", "Maintain flight-hour and flight-cycle records", unboundedClause.id),
  };
  const unboundedAssessment = deriveAviationLeaseRiskAssessment(runAssessment({
    clauses: [unboundedClause],
    obligations: [unboundedObligation],
  }));
  assert.equal(unboundedAssessment.risks.some((item) => item.risk_type === "aviation_lease_utilization_review"), false);
});

test("calculates separate utilization headroom only from verified, period-matched operational evidence", () => {
  const sourceClause = clause(
    "clause-utilization",
    "Aircraft Utilization",
    "The Lessee shall not exceed 300 flight hours or 500 flight cycles during each lease year.",
    "evidence-utilization-clause",
  );
  const utilizationObligation = obligation("utilization", "other", sourceClause.source_text, sourceClause.id);
  const evidence = {
    evidence_id: "evidence-utilization-log",
    document_name: "Aircraft utilization log",
    version_number: 2,
    source_locator: "Monthly utilization summary",
    page_number: 3,
    excerpt: "Recorded flight hours: 250; recorded flight cycles: 500. Reporting period: 2026-01-01 to 2026-11-09.",
    confidence: 0.99,
    review_status: "verified",
    relationship: "supports",
    period_status: "matches",
  };
  const assessmentInput = {
    id: "assessment-utilization",
    obligation_id: utilizationObligation.id,
    status: "evidence_submitted",
    evidence: [evidence],
  };
  const input = {
    ...runAssessment({
      clauses: [sourceClause],
      obligations: [utilizationObligation],
      latestAssessments: [assessmentInput],
      asOf: "2026-11-09",
    }),
  };
  const result = deriveAviationLeaseRiskAssessment(input);
  const exposure = result.risks[0].utilisation_exposure;
  const hours = exposure.metrics.find((item) => item.unit === "flight_hours");
  const cycles = exposure.metrics.find((item) => item.unit === "flight_cycles");

  assert.equal(hours.contractualLimit, 300);
  assert.equal(hours.recordedUtilisation, 250);
  assert.equal(hours.headroom, 50);
  assert.equal(hours.consumedPercent, 83.33);
  assert.equal(hours.status, "approaching");
  assert.deepEqual(hours.reportingPeriod, { start: "2026-01-01", end: "2026-11-09" });
  assert.equal(hours.sources[0].evidenceId, evidence.evidence_id);
  assert.equal(hours.sources[0].documentName, evidence.document_name);
  assert.equal(cycles.contractualLimit, 500);
  assert.equal(cycles.recordedUtilisation, 500);
  assert.equal(cycles.headroom, 0);
  assert.equal(cycles.consumedPercent, 100);
  assert.equal(cycles.status, "at_limit");
  assert.match(result.risks[0].recommended_action, /Monitor aircraft flight-hour and flight-cycle utilization more frequently/i);

  const exceeded = deriveAviationLeaseRiskAssessment({
    ...input,
    latestAssessments: [{
      ...assessmentInput,
      evidence: [{
        ...evidence,
        excerpt: "Recorded flight hours: 305; recorded flight cycles: 500. Reporting period: 2026-01-01 to 2026-11-09.",
      }],
    }],
  }).risks[0].utilisation_exposure.metrics.find((item) => item.unit === "flight_hours");
  assert.equal(exceeded.recordedUtilisation, 305);
  assert.equal(exceeded.headroom, -5);
  assert.equal(exceeded.consumedPercent, 101.67);
  assert.equal(exceeded.status, "exceeded");
});

test("assesses explicit minimum utilisation separately from a maximum without inventing a charge", () => {
  const sourceText = "The Lessee shall operate the Aircraft at least 300 flight hours and no more than 500 flight hours during each lease year.";
  const sourceClause = clause("clause-utilization-range", "Annual Aircraft Utilization", sourceText, "evidence-utilization-range");
  const utilizationObligation = obligation("utilization-range", "other", sourceText, sourceClause.id);
  const evidence = {
    evidence_id: "evidence-utilization-range-log",
    document_name: "Aircraft utilization log",
    version_number: 2,
    source_locator: "Lease-year utilization summary",
    page_number: 7,
    excerpt: "Recorded flight hours: 250. Reporting period: 2026-01-01 to 2026-11-09.",
    review_status: "verified",
    relationship: "supports",
    period_status: "matches",
  };
  const result = deriveAviationLeaseRiskAssessment(runAssessment({
    clauses: [sourceClause],
    obligations: [utilizationObligation],
    latestAssessments: [{
      id: "assessment-utilization-range",
      obligation_id: utilizationObligation.id,
      status: "fulfilled",
      evidence: [evidence],
    }],
    asOf: "2026-11-09",
  }));
  const metrics = result.risks[0].utilisation_exposure.metrics;
  const minimum = metrics.find((item) => item.direction === "minimum");
  const maximum = metrics.find((item) => item.direction === "maximum");

  assert.equal(minimum.contractualMinimum, 300);
  assert.equal(minimum.recordedUtilisation, 250);
  assert.equal(minimum.remainingRequirement, null);
  assert.equal(minimum.status, "minimum_period_incomplete");
  assert.match(minimum.reason, /does not establish a complete contractual minimum-utilisation period/i);
  assert.equal(minimum.reportingPeriod.start, "2026-01-01");
  assert.equal(minimum.sources[0].evidenceId, evidence.evidence_id);
  assert.equal(minimum.financialExposure.current.amount, null);
  assert.equal(minimum.financialExposure.projected.amount, null);
  assert.equal(maximum.contractualLimit, 500);
  assert.equal(maximum.headroom, 250);
  assert.equal(maximum.status, "within_limit");

  const completed = (hours, asOf = "2027-01-01") => deriveAviationLeaseRiskAssessment(runAssessment({
      clauses: [sourceClause],
      obligations: [utilizationObligation],
      latestAssessments: [{
        id: "assessment-utilization-range",
        obligation_id: utilizationObligation.id,
        status: "fulfilled",
        evidence: [{
          ...evidence,
          excerpt: `Recorded flight hours: ${hours}. Reporting period: 2026-01-01 to 2026-12-31.`,
        }],
      }],
      asOf,
    })).risks[0].utilisation_exposure.metrics.find((item) => item.direction === "minimum");
  const completedBelow = completed(250);
  assert.equal(completedBelow.status, "below_minimum");
  assert.equal(completedBelow.remainingRequirement, 50);
  assert.equal(completedBelow.financialExposure.current.amount, null);

  const aboveMinimum = completed(350);
  assert.equal(aboveMinimum.status, "above_minimum");
  assert.equal(aboveMinimum.remainingRequirement, 0);
  assert.equal(aboveMinimum.financialExposure.current.amount, null);

  const staleCompletedPeriod = completed(250, "2027-02-01");
  assert.equal(staleCompletedPeriod.status, "stale");
  assert.equal(staleCompletedPeriod.recordedUtilisation, null);
  assert.equal(staleCompletedPeriod.remainingRequirement, null);
});

test("aviation lease assessment connects verified current usage to the exact cited excess-hour charge", () => {
  const sourceText = "The Lessee shall not exceed 300 flight hours per lease year. Any excess flight hours shall be charged at USD 500 per flight hour.";
  const sourceClause = clause("clause-utilization-finance", "Aircraft Utilization and Excess Charges", sourceText, "evidence-utilization-finance");
  const utilizationObligation = obligation("utilization-finance", "other", sourceText, sourceClause.id);
  const evidence = {
    evidence_id: "evidence-current-utilization-finance",
    document_name: "Synthetic March utilization statement",
    version_number: 3,
    source_locator: "Meter summary",
    page_number: 2,
    excerpt: "Recorded flight hours: 320; cumulative flight hours: 320. Reporting period: 2026-01-01 to 2026-03-31.",
    review_status: "verified",
    relationship: "supports",
    period_status: "matches",
  };
  const risk = deriveAviationLeaseRiskAssessment(runAssessment({
    clauses: [sourceClause],
    obligations: [utilizationObligation],
    latestAssessments: [{
      id: "assessment-current-utilization-finance",
      obligation_id: utilizationObligation.id,
      status: "fulfilled",
      evidence: [evidence],
    }],
    asOf: "2026-03-31",
  })).risks[0];
  const financial = risk.utilisation_exposure.metrics[0].financialExposure;

  assert.equal(financial.status, "currently_demonstrated_exposure");
  assert.equal(financial.current.amount, 10_000);
  assert.equal(financial.current.currency, "USD");
  assert.equal(financial.current.excessUnits, 20);
  assert.equal(financial.contractualProvision.clauseId, sourceClause.id);
  assert.equal(financial.contractualProvision.evidence[0].evidenceId, "evidence-utilization-finance");
  assert.equal(financial.current.sources[0].evidenceId, evidence.evidence_id);
  assert.equal(risk.financial_exposure, null);
  assert.equal(risk.probability, null);
  assert.match(risk.description, /not an invoice or legal liability/i);
  assert.match(risk.recommended_action, /finance.*lease owners/i);
  const [recommendation] = deriveAviationLeaseRecommendations({
    scope: {
      organizationId: ORGANIZATION_ID,
      contractId: CONTRACT_ID,
      documentId: DOCUMENT_ID,
      documentVersionId: VERSION_ID,
      analysisRunId: RUN_ID,
    },
    risks: [risk],
  });
  assert.match(recommendation.business_rationale, /excess-charge exposure of 10000 USD/i);
  assert.ok(recommendation.evidence.some((item) => item.evidenceId === evidence.evidence_id));
  assert.ok(recommendation.evidence.some((item) => item.evidenceId === "evidence-utilization-finance"));
});

test("does not count the same cited clause and utilization unit more than once across obligations", () => {
  const sourceText = "The Lessee shall not exceed 300 flight hours per lease year. Any excess flight hours shall be charged at USD 500 per flight hour.";
  const sourceClause = clause("clause-utilization-shared-fee", "Aircraft Utilization and Excess Charges", sourceText, "evidence-utilization-shared-fee");
  const firstObligation = obligation("utilization-shared-fee-a", "other", sourceText, sourceClause.id);
  const secondObligation = obligation("utilization-shared-fee-b", "other", sourceText, sourceClause.id);
  const usageEvidence = {
    evidence_id: "evidence-utilization-shared-current",
    document_name: "Synthetic March utilization statement",
    version_number: 3,
    source_locator: "Meter summary",
    page_number: 2,
    excerpt: "Recorded flight hours: 320; cumulative flight hours: 320. Reporting period: 2026-01-01 to 2026-03-31.",
    review_status: "verified",
    relationship: "supports",
    period_status: "matches",
  };
  const risks = deriveAviationLeaseRiskAssessment(runAssessment({
    clauses: [sourceClause],
    obligations: [firstObligation, secondObligation],
    latestAssessments: [firstObligation, secondObligation].map((item) => ({
      id: `assessment-${item.id}`,
      obligation_id: item.id,
      status: "fulfilled",
      evidence: [usageEvidence],
    })),
    asOf: "2026-03-31",
  })).risks;
  const financialAssessments = risks.map((risk) => risk.utilisation_exposure.metrics[0].financialExposure);

  assert.equal(financialAssessments.filter((item) => item.current.amount === 10_000).length, 1);
  assert.equal(financialAssessments.filter((item) => item.status === "duplicate_not_aggregated").length, 1);
  assert.equal(financialAssessments.find((item) => item.status === "duplicate_not_aggregated").current.amount, null);
});

test("aviation lease assessment shows a projected charge only at an explicit contractual measurement date", async () => {
  const sourceText = await fs.readFile(new URL("./fixtures/aviation-acceptance/lease-utilization-financial-exposure.txt", import.meta.url), "utf8");
  const sourceClause = clause("clause-utilization-projected-fee", "Aircraft Utilization Charges", sourceText, "evidence-utilization-projected-fee");
  const utilizationObligation = obligation("utilization-projected-fee", "other", sourceText, sourceClause.id);
  const history = cumulativeUtilizationHistory({
    readings: [
      { start: "2026-01-01", end: "2026-01-31", hours: 100, cycles: 100 },
      { start: "2026-02-01", end: "2026-02-28", hours: 150, cycles: 300 },
      { start: "2026-03-01", end: "2026-03-31", hours: 220, cycles: 450 },
    ],
  });
  const latest = history[0];
  const latestEvidence = latest.evidence[0];
  const risk = deriveAviationLeaseRiskAssessment(runAssessment({
    clauses: [sourceClause],
    obligations: [utilizationObligation],
    latestAssessments: [{
      id: latest.id,
      obligation_id: utilizationObligation.id,
      status: "fulfilled",
      evidence: [{
        evidence_id: latestEvidence.id,
        document_name: latestEvidence.documentName,
        version_number: latestEvidence.versionNumber,
        source_locator: latestEvidence.sourceLocator,
        page_number: latestEvidence.pageNumber,
        excerpt: latestEvidence.excerpt,
        review_status: latestEvidence.reviewStatus,
        relationship: latestEvidence.relationship,
        period_status: latestEvidence.periodStatus,
      }],
    }],
    utilizationHistoryByObligation: { [utilizationObligation.id]: history },
    asOf: "2026-03-31",
  })).risks[0];
  const financial = risk.utilisation_exposure.metrics[0].financialExposure;

  assert.equal(financial.status, "potential_future_exposure");
  assert.equal(financial.current.status, "no_demonstrated_exposure");
  assert.equal(financial.current.amount, 0);
  assert.equal(financial.projected.status, "potential_future_exposure");
  assert.equal(financial.projected.measurementDate, "2026-12-31");
  assert.equal(financial.projected.amount, 100_000);
  assert.equal(financial.projected.currency, "USD");
  assert.equal(financial.projected.sources.length, 3);
  assert.match(financial.projected.calculation, /capped at USD 100000/);
  assert.match(risk.description, /not an incurred liability/i);
  assert.match(risk.recommended_action, /before the contractual measurement date 2026-12-31/i);
});

test("fails utilization calculations safely for missing, stale, invalid, unverified, mismatched, or conflicting evidence", () => {
  const sourceClause = clause(
    "clause-utilization",
    "Aircraft Utilization",
    "The Lessee shall not exceed 300 flight hours or 500 flight cycles during each lease year.",
  );
  const utilizationObligation = obligation("utilization", "other", sourceClause.source_text, sourceClause.id);
  const baseEvidence = {
    evidence_id: "evidence-utilization-log",
    document_name: "Aircraft utilization log",
    source_locator: "Utilization summary",
    excerpt: "Recorded flight hours: 250; recorded flight cycles: 450. Reporting period: 2026-01-01 to 2026-11-09.",
    review_status: "verified",
    relationship: "supports",
    period_status: "matches",
  };
  const riskFor = (evidence, status = "evidence_submitted") => deriveAviationLeaseRiskAssessment(runAssessment({
    clauses: [sourceClause],
    obligations: [utilizationObligation],
    latestAssessments: [{
      id: "assessment-utilization",
      obligation_id: utilizationObligation.id,
      status,
      evidence,
    }],
    asOf: "2026-11-09",
  })).risks[0];
  const flightHours = (evidence, status) => riskFor(evidence, status).utilisation_exposure.metrics
    .find((item) => item.unit === "flight_hours");

  assert.equal(flightHours([]).status, "unavailable");
  assert.equal(flightHours([{ ...baseEvidence, excerpt: "Recorded flight hours: 250; reporting period: 2026-01-01 to 2026-11-08." }]).status, "stale");
  assert.equal(flightHours([{ ...baseEvidence, excerpt: "Recorded flight hours: -5; reporting period: 2026-01-01 to 2026-11-09." }]).status, "invalid");
  assert.equal(flightHours([{ ...baseEvidence, review_status: "pending" }]).status, "unverified");
  assert.equal(flightHours([{ ...baseEvidence, period_status: "mismatches" }]).status, "period_mismatch");
  assert.equal(flightHours([baseEvidence], "partially_fulfilled").status, "unverified");
  assert.equal(flightHours([{ ...baseEvidence, excerpt: "Recorded flight hours: 250." }]).status, "incomplete");
  assert.equal(flightHours([{ ...baseEvidence, excerpt: "Recorded flight hours: 250; reporting period: 2026-01-01 to 2026-12-01." }]).status, "invalid");
  assert.equal(flightHours([{ ...baseEvidence, excerpt: "Recorded flight hours: 250; reporting period: 2026-02-30 to 2026-11-09." }]).status, "invalid");
  assert.equal(flightHours([
    baseEvidence,
    { ...baseEvidence, evidence_id: "evidence-utilization-conflict", excerpt: "Recorded flight hours: 260; reporting period: 2026-01-01 to 2026-11-09." },
  ]).status, "ambiguous");

  const ambiguousClause = clause(
    "clause-utilization-ambiguous",
    "Aircraft Utilization",
    "The Lessee shall not exceed 300 flight hours in the first case. The Lessee shall not exceed 350 flight hours in the second case.",
  );
  const ambiguousLimit = deriveAviationLeaseRiskAssessment(runAssessment({
    clauses: [ambiguousClause],
    obligations: [obligation("utilization-ambiguous", "other", ambiguousClause.source_text, ambiguousClause.id)],
    asOf: "2026-11-09",
  })).risks[0].utilisation_exposure.metrics[0];
  assert.equal(ambiguousLimit.contractualLimit, null);
  assert.equal(ambiguousLimit.status, "ambiguous_contract_limit");
  assert.equal(ambiguousLimit.recordedUtilisation, null);
});

test("synthetic lease acceptance forecasts separate flight-hour and cycle limits from verified cumulative history", () => {
  const sourceClause = clause(
    "clause-utilization-forecast",
    "Aircraft Utilization",
    "The Lessee shall not exceed 300 flight hours or 500 flight cycles during each lease year.",
    "evidence-utilization-forecast-clause",
  );
  const utilizationObligation = obligation("utilization-forecast", "other", sourceClause.source_text, sourceClause.id);
  const history = cumulativeUtilizationHistory();
  const latest = history[0];
  const latestEvidence = latest.evidence[0];
  const result = deriveAviationLeaseRiskAssessment(runAssessment({
    clauses: [sourceClause],
    obligations: [utilizationObligation],
    latestAssessments: [{
      id: latest.id,
      obligation_id: utilizationObligation.id,
      status: latest.status,
      evidence: [{
        evidence_id: latestEvidence.id,
        document_name: latestEvidence.documentName,
        version_number: latestEvidence.versionNumber,
        source_locator: latestEvidence.sourceLocator,
        page_number: latestEvidence.pageNumber,
        excerpt: latestEvidence.excerpt,
        review_status: latestEvidence.reviewStatus,
        relationship: latestEvidence.relationship,
        period_status: latestEvidence.periodStatus,
      }],
    }],
    utilizationHistoryByObligation: { [utilizationObligation.id]: history },
    deadlines: [{
      id: "verified-utilization-review-deadline",
      obligation_id: utilizationObligation.id,
      absolute_date: "2026-04-15",
      review_status: "verified",
      source_evidence_id: "evidence-utilization-forecast-clause",
    }],
    asOf: "2026-03-31",
  }));
  const risk = result.risks[0];
  const hours = risk.utilisation_exposure.metrics.find((metric) => metric.unit === "flight_hours");
  const cycles = risk.utilisation_exposure.metrics.find((metric) => metric.unit === "flight_cycles");

  assert.equal(hours.contractualLimit, 300);
  assert.equal(hours.recordedUtilisation, 220);
  assert.equal(hours.forecast.status, "forecast_available");
  assert.equal(hours.forecast.currentVerifiedUtilisation, 220);
  assert.equal(hours.forecast.averageDailyConsumption, 2.0339);
  assert.equal(hours.forecast.historicalTrend, "increasing");
  assert.equal(hours.forecast.projectedThresholdDate, "2026-05-10");
  assert.equal(hours.forecast.deadlineComparison.projectedToReachBeforeDeadline, false);
  assert.equal(hours.forecast.observations.length, 3);
  assert.equal(hours.forecast.sources.length, 3);
  assert.equal(hours.forecast.sources[0].pageNumber, 3);
  assert.equal(hours.forecast.sources[0].sourceLocator, "Monthly ledger 3");
  assert.equal(cycles.contractualLimit, 500);
  assert.equal(cycles.recordedUtilisation, 450);
  assert.equal(cycles.forecast.status, "forecast_available");
  assert.equal(cycles.forecast.projectedThresholdDate, "2026-04-09");
  assert.equal(cycles.forecast.deadlineComparison.projectedToReachBeforeDeadline, true);
  assert.match(risk.recommended_action, /verified contractual deadline of 2026-04-15/i);
  assert.match(risk.description, /not a prediction of breach or a probability/i);
  assert.ok(risk.operational_evidence.some((item) => item.evidenceId === "utilization-history-2"));
  assert.equal(risk.probability, null);
});

test("forecast fails safely for insufficient, stale, non-contiguous, unapproved, or non-cumulative history", () => {
  const sourceClause = clause(
    "clause-utilization-forecast-safe",
    "Aircraft Utilization",
    "The Lessee shall not exceed 300 flight hours during each lease year.",
  );
  const utilizationObligation = obligation("utilization-forecast-safe", "other", sourceClause.source_text, sourceClause.id);
  const deriveForecast = (history, asOf = "2026-03-31") => deriveAviationLeaseRiskAssessment(runAssessment({
    clauses: [sourceClause],
    obligations: [utilizationObligation],
    latestAssessments: [{
      id: history[0]?.id,
      obligation_id: utilizationObligation.id,
      status: history[0]?.status || "fulfilled",
      evidence: [],
    }],
    utilizationHistoryByObligation: { [utilizationObligation.id]: history },
    asOf,
  })).risks[0].utilisation_exposure.metrics[0].forecast;
  const history = cumulativeUtilizationHistory();

  assert.equal(deriveForecast(history.slice(0, 2)).status, "limited_history");
  assert.equal(deriveForecast(history, "2026-05-01").status, "outdated_evidence");
  const gap = cumulativeUtilizationHistory({
    readings: [
      { start: "2026-01-01", end: "2026-01-31", hours: 100, cycles: 100 },
      { start: "2026-02-02", end: "2026-02-28", hours: 150, cycles: 200 },
      { start: "2026-03-01", end: "2026-03-31", hours: 220, cycles: 300 },
    ],
  });
  assert.equal(deriveForecast(gap).status, "missing_periods");
  assert.equal(deriveForecast(cumulativeUtilizationHistory({ status: "under_review" })).status, "unapproved_evidence");
  const periodTotals = history.map((assessment) => ({
    ...assessment,
    evidence: assessment.evidence.map((item) => ({
      ...item,
      excerpt: item.excerpt.replace(/cumulative /gi, ""),
    })),
  }));
  assert.equal(deriveForecast(periodTotals).status, "inconsistent_evidence");
});

test("forecast rejects unverified, conflicting, overlapping, invalid, decreasing, or zero-rate observations", () => {
  const sourceClause = clause(
    "clause-utilization-forecast-invalid",
    "Aircraft Utilization",
    "The Lessee shall not exceed 300 flight hours during each lease year.",
  );
  const utilizationObligation = obligation("utilization-forecast-invalid", "other", sourceClause.source_text, sourceClause.id);
  const deriveForecast = (history) => deriveAviationLeaseRiskAssessment(runAssessment({
    clauses: [sourceClause],
    obligations: [utilizationObligation],
    latestAssessments: [{
      id: history[0]?.id,
      obligation_id: utilizationObligation.id,
      status: history[0]?.status || "fulfilled",
      evidence: [],
    }],
    utilizationHistoryByObligation: { [utilizationObligation.id]: history },
    asOf: "2026-03-31",
  })).risks[0].utilisation_exposure.metrics[0].forecast.status;
  const history = cumulativeUtilizationHistory();
  const pendingEvidence = history.map((assessment) => ({
    ...assessment,
    evidence: assessment.evidence.map((item) => ({ ...item, reviewStatus: "pending" })),
  }));
  const mismatchedEvidence = history.map((assessment) => ({
    ...assessment,
    evidence: assessment.evidence.map((item) => ({ ...item, periodStatus: "mismatches" })),
  }));
  const conflictingSamePeriod = [
    ...history,
    {
      ...history[0],
      id: "conflicting-assessment",
      evidence: [{
        ...history[0].evidence[0],
        id: "conflicting-reading",
        excerpt: history[0].evidence[0].excerpt.replace("cumulative flight hours: 220", "cumulative flight hours: 221"),
      }],
    },
  ];
  const overlapping = cumulativeUtilizationHistory({
    readings: [
      { start: "2026-01-01", end: "2026-01-31", hours: 100, cycles: 100 },
      { start: "2026-01-20", end: "2026-02-28", hours: 150, cycles: 200 },
      { start: "2026-03-01", end: "2026-03-31", hours: 220, cycles: 300 },
    ],
  });
  const invalidDate = history.map((assessment, index) => index === 1 ? ({
    ...assessment,
    evidence: assessment.evidence.map((item) => ({
      ...item,
      excerpt: item.excerpt.replace("2026-02-01 to 2026-02-28", "2026-02-30 to 2026-02-28"),
    })),
  }) : assessment);
  const decreasing = cumulativeUtilizationHistory({
    readings: [
      { start: "2026-01-01", end: "2026-01-31", hours: 100, cycles: 100 },
      { start: "2026-02-01", end: "2026-02-28", hours: 200, cycles: 200 },
      { start: "2026-03-01", end: "2026-03-31", hours: 150, cycles: 300 },
    ],
  });
  const zeroConsumption = cumulativeUtilizationHistory({
    readings: [
      { start: "2026-01-01", end: "2026-01-31", hours: 100, cycles: 100 },
      { start: "2026-02-01", end: "2026-02-28", hours: 100, cycles: 200 },
      { start: "2026-03-01", end: "2026-03-31", hours: 150, cycles: 300 },
    ],
  });

  assert.equal(deriveForecast(pendingEvidence), "unapproved_evidence");
  assert.equal(deriveForecast(mismatchedEvidence), "unapproved_evidence");
  assert.equal(deriveForecast(conflictingSamePeriod), "inconsistent_evidence");
  assert.equal(deriveForecast(overlapping), "overlapping_periods");
  assert.equal(deriveForecast(invalidDate), "invalid_evidence");
  assert.equal(deriveForecast(decreasing), "invalid_consumption");
  assert.equal(deriveForecast(zeroConsumption), "zero_consumption_anomaly");
});

test("uses explicit human assessments to distinguish disputed, partial, outstanding, and resolved findings", () => {
  const base = runAssessment({
    obligations: [obligation("maintenance", "maintenance", "Perform scheduled aircraft maintenance")],
    clauses: [clause("clause-maintenance", "Maintenance", "Lessee shall perform scheduled aircraft maintenance and retain technical records.")],
    latestAssessments: [{
      id: "assessment-disputed",
      obligation_id: "maintenance",
      status: "disputed",
      evidence: [{
        evidence_id: "operational-a",
        source_locator: "Maintenance release",
        excerpt: "Maintenance release signed.",
        confidence: 0.97,
        review_status: "verified",
        relationship: "supports",
        period_status: "matches",
      }, {
        evidence_id: "operational-b",
        source_locator: "Open item report",
        excerpt: "Required task remains open.",
        confidence: 0.93,
        review_status: "verified",
        relationship: "contradicts",
        period_status: "matches",
      }],
    }],
  });
  const disputed = deriveAviationLeaseRiskAssessment(base).risks[0];
  assert.equal(disputed.assessment_status, "disputed");
  assert.equal(disputed.priority, "HIGH");
  assert.equal(disputed.evidence_state, "conflicting");
  assert.equal(disputed.operational_evidence.length, 2);
  assert.match(disputed.recommended_action, /Reconcile the conflicting/i);
  assert.doesNotMatch(disputed.description, /breach/i);

  const partiallyFulfilled = deriveAviationLeaseRiskAssessment({
    ...base,
    latestAssessments: [{ id: "assessment-partial", obligation_id: "maintenance", status: "partially_fulfilled", evidence: [] }],
  }).risks[0];
  assert.equal(partiallyFulfilled.priority, "MEDIUM");

  const notFulfilled = deriveAviationLeaseRiskAssessment({
    ...base,
    latestAssessments: [{ id: "assessment-open", obligation_id: "maintenance", status: "not_fulfilled", evidence: [] }],
  }).risks[0];
  assert.equal(notFulfilled.priority, "HIGH");
  assert.match(notFulfilled.description, /human reviewer/i);

  const resolved = deriveAviationLeaseRiskAssessment({
    ...base,
    latestAssessments: [{
      id: "assessment-resolved",
      obligation_id: "maintenance",
      status: "fulfilled",
      previous_status: "disputed",
      evidence: [],
    }],
  }).risks[0];
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.priority, "INFORMATIONAL");
  assert.match(resolved.description, /earlier assessment remains in history/i);
});

test("classifies only verified dates and preserves uncertainty separately from priority", () => {
  const input = runAssessment({
    obligations: [
      obligation("maintenance", "maintenance", "Perform scheduled aircraft maintenance"),
      obligation("insurance", "insurance", "Maintain aircraft hull insurance"),
    ],
    clauses: [
      clause("clause-maintenance", "Maintenance", "Lessee shall perform scheduled aircraft maintenance.", "evidence-maintenance", 0.62),
      clause("clause-insurance", "Insurance", "Lessee shall maintain aircraft hull insurance and provide current certificates."),
    ],
    deadlines: [{
      id: "deadline-passed",
      source_clause_id: "clause-maintenance",
      source_evidence_id: "evidence-maintenance",
      obligation_id: "maintenance",
      deadline_type: "maintenance_due_date",
      timing_expression: "Maintenance due date",
      absolute_date: "2026-11-01",
      status: "calculated",
      computability: "absolute",
      review_status: "verified",
      confidence: 0.94,
    }, {
      id: "deadline-upcoming",
      source_clause_id: "clause-insurance",
      source_evidence_id: "evidence-clause-insurance",
      obligation_id: "insurance",
      deadline_type: "insurance_renewal",
      timing_expression: "Insurance renewal",
      absolute_date: "2026-11-20",
      status: "calculated",
      computability: "absolute",
      review_status: "verified",
      confidence: 0.98,
    }],
    asOf: "2026-11-06",
  });
  const risks = deriveAviationLeaseRiskAssessment(input).risks;
  const overdue = risks.find((risk) => risk.obligation_id === "maintenance");
  assert.equal(overdue.deadline_information.status, "passed");
  assert.equal(overdue.priority, "HIGH");
  assert.match(overdue.description, /does not establish whether the action was completed/i);
  assert.ok(overdue.uncertainty_indicators.some((item) => /62%.*not a probability/i.test(item)));
  assert.ok(overdue.uncertainty_indicators.some((item) => /asset scope needs confirmation/i.test(item)));

  const approaching = risks.find((risk) => risk.obligation_id === "insurance");
  assert.equal(approaching.deadline_information.status, "approaching");
  assert.equal(approaching.priority, "MEDIUM");
});

test("does not invent findings without a confirmed lease, supported obligation, or source evidence", () => {
  const notLease = deriveAviationLeaseRiskAssessment(runAssessment({
    profile: { classification: { type: "OTHER", status: "confirmed" } },
  }));
  assert.equal(notLease.applicable, false);
  assert.deepEqual(notLease.risks, []);

  const unconfirmed = deriveAviationLeaseRiskAssessment(runAssessment({
    profile: { classification: { type: "AIRCRAFT_LEASE", status: "requires_review" } },
  }));
  assert.equal(unconfirmed.applicable, false);

  const unsupported = deriveAviationLeaseRiskAssessment(runAssessment({
    clauses: [clause("clause-insurance", "Insurance", "Lessee shall maintain aircraft hull insurance.", "evidence-insurance")],
    obligations: [obligation("insurance", "insurance", "Maintain aircraft hull insurance", "clause-insurance")],
  }));
  assert.equal(unsupported.risks.length, 1);

  const missingEvidence = deriveAviationLeaseRiskAssessment(runAssessment({
    clauses: [{
      ...clause("clause-insurance", "Insurance", "Lessee shall maintain aircraft hull insurance.", "evidence-insurance"),
      evidence: [],
    }],
    obligations: [obligation("insurance", "insurance", "Maintain aircraft hull insurance", "clause-insurance")],
  }));
  assert.deepEqual(missingEvidence.risks, []);
});

test("analysis-run API resolver scopes inputs and skips fulfilment reads for non-lease contracts", async () => {
  const seenScopes = [];
  const result = await readAnalysisRunAviationLeaseRiskAssessment({
    organizationId: ORGANIZATION_ID,
    analysisRunId: RUN_ID,
    analysisRunRepository: {
      async getById(id, organizationId) {
        assert.equal(id, RUN_ID);
        assert.equal(organizationId, ORGANIZATION_ID);
        return {
          id: RUN_ID,
          organization_id: ORGANIZATION_ID,
          contract_id: CONTRACT_ID,
          document_version_id: VERSION_ID,
          status: "completed",
        };
      },
    },
    documentVersionResolver: async (id, organizationId) => {
      assert.equal(id, VERSION_ID);
      assert.equal(organizationId, ORGANIZATION_ID);
      return { id, organization_id: ORGANIZATION_ID, document_id: DOCUMENT_ID };
    },
    profileRepository: {
      async getByRun(scope) {
        seenScopes.push(scope);
        return { classification: { type: "OTHER", status: "confirmed" } };
      },
    },
    riskRepository: {
      async listIntelligence(scope) {
        assert.deepEqual(scope, {
          organizationId: ORGANIZATION_ID,
          contractId: CONTRACT_ID,
          documentId: DOCUMENT_ID,
          documentVersionId: VERSION_ID,
          analysisRunId: RUN_ID,
        });
        return { clauses: [], obligations: [], deadlines: [] };
      },
    },
    fulfilmentRepository: {
      async listLatestForRun() {
        assert.fail("non-lease analysis must not query fulfilment assessments");
      },
    },
  });
  assert.equal(result.applicable, false);
  assert.equal(seenScopes[0].organizationId, ORGANIZATION_ID);
});

test("analysis-run resolver loads utilisation history only for run-scoped lease limits", async () => {
  const utilizationClause = clause(
    "route-utilization-clause",
    "Aircraft Utilization",
    "The Lessee shall not exceed 300 flight hours during each lease year.",
  );
  const utilizationObligation = obligation(
    "route-utilization-obligation",
    "other",
    utilizationClause.source_text,
    utilizationClause.id,
  );
  const insuranceClause = clause("route-insurance-clause", "Insurance", "Lessee shall maintain aircraft hull insurance.");
  const insuranceObligation = obligation("route-insurance-obligation", "insurance", "Maintain aircraft hull insurance", insuranceClause.id);
  const history = cumulativeUtilizationHistory();
  const historyCalls = [];
  const result = await readAnalysisRunAviationLeaseRiskAssessment({
    organizationId: ORGANIZATION_ID,
    analysisRunId: RUN_ID,
    analysisRunRepository: {
      async getById() {
        return {
          id: RUN_ID,
          organization_id: ORGANIZATION_ID,
          contract_id: CONTRACT_ID,
          document_version_id: VERSION_ID,
          status: "completed",
        };
      },
    },
    documentVersionResolver: async () => ({ id: VERSION_ID, organization_id: ORGANIZATION_ID, document_id: DOCUMENT_ID }),
    profileRepository: {
      async getByRun() {
        return profile;
      },
    },
    riskRepository: {
      async listIntelligence(scope) {
        assert.equal(scope.organizationId, ORGANIZATION_ID);
        assert.equal(scope.contractId, CONTRACT_ID);
        return {
          clauses: [utilizationClause, insuranceClause],
          obligations: [utilizationObligation, insuranceObligation],
          deadlines: [],
        };
      },
    },
    fulfilmentRepository: {
      async listLatestForRun({ scope, obligationIds }) {
        assert.equal(scope.organizationId, ORGANIZATION_ID);
        assert.deepEqual(obligationIds, [utilizationObligation.id, insuranceObligation.id]);
        const latestEvidence = history[0].evidence[0];
        return [{
          id: history[0].id,
          obligation_id: utilizationObligation.id,
          status: "fulfilled",
          evidence: [{
            evidence_id: latestEvidence.id,
            document_name: latestEvidence.documentName,
            version_number: latestEvidence.versionNumber,
            source_locator: latestEvidence.sourceLocator,
            page_number: latestEvidence.pageNumber,
            excerpt: latestEvidence.excerpt,
            review_status: latestEvidence.reviewStatus,
            relationship: latestEvidence.relationship,
            period_status: latestEvidence.periodStatus,
          }],
        }];
      },
      async listByObligation(input) {
        historyCalls.push(input);
        return history;
      },
    },
    recommendationRepository: {
      async listByRun(scope) {
        assert.equal(scope.organizationId, ORGANIZATION_ID);
        return [];
      },
    },
    asOf: "2026-03-31",
  });

  assert.deepEqual(historyCalls, [{
    organizationId: ORGANIZATION_ID,
    contractId: CONTRACT_ID,
    obligationId: utilizationObligation.id,
  }]);
  const risk = result.risks.find((item) => item.obligation_id === utilizationObligation.id);
  assert.equal(risk.utilisation_exposure.metrics[0].forecast.status, "forecast_available");
  assert.equal(result.risks.some((item) => item.obligation_id === insuranceObligation.id), true);
});

test("latest assessment query constrains tenant, contract, version, run, and obligation set", async () => {
  let captured;
  const repository = createObligationFulfilmentRepository({
    async query(sql, values) {
      captured = { sql, values };
      return { rows: [] };
    },
  });
  await repository.listLatestForRun({
    scope: {
      organizationId: ORGANIZATION_ID,
      contractId: CONTRACT_ID,
      documentId: DOCUMENT_ID,
      documentVersionId: VERSION_ID,
      analysisRunId: RUN_ID,
    },
    obligationIds: ["66666666-6666-4666-8666-666666666666"],
  });
  assert.match(captured.sql, /a\.organization_id = \$1/);
  assert.match(captured.sql, /a\.contract_id = \$2/);
  assert.match(captured.sql, /o\.document_id = \$3/);
  assert.match(captured.sql, /o\.document_version_id = \$4/);
  assert.match(captured.sql, /o\.analysis_run_id = \$5/);
  assert.match(captured.sql, /a\.obligation_id = any\(\$6::uuid\[\]\)/);
  assert.match(captured.sql, /row_number\(\) over/i);
  assert.match(captured.sql, /lead\(a\.status\)/i);

  await repository.listLatestForRun({
    scope: {
      organizationId: OTHER_ORGANIZATION_ID,
      contractId: CONTRACT_ID,
      documentId: DOCUMENT_ID,
      documentVersionId: VERSION_ID,
      analysisRunId: RUN_ID,
    },
    obligationIds: ["66666666-6666-4666-8666-666666666666"],
  });
  assert.equal(captured.values[0], OTHER_ORGANIZATION_ID);
  assert.equal(captured.values[1], CONTRACT_ID);

  await repository.listByObligation({
    organizationId: ORGANIZATION_ID,
    contractId: CONTRACT_ID,
    obligationId: "66666666-6666-4666-8666-666666666666",
  });
  assert.match(captured.sql, /a\.organization_id = \$1/);
  assert.match(captured.sql, /a\.contract_id = \$2/);
  assert.match(captured.sql, /a\.obligation_id = \$3/);
  assert.deepEqual(captured.values, [
    ORGANIZATION_ID,
    CONTRACT_ID,
    "66666666-6666-4666-8666-666666666666",
  ]);
});

test("risk intelligence repository attaches only same-run clause evidence with quality provenance", async () => {
  const calls = [];
  const rows = {
    clauses: [{
      id: "clause-insurance",
      source_text: "Lessee shall maintain aircraft hull insurance.",
      confidence: 0.96,
      review_status: "verified",
    }],
    obligations: [{
      id: "insurance",
      clause_id: "clause-insurance",
      description: "Maintain aircraft hull insurance",
    }],
    deadlines: [],
    clause_evidence: [{
      organization_id: ORGANIZATION_ID,
      clause_id: "clause-insurance",
      evidence_id: "evidence-insurance",
      rank: 1,
      support_type: "supports",
      is_primary: true,
    }],
    intelligence_evidence: [{
      id: "evidence-insurance",
      excerpt: "Insurance certificate requirement.",
      page_number: 8,
      source_locator: "Clause 8.2",
      confidence: 0.96,
      review_status: "verified",
      ambiguity_reason: null,
    }],
  };
  const client = {
    from(table) {
      const request = { table, filters: [] };
      calls.push(request);
      const query = {
        select() { return query; },
        eq(column, value) { request.filters.push([column, value]); return query; },
        in(column, value) { request.filters.push([column, value]); return query; },
        order() { return query; },
        then(resolve, reject) { return Promise.resolve({ data: rows[table] || [], error: null }).then(resolve, reject); },
      };
      return query;
    },
  };
  const result = await createRiskRepository(client).listIntelligence({
    organizationId: ORGANIZATION_ID,
    contractId: CONTRACT_ID,
    documentId: DOCUMENT_ID,
    documentVersionId: VERSION_ID,
    analysisRunId: RUN_ID,
  });
  assert.equal(result.clauses[0].evidence[0].source.confidence, 0.96);
  assert.equal(result.clauses[0].evidence[0].source.source_locator, "Clause 8.2");
  const sourceQuery = calls.find((call) => call.table === "intelligence_evidence");
  assert.deepEqual(sourceQuery.filters, [
    ["organization_id", ORGANIZATION_ID],
    ["contract_id", CONTRACT_ID],
    ["document_id", DOCUMENT_ID],
    ["document_version_id", VERSION_ID],
    ["analysis_run_id", RUN_ID],
    ["id", ["evidence-insurance"]],
  ]);
});

test("API route and workspace expose the tenant-gated lease assessment with visible provenance", async () => {
  const [routes, workspace, api, panel] = await Promise.all([
    fs.readFile(new URL("../routes/analysisRunRoutes.js", import.meta.url), "utf8"),
    fs.readFile(new URL("../frontend/src/routes/ContractWorkspace.jsx", import.meta.url), "utf8"),
    fs.readFile(new URL("../frontend/src/lib/contractsApi.js", import.meta.url), "utf8"),
    fs.readFile(new URL("../frontend/src/components/intelligence/AviationLeaseRiskAssessment.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(routes, /router\.use\(\s*authenticateUser,\s*requireOrganizationMembership,\s*requireOrganizationPermission\("contract:read"\)\s*\)/);
  assert.match(routes, /router\.get\("\/:id\/aviation-lease-risk-assessment"/);
  assert.match(workspace, /profile\?\.classification\?\.type === "AIRCRAFT_LEASE"/);
  assert.match(workspace, /<AviationLeaseRiskAssessment[\s\S]*?analysisRunId=\{analysisRun\.id\}[\s\S]*?onAssessmentChange=\{setAviationLeaseAssessment\}/);
  assert.match(api, /\/api\/analysis-runs\/\$\{analysisRunId\}\/aviation-lease-risk-assessment/);
  assert.match(panel, /Contract-source evidence/);
  assert.match(panel, /Operational evidence and human assessment/);
  assert.match(panel, /Aircraft lease utilisation exposure/);
  assert.match(panel, /Headroom \(negative means above cap\):/);
  assert.match(panel, /Reporting period:/);
  assert.match(panel, /Verified recorded utilisation:/);
  assert.match(panel, /Predicted future exposure — estimate, not a probability/);
  assert.match(panel, /Forecast unavailable:/);
  assert.match(panel, /Historical forecast source evidence/);
  assert.match(panel, /Aircraft lease contractual financial exposure/);
  assert.match(panel, /Verified contractual provision/);
  assert.match(panel, /Current demonstrated exposure/);
  assert.match(panel, /Projected financial exposure — estimate, not incurred/);
  assert.match(panel, /not invoices, incurred liabilities, accounting provisions/);
  assert.match(panel, /Suggested action — not a contractual requirement/);
  assert.match(panel, /Priority indicates review urgency, not breach or probability/);
  assert.match(panel, /role="alert"/);
});

test("Workspace updates financial context from the same aviation lease assessment response", async () => {
  const [workspace, financialImpact, riskPanel] = await Promise.all([
    fs.readFile(new URL("../frontend/src/routes/ContractWorkspace.jsx", import.meta.url), "utf8"),
    fs.readFile(new URL("../frontend/src/components/intelligence/FinancialImpactSection.jsx", import.meta.url), "utf8"),
    fs.readFile(new URL("../frontend/src/components/intelligence/AviationLeaseRiskAssessment.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, /leaseRiskAssessment=\{aviationLeaseAssessment\}/);
  assert.match(workspace, /obligations=\{obligations\}/);
  assert.match(riskPanel, /onAssessmentChange\?\.\(response\)/);
  assert.match(riskPanel, /onAssessmentChange\?\.\(updatedResult\)/);
  assert.match(financialImpact, /obligation\.clause_id !== impact\.sourceClauseId/);
  assert.match(financialImpact, /Fulfilment review:/);
  assert.match(financialImpact, /Phase 35 risk:/);
  assert.match(financialImpact, /Phase 36 action:/);
  assert.match(financialImpact, /this does not establish payment or performance/);
});
