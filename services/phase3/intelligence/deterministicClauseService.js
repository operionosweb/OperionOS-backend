import crypto from "node:crypto";

import { CLAUSE_CATEGORIES } from "../../../domain/contractIntelligence/enums.js";
import { createClauseRepository } from "../../../repositories/phase3/clauseRepository.js";
import { createEvidenceRepository } from "../../../repositories/phase3/evidenceRepository.js";
import { assertOrganizationScope, assertResourceId } from "../../../repositories/phase3/scope.js";
import { createDocumentVersionSourceService } from "../source/documentVersionSourceService.js";

const PIPELINE_VERSION = "phase3b-deterministic-clause-v1";
const ACTIVE_ANALYSIS_STATES = new Set(["extracting", "analysing"]);

const CATEGORY_RULES = [
  ["commercial/payment", ["payment", "payments", "invoice", "rent", "fee", "price"]],
  ["pricing/escalation", ["escalation", "price adjustment", "indexation", "index"]],
  ["maintenance", ["maintenance", "repair", "inspection", "airworthy", "airworthiness"]],
  ["delivery/redelivery", ["delivery", "redelivery", "return condition", "acceptance"]],
  ["insurance", ["insurance", "coverage", "insured"]],
  ["liability/indemnity", ["liability", "indemnity", "indemnification", "hold harmless"]],
  ["termination/default", ["termination", "default", "cancellation", "cancel"]],
  ["compliance/sanctions", ["compliance", "sanctions", "faa", "easa", "regulatory"]],
  ["operations/service levels", ["service level", "availability", "operation", "dispatch", "turnaround"]],
  ["confidentiality/data protection", ["confidential", "data protection", "privacy", "gdpr"]],
  ["renewal/notice", ["renewal", "notice period", "notice"]],
  ["governing law/dispute resolution", ["governing law", "jurisdiction", "arbitration", "dispute"]],
];

const SENTENCE_STARTERS = new Set([
  "on",
  "in",
  "the",
  "this",
  "that",
  "these",
  "those",
  "for",
  "with",
  "without",
  "unless",
  "if",
  "when",
  "whereas",
  "subject",
  "pursuant",
  "upon",
  "during",
  "after",
  "before",
  "provided",
  "except",
  "notwithstanding",
]);

function clauseError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function splitLines(text) {
  const lines = [];
  let start = 0;
  const matcher = /.*(?:\r\n|\n|\r|$)/g;
  let match;

  while ((match = matcher.exec(text)) !== null) {
    if (match[0].length === 0) break;
    const raw = match[0];
    const content = raw.replace(/(?:\r\n|\n|\r)$/, "");
    lines.push({ raw, content, start, end: start + raw.length });
    start += raw.length;
  }

  return lines;
}

