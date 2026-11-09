import { createHash } from "node:crypto";
import { assertOrganizationScope, assertResourceId } from "../../../repositories/phase3/scope.js";
import { createAviationOutcomeRepository } from "../../../repositories/phase3/aviationOutcomeRepository.js";

const CLASSIFICATIONS = new Set([
  "verified_actual",
  "partially_verified",
  "unverified_reported",
  "estimated",
  "hypothetical",
]);
const OUTCOME_TYPES = new Set([
  "flight_hours",
  "flight_cycles",
  "charge",
  "maintenance_charge",
  "fx_adjustment",
  "fuel_adjustment",
  "operational_disruption",
  "supplier_impact",
  "other",
]);
const RELATIONSHIPS = new Set(["supports", "contradicts", "context"]);
const PERIOD_STATUSES = new Set(["matches", "mismatches", "not_assessed"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const METHODOLOGY_VERSION = "phase55-utilisation-v1";
const MIN_DESCRIPTIVE_SAMPLE_SIZE = 5;

const VALUE_EVALUATION_EXCLUSION_CATEGORIES = {
  invalid_forecast_snapshot: "ineligible_assessment",
  invalid_forecast_evidence: "evidence_error",
  invalid_forecast_inputs: "evidence_error",
  invalid_actual_observation: "evidence_error",
  no_subsequent_verified_outcome: "evidence_error",
  unsupported_methodology_version: "methodology_limitation",
  incompatible_measurement_basis: "ineligible_assessment",
  incompatible_unit: "ineligible_assessment",
  incompatible_observation_period: "ineligible_assessment",
  outside_projection_horizon: "ineligible_assessment",
  no_comparable_cumulative_outcome: "ineligible_assessment",
};

function outcomeError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function isDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function validateOutcomeInput(input) {
  if (!input || !OUTCOME_TYPES.has(input.outcomeType) || !CLASSIFICATIONS.has(input.classification)) {
    throw outcomeError("AVIATION_OUTCOME_TYPE_INVALID", "Select a supported outcome type and evidence classification");
  }
  if ((typeof input.value !== "number" && typeof input.value !== "string")
    || (typeof input.value === "string" && !input.value.trim())) {
    throw outcomeError("AVIATION_OUTCOME_VALUE_INVALID", "Provide a finite outcome value; utilization values cannot be negative");
  }
  const value = Number(input.value);
  if (!Number.isFinite(value) || (["flight_hours", "flight_cycles"].includes(input.outcomeType) && value < 0)) {
    throw outcomeError("AVIATION_OUTCOME_VALUE_INVALID", "Provide a finite outcome value; utilization values cannot be negative");
  }
  const unit = typeof input.unit === "string" ? input.unit.trim() : "";
  const measurementBasis = input.measurementBasis;
  const utilizationOutcome = ["flight_hours", "flight_cycles"].includes(input.outcomeType);
  if ((utilizationOutcome && !["cumulative_to_date", "reporting_period_total"].includes(measurementBasis))
    || (!utilizationOutcome && !["reporting_period_total", "event_value"].includes(measurementBasis))) {
    throw outcomeError("AVIATION_OUTCOME_BASIS_INVALID", "Select whether the value is cumulative, a period total, or an event value");
  }
  const currency = input.currency == null ? null : String(input.currency).trim().toUpperCase();
  if (!unit || unit.length > 40 || (currency && !/^[A-Z]{3}$/.test(currency))) {
    throw outcomeError("AVIATION_OUTCOME_UNIT_INVALID", "Provide a supported unit and, where applicable, a three-letter currency");
  }
  if (["flight_hours", "flight_cycles"].includes(input.outcomeType) && currency) {
    throw outcomeError("AVIATION_OUTCOME_UNIT_INVALID", "Utilization outcomes cannot include a currency");
  }
  if (["flight_hours", "flight_cycles"].includes(input.outcomeType) && unit !== input.outcomeType) {
    throw outcomeError("AVIATION_OUTCOME_UNIT_INVALID", "Utilization unit must match the selected flight-hours or cycles metric");
  }
  if (["charge", "maintenance_charge", "fx_adjustment", "fuel_adjustment"].includes(input.outcomeType) && !currency) {
    throw outcomeError("AVIATION_OUTCOME_CURRENCY_REQUIRED", "Financial outcomes require an explicit currency");
  }
  if (currency && unit !== currency) {
    throw outcomeError("AVIATION_OUTCOME_UNIT_INVALID", "Financial outcome unit must match its currency");
  }
  if (!isDate(input.periodStart) || !isDate(input.periodEnd) || input.periodStart > input.periodEnd) {
    throw outcomeError("AVIATION_OUTCOME_PERIOD_INVALID", "Provide a valid, ordered ISO reporting period");
  }
  const methodology = typeof input.methodology === "string" ? input.methodology.trim() : "";
  if (!methodology || methodology.length > 4000) {
    throw outcomeError("AVIATION_OUTCOME_METHODOLOGY_REQUIRED", "Describe the source or calculation methodology");
  }
  if (!Array.isArray(input.evidence) || input.evidence.length < 1 || input.evidence.length > 20) {
    throw outcomeError("AVIATION_OUTCOME_EVIDENCE_REQUIRED", "Link between 1 and 20 source evidence records");
  }
  const seenEvidence = new Set();
  const evidence = input.evidence.map((item) => {
    if (!UUID_PATTERN.test(item?.evidenceId || "")
      || seenEvidence.has(item.evidenceId)
      || !RELATIONSHIPS.has(item.relationship)
      || !PERIOD_STATUSES.has(item.periodStatus)) {
      throw outcomeError("AVIATION_OUTCOME_EVIDENCE_INVALID", "Each unique evidence reference needs a supported relationship and period review");
    }
    seenEvidence.add(item.evidenceId);
    return {
      evidenceId: item.evidenceId,
      relationship: item.relationship,
      periodStatus: item.periodStatus,
      reviewerNote: typeof item.reviewerNote === "string" ? item.reviewerNote.trim().slice(0, 1000) || null : null,
    };
  });
  evidence.sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  if (input.classification === "verified_actual"
    && (evidence.some((item) => item.relationship !== "supports" || item.periodStatus !== "matches")
      || evidence.some((item) => item.relationship === "contradicts"))) {
    throw outcomeError("AVIATION_OUTCOME_VERIFICATION_UNSUPPORTED", "Verified actual outcomes require period-matched supporting evidence and no contradictory evidence");
  }
  const supersedesOutcomeId = input.supersedesOutcomeId || null;
  if (supersedesOutcomeId && !UUID_PATTERN.test(supersedesOutcomeId)) {
    throw outcomeError("AVIATION_OUTCOME_CORRECTION_INVALID", "The superseded outcome identifier is invalid");
  }
  const correctionReason = typeof input.correctionReason === "string" ? input.correctionReason.trim() : "";
  if (supersedesOutcomeId && (!correctionReason || correctionReason.length > 2000)) {
    throw outcomeError("AVIATION_OUTCOME_CORRECTION_REASON_REQUIRED", "Explain why this historical outcome is being corrected");
  }
  if (!supersedesOutcomeId && correctionReason) {
    throw outcomeError("AVIATION_OUTCOME_CORRECTION_INVALID", "A correction reason is only valid when superseding an existing outcome");
  }
  const assetIdentifier = typeof input.assetIdentifier === "string" ? input.assetIdentifier.trim() : "";
  return {
    outcomeType: input.outcomeType,
    classification: input.classification,
    value,
    unit,
    measurementBasis,
    currency,
    assetIdentifier: assetIdentifier ? assetIdentifier.slice(0, 100) : null,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    methodology,
    evidence,
    supersedesOutcomeId,
    correctionReason: correctionReason || null,
  };
}

function outcomeDedupeKey(scope, reviewerUserId, input) {
  return digest({
    organizationId: scope.organizationId,
    contractId: scope.contractId,
    documentVersionId: scope.documentVersionId,
    analysisRunId: scope.analysisRunId,
    clauseId: input.clauseId,
    obligationId: input.obligationId,
    ...input,
  });
}

function forecastMetric(assessment, metricName) {
  const matches = [];
  for (const risk of assessment.risks || []) {
    for (const metric of risk.utilisation_exposure?.metrics || []) {
      if (metric.unit === metricName) matches.push({ risk, metric });
    }
  }
  return matches;
}

function hasCurrentVerifiedSupport(outcome) {
  const evidence = Array.isArray(outcome.evidence) ? outcome.evidence : [];
  return evidence.some((item) => item.reviewStatus === "verified"
      && item.relationship === "supports"
      && item.periodStatus === "matches")
    && !evidence.some((item) => item.relationship === "contradicts");
}

function dateDifferenceDays(start, end) {
  return (Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86_400_000;
}

function deriveUtilisationValueEvaluation(snapshot, outcomes) {
  const excluded = (reason) => ({ evaluation: null, reason });
  if (snapshot.methodology_version !== METHODOLOGY_VERSION) return excluded("unsupported_methodology_version");

  const inputs = snapshot.inputs;
  const generatedAt = new Date(snapshot.generated_at);
  const generatedDateOnly = Number.isFinite(generatedAt.getTime())
    ? generatedAt.toISOString().slice(0, 10)
    : null;
  const forecastEvidence = Array.isArray(snapshot.evidence) ? snapshot.evidence : [];
  if (!forecastEvidence.length
    || forecastEvidence.some((item) => item.reviewStatus !== "verified"
      || item.documentVersionId !== snapshot.document_version_id
      || item.analysisRunId !== snapshot.analysis_run_id)) {
    return excluded("invalid_forecast_evidence");
  }
  const baseline = Number(inputs?.currentVerifiedUtilisation);
  const dailyRate = Number(inputs?.averageDailyConsumption);
  const limit = Number(snapshot.contractual_limit);
  if (!inputs || typeof inputs !== "object"
    || !generatedDateOnly
    || typeof snapshot.assumption !== "string" || !snapshot.assumption.trim()
    || !isDate(snapshot.last_observed_date)
    || inputs.lastObservedDate !== snapshot.last_observed_date
    || !isDate(snapshot.estimated_threshold_date)
    || snapshot.estimated_threshold_date <= snapshot.last_observed_date
    || !Number.isFinite(baseline) || baseline < 0 || baseline > limit
    || !Number.isFinite(dailyRate) || dailyRate <= 0
    || !Number.isFinite(limit) || limit <= 0) {
    return excluded("invalid_forecast_inputs");
  }

  const candidates = outcomes
    .filter((item) => item.classification === "verified_actual"
      && !item.is_superseded
      && hasCurrentVerifiedSupport(item)
      && item.outcome_type === snapshot.metric
      && item.organization_id === snapshot.organization_id
      && item.contract_id === snapshot.contract_id
      && item.document_version_id === snapshot.document_version_id
      && item.analysis_run_id === snapshot.analysis_run_id
      && item.obligation_id === snapshot.obligation_id
      && item.clause_id === snapshot.clause_id
      && Date.parse(item.verified_at) > generatedAt.getTime())
    .sort((left, right) => String(left.period_end).localeCompare(String(right.period_end))
      || String(left.created_at).localeCompare(String(right.created_at)));
  if (!candidates.length) return excluded("no_subsequent_verified_outcome");

  let lastExclusion = "no_comparable_cumulative_outcome";
  for (const outcome of candidates) {
    if (outcome.measurement_basis !== "cumulative_to_date") {
      lastExclusion = "incompatible_measurement_basis";
      continue;
    }
    if (outcome.unit !== snapshot.unit || snapshot.unit !== snapshot.metric) {
      lastExclusion = "incompatible_unit";
      continue;
    }
    if (!isDate(outcome.period_start) || !isDate(outcome.period_end)
      || outcome.period_start > outcome.period_end
      || outcome.period_start <= generatedDateOnly
      || outcome.period_start <= snapshot.last_observed_date) {
      lastExclusion = "incompatible_observation_period";
      continue;
    }
    if (outcome.period_end > snapshot.estimated_threshold_date) {
      lastExclusion = "outside_projection_horizon";
      continue;
    }
    const actual = Number(outcome.value);
    if (!Number.isFinite(actual) || actual < baseline) {
      lastExclusion = "invalid_actual_observation";
      continue;
    }
    const daysFromLastObservation = dateDifferenceDays(snapshot.last_observed_date, outcome.period_end);
    const projected = baseline + dailyRate * daysFromLastObservation;
    if (!Number.isFinite(projected)) return excluded("invalid_forecast_inputs");
    const signedError = projected - actual;
    const percentageError = actual >= 1 ? (Math.abs(signedError) / actual) * 100 : null;
    return {
      evaluation: {
        forecastSnapshotId: snapshot.id,
        organizationId: snapshot.organization_id,
        contractId: snapshot.contract_id,
        documentVersionId: snapshot.document_version_id,
        analysisRunId: snapshot.analysis_run_id,
        clauseId: snapshot.clause_id,
        obligationId: snapshot.obligation_id,
        metric: snapshot.metric,
        unit: snapshot.unit,
        methodologyVersion: snapshot.methodology_version,
        forecastAssumption: snapshot.assumption,
        forecastGeneratedAt: snapshot.generated_at,
        forecastThresholdDate: snapshot.estimated_threshold_date,
        projectionInputs: {
          contractualLimit: limit,
          currentVerifiedUtilisation: baseline,
          averageDailyConsumption: dailyRate,
          lastObservedDate: snapshot.last_observed_date,
          observations: inputs.observations || [],
          evidenceCoverage: inputs.evidenceCoverage || null,
        },
        projectionPeriod: { from: snapshot.last_observed_date, through: outcome.period_end },
        actualReportingPeriod: { start: outcome.period_start, end: outcome.period_end },
        actualVerifiedAt: outcome.verified_at,
        actualMethodology: outcome.methodology,
        daysFromLastObservation,
        projectedCumulativeValue: Number(projected.toFixed(4)),
        actualCumulativeValue: actual,
        signedError: Number(signedError.toFixed(4)),
        absoluteError: Number(Math.abs(signedError).toFixed(4)),
        percentageError: percentageError === null ? null : Number(percentageError.toFixed(2)),
        percentageErrorEligible: percentageError !== null,
        forecastEvidenceIds: (snapshot.evidence || []).map((item) => item.evidenceId).filter(Boolean),
        outcomeEvidenceIds: (outcome.evidence || []).map((item) => item.evidenceId).filter(Boolean),
        forecastEvidence: forecastEvidence.map((item) => ({
          evidenceId: item.evidenceId,
          documentVersionId: item.documentVersionId,
          analysisRunId: item.analysisRunId,
          reviewStatus: item.reviewStatus,
          pageNumber: item.pageNumber,
          sourceLocator: item.sourceLocator,
        })),
        outcomeEvidence: (outcome.evidence || []).map((item) => ({
          evidenceId: item.evidenceId,
          reviewStatus: item.reviewStatus,
          relationship: item.relationship,
          periodStatus: item.periodStatus,
        })),
        outcomeId: outcome.id,
      },
      reason: null,
    };
  }
  return excluded(lastExclusion);
}

function deriveUtilisationValueBacktest({ snapshots, outcomes }) {
  const evaluations = [];
  const excludedReasons = {};
  const incrementExcluded = (reason) => { excludedReasons[reason] = (excludedReasons[reason] || 0) + 1; };
  for (const snapshot of snapshots) {
    if (snapshot.forecast_type !== "operational_utilisation_threshold"
      || !["flight_hours", "flight_cycles"].includes(snapshot.metric)) {
      incrementExcluded("invalid_forecast_snapshot");
      continue;
    }
    const result = deriveUtilisationValueEvaluation(snapshot, outcomes);
    if (result.evaluation) evaluations.push(result.evaluation);
    else incrementExcluded(result.reason);
  }
  const mean = (values) => values.length
    ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4))
    : null;
  const groupedEvaluations = new Map();
  for (const evaluation of evaluations) {
    const group = groupedEvaluations.get(evaluation.metric) || [];
    group.push(evaluation);
    groupedEvaluations.set(evaluation.metric, group);
  }
  const metricsByMetric = Object.fromEntries([...groupedEvaluations.entries()].map(([metric, group]) => {
    const groupErrors = group.map((item) => item.signedError);
    const percentageErrors = group.filter((item) => item.percentageErrorEligible).map((item) => item.percentageError);
    return [metric, {
      observationCount: group.length,
      sampleSizeStatus: group.length < MIN_DESCRIPTIVE_SAMPLE_SIZE ? "insufficient_sample_size" : "descriptive_sample_only",
      meanAbsoluteError: mean(group.map((item) => item.absoluteError)),
      meanSignedError: mean(groupErrors),
      meanAbsolutePercentageError: mean(percentageErrors),
      percentageErrorObservationCount: percentageErrors.length,
      overestimationCount: groupErrors.filter((error) => error > 0).length,
      underestimationCount: groupErrors.filter((error) => error < 0).length,
      exactMatchCount: groupErrors.filter((error) => error === 0).length,
    }];
  }));
  const metricGroups = Object.values(metricsByMetric);
  const excludedByCategory = {};
  for (const [reason, count] of Object.entries(excludedReasons)) {
    const category = VALUE_EVALUATION_EXCLUSION_CATEGORIES[reason] || "ineligible_assessment";
    excludedByCategory[category] = (excludedByCategory[category] || 0) + count;
  }
  return {
    status: evaluations.length ? "descriptive_projection_evaluation" : "not_available",
    eligibleForecastCount: snapshots.length,
    eligibleObservationCount: evaluations.length,
    sampleSizeStatus: evaluations.length < MIN_DESCRIPTIVE_SAMPLE_SIZE ? "insufficient_sample_size" : "descriptive_sample_only",
    excludedForecastCount: Math.max(0, snapshots.length - evaluations.length),
    excludedReasons,
    excludedByCategory,
    evaluationPeriod: evaluations.length ? {
      from: evaluations.map((item) => item.actualReportingPeriod.start).sort()[0],
      through: evaluations.map((item) => item.actualReportingPeriod.end).sort().at(-1),
    } : null,
    projectionHorizonDays: evaluations.length ? {
      minimum: Math.min(...evaluations.map((item) => item.daysFromLastObservation)),
      maximum: Math.max(...evaluations.map((item) => item.daysFromLastObservation)),
    } : null,
    evidenceCoverage: {
      eligibleOutcomeCount: evaluations.length,
      storedForecastCount: snapshots.length,
    },
    metrics: metricGroups.length === 1 ? metricGroups[0] : null,
    metricsByMetric,
    evaluations,
    limitations: [
      "Each stored snapshot is compared with at most its earliest subsequent verified cumulative observation within the original threshold-date horizon.",
      "Projection values extend the snapshot's preserved starting value and average daily rate; they do not represent a new forecast or corrected historical snapshot.",
      "Percentage error is omitted when actual cumulative utilization is below one unit, including zero, to avoid unstable small denominators.",
      "This descriptive evaluation does not establish predictive reliability, statistical confidence, or calibration; synthetic Demo data is excluded.",
    ],
  };
}

export function deriveAviationForecastBacktest({ snapshots = [], outcomes = [] } = {}) {
  const evaluations = [];
  const excluded = {};
  const incrementExcluded = (reason) => { excluded[reason] = (excluded[reason] || 0) + 1; };
  const activeOutcomes = outcomes.filter((item) => !item.is_superseded);

  for (const snapshot of snapshots) {
    if (snapshot.forecast_type !== "operational_utilisation_threshold"
      || !["flight_hours", "flight_cycles"].includes(snapshot.metric)
      || !isDate(snapshot.estimated_threshold_date)
      || !Number.isFinite(Number(snapshot.contractual_limit))) {
      incrementExcluded("invalid_forecast_snapshot");
      continue;
    }
    const generatedDate = new Date(snapshot.generated_at);
    if (!Number.isFinite(generatedDate.getTime())) {
      incrementExcluded("invalid_forecast_snapshot");
      continue;
    }
    const generatedDateOnly = generatedDate.toISOString().slice(0, 10);
    const later = activeOutcomes
      .filter((item) => item.classification === "verified_actual"
        && hasCurrentVerifiedSupport(item)
        && item.outcome_type === snapshot.metric
        && item.measurement_basis === "cumulative_to_date"
        && item.unit === snapshot.unit
        && item.organization_id === snapshot.organization_id
        && item.contract_id === snapshot.contract_id
        && item.document_version_id === snapshot.document_version_id
        && item.analysis_run_id === snapshot.analysis_run_id
        && item.obligation_id === snapshot.obligation_id
        && item.clause_id === snapshot.clause_id
        && item.period_start > generatedDateOnly
        && Date.parse(item.verified_at) > generatedDate.getTime())
      .sort((left, right) => left.period_end.localeCompare(right.period_end)
        || left.created_at.localeCompare(right.created_at));
    if (!later.length) {
      incrementExcluded("no_subsequent_verified_outcome");
      continue;
    }
    const limit = Number(snapshot.contractual_limit);
    let previousBelow = null;
    let crossing = null;
    let previousObservation = null;
    for (const observation of later) {
      if (!Number.isFinite(Number(observation.value)) || Number(observation.value) < 0
        || !isDate(observation.period_start) || !isDate(observation.period_end)
        || observation.period_start > observation.period_end
        || previousObservation && (
          observation.period_start <= previousObservation.period_end
          || Number(observation.value) < Number(previousObservation.value)
        )) {
        incrementExcluded("invalid_actual_observation");
        crossing = null;
        break;
      }
      if (Number(observation.value) >= limit) {
        crossing = observation;
        break;
      }
      previousBelow = observation;
      previousObservation = observation;
    }
    if (!crossing) {
      incrementExcluded("threshold_not_observed");
      continue;
    }
    const actualWindowStart = previousBelow?.period_end || crossing.period_start;
    const actualWindowEnd = crossing.period_end;
    if (actualWindowStart > actualWindowEnd) {
      incrementExcluded("inconsistent_observation_chronology");
      continue;
    }
    const predictedDate = snapshot.estimated_threshold_date;
    const signedErrorDays = predictedDate < actualWindowStart
      ? Math.round((Date.parse(`${predictedDate}T00:00:00Z`) - Date.parse(`${actualWindowStart}T00:00:00Z`)) / 86_400_000)
      : predictedDate > actualWindowEnd
        ? Math.round((Date.parse(`${predictedDate}T00:00:00Z`) - Date.parse(`${actualWindowEnd}T00:00:00Z`)) / 86_400_000)
        : 0;
    evaluations.push({
      forecastSnapshotId: snapshot.id,
      metric: snapshot.metric,
      forecastGeneratedAt: snapshot.generated_at,
      forecastThresholdDate: predictedDate,
      observedThresholdWindow: { start: actualWindowStart, end: actualWindowEnd },
      crossingOutcomeId: crossing.id,
      signedErrorDays,
      absoluteErrorDays: Math.abs(signedErrorDays),
      forecastHorizonDays: snapshot.forecast_horizon_days,
    });
  }

  const errors = evaluations.map((item) => item.signedErrorDays);
  const mae = errors.length ? errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length : null;
  const rmse = errors.length ? Math.sqrt(errors.reduce((sum, error) => sum + error ** 2, 0) / errors.length) : null;
  const bias = errors.length ? errors.reduce((sum, error) => sum + error, 0) / errors.length : null;
  return {
    status: evaluations.length ? "descriptive_backtest" : "not_available",
    forecastType: "operational_utilisation_threshold",
    utilisationValueEvaluation: deriveUtilisationValueBacktest({ snapshots, outcomes: activeOutcomes }),
    eligibleForecastCount: snapshots.length,
    verifiedThresholdOutcomes: evaluations.length,
    excludedForecastCount: Math.max(0, snapshots.length - evaluations.length),
    excludedReasons: excluded,
    evaluationPeriod: evaluations.length ? {
      from: evaluations.map((item) => item.observedThresholdWindow.start).sort()[0],
      through: evaluations.map((item) => item.observedThresholdWindow.end).sort().at(-1),
    } : null,
    forecastHorizonDays: evaluations.length ? {
      minimum: Math.min(...evaluations.map((item) => item.forecastHorizonDays)),
      maximum: Math.max(...evaluations.map((item) => item.forecastHorizonDays)),
    } : null,
    metrics: evaluations.length ? {
      maeDaysToObservedWindow: Number(mae.toFixed(2)),
      rmseDaysToObservedWindow: Number(rmse.toFixed(2)),
      biasDaysToObservedWindow: Number(bias.toFixed(2)),
    } : null,
    evaluations,
    limitations: [
      "Threshold-date and cumulative-utilization value comparisons are separate descriptive evaluations; neither evaluates financial outcomes or external-variable forecasts.",
      "The observed threshold date is interval-censored by the verified reporting periods; error is distance to that observed window, not to an inferred exact event date.",
      "A threshold that was not observed is excluded as right-censored, not counted as a forecast failure.",
      "No probabilistic calibration or real-world performance claim is produced.",
    ],
  };
}

export function createAviationOutcomeIntelligenceService({
  repository = createAviationOutcomeRepository(),
  assessmentReader,
  clock = () => new Date(),
} = {}) {
  if (typeof assessmentReader !== "function") throw new TypeError("assessmentReader is required");

  async function resolveAssessment({ organizationId, analysisRunId }) {
    assertOrganizationScope(organizationId);
    assertResourceId(analysisRunId, "analysisRunId");
    const assessment = await assessmentReader({ organizationId, analysisRunId });
    if (!assessment?.applicable || !assessment.contractId || !assessment.documentVersionId) {
      throw outcomeError("AVIATION_LEASE_ASSESSMENT_UNAVAILABLE", "A completed aviation lease assessment is required", 422);
    }
    return assessment;
  }

  return {
    async list({ organizationId, analysisRunId }) {
      const assessment = await resolveAssessment({ organizationId, analysisRunId });
      const outcomes = await repository.listOutcomes({
        organizationId,
        contractId: assessment.contractId,
        documentVersionId: assessment.documentVersionId,
        analysisRunId,
      });
      return {
        contractId: assessment.contractId,
        documentVersionId: assessment.documentVersionId,
        analysisRunId,
        outcomeHistoryStatus: outcomes.some((item) => item.classification === "verified_actual")
          ? "verified_history_available"
          : "not_assessed",
        outcomes,
        message: outcomes.length
          ? "Outcome records are evidence-classified; only verified actuals are eligible for historical ground truth."
          : "No outcome records are available for this contract version and analysis run. This does not establish that no contractual outcome occurred.",
      };
    },

    async recordOutcome({ organizationId, analysisRunId, reviewerUserId, input }) {
      assertResourceId(reviewerUserId, "reviewerUserId");
      const assessment = await resolveAssessment({ organizationId, analysisRunId });
      const normalized = validateOutcomeInput(input);
      const risk = (assessment.risks || []).find((item) => (
        item.obligation_id === input.obligationId
        && item.clause_id === input.clauseId
      ));
      if (!risk || !risk.contract_evidence?.some((item) => item.reviewStatus === "verified" && item.evidenceId)) {
        throw outcomeError("AVIATION_OUTCOME_CONTRACT_EVIDENCE_INVALID", "The obligation and clause must match the current assessment and have verified source-clause evidence", 422);
      }
      if (normalized.assetIdentifier
        && !risk.contract_evidence.some((item) => String(item.excerpt || "").toLowerCase().includes(normalized.assetIdentifier.toLowerCase()))) {
        throw outcomeError("AVIATION_OUTCOME_ASSET_UNSUPPORTED", "The asset identifier must be supported by the verified contract evidence", 422);
      }
      const scope = {
        organizationId,
        contractId: assessment.contractId,
        documentVersionId: assessment.documentVersionId,
        analysisRunId,
        clauseId: input.clauseId,
        obligationId: input.obligationId,
      };
      return repository.createOutcome({
        ...scope,
        reviewerUserId,
        verifiedAt: normalized.classification === "verified_actual" ? clock().toISOString() : null,
        dedupeKey: outcomeDedupeKey(scope, reviewerUserId, { ...normalized, clauseId: input.clauseId, obligationId: input.obligationId }),
        ...normalized,
      });
    },

    async snapshotForecast({ organizationId, analysisRunId, reviewerUserId, metric: metricName }) {
      assertResourceId(reviewerUserId, "reviewerUserId");
      if (!["flight_hours", "flight_cycles"].includes(metricName)) {
        throw outcomeError("AVIATION_FORECAST_METRIC_INVALID", "Select flight_hours or flight_cycles");
      }
      const assessment = await resolveAssessment({ organizationId, analysisRunId });
      const matches = forecastMetric(assessment, metricName);
      const eligible = matches.filter(({ metric }) => metric.forecast?.status === "forecast_available"
        && isDate(metric.forecast.projectedThresholdDate)
        && isDate(metric.forecast.lastObservedDate)
        && Number(metric.forecast.estimatedDaysToThreshold) > 0
        && Array.isArray(metric.forecast.sources)
        && metric.forecast.sources.length > 0);
      if (!eligible.length) {
        throw outcomeError("AVIATION_FORECAST_NOT_ELIGIBLE", "No evidence-backed future threshold estimate is available to snapshot", 422);
      }
      const generatedAt = clock().toISOString();
      const snapshots = await Promise.all(eligible.map(({ risk, metric }) => {
        const forecast = metric.forecast;
        const evidenceIds = [...new Set(forecast.sources.map((item) => item.evidenceId).filter(Boolean))];
        const inputData = {
          contractualLimit: forecast.contractualLimit,
          currentVerifiedUtilisation: forecast.currentVerifiedUtilisation,
          remainingHeadroom: forecast.remainingHeadroom,
          averageDailyConsumption: forecast.averageDailyConsumption,
          observations: forecast.observations,
          evidenceCoverage: forecast.evidenceCoverage,
          lastObservedDate: forecast.lastObservedDate,
        };
        const scope = {
          organizationId,
          contractId: assessment.contractId,
          documentVersionId: assessment.documentVersionId,
          analysisRunId,
          clauseId: risk.clause_id,
          obligationId: risk.obligation_id,
        };
        return repository.createForecastSnapshot({
          ...scope,
          reviewerUserId,
          forecastType: "operational_utilisation_threshold",
          metric: metricName,
          unit: metricName,
          contractualLimit: forecast.contractualLimit,
          generatedAt,
          lastObservedDate: forecast.lastObservedDate,
          estimatedThresholdDate: forecast.projectedThresholdDate,
          forecastHorizonDays: forecast.estimatedDaysToThreshold,
          inputs: inputData,
          assumption: forecast.forecastAssumption,
          methodologyVersion: METHODOLOGY_VERSION,
          evidenceIds,
          dedupeKey: digest({ ...scope, generatedAt, metricName, inputData, estimatedThresholdDate: forecast.projectedThresholdDate }),
        });
      }));
      return { snapshots, methodologyVersion: METHODOLOGY_VERSION };
    },

    async backtest({ organizationId, analysisRunId }) {
      const assessment = await resolveAssessment({ organizationId, analysisRunId });
      const [snapshots, outcomes] = await Promise.all([
        repository.listForecastSnapshots({
          organizationId,
          contractId: assessment.contractId,
          documentVersionId: assessment.documentVersionId,
          analysisRunId,
        }),
        repository.listOutcomes({
          organizationId,
          contractId: assessment.contractId,
          documentVersionId: assessment.documentVersionId,
          analysisRunId,
        }),
      ]);
      const evaluatedAt = clock().toISOString();
      const result = deriveAviationForecastBacktest({ snapshots, outcomes });
      return {
        ...result,
        evaluatedAt,
        utilisationValueEvaluation: {
          ...result.utilisationValueEvaluation,
          evaluatedAt,
          evaluations: result.utilisationValueEvaluation.evaluations.map((item) => ({
            ...item,
            evaluatedAt,
          })),
        },
      };
    },
  };
}
