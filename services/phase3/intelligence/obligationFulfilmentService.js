import { assertOrganizationScope, assertResourceId } from "../../../repositories/phase3/scope.js";
import { createAnalysisRunRepository } from "../../../repositories/phase3/analysisRunRepository.js";
import { createObligationRepository } from "../../../repositories/phase3/obligationRepository.js";
import { createDeadlineRepository } from "../../../repositories/phase3/deadlineRepository.js";
import { createObligationFulfilmentRepository } from "../../../repositories/phase3/obligationFulfilmentRepository.js";
import { monitorDeadlines } from "./deadlineMonitoringService.js";
import supabase from "../../../config/supabase.js";

const ASSESSMENT_STATUSES = new Set([
  "pending_evidence",
  "evidence_submitted",
  "under_review",
  "fulfilled",
  "partially_fulfilled",
  "not_fulfilled",
  "disputed",
  "insufficient_evidence",
]);
const EVIDENCE_RELATIONSHIPS = new Set(["supports", "contradicts", "context"]);
const PERIOD_STATUSES = new Set(["matches", "mismatches", "not_assessed"]);
const FINAL_STATUSES = new Set(["fulfilled", "partially_fulfilled", "not_fulfilled", "disputed"]);

function fulfilmentError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function assertFulfilmentId(id, name) {
  try {
    assertResourceId(id, name);
  } catch {
    throw fulfilmentError("FULFILMENT_RESOURCE_ID_INVALID", `${name} must be a valid identifier`);
  }
}

function validateAssessment(input) {
  if (!input || !ASSESSMENT_STATUSES.has(input.status)) {
    throw fulfilmentError("FULFILMENT_STATUS_INVALID", "Select a supported fulfilment review status");
  }
  const explanation = typeof input.explanation === "string" ? input.explanation.trim() : "";
  if (!explanation || explanation.length > 4000) {
    throw fulfilmentError("FULFILMENT_EXPLANATION_INVALID", "Provide a review explanation of up to 4,000 characters");
  }
  if (!Array.isArray(input.evidence) || input.evidence.length > 20) {
    throw fulfilmentError("FULFILMENT_EVIDENCE_INVALID", "Provide no more than 20 evidence references");
  }
  const seen = new Set();
  const evidence = input.evidence.map((item) => {
    assertFulfilmentId(item?.evidenceId, "evidenceId");
    if (seen.has(item.evidenceId)) {
      throw fulfilmentError("FULFILMENT_EVIDENCE_DUPLICATE", "Evidence may only be linked once per assessment");
    }
    seen.add(item.evidenceId);
    if (!EVIDENCE_RELATIONSHIPS.has(item.relationship) || !PERIOD_STATUSES.has(item.periodStatus)) {
      throw fulfilmentError("FULFILMENT_EVIDENCE_REVIEW_INVALID", "Each evidence reference needs a valid relationship and period review");
    }
    const reviewerNote = typeof item.reviewerNote === "string" ? item.reviewerNote.trim() : "";
    if (reviewerNote.length > 1000) {
      throw fulfilmentError("FULFILMENT_EVIDENCE_NOTE_INVALID", "Evidence notes must not exceed 1,000 characters");
    }
    return {
      evidenceId: item.evidenceId,
      relationship: item.relationship,
      periodStatus: item.periodStatus,
      reviewerNote: reviewerNote || null,
    };
  });

  const supporting = evidence.filter((item) => item.relationship === "supports");
  const contradicting = evidence.filter((item) => item.relationship === "contradicts");
  const periodMatched = (items) => items.some((item) => item.periodStatus === "matches");
  if (input.status === "pending_evidence" && evidence.length) {
    throw fulfilmentError("FULFILMENT_EVIDENCE_STATUS_MISMATCH", "Pending-evidence assessments cannot include submitted evidence");
  }
  if (["evidence_submitted", "under_review"].includes(input.status) && !evidence.length) {
    throw fulfilmentError("FULFILMENT_EVIDENCE_REQUIRED", "Submitted or reviewed assessments require at least one evidence reference");
  }
  if (input.status === "fulfilled" && (
    !periodMatched(supporting)
    || supporting.some((item) => item.periodStatus !== "matches")
    || contradicting.length
  )) {
    throw fulfilmentError("FULFILMENT_SUPPORT_INSUFFICIENT", "Fulfilment requires period-matched supporting evidence and no contradictory evidence");
  }
  if (input.status === "partially_fulfilled" && (!periodMatched(supporting) || contradicting.length)) {
    throw fulfilmentError("FULFILMENT_SUPPORT_INSUFFICIENT", "Partial fulfilment requires period-matched supporting evidence and no contradictory evidence; conflicting evidence must be disputed");
  }
  if (input.status === "not_fulfilled" && (!periodMatched(contradicting) || supporting.length)) {
    throw fulfilmentError("FULFILMENT_NEGATIVE_CLAIM_UNSUPPORTED", "A not-fulfilled assessment requires period-matched contradictory evidence and no supporting evidence; absence of evidence is insufficient");
  }
  if (input.status === "disputed" && (!periodMatched(supporting) || !periodMatched(contradicting))) {
    throw fulfilmentError("FULFILMENT_CONFLICT_REQUIRED", "A disputed assessment requires period-matched supporting and contradictory evidence");
  }
  return { status: input.status, explanation, evidence };
}