function isTitleCaseHeading(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const stopWords = new Set(["and", "or", "the", "of", "to", "for", "in", "on"]);
  return words.length > 0 && words.length <= 12 && words.every((word) => {
    if (stopWords.has(word.toLowerCase())) return true;
    return /^[A-Z][A-Za-z0-9/&(),'-]*$/.test(word);
  });
}

function isDateOrMonetaryText(text) {
  return /^(?:\d{1,4}[./-]\d{1,2}[./-]\d{2,4}|\d{4}\.\s+|(?:EUR|USD|GBP|CAD|JPY|AUD|CHF|SEK|NOK|DKK|HKD|CNY|SGD)\s*\d[\d,\.]*\s*(?:million|billion|thousand|k|m)?|\d+(?:[.,]\d+)?%|\d+(?:[.,]\d+)?\s*(?:million|billion|thousand|k|m))$/i.test(text);
}

function isLikelyHeadingText(text, fullLine = "") {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 120) return false;
  if (/[.;!?]$/.test(trimmed)) return false;
  if (isDateOrMonetaryText(trimmed)) return false;
  if (/\b(shall|may|must|will|is|are|was|were|provide|provides|include|includes|requires|required|have|has|be)\b/i.test(trimmed)) return false;
  if (SENTENCE_STARTERS.has(trimmed.split(/\s+/)[0].toLowerCase())) return false;
  if (/^\d+\.?\d*%?$/i.test(trimmed)) return false;
  if (/\bsection\s+\d+(?:\.\d+)*\b/i.test(trimmed)) return false;
  if (/^\d+(?:\.|\))\s+/.test(fullLine) && !/^[A-Z][A-Za-z0-9'\-()/& ]+$/.test(trimmed)) return false;
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (!letters) return false;
  return letters === letters.toUpperCase() || isTitleCaseHeading(trimmed);
}

function isUnnumberedHeading(text, nextLineText = "") {
  if (!text || text.length > 120 || text.split(/\s+/).length > 12) return false;
  if (/[.;,]$/.test(text)) return false;
  if (isDateOrMonetaryText(text)) return false;
  if (SENTENCE_STARTERS.has(text.split(/\s+/)[0].toLowerCase())) return false;
  if (/\b(shall|may|must|will|is|are|was|were|provide|provides|include|includes|requires|required)\b/i.test(text)) return false;

  const uppercaseOnly = text === text.toUpperCase() && /[A-Za-z]/.test(text);
  if (nextLineText && /^[A-Z][a-z].*\b(shall|may|must|will|is|are|was|were)\b/i.test(nextLineText) && !uppercaseOnly) {
    return false;
  }

  const letters = text.replace(/[^A-Za-z]/g, "");
  if (!letters) return false;
  return uppercaseOnly || letters === letters.toUpperCase() || isTitleCaseHeading(text);
}

function canonicalizeClauseNumber(raw) {
  const normalized = String(raw || "").trim();
  if (!normalized) return null;
  const match = normalized.match(/^(?:ARTICLE|SECTION)?\s*(\d+(?:\.\d+)*)$/i);
  if (match) return match[1];
  return normalized;
}

export function resolveParentClauseNumber(clauseNumber, knownNumbers) {
  const canonical = canonicalizeClauseNumber(clauseNumber);
  if (!canonical) return null;
  const parts = canonical.split(".").map(Number);
  if (parts.length <= 1) return null;
  parts.pop();
  const parent = parts.join(".");
  return knownNumbers.has(parent) ? parent : null;
}

function assignClauseIdsAndParents(segments) {
  const clauseIdsByNumber = new Map();
  segments.forEach((segment) => {
    segment.id = crypto.randomUUID();
    if (segment.clause_number) {
      clauseIdsByNumber.set(canonicalizeClauseNumber(segment.clause_number), segment.id);
    }
  });

  segments.forEach((segment) => {
    segment.parent_clause_id = segment.parent_clause_number
      ? clauseIdsByNumber.get(canonicalizeClauseNumber(segment.parent_clause_number)) || null
      : null;
  });

  return segments;
}

export function computeClauseIdentity({ clauseNumber, title, sourceText, charStart, charEnd, organizationId, documentVersionId, analysisRunId }) {
  const identitySource = [
    organizationId,
    documentVersionId,
    analysisRunId,
    clauseNumber || "",
    title || "",
    sourceText || "",
    String(charStart ?? ""),
    String(charEnd ?? ""),
  ].join("|");
  return crypto.createHash("sha256").update(identitySource).digest("hex");
}

function resolveParentMapping(segments) {
  const numberedSegments = segments
    .filter((segment) => segment.clause_number)
    .map((segment) => ({
      clauseNumber: canonicalizeClauseNumber(segment.clause_number),
      clauseId: segment.clause_id,
    }))
    .filter((item) => item.clauseNumber);

  const clauseIdsByNumber = new Map(numberedSegments.map((item) => [item.clauseNumber, item.clauseId]));

  return segments.map((segment) => {
    if (!segment.clause_number) return { ...segment, parent_clause_id: null };
    const clauseNumber = canonicalizeClauseNumber(segment.clause_number);
    const parts = clauseNumber.split(".").map(Number);
    if (parts.length <= 1) return { ...segment, parent_clause_id: null };
    parts.pop();
    const parentNumber = parts.join(".");
    return {
      ...segment,
      parent_clause_id: clauseIdsByNumber.get(parentNumber) || null,
    };
  });
}

function detectHeading(line, nextLineText = "") {
  const text = line.content.trim();
  if (!text) return null;

  const articleOrSection = text.match(/^(ARTICLE|SECTION)\s+(\d+(?:\.\d+)*)\s*(?:[-:—)]\s*|\s+)?(.*)$/i);
  if (articleOrSection) {
    const prefix = articleOrSection[1].toUpperCase();
    const number = articleOrSection[2];
    const title = articleOrSection[3]?.trim() || `${prefix} ${number}`;
    if (!title || !isLikelyHeadingText(title, text)) {
      return null;
    }
    return {
      number,
      title,
      structure: prefix.toLowerCase(),
    };
  }

  const numbered = text.match(/^(\d+(?:\.\d+)*)\s*(?:[-:.)]\s*|\s+)(.*)$/);
  if (numbered) {
    const number = numbered[1];
    const title = numbered[2]?.trim();
    if (!title) {
      return {
        number,
        title: number,
        structure: "numbered_heading",
      };
    }
    if (!isLikelyHeadingText(title, text)) {
      return null;
    }
    return {
      number,
      title,
      structure: "numbered_heading",
    };
  }

  if (isUnnumberedHeading(text, nextLineText)) {
    return {
      number: null,
      title: text,
      structure: "unnumbered_heading",
    };
  }

  return null;
}

