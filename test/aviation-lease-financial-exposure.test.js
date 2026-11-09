import assert from "node:assert/strict";
import test from "node:test";

import { deriveAviationLeaseFinancialExposure } from "../services/phase3/intelligence/aviationLeaseFinancialExposureService.js";

const CONTRACT_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";
const CLAUSE_ID = "77777777-7777-4777-8777-777777777777";
const CONTRACT_EVIDENCE_ID = "88888888-8888-4888-8888-888888888888";
const UTILIZATION_EVIDENCE_ID = "99999999-9999-4999-8999-999999999999";

function clause(sourceText, overrides = {}) {
  return {
    id: CLAUSE_ID,
    clause_number: "12.4",
    review_status: "verified",
    source_text: sourceText,
    evidence: [{
      evidence_id: CONTRACT_EVIDENCE_ID,
      support_type: "supports",
      source: {
        id: CONTRACT_EVIDENCE_ID,
        excerpt: sourceText,
        source_locator: "Clause 12.4",
        page_number: 14,
        review_status: "verified",
      },
    }],
    ...overrides,
  };
}

function currentSource() {
  return [{
    evidenceId: UTILIZATION_EVIDENCE_ID,
    documentName: "Synthetic aircraft utilization ledger",
    versionNumber: 2,
    sourceLocator: "March meter statement",
    pageNumber: 3,
    excerpt: "Verified cumulative meter statement.",
  }];
}

function forecast(overrides = {}) {
  return {
    status: "forecast_available",
    currentVerifiedUtilisation: 220,
    averageDailyConsumption: 1,
    lastObservedDate: "2026-03-31",
    sources: [{
      evidenceId: UTILIZATION_EVIDENCE_ID,
      documentName: "Synthetic aircraft utilization ledger",
      versionNumber: 2,
      sourceLocator: "March meter statement",
      pageNumber: 3,
      excerpt: "Cumulative flight hours and cycles verified.",
    }],
    forecastAssumption: "Observed calendar-day utilization rate remains unchanged.",
    ...overrides,
  };
}

function derive({
  contractClause,
  unit = "flight_hours",
  limit = 300,
  period = "per lease year",
  assessmentStatus = "fulfilled",
  utilizationStatus = "exceeded",
  utilization = 320,
  reportingPeriod = { start: "2026-01-01", end: "2026-03-31" },
  forecastValue = null,
  asOf = "2026-03-31",
} = {}) {
  return deriveAviationLeaseFinancialExposure({
    clause: contractClause,
    unit,
    contractualLimit: limit,
    contractualMeasurementPeriod: period,
    assessmentStatus,
    currentUtilisationStatus: utilizationStatus,
    currentUtilisation: utilization,
    currentReportingPeriod: reportingPeriod,
    currentSources: currentSource(),
    forecast: forecastValue,
    asOf,
    contractId: CONTRACT_ID,
    contractVersionId: VERSION_ID,
  });
}

test("calculates current demonstrated flight-hour excess charges from verified contractual terms", () => {
  const contractClause = clause(
    "The Lessee shall not exceed 300 flight hours per lease year. Any excess flight hours shall be charged at USD 500 per flight hour.",
  );
  const result = derive({ contractClause });

  assert.equal(result.status, "currently_demonstrated_exposure");
  assert.equal(result.current.status, "currently_demonstrated_exposure");
  assert.equal(result.current.excessUnits, 20);
  assert.equal(result.current.amount, 10_000);
  assert.equal(result.current.currency, "USD");
  assert.match(result.current.calculation, /max\(0, 320 flight hours - 300 flight hours\)/);
  assert.equal(result.contractualProvision.contractId, CONTRACT_ID);
  assert.equal(result.contractualProvision.contractVersionId, VERSION_ID);
  assert.equal(result.contractualProvision.clauseNumber, "12.4");
  assert.equal(result.contractualProvision.evidence[0].evidenceId, CONTRACT_EVIDENCE_ID);
  assert.equal(result.projected.amount, null);
});

