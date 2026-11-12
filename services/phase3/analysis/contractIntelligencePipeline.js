import crypto from "node:crypto";

import { createAnalysisRunRepository } from "../../../repositories/phase3/analysisRunRepository.js";
import { createContractProfileRepository } from "../../../repositories/phase3/contractProfileRepository.js";
import { createSearchChunkRepository } from "../../../repositories/phase3/searchChunkRepository.js";
import { createAviationRelationshipRepository } from "../../../repositories/aviation/aviationRelationshipRepository.js";
import { assertOrganizationScope, assertResourceId } from "../../../repositories/phase3/scope.js";
import { runDeterministicClauseStage } from "../intelligence/deterministicClauseService.js";
import { createDeterministicObligationService } from "../intelligence/deterministicObligationService.js";
import { createDeadlineIntelligenceService } from "../intelligence/deadlineIntelligenceService.js";
import { createContractRiskIntelligenceService } from "../intelligence/contractRiskIntelligenceService.js";
import { buildContractProfile } from "../intelligence/contractProfileService.js";
import { createDocumentVersionSourceService } from "../source/documentVersionSourceService.js";
import { assertContractAIApproval, createAIContractAnalysisService } from "../intelligence/aiContractAnalysisService.js";
import { withScopedOperationLock } from "../../scopedOperationLock.js";

export function buildSearchChunks({ scope, clauses, evidence = [] }) {
  const evidenceMap = new Map((evidence || []).filter((row) => row.clause_id).map((row) => [row.clause_id, row]));
  return clauses.filter((clause) => String(clause.source_text || "").trim()).map((clause, index) => {
    const source = evidenceMap.get(clause.id) || clause.evidence?.[0] || null;
    const text = clause.source_text.trim();
    return {
      organization_id: scope.organizationId,
      contract_id: scope.contractId,
      document_id: scope.documentId,
      document_version_id: scope.documentVersionId,
      analysis_run_id: scope.analysisRunId,
      chunk_index: index,
      text_content: text,
      char_start: source?.char_start ?? null,
      char_end: source?.char_end ?? null,
      page_start: source?.page_number ?? null,
      page_end: source?.page_number ?? null,
      text_hash: crypto.createHash("sha256").update(text).digest("hex"),
      index_status: "ready",
    };
  });
}

function withClauseEvidence(clauses, evidence, clauseEvidence = []) {
  const evidenceById = new Map(evidence.map((row) => [row.id, row]));
  const linksByClause = new Map();
  for (const link of clauseEvidence) {
    if (!linksByClause.has(link.clause_id)) linksByClause.set(link.clause_id, []);
    const source = evidenceById.get(link.evidence_id);
    if (source) linksByClause.get(link.clause_id).push(source);
  }
  return clauses.map((clause) => {
    const sources = linksByClause.get(clause.id) || evidence.filter((row) => row.clause_id === clause.id || row.excerpt === clause.source_text);
    return { ...clause, evidence: sources };
  });
}

function relationshipTypeFor(classification) {
  if (classification.status !== "confirmed") return "governed_by";
  const contractType = classification.type;
  if (contractType === "AIRCRAFT_LEASE") return "leased_under";
  if (["MRO", "ENGINE_MAINTENANCE", "POWER_BY_HOUR"].includes(contractType)) return "maintained_under";
  if (contractType === "INSURANCE") return "insured_under";
  if (contractType === "FINANCING") return "financed_under";
  if (["COMPONENT_SUPPORT", "SUPPLIER"].includes(contractType)) return "supported_by";
  return "governed_by";
}

const SAFE_PROCESSING_CODES = new Set([
  "AI_OUTPUT_INVALID",
  "AI_REQUEST_BLOCKED",
  "AI_SOURCE_INCOMPLETE",
  "AI_SOURCE_MISMATCH",
  "AI_SOURCE_TOO_LARGE",
  "AI_SOURCE_UNAVAILABLE",
  "AI_NEW_RUN_REQUIRED",
  "INVALID_STRUCTURED_OUTPUT",
  "PROVIDER_UNAVAILABLE",
  "SOURCE_LOOKUP_FAILED",
  "SOURCE_TEXT_UNAVAILABLE",
]);

function safeProcessingCode(error) {
  return SAFE_PROCESSING_CODES.has(error?.code) ? error.code : "PROCESSING_FAILED";
}

