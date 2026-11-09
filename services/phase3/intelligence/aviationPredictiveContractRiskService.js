import { assertOrganizationScope } from "../../../repositories/phase3/scope.js";
import { createAviationContractualExposureAssessment } from "./aviationContractualExposureAssessment.js";

const VALID_UTILIZATION_UNITS = new Set(["flight_hours", "flight_cycles"]);
const CURRENT_UTILIZATION_STATUSES = new Set([
  "within_limit", "approaching", "at_limit", "exceeded",
  "below_minimum", "at_minimum", "above_minimum", "minimum_period_incomplete",
]);
const VALID_FORECAST_STATUSES = new Set(["forecast_available", "threshold_reached"]);
const DAY_MS = 86_400_000;
const PHASE67_UTILISATION_METHODOLOGY = "phase67-calendar-year-run-rate-v1";

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function daysUntil(date, asOf) {
  if (!validDate(date) || !validDate(asOf)) return null;
  return Math.floor((Date.parse(`${date}T00:00:00.000Z`) - Date.parse(`${asOf}T00:00:00.000Z`)) / DAY_MS);
}

function verifiedEvidence(items, evidenceType) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item?.evidenceId && item.reviewStatus === "verified")
    .map((item) => ({
      evidenceId: item.evidenceId,
      evidenceType,
      sourceLocator: item.sourceLocator || null,
      pageNumber: item.pageNumber || null,
      excerpt: item.excerpt || null,
      reviewStatus: "verified",
    }));
}

function allEvidenceVerified(items) {
  return Array.isArray(items)
    && items.length > 0
    && items.every((item) => item?.evidenceId && item.reviewStatus === "verified");
}

function dateNumber(value) {
  return validDate(value) ? Math.floor(Date.parse(`${value}T00:00:00.000Z`) / DAY_MS) : null;
}

function rounded(value) {
  return Number(value.toFixed(2));
}

function deriveAnnualizedUtilisationProjection({
  forecast,
  current,
  contractualLimit,
  contractualMinimum,
  direction,
  contractualMeasurementPeriod,
  unit,
  asOf,
}) {
  const missingInformation = [];
  const observations = Array.isArray(forecast?.observations) ? forecast.observations : [];
  const evidence = verifiedEvidence(forecast?.sources, "forecast_utilisation");
  if (
    forecast?.status !== "forecast_available"
    || forecast.forecastReliability !== "sufficient_verified_evidence"
  ) {
    missingInformation.push("A Phase 55 deterministic forecast supported by sufficient verified utilisation history.");
  }
  const distinctEvidenceIds = new Set((forecast?.sources || []).map((item) => item?.evidenceId).filter(Boolean));
  if (
    observations.length < 3
    || observations.length > 366
    || !allEvidenceVerified(forecast?.sources)
    || distinctEvidenceIds.size < observations.length
  ) {
    missingInformation.push("Three to 366 distinct historical cumulative-utilisation observations, each with its own verified evidence citation.");
  }
  if (
    !forecast?.evidenceCoverage
    || forecast.evidenceCoverage.reportingPeriodsContiguous !== true
    || forecast.evidenceCoverage.observationCount !== observations.length
  ) {
    missingInformation.push("A complete, contiguous, non-overlapping set of period-matched observations.");
  }

  const observationsValid = observations.every((item, index) => (
    validDate(item?.start)
    && validDate(item?.end)
    && item.start <= item.end
    && Number.isFinite(item.cumulativeUtilisation)
    && item.cumulativeUtilisation >= 0
    && (!index || (
      dateNumber(item.start) === dateNumber(observations[index - 1].end) + 1
      && item.cumulativeUtilisation > observations[index - 1].cumulativeUtilisation
    ))
  ));
  if (!observationsValid) {
    missingInformation.push("Valid, contiguous reporting periods with strictly increasing cumulative readings.");
  }

  const first = observations[0];
  const latest = observations.at(-1);
  const latestAgeDays = daysUntil(asOf, latest?.end);
  if (
    !current
    || !allEvidenceVerified(current.evidence)
    || !validDate(current.reportingPeriod?.end)
    || latest?.start !== current.reportingPeriod.start
    || latest?.end !== current.reportingPeriod.end
    || latest?.cumulativeUtilisation !== current.recordedUtilisation
    || latestAgeDays === null
    || latestAgeDays < 0
    || latestAgeDays > 30
  ) {
    missingInformation.push("Fresh reviewer-approved current utilisation that matches the latest historical reading.");
  }

  const calendarYear = latest?.end?.slice(0, 4);
  const yearStart = calendarYear ? `${calendarYear}-01-01` : null;
  const yearEnd = calendarYear ? `${calendarYear}-12-31` : null;
  const limit = direction === "minimum" ? contractualMinimum : contractualLimit;
  const periodAligned = Boolean(
    calendarYear
    && /\bcalendar\s+year\b/i.test(String(contractualMeasurementPeriod || ""))
    && first?.start === yearStart
    && observations.every((item) => item.start.slice(0, 4) === calendarYear && item.end.slice(0, 4) === calendarYear)
    && asOf.slice(0, 4) === calendarYear
    && validDate(asOf)
    && Number.isFinite(limit)
    && limit > 0,
  );
  if (!periodAligned) {
    missingInformation.push("An explicit calendar-year allowance and evidence beginning at that same calendar-year boundary.");
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    missingInformation.push(`A positive contractual ${direction === "minimum" ? "minimum" : "maximum"} utilisation allowance.`);
  }
  if (forecast?.lastObservedDate !== latest?.end) {
    missingInformation.push("Forecast metadata matching the last verified observation date.");
  }

  const base = {
    methodologyVersion: PHASE67_UTILISATION_METHODOLOGY,
    status: "insufficient_evidence",
    classification: "insufficient_evidence",
    comparisonStatus: "not_compared",
    unit,
    direction,
    contractualLimit: Number.isFinite(limit) ? limit : null,
    annualizedConsumptionRate: null,
    projectedUtilisationAtPeriodEnd: null,
    projectedExcessUnits: null,
    projectedShortfallUnits: null,
    horizon: null,
    historicalCoverage: {
      observationCount: observations.length,
      coveredFrom: first?.start || null,
      coveredThrough: latest?.end || null,
      reportingPeriodsContiguous: observationsValid
        && forecast?.evidenceCoverage?.reportingPeriodsContiguous === true,
    },
    observations: observations.map((item) => ({
      start: item?.start || null,
      end: item?.end || null,
      cumulativeUtilisation: Number.isFinite(item?.cumulativeUtilisation) ? item.cumulativeUtilisation : null,
    })),
    assumptions: [],
    missingInformation: [...new Set(missingInformation)],
    evidence,
    limitations: [
      "A deterministic constant-rate estimate is not a guaranteed outcome, probability, or finding of breach.",
      "No financial consequence is calculated unless a separate verified contractual formula and its inputs support one.",
    ],
  };
  if (missingInformation.length) {
    return {
      ...base,
      limitations: [...base.limitations, "No contractual-period comparison is made because evidence or period alignment is incomplete."],
    };
  }

  const elapsedDays = dateNumber(latest.end) - dateNumber(yearStart) + 1;
  const horizonDays = dateNumber(yearEnd) - dateNumber(latest.end);
  if (elapsedDays <= 0 || horizonDays < 0) {
    return {
      ...base,
      missingInformation: ["The latest observation does not fall within a valid, incomplete calendar-year projection horizon."],
      limitations: [...base.limitations, "No projection is made outside the evidenced contractual calendar-year period."],
    };
  }

  const dailyRate = current.recordedUtilisation / elapsedDays;
  const annualizedConsumptionRate = rounded(dailyRate * 365);
  if (!Number.isFinite(dailyRate) || dailyRate <= 0 || !Number.isFinite(annualizedConsumptionRate)) {
    return {
      ...base,
      missingInformation: ["A positive finite calendar-year consumption rate."],
      limitations: [...base.limitations, "No projection is made from zero or invalid consumption."],
    };
  }
  if (horizonDays === 0) {
    return {
      ...base,
      status: "period_complete",
      classification: current.status === "exceeded" || current.status === "below_minimum"
        ? "elevated_contractual_attention"
        : "no_identified_material_exposure",
      comparisonStatus: "observed_complete_period",
      annualizedConsumptionRate,
      projectedUtilisationAtPeriodEnd: current.recordedUtilisation,
      horizon: { start: latest.end, end: yearEnd, days: 0 },
      assumptions: ["The contractual calendar year is complete; the period-end value is observed, not projected."],
      missingInformation: [],
      limitations: [...base.limitations, "No future portion of the completed calendar year is projected."],
    };
  }

  const projectedUtilisationAtPeriodEnd = rounded(
    current.recordedUtilisation + dailyRate * horizonDays,
  );
  const projectedExcessUnits = direction === "maximum"
    ? rounded(Math.max(0, projectedUtilisationAtPeriodEnd - limit))
    : null;
  const projectedShortfallUnits = direction === "minimum"
    ? rounded(Math.max(0, limit - projectedUtilisationAtPeriodEnd))
    : null;
  const classification = direction === "minimum"
    ? projectedShortfallUnits > 0
      ? current.status === "below_minimum" ? "elevated_contractual_attention" : "potential_exposure_developing"
      : "no_identified_material_exposure"
    : projectedExcessUnits > 0
      ? current.status === "exceeded" || current.status === "at_limit"
        ? "elevated_contractual_attention"
        : "potential_exposure_developing"
      : projectedUtilisationAtPeriodEnd >= limit * 0.8
        ? "monitoring_recommended"
        : "no_identified_material_exposure";

  return {
    ...base,
    status: "projection_available",
    classification,
    comparisonStatus: "calendar_year_aligned",
    annualizedConsumptionRate,
    projectedUtilisationAtPeriodEnd,
    projectedExcessUnits,
    projectedShortfallUnits,
    horizon: { start: latest.end, end: yearEnd, days: horizonDays },
    assumptions: [
      `The current calendar-year cumulative utilisation of ${current.recordedUtilisation} ${unit} is projected using its observed average daily rate through ${yearEnd}.`,
      "The observed average calendar-day consumption rate remains unchanged through the projection horizon; no seasonality, planned operational change, or disruption is modelled.",
    ],
    missingInformation: [],
    limitations: [
      ...base.limitations,
      "A projected excess or shortfall is an early-review signal only; it does not establish a breach, liability, penalty, or maintenance consequence.",
    ],
  };
}

function hasExpectedContext(item, { organizationId, contractId, analysisRunId, documentVersionId } = {}) {
  return (!organizationId || !item.organizationId || item.organizationId === organizationId)
    && (!contractId || item.contractId === contractId)
    && (!analysisRunId || item.analysisRunId === analysisRunId)
    && (!documentVersionId || item.documentVersionId === documentVersionId);
}

function addFinancialExposure(component, exposure, expectedVersionId = null) {
  const provision = exposure?.contractualProvision;
  if (
    !provision?.clauseId
    || provision.clauseId !== component.clauseId
    || provision.unit !== component.unit
    || expectedVersionId && provision.contractVersionId !== expectedVersionId
    || !allEvidenceVerified(provision.evidence)
  ) return;

  const normalizeAmount = (item, kind) => {
    const sources = item?.sources;
    if (
      !item
      || !Number.isFinite(item.amount)
      || item.amount <= 0
      || !item.currency
      || !allEvidenceVerified(sources)
    ) return null;
    return {
      kind,
      amount: item.amount,
      currency: item.currency,
      status: item.status,
      reportingPeriod: item.reportingPeriod || null,
      measurementDate: item.measurementDate || null,
      calculation: item.calculation || null,
      assumptions: item.assumptions || [],
      evidence: verifiedEvidence(sources, kind === "current" ? "recorded_utilisation" : "forecast_utilisation"),
    };
  };

  component.financialExposure = {
    contractualProvision: {
      clauseId: provision.clauseId,
      clauseNumber: provision.clauseNumber || null,
      unit: provision.unit,
      measurementPeriod: provision.measurementPeriod || null,
      currency: exposure.currency || null,
      evidence: verifiedEvidence(provision.evidence, "contractual_provision"),
    },
    current: normalizeAmount(exposure.current, "current"),
    projected: normalizeAmount(exposure.projected, "projected"),
    limitations: exposure.limitations || [],
  };
}

