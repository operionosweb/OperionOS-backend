import { assertOrganizationScope } from "../../../repositories/phase3/scope.js";
import { createAviationContractPortfolioRepository } from "../../../repositories/phase3/aviationContractPortfolioRepository.js";

const AVIATION_CONTRACT_TYPES = new Set([
  "AIRCRAFT_LEASE",
  "AIRCRAFT_PURCHASE",
  "MRO",
  "ENGINE_MAINTENANCE",
  "POWER_BY_HOUR",
  "COMPONENT_SUPPORT",
  "INSURANCE",
  "GROUND_HANDLING",
  "AIRPORT_SERVICES",
  "SUPPLIER",
  "FINANCING",
]);
const PORTFOLIO_RUN_LIMIT = 200;
const RELATIONSHIP_LIMIT = 2000;

function parseClassification(value) {
  if (typeof value !== "string") return value && typeof value === "object" ? value : null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sortByTitle(left, right) {
  return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}

function normalizedEvidence(item, evidenceType) {
  if (!item?.evidenceId || item.reviewStatus !== "verified") return null;
  return {
    evidenceId: item.evidenceId,
    evidenceType,
    sourceLocator: item.sourceLocator || null,
    pageNumber: item.pageNumber || null,
    excerpt: item.excerpt || null,
    reviewStatus: item.reviewStatus,
  };
}

function evidenceMentionsAsset(finding, asset) {
  const identifiers = [asset.registration, asset.serialNumber].filter((value) => (
    typeof value === "string" && value.trim().length >= 3
  ));
  if (!identifiers.length) return false;
  const excerpts = finding.evidence
    .filter((item) => item.evidenceType === "contractual_provision")
    .map((item) => item.excerpt || "");
  return identifiers.some((identifier) => {
    const escaped = identifier.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return excerpts.some((excerpt) => new RegExp(`(^|[^A-Z0-9])${escaped}($|[^A-Z0-9])`, "i").test(excerpt));
  });
}

function aggregateAmounts(items) {
  const amounts = new Map();
  for (const item of items) {
    if (!item.currency || !Number.isFinite(item.amount) || item.amount <= 0) continue;
    amounts.set(item.currency, (amounts.get(item.currency) || 0) + item.amount);
  }
  return [...amounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => ({ currency, amount: Number(amount.toFixed(2)) }));
}

function deriveFinancialFindings(contracts, assessmentsByRun) {
  const findings = [];
  const seen = new Set();
  let omittedUncited = 0;
  for (const contract of contracts) {
    const assessment = assessmentsByRun.get(contract.analysisRunId);
    for (const risk of assessment?.risks || []) {
      for (const metric of risk.utilisation_exposure?.metrics || []) {
        const financial = metric.financialExposure;
        const provision = financial?.contractualProvision;
        if (!provision?.clauseId || provision.contractVersionId !== contract.documentVersionId) continue;
        const contractEvidence = (provision.evidence || [])
          .map((item) => normalizedEvidence(item, "contractual_provision"))
          .filter(Boolean);
        const addFinding = (kind, item, expectedStatus) => {
          if (item?.status !== expectedStatus || !Number.isFinite(item.amount) || item.amount <= 0) return;
          const operationalEvidence = (item.sources || [])
            .map((source) => normalizedEvidence(source, kind === "current" ? "recorded_utilisation" : "forecast_utilisation"))
            .filter(Boolean);
          if (!contractEvidence.length || !operationalEvidence.length) {
            omittedUncited += 1;
            return;
          }
          const key = [
            contract.id,
            contract.documentVersionId,
            provision.clauseId,
            provision.unit,
            provision.measurementPeriod,
            kind,
          ].join(":");
          if (seen.has(key)) return;
          seen.add(key);
          findings.push({
            id: `aviation-portfolio-financial-${key}`,
            kind,
            status: expectedStatus,
            contractId: contract.id,
            contractTitle: contract.title,
            analysisRunId: contract.analysisRunId,
            documentVersionId: contract.documentVersionId,
            clauseId: provision.clauseId,
            clauseNumber: provision.clauseNumber || null,
            unit: provision.unit,
            measurementPeriod: provision.measurementPeriod,
            amount: Number(item.amount.toFixed(2)),
            currency: item.currency || financial.currency || null,
            reportingPeriod: item.reportingPeriod || null,
            measurementDate: item.measurementDate || null,
            evidence: [...contractEvidence, ...operationalEvidence],
          });
        };
        addFinding("current", financial?.current, "currently_demonstrated_exposure");
        addFinding("projected", financial?.projected, "potential_future_exposure");
      }
    }
  }
  return { findings, omittedUncited };
}

function deriveUtilisationExposures(contracts, assessmentsByRun) {
  const findings = [];
  const seen = new Set();
  for (const contract of contracts) {
    const assessment = assessmentsByRun.get(contract.analysisRunId);
    for (const risk of assessment?.risks || []) {
      if (risk.contract_id && risk.contract_id !== contract.id) continue;
      if (!risk.clause_id || !Array.isArray(risk.contract_evidence)) continue;
      const contractEvidence = risk.contract_evidence
        .map((item) => normalizedEvidence(item, "contractual_provision"))
        .filter(Boolean);
      if (!contractEvidence.length) continue;
      for (const metric of risk.utilisation_exposure?.metrics || []) {
        if (!["flight_hours", "flight_cycles"].includes(metric.unit)) continue;
        const key = `${contract.id}:${contract.documentVersionId}:${risk.clause_id}:${metric.unit}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const currentEvidence = (metric.sources || [])
          .map((item) => normalizedEvidence(item, "recorded_utilisation"))
          .filter(Boolean);
        const forecastEvidence = (metric.forecast?.sources || [])
          .map((item) => normalizedEvidence(item, "forecast_utilisation"))
          .filter(Boolean);
        const financial = metric.financialExposure;
        const provision = financial?.contractualProvision;
        const financialMatchesCurrentVersion = provision?.clauseId === risk.clause_id
          && provision.unit === metric.unit
          && provision.contractVersionId === contract.documentVersionId
          && Array.isArray(provision.evidence)
          && provision.evidence.length > 0
          && provision.evidence.every((item) => item.reviewStatus === "verified" && item.evidenceId);
        findings.push({
          contractId: contract.id,
          contractTitle: contract.title,
          analysisRunId: contract.analysisRunId,
          documentVersionId: contract.documentVersionId,
          clauseId: risk.clause_id,
          obligationId: risk.obligation_id || null,
          obligationDescription: risk.obligation_description || null,
          obligationReviewStatus: risk.obligation_review_status || null,
          clauseNumber: provision?.clauseNumber
            || risk.contract_evidence.find((item) => item.reviewStatus === "verified")?.clauseNumber
            || null,
          unit: metric.unit,
          contractualLimit: Number.isFinite(metric.contractualLimit) ? metric.contractualLimit : null,
          status: metric.status || "operational_evidence_unavailable",
          recordedUtilisation: currentEvidence.length && Number.isFinite(metric.recordedUtilisation)
            ? metric.recordedUtilisation
            : null,
          headroom: currentEvidence.length && Number.isFinite(metric.headroom) ? metric.headroom : null,
          consumedPercent: currentEvidence.length && Number.isFinite(metric.consumedPercent) ? metric.consumedPercent : null,
          reportingPeriod: currentEvidence.length ? metric.reportingPeriod || null : null,
          sources: currentEvidence,
          forecast: forecastEvidence.length ? {
            ...metric.forecast,
            sources: forecastEvidence,
          } : null,
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
          contractEvidence,
          financialExposure: financialMatchesCurrentVersion ? financial : null,
        });
      }
    }
  }
  return findings;
}

function normalizeRelationship(row, organizationId, contractsById) {
  const contract = contractsById.get(row?.contract_id);
  if (row?.organization_id !== organizationId || !contract || !row.aircraft_id) return null;
  if (row.evidence_review_status === "rejected") return null;
  const evidenceVersionMatches = row.evidence_document_version_id === contract.documentVersionId;
  const relationshipStatus = evidenceVersionMatches && row.evidence_review_status === "verified" && row.source_evidence_id
    ? "confirmed"
    : evidenceVersionMatches && row.source_evidence_id
      ? "potential"
      : "unresolved";
  return {
    id: row.id || null,
    aircraftId: row.aircraft_id,
    contractId: row.contract_id,
    contractTitle: row.contract_title || "Contract",
    relationshipType: row.relationship_type || null,
    relationshipStatus,
    evidence: row.source_evidence_id ? {
      evidenceId: row.source_evidence_id,
      sourceIdentifier: row.source_identifier || null,
      sourceReference: row.source_reference || null,
      documentVersionId: row.evidence_document_version_id || null,
      currentContractVersion: evidenceVersionMatches,
      pageNumber: row.page_number || null,
      sourceLocator: row.source_locator || null,
      excerpt: row.excerpt || null,
      reviewStatus: row.evidence_review_status || "pending",
    } : null,
    asset: {
      registration: row.registration || null,
      serialNumber: row.serial_number || null,
      aircraftType: row.aircraft_type || null,
    },
  };
}

function deriveAircraftAssets(relationships, contractsById, findings) {
  const grouped = new Map();
  const uniqueRelationships = new Map();
  const statusRank = { unresolved: 0, potential: 1, confirmed: 2 };
  for (const relationship of relationships) {
    const key = `${relationship.aircraftId}:${relationship.contractId}:${relationship.relationshipType || "unspecified"}`;
    const existing = uniqueRelationships.get(key);
    if (!existing || statusRank[relationship.relationshipStatus] > statusRank[existing.relationshipStatus]) {
      uniqueRelationships.set(key, relationship);
    }
  }
  for (const relationship of uniqueRelationships.values()) {
    if (!grouped.has(relationship.aircraftId)) {
      grouped.set(relationship.aircraftId, { aircraftId: relationship.aircraftId, links: [] });
    }
    grouped.get(relationship.aircraftId).links.push(relationship);
  }
  const assets = [];
  for (const group of grouped.values()) {
    const confirmedLinks = group.links.filter((item) => item.relationshipStatus === "confirmed");
    const potentialLinks = group.links.filter((item) => item.relationshipStatus === "potential");
    const confirmedContractIds = unique(confirmedLinks.map((item) => item.contractId));
    const potentialContractIds = unique(potentialLinks.map((item) => item.contractId));
    const representative = group.links.find((item) => item.asset.registration || item.asset.serialNumber)
      || confirmedLinks[0] || potentialLinks[0] || group.links[0];
    const links = group.links.map((item) => ({
      contractId: item.contractId,
      contractTitle: contractsById.get(item.contractId)?.title || item.contractTitle,
      contractType: contractsById.get(item.contractId)?.type || null,
      analysisRunId: contractsById.get(item.contractId)?.analysisRunId || null,
      documentVersionId: contractsById.get(item.contractId)?.documentVersionId || null,
      relationshipType: item.relationshipType,
      relationshipStatus: item.relationshipStatus,
      evidence: item.evidence,
    }));
    const associatedFindings = findings.filter((item) => (
      confirmedContractIds.includes(item.contractId) && evidenceMentionsAsset(item, representative.asset)
    ));
    assets.push({
      aircraftId: group.aircraftId,
      registration: representative.asset.registration,
      serialNumber: representative.asset.serialNumber,
      aircraftType: representative.asset.aircraftType,
      status: confirmedContractIds.length ? "confirmed" : potentialContractIds.length ? "potential" : "unresolved",
      confirmedContractIds,
      potentialContractIds,
      contracts: links,
      financialFindings: associatedFindings,
      currentExposureByCurrency: aggregateAmounts(associatedFindings.filter((item) => item.kind === "current")),
      projectedExposureByCurrency: aggregateAmounts(associatedFindings.filter((item) => item.kind === "projected")),
    });
  }
  return assets.sort((left, right) => (
    String(left.registration || left.serialNumber || left.aircraftType || left.aircraftId)
      .localeCompare(String(right.registration || right.serialNumber || right.aircraftType || right.aircraftId))
  ));
}

function deriveDeadlineClusters(contracts, assessmentsByRun, asOf) {
  const byDate = new Map();
  for (const contract of contracts) {
    const assessment = assessmentsByRun.get(contract.analysisRunId);
    for (const risk of assessment?.risks || []) {
      const deadline = risk.deadline_information;
      if (!deadline || deadline.reviewRequired !== false || !validDate(deadline.absoluteDate)
        || deadline.absoluteDate < asOf) continue;
      const evidence = (risk.contract_evidence || [])
        .map((item) => normalizedEvidence(item, "contractual_deadline"))
        .filter(Boolean);
      if (!evidence.length) continue;
      if (!byDate.has(deadline.absoluteDate)) byDate.set(deadline.absoluteDate, []);
      byDate.get(deadline.absoluteDate).push({
        contractId: contract.id,
        contractTitle: contract.title,
        analysisRunId: contract.analysisRunId,
        documentVersionId: contract.documentVersionId,
        clauseId: risk.clause_id || null,
        obligationId: risk.obligation_id || null,
        deadlineId: deadline.id,
        status: deadline.status,
        daysRemaining: deadline.daysRemaining,
        evidence,
      });
    }
  }
  return [...byDate.entries()]
    .map(([date, items]) => ({ date, items, contractIds: unique(items.map((item) => item.contractId)) }))
    .filter((cluster) => cluster.contractIds.length > 1)
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((cluster) => ({
      date: cluster.date,
      type: "temporal_coincidence",
      contractIds: cluster.contractIds,
      contracts: cluster.contractIds.map((id) => {
        const contract = contracts.find((item) => item.id === id);
        return {
          id,
          title: contract?.title || "Contract",
          type: contract?.type || null,
          analysisRunId: contract?.analysisRunId || null,
        };
      }),
      deadlines: cluster.items,
      explanation: "Verified contractual deadlines share this date. This is a timing cluster only; no dependency between the obligations is inferred.",
    }));
}

function derivePortfolioFindings(assets, deadlineClusters, findings) {
  const recommendations = [];
  const concentrations = [];
  for (const asset of assets) {
    if (asset.status !== "confirmed" || asset.confirmedContractIds.length < 2) continue;
    const exposedContractIds = unique(asset.financialFindings.map((item) => item.contractId));
    const currentCount = asset.financialFindings.filter((item) => item.kind === "current").length;
    const projectedCount = asset.financialFindings.filter((item) => item.kind === "projected").length;
    const name = asset.registration || asset.serialNumber || asset.aircraftType || asset.aircraftId;
    concentrations.push({
      id: `aircraft-contract-concentration:${asset.aircraftId}`,
      type: "confirmed_aircraft_contract_concentration",
      aircraftId: asset.aircraftId,
      aircraft: name,
      contractIds: asset.confirmedContractIds,
      currentExposureCount: currentCount,
      projectedExposureCount: projectedCount,
      currentExposureByCurrency: asset.currentExposureByCurrency,
      projectedExposureByCurrency: asset.projectedExposureByCurrency,
      explanation: "Multiple contracts have verified links to the same aircraft. The contract count is a relationship indicator, not a risk score or proof of loss.",
      evidence: asset.contracts.filter((item) => item.relationshipStatus === "confirmed").flatMap((item) => item.evidence ? [item.evidence] : []),
    });
    if (exposedContractIds.length > 1) {
      recommendations.push({
        id: `review-aircraft-exposure:${asset.aircraftId}`,
        type: "review_interconnected_aircraft_exposure",
        title: `Review lease exposure across contracts linked to ${name}`,
        finding: `${currentCount} current and ${projectedCount} projected utilization exposure assessment(s) are linked to ${name} across ${exposedContractIds.length} contracts.`,
        contractIds: exposedContractIds,
        aircraftId: asset.aircraftId,
        supportingFindings: asset.financialFindings.map((item) => item.id),
        supportingEvidence: asset.financialFindings.flatMap((item) => item.evidence),
        action: "Coordinate the aircraft operations, lease, and finance owners to review the cited allowances, recorded readings, projected measurement dates, and applicable contractual caps across these contracts.",
        potentialConsequence: "Uncoordinated review could delay identification of overlapping contractual commitments; no additional liability is inferred.",
        uncertainty: "Current amounts and projections are informational, clause-specific estimates and retain their original currencies.",
      });
    } else if (!asset.financialFindings.length) {
      concentrations[concentrations.length - 1].unexposedContractIds = asset.confirmedContractIds;
    }
  }
  for (const cluster of deadlineClusters) {
    recommendations.push({
      id: `coordinate-deadline-cluster:${cluster.date}:${cluster.contractIds.slice().sort().join(":")}`,
      type: "coordinate_contract_deadlines",
      title: `Coordinate verified contractual deadlines on ${cluster.date}`,
      finding: `${cluster.deadlines.length} verified deadline(s) across ${cluster.contractIds.length} contracts share the same date.`,
      contractIds: cluster.contractIds,
      supportingFindings: cluster.deadlines.map((item) => item.deadlineId),
      supportingEvidence: cluster.deadlines.flatMap((item) => item.evidence),
      action: "Ask the relevant contract owners to review and coordinate the actions due on this date.",
      potentialConsequence: "Separate owners may overlook coincident work. The date cluster alone does not establish a dependency or conflict.",
      uncertainty: "Temporal coincidence only; contractual dependency has not been established.",
    });
  }
  return {
    concentrations,
    recommendations,
    prioritizedFindings: findings
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        priority: item.kind === "current" ? "current_review" : "projected_monitoring",
        contractId: item.contractId,
        contractTitle: item.contractTitle,
        aircraftIds: assets.filter((asset) => (
          asset.confirmedContractIds.includes(item.contractId) && evidenceMentionsAsset(item, asset)
        )).map((asset) => asset.aircraftId),
        amount: item.amount,
        currency: item.currency,
        clauseId: item.clauseId,
        evidence: item.evidence,
        explanation: item.kind === "current"
          ? "Verified recorded utilization and a cited contractual provision establish a current informational excess-charge estimate."
          : "Verified historical utilization supports a projected estimate at an explicit contractual measurement date; the projection is not an incurred liability.",
      }))
      .sort((left, right) => (
        (left.kind === "current" ? 0 : 1) - (right.kind === "current" ? 0 : 1)
        || left.contractTitle.localeCompare(right.contractTitle)
      )),
  };
}

export function deriveAviationContractPortfolioIntelligence({
  organizationId,
  runs = [],
  relationships = [],
  assessmentsByRun = new Map(),
  asOf = new Date().toISOString().slice(0, 10),
  runsTruncated = false,
  relationshipsTruncated = false,
} = {}) {
  assertOrganizationScope(organizationId);
  if (!validDate(asOf)) throw new TypeError("asOf must be a valid ISO date");
  if (!(assessmentsByRun instanceof Map)) throw new TypeError("assessmentsByRun must be a Map");

  const contracts = runs.flatMap((run) => {
    if (run?.organization_id !== organizationId || !run.contract_id || !run.analysis_run_id || !run.document_version_id) return [];
    const classification = parseClassification(run.classification);
    if (classification?.status !== "confirmed" || !AVIATION_CONTRACT_TYPES.has(classification.type)) return [];
    return [{
      id: run.contract_id,
      title: run.contract_title || "Untitled aviation contract",
      type: classification.type,
      analysisRunId: run.analysis_run_id,
      documentVersionId: run.document_version_id,
    }];
  }).sort(sortByTitle);
  const contractsById = new Map(contracts.map((contract) => [contract.id, contract]));
  const normalizedRelationships = relationships
    .map((row) => normalizeRelationship(row, organizationId, contractsById))
    .filter(Boolean);
  const { findings: financialFindings, omittedUncited } = deriveFinancialFindings(contracts, assessmentsByRun);
  const utilisationExposures = deriveUtilisationExposures(contracts, assessmentsByRun);
  const aircraft = deriveAircraftAssets(normalizedRelationships, contractsById, financialFindings);
  const deadlineClusters = deriveDeadlineClusters(contracts, assessmentsByRun, asOf);
  const currentFindings = financialFindings.filter((item) => item.kind === "current");
  const projectedFindings = financialFindings.filter((item) => item.kind === "projected");
  const { concentrations, recommendations, prioritizedFindings } = derivePortfolioFindings(
    aircraft,
    deadlineClusters,
    financialFindings,
  );
  const potentialRelationshipCount = normalizedRelationships.filter((item) => item.relationshipStatus === "potential").length;
  const unresolvedRelationshipCount = normalizedRelationships.filter((item) => item.relationshipStatus === "unresolved").length;

  return {
    status: contracts.length ? "available" : "no_verified_aviation_analysis",
    asOf,
    scope: "organization",
    coverage: {
      confirmedAviationContracts: contracts.length,
      contractsWithoutConfirmedAircraftLinks: contracts.filter((contract) => !aircraft.some((asset) => asset.confirmedContractIds.includes(contract.id))).length,
      latestCompletedRunLimit: PORTFOLIO_RUN_LIMIT,
      runsTruncated: Boolean(runsTruncated),
      aircraftRelationshipLimit: RELATIONSHIP_LIMIT,
      relationshipsTruncated: Boolean(relationshipsTruncated),
      portfolioInventoryComplete: false,
      limitation: "This read-time assessment includes only supported aviation contract profiles with a latest completed analysis. It is not a complete inventory of every registered contract.",
    },
    contracts,
    aircraft,
    relationships: {
      confirmedSharedAircraft: aircraft.filter((item) => item.confirmedContractIds.length > 1),
      potentialCount: potentialRelationshipCount,
      unresolvedCount: unresolvedRelationshipCount,
    },
    counterparties: {
      status: "unresolved",
      entities: [],
      reason: "Existing contract party records do not provide a verified, stable cross-contract counterparty identity; similar names are not merged.",
    },
    financialExposure: {
      currentByCurrency: aggregateAmounts(currentFindings),
      projectedByCurrency: aggregateAmounts(projectedFindings),
      byContract: contracts.map((contract) => ({
        contractId: contract.id,
        contractTitle: contract.title,
        currentByCurrency: aggregateAmounts(currentFindings.filter((item) => item.contractId === contract.id)),
        projectedByCurrency: aggregateAmounts(projectedFindings.filter((item) => item.contractId === contract.id)),
      })),
      byAircraft: aircraft.map((item) => ({
        aircraftId: item.aircraftId,
        currentByCurrency: item.currentExposureByCurrency,
        projectedByCurrency: item.projectedExposureByCurrency,
      })),
      findings: financialFindings,
      currencyPolicy: "Amounts are summed only within the same currency. No currency conversion is performed.",
      omittedUncitedFindings: omittedUncited,
    },
    utilisationExposures,
    deadlineClusters,
    concentrations,
    prioritizedFindings,
    recommendations,
    limitations: [
      "No reviewed counterparty identity or cross-contract obligation dependency is available from the supported data used in this assessment.",
      "Deadline clusters indicate shared dates only and are not contractual dependencies or conflicts.",
      "Aircraft concentrations require an exact stable aircraft identifier and verified source evidence; potential or unresolved links are not used to allocate financial exposure.",
      "The assessment is informational and does not produce an opaque risk score, legal conclusion, or loss estimate.",
    ],
  };
}

async function mapInBatches(items, batchSize, callback) {
  const results = [];
  for (let index = 0; index < items.length; index += batchSize) {
    results.push(...await Promise.all(items.slice(index, index + batchSize).map(callback)));
  }
  return results;
}

export async function readAviationContractPortfolioIntelligence({
  organizationId,
  repository = createAviationContractPortfolioRepository(),
  readLeaseAssessment,
  asOf,
} = {}) {
  assertOrganizationScope(organizationId);
  if (typeof readLeaseAssessment !== "function") throw new TypeError("readLeaseAssessment is required");

  const [listedRuns, listedRelationships] = await Promise.all([
    repository.listLatestCompletedRuns(organizationId),
    repository.listAircraftRelationships(organizationId),
  ]);
  if (!Array.isArray(listedRuns) || !Array.isArray(listedRelationships)) {
    throw new TypeError("Portfolio repository returned an invalid result");
  }
  const runsTruncated = listedRuns.length > PORTFOLIO_RUN_LIMIT;
  const relationshipsTruncated = listedRelationships.length > RELATIONSHIP_LIMIT;
  const runs = listedRuns.slice(0, PORTFOLIO_RUN_LIMIT);
  const includedRunRows = runs.filter((run) => {
    if (run.organization_id !== organizationId) {
      throw new Error("Portfolio repository returned a cross-organization analysis run");
    }
    const classification = parseClassification(run.classification);
    return classification?.status === "confirmed" && AVIATION_CONTRACT_TYPES.has(classification.type);
  });
  const assessments = await mapInBatches(
    includedRunRows.filter((run) => parseClassification(run.classification)?.type === "AIRCRAFT_LEASE"),
    8,
    async (run) => [run.analysis_run_id, await readLeaseAssessment({
      organizationId,
      analysisRunId: run.analysis_run_id,
      asOf,
    })],
  );
  return deriveAviationContractPortfolioIntelligence({
    organizationId,
    runs,
    relationships: listedRelationships.slice(0, RELATIONSHIP_LIMIT),
    assessmentsByRun: new Map(assessments),
    asOf,
    runsTruncated,
    relationshipsTruncated,
  });
}
