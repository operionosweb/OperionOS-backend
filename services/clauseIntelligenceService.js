import crypto from "node:crypto";
import { z } from "zod";

import supabase from "../config/supabase.js";
import { aiGateway } from "./ai/aiGateway.js";
import { CLAUSE_CATEGORIES } from "../domain/contractIntelligence/enums.js";

const PIPELINE_VERSION = "semantic-clause-v1";
const MAX_CANDIDATE_CHUNKS = 12;
const RELEVANCE_TERMS = [
  "shall", "must", "may", "payment", "rent", "fee", "liability", "indemnity",
  "insurance", "maintenance", "termination", "renewal", "notice", "compliance",
  "delivery", "redelivery", "confidential", "data protection", "governing law",
];

const SemanticClauseSchema = z.object({
  clause_number: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  category: z.enum(CLAUSE_CATEGORIES),
  subtype: z.string().trim().min(1).optional(),
  source_chunk_indexes: z.array(z.number().int().nonnegative()).min(1),
  source_text: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
  review_status: z.enum(["pending", "verified", "requires_review", "rejected"]),
}).strict();

export function validateSemanticClauses(result) {
  const clauses = Array.isArray(result) ? result : result?.clauses;
  if (!Array.isArray(clauses)) throw Object.assign(new Error("Provider clause output must contain a clauses array"), { code: "INVALID_SEMANTIC_OUTPUT", status: 502 });
  const parsed = z.array(SemanticClauseSchema).safeParse(clauses);
  if (!parsed.success) throw Object.assign(new Error("Provider clause output failed schema validation"), { code: "INVALID_SEMANTIC_OUTPUT", status: 502 });
  return parsed.data;
}

export function selectRelevantChunks(chunks = [], limit = MAX_CANDIDATE_CHUNKS) {
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError("limit must be a positive integer");
  const ranked = chunks
    .map((chunk, originalIndex) => {
      const text = String(chunk.source_text || "").toLowerCase();
      const score = RELEVANCE_TERMS.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
      return { ...chunk, originalIndex, relevanceScore: score };
    })
    .sort((left, right) => right.relevanceScore - left.relevanceScore || left.chunk_order - right.chunk_order)
  const candidates = ranked.some((chunk) => chunk.relevanceScore > 0)
    ? ranked.filter((chunk) => chunk.relevanceScore > 0)
    : ranked;
  return candidates
    .slice(0, limit)
    .sort((left, right) => left.chunk_order - right.chunk_order);
}

export function buildClauseAnalysisPrompt(chunks) {
  return JSON.stringify({
    task: "Extract semantically meaningful contract clauses from the supplied source chunks.",
    rules: [
      "Return only JSON with a clauses array.",
      "Use source_chunk_indexes to identify every chunk supporting each clause.",
      "Copy source_text from the supplied chunks; do not invent quotations.",
      "Confidence must be between 0 and 1.",
    ],
    chunks: chunks.map((chunk) => ({
      chunk_index: chunk.chunk_order,
      section_id: chunk.section_id,
      page_number: chunk.page_number,
      source_text: chunk.source_text,
    })),
  });
}

function serviceError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function sourceForClause(clause, candidateByIndex) {
  const sources = clause.source_chunk_indexes.map((index) => candidateByIndex.get(index)).filter(Boolean);
  if (sources.length !== clause.source_chunk_indexes.length) throw serviceError("INVALID_SEMANTIC_OUTPUT", "Clause references an unavailable source chunk", 502);
  const first = sources[0];
  const last = sources[sources.length - 1];
  return {
    text: sources.map((source) => source.source_text).join("\n"),
    charStart: first.metadata?.char_start ?? null,
    charEnd: last.metadata?.char_end ?? null,
    locator: `document_version:${first.document_version_id}:chunks:${clause.source_chunk_indexes.join(",")}`,
  };
}