function externalComponents(externalRisk, context) {
  const assessments = Array.isArray(externalRisk?.contractualAssessments)
    ? externalRisk.contractualAssessments.slice(0, 2000)
    : [];
  const components = [];
  for (const item of assessments) {
    if (!hasExpectedContext(item, context)) continue;
    if (!["verified_contractual_relationship", "requires_review"].includes(item.status)) continue;
    const clauseEvidence = verifiedEvidence(
      item.evidence ? [item.evidence] : [],
      "contractual_provision",
    );
    if (!item.clauseId || !clauseEvidence.length) continue;
    const verified = item.status === "verified_contractual_relationship";
    const observation = item.observation || null;
    const indicatorId = observation?.indicatorId || null;
    const dueDate = item.contractualPayment?.dueDate || item.indexationExposure?.terms?.adjustmentDate || null;
    const obligationEvidence = verifiedEvidence(
      item.obligationEvidence ? [item.obligationEvidence] : [],
      "contractual_obligation",
    );
    const component = {
      id: `external:${item.contractId}:${item.documentVersionId}:${item.clauseId}:${item.category}:${item.evidence.evidenceId}`,
      kind: "external_sensitivity",
      factor: item.category,
      status: verified ? "verified_contractual_relationship" : "requires_review",
      organizationId: context.organizationId || item.organizationId || null,
      contractId: item.contractId,
      contractTitle: item.contractTitle || "Contract",
      analysisRunId: item.analysisRunId,
      documentVersionId: item.documentVersionId,
      clauseId: item.clauseId,
      clauseNumber: item.clauseNumber || null,
      mechanism: item.mechanism,
      indicatorId: item.indicatorId || indicatorId,
      contractualPayment: item.contractualPayment || null,
      contractualRateTerms: item.contractualRateTerms || null,
      fuelExposure: item.fuelExposure || null,
      financingExposure: item.financingExposure || null,
      indexationExposure: item.indexationExposure || null,
      benchmark: item.benchmark || null,
      measurementPeriod: dueDate ? { paymentDate: dueDate } : null,
      observation: observation ? {
        id: observation.id || null,
        indicatorId,
        value: observation.value,
        unit: observation.unit,
        currency: observation.currency || null,
        baseCurrency: observation.baseCurrency || null,
        quoteCurrency: observation.quoteCurrency || null,
        recordType: observation.recordType || null,
        observationDate: observation.observationDate,
        ageDays: observation.ageDays,
        publicationTimestamp: observation.publicationTimestamp || null,
        retrievalTimestamp: observation.retrievalTimestamp,
        sourceId: observation.sourceId,
        sourceName: observation.sourceName,
        sourceReference: observation.sourceReference,
        marketApplicability: observation.marketApplicability || null,
        dataQualityStatus: observation.dataQualityStatus || null,
        freshnessStatus: observation.freshnessStatus,
        historical: observation.historical,
        updateStatus: observation.updateStatus,
        movement: observation.movement || null,
      } : null,
      calculation: item.calculation || { status: "not_calculated", missingInputs: [] },
      evidence: clauseEvidence,
      obligationId: item.obligationReviewStatus === "verified" && obligationEvidence.length
        ? item.obligationId || null
        : null,
      obligationDescription: item.obligationReviewStatus === "verified" && obligationEvidence.length
        ? item.obligationDescription || null
        : null,
      obligationReviewStatus: obligationEvidence.length ? "verified" : null,
      obligationEvidence,
      clauseTitle: item.clauseTitle || null,
      action: item.recommendation?.action || "Review the cited provision and verify the applicable external-risk mechanism.",
      attentionDateDays: daysUntil(dueDate, externalRisk.asOf),
      financialExposure: null,
    };
    components.push(component);
  }
  return components;
}

function normalizeUtilizationMetric(item, context) {
  if (
    !item?.contractId
    || !item?.analysisRunId
    || !item?.documentVersionId
    || !item?.clauseId
    || !VALID_UTILIZATION_UNITS.has(item.unit)
    || !hasExpectedContext(item, context)
  ) return null;

  const clauseEvidence = verifiedEvidence(item.contractEvidence, "contractual_provision");
  if (!clauseEvidence.length) return null;
  const currentSources = item.current?.sources || item.sources || [];
  const currentIsVerified = allEvidenceVerified(currentSources);
  const currentAvailable = currentIsVerified
    && CURRENT_UTILIZATION_STATUSES.has(item.current?.status || item.status)
    && Number.isFinite(item.current?.recordedUtilisation ?? item.recordedUtilisation)
    && Number(item.current?.recordedUtilisation ?? item.recordedUtilisation) >= 0;
  const forecast = item.forecast || null;
  const forecastSources = forecast?.sources || [];
  const forecastAvailable = forecast
    && VALID_FORECAST_STATUSES.has(forecast.status)
    && allEvidenceVerified(forecastSources);
  const forecastObservations = Array.isArray(forecast?.observations)
    ? forecast.observations.filter((observation) => (
      validDate(observation?.start)
      && validDate(observation?.end)
      && observation.start <= observation.end
      && Number.isFinite(observation.cumulativeUtilisation)
      && observation.cumulativeUtilisation >= 0
    ))
    : [];
  const operationalHistoryCoverage = forecastAvailable && forecastObservations.length > 0
    ? {
      observationCount: forecastObservations.length,
      coveredFrom: forecastObservations[0].start,
      coveredThrough: forecastObservations.at(-1).end,
      reportingPeriodsContiguous: forecast.evidenceCoverage?.reportingPeriodsContiguous === true
        && forecast.evidenceCoverage?.observationCount === forecastObservations.length,
      sourceEvidence: verifiedEvidence(forecastSources, "forecast_utilisation"),
    }
    : null;
  const component = {
    id: `utilisation:${item.contractId}:${item.documentVersionId}:${item.clauseId}:${item.direction === "minimum" ? "minimum:" : ""}${item.unit}`,
    kind: "operational_utilisation",
    factor: "utilisation",
    status: currentAvailable
      ? item.current?.status || item.status
      : forecastAvailable ? forecast.status : "operational_evidence_unavailable",
    organizationId: item.organizationId || context.organizationId || null,
    contractId: item.contractId,
    contractTitle: item.contractTitle || "Contract",
    analysisRunId: item.analysisRunId,
    documentVersionId: item.documentVersionId,
    clauseId: item.clauseId,
    clauseNumber: item.clauseNumber || null,
    unit: item.unit,
    direction: item.direction === "minimum" ? "minimum" : "maximum",
    contractualLimit: Number.isFinite(item.contractualLimit) ? item.contractualLimit : null,
    contractualMinimum: Number.isFinite(item.contractualMinimum) ? item.contractualMinimum : null,
    contractualMeasurementPeriod: item.contractualMeasurementPeriod || item.measurementPeriod || null,
    obligationId: item.obligationReviewStatus === "verified" ? item.obligationId || null : null,
    obligationDescription: item.obligationDescription || null,
    obligationReviewStatus: item.obligationReviewStatus || null,
    obligationEvidence: verifiedEvidence(
      item.obligationEvidence ? [item.obligationEvidence] : [],
      "contractual_obligation",
    ),
    current: currentAvailable ? {
      recordedUtilisation: Number(item.current?.recordedUtilisation ?? item.recordedUtilisation),
      headroom: Number.isFinite(item.current?.headroom ?? item.headroom)
        ? Number(item.current?.headroom ?? item.headroom)
        : null,
      consumedPercent: Number.isFinite(item.current?.consumedPercent ?? item.consumedPercent)
        ? Number(item.current?.consumedPercent ?? item.consumedPercent)
        : null,
      remainingRequirement: Number.isFinite(item.current?.remainingRequirement ?? item.remainingRequirement)
        ? Number(item.current?.remainingRequirement ?? item.remainingRequirement)
        : null,
      status: item.current?.status || item.status,
      reportingPeriod: item.current?.reportingPeriod || item.reportingPeriod || null,
      evidence: verifiedEvidence(currentSources, "recorded_utilisation"),
    } : null,
    forecast: forecastAvailable ? {
      status: forecast.status,
      forecastReliability: forecast.forecastReliability || null,
      contractualLimit: Number.isFinite(forecast.contractualLimit) ? forecast.contractualLimit : null,
      averageDailyConsumption: Number.isFinite(forecast.averageDailyConsumption)
        ? forecast.averageDailyConsumption
        : null,
      lastObservedDate: forecast.lastObservedDate || null,
      observations: forecast.observations || [],
      evidenceCoverage: forecast.evidenceCoverage || null,
      estimatedThresholdDate: forecast.estimatedThresholdDate || forecast.projectedLimitDate || null,
      daysToThreshold: Number.isFinite(forecast.daysToThreshold) ? forecast.daysToThreshold : null,
      forecastAssumption: forecast.forecastAssumption || null,
      historyCoverage: operationalHistoryCoverage,
      evidence: verifiedEvidence(forecastSources, "forecast_utilisation"),
    } : null,
    deadline: item.deadline?.verified === true && validDate(item.deadline.absoluteDate)
      ? item.deadline
      : null,
    evidence: clauseEvidence,
    action: item.action || null,
    calculation: item.financialExposure || null,
    financialExposure: item.direction === "minimum" ? {
      status: item.financialExposure?.status || "not_calculated",
      reason: item.financialExposure?.reason || "No explicit shortfall charge formula is established.",
      current: null,
      projected: null,
      limitations: item.financialExposure?.limitations || [],
    } : null,
    uncertainty: [
      ...(!currentAvailable ? ["Verified current utilization is unavailable; no measured value is shown."] : []),
      ...(!forecastAvailable ? ["A supported utilization forecast is unavailable; no projection is shown."] : []),
    ],
  };

  component.annualizedProjection = deriveAnnualizedUtilisationProjection({
    forecast: forecastAvailable ? {
      ...forecast,
      sources: forecastSources,
    } : null,
    current: component.current,
    contractualLimit: component.contractualLimit,
    contractualMinimum: component.contractualMinimum,
    direction: component.direction,
    contractualMeasurementPeriod: component.contractualMeasurementPeriod,
    unit: component.unit,
    asOf: context.asOf,
  });

  const versionId = item.documentVersionId;
  const financial = item.financialExposure || null;
  if (financial) addFinancialExposure(component, financial, versionId);
  return component;
}

function utilizationComponents(portfolio, leaseAssessment, context) {
  const components = [];
  const portfolioFindings = Array.isArray(portfolio?.utilisationExposures)
    ? portfolio.utilisationExposures.slice(0, 2000)
    : [];
  for (const item of portfolioFindings) {
    const component = normalizeUtilizationMetric(item, context);
    if (component) components.push(component);
  }

  const risks = Array.isArray(leaseAssessment?.risks) ? leaseAssessment.risks.slice(0, 1000) : [];
  for (const risk of risks) {
    const riskContractId = risk.contract_id || leaseAssessment?.contractId || context.contractId;
    const riskRunId = leaseAssessment?.analysisRunId || context.analysisRunId;
    const riskVersionId = leaseAssessment?.documentVersionId || context.documentVersionId;
    if (
      !riskContractId
      || !riskRunId
      || risk.contract_id && risk.contract_id !== riskContractId
      || context.contractId && riskContractId !== context.contractId
      || context.analysisRunId && riskRunId !== context.analysisRunId
      || context.documentVersionId && riskVersionId !== context.documentVersionId
    ) continue;

    const metricRows = risk.utilisation_exposure?.metrics || [];
    for (const metric of metricRows) {
      const financial = metric.financialExposure;
      const provision = financial?.contractualProvision;
      const item = {
        organizationId: leaseAssessment?.organizationId || context.organizationId,
        contractId: riskContractId,
        contractTitle: leaseAssessment?.contractTitle || "Aircraft lease",
        analysisRunId: riskRunId,
        documentVersionId: riskVersionId || provision?.contractVersionId,
        clauseId: risk.clause_id,
        clauseNumber: provision?.clauseNumber || null,
        obligationId: risk.obligation_id || null,
        obligationDescription: risk.obligation_description || null,
        obligationReviewStatus: risk.obligation_review_status || null,
        unit: metric.unit,
        direction: metric.direction || "maximum",
        contractualLimit: metric.contractualLimit,
        contractualMinimum: metric.contractualMinimum,
        contractualMeasurementPeriod: metric.contractualMeasurementPeriod
          || risk.utilisation_exposure?.contractualMeasurementPeriod
          || null,
        status: metric.status,
        recordedUtilisation: metric.recordedUtilisation,
        headroom: metric.headroom,
        remainingRequirement: metric.remainingRequirement,
        consumedPercent: metric.consumedPercent,
        reportingPeriod: metric.reportingPeriod,
        sources: metric.sources,
        contractEvidence: risk.contract_evidence,
        forecast: metric.forecast,
        deadline: risk.deadline_information?.reviewRequired === false
          && validDate(risk.deadline_information.absoluteDate)
          ? {
            absoluteDate: risk.deadline_information.absoluteDate,
            daysRemaining: Number.isInteger(risk.deadline_information.daysRemaining)
              ? risk.deadline_information.daysRemaining
              : null,
            status: risk.deadline_information.status || null,
            verified: true,
          }
          : null,
        financialExposure: financial,
        action: risk.recommended_action || null,
      };
      const component = normalizeUtilizationMetric(item, context);
      if (component) components.push(component);
    }
  }
  return components;
}

