import express from "express";

import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireOrganizationMembership } from "../middleware/organizationMiddleware.js";
import { getOrganizationPermissions, requireOrganizationPermission } from "../middleware/authorizationMiddleware.js";
import { getAnalysisRunById } from "../services/documentIngestionService.js";
import { createAnalysisRunRepository } from "../repositories/phase3/analysisRunRepository.js";
import { createClauseRepository } from "../repositories/phase3/clauseRepository.js";
import { createObligationRepository } from "../repositories/phase3/obligationRepository.js";
import { createDeadlineRepository } from "../repositories/phase3/deadlineRepository.js";
import { createRiskRepository } from "../repositories/phase3/riskRepository.js";
import { createEvidenceRepository } from "../repositories/phase3/evidenceRepository.js";
import { createContractProfileRepository } from "../repositories/phase3/contractProfileRepository.js";
import { createSearchChunkRepository } from "../repositories/phase3/searchChunkRepository.js";
import { answerPortfolioContractQuestion } from "../services/phase3/intelligence/portfolioContractAssistantService.js";
import { createAviationRelationshipRepository } from "../repositories/aviation/aviationRelationshipRepository.js";
import { runDeterministicClauseStage } from "../services/phase3/intelligence/deterministicClauseService.js";
import { createDeterministicObligationService, createGatewayObligationProvider } from "../services/phase3/intelligence/deterministicObligationService.js";
import { createDeadlineIntelligenceService, createGatewayDeadlineProvider } from "../services/phase3/intelligence/deadlineIntelligenceService.js";
import { createContractRiskIntelligenceService, createGatewayRiskProvider } from "../services/phase3/intelligence/contractRiskIntelligenceService.js";
import { answerContractQuestion } from "../services/phase3/intelligence/contractAssistantService.js";
import { createContractIntelligencePipeline } from "../services/phase3/analysis/contractIntelligencePipeline.js";
import { buildFinancialImpact } from "../services/phase3/intelligence/financialImpactService.js";
import { buildAviationEventImpact, validateAviationEventInput } from "../services/phase3/intelligence/aviationEventImpactService.js";
import { buildRoleBasedIntelligence, resolveUserIntelligenceContext } from "../services/phase3/intelligence/roleIntelligenceService.js";
import { monitorDeadlines } from "../services/phase3/intelligence/deadlineMonitoringService.js";
import { deriveDeadlineRiskFindings } from "../services/phase3/intelligence/riskDecisionSupport.js";
import { createContractChangeIntelligenceService } from "../services/phase3/intelligence/contractChangeIntelligenceService.js";
import { createObligationFulfilmentService } from "../services/phase3/intelligence/obligationFulfilmentService.js";
import { createObligationFulfilmentRepository } from "../repositories/phase3/obligationFulfilmentRepository.js";
import {
  deriveAviationLeaseRiskAssessment,
  hasExplicitAircraftLeaseUtilisationLimit,
} from "../services/phase3/intelligence/aviationLeaseRiskAssessmentService.js";
import { createAviationLeaseRecommendationRepository } from "../repositories/phase3/aviationLeaseRecommendationRepository.js";
import { createAviationLeaseRecommendationService } from "../services/phase3/intelligence/aviationLeaseRecommendationService.js";
import { aiGateway } from "../services/ai/aiGateway.js";
import { assertOrganizationScope, assertResourceId } from "../repositories/phase3/scope.js";
import supabase from "../config/supabase.js";
import { toSafeHttpError } from "../utils/safeHttpError.js";

const router = express.Router();
const contractChangeIntelligence = createContractChangeIntelligenceService();
const obligationFulfilment = createObligationFulfilmentService();
const aviationLeaseRecommendations = createAviationLeaseRecommendationService({
  repository: createAviationLeaseRecommendationRepository(),
});

function normalizeAnalysisRunError(error) {
  return toSafeHttpError(error, {
    code: "ANALYSIS_REQUEST_FAILED",
    message: "The analysis request could not be completed",
  }).body;
}

function sanitizeClause(row) {
  if (!row) return null;
  const {
    organization_id: _organizationId,
    contract_id: _contractId,
    document_id: _documentId,
    clause_identity: _clauseIdentity,
    ...safeClause
  } = row;
  return safeClause;
}

function sanitizeObligation(row) {
  if (!row) return null;
  const {
    organization_id: _organizationId,
    contract_id: _contractId,
    document_id: _documentId,
    document_version_id: _documentVersionId,
    obligation_identity: _obligationIdentity,
    ...safeObligation
  } = row;
  return safeObligation;
}

function sanitizeDeadline(row) {
  if (!row) return null;
  const {
    organization_id: _organizationId,
    contract_id: _contractId,
    document_id: _documentId,
    document_version_id: _documentVersionId,
    deadline_identity: _deadlineIdentity,
    ...safeDeadline
  } = row;
  return safeDeadline;
}

function sanitizeRisk(row) {
  if (!row) return null;
  const {
    organization_id: _organizationId,
    contract_id: _contractId,
    document_id: _documentId,
    document_version_id: _documentVersionId,
    risk_identity: _riskIdentity,
    ...safeRisk
  } = row;
  return safeRisk;
}

function sanitizeEvidence(row) {
  if (!row) return null;
  const {
    organization_id: _organizationId,
    contract_id: _contractId,
    document_id: _documentId,
    document_version_id: _documentVersionId,
    evidence_hash: _evidenceHash,
    ...safeEvidence
  } = row;
  return safeEvidence;
}