function recommendationFor(status) {
  switch (status) {
    case "not_assessed":
    case "pending_evidence":
      return "Request the operational evidence specified by the obligation; missing evidence is not proof of non-fulfilment.";
    case "evidence_submitted":
    case "under_review":
      return "Review the evidence content, source, applicable period, and relationship to this obligation.";
    case "fulfilled":
      return "Retain the cited evidence and review future periods separately for recurring obligations.";
    case "partially_fulfilled":
      return "Identify which contractual elements remain unsupported and request the corresponding evidence.";
    case "not_fulfilled":
      return "Escalate this human-reviewed assessment for authorized follow-up; this status is not a legal breach determination.";
    case "disputed":
      return "Reconcile the cited conflicting evidence with the authorized contract and operational owners.";
    default:
      return "Obtain period-matched evidence and have an authorized reviewer assess its relevance.";
  }
}

export function createObligationFulfilmentService({
  analysisRunRepository = createAnalysisRunRepository(),
  obligationRepository = createObligationRepository(),
  deadlineRepository = createDeadlineRepository(),
  fulfilmentRepository = createObligationFulfilmentRepository(),
  documentVersionResolver = async (documentVersionId, organizationId) => {
    const { data, error } = await supabase.from("document_versions")
      .select("id, document_id, organization_id")
      .eq("id", documentVersionId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw fulfilmentError("STORAGE_ERROR", "Document version lookup failed", 503);
    return data || null;
  },
  clock = () => new Date(),
} = {}) {
  async function resolveScope({ organizationId, analysisRunId, obligationId }) {
    assertOrganizationScope(organizationId);
    assertFulfilmentId(analysisRunId, "analysisRunId");
    assertFulfilmentId(obligationId, "obligationId");
    const analysisRun = await analysisRunRepository.getById(analysisRunId, organizationId);
    if (!analysisRun || analysisRun.organization_id !== organizationId) {
      throw fulfilmentError("ANALYSIS_RUN_NOT_FOUND", "Analysis run not found", 404);
    }
    if (analysisRun.status !== "completed") {
      throw fulfilmentError("ANALYSIS_NOT_COMPLETED", "Obligation fulfilment review requires a completed analysis", 422);
    }
    const version = await documentVersionResolver(analysisRun.document_version_id, organizationId);
    if (!version || version.organization_id !== organizationId) {
      throw fulfilmentError("ANALYSIS_RUN_NOT_FOUND", "Analysis run not found", 404);
    }
    const scope = {
      organizationId,
      contractId: analysisRun.contract_id,
      documentId: version.document_id,
      documentVersionId: analysisRun.document_version_id,
      analysisRunId,
    };
    const obligations = await obligationRepository.listByRunScope(scope);
    const obligation = obligations.find((item) => item.id === obligationId
      && item.organization_id === organizationId
      && item.contract_id === scope.contractId
      && item.document_id === scope.documentId
      && item.document_version_id === scope.documentVersionId
      && item.analysis_run_id === analysisRunId);
    if (!obligation) throw fulfilmentError("OBLIGATION_NOT_FOUND", "Obligation not found", 404);
    return { analysisRun, scope, obligation };
  }

  async function buildResult({ scope, obligation }) {
    const [availableEvidence, history, deadlines] = await Promise.all([
      fulfilmentRepository.listAvailableEvidence({
        organizationId: scope.organizationId,
        contractId: scope.contractId,
        excludedDocumentId: scope.documentId,
      }),
      fulfilmentRepository.listByObligation({
        organizationId: scope.organizationId,
        contractId: scope.contractId,
        obligationId: obligation.id,
      }),
      deadlineRepository.listByRunScope(scope),
    ]);
    const latest = history[0] || null;
    const linkedDeadlines = deadlines.filter((deadline) => deadline.obligation_id === obligation.id);
    const monitored = monitorDeadlines(linkedDeadlines, { asOf: clock() });
    const passedDeadline = monitored.find((deadline) => deadline.monitoring.status === "passed");
    return {
      obligationId: obligation.id,
      status: latest?.status || "not_assessed",
      history: history.map((item) => ({
        id: item.id,
        reviewerUserId: item.reviewer_user_id,
        status: item.status,
        explanation: item.explanation,
        createdAt: item.created_at,
        evidence: item.evidence,
      })),
      deadlineMonitoring: monitored.map((deadline) => ({
        id: deadline.id,
        timingExpression: deadline.timing_expression || deadline.original_expression || null,
        absoluteDate: deadline.absolute_date || null,
        status: deadline.monitoring.status,
        daysRemaining: deadline.monitoring.daysRemaining,
        asOf: deadline.monitoring.asOf,
        reviewRequired: deadline.monitoring.reviewRequired,
      })),
      availableEvidence: availableEvidence
        .filter((item) => item.document_id !== scope.documentId)
        .map((item) => ({
          id: item.id,
          documentId: item.document_id,
          documentVersionId: item.document_version_id,
          analysisRunId: item.analysis_run_id,
          documentName: item.document_name,
          versionNumber: item.version_number,
          pageNumber: item.page_number,
          sourceLocator: item.source_locator,
          excerpt: item.excerpt,
          confidence: item.confidence,
          ambiguityReason: item.ambiguity_reason,
          stage: item.stage,
          reviewStatus: item.review_status,
          createdAt: item.created_at,
        })),
      deadlineReviewPrompt: passedDeadline && latest?.status !== "fulfilled"
        ? {
          status: "deadline_passed_fulfilment_unestablished",
          deadlineId: passedDeadline.id,
          asOf: passedDeadline.monitoring.asOf,
          message: "A verified deadline has passed while fulfilment remains unestablished. Escalate for human review; this does not determine breach.",
        }
        : null,
      recommendedAction: recommendationFor(latest?.status || "not_assessed"),
    };
  }

  return {
    async get({ organizationId, analysisRunId, obligationId }) {
      const { scope, obligation } = await resolveScope({ organizationId, analysisRunId, obligationId });
      return buildResult({ scope, obligation });
    },

    async assess({ organizationId, analysisRunId, obligationId, reviewerUserId, input }) {
      const { scope, obligation } = await resolveScope({ organizationId, analysisRunId, obligationId });
      assertFulfilmentId(reviewerUserId, "reviewerUserId");
      const assessment = validateAssessment(input);
      if (FINAL_STATUSES.has(assessment.status)
        && (!obligation.actor?.trim() || !obligation.action?.trim() || !obligation.object?.trim())) {
        throw fulfilmentError("OBLIGATION_INCOMPLETE", "Resolve the obligation actor, action, and object before recording a final fulfilment assessment", 422);
      }
      if (assessment.evidence.length) {
        const available = await fulfilmentRepository.listAvailableEvidence({
          organizationId,
          contractId: scope.contractId,
          excludedDocumentId: scope.documentId,
        });
        const availableIds = new Set(available.map((item) => item.id));
        if (assessment.evidence.some((item) => !availableIds.has(item.evidenceId))) {
          throw fulfilmentError("FULFILMENT_EVIDENCE_SCOPE_INVALID", "Every evidence reference must belong to another document in this contract", 422);
        }
      }
      await fulfilmentRepository.createAssessment({
        organizationId,
        contractId: scope.contractId,
        obligationId: obligation.id,
        reviewerUserId,
        ...assessment,
      });
      return buildResult({ scope, obligation });
    },
  };
}