function classifyCategory(text) {
  const normalized = text.toLowerCase();
  const match = CATEGORY_RULES.find(([, keywords]) =>
    keywords.some((keyword) => normalized.includes(keyword))
  );
  return match?.[0] || "general";
}

function buildSegment({ source, start, end, heading, parentClauseNumber = null, isUnstructured = false }) {
  const sourceText = source.text.slice(start, end);
  const sourcePage = source.pageBoundaries === "explicit"
    ? source.pages?.find((page) => start >= page.char_start && start <= page.char_end)
    : null;
  const category = classifyCategory(`${heading.title}\n${sourceText}`);
  const numbered = Boolean(heading.number);
  const confidence = isUnstructured ? 0.35 : category === "general" ? 0.45 : numbered ? 0.85 : 0.65;
  const reviewStatus = isUnstructured || category === "general" || !numbered ? "requires_review" : "pending";
  const clauseNumber = heading.number || null;

  return {
    organization_id: source.organizationId,
    contract_id: source.contractId,
    document_id: source.documentId,
    document_version_id: source.documentVersionId,
    analysis_run_id: source.analysisRunId,
    clause_number: clauseNumber,
    parent_clause_number: parentClauseNumber,
    parent_clause_id: null,
    title: heading.title,
    category,
    subtype: heading.structure,
    source_text: sourceText,
    confidence,
    review_status: reviewStatus,
    clause_identity: computeClauseIdentity({
      clauseNumber,
      title: heading.title,
      sourceText,
      charStart: start,
      charEnd: end,
      organizationId: source.organizationId,
      documentVersionId: source.documentVersionId,
      analysisRunId: source.analysisRunId,
    }),
    evidence: {
      organization_id: source.organizationId,
      contract_id: source.contractId,
      document_id: source.documentId,
      document_version_id: source.documentVersionId,
      analysis_run_id: source.analysisRunId,
      page_id: sourcePage?.id || null,
      page_number: sourcePage?.page_number || null,
      excerpt: sourceText,
      char_start: start,
      char_end: end,
      source_locator: source.sourceLocator(start, end),
      stage: "deterministic_clause_segmentation",
      provider: null,
      model: null,
      prompt_version: null,
      pipeline_version: PIPELINE_VERSION,
      confidence,
      review_status: reviewStatus,
      ambiguity_reason: source.pageBoundaries === "derived_unavailable"
        ? "Original PDF page boundaries were not persisted by Phase 2; the clause evidence uses canonical derived source provenance"
        : null,
      evidence_hash: crypto.createHash("sha256").update(sourceText).digest("hex"),
    },
  };
}

