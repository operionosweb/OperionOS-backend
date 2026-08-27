import crypto from "node:crypto";
import { z } from "zod";

import { createObligationRepository } from "../../../repositories/phase3/obligationRepository.js";
import { assertOrganizationScope, assertResourceId } from "../../../repositories/phase3/scope.js";
import { createDocumentVersionSourceService } from "../source/documentVersionSourceService.js";
import { aiGateway } from "../../ai/aiGateway.js";

const PIPELINE_VERSION = "phase3c-obligation-foundation-v1";
const OBLIGATION_TAXONOMY_VERSION = "aviation-obligations-v1";
const OBLIGATION_PROMPT_VERSION = "obligation-semantic-prompt-v1";
const OBLIGATION_SCHEMA_VERSION = "phase3-obligation-semantic-v1";
const ACTIVE_ANALYSIS_STATES = new Set(["extracting", "analysing", "indexing", "completed"]);
const DEFAULT_PROVIDER_TIMEOUT_MS = 5000;
const DEFAULT_PROVIDER_MAX_RETRIES = 1;

const OBLIGATION_TYPE_VALUES = [
  "payment",
  "maintenance",
  "insurance",
  "compliance",
  "termination",
  "notification",
  "delivery",
  "redelivery",
  "service_level",
  "other",
];