function portfolioFinancialComponents(portfolio, context) {
  const components = [];
  const findings = Array.isArray(portfolio?.financialExposure?.findings)
    ? portfolio.financialExposure.findings.slice(0, 5000)
    : [];
  for (const item of findings) {
    if (!hasExpectedContext(item, context) || !item.clauseId || !item.unit) continue;
    const evidence = verifiedEvidence(item.evidence, "contractual_and_operational_exposure");
    if (!evidence.length || !Number.isFinite(item.amount) || item.amount <= 0 || !item.currency) continue;
    if (!item.evidence.some((source) => source.evidenceType === "contractual_provision")
      || !item.evidence.some((source) => source.evidenceType === "recorded_utilisation" || source.evidenceType === "forecast_utilisation")) continue;
    components.push({
      id: `financial:${item.id}`,
      kind: "contractual_financial_exposure",
      factor: "utilisation_charge",
      status: item.kind === "current" ? "currently_demonstrated_exposure" : "potential_future_exposure",
      contractId: item.contractId,
      contractTitle: item.contractTitle || "Contract",
      analysisRunId: item.analysisRunId,
      documentVersionId: item.documentVersionId,
      clauseId: item.clauseId,
      clauseNumber: item.clauseNumber || null,
      unit: item.unit,
      measurementPeriod: item.reportingPeriod || item.measurementDate || null,
      amount: item.amount,
      currency: item.currency,
      evidence,
      action: "Review this existing Phase 56 estimate and its cited contract and operational evidence; it remains separate from external-variable context.",
    });
  }
  return components;
}

function mergePortfolioFinancialFindings(operationalComponents, portfolioFinancial) {
  const standalone = [];
  for (const financial of portfolioFinancial) {
    const operational = operationalComponents.find((item) => (
      item.direction !== "minimum"
      && item.contractId === financial.contractId
      && item.documentVersionId === financial.documentVersionId
      && item.clauseId === financial.clauseId
      && item.unit === financial.unit
    ));
    if (!operational) {
      standalone.push(financial);
      continue;
    }

    const kind = financial.status === "currently_demonstrated_exposure" ? "current" : "projected";
    const existing = operational.financialExposure?.[kind] || null;
    if (existing) {
      if (existing.amount === financial.amount && existing.currency === financial.currency) continue;
      operational.financialExposure[kind] = null;
      operational.financialExposure.conflictingPortfolioFinding = true;
      operational.uncertainty.push("Phase 57 and the utilization metric returned conflicting financial findings for this clause and unit; no amount is selected.");
      continue;
    }

    const provisionEvidence = financial.evidence.filter((item) => item.evidenceType === "contractual_provision");
    const exposureEvidence = financial.evidence.filter((item) => item.evidenceType !== "contractual_provision");
    operational.financialExposure ||= {
      contractualProvision: {
        clauseId: financial.clauseId,
        clauseNumber: financial.clauseNumber,
        unit: financial.unit,
        measurementPeriod: null,
        currency: financial.currency,
        evidence: provisionEvidence,
      },
      current: null,
      projected: null,
      limitations: [],
    };
    operational.financialExposure[kind] = {
      kind,
      amount: financial.amount,
      currency: financial.currency,
      status: financial.status,
      reportingPeriod: financial.measurementPeriod,
      measurementDate: financial.measurementPeriod,
      calculation: null,
      assumptions: [],
      evidence: exposureEvidence,
    };
  }
  return standalone;
}

function deduplicateComponents(items) {
  const byId = new Map();
  for (const item of items) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()];
}

function componentDeadlineDays(component, asOf) {
  if (Number.isInteger(component.attentionDateDays)) return component.attentionDateDays;
  if (Number.isInteger(component.deadline?.daysRemaining)) return component.deadline.daysRemaining;
  const contractualDeadlineDays = daysUntil(component.deadline?.absoluteDate, asOf);
  if (contractualDeadlineDays !== null) return contractualDeadlineDays;
  if (Number.isInteger(component.forecast?.daysToThreshold)) return component.forecast.daysToThreshold;
  return daysUntil(component.forecast?.estimatedThresholdDate, asOf);
}

function financialAmounts(component, kind) {
  if (component.financialExposure?.[kind]?.amount > 0) {
    return [{ amount: component.financialExposure[kind].amount, currency: component.financialExposure[kind].currency }];
  }
  if (component.kind === "contractual_financial_exposure"
    && (kind === "current" ? component.status === "currently_demonstrated_exposure" : component.status === "potential_future_exposure")) {
    return [{ amount: component.amount, currency: component.currency }];
  }
  return [];
}

function prioritize(components, asOf) {
  if (components.some((component) => (
    component.kind === "operational_utilisation" && component.current?.status === "below_minimum"
  ))) {
    return {
      level: "minimum_utilisation_review",
      reason: "Verified period-matched utilization is below an explicit minimum; this is a review signal, not a breach or penalty determination.",
    };
  }
  const currentExposure = components.some((component) => (
    financialAmounts(component, "current").length > 0
    || component.kind === "operational_utilisation" && ["at_limit", "exceeded"].includes(component.current?.status)
  ));
  if (currentExposure) {
    return {
      level: "current_exposure_review",
      reason: "A verified current financial exposure or recorded utilization at or above its contractual limit is present.",
    };
  }
  const projectedExposure = components.some((component) => (
    financialAmounts(component, "projected").length > 0
    || component.forecast?.status === "threshold_reached"
  ));
  if (projectedExposure) {
    return {
      level: "projected_exposure_review",
      reason: "A supported existing projection indicates potential future exposure or a projected threshold.",
    };
  }
  if (components.some((component) => {
    const days = componentDeadlineDays(component, asOf);
    return days !== null && days >= 0 && days <= 30;
  })) {
    return {
      level: "time_sensitive_review",
      reason: "A verified payment or forecast threshold date is within 30 days.",
    };
  }
  if (components.some((component) => (
    component.kind === "operational_utilisation" && component.current?.status === "approaching"
  ))) {
    return {
      level: "approaching_limit_review",
      reason: "Phase 54's existing approaching-limit review status is present; its threshold is a review convention, not a probability or forecast.",
    };
  }
  if (components.some((component) => component.status === "requires_review")) {
    return {
      level: "evidence_review",
      reason: "A verified source clause requires reviewer confirmation before its sensitivity can be treated as established.",
    };
  }
  return {
    level: components.length > 1 ? "coexisting_components_review" : "monitor",
    reason: components.length > 1
      ? "Multiple evidence-backed components coexist in this contract; their count is not evidence of greater financial loss."
      : "A verified contractual component is available for monitoring; no additional severity is inferred.",
  };
}

function interactionFor(components) {
  if (components.length < 2) return [];
  const sameClause = new Map();
  for (const component of components) {
    if (!sameClause.has(component.clauseId)) sameClause.set(component.clauseId, []);
    sameClause.get(component.clauseId).push(component.id);
  }
  const relationships = [];
  for (const [clauseId, ids] of sameClause) {
    if (ids.length > 1) {
      relationships.push({
        classification: "potentially_linked",
        componentIds: ids,
        clauseId,
        reason: "Components cite the same clause, but the verified source does not establish a shared calculation method or permit combined amounts.",
      });
    }
  }
  relationships.push({
    classification: "unknown",
    componentIds: components.map((component) => component.id),
    clauseIds: [...new Set(components.map((component) => component.clauseId))],
    reason: "Contract-level co-occurrence does not establish dependency or independence. No cross-component sum or causal relationship is asserted.",
  });
  return relationships;
}

function assessmentPriority(component) {
  if (component.status === "requires_review" || component.status === "operational_evidence_unavailable") {
    return { level: "review_evidence", basis: "Required reviewer approval or current supporting evidence is unavailable." };
  }
  if (component.kind === "operational_utilisation") {
    const status = component.current?.status;
    if (["exceeded", "at_limit", "below_minimum"].includes(status)) {
      return { level: "review_current_period", basis: `The verified current-period utilisation status is ${status.replaceAll("_", " ")}; this is not a breach or penalty determination.` };
    }
    if (status === "approaching") {
      return { level: "review_before_next_period", basis: "The existing Phase 54 approaching threshold is a monitoring convention, not a forecast." };
    }
  }
  return {
    level: component.kind === "external_sensitivity" ? "review_external_inputs" : "monitor",
    basis: component.kind === "external_sensitivity"
      ? "The verified clause and any matching external observation are context only; customer-specific financial impact is not established."
      : "Continue period-matched monitoring; no additional severity is inferred.",
  };
}

function assessmentDataFreshness(component, asOf) {
  if (component.kind === "external_sensitivity") {
    const observation = component.observation;
    return {
      status: observation?.freshnessStatus || "not_available",
      assessedAsOf: asOf,
      latestObservationDate: observation?.observationDate || null,
      ageDays: Number.isFinite(observation?.ageDays) ? observation.ageDays : null,
      maxAgeDays: null,
      sourceName: observation?.sourceName || null,
    };
  }
  const observationDate = component.current?.reportingPeriod?.end
    || component.forecast?.lastObservedDate
    || component.annualizedProjection?.coveredThrough
    || null;
  const ageDays = observationDate ? daysUntil(asOf, observationDate) : null;
  return {
    status: ageDays === null ? "not_available"
      : ageDays < 0 ? "invalid_date"
        : ageDays > 30 ? "stale" : "current",
    assessedAsOf: asOf,
    latestObservationDate: observationDate,
    ageDays: ageDays !== null && ageDays >= 0 ? ageDays : null,
    maxAgeDays: 30,
    sourceName: null,
  };
}