function sanitizeProfile(row) {
  if (!row) return null;
  const {
    organization_id: _organizationId,
    contract_id: _contractId,
    document_id: _documentId,
    document_version_id: _documentVersionId,
    ...safeProfile
  } = row;
  return safeProfile;
}

async function resolveAnalysisRunScope({ organizationId, analysisRunId, analysisRunRepository, documentVersionResolver, requireCompleted = false }) {
  assertOrganizationScope(organizationId);
  assertResourceId(analysisRunId, "analysisRunId");
  const analysisRun = await analysisRunRepository.getById(analysisRunId, organizationId);
  if (!analysisRun || analysisRun.organization_id !== organizationId) {
    throw Object.assign(new Error("Analysis run not found"), { code: "ANALYSIS_RUN_NOT_FOUND", status: 404 });
  }
  if (requireCompleted && analysisRun.status !== "completed") {
    throw Object.assign(new Error("This intelligence review requires a completed analysis"), { code: "ANALYSIS_NOT_COMPLETED", status: 422 });
  }
  const documentVersion = await documentVersionResolver(analysisRun.document_version_id, organizationId);
  if (!documentVersion || documentVersion.organization_id && documentVersion.organization_id !== organizationId) {
    throw Object.assign(new Error("Analysis run not found"), { code: "ANALYSIS_RUN_NOT_FOUND", status: 404 });
  }
  return {
    organizationId,
    contractId: analysisRun.contract_id,
    documentId: documentVersion.document_id,
    documentVersionId: analysisRun.document_version_id,
    analysisRunId,
  };
}

export async function readAnalysisRunClauses({
  organizationId,
  analysisRunId,
  analysisRunRepository = createAnalysisRunRepository(),
  clauseRepository = createClauseRepository(),
}) {
  assertOrganizationScope(organizationId);
  assertResourceId(analysisRunId, "analysisRunId");

  const analysisRun = await analysisRunRepository.getById(analysisRunId, organizationId);
  if (!analysisRun || analysisRun.organization_id !== organizationId) {
    const error = new Error("Analysis run not found");
    error.code = "ANALYSIS_RUN_NOT_FOUND";
    error.status = 404;
    throw error;
  }

  const clauses = await clauseRepository.listByRun({
    organizationId,
    documentVersionId: analysisRun.document_version_id,
    analysisRunId,
  });

  return (clauses || []).map(sanitizeClause);
}

export async function readAnalysisRunObligations({
  organizationId,
  analysisRunId,
  analysisRunRepository = createAnalysisRunRepository(),
  obligationRepository = createObligationRepository(),
  documentVersionResolver = async (documentVersionId, orgId) => {
    const { data, error } = await supabase
      .from("document_versions")
      .select("id, document_id, organization_id")
      .eq("id", documentVersionId)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (error) {
      const normalized = new Error("Document version lookup failed");
      normalized.code = "STORAGE_ERROR";
      normalized.status = 503;
      throw normalized;
    }

    return data || null;
  },
}) {
  assertOrganizationScope(organizationId);
  assertResourceId(analysisRunId, "analysisRunId");

  const analysisRun = await analysisRunRepository.getById(analysisRunId, organizationId);
  if (!analysisRun || analysisRun.organization_id !== organizationId) {
    const error = new Error("Analysis run not found");
    error.code = "ANALYSIS_RUN_NOT_FOUND";
    error.status = 404;
    throw error;
  }

  const documentVersion = await documentVersionResolver(
    analysisRun.document_version_id,
    organizationId
  );

  if (!documentVersion) {
    const missing = new Error("Analysis run not found");
    missing.code = "ANALYSIS_RUN_NOT_FOUND";
    missing.status = 404;
    throw missing;
  }

  const obligations = await obligationRepository.listByRunScope({
    organizationId,
    contractId: analysisRun.contract_id,
    documentId: documentVersion.document_id,
    documentVersionId: analysisRun.document_version_id,
    analysisRunId,
  });

  return (obligations || []).map(sanitizeObligation);
}

export async function readAnalysisRunDeadlines({
  organizationId,
  analysisRunId,
  asOf,
  analysisRunRepository = createAnalysisRunRepository(),
  deadlineRepository = createDeadlineRepository(),
  documentVersionResolver = async (documentVersionId, orgId) => {
    const { data, error } = await supabase.from("document_versions")
      .select("id, document_id, organization_id")
      .eq("id", documentVersionId).eq("organization_id", orgId).maybeSingle();
    if (error) throw Object.assign(new Error("Document version lookup failed"), { code: "STORAGE_ERROR", status: 503 });
    return data || null;
  },
}) {
  const scope = await resolveAnalysisRunScope({ organizationId, analysisRunId, analysisRunRepository, documentVersionResolver });
  return monitorDeadlines((await deadlineRepository.listByRunScope(scope)).map(sanitizeDeadline), { asOf });
}