const ProviderOutputSchema = z.object({
  description: z.string().trim().min(1),
  obligation_type: z.enum(OBLIGATION_TYPE_VALUES),
  trigger_expression: z.string().trim().min(1).optional(),
  conditionality: z.string().trim().min(1).optional(),
  frequency: z.string().trim().min(1).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["identified", "requires_review", "active", "unclear"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  review_status: z.enum(["pending", "verified", "requires_review", "rejected"]).optional(),
  actor: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  object: z.string().trim().min(1).optional(),
  beneficiary: z.string().trim().min(1).optional(),
  condition: z.string().trim().min(1).optional(),
  timing_expression: z.string().trim().min(1).optional(),
  consequence: z.string().trim().min(1).optional(),
  modality: z.enum(["mandatory", "prohibited", "discretionary", "conditional"]).optional(),
}).strict();

function stageError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeObligationDescription(value) {
  return normalizeWhitespace(value).toLowerCase();
}

function extractParty(text) {
  return text.match(/\b(lessor|lessee|airline|mro provider|supplier|airport|ground handler|manufacturer|insurer)\b/i)?.[1] || null;
}

function extractAction(text) {
  return text.match(/\b(pay|reimburse|fund|maintain|inspect|repair|overhaul|provide|operate|comply|obtain|notify|report|deliver|accept|redeliver|indemnify|cooperate|obtain consent)\b/i)?.[1] || null;
}

function extractObject(text, action) {
  if (!action) return null;
  const match = text.match(new RegExp(`\\b${action}\\b(?:\\s+the)?\\s+([^,.]+)`, "i"));
  return match?.[1]?.trim() || null;
}

function extractTiming(text) {
  return text.match(/\b(within\s+\d+\s+(?:business\s+)?days?|before\s+[^,.]+|upon\s+[^,.]+|no later than\s+[^,.]+)/i)?.[0] || null;
}

function extractFrequency(text) {
  return text.match(/\b(monthly|quarterly|annually|weekly|daily|recurring|each\s+(?:month|quarter|year))\b/i)?.[1] || null;
}

function extractCondition(text) {
  return text.match(/\b(if|unless|provided that|when)\b[^.]+/i)?.[0] || null;
}

function extractConsequence(text) {
  return text.match(/\b(default|penalty|terminate|termination|indemnif\w*|loss of right)\b[^.]*?/i)?.[0] || null;
}

export function canonicalizeObligationIdentityPayload({
  organizationId,
  analysisRunId,
  clauseId,
  obligationType,
  description,
}) {
  return [
    organizationId,
    analysisRunId,
    clauseId,
    obligationType,
    normalizeObligationDescription(description),
  ].join("|");
}

export function computeObligationIdentity(input) {
  return crypto
    .createHash("sha256")
    .update(canonicalizeObligationIdentityPayload(input))
    .digest("hex");
}

export function createGatewayObligationProvider({ gateway = aiGateway, confirmation = false, metrics = {} } = {}) {
  return {
    async analyzeStructured(payload) {
      metrics.requests = (metrics.requests || 0) + 1;
      const result = await gateway.request({
        organizationId: payload.organization_id,
        userId: payload.user_id || null,
        operation: "obligation_reasoning",
        input: JSON.stringify(payload),
        confirmation,
        structured: true,
        system: "Return one structured obligation object. Preserve mandatory, prohibited, discretionary, and conditional meaning. Do not invent source references.",
      });
      metrics.estimatedIntelligence = (metrics.estimatedIntelligence || 0) + Number(result.estimatedIntelligence || result.job?.estimatedIntelligence || 0);
      if (result.source === "cache") metrics.cacheHits = (metrics.cacheHits || 0) + 1;
      else if (result.source === "provider") metrics.cacheMisses = (metrics.cacheMisses || 0) + 1;
      metrics.actualIntelligence = (metrics.actualIntelligence || 0) + Number(result.job?.actualIntelligence || 0);
      if (!result.success || result.result === undefined) {
        throw stageError(result.code || "AI_REQUEST_BLOCKED", "Obligation analysis was not completed", 409);
      }
      return { output: result.result };
    },
  };
}

function detectObligationType(text) {
  const lower = text.toLowerCase();

  if (/\b(pay|payment|fee|rent|tax|reimburse|invoice)\b/.test(lower)) return "payment";
  if (/\b(maintain|maintenance|repair|service|inspect|inspection|airworthy)\b/.test(lower)) return "maintenance";
  if (/\b(insurance|insured|coverage)\b/.test(lower)) return "insurance";
  if (/\b(compliance|comply|regulation|sanction|law)\b/.test(lower)) return "compliance";
  if (/\b(terminate|termination|default|cancel)\b/.test(lower)) return "termination";
  if (/\b(notice|notify|notification)\b/.test(lower)) return "notification";
  if (/\b(deliver|delivery|acceptance)\b/.test(lower)) return "delivery";
  if (/\b(redeliver|redelivery|return condition|return the aircraft)\b/.test(lower)) return "redelivery";
  if (/\b(service level|availability|uptime|response time)\b/.test(lower)) return "service_level";

  return "other";
}

function extractObligationSentence(sourceText) {
  const cleaned = normalizeWhitespace(sourceText);
  if (!cleaned) return null;

  const obligationSignal = /\b(shall|must|required to|is required to|agree to|agrees to|will)\b/i;
  if (!obligationSignal.test(cleaned)) return null;

  const parts = cleaned
    .split(/(?<=[.;!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const match = parts.find((part) => obligationSignal.test(part));
  return normalizeWhitespace(match || cleaned);
}

export function buildDeterministicObligationCandidate(clause) {
  const sourceText = clause.source_text || "";
  const description = extractObligationSentence(sourceText);
  if (!description) return null;
  const actor = extractParty(description);
  const action = extractAction(description);

  return {
    description,
    obligation_type: detectObligationType(description),
    actor: actor || undefined,
    action: action || undefined,
    object: extractObject(description, action) || undefined,
    beneficiary: undefined,
    condition: extractCondition(description) || undefined,
    trigger_expression: extractTiming(description) || undefined,
    timing_expression: extractTiming(description) || undefined,
    consequence: extractConsequence(description) || undefined,
    modality: /\b(may|can)\b/i.test(description) ? "discretionary" : /\b(shall not|must not)\b/i.test(description) ? "prohibited" : /\b(if|unless|provided that|when)\b/i.test(description) ? "conditional" : "mandatory",
    frequency: extractFrequency(description) || undefined,
    priority: undefined,
    status: undefined,
    confidence: undefined,
    review_status: undefined,
  };
}

function isTransientProviderFailure(error) {
  return ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "PROVIDER_TIMEOUT"].includes(error?.code);
}

async function withTimeout(promiseFactory, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const error = new Error("Provider request timed out");
      error.code = "PROVIDER_TIMEOUT";
      reject(error);
    }, timeoutMs);

    promiseFactory()
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

async function normalizeWithProvider({
  provider,
  payload,
  timeoutMs,
  maxRetries,
}) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await withTimeout(
        () => provider.analyzeStructured(payload),
        timeoutMs
      );

      const candidate = response?.output ?? response;
      const parsed = ProviderOutputSchema.safeParse(candidate);
      if (!parsed.success) {
        const error = stageError(
          "PROVIDER_OUTPUT_INVALID",
          "Provider output failed schema validation",
          422
        );
        error.issues = parsed.error.issues;
        throw error;
      }

      return parsed.data;
    } catch (error) {
      if (error.code === "PROVIDER_OUTPUT_INVALID") throw error;
      if (attempt >= maxRetries || !isTransientProviderFailure(error)) {
        throw error;
      }
      attempt += 1;
    }
  }

  throw stageError("PROVIDER_FAILED", "Provider normalization failed", 502);
}