function makeExposureAssessment(component, organizationId, asOf, assessmentTimestamp) {
  const operationalEvidence = [
    ...(component.current?.evidence || []),
    ...(component.financialExposure?.current?.evidence || []),
  ];
  const forecastEvidence = [
    ...(component.forecast?.evidence || []),
    ...(component.financialExposure?.projected?.evidence || []),
  ];
  const missingInformation = [
    ...(component.calculation?.missingInputs || []),
    ...(component.uncertainty || []),
    ...(!component.obligationId ? ["A specific extracted obligation is not linked to this clause assessment."] : []),
  ];
  let methodology;
  let contractualFacts = [];
  let verifiedObservations = [];
  let userAssumptions = [];
  let result;
  let riskIdentified;
  let potentialConsequence;
  let action;
  let externalEvidence = [...(component.obligationEvidence || [])];

  if (component.kind === "external_sensitivity") {
    const fuelCalculation = component.factor === "fuel" ? component.fuelExposure?.calculation : null;
    const indexationCalculation = component.factor === "inflation" ? component.indexationExposure?.calculation : null;
    const financingCalculation = component.factor === "interest"
      ? component.financingExposure?.calculation
      : null;
    methodology = {
      id: indexationCalculation ? indexationCalculation.methodology : component.factor === "fuel" && fuelCalculation
        ? fuelCalculation.methodology
        : financingCalculation
          ? financingCalculation.methodology
          : "verified_clause_external_reference_context",
      version: indexationCalculation ? indexationCalculation.methodology : component.factor === "fuel" && fuelCalculation
        ? fuelCalculation.methodology
        : financingCalculation
          ? financingCalculation.methodology
          : "phase58-contractual-reference-assessment-v1",
      description: indexationCalculation
        ? "Applies the explicit index-ratio formula, indexed share and protections to the exact reviewed reference month; not an invoice, forecast or net recoverable exposure."
        : fuelCalculation
        ? "Applies only the explicit current-version clause baseline, pass-through percentage, gallon volume, period, and matching verified weekly benchmark; it is not an invoice amount, forecast, or net exposure."
        : financingCalculation
          ? "Calculates a simple annualized balance run-rate from explicit financing terms and a matching current benchmark; it is not accrued or payable interest, a forecast, or hedge-adjusted exposure."
          : "Links a verified current-version contractual clause with a validated published observation; it does not calculate customer-specific financial impact.",
    };
    if (component.contractualPayment) {
      contractualFacts.push({
        type: "contractual_payment",
        ...component.contractualPayment,
        evidenceIds: component.evidence.map((item) => item.evidenceId),
      });
    }
    if (component.contractualRateTerms) {
      contractualFacts.push({ type: "contractual_rate_terms", ...component.contractualRateTerms });
    }
    if (financingCalculation) {
      contractualFacts.push(
        {
          type: "outstanding_principal",
          amount: financingCalculation.principal.amount,
          currency: financingCalculation.principal.currency,
          evidenceIds: [financingCalculation.principal.evidenceId],
        },
        {
          type: "contractual_spread",
          value: financingCalculation.spreadBasisPoints,
          unit: "basis points",
          evidenceIds: component.evidence.map((item) => item.evidenceId),
        },
      );
    }
    if (component.indexationExposure) {
      contractualFacts.push({
        type: "contractual_indexation_terms",
        ...component.indexationExposure.terms,
        evidenceIds: component.evidence.map((item) => item.evidenceId),
      });
    }
    if (fuelCalculation) {
      contractualFacts.push(
        {
          type: "fuel_adjustment_baseline",
          amount: fuelCalculation.baselinePrice.amount,
          unit: fuelCalculation.baselinePrice.unit,
          evidenceIds: component.evidence.map((item) => item.evidenceId),
        },
        {
          type: "fuel_adjustment_volume",
          value: fuelCalculation.volume.amount,
          unit: fuelCalculation.volume.unit,
          measurementPeriod: fuelCalculation.amount.period,
          evidenceIds: component.evidence.map((item) => item.evidenceId),
        },
        {
          type: "fuel_adjustment_pass_through",
          value: fuelCalculation.passThroughPercent,
          unit: "percent",
          evidenceIds: component.evidence.map((item) => item.evidenceId),
        },
      );
    }
    if (component.observation) {
      verifiedObservations.push(component.observation);
      externalEvidence = component.observation.id
        ? [...externalEvidence, {
          evidenceId: component.observation.id,
          sourceLocator: component.observation.sourceReference,
          excerpt: `${component.observation.value} ${component.observation.unit} observed ${component.observation.observationDate}`,
          reviewStatus: "verified",
        }]
        : externalEvidence;
    } else {
      missingInformation.push("A current matching external observation.");
    }
    missingInformation.push(...(component.calculation?.missingInputs || []));
    result = {
      operational: null,
      financial: indexationCalculation ? [{
        kind: "contractual_price_indexation", status: "calculated",
        amount: indexationCalculation.incrementalCost, currency: indexationCalculation.currency,
        period: indexationCalculation.period, formula: "explicit contractual baseline/index ratio, share, threshold and protections",
        reason: component.indexationExposure.explanation,
      }] : fuelCalculation
        ? [{
          kind: "fuel_price_adjustment",
          status: "calculated",
          amount: fuelCalculation.amount.value,
          currency: fuelCalculation.amount.currency,
          period: fuelCalculation.amount.period,
          formula: fuelCalculation.formula,
          reason: component.fuelExposure.explanation,
          payingParty: fuelCalculation.payingParty,
        }]
        : financingCalculation
        ? [{
          kind: "annualized_interest_run_rate",
          status: "calculated",
          amount: financingCalculation.annualizedInterestExpense.amount,
          currency: financingCalculation.annualizedInterestExpense.currency,
          period: "year",
          formula: "explicit principal × applicable annual rate",
          reason: component.financingExposure.explanation,
        }]
        : [{
          status: component.calculation?.status || "not_calculated",
          amount: null,
          currency: null,
          reason: component.calculation?.reason || "No customer-specific external-variable impact is calculated.",
        }],
      projection: null,
    };
    riskIdentified = component.indexationExposure ? component.indexationExposure.explanation : fuelCalculation
      ? component.fuelExposure.explanation
      : financingCalculation
        ? component.financingExposure.explanation
      : `${component.factor} sensitivity is described in the cited contractual provision; transaction or customer-specific impact is not established.`;
    potentialConsequence = component.indexationExposure
      ? `${component.indexationExposure.explanation} Downstream recoverability, notice compliance and actual payment remain unverified.`
      : fuelCalculation
      ? `The cited formula produces ${fuelCalculation.amount.currency} ${fuelCalculation.amount.value.toFixed(2)} for the stated ${fuelCalculation.amount.period} and paying party. It is not an invoice, an annualized amount, or a net recoverable exposure.`
      : financingCalculation
        ? `The stated principal and current applicable rate produce a ${financingCalculation.annualizedInterestExpense.currency} ${financingCalculation.annualizedInterestExpense.amount.toFixed(2)} simple annualized run-rate. It is not accrued or payable interest and is not net of hedges.`
      : component.factor === "fx"
      ? "Exchange-rate movement may change the reference equivalent of a foreign-currency payment; the ECB rate is not a transaction price, and no loss or hedge position is inferred."
      : "The cited external variable may be relevant to the contractual mechanism, but no applicable payment impact is calculated.";
    action = component.action;
  } else {
    const minimum = component.direction === "minimum";
    const threshold = minimum ? component.contractualMinimum : component.contractualLimit;
    methodology = {
      id: minimum ? "reviewer_verified_minimum_utilisation_comparison" : "phase54_verified_utilisation_and_phase56_charge_method",
      version: minimum
        ? "phase65-minimum-utilisation-assessment-v1"
        : component.annualizedProjection?.methodologyVersion
          || (component.forecast ? "phase55-utilisation-v1" : "phase54-phase56-utilisation-assessment-v1"),
      description: minimum
        ? "Compares reviewer-approved period-matched utilisation with an explicit contractual minimum; no shortfall charge or forecast is inferred."
        : "Reuses Phase 54 reviewer-approved period-matched utilisation and Phase 56's cited deterministic charge method when its full contractual inputs are supported.",
    };
    if (threshold !== null && threshold !== undefined) {
      contractualFacts.push({
        type: minimum ? "contractual_minimum_utilisation" : "contractual_maximum_utilisation",
        value: threshold,
        unit: component.unit,
        measurementPeriod: component.contractualMeasurementPeriod,
        evidenceIds: component.evidence.map((item) => item.evidenceId),
      });
    } else {
      missingInformation.push(`A single explicit contractual ${minimum ? "minimum" : "maximum"} utilisation threshold.`);
    }
    if (!component.contractualMeasurementPeriod) {
      missingInformation.push("An explicit contractual measurement period.");
    }
    if (component.current) {
      verifiedObservations.push({
        type: "reviewer_approved_recorded_utilisation",
        value: component.current.recordedUtilisation,
        unit: component.unit,
        reportingPeriod: component.current.reportingPeriod,
        status: component.current.status,
        evidenceIds: component.current.evidence.map((item) => item.evidenceId),
      });
    } else {
      missingInformation.push("Current verified, reviewer-approved, period-matched utilisation evidence.");
    }
    if (component.forecast?.forecastAssumption) {
      userAssumptions.push({
        type: "deterministic_utilisation_estimate",
        assumption: component.forecast.forecastAssumption,
        status: component.forecast.status,
      });
    }
    const financial = component.financialExposure;
    const financialResults = financial?.current || financial?.projected
      ? [
        ...(financial.current ? [{ kind: "current", ...financial.current }] : []),
        ...(financial.projected ? [{ kind: "projected", ...financial.projected }] : []),
      ]
      : [{
        status: financial?.status || "not_calculated",
        amount: null,
        currency: null,
        reason: financial?.reason || (minimum
          ? "No verified contractual shortfall charge formula is established."
          : "No supported contractual charge formula and complete inputs are established."),
      }];
    missingInformation.push(...(financial?.limitations || []));
    result = {
      operational: component.current ? {
        direction: component.direction,
        contractualThreshold: threshold ?? null,
        recordedUtilisation: component.current.recordedUtilisation,
        unit: component.unit,
        headroom: minimum ? null : component.current.headroom,
        remainingRequirement: minimum ? component.current.remainingRequirement : null,
        consumedPercent: minimum ? null : component.current.consumedPercent,
        reportingPeriod: component.current.reportingPeriod,
        status: component.current.status,
      } : null,
      financial: financialResults,
      projection: component.forecast || component.annualizedProjection ? {
        status: component.forecast?.status || component.annualizedProjection?.status || "insufficient_evidence",
        estimatedThresholdDate: component.forecast?.estimatedThresholdDate || null,
        assumption: component.forecast?.forecastAssumption || null,
        annualizedUtilisation: component.annualizedProjection || null,
      } : null,
    };
    riskIdentified = minimum
      ? component.current?.status === "below_minimum"
        ? `Recorded ${component.unit.replaceAll("_", " ")} are below the stated minimum for the cited period.`
        : "A minimum-utilisation obligation is stated; compare it with approved utilisation for its exact contractual period."
      : component.current?.status === "exceeded"
        ? `Recorded ${component.unit.replaceAll("_", " ")} are above the cited contractual maximum.`
        : component.current?.status === "approaching" || component.current?.status === "at_limit"
          ? `Recorded ${component.unit.replaceAll("_", " ")} are near or at the cited contractual maximum.`
          : "A contractual utilisation allowance is identified; current evidence and period must be monitored.";
    potentialConsequence = financial?.current?.amount > 0
      ? `The cited provision and verified current-period evidence support a deterministic estimate of ${financial.current.amount} ${financial.current.currency}; it is not an invoice, incurred liability, or legal conclusion.`
      : financial?.projected?.amount > 0
        ? `The existing deterministic estimate is ${financial.projected.amount} ${financial.projected.currency} at its stated contractual measurement date; it is not incurred exposure or a breach prediction.`
        : minimum && component.current?.status === "below_minimum"
          ? "The measured shortfall may require operational review. No financial penalty or legal consequence is inferred without an express applicable contractual formula."
          : "Excess use or a minimum-utilisation shortfall does not automatically establish a penalty. Any financial consequence depends on an applicable, evidenced contractual formula, period, and conditions.";
    action = component.action || (minimum
      ? "Confirm the reporting period and minimum-utilisation terms with the aircraft operations and lease owners; review any express shortfall terms before discussing consequences."
      : "Review utilisation headroom with the aircraft operations and lease owners, refresh period-matched evidence, and confirm any express excess-use terms before discussing a charge.");
  }

  const priority = assessmentPriority(component);
  const category = component.kind === "external_sensitivity"
    ? component.factor === "fx" ? "fx_reference_sensitivity" : `${component.factor}_external_risk_sensitivity`
    : component.direction === "minimum"
      ? "aircraft_lease_minimum_utilisation"
      : "aircraft_lease_maximum_utilisation";
  return createAviationContractualExposureAssessment({
    id: component.id,
    category,
    status: component.status,
    organizationId,
    contractId: component.contractId,
    contractTitle: component.contractTitle,
    analysisRunId: component.analysisRunId,
    documentVersionId: component.documentVersionId,
    obligationId: component.obligationId,
    obligationDescription: component.obligationDescription,
    clauseId: component.clauseId,
    clauseNumber: component.clauseNumber,
    clauseTitle: component.clauseTitle,
    riskVariable: { category: component.factor, indicatorId: component.indicatorId || null, unit: component.unit || null },
    methodology,
    contractualFacts,
    verifiedObservations,
    userAssumptions,
    missingInformation,
    result,
    dataFreshness: assessmentDataFreshness(component, asOf),
    priority,
    recommendation: {
      riskIdentified,
      potentialConsequence,
      proposedAction: action || "Review the cited provision and confirm the applicable operational or financial inputs.",
      expectedBenefit: component.kind === "external_sensitivity"
        ? "Clarifying actual settlement, reporting-currency, and treasury inputs may help the organisation assess the payment context; no avoided loss or savings is guaranteed."
        : "Obtaining current period-matched utilisation evidence and reviewing the cited lease terms may give operations and lease owners more time to assess available options; no avoided charge or contractual outcome is guaranteed.",
    },
    evidence: {
      contractual: component.evidence,
      operational: operationalEvidence,
      external: externalEvidence,
      forecast: forecastEvidence,
    },
    assessmentTimestamp,
    assessmentAsOf: asOf,
    limitations: [
      "Assessments remain independent; incomparable financial and operational values are not combined or double-counted.",
      "No legal breach, incurred liability, causation, probability, or cross-category severity score is inferred.",
      ...(component.uncertainty || []),
    ],
  });
}