export async function analyzeContractClauses({
  contractId,
  documentVersionId,
  organizationId,
  userId,
  confirmation = false,
  client = supabase,
  gateway = aiGateway,
}) {
  if (!organizationId || !contractId || !documentVersionId || !userId) throw serviceError("INVALID_ANALYSIS_REQUEST", "Analysis scope is incomplete");
  const { data: version, error: versionError } = await client
    .from("document_versions")
    .select("id, document_id, organization_id, contract_id")
    .eq("id", documentVersionId)
    .eq("organization_id", organizationId)
    .eq("contract_id", contractId)
    .maybeSingle();
  if (versionError) throw serviceError("STORAGE_ERROR", "Document version lookup failed", 503);
  if (!version) throw serviceError("DOCUMENT_VERSION_NOT_FOUND", "Document version not found", 404);

  const { data: chunks, error: chunksError } = await client
    .from("contract_document_chunks")
    .select("id, contract_id, document_id, document_version_id, section_id, page_number, chunk_order, source_text, content_hash, metadata")
    .eq("document_version_id", documentVersionId)
    .eq("contract_id", contractId)
    .eq("organization_id", organizationId)
    .order("chunk_order", { ascending: true });
  if (chunksError) throw serviceError("STORAGE_ERROR", "Document chunk lookup failed", 503);

  const candidates = selectRelevantChunks(chunks || []);
  if (!candidates.length) throw serviceError("NO_STRUCTURAL_CANDIDATES", "No structural chunks are available for clause analysis", 409);

  const { data: run, error: runError } = await client.from("analysis_runs").insert({
    organization_id: organizationId,
    contract_id: contractId,
    document_version_id: documentVersionId,
    status: "analysing",
    pipeline_version: PIPELINE_VERSION,
    requested_by: userId,
  }).select("id, status, pipeline_version").single();
  if (runError || !run) throw serviceError("STORAGE_ERROR", "Analysis run creation failed", 503);

  try {
    const gatewayResult = await gateway.request({
      organizationId,
      userId,
      operation: "clause_interpretation",
      input: buildClauseAnalysisPrompt(candidates),
      confirmation,
      system: "You are a contract intelligence system. Return strictly valid JSON matching the requested clause schema.",
    });
    if (!gatewayResult?.success || gatewayResult.result === undefined) {
      throw serviceError(gatewayResult?.code || "AI_REQUEST_BLOCKED", "Clause analysis was not completed", 409);
    }

    const semanticClauses = validateSemanticClauses(gatewayResult.result);
    const candidateByIndex = new Map(candidates.map((candidate) => [candidate.chunk_order, candidate]));
    const clauseRows = semanticClauses.map((clause) => {
      const source = sourceForClause(clause, candidateByIndex);
      const id = crypto.randomUUID();
      return {
        id,
        organization_id: organizationId,
        contract_id: contractId,
        document_id: version.document_id,
        document_version_id: documentVersionId,
        analysis_run_id: run.id,
        clause_number: clause.clause_number || null,
        title: clause.title,
        category: clause.category,
        subtype: clause.subtype || "semantic",
        source_text: source.text || clause.source_text,
        confidence: clause.confidence,
        review_status: clause.review_status,
        clause_identity: crypto.createHash("sha256").update(`${organizationId}|${documentVersionId}|${run.id}|${clause.title}|${source.text}`).digest("hex"),
        source,
      };
    });
    const { error: clauseError } = await client.from("clauses").insert(clauseRows.map(({ source: _ignored, ...row }) => row));
    if (clauseError) throw serviceError("STORAGE_ERROR", "Semantic clause persistence failed", 503);

    const evidenceRows = clauseRows.map((clause) => ({
      id: crypto.randomUUID(),
      organization_id: organizationId,
      contract_id: contractId,
      document_id: version.document_id,
      document_version_id: documentVersionId,
      analysis_run_id: run.id,
      page_id: null,
      page_number: clause.source.charStart === null ? null : candidates.find((candidate) => candidate.metadata?.char_start === clause.source.charStart)?.page_number || null,
      excerpt: clause.source.text,
      char_start: clause.source.charStart,
      char_end: clause.source.charEnd,
      source_locator: clause.source.locator,
      stage: "semantic_clause_analysis",
      provider: gatewayResult.job?.provider || null,
      model: gatewayResult.job?.model || null,
      prompt_version: PIPELINE_VERSION,
      pipeline_version: PIPELINE_VERSION,
      confidence: clause.confidence,
      review_status: clause.review_status,
      ambiguity_reason: null,
      evidence_hash: crypto.createHash("sha256").update(clause.source.text).digest("hex"),
    }));
    const { error: evidenceError } = await client.from("intelligence_evidence").insert(evidenceRows);
    if (evidenceError) throw serviceError("STORAGE_ERROR", "Semantic evidence persistence failed", 503);
    const { error: linkError } = await client.from("clause_evidence").insert(evidenceRows.map((evidence, index) => ({
      organization_id: organizationId,
      clause_id: clauseRows[index].id,
      evidence_id: evidence.id,
      rank: 1,
      support_type: "supports",
      is_primary: true,
    })));
    if (linkError) throw serviceError("STORAGE_ERROR", "Semantic evidence link persistence failed", 503);

    await client.from("analysis_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", run.id).eq("organization_id", organizationId);
    return { analysisRun: { ...run, status: "completed" }, candidates: candidates.length, clauses: clauseRows.length, source: gatewayResult.source };
  } catch (error) {
    await client.from("analysis_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_code: error.code || "SEMANTIC_ANALYSIS_FAILED", error_message: "Clause analysis failed" }).eq("id", run.id).eq("organization_id", organizationId);
    throw error;
  }
}

export const clauseIntelligenceConstants = Object.freeze({ pipelineVersion: PIPELINE_VERSION, maxCandidateChunks: MAX_CANDIDATE_CHUNKS });