export async function readAnalysisRunRisks({
  organizationId,
  analysisRunId,
  asOf,
  analysisRunRepository = createAnalysisRunRepository(),
  riskRepository = createRiskRepository(),
  documentVersionResolver = async (documentVersionId, orgId) => {
    const { data, error } = await supabase.from("document_versions")
      .select("id, document_id, organization_id")
      .eq("id", documentVersionId).eq("organization_id", orgId).maybeSingle();
    if (error) throw Object.assign(new Error("Document version lookup failed"), { code: "STORAGE_ERROR", status: 503 });
    return data || null;
  },
}) {
  const scope = await resolveAnalysisRunScope({ organizationId, analysisRunId, analysisRunRepository, documentVersionResolver });
  const [storedRisks, intelligence] = await Promise.all([
    riskRepository.listByRunScope(scope),
    riskRepository.listIntelligence(scope),
  ]);
  return deriveDeadlineRiskFindings({
    deadlines: intelligence.deadlines,
    obligations: intelligence.obligations,
    existingRisks: storedRisks
      .filter((risk) => !["superseded", "resolved"].includes(risk.status))
      .map(sanitizeRisk),
    asOf,
  });
}

export async function readAnalysisRunAviationLeaseRiskAssessment({
  organizationId,
  analysisRunId,
  asOf,
  analysisRunRepository = createAnalysisRunRepository(),
  riskRepository = createRiskRepository(),
  profileRepository = createContractProfileRepository(),
  fulfilmentRepository = createObligationFulfilmentRepository(),
  recommendationRepository = createAviationLeaseRecommendationRepository(),
  documentVersionResolver = async (documentVersionId, orgId) => {
    const { data, error } = await supabase.from("document_versions")
      .select("id, document_id, organization_id")
      .eq("id", documentVersionId).eq("organization_id", orgId).maybeSingle();
    if (error) throw Object.assign(new Error("Document version lookup failed"), { code: "STORAGE_ERROR", status: 503 });
    return data || null;
  },
}) {
  const scope = await resolveAnalysisRunScope({
    organizationId,
    analysisRunId,
    analysisRunRepository,
    documentVersionResolver,
    requireCompleted: true,
  });
  const [profile, intelligence] = await Promise.all([
    profileRepository.getByRun({ organizationId, analysisRunId }),
    riskRepository.listIntelligence(scope),
  ]);
  const applicability = deriveAviationLeaseRiskAssessment({ profile, scope });
  if (!applicability.applicable) {
    return {
      ...applicability,
      organizationId: scope.organizationId,
      contractId: scope.contractId,
      documentVersionId: scope.documentVersionId,
      analysisRunId: scope.analysisRunId,
      recommendations: [],
    };
  }
  const latestAssessments = await fulfilmentRepository.listLatestForRun({
    scope,
    obligationIds: intelligence.obligations.map((obligation) => obligation.id),
  });
  const clausesById = new Map(intelligence.clauses.map((clause) => [clause.id, clause]));
  const utilisationObligations = intelligence.obligations.filter((obligation) => (
    hasExplicitAircraftLeaseUtilisationLimit(clausesById.get(obligation.clause_id)?.source_text)
  ));
  const utilisationHistory = await Promise.all(utilisationObligations.map(async (obligation) => [
    obligation.id,
    await fulfilmentRepository.listByObligation({
      organizationId: scope.organizationId,
      contractId: scope.contractId,
      obligationId: obligation.id,
    }),
  ]));
  const utilizationHistoryByObligation = Object.fromEntries(utilisationHistory);
  const assessment = deriveAviationLeaseRiskAssessment({
    profile,
    scope,
    clauses: intelligence.clauses,
    obligations: intelligence.obligations,
    deadlines: intelligence.deadlines,
    latestAssessments,
    utilizationHistoryByObligation,
    asOf,
  });
  const recommendations = await createAviationLeaseRecommendationService({
    repository: recommendationRepository,
  }).list({
    scope,
    risks: assessment.risks,
  });
  return {
    ...assessment,
    organizationId: scope.organizationId,
    contractId: scope.contractId,
    documentVersionId: scope.documentVersionId,
    analysisRunId: scope.analysisRunId,
    recommendations,
  };
}

export async function readAnalysisRunEvidence({
  organizationId,
  analysisRunId,
  analysisRunRepository = createAnalysisRunRepository(),
  evidenceRepository = createEvidenceRepository(),
}) {
  assertOrganizationScope(organizationId);
  assertResourceId(analysisRunId, "analysisRunId");
  const analysisRun = await analysisRunRepository.getById(analysisRunId, organizationId);
  if (!analysisRun || analysisRun.organization_id !== organizationId) {
    throw Object.assign(new Error("Analysis run not found"), { code: "ANALYSIS_RUN_NOT_FOUND", status: 404 });
  }
  return (await evidenceRepository.listByRun({ organizationId, analysisRunId })).map(sanitizeEvidence);
}

export async function processAnalysisRun({
  organizationId,
  analysisRunId,
  userId = null,
  pipeline = createContractIntelligencePipeline(),
}) {
  return pipeline.run({ organizationId, analysisRunId, userId });
}

export async function readAnalysisRunProfile({
  organizationId,
  analysisRunId,
  analysisRunRepository = createAnalysisRunRepository(),
  profileRepository = createContractProfileRepository(),
}) {
  assertOrganizationScope(organizationId);
  assertResourceId(analysisRunId, "analysisRunId");
  const run = await analysisRunRepository.getById(analysisRunId, organizationId);
  if (!run || run.organization_id !== organizationId) throw Object.assign(new Error("Analysis run not found"), { code: "ANALYSIS_RUN_NOT_FOUND", status: 404 });
  const profile = await profileRepository.getByRun({ organizationId, analysisRunId });
  if (!profile) throw Object.assign(new Error("Contract profile not found"), { code: "CONTRACT_PROFILE_NOT_FOUND", status: 404 });
  return sanitizeProfile(profile);
}