function combinedRecommendation(contract, components) {
  if (components.length < 2) return null;
  return {
    id: `predictive-contract-review:${contract.contractId}:${contract.documentVersionId}`,
    title: `Review coexisting exposure components for ${contract.contractTitle}`,
    action: "Review the cited external sensitivity and operational or financial evidence together. Confirm whether the obligations are contractually linked, align measurement periods, and obtain missing formula, treasury, or payment inputs before estimating any joint impact.",
    rationale: "Multiple supported components occur in the same current analysis; their relationship and combined financial impact are not established.",
    componentIds: components.map((component) => component.id),
    supportingContracts: [{
      contractId: contract.contractId,
      analysisRunId: contract.analysisRunId,
      documentVersionId: contract.documentVersionId,
    }],
    clauses: [...new Map(components.map((component) => [component.clauseId, {
      clauseId: component.clauseId,
      clauseNumber: component.clauseNumber,
      evidence: component.evidence,
    }])).values()],
    observations: components.flatMap((component) => component.observation ? [component.observation] : []),
    operationalEvidence: components.flatMap((component) => [
      ...(component.current?.evidence || []),
      ...(component.forecast?.evidence || []),
      ...(component.financialExposure?.current?.evidence || []),
      ...(component.financialExposure?.projected?.evidence || []),
    ]),
    uncertainty: "No combined impact is calculated. External contractual formulas and obligation relationships remain incomplete unless independently stated in verified source evidence.",
    relevantPeriods: components.flatMap((component) => [
      component.measurementPeriod,
      component.current?.reportingPeriod,
      component.forecast?.estimatedThresholdDate,
      component.deadline?.absoluteDate,
    ].filter(Boolean)),
    supportedFinancialAssessments: components.flatMap((component) => [
      ...financialAmounts(component, "current").map((item) => ({
        type: "current",
        amount: item.amount,
        currency: item.currency,
        clauseId: component.clauseId,
      })),
      ...financialAmounts(component, "projected").map((item) => ({
        type: "projected",
        amount: item.amount,
        currency: item.currency,
        clauseId: component.clauseId,
      })),
    ]),
  };
}

function evidenceForComponent(component) {
  return [
    ...(component.evidence || []),
    ...(component.current?.evidence || []),
    ...(component.forecast?.evidence || []),
    ...(component.financialExposure?.contractualProvision?.evidence || []),
    ...(component.financialExposure?.current?.evidence || []),
    ...(component.financialExposure?.projected?.evidence || []),
  ];
}

function readinessDimension(name, status, reason) {
  return { name, status, reason };
}

function assessProbabilisticReadiness(contract, asOf, externalCoverage = []) {
  const { components } = contract;
  const operational = components.filter((item) => item.kind === "operational_utilisation");
  const external = components.filter((item) => item.kind === "external_sensitivity");
  const evidenceIds = [...new Set(components.flatMap((item) => (
    evidenceForComponent(item)
      .filter((evidence) => evidence.reviewStatus === "verified" && evidence.evidenceId)
      .map((evidence) => evidence.evidenceId)
  )))];
  const dimensions = [];

  const contractualEvidenceComplete = components.length > 0 && components.every((item) => (
    item.clauseId && allEvidenceVerified(item.evidence)
  ));
  dimensions.push(readinessDimension(
    "contractual_evidence",
    contractualEvidenceComplete ? "sufficient_evidence" : "insufficient_evidence",
    contractualEvidenceComplete
      ? "Every included component is tied to verified evidence for its current contract version."
      : "One or more components lack verified clause evidence for the current contract version.",
  ));

  const operationalEvidenceComplete = operational.length > 0 && operational.every((item) => (
    Boolean(item.current?.evidence?.length || item.forecast?.evidence?.length)
  ));
  dimensions.push(readinessDimension(
    "operational_evidence",
    operational.length === 0
      ? "not_applicable"
      : operationalEvidenceComplete ? "limited_evidence" : "insufficient_evidence",
    operational.length === 0
      ? "No operational utilization component is included."
      : operationalEvidenceComplete
        ? "Verified utilization evidence supports the existing deterministic assessment, but no probabilistic error model is validated."
        : "Verified operational evidence is incomplete for at least one utilization component.",
  ));

  const externalObservations = external.map((item) => item.observation);
  const relevantHistory = [...new Map(
    external
      .map((item) => externalCoverage.find((entry) => entry.indicatorId === item.indicatorId))
      .filter(Boolean)
      .map((entry) => [entry.indicatorId, entry]),
  ).values()];
  const hasStaleObservation = externalObservations.some((item) => item?.freshnessStatus === "stale");
  const externalObservationsComplete = external.length > 0
    && externalObservations.every((item) => (
      item?.dataQualityStatus === "verified" && item.freshnessStatus === "current"
    ));
  dimensions.push(readinessDimension(
    "external_observation_quality",
    external.length === 0
      ? "not_applicable"
      : hasStaleObservation
        ? "stale_evidence"
        : externalObservationsComplete ? "sufficient_evidence" : "insufficient_evidence",
    external.length === 0
      ? "No external observation is relevant to the included components."
      : hasStaleObservation
        ? "At least one matching external observation is stale and cannot support a current estimate."
        : externalObservationsComplete
          ? "The latest matching external observation is verified and within its source freshness window."
          : "A matching verified, current external observation is unavailable for at least one component.",
  ));

  const recencyChecks = [
    ...external.map((item) => {
      const observation = item.observation;
      if (observation?.freshnessStatus === "stale") return "stale_evidence";
      if (
        observation?.dataQualityStatus === "verified"
        && observation.freshnessStatus === "current"
        && validDate(observation.observationDate)
        && observation.observationDate <= asOf
        && Number.isFinite(observation.ageDays)
        && observation.ageDays >= 0
      ) return "sufficient_evidence";
      return "insufficient_evidence";
    }),
    ...operational.map((item) => {
      const periodEnd = item.current?.reportingPeriod?.end;
      if (!validDate(periodEnd) || periodEnd > asOf) return "insufficient_evidence";
      const ageDays = Math.floor(
        (Date.parse(`${asOf}T00:00:00.000Z`) - Date.parse(`${periodEnd}T00:00:00.000Z`)) / DAY_MS,
      );
      return ageDays > 30 ? "stale_evidence" : "sufficient_evidence";
    }),
  ];
  const recencyStatus = recencyChecks.includes("stale_evidence")
    ? "stale_evidence"
    : recencyChecks.includes("insufficient_evidence")
      ? "insufficient_evidence"
      : recencyChecks.length ? "sufficient_evidence" : "not_assessed";
  dimensions.push(readinessDimension(
    "data_recency",
    recencyStatus,
    recencyStatus === "stale_evidence"
      ? "At least one underlying observation is outside its supported recency window."
      : recencyStatus === "sufficient_evidence"
        ? "Available measurements have valid dates and are within the existing source or operational recency rule."
        : recencyStatus === "insufficient_evidence"
          ? "At least one component lacks a verifiable measurement date or freshness status."
          : "No measured observation was available to assess for recency.",
  ));

  const utilizationForecasts = operational.filter((item) => item.forecast);
  const operationalHistoryCoverage = operational
    .filter((item) => item.forecast?.historyCoverage)
    .map((item) => ({
      clauseId: item.clauseId,
      unit: item.unit,
      ...item.forecast.historyCoverage,
    }));
  const historicalCoverageStatuses = relevantHistory.map((item) => item.status);
  const historicalCoverageStatus = historicalCoverageStatuses.includes("inconsistent_units")
    ? "insufficient_evidence"
    : historicalCoverageStatuses.includes("inconsistent_currency")
      ? "insufficient_evidence"
    : historicalCoverageStatuses.includes("unverified_source")
      ? "insufficient_evidence"
      : historicalCoverageStatuses.includes("stale_observations")
        ? "stale_evidence"
        : historicalCoverageStatuses.includes("insufficient_history")
          ? "insufficient_evidence"
          : external.length > 0 && relevantHistory.length === 0
            ? "insufficient_evidence"
            : relevantHistory.some((item) => item.status === "partial_coverage")
              || external.length === 0 && operationalHistoryCoverage.length > 0
              ? "limited_evidence"
              : operational.length > 0 ? "insufficient_evidence" : "not_assessed";
  const historicalCoverageReason = relevantHistory.length
    ? `Relevant external history: ${relevantHistory.map((item) => (
      `${item.indicatorId} has ${item.observationCount} distinct date(s), ${item.oldestObservationDate || "no start date"} to ${item.latestObservationDate || "no latest date"}, maximum gap ${item.maximumObservedGapDays === null ? "unknown" : `${item.maximumObservedGapDays} day(s)`}, ${item.duplicateDateCount} duplicate date(s), ${item.revisionRecordCount} revision record(s), and ${item.gapsExceedingExpectedCadence.length} gap(s) beyond the expected cadence`
    )).join("; ")}. These are descriptive coverage statistics, not statistical model eligibility.`
    : external.length
      ? "No historical coverage summary is available for the relevant contractual indicator."
      : operationalHistoryCoverage.length
        ? `Existing Phase 55 deterministic history contains ${operationalHistoryCoverage.map((item) => (
          `${item.observationCount} cited ${item.unit.replaceAll("_", " ")} observation(s) from ${item.coveredFrom} to ${item.coveredThrough}; reporting periods ${item.reportingPeriodsContiguous ? "were" : "were not"} verified contiguous`
        )).join("; ")}. Phase 62 can preserve eligible deterministic forecast snapshots and compare them with later verified outcomes in Contract Workspace; this readiness assessment does not consume those records, and deterministic backtesting is not probabilistic calibration.`
      : utilizationForecasts.length > 0
        ? "Phase 55 history supports a deterministic rate estimate only; it is not an out-of-sample validated probabilistic dataset."
        : operational.length > 0
          ? "Insufficient historical utilization observations are available for statistical calibration."
          : "Historical outcome coverage was not assessed for these components.";
  dimensions.push(readinessDimension(
    "historical_data_coverage",
    historicalCoverageStatus,
    historicalCoverageReason,
  ));

  const unresolvedSensitivity = components.filter((item) => (
    item.status === "requires_review"
    || item.calculation?.status === "not_calculated"
    || item.kind === "external_sensitivity" && !item.calculation
  ));
  const hasDeterministicUtilizationCharge = operational.some((item) => (
    item.financialExposure?.contractualProvision?.evidence?.length
    && (item.financialExposure.current || item.financialExposure.projected)
  ));
  dimensions.push(readinessDimension(
    "contractual_sensitivity_clarity",
    unresolvedSensitivity.length > 0
      ? "insufficient_evidence"
      : hasDeterministicUtilizationCharge ? "sufficient_evidence" : "limited_evidence",
    unresolvedSensitivity.length > 0
      ? `A contractual calculation remains unresolved or unquantified; missing inputs include ${[...new Set(
        unresolvedSensitivity.flatMap((item) => item.calculation?.missingInputs || []),
      )].join(", ") || "a supported contractual calculation method"}.`
      : hasDeterministicUtilizationCharge
        ? "An existing deterministic utilization charge is supported; its uncertainty distribution is not established."
        : "Verified contractual terms support monitoring, but no complete stochastic financial calculation is established.",
  ));

  const multiVariable = new Set(components.map((item) => item.factor)).size > 1;
  dimensions.push(readinessDimension(
    "dependency_evidence",
    multiVariable ? "insufficient_evidence" : "not_applicable",
    multiVariable
      ? "Phase 59 classifies cross-component interactions as unknown; no dependence structure is evidenced or assumed."
      : "No cross-variable dependency is required for the single included factor.",
  ));
  dimensions.push(readinessDimension(
    "distribution_suitability",
    "insufficient_evidence",
    "No empirical distribution or analyst-defined prior/likelihood has been justified and validated for this contractual outcome.",
  ));
  dimensions.push(readinessDimension(
    "model_validation",
    "not_assessed",
    "No probabilistic model has been fitted or validated against held-out aviation outcomes.",
  ));

  const generatedOn = asOf;
  return {
    status: "deterministic_only",
    generatedOn,
    modelVersion: "phase60-readiness-v1",
    basis: {
      contractId: contract.contractId,
      analysisRunId: contract.analysisRunId,
      documentVersionId: contract.documentVersionId,
      evidenceIds,
      componentIds: components.map((item) => item.id),
    },
    deterministicBaselineComponentIds: components.map((item) => item.id),
    evidenceDimensions: dimensions,
    bayesianUpdate: {
      status: "not_run",
      prior: null,
      posterior: null,
      reason: "No explicit predictive outcome, justified prior, or likelihood model is supported by the available evidence.",
    },
    monteCarlo: {
      status: "not_run",
      iterations: 0,
      seed: null,
      inputs: [],
      reason: "No contract-linked financial formula and validated input distributions are available for a reproducible simulation.",
    },
    historicalObservationCoverage: relevantHistory,
    operationalObservationCoverage: operationalHistoryCoverage,
    contractualOutcomeHistory: {
      status: "not_assessed",
      verifiedOutcomeCount: null,
      reason: "Phase 62 provides a contract-version-scoped outcome history workflow in Contract Workspace, but this portfolio readiness assessment does not consume those records; their availability is not assessed here, and absence from this payload is not evidence that no outcome occurred.",
    },
    forecastEvaluation: {
      status: "not_available",
      evaluationCount: 0,
      reason: "Phase 62 supports immutable snapshots and interval-based backtesting of deterministic utilisation threshold dates in Contract Workspace; this portfolio assessment does not consume those results, and deterministic backtesting does not calibrate probabilistic forecasts.",
      metrics: [],
    },
    assumptionDisclosure: {
      contractualFacts: "Only verified source-clause evidence is used as a contractual fact.",
      statisticalAssumptions: "No prior, likelihood, distribution, or dependence assumption was selected.",
      hypotheticalInputs: "None supplied or generated.",
      modelGeneratedEstimates: "None produced.",
    },
    nextActions: [
      ...new Set([
        ...(external.length && relevantHistory.length === 0 ? [
          "Provide an authorized historical series for each exact contract-matched indicator and assess its applicability, coverage, and recency.",
        ] : []),
        ...relevantHistory.flatMap((item) => item.status === "inconsistent_units" ? [
          `Resolve unit inconsistencies in ${item.indicatorId} before comparing historical observations.`,
        ] : item.status === "unverified_source" ? [
          `Obtain verified published-source records for ${item.indicatorId}; unverified records are excluded.`,
        ] : item.status === "stale_observations" ? [
          `Obtain a current observation for ${item.indicatorId}; the latest stored value is stale.`,
        ] : item.status === "insufficient_history" ? [
          `Collect additional distinct dated observations for ${item.indicatorId} before considering historical evaluation.`,
        ] : item.gapsExceedingExpectedCadence?.length ? [
          `Investigate ${item.gapsExceedingExpectedCadence.length} observed cadence gap(s) in ${item.indicatorId} before using it for historical evaluation.`,
        ] : item.truncated ? [
          `Retrieve older ${item.indicatorId} records before selecting a historical evaluation window.`,
        ] : []),
        ...(operational.length ? [
          "Validate the utilization history and deterministic forecast against additional observed periods before selecting a probabilistic model.",
        ] : []),
        ...(unresolvedSensitivity.length ? [
          "Confirm the cited contractual formula and obtain its missing financial, treasury, payment, or operational inputs.",
        ] : []),
        "Where an exposure occurs, preserve an eligible Phase 55 forecast snapshot and record later verified, period-matched outcomes through the Phase 62 Contract Workspace workflow; probabilistic calibration requires a separate validated model and eligible data.",
        ...(multiVariable ? [
          "Establish evidence for dependencies between variables before combining them in any simulation.",
        ] : []),
        "Retain the existing deterministic assessment; do not interpret this readiness result as a probability or forecast.",
      ]),
    ],
  };
}

