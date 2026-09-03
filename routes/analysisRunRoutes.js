import express from "express";

import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireOrganizationMembership } from "../middleware/organizationMiddleware.js";
import { requireOrganizationPermission } from "../middleware/authorizationMiddleware.js";
import { getAnalysisRunById } from "../services/documentIngestionService.js";
import { createAnalysisRunRepository } from "../repositories/phase3/analysisRunRepository.js";
import { createClauseRepository } from "../repositories/phase3/clauseRepository.js";
import { createObligationRepository } from "../repositories/phase3/obligationRepository.js";
import { createDeadlineRepository } from "../repositories/phase3/deadlineRepository.js";
import { createRiskRepository } from "../repositories/phase3/riskRepository.js";
import { createEvidenceRepository } from "../repositories/phase3/evidenceRepository.js";
import { createContractProfileRepository } from "../repositories/phase3/contractProfileRepository.js";
import { createSearchChunkRepository } from "../repositories/phase3/searchChunkRepository.js";
import { runDeterministicClauseStage } from "../services/phase3/intelligence/deterministicClauseService.js";
import { createDeterministicObligationService, createGatewayObligationProvider } from "../services/phase3/intelligence/deterministicObligationService.js";
import { createDeadlineIntelligenceService, createGatewayDeadlineProvider } from "../services/phase3/intelligence/deadlineIntelligenceService.js";
import { createContractRiskIntelligenceService, createGatewayRiskProvider } from "../services/phase3/intelligence/contractRiskIntelligenceService.js";
import { answerContractQuestion } from "../services/phase3/intelligence/contractAssistantService.js";
import { createContractIntelligencePipeline } from "../services/phase3/analysis/contractIntelligencePipeline.js";
import { aiGateway } from "../services/ai/aiGateway.js";
import { assertOrganizationScope, assertResourceId } from "../repositories/phase3/scope.js";
import supabase from "../config/supabase.js";

const router = express.Router();

function normalizeAnalysisRunError(error) {
  return {
    success: false,
    code: error.code || "STORAGE_ERROR",
    error: error.message || "Analysis run request failed",
  };
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

async function resolveAnalysisRunScope({ organizationId, analysisRunId, analysisRunRepository, documentVersionResolver }) {
  assertOrganizationScope(organizationId);
  assertResourceId(analysisRunId, "analysisRunId");
  const analysisRun = await analysisRunRepository.getById(analysisRunId, organizationId);
  if (!analysisRun || analysisRun.organization_id !== organizationId) {
    throw Object.assign(new Error("Analysis run not found"), { code: "ANALYSIS_RUN_NOT_FOUND", status: 404 });
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
  return (await deadlineRepository.listByRunScope(scope)).map(sanitizeDeadline);
}

export async function readAnalysisRunRisks({
  organizationId,
  analysisRunId,
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
  return (await riskRepository.listByRunScope(scope)).map(sanitizeRisk);
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
  return answerContractQuestion({ question, clauses, obligations, deadlines, risks, evidence });
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

router.post("/:id/process", requireOrganizationPermission("contract:write"), runContractIntelligence);
router.post("/:id/retry", requireOrganizationPermission("contract:write"), runContractIntelligence);

router.get("/:id/profile", async (req, res) => {
  try {
    const profile = await readAnalysisRunProfile({ organizationId: req.organization.id, analysisRunId: req.params.id });
    return res.json({ success: true, profile });
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

router.post("/:id/clauses/analyze", requireOrganizationPermission("contract:write"), async (req, res) => {
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

router.post("/:id/obligations/analyze", requireOrganizationPermission("contract:write"), async (req, res) => {
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

router.post("/:id/deadlines/analyze", requireOrganizationPermission("contract:write"), async (req, res) => {
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

router.post("/:id/risks/analyze", requireOrganizationPermission("contract:write"), async (req, res) => {
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
    });
    return res.json({ success: true, assistant });
  } catch (error) {
    return res.status(error.status || 404).json(normalizeAnalysisRunError(error));
  }
});

export default router;