export async function readAnalysisRunRelationships({
  organizationId,
  analysisRunId,
  analysisRunRepository = createAnalysisRunRepository(),
  relationshipRepository = createAviationRelationshipRepository(),
}) {
  assertOrganizationScope(organizationId);
  assertResourceId(analysisRunId, "analysisRunId");
  const run = await analysisRunRepository.getById(analysisRunId, organizationId);
  if (!run || run.organization_id !== organizationId) {
    throw Object.assign(new Error("Analysis run not found"), { code: "ANALYSIS_RUN_NOT_FOUND", status: 404 });
  }
  return relationshipRepository.listByContract({ organizationId, contractId: run.contract_id });
}

export async function searchAnalysisRun({
  organizationId,
  analysisRunId,
  query,
  limit,
  analysisRunRepository = createAnalysisRunRepository(),
  searchRepository = createSearchChunkRepository(),
}) {
  assertOrganizationScope(organizationId);
  assertResourceId(analysisRunId, "analysisRunId");
  const run = await analysisRunRepository.getById(analysisRunId, organizationId);
  if (!run || run.organization_id !== organizationId) throw Object.assign(new Error("Analysis run not found"), { code: "ANALYSIS_RUN_NOT_FOUND", status: 404 });
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) throw Object.assign(new Error("Search query is required"), { code: "SEARCH_QUERY_REQUIRED", status: 400 });
  return searchRepository.search({ organizationId, analysisRunId, query: normalizedQuery, limit });
}

export async function answerAnalysisRunQuestion({
  organizationId,
  analysisRunId,
  question,
  intelligenceContext = null,
  readers = {
    clauses: readAnalysisRunClauses,
    obligations: readAnalysisRunObligations,
    deadlines: readAnalysisRunDeadlines,
    risks: readAnalysisRunRisks,
    evidence: readAnalysisRunEvidence,
  },
}) {
  const scope = { organizationId, analysisRunId };
  const [clauses, obligations, deadlines, risks, evidence] = await Promise.all([
    readers.clauses(scope),
    readers.obligations(scope),
    readers.deadlines(scope),
    readers.risks(scope),
    readers.evidence(scope),
  ]);
  return answerContractQuestion({
    question,
    clauses,
    obligations,
    deadlines,
    risks,
    evidence,
    rbiProfile: intelligenceContext?.rbiProfile || null,
  });
}

export async function answerPortfolioQuestion({
  organizationId,
  question,
  searchRepository = createSearchChunkRepository(),
  intelligenceReader = readPortfolioQuestionIntelligence,
}) {
  return answerPortfolioContractQuestion({ organizationId, question, searchRepository, intelligenceReader });
}

async function readPortfolioQuestionIntelligence({
  organizationId,
  analysisRunId,
  question,
  includeFinancial,
  includeRecommendations,
  includeAircraftRelationships,
}) {
  const [assistant, financialImpact, leaseAssessment, aircraftRelationships] = await Promise.all([
    answerAnalysisRunQuestion({ organizationId, analysisRunId, question }),
    includeFinancial
      ? readAnalysisRunFinancialImpact({ organizationId, analysisRunId })
      : null,
    includeRecommendations
      ? readAnalysisRunAviationLeaseRiskAssessment({ organizationId, analysisRunId })
      : null,
    includeAircraftRelationships
      ? readAnalysisRunRelationships({ organizationId, analysisRunId })
      : null,
  ]);
  return { assistant, financialImpact, leaseAssessment, aircraftRelationships };
}

export async function readAnalysisRunFinancialImpact({
  organizationId,
  analysisRunId,
  analysisRunRepository = createAnalysisRunRepository(),
  readers = {
    clauses: readAnalysisRunClauses,
    obligations: readAnalysisRunObligations,
    deadlines: readAnalysisRunDeadlines,
    risks: readAnalysisRunRisks,
    profile: readAnalysisRunProfile,
  },
}) {
  assertOrganizationScope(organizationId);
  assertResourceId(analysisRunId, "analysisRunId");
  const analysisRun = await analysisRunRepository.getById(analysisRunId, organizationId);
  if (!analysisRun || analysisRun.organization_id !== organizationId) {
    throw Object.assign(new Error("Analysis run not found"), { code: "ANALYSIS_RUN_NOT_FOUND", status: 404 });
  }
  const scope = { organizationId, analysisRunId };
  const [clauses, obligations, deadlines, risks, profile] = await Promise.all([
    readers.clauses(scope),
    readers.obligations(scope),
    readers.deadlines(scope),
    readers.risks(scope),
    readers.profile(scope).catch((error) => error.code === "CONTRACT_PROFILE_NOT_FOUND" ? null : Promise.reject(error)),
  ]);
  return buildFinancialImpact({
    contractId: analysisRun.contract_id,
    analysisRunId,
    clauses,
    obligations,
    deadlines,
    risks,
    profile,
    calculationTimestamp: new Date().toISOString(),
  });
}