function summarizeProbabilisticReadiness(contracts) {
  const gapCounts = new Map();
  for (const contract of contracts) {
    for (const dimension of contract.probabilisticReadiness.evidenceDimensions) {
      if (["insufficient_evidence", "limited_evidence", "stale_evidence", "not_assessed"].includes(dimension.status)) {
        const key = `${dimension.name}:${dimension.status}`;
        gapCounts.set(key, (gapCounts.get(key) || 0) + 1);
      }
    }
  }
  return {
    status: "no_probabilistic_forecasts",
    assessedContractCount: contracts.length,
    forecastCount: 0,
    deterministicOnlyContractCount: contracts.length,
    evidenceGaps: [...gapCounts.entries()]
      .map(([key, contractCount]) => {
        const [dimension, status] = key.split(":");
        return { dimension, status, contractCount };
      })
      .sort((left, right) => left.dimension.localeCompare(right.dimension) || left.status.localeCompare(right.status)),
    currencyAggregation: "No probabilistic amounts are produced or aggregated; existing deterministic amounts remain separated by currency.",
  };
}

function makeContractGroups(components, contracts = [], asOf, organizationId, assessmentTimestamp, externalCoverage = []) {
  const knownContracts = new Map(contracts.map((item) => [item.id, item]));
  const groups = new Map();
  for (const component of components) {
    const key = `${component.contractId}:${component.analysisRunId}:${component.documentVersionId}`;
    if (!groups.has(key)) {
      const contract = knownContracts.get(component.contractId);
      groups.set(key, {
        contractId: component.contractId,
        contractTitle: component.contractTitle || contract?.title || "Contract",
        analysisRunId: component.analysisRunId,
        documentVersionId: component.documentVersionId,
        components: [],
      });
    }
    groups.get(key).components.push(component);
  }
  return [...groups.values()].map((contract) => {
    contract.components.sort((left, right) => left.factor.localeCompare(right.factor) || left.clauseId.localeCompare(right.clauseId));
    for (const component of contract.components) {
      component.exposureAssessment = makeExposureAssessment(component, organizationId, asOf, assessmentTimestamp);
    }
    contract.exposureAssessmentCount = contract.components.filter((item) => item.exposureAssessment).length;
    contract.exposureAggregation = {
      status: "not_aggregated",
      explanation: "Operational, financial, projected, and external-reference assessments remain distinct. No cross-category amount or severity score is calculated.",
    };
    contract.factors = [...new Set(contract.components.map((component) => component.factor))];
    contract.priority = prioritize(contract.components, asOf);
    contract.interactions = interactionFor(contract.components);
    contract.recommendation = combinedRecommendation(contract, contract.components);
    contract.probabilisticReadiness = assessProbabilisticReadiness(contract, asOf, externalCoverage);
    return contract;
  });
}

function makeEarlyWarning(component, {
  status,
  trigger,
  result,
  riskIdentified,
  potentialConsequence,
  proposedAction,
  missingInformation = [],
  externalEvidence = [],
  assessmentTimestamp,
  asOf,
}) {
  const contractualEvidence = component.evidence || [];
  const obligationEvidence = component.obligationEvidence || [];
  const operationalEvidence = component.current?.evidence || [];
  const supportingEvidence = [...new Map(
    [
      ...contractualEvidence,
      ...obligationEvidence,
      ...operationalEvidence,
      ...(component.forecast?.evidence || []),
      ...externalEvidence,
    ]
      .filter((item) => item?.evidenceId && item.reviewStatus === "verified")
      .map((item) => [item.evidenceId, item]),
  ).values()];
  const basis = status === "insufficient_evidence"
    ? "Required current, period-matched, or verified obligation evidence is missing."
    : riskIdentified;

  return {
    id: `early-warning:${component.id}:${trigger.id}`,
    category: component.kind === "external_sensitivity"
      ? component.factor === "fuel" ? "fuel_price_adjustment" : "financial_reference"
      : "operational_utilisation",
    status,
    contract: {
      contractId: component.contractId,
      contractTitle: component.contractTitle,
      organizationId: component.organizationId,
      analysisRunId: component.analysisRunId,
      documentVersionId: component.documentVersionId,
    },
    obligation: {
      obligationId: component.obligationId || null,
      description: component.obligationDescription || null,
      reviewStatus: component.obligationReviewStatus || null,
      linkStatus: component.obligationId && component.obligationReviewStatus === "verified"
        ? "verified_link"
        : "not_verified",
    },
    clause: {
      clauseId: component.clauseId,
      clauseNumber: component.clauseNumber || null,
    },
    riskVariable: component.kind === "external_sensitivity"
      ? { category: component.factor, indicatorId: component.indicatorId, unit: component.observation?.unit || null }
      : { category: "utilisation", unit: component.unit, direction: component.direction },
    methodology: {
      id: component.kind === "external_sensitivity"
        ? component.factor === "fuel"
          ? component.fuelExposure?.calculation?.methodology || "verified_fuel_clause_review"
          : "stored_fx_reference_comparison"
        : result.annualizedProjection
          ? PHASE67_UTILISATION_METHODOLOGY
          : "verified_current_utilisation_threshold_review",
      description: component.kind === "external_sensitivity"
        ? component.factor === "fuel"
          ? "Reviews only explicit clause terms against a matching verified fuel-price observation; no missing formula input is inferred."
          : "Compares two distinct, recent verified reference observations against one evidenced payment; reference equivalents are not transaction values or incurred loss."
        : result.annualizedProjection
          ? "Projects verified calendar-year cumulative utilization to the evidenced calendar-year end using its observed average daily rate; this deterministic estimate is not a probability or breach determination."
          : "Compares fresh reviewer-approved current utilisation with the explicit verified clause limit; no breach, penalty, or projection is inferred.",
    },
    trigger,
    calculationInputs: {
      contractualFacts: component.factor === "fuel"
        ? component.fuelExposure?.calculation
          ? [{
            type: "fuel_adjustment_baseline",
            amount: component.fuelExposure.calculation.baselinePrice.amount,
            unit: component.fuelExposure.calculation.baselinePrice.unit,
            evidenceIds: contractualEvidence.map((item) => item.evidenceId),
          }, {
            type: "fuel_adjustment_volume",
            value: component.fuelExposure.calculation.volume.amount,
            unit: component.fuelExposure.calculation.volume.unit,
            measurementPeriod: component.fuelExposure.calculation.amount.period,
            evidenceIds: contractualEvidence.map((item) => item.evidenceId),
          }, {
            type: "fuel_adjustment_pass_through",
            value: component.fuelExposure.calculation.passThroughPercent,
            unit: "percent",
            evidenceIds: contractualEvidence.map((item) => item.evidenceId),
          }]
          : [{
            type: "fuel_adjustment_clause",
            evidenceIds: contractualEvidence.map((item) => item.evidenceId),
          }]
        : component.contractualPayment ? [{
          type: "contractual_payment",
          ...component.contractualPayment,
          evidenceIds: contractualEvidence.map((item) => item.evidenceId),
        }] : [{
          type: component.direction === "minimum" ? "contractual_minimum_utilisation" : "contractual_maximum_utilisation",
          value: component.direction === "minimum" ? component.contractualMinimum : component.contractualLimit,
          unit: component.unit,
          measurementPeriod: component.contractualMeasurementPeriod,
          evidenceIds: contractualEvidence.map((item) => item.evidenceId),
        }],
      verifiedObservations: result.observations || result.annualizedProjection?.observations || [],
      userAssumptions: result.annualizedProjection?.assumptions?.map((assumption) => ({
        type: "deterministic_utilisation_projection",
        assumption,
        methodologyVersion: result.annualizedProjection.methodologyVersion,
      })) || [],
      missingInformation: [...new Set(missingInformation)],
    },
    result,
    severity: {
      level: "not_scored",
      reason: "No validated cross-category severity score is defined.",
    },
    priority: { level: status, basis },
    recommendation: {
      riskIdentified,
      supportingClause: { clauseId: component.clauseId, clauseNumber: component.clauseNumber || null },
      supportingEvidence,
      potentialConsequence,
      proposedAction,
      priority: status,
      missingInformation: [...new Set(missingInformation)],
      advisoryOnly: true,
    },
    evidence: {
      contractual: contractualEvidence,
      obligation: obligationEvidence,
      operational: operationalEvidence,
      forecast: component.forecast?.evidence || [],
      external: externalEvidence,
    },
    assessmentTimestamp,
    assessmentAsOf: asOf,
    exposureAssessment: component.exposureAssessment || null,
    limitations: [
      "Derived only when explicitly reassessed from evidence already stored; no background monitoring or source ingestion is performed.",
      "This advisory signal is not legal advice and does not determine breach, liability, settlement value, or penalty.",
    ],
  };
}

