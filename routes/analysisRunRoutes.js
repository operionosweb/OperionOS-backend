import express from "express";

import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireOrganizationMembership } from "../middleware/organizationMiddleware.js";
import { requireOrganizationPermission } from "../middleware/authorizationMiddleware.js";
import { getAnalysisRunById } from "../services/documentIngestionService.js";
import { createAnalysisRunRepository } from "../repositories/phase3/analysisRunRepository.js";
import { createClauseRepository } from "../repositories/phase3/clauseRepository.js";
import { createObligationRepository } from "../repositories/phase3/obligationRepository.js";
import { createDeterministicObligationService, createGatewayObligationProvider } from "../services/phase3/intelligence/deterministicObligationService.js";
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

router.get("/:id/obligations/estimate", requireOrganizationPermission("contract:read"), async (req, res) => {
  try {
    const analysisRun = await getAnalysisRunById(req.params.id, req.organization.id);
    const estimatedIntelligence = aiGateway.estimate("obligation_reasoning", "bounded clause and evidence context");
    return res.json({
      success: true,
      estimatedIntelligence,
      budget: aiGateway.getBudget(req.organization.id),
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
      useProviderNormalization: true,
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

export default router;