export async function readAnalysisRunAviationEventImpact({
  organizationId,
  analysisRunId,
  event,
  analysisRunRepository = createAnalysisRunRepository(),
  documentVersionResolver = async (documentVersionId, orgId) => {
    const { data, error } = await supabase.from("document_versions")
      .select("id, document_id, organization_id")
      .eq("id", documentVersionId).eq("organization_id", orgId).maybeSingle();
    if (error) throw Object.assign(new Error("Document version lookup failed"), { code: "STORAGE_ERROR", status: 503 });
    return data || null;
  },
  readers = {
    aircraftRelationships: ({ organizationId: orgId, contractId }) => createAviationRelationshipRepository()
      .listByContract({ organizationId: orgId, contractId }),
    clauses: readAnalysisRunClauses,
    evidence: readAnalysisRunEvidence,
    obligations: readAnalysisRunObligations,
    deadlines: readAnalysisRunDeadlines,
    risks: readAnalysisRunRisks,
    riskAssessment: readAnalysisRunAviationLeaseRiskAssessment,
    financialImpact: readAnalysisRunFinancialImpact,
  },
}) {
  const validatedEvent = validateAviationEventInput(event);
  const scope = await resolveAnalysisRunScope({
    organizationId,
    analysisRunId,
    analysisRunRepository,
    documentVersionResolver,
    requireCompleted: true,
  });
  const assetRelationships = await readers.aircraftRelationships({
    organizationId,
    contractId: scope.contractId,
  });
  const matchingAssetRelationships = assetRelationships.filter((item) => item.aircraft_id === validatedEvent.assetId);
  const assetRelationship = matchingAssetRelationships.find((item) => item.evidence_id) || matchingAssetRelationships[0];
  if (!assetRelationship) {
    throw Object.assign(new Error("No active evidence-backed aircraft relationship exists for this contract."), {
      code: "AVIATION_ASSET_CONTRACT_RELATIONSHIP_NOT_FOUND",
      status: 422,
    });
  }
  if (!assetRelationship.evidence_id) {
    throw Object.assign(new Error("The aircraft relationship has no available source evidence and cannot support an event review."), {
      code: "AVIATION_ASSET_LINK_EVIDENCE_UNAVAILABLE",
      status: 422,
    });
  }

  const [clauses, evidence, obligations, deadlines, riskAssessment, financialImpact] = await Promise.all([
    readers.clauses({ organizationId, analysisRunId }),
    readers.evidence({ organizationId, analysisRunId }),
    readers.obligations({ organizationId, analysisRunId }),
    readers.deadlines({ organizationId, analysisRunId }),
    readers.riskAssessment({ organizationId, analysisRunId }),
    readers.financialImpact({ organizationId, analysisRunId }),
  ]);
  const risks = riskAssessment?.applicable
    ? riskAssessment.risks
    : await readers.risks({ organizationId, analysisRunId });
  return buildAviationEventImpact({
    contractId: scope.contractId,
    analysisRunId,
    event,
    assetRelationship,
    clauses,
    evidence,
    obligations,
    deadlines,
    risks,
    financialImpact,
    recommendations: riskAssessment?.recommendations || [],
  });
}

export async function readAnalysisRunRoleIntelligence({
  organizationId,
  analysisRunId,
  intelligenceContext,
  readers = {
    risks: readAnalysisRunRisks,
    obligations: readAnalysisRunObligations,
    deadlines: readAnalysisRunDeadlines,
    profile: readAnalysisRunProfile,
    financialImpact: readAnalysisRunFinancialImpact,
  },
}) {
  const scope = { organizationId, analysisRunId };
  const [risks, obligations, deadlines, profile, financialImpact] = await Promise.all([
    readers.risks(scope),
    readers.obligations(scope),
    readers.deadlines(scope),
    readers.profile(scope).catch((error) => error.code === "CONTRACT_PROFILE_NOT_FOUND" ? null : Promise.reject(error)),
    readers.financialImpact(scope),
  ]);
  return buildRoleBasedIntelligence({
    context: intelligenceContext,
    risks,
    obligations,
    deadlines,
    recommendations: profile?.recommendations || [],
    financialImpact,
  });
}

function resolveRequestIntelligenceContext(req) {
  return resolveUserIntelligenceContext({
    userId: req.user.id,
    organizationId: req.organization.id,
    organizationRole: req.auth.organizationRole,
    permissions: getOrganizationPermissions(req.auth.organizationRole),
    rbiProfileId: req.user.rbiProfileId,
  });
}

router.use(
  authenticateUser,
  requireOrganizationMembership,
  requireOrganizationPermission("contract:read")
);

router.get("/:id", async (req, res) => {
  try {
    const analysisRun = await getAnalysisRunById(
      req.params.id,
      req.organization.id
    );
    return res.json({ success: true, analysisRun });
  } catch (error) {
    return res.status(error.status || (error.code === "STORAGE_ERROR" ? 503 : 404)).json(normalizeAnalysisRunError(error));
  }
});

async function runContractIntelligence(req, res) {
  try {
    const result = await processAnalysisRun({
      organizationId: req.organization.id,
      analysisRunId: req.params.id,
      userId: req.user.id,
    });
    return res.status(result.status === "already_processed" ? 200 : 201).json({ success: true, ...result });
  } catch (error) {
    return res.status(error.status || (error.code === "STORAGE_ERROR" ? 503 : 409)).json(normalizeAnalysisRunError(error));
  }
}

router.post("/:id/process", requireOrganizationPermission("contract:analyze"), runContractIntelligence);
router.post("/:id/retry", requireOrganizationPermission("contract:analyze"), runContractIntelligence);

router.get("/:id/profile", async (req, res) => {
  try {
    const profile = await readAnalysisRunProfile({ organizationId: req.organization.id, analysisRunId: req.params.id });
    return res.json({ success: true, profile });
  } catch (error) {
    return res.status(error.status || 404).json(normalizeAnalysisRunError(error));
  }
});