test("projects capped hour charges and independent cycle charges in their own currencies", () => {
  const contractClause = clause(
    "The Lessee shall not exceed 300 flight hours per lease year. Any excess flight hours shall be charged at USD 1,000 per flight hour. Aggregate excess flight-hour charges are capped at USD 100,000 per lease year. The Lessee shall not exceed 500 flight cycles per lease year. Any excess flight cycles shall be charged at EUR 1,000 per flight cycle. The lease year ends on 2026-12-31.",
  );
  const hours = derive({
    contractClause,
    unit: "flight_hours",
    limit: 300,
    utilizationStatus: "approaching",
    utilization: 220,
    forecastValue: forecast({ averageDailyConsumption: 1 }),
  });
  const cycles = derive({
    contractClause,
    unit: "flight_cycles",
    limit: 500,
    utilizationStatus: "approaching",
    utilization: 450,
    forecastValue: forecast({ currentVerifiedUtilisation: 450, averageDailyConsumption: 0.5 }),
  });

  assert.equal(hours.current.status, "no_demonstrated_exposure");
  assert.equal(hours.current.amount, 0);
  assert.equal(hours.projected.status, "potential_future_exposure");
  assert.equal(hours.projected.measurementDate, "2026-12-31");
  assert.equal(hours.projected.projectedUtilisation, 495);
  assert.equal(hours.projected.projectedExcessUnits, 195);
  assert.equal(hours.projected.amount, 100_000);
  assert.equal(hours.contractualProvision.cap.measurementPeriod, "per lease year");
  assert.match(hours.projected.calculation, /capped at USD 100000/);
  assert.equal(hours.projected.sources[0].evidenceId, UTILIZATION_EVIDENCE_ID);
  assert.equal(hours.projected.assumptions.length, 1);
  assert.equal(cycles.projected.status, "potential_future_exposure");
  assert.equal(cycles.projected.currency, "EUR");
  assert.equal(cycles.projected.amount, 87_500);
  assert.equal(cycles.projected.projectedExcessUnits, 87.5);
  assert.notEqual(hours.projected.currency, cycles.projected.currency);
});

test("withholds calculation for missing, ambiguous, unapproved, or unsupported contractual inputs", () => {
  const supported = "The Lessee shall not exceed 300 flight hours per lease year. Any excess flight hours shall be charged at USD 500 per flight hour.";
  assert.equal(derive({ contractClause: clause("The Lessee shall not exceed 300 flight hours per lease year.") }).status, "requires_contractual_evidence");
  assert.equal(derive({ contractClause: clause(supported), limit: null }).status, "requires_contractual_evidence");
  assert.equal(derive({ contractClause: clause(supported), period: null }).status, "requires_contractual_evidence");
  assert.equal(derive({
    contractClause: clause(supported, { review_status: "pending" }),
  }).status, "requires_contractual_evidence");
  assert.equal(derive({
    contractClause: clause(supported, {
      evidence: [{
        evidence_id: CONTRACT_EVIDENCE_ID,
        support_type: "supports",
        source: { excerpt: supported, review_status: "pending" },
      }],
    }),
  }).status, "requires_contractual_evidence");
  assert.equal(derive({
    contractClause: clause("The Lessee shall not exceed 300 flight hours per lease year. Any excess flight hours shall be charged at $500 per flight hour."),
  }).status, "requires_contractual_evidence");
  assert.equal(derive({
    contractClause: clause("The Lessee shall not exceed 300 flight hours per lease year. Any excess flight hours shall be charged at XYZ 500 per flight hour."),
  }).status, "requires_contractual_evidence");
  assert.equal(derive({
    contractClause: clause(`${supported} Any excess flight hours shall be charged at EUR 400 per flight hour.`),
  }).status, "cannot_reliably_calculate");
  assert.equal(derive({
    contractClause: clause(`${supported} The aggregate utilization charges are capped at USD 100,000.`),
  }).status, "cannot_reliably_calculate");
  assert.equal(derive({
    contractClause: clause(`${supported} Aggregate excess flight-hour charges are capped at EUR 100,000 per lease year.`),
  }).status, "cannot_reliably_calculate");
  assert.equal(derive({
    contractClause: clause(`${supported} The Lessee shall pay a minimum utilization payment of USD 10,000.`),
  }).status, "cannot_reliably_calculate");
  assert.equal(derive({
    contractClause: clause(`${supported} The charge is subject to lessor written approval.`),
  }).status, "cannot_reliably_calculate");
});

