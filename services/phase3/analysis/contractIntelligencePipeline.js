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

function relationshipTypeFor(contractType) {
  if (contractType === "AIRCRAFT_LEASE") return "leased_under";
  if (["MRO", "ENGINE_MAINTENANCE", "POWER_BY_HOUR"].includes(contractType)) return "maintained_under";
  if (contractType === "INSURANCE") return "insured_under";
  if (contractType === "FINANCING") return "financed_under";
  if (["COMPONENT_SUPPORT", "SUPPLIER"].includes(contractType)) return "supported_by";
  return "governed_by";
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
} = {}) {
  return {
    async run({ organizationId, analysisRunId, userId = null }) {
      assertOrganizationScope(organizationId);
      assertResourceId(analysisRunId, "analysisRunId");
      let run = await analysisRunRepository.getById(analysisRunId, organizationId);
      if (!run) throw Object.assign(new Error("Analysis run not found"), { code: "ANALYSIS_RUN_NOT_FOUND", status: 404 });
      if (run.status === "completed") {
        return { status: "already_processed", analysisRun: run, profile: await profileRepository.getByRun({ organizationId, analysisRunId }) };
      }
      const startedAt = run.started_at || new Date().toISOString();
      try {
        if (["queued", "failed"].includes(run.status)) {
          run = await analysisRunRepository.updateStatus({ analysisRunId, organizationId, status: "processing", startedAt });
        }
        if (run.status === "processing") {
          run = await analysisRunRepository.updateStatus({ analysisRunId, organizationId, status: "extracting", startedAt });
        }
        const source = await sourceService.load({ documentVersionId: run.document_version_id, analysisRunId, organizationId });
        const scope = {
          organizationId,
          contractId: source.contractId,
          documentId: source.documentId,
          documentVersionId: run.document_version_id,
          analysisRunId,
        };
        const clauseResult = await clauseStage(scope);
        if (run.status === "extracting") {
          run = await analysisRunRepository.updateStatus({ analysisRunId, organizationId, status: "analysing", startedAt });
        }
        const obligationResult = await obligationService.runStage({ ...scope, userId, useProviderNormalization: false });
        const deadlineResult = await deadlineService.runStage({ ...scope, userId, useAIFallback: false });
        const riskResult = await riskService.runStage({ ...scope, userId, useAIFallback: false });
        const persistedClauses = clauseResult.evidence?.length
          ? withClauseEvidence(clauseResult.clauses || [], clauseResult.evidence, clauseResult.clauseEvidence || [])
          : await profileRepository.listClauseSources({ organizationId, analysisRunId });
        const evidence = persistedClauses.flatMap((clause) => clause.evidence || []).map((row) => ({ ...row, clause_id: row.clause_id || persistedClauses.find((clause) => clause.evidence?.some((item) => item.id === row.id))?.id }));
        const clauses = persistedClauses;
        const profile = buildContractProfile({
          clauses,
          obligations: obligationResult.obligations || [],
          deadlines: deadlineResult.deadlines || [],
          risks: riskResult.risks || [],
        });
        const persistedProfile = await profileRepository.persist({ scope, profile });
        const relationships = await aviationRelationshipRepository.materializeContractRelationships({
          organizationId,
          contractId: scope.contractId,
          relationshipType: relationshipTypeFor(profile.classification.type),
          identifiers: profile.aircraftIdentifiers,
        });
        run = await analysisRunRepository.updateStatus({ analysisRunId, organizationId, status: "indexing", startedAt });
        const chunks = buildSearchChunks({ scope, clauses, evidence });
        await searchRepository.replaceForRun({ organizationId, analysisRunId, chunks });
        run = await analysisRunRepository.updateStatus({ analysisRunId, organizationId, status: "completed", startedAt, completedAt: new Date().toISOString() });
        console.info("contract_intelligence_processing_completed", { organizationId, analysisRunId, contractId: scope.contractId, clauses: clauses.length, obligations: obligationResult.obligations?.length || 0, deadlines: deadlineResult.deadlines?.length || 0, risks: riskResult.risks?.length || 0 });
        return { status: "completed", analysisRun: run, profile: persistedProfile, counts: { clauses: clauses.length, obligations: obligationResult.obligations?.length || 0, deadlines: deadlineResult.deadlines?.length || 0, risks: riskResult.risks?.length || 0, searchChunks: chunks.length, aircraftRelationships: relationships.length } };
      } catch (error) {
        try {
          await analysisRunRepository.updateStatus({ analysisRunId, organizationId, status: "failed", startedAt, completedAt: new Date().toISOString(), errorCode: error.code || "PROCESSING_FAILED", errorMessage: "Contract intelligence processing failed" });
        } catch {}
        console.warn("contract_intelligence_processing_failed", { organizationId, analysisRunId, errorCode: error.code || "PROCESSING_FAILED" });
        throw error;
      }
    },
  };
}