function mapEvidenceForObligation(clauseEvidenceLinks, evidenceById) {
  const validLinks = clauseEvidenceLinks
    .filter((link) => evidenceById.has(link.evidence_id))
    .map((link) => ({
      evidence_id: link.evidence_id,
      rank: Number(link.rank || 1),
      support_type: link.support_type || "supports",
      is_primary: Boolean(link.is_primary),
    }));

  if (!validLinks.length) {
    return [];
  }

  if (!validLinks.some((link) => link.is_primary)) {
    validLinks[0].is_primary = true;
  }

  return validLinks;
}

function safeError(error) {
  return {
    code: error?.code || "UNCLASSIFIED",
    status: error?.status || null,
    message: String(error?.message || "error").slice(0, 160),
  };
}

export function createDeterministicObligationService({
  sourceService = createDocumentVersionSourceService(),
  repository = createObligationRepository(),
  provider = null,
  trace = null,
} = {}) {
  const traceSink = typeof trace === "function" ? trace : trace?.onEvent;
  const emit = (event, details = {}) => {
    if (typeof traceSink === "function") {
      traceSink({ event, ...details });
    }
  };

  return {
    async runStage({
      organizationId,
      contractId,
      documentId,
      documentVersionId,
      analysisRunId,
      userId = null,
      useProviderNormalization = false,
      providerTimeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS,
      providerMaxRetries = DEFAULT_PROVIDER_MAX_RETRIES,
    }) {
      assertOrganizationScope(organizationId);
      assertResourceId(contractId, "contractId");
      assertResourceId(documentId, "documentId");
      assertResourceId(documentVersionId, "documentVersionId");
      assertResourceId(analysisRunId, "analysisRunId");

      emit("phase3c_start", {
        organization_id: organizationId,
        document_version_id: documentVersionId,
        analysis_run_id: analysisRunId,
      });

      const startedAt = Date.now();

      try {
        const source = await sourceService.load({
          organizationId,
          documentVersionId,
          analysisRunId,
        });

        if (!source.analysisRun) {
          source.analysisRun = { status: "analysing", pipeline_version: null };
        }

        if (source.contractId !== contractId || source.documentId !== documentId) {
          throw stageError("SCOPE_MISMATCH", "Requested scope does not match analysis run source resolution", 409);
        }

        if (!source.analysisRun || !ACTIVE_ANALYSIS_STATES.has(source.analysisRun.status)) {
          throw stageError("ANALYSIS_RUN_STAGE_NOT_READY", "AnalysisRun is not ready for Phase 3C extraction", 409);
        }

        emit("input_resolution", {
          organization_id: organizationId,
          contract_id: contractId,
          document_id: documentId,
          document_version_id: documentVersionId,
          analysis_run_id: analysisRunId,
          analysis_status: source.analysisRun.status,
          pipeline_version: source.analysisRun.pipeline_version || null,
        });

        const clauses = await repository.listClausesByRunScope({
          organizationId,
          contractId,
          documentId,
          documentVersionId,
          analysisRunId,
        });

        emit("clause_load", {
          organization_id: organizationId,
          analysis_run_id: analysisRunId,
          clause_count: clauses.length,
          clause_ids: clauses.slice(0, 64).map((row) => row.id),
        });

        if (!clauses.length) {
          emit("phase3c_summary", {
            organization_id: organizationId,
            analysis_run_id: analysisRunId,
            status: "no_clauses",
            obligation_count: 0,
            evidence_link_count: 0,
            duration_ms: Date.now() - startedAt,
          });
          emit("cleanup", { status: "not_required" });
          return {
            status: "no_clauses",
            obligations: [],
            obligationEvidence: [],
            pipelineVersion: PIPELINE_VERSION,
            analysedClauses: 0,
          };
        }

        const clauseEvidence = await repository.listClauseEvidenceLinks({
          organizationId,
          clauseIds: clauses.map((row) => row.id),
        });

        const evidenceIds = [...new Set(clauseEvidence.map((row) => row.evidence_id))];
        const evidenceRows = await repository.listEvidenceByScopeAndIds({
          organizationId,
          contractId,
          documentId,
          documentVersionId,
          analysisRunId,
          evidenceIds,
        });

        const evidenceById = new Map(evidenceRows.map((row) => [row.id, row]));

        emit("evidence_load", {
          organization_id: organizationId,
          analysis_run_id: analysisRunId,
          clause_evidence_count: clauseEvidence.length,
          evidence_count: evidenceRows.length,
          evidence_ids: evidenceRows.slice(0, 128).map((row) => row.id),
        });

        const linksByClauseId = new Map();
        for (const row of clauseEvidence) {
          if (!linksByClauseId.has(row.clause_id)) linksByClauseId.set(row.clause_id, []);
          linksByClauseId.get(row.clause_id).push(row);
        }

        emit("extraction_start", {
          organization_id: organizationId,
          analysis_run_id: analysisRunId,
          clause_count: clauses.length,
          provider_enabled: Boolean(useProviderNormalization && provider),
        });

        const obligations = [];
        let analysedClauses = 0;
        const obligationEvidenceByIdentity = new Map();

        for (const clause of clauses) {
          const clauseLinks = linksByClauseId.get(clause.id) || [];
          const deterministicCandidate = buildDeterministicObligationCandidate(clause);
          if (!deterministicCandidate) continue;
          analysedClauses += 1;

          if (!clauseLinks.length) {
            throw stageError(
              "OBLIGATION_EVIDENCE_REQUIRED",
              `Clause ${clause.id} produced an obligation candidate without clause evidence`,
              422
            );
          }

          const evidenceLinks = mapEvidenceForObligation(clauseLinks, evidenceById);
          if (!evidenceLinks.length) {
            throw stageError(
              "CLAUSE_EVIDENCE_SCOPE_MISMATCH",
              `Clause ${clause.id} evidence does not resolve in the requested scope`,
              422
            );
          }

          for (const link of evidenceLinks) {
            const evidence = evidenceById.get(link.evidence_id);
            if (!evidence || typeof evidence.excerpt !== "string" || evidence.excerpt.trim().length === 0) {
              throw stageError("EVIDENCE_INVALID", "Evidence excerpt must be non-empty and scope-valid", 422);
            }
          }

          let normalized = deterministicCandidate;

          if (useProviderNormalization) {
            if (!provider || typeof provider.analyzeStructured !== "function") {
              throw stageError("PROVIDER_NOT_CONFIGURED", "Provider normalization requested but provider is unavailable", 422);
            }

            emit("provider_request_metadata", {
              organization_id: organizationId,
              user_id: userId,
              taxonomy_version: OBLIGATION_TAXONOMY_VERSION,
              prompt_version: OBLIGATION_PROMPT_VERSION,
              schema_version: OBLIGATION_SCHEMA_VERSION,
              analysis_run_id: analysisRunId,
              clause_id: clause.id,
              timeout_ms: providerTimeoutMs,
              max_retries: providerMaxRetries,
            });

            const providerPayload = {
              organization_id: organizationId,
              analysis_run_id: analysisRunId,
              clause_id: clause.id,
              clause_number: clause.clause_number || null,
              clause_title: clause.title,
              clause_text: clause.source_text,
              deterministic_candidate: {
                description: deterministicCandidate.description,
                obligation_type: deterministicCandidate.obligation_type,
              },
              evidence_ids: evidenceLinks.map((link) => link.evidence_id),
            };

            normalized = {
              ...deterministicCandidate,
              ...await normalizeWithProvider({
              provider,
              payload: providerPayload,
              timeoutMs: providerTimeoutMs,
              maxRetries: providerMaxRetries,
              }),
            };
          }

          const parsed = ProviderOutputSchema.safeParse(normalized);
          if (!parsed.success) {
            const validationError = stageError("OBLIGATION_VALIDATION_FAILED", "Obligation candidate validation failed", 422);
            validationError.issues = parsed.error.issues;
            throw validationError;
          }

          const output = parsed.data;
          const description = normalizeWhitespace(output.description);
          const obligationType = output.obligation_type;
          const obligationIdentity = computeObligationIdentity({
            organizationId,
            analysisRunId,
            clauseId: clause.id,
            obligationType,
            description,
          });

          obligations.push({
            organization_id: organizationId,
            contract_id: contractId,
            document_id: documentId,
            document_version_id: documentVersionId,
            analysis_run_id: analysisRunId,
            clause_id: clause.id,
            description,
            obligation_type: obligationType,
            trigger_expression: output.trigger_expression || null,
            conditionality: output.conditionality || null,
            frequency: output.frequency || null,
            actor: output.actor || deterministicCandidate.actor || null,
            action: output.action || deterministicCandidate.action || null,
            object: output.object || deterministicCandidate.object || null,
            beneficiary: output.beneficiary || deterministicCandidate.beneficiary || null,
            condition: output.condition || deterministicCandidate.condition || null,
            timing_expression: output.timing_expression || deterministicCandidate.timing_expression || null,
            consequence: output.consequence || deterministicCandidate.consequence || null,
            modality: output.modality || deterministicCandidate.modality || "mandatory",
            priority: output.priority || "medium",
            status: output.status || "identified",
            confidence: output.confidence ?? 0.5,
            review_status: output.review_status || "pending",
            obligation_identity: obligationIdentity,
          });

          obligationEvidenceByIdentity.set(obligationIdentity, evidenceLinks);
        }

        emit("validation_result", {
          organization_id: organizationId,
          analysis_run_id: analysisRunId,
          candidate_count: obligations.length,
          valid_count: obligations.length,
        });

        if (!obligations.length) {
          emit("phase3c_summary", {
            organization_id: organizationId,
            analysis_run_id: analysisRunId,
            status: "no_obligations",
            obligation_count: 0,
            evidence_link_count: 0,
            duration_ms: Date.now() - startedAt,
          });
          emit("cleanup", { status: "not_required" });
          return {
            status: "no_obligations",
            obligations: [],
            obligationEvidence: [],
            pipelineVersion: PIPELINE_VERSION,
            analysedClauses,
          };
        }

        emit("persistence_start", {
          organization_id: organizationId,
          analysis_run_id: analysisRunId,
          obligation_count: obligations.length,
        });

        const persisted = await repository.persistDeterministicObligationStage({
          organizationId,
          contractId,
          documentId,
          documentVersionId,
          analysisRunId,
          obligations,
          obligationEvidenceByIdentity,
        });

        emit("persistence_result", {
          organization_id: organizationId,
          analysis_run_id: analysisRunId,
          inserted_obligations: persisted.insertedObligations,
          inserted_evidence_links: persisted.insertedEvidenceLinks,
          persisted_obligations: persisted.obligations.length,
        });

        const status = persisted.insertedObligations === 0
          ? "already_processed"
          : "obligations_persisted";

        emit("phase3c_summary", {
          organization_id: organizationId,
          analysis_run_id: analysisRunId,
          status,
          obligation_count: persisted.obligations.length,
          evidence_link_count: persisted.obligationEvidence.length,
          duration_ms: Date.now() - startedAt,
        });
        emit("cleanup", { status: "not_required" });

        return {
          status,
          obligations: persisted.obligations,
          obligationEvidence: persisted.obligationEvidence,
          pipelineVersion: PIPELINE_VERSION,
            analysedClauses,
        };
      } catch (error) {
        emit("rollback", {
          organization_id: organizationId,
          analysis_run_id: analysisRunId,
          error: safeError(error),
        });
        emit("phase3c_summary", {
          organization_id: organizationId,
          analysis_run_id: analysisRunId,
          status: "failed",
          error: safeError(error),
          duration_ms: Date.now() - startedAt,
        });
        throw error;
      }
    },
  };
}

export const deterministicObligationConstants = Object.freeze({
  pipelineVersion: PIPELINE_VERSION,
  obligationTypes: [...OBLIGATION_TYPE_VALUES],
});