export function segmentDeterministicClauses(source) {
  if (!source || typeof source.text !== "string" || source.text.length === 0) {
    throw clauseError("SOURCE_TEXT_UNAVAILABLE", "Source text is required", 422);
  }

  const lines = splitLines(source.text);
  const entries = lines.map((line, index) => ({
    line,
    nextLineText: lines[index + 1]?.content || "",
    heading: detectHeading(line, lines[index + 1]?.content || ""),
  })).filter((entry) => entry.heading);

  if (!entries.length) {
    return assignClauseIdsAndParents([buildSegment({
      source,
      start: 0,
      end: source.text.length,
      heading: {
        number: null,
        title: "Unstructured clause content",
        structure: "unstructured",
      },
      isUnstructured: true,
    })]);
  }

  const segments = [];
  const firstStart = entries[0].line.start;
  if (source.text.slice(0, firstStart).trim()) {
    segments.push(buildSegment({
      source,
      start: 0,
      end: firstStart,
      heading: {
        number: null,
        title: "Preamble",
        structure: "preamble",
      },
    }));
  }

  entries.forEach((entry, index) => {
    const start = entry.line.start;
    const end = entries[index + 1]?.line.start || source.text.length;
    segments.push(buildSegment({
      source,
      start,
      end,
      heading: entry.heading,
    }));
  });

  const knownNumbers = new Set(
    segments
      .map((segment) => canonicalizeClauseNumber(segment.clause_number))
      .filter(Boolean)
  );

  segments.forEach((segment) => {
    segment.parent_clause_number = resolveParentClauseNumber(segment.clause_number, knownNumbers);
  });

  return assignClauseIdsAndParents(segments);
}

export async function runDeterministicClauseStage({
  documentVersionId,
  analysisRunId,
  organizationId,
  sourceService = createDocumentVersionSourceService(),
  clauseRepository = createClauseRepository(),
  evidenceRepository = createEvidenceRepository(),
}) {
  assertResourceId(documentVersionId, "documentVersionId");
  assertResourceId(analysisRunId, "analysisRunId");
  assertOrganizationScope(organizationId);

  const source = await sourceService.load({
    documentVersionId,
    analysisRunId,
    organizationId,
  });

  if (!source.analysisRun) {
    source.analysisRun = { status: "extracting" };
  }

  if (!ACTIVE_ANALYSIS_STATES.has(source.analysisRun.status)) {
    throw clauseError(
      "ANALYSIS_RUN_STAGE_NOT_READY",
      "AnalysisRun must be extracting or analysing for deterministic clause processing",
      409
    );
  }

  const existing = await clauseRepository.listByRun({
    organizationId,
    documentVersionId,
    analysisRunId,
  });
  if (existing.length) {
    return {
      status: "already_processed",
      clauses: existing,
      evidence: [],
      clauseEvidence: [],
      pipelineVersion: PIPELINE_VERSION,
    };
  }

  const segmentPlan = segmentDeterministicClauses(source);
  const insertRows = segmentPlan.map(({ evidence: _evidence, ...clause }) => ({
    ...clause,
    clause_identity: clause.clause_identity,
  }));

  const result = await clauseRepository.persistDeterministicClauseStage({
    organizationId,
    contractId: source.contractId,
    documentId: source.documentId,
    documentVersionId,
    analysisRunId,
    clauses: insertRows,
    evidenceRows: segmentPlan.map((segment) => segment.evidence),
  });

  if (!result?.clauses || result.clauses.length !== segmentPlan.length) {
    throw clauseError("CLAUSE_PERSISTENCE_FAILED", "Not all deterministic clauses were persisted", 503);
  }

  if (!result?.evidence || result.evidence.length !== segmentPlan.length) {
    throw clauseError("CLAUSE_EVIDENCE_PERSISTENCE_FAILED", "Clause evidence was not persisted", 503);
  }

  return {
    status: "clauses_persisted",
    clauses: result.clauses,
    evidence: result.evidence,
    clauseEvidence: result.clauseEvidence || [],
    pipelineVersion: PIPELINE_VERSION,
    pageBoundaries: source.pageBoundaries,
  };
}

export const deterministicClauseConstants = Object.freeze({
  pipelineVersion: PIPELINE_VERSION,
  taxonomy: [...CLAUSE_CATEGORIES],
});