function deriveFxEarlyWarning(component, context) {
  if (
    component.kind !== "external_sensitivity"
    || component.factor !== "fx"
    || component.status !== "verified_contractual_relationship"
  ) return null;

  const observation = component.observation;
  const movement = observation?.movement;
  const payment = component.contractualPayment;
  const missingInformation = [];
  if (!component.obligationId || component.obligationReviewStatus !== "verified") {
    missingInformation.push("A verified extracted obligation linked to the cited payment clause and version.");
  }
  if (!Number.isFinite(payment?.amount) || payment.amount <= 0) {
    missingInformation.push("A verified positive contractual payment amount.");
  }
  if (!validDate(payment?.dueDate)) {
    missingInformation.push("A verified contractual payment date.");
  }
  if (
    observation?.freshnessStatus !== "current"
    || observation.dataQualityStatus !== "verified"
    || observation.sourceId !== "ecb"
    || observation.recordType !== "published_observation"
    || observation.indicatorId !== `fx.eur.${String(payment?.currency || "").toLowerCase()}`
    || observation.currency !== payment?.currency
    || observation.baseCurrency !== "EUR"
    || observation.quoteCurrency !== payment?.currency
    || observation.unit !== `${payment?.currency} per EUR`
    || observation.sourceReference !== `https://data-api.ecb.europa.eu/service/data/EXR/D.${payment?.currency}.EUR.SP00.A`
  ) {
    missingInformation.push("A current verified ECB observation matching the payment currency.");
  }
  if (
    movement?.status !== "comparable"
    || movement.sourceId !== "ecb"
    || movement.unit !== observation?.unit
    || !validDate(movement.fromObservationDate)
    || !validDate(movement.toObservationDate)
    || movement.fromObservationDate >= movement.toObservationDate
    || movement.toObservationDate !== observation?.observationDate
    || movement.toValue !== observation?.value
    || !Number.isInteger(movement.intervalDays)
    || movement.intervalDays < 1
    || movement.intervalDays > 5
    || !Number.isFinite(movement.fromValue)
    || movement.fromValue <= 0
    || !Number.isFinite(movement.toValue)
    || movement.toValue <= 0
  ) {
    missingInformation.push("Two distinct, recent verified observations with a comparable reporting interval.");
  }

  const paymentDateDays = daysUntil(payment?.dueDate, context.asOf);
  const previousEquivalent = movement && Number.isFinite(payment?.amount)
    ? payment.amount / movement.fromValue
    : null;
  const currentEquivalent = movement && Number.isFinite(payment?.amount)
    ? payment.amount / movement.toValue
    : null;
  const change = previousEquivalent !== null && currentEquivalent !== null
    ? currentEquivalent - previousEquivalent
    : null;
  const validChange = Number.isFinite(change);
  const externalEvidence = [
    movement?.fromObservationId && {
      evidenceId: movement.fromObservationId,
      evidenceType: "published_external_observation",
      sourceLocator: movement.sourceReference || observation?.sourceReference,
      excerpt: `${movement.fromValue} ${movement.unit} observed ${movement.fromObservationDate}`,
      reviewStatus: "verified",
    },
    observation?.id && {
      evidenceId: observation.id,
      evidenceType: "published_external_observation",
      sourceLocator: observation.sourceReference,
      excerpt: `${movement?.toValue} ${movement?.unit} observed ${movement?.toObservationDate}`,
      reviewStatus: "verified",
    },
  ].filter(Boolean);
  if (movement?.status === "comparable" && (!validChange || !Number.isFinite(payment?.amount))) {
    missingInformation.push("A finite reference-equivalent comparison for the cited payment.");
  }
  if (missingInformation.length) {
    return makeEarlyWarning(component, {
      status: "insufficient_evidence",
      trigger: {
        id: `${movement?.fromObservationDate || "no-prior"}:${movement?.toObservationDate || observation?.observationDate || "no-current"}`,
        kind: "fx_reference_movement",
        fromObservationDate: movement?.fromObservationDate || null,
        toObservationDate: movement?.toObservationDate || observation?.observationDate || null,
      },
      result: {
        status: "not_calculated",
        referenceEquivalentChange: null,
        observations: [],
      },
      riskIdentified: "A current foreign-currency payment relationship is identified, but available evidence does not establish a comparable change assessment.",
      potentialConsequence: "No change or customer-specific financial impact can be established from the available evidence.",
      proposedAction: "Verify the linked payment obligation, current payment date, matching observation history, and treasury settlement context before acting.",
      missingInformation,
      externalEvidence,
      assessmentTimestamp: context.assessmentTimestamp,
      asOf: context.asOf,
    });
  }

  if (!validChange || change === 0) return null;

  const status = component.obligationId
    && component.obligationReviewStatus === "verified"
    && change > 0
    && paymentDateDays !== null
    && paymentDateDays >= 0
    && paymentDateDays <= 30
    ? "attention_required"
    : "monitor";

  return makeEarlyWarning(component, {
    status,
    trigger: {
      id: `${movement.fromObservationId || movement.fromObservationDate}:${movement.toObservationId || movement.toObservationDate}`,
      kind: "fx_reference_movement",
      fromObservationDate: movement.fromObservationDate,
      toObservationDate: movement.toObservationDate,
      intervalDays: movement.intervalDays,
      previousRate: movement.fromValue,
      currentRate: movement.toValue,
      unit: movement.unit,
    },
    result: {
      status: "reference_equivalent_comparison",
      notActualLoss: true,
      referenceEquivalentChange: {
        amount: Number(change.toFixed(2)),
        currency: "EUR",
        direction: change > 0 ? "increased" : "decreased",
      },
      previousReferenceEquivalent: { amount: Number(previousEquivalent.toFixed(2)), currency: "EUR" },
      currentReferenceEquivalent: { amount: Number(currentEquivalent.toFixed(2)), currency: "EUR" },
      observations: [
        { value: movement.fromValue, unit: movement.unit, observationDate: movement.fromObservationDate },
        { value: movement.toValue, unit: movement.unit, observationDate: movement.toObservationDate },
      ],
    },
    riskIdentified: "A recent verified ECB movement changed the reference EUR-equivalent of one cited foreign-currency payment.",
    potentialConsequence: "The reference EUR-equivalent may be higher or lower; this is not a transaction rate, incurred loss, or statement about the organization's reporting currency.",
    proposedAction: status === "attention_required"
      ? "Review the cited payment with treasury before its due date; confirm the actual settlement rate, reporting currency, and hedge status."
      : "Monitor the reference comparison and confirm the actual settlement rate, reporting currency, and hedge status with treasury.",
    missingInformation,
    externalEvidence,
    assessmentTimestamp: context.assessmentTimestamp,
    asOf: context.asOf,
  });
}

function deriveFuelPriceEarlyWarning(component, context) {
  if (component.kind !== "external_sensitivity" || component.factor !== "fuel" || !component.fuelExposure) return null;
  const exposure = component.fuelExposure;
  const calculation = exposure.calculation;
  const observation = component.observation;
  const isCalculated = exposure.status === "calculated"
    && Number.isFinite(calculation?.amount?.value)
    && Boolean(calculation?.amount?.currency);
  if (isCalculated && calculation.amount.value <= 0) return null;
  const missingInformation = exposure.missingInputs || [];
  const externalEvidence = observation?.id ? [{
    evidenceId: observation.id,
    evidenceType: "published_external_observation",
    sourceLocator: observation.sourceReference || null,
    excerpt: `${observation.value} ${observation.unit} observed ${observation.observationDate}`,
    reviewStatus: "verified",
  }] : [];
  const status = isCalculated
    ? component.obligationId && component.obligationReviewStatus === "verified" ? "attention_required" : "monitor"
    : "insufficient_evidence";
  const fuelAmount = isCalculated
    ? { amount: calculation.amount.value, currency: calculation.amount.currency, period: calculation.amount.period }
    : null;

  return makeEarlyWarning(component, {
    status,
    trigger: {
      id: `${observation?.id || "no-observation"}:${exposure.exposureClassification}`,
      kind: "fuel_price_adjustment",
      observationDate: observation?.observationDate || null,
      baselinePrice: calculation?.baselinePrice || null,
      currentPrice: calculation?.currentPrice || null,
    },
    result: {
      status: isCalculated ? "calculated" : "not_calculated",
      financialAdjustment: fuelAmount,
      methodology: calculation?.methodology || null,
      observations: observation ? [{
        value: observation.value,
        unit: observation.unit,
        observationDate: observation.observationDate,
        evidenceId: observation.id,
      }] : [],
    },
    riskIdentified: isCalculated
      ? exposure.explanation
      : "A fuel-related contractual provision is identified, but verified evidence does not establish a complete, comparable adjustment calculation.",
    potentialConsequence: isCalculated
      ? `${calculation.amount.currency} ${calculation.amount.value.toFixed(2)} is the clause-derived adjustment for the stated ${calculation.amount.period}; it is not an invoice amount or net recoverable exposure.`
      : "The financial adjustment remains unquantified; no missing contractual input or external price has been assumed.",
    proposedAction: exposure.recommendation?.action
      || "Verify the cited fuel-price clause, matching observation, covered quantity, and payment allocation before settlement.",
    missingInformation,
    externalEvidence,
    assessmentTimestamp: context.assessmentTimestamp,
    asOf: context.asOf,
  });
}

function deriveUtilizationEarlyWarning(component, context) {
  if (component.kind !== "operational_utilisation") return null;
  const minimum = component.direction === "minimum";
  const threshold = minimum ? component.contractualMinimum : component.contractualLimit;
  const current = component.current;
  const reportingPeriod = current?.reportingPeriod;
  const reportingPeriodAgeDays = daysUntil(context.asOf, reportingPeriod?.end);
  const evidenceFresh = validDate(reportingPeriod?.start)
    && validDate(reportingPeriod?.end)
    && reportingPeriod.start <= reportingPeriod.end
    && reportingPeriod.end <= context.asOf
    && reportingPeriodAgeDays !== null
    && reportingPeriodAgeDays >= 0
    && reportingPeriodAgeDays <= 30;
  const hasVerifiedObligation = Boolean(
    component.obligationId && component.obligationReviewStatus === "verified",
  );
  const missingInformation = [];
  if (!hasVerifiedObligation) {
    missingInformation.push("A verified extracted utilisation obligation linked to the cited clause and version.");
  }
  if (!Number.isFinite(threshold) || threshold <= 0) {
    missingInformation.push(`An explicit positive contractual ${minimum ? "minimum" : "maximum"} utilisation limit.`);
  }
  if (!current || !allEvidenceVerified(current.evidence) || !evidenceFresh) {
    missingInformation.push("Fresh reviewer-approved utilisation evidence with a valid reporting period.");
  }

  const projection = component.annualizedProjection;
  const projectionWarning = [
    "potential_exposure_developing",
    "elevated_contractual_attention",
    "monitoring_recommended",
  ].includes(projection?.classification);
  let status = "insufficient_evidence";
  let triggerStatus = current?.status || "current_utilisation_unavailable";
  if (!missingInformation.length) {
    if (minimum && current.status === "below_minimum") status = "minimum_utilisation_review";
    else if (minimum && current.status === "minimum_period_incomplete") {
      missingInformation.push("A complete contractual minimum-utilisation period.");
      triggerStatus = "minimum_period_incomplete";
    } else if (!minimum && ["approaching", "at_limit", "exceeded"].includes(current.status)) {
      status = current.status === "approaching" ? "approaching_limit_review" : "limit_review_required";
    } else if (projectionWarning) {
      status = projection.classification;
      triggerStatus = projection.classification;
    } else {
      return null;
    }
  }
  const evidenceIds = current?.evidence?.map((item) => item.evidenceId).filter(Boolean) || [];
  const referenceDate = reportingPeriod?.end || context.asOf;
  const resultStatus = projectionWarning
    ? "deterministic_calendar_year_projection"
    : status === "insufficient_evidence" && current?.status === "minimum_period_incomplete"
      ? "period_incomplete_not_compared"
      : current ? "verified_current_period_comparison" : "not_calculated";
  const recorded = Number.isFinite(current?.recordedUtilisation) ? current.recordedUtilisation : null;
  const headroom = !minimum && Number.isFinite(current?.headroom) ? current.headroom : null;
  const remainingRequirement = minimum && Number.isFinite(current?.remainingRequirement)
    ? current.remainingRequirement
    : null;
  const triggerId = `${referenceDate}:${evidenceIds.join(",") || "no-current-evidence"}:${triggerStatus}:${projectionWarning ? projection.methodologyVersion : "current-only"}`;

  return makeEarlyWarning(component, {
    status,
    trigger: {
      id: triggerId,
      kind: projectionWarning
        ? "calendar_year_utilisation_projection"
        : minimum ? "minimum_utilisation_status" : "maximum_utilisation_status",
      status: triggerStatus,
      reportingPeriod: reportingPeriod || null,
    },
    result: {
      status: resultStatus,
      direction: component.direction,
      contractualLimit: Number.isFinite(threshold) ? threshold : null,
      recordedUtilisation: recorded,
      unit: component.unit,
      headroom,
      remainingRequirement,
      consumedPercent: !minimum && Number.isFinite(current?.consumedPercent) ? current.consumedPercent : null,
      reportingPeriod: reportingPeriod || null,
      annualizedProjection: projectionWarning ? projection : null,
      projected: projectionWarning ? projection.projectedUtilisationAtPeriodEnd : null,
      financialAmount: null,
    },
    riskIdentified: projectionWarning
      ? projection.classification === "monitoring_recommended"
        ? `The deterministic calendar-year projection is at least 80% of the cited ${minimum ? "minimum" : "maximum"} allowance.`
        : `The deterministic calendar-year projection indicates a potential ${minimum ? "minimum-utilisation shortfall" : "utilisation overrun"} of ${minimum ? projection.projectedShortfallUnits : projection.projectedExcessUnits} ${component.unit}.`
      : status === "insufficient_evidence"
      ? "The utilisation clause is identified, but current evidence is insufficient for a reliable threshold comparison."
      : minimum
        ? "Verified complete-period utilisation is below the explicit contractual minimum."
        : current.status === "approaching"
          ? "Verified current utilisation has reached Phase 54's existing approaching-limit review convention."
          : `Verified current utilisation is ${current.status.replaceAll("_", " ")} against the explicit contractual maximum.`,
    potentialConsequence: projectionWarning
      ? `If the observed calendar-year rate continues, projected utilisation at ${projection.horizon.end} is ${projection.projectedUtilisationAtPeriodEnd} ${component.unit}. This is a review signal only; it is not a breach, penalty, or financial amount.`
      : minimum
      ? "The contractual utilisation requirement warrants review; no shortfall charge or legal conclusion is inferred."
      : "The recorded limit status may warrant operational or lessor review; no breach, penalty, maintenance adjustment, or redelivery effect is inferred.",
    proposedAction: projectionWarning
      ? minimum
        ? "Review the aircraft operating plan against the projected calendar-year minimum, confirm the verified period data, and assess any express notice or shortfall terms with the lease owner."
        : "Review the aircraft utilisation plan against the projected calendar-year allowance, refresh period-matched evidence, and discuss options with the lessor early if the contract supports it."
      : status === "insufficient_evidence"
      ? "Obtain or confirm a current reviewer-approved utilisation report for the exact contractual period, and verify the obligation linkage."
      : minimum
        ? "Review the complete-period utilisation record against the minimum and clarify any contractual notice or consequence provisions before taking action."
        : "Increase utilisation monitoring against the cited allowance and review applicable excess-use terms with the lease owner; discuss options with the lessor if supported by the contract and evidence.",
    missingInformation,
    assessmentTimestamp: context.assessmentTimestamp,
    asOf: context.asOf,
  });
}