test("requires fulfilled, sourced operations data and fails safely on invalid or incomplete projections", () => {
  const contractClause = clause(
    "The Lessee shall not exceed 300 flight hours per lease year. Any excess flight hours shall be charged at USD 500 per flight hour. The lease year ends on 2026-12-31.",
  );
  assert.equal(derive({
    contractClause,
    assessmentStatus: "under_review",
  }).status, "requires_operational_evidence");
  assert.equal(derive({
    contractClause,
    utilizationStatus: "stale",
    forecastValue: forecast(),
  }).status, "requires_operational_evidence");
  assert.equal(derive({
    contractClause,
    utilization: -1,
  }).status, "cannot_reliably_calculate");
  assert.equal(derive({
    contractClause,
    utilization: 220,
    utilizationStatus: "within_limit",
    forecastValue: forecast({ status: "limited_history", reason: "At least three periods are required." }),
  }).projected.status, "requires_operational_evidence");
  assert.equal(derive({
    contractClause,
    utilization: 220,
    utilizationStatus: "within_limit",
    forecastValue: forecast(),
  }).projected.status, "potential_future_exposure");
  assert.equal(derive({
    contractClause: clause("The Lessee shall not exceed 300 flight hours per lease year. Any excess flight hours shall be charged at USD 500 per flight hour."),
    utilization: 220,
    utilizationStatus: "within_limit",
    forecastValue: forecast(),
  }).projected.status, "cannot_reliably_calculate");
  assert.equal(derive({
    contractClause,
    utilization: 220,
    utilizationStatus: "within_limit",
    forecastValue: forecast({ averageDailyConsumption: -1 }),
  }).projected.status, "cannot_reliably_calculate");
  assert.equal(derive({
    contractClause,
    utilization: 220,
    utilizationStatus: "within_limit",
    forecastValue: forecast(),
    asOf: "2027-01-01",
  }).projected.status, "cannot_reliably_calculate");
});

test("prevents cross-unit cap allocation and calculates zero exposure without inventing costs", () => {
  const contractClause = clause(
    "The Lessee shall not exceed 300 flight hours per lease year. Any excess flight hours shall be charged at USD 500 per flight hour. Aggregate excess utilization charges are capped at USD 100,000.",
  );
  const sharedCap = derive({ contractClause });
  assert.equal(sharedCap.status, "cannot_reliably_calculate");

  const withinAllowance = derive({
    contractClause: clause("The Lessee shall not exceed 300 flight hours per lease year. Any excess flight hours shall be charged at USD 500 per flight hour."),
    utilizationStatus: "within_limit",
    utilization: 250,
  });
  assert.equal(withinAllowance.status, "no_demonstrated_exposure");
  assert.equal(withinAllowance.current.amount, 0);
  assert.equal(withinAllowance.current.currency, "USD");
});

test("keeps monthly and annual measurement periods separate and requires a matching cap period", () => {
  const monthlyClause = clause(
    "The Lessee shall not exceed 100 flight hours per month. Any excess flight hours shall be charged at USD 250 per flight hour. Aggregate excess flight-hour charges are capped at USD 5,000 per month. The measurement period ends on 2026-04-30.",
  );
  const monthly = derive({
    contractClause: monthlyClause,
    limit: 100,
    period: "per month",
    utilizationStatus: "within_limit",
    utilization: 90,
    reportingPeriod: { start: "2026-04-01", end: "2026-04-15" },
    forecastValue: forecast({
      currentVerifiedUtilisation: 90,
      averageDailyConsumption: 1,
      lastObservedDate: "2026-04-15",
    }),
    asOf: "2026-04-15",
  });
  assert.equal(monthly.projected.status, "potential_future_exposure");
  assert.equal(monthly.projected.measurementDate, "2026-04-30");
  assert.equal(monthly.projected.amount, 1_250);
  assert.equal(monthly.contractualProvision.measurementPeriod, "per month");

  const mismatchedCap = derive({
    contractClause: clause(
      "The Lessee shall not exceed 300 flight hours per lease year. Any excess flight hours shall be charged at USD 500 per flight hour. Aggregate excess flight-hour charges are capped at USD 5,000 per month.",
    ),
    utilization: 320,
  });
  assert.equal(mismatchedCap.status, "cannot_reliably_calculate");
  assert.equal(mismatchedCap.current.amount, null);
});