router.get("/:id/relationships", async (req, res) => {
  try {
    const relationships = await readAnalysisRunRelationships({ organizationId: req.organization.id, analysisRunId: req.params.id });
    return res.json({ success: true, relationships });
  } catch (error) {
    return res.status(error.status || 404).json(normalizeAnalysisRunError(error));
  }
});

router.get("/:id/financial-impact", async (req, res) => {
  try {
    const financialImpact = await readAnalysisRunFinancialImpact({ organizationId: req.organization.id, analysisRunId: req.params.id });
    return res.json({ success: true, financialImpact });
  } catch (error) {
    return res.status(error.status || 404).json(normalizeAnalysisRunError(error));
  }
});

router.post("/:id/aviation-event-impact", async (req, res) => {
  try {
    const eventImpact = await readAnalysisRunAviationEventImpact({
      organizationId: req.organization.id,
      analysisRunId: req.params.id,
      event: req.body?.event,
    });
    return res.json({ success: true, eventImpact });
  } catch (error) {
    return res.status(error.status || (error.code === "STORAGE_ERROR" ? 503 : 400)).json(normalizeAnalysisRunError(error));
  }
});

router.get("/:id/role-intelligence", async (req, res) => {
  try {
    const intelligence = await readAnalysisRunRoleIntelligence({
      organizationId: req.organization.id,
      analysisRunId: req.params.id,
      intelligenceContext: resolveRequestIntelligenceContext(req),
    });
    return res.json({ success: true, intelligence });
  } catch (error) {
    return res.status(error.status || 404).json(normalizeAnalysisRunError(error));
  }
});

router.get("/:id/search", async (req, res) => {
  try {
    const results = await searchAnalysisRun({
      organizationId: req.organization.id,
      analysisRunId: req.params.id,
      query: req.query.q,
      limit: req.query.limit,
    });
    return res.json({ success: true, results });
  } catch (error) {
    return res.status(error.status || 400).json(normalizeAnalysisRunError(error));
  }
});

router.post("/portfolio-assistant", async (req, res) => {
  try {
    const assistant = await answerPortfolioQuestion({
      organizationId: req.organization.id,
      question: req.body?.question,
    });
    return res.json({ success: true, assistant });
  } catch (error) {
    return res.status(error.status || (error.code === "STORAGE_ERROR" ? 503 : 400)).json(normalizeAnalysisRunError(error));
  }
});

router.get("/:id/clauses", async (req, res) => {
  try {
    const clauses = await readAnalysisRunClauses({
      organizationId: req.organization.id,
      analysisRunId: req.params.id,
    });
    return res.json({ success: true, clauses });
  } catch (error) {
    return res.status(error.status || 404).json(normalizeAnalysisRunError(error));
  }
});

router.get("/:sourceAId/compare/:sourceBId", async (req, res) => {
  try {
    const comparison = await contractChangeIntelligence.compare({
      organizationId: req.organization.id,
      sourceAAnalysisRunId: req.params.sourceAId,
      sourceBAnalysisRunId: req.params.sourceBId,
    });
    return res.json({ success: true, comparison });
  } catch (error) {
    return res.status(error.status || 404).json(normalizeAnalysisRunError(error));
  }
});

router.post("/:id/clauses/analyze", requireOrganizationPermission("contract:analyze"), async (req, res) => {
  const analysisRunRepository = createAnalysisRunRepository();
  try {
    const analysisRun = await analysisRunRepository.getById(req.params.id, req.organization.id);
    if (!analysisRun) {
      throw Object.assign(new Error("Analysis run not found"), { code: "ANALYSIS_RUN_NOT_FOUND", status: 404 });
    }
    if (analysisRun.status === "queued") {
      await analysisRunRepository.updateStatus({
        analysisRunId: analysisRun.id,
        organizationId: req.organization.id,
        status: "processing",
        startedAt: new Date().toISOString(),
      });
      await analysisRunRepository.updateStatus({
        analysisRunId: analysisRun.id,
        organizationId: req.organization.id,
        status: "extracting",
        startedAt: new Date().toISOString(),
      });
    }
    const result = await runDeterministicClauseStage({
      organizationId: req.organization.id,
      documentVersionId: analysisRun.document_version_id,
      analysisRunId: analysisRun.id,
    });
    const updatedRun = await analysisRunRepository.updateStatus({
      analysisRunId: analysisRun.id,
      organizationId: req.organization.id,
      status: "analysing",
      startedAt: analysisRun.started_at || new Date().toISOString(),
    });
    return res.status(201).json({
      success: true,
      status: result.status,
      analysisRun: updatedRun,
      clauses: (result.clauses || []).map(sanitizeClause),
      intelligenceConsumption: 0,
    });
  } catch (error) {
    return res.status(error.status || (error.code === "STORAGE_ERROR" ? 503 : 409)).json(normalizeAnalysisRunError(error));
  }
});

router.get("/:id/obligations/estimate", requireOrganizationPermission("contract:read"), async (req, res) => {
  try {
    const analysisRun = await getAnalysisRunById(req.params.id, req.organization.id);
    const estimatedIntelligence = aiGateway.estimate("obligation_reasoning", "bounded clause and evidence context");
    return res.json({
      success: true,
      estimatedIntelligence,
      budget: await aiGateway.getBudget(req.organization.id),
      analysisRunId: analysisRun.id,
    });
  } catch (error) {
    return res.status(error.status || 404).json(normalizeAnalysisRunError(error));
  }
});