function deriveEarlyWarnings(components, context) {
  const warnings = [];
  for (const component of components) {
    const warning = component.kind === "external_sensitivity"
      ? component.factor === "fuel"
        ? deriveFuelPriceEarlyWarning(component, context)
        : deriveFxEarlyWarning(component, context)
      : deriveUtilizationEarlyWarning(component, context);
    if (warning) warnings.push(warning);
  }
  const unique = new Map(warnings.map((warning) => [warning.id, warning]));
  const statusOrder = new Map([
    ["limit_review_required", 0],
    ["elevated_contractual_attention", 1],
    ["potential_exposure_developing", 2],
    ["monitoring_recommended", 3],
    ["minimum_utilisation_review", 1],
    ["approaching_limit_review", 4],
    ["attention_required", 5],
    ["insufficient_evidence", 6],
    ["monitor", 7],
  ]);
  return [...unique.values()].sort((left, right) => (
    (statusOrder.get(left.status) ?? 99) - (statusOrder.get(right.status) ?? 99)
    || left.contract.contractTitle.localeCompare(right.contract.contractTitle)
    || left.clause.clauseId.localeCompare(right.clause.clauseId)
  ));
}

function summarizePortfolio(contracts, components, portfolio) {
  const byIndicator = new Map();
  const byCurrency = new Map();
  for (const component of components) {
    const payment = component.contractualPayment;
    if (payment?.currency && Number.isFinite(payment.amount) && payment.amount > 0) {
      if (!byCurrency.has(payment.currency)) byCurrency.set(payment.currency, []);
      byCurrency.get(payment.currency).push({
        contractId: component.contractId,
        clauseId: component.clauseId,
        amount: payment.amount,
        dueDate: payment.dueDate || null,
        evidence: component.evidence,
      });
    }
    if (!component.observation?.indicatorId || component.status !== "verified_contractual_relationship") continue;
    const indicatorId = component.observation.indicatorId;
    if (!byIndicator.has(indicatorId)) byIndicator.set(indicatorId, []);
    byIndicator.get(indicatorId).push(component);
  }
  const indicatorGroups = [...byIndicator.entries()]
    .map(([indicatorId, items]) => ({
      indicatorId,
      contractIds: [...new Set(items.map((item) => item.contractId))],
      componentIds: items.map((item) => item.id),
      verifiedClauseCount: items.length,
    }))
    .filter((item) => item.contractIds.length > 1 && components
      .filter((component) => item.componentIds.includes(component.id))
      .every((component) => component.observation?.freshnessStatus === "current"));
  const confirmedAircraftGroups = (portfolio?.aircraft || [])
    .filter((aircraft) => aircraft.status === "confirmed" && Array.isArray(aircraft.confirmedContractIds))
    .map((aircraft) => {
      const contractIds = aircraft.confirmedContractIds.filter((id) => contracts.some((item) => item.contractId === id));
      const componentIds = components
        .filter((component) => contractIds.includes(component.contractId))
        .map((component) => component.id);
      return {
        aircraftId: aircraft.aircraftId,
        registration: aircraft.registration || null,
        serialNumber: aircraft.serialNumber || null,
        contractIds,
        componentIds,
        relationshipEvidence: (aircraft.contracts || [])
          .filter((link) => link.relationshipStatus === "confirmed" && link.evidence?.reviewStatus === "verified")
          .map((link) => ({
            contractId: link.contractId,
            evidenceId: link.evidence.evidenceId,
            sourceLocator: link.evidence.sourceLocator || null,
            pageNumber: link.evidence.pageNumber || null,
          })),
      };
    })
    .filter((item) => item.contractIds.length && item.componentIds.length);
  return {
    indicatorGroups,
    currencyObligationGroups: [...byCurrency.entries()].map(([currency, obligations]) => ({
      currency,
      obligations,
      contractIds: [...new Set(obligations.map((item) => item.contractId))],
      aggregation: "individual obligations are listed; amounts are not summed or converted",
    })),
    confirmedAircraftGroups,
    deadlineClusters: portfolio?.deadlineClusters || [],
    currentByCurrency: portfolio?.financialExposure?.currentByCurrency || [],
    projectedByCurrency: portfolio?.financialExposure?.projectedByCurrency || [],
    currencyAggregation: "Reuses Phase 57's supported same-currency amounts; no cross-currency or external-variable amounts are combined.",
    counterpartyConcentration: "not_supported_without_verified_counterparty_identity",
  };
}

export function deriveAviationPredictiveContractRisk({
  organizationId,
  externalRisk = {},
  portfolio = null,
  leaseAssessment = null,
  contractId = null,
  analysisRunId = null,
  documentVersionId = null,
  asOf = externalRisk.asOf || portfolio?.asOf || new Date().toISOString().slice(0, 10),
} = {}) {
  assertOrganizationScope(organizationId);
  if (!validDate(asOf)) throw new TypeError("asOf must be a valid ISO date");
  if (!Array.isArray(externalRisk.contractualAssessments || [])) {
    throw new TypeError("External risk contractual assessments must be an array");
  }
  for (const source of [externalRisk, portfolio, leaseAssessment]) {
    if (source?.organizationId && source.organizationId !== organizationId) {
      throw new Error("Predictive risk input belongs to a different organization");
    }
  }
  const context = { organizationId, contractId, analysisRunId, documentVersionId, asOf };
  const operationalComponents = utilizationComponents(portfolio, leaseAssessment, context);
  const currentContracts = new Map((portfolio?.contracts || []).map((item) => [item.id, item]));
  const scopedExternalComponents = externalComponents(externalRisk, context).filter((component) => {
    const current = currentContracts.get(component.contractId);
    return !portfolio || Boolean(
      current
      && current.analysisRunId === component.analysisRunId
      && current.documentVersionId === component.documentVersionId,
    );
  });
  const portfolioFinancial = mergePortfolioFinancialFindings(
    operationalComponents,
    portfolioFinancialComponents(portfolio, context),
  );
  const components = [
    ...scopedExternalComponents,
    ...operationalComponents,
    ...portfolioFinancial,
  ];
  const uniqueComponents = deduplicateComponents(components);
  const assessmentTimestamp = new Date().toISOString();
  const contracts = makeContractGroups(
    uniqueComponents,
    portfolio?.contracts || [],
    asOf,
    organizationId,
    assessmentTimestamp,
    externalRisk.historicalObservationCoverage || [],
  );
  const earlyWarnings = deriveEarlyWarnings(uniqueComponents, {
    organizationId,
    asOf,
    assessmentTimestamp,
  });
  const multiVariableContracts = contracts.filter((item) => item.factors.length > 1);
  const portfolioSummary = summarizePortfolio(contracts, uniqueComponents, portfolio);

  return {
    asOf,
    assessedAt: assessmentTimestamp,
    organizationScope: "request_organization",
    status: contracts.length ? "available" : "no_supported_contractual_exposure",
    coverage: {
      contractId,
      analysisRunId,
      portfolioInventoryComplete: portfolio?.coverage?.portfolioInventoryComplete ?? false,
      externalProvisionsTruncated: Boolean(externalRisk.coverage?.provisionsTruncated),
      portfolioRunsTruncated: Boolean(portfolio?.coverage?.runsTruncated),
      portfolioRelationshipsTruncated: Boolean(portfolio?.coverage?.relationshipsTruncated),
      componentCount: uniqueComponents.length,
      contractCount: contracts.length,
      multiComponentContractCount: multiVariableContracts.length,
      currentVersionEvidenceRequired: true,
    },
    contracts: contracts.map((contract) => ({
      ...contract,
      interactions: contract.interactions,
      recommendation: contract.recommendation,
    })),
    earlyWarnings,
    portfolio: portfolioSummary,
    probabilisticReadiness: summarizeProbabilisticReadiness(contracts),
    prioritizationPolicy: {
      method: "transparent_rule_ordering_no_numeric_or_probability_score",
      precedence: [
        "current demonstrated financial exposure or verified utilization above limit",
        "supported projected financial exposure or an existing threshold forecast",
        "verified payment or forecast threshold date within 30 days",
        "review-required contractual evidence",
        "monitoring of supported contractual components",
      ],
      factorCountDoesNotIncreaseSeverity: true,
    },
    sensitivity: {
      status: "not_calculated",
      hypotheticalOutputs: [],
      reason: "No user-specified scenario deltas or complete external contractual calculation methods are available. Phase 56 current and projected utilization estimates remain separate; no hypothetical or multi-variable amount is inferred.",
      unavailableInputs: [
        "fuel adjustment formula, quantity, and matching region/index",
        "organization reporting currency, hedge position, and supported conversion methodology",
        "interest principal, reset date, day-count convention, and accrual period",
        "explicit scenario changes and a contractual method for combining affected obligations",
      ],
    },
    limitations: [
      "Multiple factors in one contract are co-located evidence, not proof of interaction or independent impact.",
      "Components citing the same clause are marked potentially linked, but are not combined without an explicit contractual calculation methodology.",
      "Current, projected, and external observations are preserved as separate data types; no external-variable loss or currency conversion is calculated.",
      "Only verified clause and operational evidence from the selected analysis run and document version is included.",
      "Counterparty identity is not inferred, and aircraft grouping uses only Phase 57 confirmed relationships.",
    ],
  };
}