export function createContractIntelligencePipeline({
  analysisRunRepository = createAnalysisRunRepository(),
  profileRepository = createContractProfileRepository(),
  searchRepository = createSearchChunkRepository(),
  sourceService = createDocumentVersionSourceService(),
  clauseStage = runDeterministicClauseStage,
  obligationService = createDeterministicObligationService(),
  deadlineService = createDeadlineIntelligenceService(),
  riskService = createContractRiskIntelligenceService(),
  aviationRelationshipRepository = createAviationRelationshipRepository(),
  aiAnalysisService = createAIContractAnalysisService(),
  assertAIApproval = assertContractAIApproval,
  withLock = withScopedOperationLock,
} = {}) {
  async function runUnlocked({ organizationId, analysisRunId, userId = null, useAI = false, confirmAIBudget = false }, assertLockHeld = () => {}) {
      assertOrganizationScope(organizationId);
      assertResourceId(analysisRunId, "analysisRunId");
      let run = await analysisRunRepository.getById(analysisRunId, organizationId);
      assertLockHeld();
      if (!run) throw Object.assign(new Error("Analysis run not found"), { code: "ANALYSIS_RUN_NOT_FOUND", status: 404 });
      const existingProfile = useAI ? await profileRepository.getByRun({ organizationId, analysisRunId }) : null;
      assertLockHeld();
      if (useAI && existingProfile && existingProfile.metadata?.aiAnalysis?.method !== "ai") {
        throw Object.assign(new Error("Create a new analysis run for AI review; the existing profile is immutable"), { code: "AI_NEW_RUN_REQUIRED", status: 409 });
      }
      if (run.status === "completed") {
        if (useAI && existingProfile?.metadata?.aiAnalysis?.method !== "ai") {
          throw Object.assign(new Error("Create a new analysis run for AI review"), { code: "AI_NEW_RUN_REQUIRED", status: 409 });
        }
        return { status: "already_processed", analysisRun: run, profile: await profileRepository.getByRun({ organizationId, analysisRunId }) };
      }
      if (useAI && run.status !== "queued" && !existingProfile) {
        throw Object.assign(new Error("Review the previous AI attempt and its provider usage before starting another run"), { code: "AI_RETRY_REQUIRES_REVIEW", status: 409 });
      }
      if (run.status !== "queued") {
        throw Object.assign(new Error("The previous analysis must be reviewed before recovery"), { code: "ANALYSIS_RECOVERY_REQUIRED", status: 409 });
      }
      const startedAt = run.started_at || new Date().toISOString();
      const claim = await analysisRunRepository.claimQueued({ analysisRunId, organizationId, startedAt });
      assertLockHeld();
      if (!claim) throw Object.assign(new Error("This analysis has already been claimed"), { code: "ANALYSIS_IN_PROGRESS", status: 409 });
      let fence = claim.fenceContext;
      run = claim.run;
      let pipelineStage = "analysis_run_state";
      let persistenceOperation = "analysisRunRepository.updateStatus";
      try {
        if (run.status === "processing") {
          run = await analysisRunRepository.updateStatus({ analysisRunId, organizationId, status: "extracting", startedAt, fence });
          assertLockHeld();
        }
        pipelineStage = "source_loading";
        persistenceOperation = "documentVersionSourceService.load";
        const source = await sourceService.load({ documentVersionId: run.document_version_id, analysisRunId, organizationId });
        assertLockHeld();
        const scope = {
          organizationId,
          contractId: source.contractId,
          documentId: source.documentId,
          documentVersionId: run.document_version_id,
          analysisRunId,
          fence,
        };
        pipelineStage = "deterministic_clause_stage";
        persistenceOperation = "clauseStage";
        const clauseResult = await clauseStage(scope);
        assertLockHeld();
        if (run.status === "extracting") {
          pipelineStage = "analysis_run_state";
          persistenceOperation = "analysisRunRepository.updateStatus";
          run = await analysisRunRepository.updateStatus({ analysisRunId, organizationId, status: "analysing", startedAt, fence });
          assertLockHeld();
        }
        pipelineStage = "deterministic_obligation_stage";
        persistenceOperation = "obligationService.runStage";
        const obligationResult = await obligationService.runStage({ ...scope, userId, useProviderNormalization: false });
        assertLockHeld();
        pipelineStage = "deterministic_deadline_stage";
        persistenceOperation = "deadlineService.runStage";
        const deadlineResult = await deadlineService.runStage({ ...scope, userId, useAIFallback: false });
        assertLockHeld();
        pipelineStage = "deterministic_risk_stage";
        persistenceOperation = "riskService.runStage";
        const riskResult = await riskService.runStage({ ...scope, userId, useAIFallback: false });
        assertLockHeld();
        const persistedClauses = clauseResult.evidence?.length
          ? withClauseEvidence(clauseResult.clauses || [], clauseResult.evidence, clauseResult.clauseEvidence || [])
          : await profileRepository.listClauseSources({ organizationId, analysisRunId });
        assertLockHeld();
        const evidence = persistedClauses.flatMap((clause) => clause.evidence || []).map((row) => ({ ...row, clause_id: row.clause_id || persistedClauses.find((clause) => clause.evidence?.some((item) => item.id === row.id))?.id }));
        const clauses = persistedClauses;
        const profile = buildContractProfile({
          clauses,
          obligations: obligationResult.obligations || [],
          deadlines: deadlineResult.deadlines || [],
          risks: riskResult.risks || [],
        });
        if (useAI) {
          pipelineStage = "ai_contract_analysis";
          persistenceOperation = "aiAnalysisService.analyze";
          profile.metadata.aiAnalysis = existingProfile?.metadata?.aiAnalysis || await aiAnalysisService.analyze({
            scope, source, clauses, userId, confirmation: confirmAIBudget,
          });
          assertLockHeld();
        }
        pipelineStage = "contract_profile_persistence";
        persistenceOperation = "profileRepository.persist";
        const persistedProfile = await profileRepository.persist({ scope, profile });
        assertLockHeld();
        if (useAI && persistedProfile.metadata?.aiAnalysis?.method !== "ai") {
          throw Object.assign(new Error("Create a new analysis run for AI review; the existing profile is immutable"), { code: "AI_NEW_RUN_REQUIRED", status: 409 });
        }
        pipelineStage = "aviation_relationship_materialization";
        persistenceOperation = "aviationRelationshipRepository.materializeContractRelationships";
        const relationships = await aviationRelationshipRepository.materializeContractRelationships({
          organizationId,
          contractId: scope.contractId,
          analysisRunId,
          fence,
          relationshipType: relationshipTypeFor(profile.classification),
          identifiers: profile.metadata.assetIdentificationReview?.status === "requires_review"
            ? []
            : profile.aircraftIdentifiers,
        });
        assertLockHeld();
        pipelineStage = "analysis_run_state";
        persistenceOperation = "analysisRunRepository.updateStatus";
        run = await analysisRunRepository.updateStatus({ analysisRunId, organizationId, status: "indexing", startedAt, fence });
        assertLockHeld();
        pipelineStage = "search_index_persistence";
        persistenceOperation = "searchRepository.replaceForRun";
        const chunks = buildSearchChunks({ scope, clauses, evidence });
        await searchRepository.replaceForRun({ organizationId, analysisRunId, chunks, fence });
        assertLockHeld();
        pipelineStage = "analysis_run_state";
        persistenceOperation = "analysisRunRepository.updateStatus";
        run = await analysisRunRepository.updateStatus({ analysisRunId, organizationId, status: "completed", startedAt, completedAt: new Date().toISOString(), fence });
        assertLockHeld();
        console.info("contract_intelligence_processing_completed", { organizationId, analysisRunId, contractId: scope.contractId, clauses: clauses.length, obligations: obligationResult.obligations?.length || 0, deadlines: deadlineResult.deadlines?.length || 0, risks: riskResult.risks?.length || 0 });
        return { status: "completed", analysisRun: run, profile: persistedProfile, counts: { clauses: clauses.length, obligations: obligationResult.obligations?.length || 0, deadlines: deadlineResult.deadlines?.length || 0, risks: riskResult.risks?.length || 0, searchChunks: chunks.length, aircraftRelationships: relationships.length } };
      } catch (error) {
        assertLockHeld();
        try {
          await analysisRunRepository.updateStatus({ analysisRunId, organizationId, status: "failed", startedAt, completedAt: new Date().toISOString(), errorCode: safeProcessingCode(error), errorMessage: "Contract intelligence processing failed", fence });
        } catch (statusError) {
          console.error("contract_intelligence_failure_status_update_failed", {
            organizationId,
            analysisRunId,
            processingErrorCode: safeProcessingCode(error),
            statusUpdateErrorCode: "STATUS_UPDATE_FAILED",
          });
        }
        const postgresCode = typeof error.code === "string" && /^[0-9A-Z]{5}$/i.test(error.code) ? error.code : null;
        console.warn("contract_intelligence_processing_failed", {
          organizationId,
          analysisRunId,
          errorCode: safeProcessingCode(error),
          pipelineStage,
          persistenceOperation,
          postgresCode,
        });
        throw error;
      }
  }
  return {
    async run(args) {
      assertOrganizationScope(args.organizationId);
      assertResourceId(args.analysisRunId, "analysisRunId");
      if (args.useAI) {
        assertAIApproval();
        if (!args.confirmAIBudget) throw Object.assign(new Error("Explicit AI budget and data-use confirmation is required"), { code: "AI_CONFIRMATION_REQUIRED", status: 400 });
      }
      return withLock([`analysis-run:${args.organizationId}:${args.analysisRunId}`], (assertLockHeld) => runUnlocked(args, assertLockHeld), { conflictCode: "ANALYSIS_IN_PROGRESS" });
    },
  };
}