router.post("/:id/obligations/analyze", requireOrganizationPermission("contract:analyze"), async (req, res) => {
  const metrics = {};
  try {
    const analysisRun = await getAnalysisRunById(req.params.id, req.organization.id);
    const { data: documentVersion, error } = await supabase
      .from("document_versions")
      .select("id, document_id")
      .eq("id", analysisRun.document_version_id)
      .eq("organization_id", req.organization.id)
      .maybeSingle();
    if (error) throw Object.assign(new Error("Document version lookup failed"), { code: "STORAGE_ERROR", status: 503 });
    if (!documentVersion) throw Object.assign(new Error("Document version not found"), { code: "DOCUMENT_VERSION_NOT_FOUND", status: 404 });

    const service = createDeterministicObligationService({
      provider: createGatewayObligationProvider({
        confirmation: req.body?.confirmation === true,
        metrics,
      }),
    });
    const result = await service.runStage({
      organizationId: req.organization.id,
      contractId: analysisRun.contract_id,
      documentId: documentVersion.document_id,
      documentVersionId: analysisRun.document_version_id,
      analysisRunId: analysisRun.id,
      userId: req.user.id,
      useProviderNormalization: req.body?.useProviderNormalization === true,
    });
    return res.status(201).json({
      success: true,
      ...result,
      obligations: (result.obligations || []).map(sanitizeObligation),
      metrics: {
        clausesAnalysed: result.analysedClauses || 0,
        aiRequests: metrics.requests || 0,
        estimatedIntelligence: metrics.estimatedIntelligence || 0,
        actualIntelligence: metrics.actualIntelligence || 0,
        cacheHits: metrics.cacheHits || 0,
        cacheMisses: metrics.cacheMisses || 0,
      },
    });
  } catch (error) {
    return res.status(error.status || (error.code === "STORAGE_ERROR" ? 503 : 409)).json(normalizeAnalysisRunError(error));
  }
});

router.get("/:id/obligations", async (req, res) => {
  try {
    const obligations = await readAnalysisRunObligations({
      organizationId: req.organization.id,
      analysisRunId: req.params.id,
    });
    return res.json({ success: true, obligations });
  } catch (error) {
    return res.status(error.status || 404).json(normalizeAnalysisRunError(error));
  }
});

router.get("/:id/obligations/:obligationId/fulfilment", async (req, res) => {
  try {
    const result = await obligationFulfilment.get({
      organizationId: req.organization.id,
      analysisRunId: req.params.id,
      obligationId: req.params.obligationId,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(error.status || (error.code === "STORAGE_ERROR" ? 503 : 500)).json(normalizeAnalysisRunError(error));
  }
});

router.post(
  "/:id/obligations/:obligationId/fulfilment",
  requireOrganizationPermission("contract:write"),
  async (req, res) => {
    try {
      const result = await obligationFulfilment.assess({
        organizationId: req.organization.id,
        analysisRunId: req.params.id,
        obligationId: req.params.obligationId,
        reviewerUserId: req.user.id,
        input: req.body,
      });
      return res.status(201).json({ success: true, ...result });
    } catch (error) {
      return res.status(error.status || (error.code === "STORAGE_ERROR" ? 503 : 500)).json(normalizeAnalysisRunError(error));
    }
  }
);

router.post("/:id/deadlines/analyze", requireOrganizationPermission("contract:analyze"), async (req, res) => {
  const metrics = {};
  try {
    const analysisRunRepository = createAnalysisRunRepository();
    const scope = await resolveAnalysisRunScope({
      organizationId: req.organization.id,
      analysisRunId: req.params.id,
      analysisRunRepository,
      documentVersionResolver: async (documentVersionId, orgId) => {
        const { data, error } = await supabase.from("document_versions")
          .select("id, document_id, organization_id")
          .eq("id", documentVersionId).eq("organization_id", orgId).maybeSingle();
        if (error) throw Object.assign(new Error("Document version lookup failed"), { code: "STORAGE_ERROR", status: 503 });
        return data || null;
      },
    });
    const result = await createDeadlineIntelligenceService({
      metrics,
      provider: createGatewayDeadlineProvider({ gateway: aiGateway, confirmation: req.body?.confirmation === true, metrics }),
    }).runStage({
      ...scope,
      userId: req.user.id,
      useAIFallback: req.body?.useAIFallback === true,
    });
    console.info("contract_risk_analysis_completed", {
      organizationId: scope.organizationId,
      contractId: scope.contractId,
      documentVersionId: scope.documentVersionId,
      analysisRunId: scope.analysisRunId,
      deterministicCandidates: result.deterministicCandidates,
      aiCandidates: result.aiCandidates,
      aiRequests: result.aiRequests,
      estimatedIntelligence: result.estimatedIntelligence,
      actualIntelligence: result.actualIntelligence,
      cacheHits: result.cacheHits,
      cacheMisses: result.cacheMisses,
      riskCount: result.risks?.length || 0,
      severityCounts: result.severityCounts,
      durationMs: result.performance?.totalMs,
      failedCandidateCount: result.failedCandidates?.length || 0,
    });
    return res.status(201).json({
      success: true,
      ...result,
      deadlines: (result.deadlines || []).map(sanitizeDeadline),
      metrics: {
        deterministicAnalyses: result.deterministicAnalyses,
        aiFallbackAnalyses: result.aiFallbackAnalyses,
        aiIntelligenceConsumed: result.aiIntelligenceConsumed,
        cacheHits: result.cacheHits,
        cacheMisses: result.cacheMisses,
      },
    });
  } catch (error) {
    console.warn("contract_risk_analysis_failed", {
      organizationId: req.organization?.id || null,
      analysisRunId: req.params.id,
      errorCategory: error.code || "RISK_ANALYSIS_FAILED",
    });
    return res.status(error.status || (error.code === "STORAGE_ERROR" ? 503 : 409)).json(normalizeAnalysisRunError(error));
  }
});

router.get("/:id/deadlines", async (req, res) => {
  try {
    const deadlines = await readAnalysisRunDeadlines({
      organizationId: req.organization.id,
      analysisRunId: req.params.id,
    });
    return res.json({ success: true, deadlines });
  } catch (error) {
    return res.status(error.status || 404).json(normalizeAnalysisRunError(error));
  }
});

router.get("/:id/risks/estimate", async (req, res) => {
  try {
    const analysisRun = await getAnalysisRunById(req.params.id, req.organization.id);
    const estimatedIntelligence = aiGateway.estimate("risk_reasoning", "bounded risk candidate clauses and related intelligence");
    return res.json({
      success: true,
      estimatedIntelligence,
      budget: await aiGateway.getBudget(req.organization.id),
      analysisRunId: analysisRun.id,
    });
  } catch (error) {
    return res.status(error.status || 404).json(normalizeAnalysisRunError(error));
  }
});

router.post("/:id/risks/analyze", requireOrganizationPermission("contract:analyze"), async (req, res) => {
  const metrics = {};
  try {
    const analysisRunRepository = createAnalysisRunRepository();
    const scope = await resolveAnalysisRunScope({
      organizationId: req.organization.id,
      analysisRunId: req.params.id,
      analysisRunRepository,
      documentVersionResolver: async (documentVersionId, orgId) => {
        const { data, error } = await supabase.from("document_versions")
          .select("id, document_id, organization_id")
          .eq("id", documentVersionId).eq("organization_id", orgId).maybeSingle();
        if (error) throw Object.assign(new Error("Document version lookup failed"), { code: "STORAGE_ERROR", status: 503 });
        return data || null;
      },
    });
    const result = await createContractRiskIntelligenceService({
      metrics,
      provider: createGatewayRiskProvider({ gateway: aiGateway, confirmation: req.body?.confirmation === true, metrics }),
    }).runStage({
      ...scope,
      userId: req.user.id,
      useAIFallback: req.body?.useAIFallback === true,
    });
    return res.status(201).json({
      success: true,
      ...result,
      risks: (result.risks || []).map(sanitizeRisk),
    });
  } catch (error) {
    return res.status(error.status || (error.code === "STORAGE_ERROR" ? 503 : 409)).json(normalizeAnalysisRunError(error));
  }
});

router.get("/:id/risks", async (req, res) => {
  try {
    const risks = await readAnalysisRunRisks({
      organizationId: req.organization.id,
      analysisRunId: req.params.id,
    });
    return res.json({ success: true, risks });
  } catch (error) {
    return res.status(error.status || 404).json(normalizeAnalysisRunError(error));
  }
});

router.get("/:id/aviation-lease-risk-assessment", async (req, res) => {
  try {
    const assessment = await readAnalysisRunAviationLeaseRiskAssessment({
      organizationId: req.organization.id,
      analysisRunId: req.params.id,
    });
    return res.json({ success: true, ...assessment });
  } catch (error) {
    return res.status(error.status || (error.code === "STORAGE_ERROR" ? 503 : 500)).json(normalizeAnalysisRunError(error));
  }
});

router.post(
  "/:id/aviation-lease-recommendations/:recommendationKey/decision",
  requireOrganizationPermission("contract:write"),
  async (req, res) => {
    try {
      const current = await readAnalysisRunAviationLeaseRiskAssessment({
        organizationId: req.organization.id,
        analysisRunId: req.params.id,
      });
      const recommendation = current.recommendations.find((item) => item.recommendation_key === req.params.recommendationKey);
      if (!recommendation) {
        throw Object.assign(new Error("Recommendation not found"), { code: "RECOMMENDATION_NOT_FOUND", status: 404 });
      }
      const decision = await aviationLeaseRecommendations.decide({
        recommendation,
        reviewerUserId: req.user.id,
        input: req.body,
      });
      const refreshed = await readAnalysisRunAviationLeaseRiskAssessment({
        organizationId: req.organization.id,
        analysisRunId: req.params.id,
      });
      return res.json({
        success: true,
        decision,
        recommendation: refreshed.recommendations.find((item) => item.recommendation_key === req.params.recommendationKey) || null,
      });
    } catch (error) {
      return res.status(error.status || (error.code === "STORAGE_ERROR" ? 503 : 500)).json(normalizeAnalysisRunError(error));
    }
  }
);

router.get("/:id/evidence", async (req, res) => {
  try {
    const evidence = await readAnalysisRunEvidence({
      organizationId: req.organization.id,
      analysisRunId: req.params.id,
    });
    return res.json({ success: true, evidence });
  } catch (error) {
    return res.status(error.status || 404).json(normalizeAnalysisRunError(error));
  }
});

router.post("/:id/assistant", async (req, res) => {
  try {
    const assistant = await answerAnalysisRunQuestion({
      organizationId: req.organization.id,
      analysisRunId: req.params.id,
      question: req.body?.question,
      intelligenceContext: resolveRequestIntelligenceContext(req),
    });
    return res.json({ success: true, assistant });
  } catch (error) {
    return res.status(error.status || 404).json(normalizeAnalysisRunError(error));
  }
});

export default router;
