import crypto from "node:crypto";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

import supabase from "../config/supabase.js";
import { recordAuditEvent } from "./foundationAuditService.js";
import {
  buildDocumentStorageKey,
  downloadDocumentSource,
  removeDocumentSource,
  uploadDocumentSource,
} from "./documentStorageService.js";
import { parseDocumentStructure, persistDocumentStructure } from "./documentStructureService.js";
import {
  createDocumentOcrProvider,
  localPdfOcrProvider,
} from "./localPdfOcrService.js";

export const MAX_FILE_SIZE = Number(process.env.CONTRACT_UPLOAD_MAX_BYTES || 20 * 1024 * 1024);
const MAX_PERSISTED_TEXT_LENGTH = 1_000_000;
const PIPELINE_VERSION = "ingestion-v1";
const MIN_DIGITAL_PAGE_TEXT_LENGTH = 20;

function appError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function requireOrganizationScope(organizationId) {
  if (!organizationId || typeof organizationId !== "string") {
    throw appError("ORGANIZATION_ACCESS_DENIED", "Organization scope is required", 403);
  }

  return organizationId;
}

function safeLog(event, context, error) {
  console.error("Document ingestion event failed", {
    event,
    request_id: context.requestId,
    organization_id: context.organizationId,
    contract_id: context.contractId || null,
    document_id: context.documentId || null,
    analysis_run_id: context.analysisRunId || null,
    error_code: error?.code || "AUDIT_ERROR",
  });
}

async function audit(event, context, metadata = {}) {
  try {
    await recordAuditEvent({
      organizationId: context.organizationId,
      actorId: context.userId,
      requestId: context.requestId,
      action: event,
      entityType: context.entityType || "contract_ingestion",
      entityId:
        context.analysisRunId ||
        context.documentVersionId ||
        context.documentId ||
        context.contractId ||
        null,
      metadata,
    });
  } catch (error) {
    safeLog(event, context, error);
  }
}

export function validateDocumentFile(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw appError("INVALID_FILE", "A PDF or DOCX file is required");
  }

  const filename = file.originalname || "";
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();

  if (file.buffer.length === 0) {
    throw appError("INVALID_FILE", "The uploaded file is empty");
  }

  if (file.buffer.length > MAX_FILE_SIZE) {
    throw appError("FILE_TOO_LARGE", "The uploaded file exceeds the configured size limit");
  }

  if (extension === ".pdf") {
    if (file.mimetype !== "application/pdf") {
      throw appError("UNSUPPORTED_FILE_TYPE", "The file MIME type must be application/pdf");
    }
    if (file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw appError("INVALID_PDF", "The uploaded file is not a valid PDF source");
    }
    return { buffer: file.buffer, filename, mimeType: "application/pdf", fileSize: file.buffer.length, extension };
  }

  if (extension === ".docx") {
    const acceptedMimeTypes = new Set([
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
    if (!acceptedMimeTypes.has(file.mimetype)) {
      throw appError("UNSUPPORTED_FILE_TYPE", "The file MIME type must be application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    }
    if (file.buffer.subarray(0, 2).toString("ascii") !== "PK") {
      throw appError("INVALID_DOCX", "The uploaded file is not a valid DOCX source");
    }
    return { buffer: file.buffer, filename, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileSize: file.buffer.length, extension };
  }

  throw appError("UNSUPPORTED_FILE_TYPE", "Only PDF and DOCX files are supported");
}

export function validatePdfFile(file) {
  if ((file?.originalname || "").slice((file?.originalname || "").lastIndexOf(".")).toLowerCase() !== ".pdf") {
    throw appError("UNSUPPORTED_FILE_TYPE", "Only PDF files are supported");
  }
  return validateDocumentFile(file);
}

export function calculateSha256(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw appError("INVALID_FILE", "Cannot hash an empty file");
  }

  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function renderPdfPage(pageData) {
  const content = await pageData.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: false,
  });
  let previousY = null;
  let previousX = null;
  let previousWidth = 0;
  let pageText = "";
  for (const item of content.items || []) {
    const currentX = item.transform?.[4] ?? null;
    const currentY = item.transform?.[5] ?? null;
    let separator = "";
    if (pageText && previousY !== null && currentY !== null && currentY !== previousY) {
      separator = "\n";
    } else if (pageText) {
      const horizontalGap = currentX !== null && previousX !== null
        ? currentX - previousX - previousWidth
        : null;
      separator = horizontalGap !== null && horizontalGap >= 20 ? "\t" : " ";
    }
    pageText += `${separator}${item.str || ""}`;
    previousY = currentY;
    previousX = currentX;
    previousWidth = Number(item.width) || 0;
  }
  return pageText;
}

export function validatePdfPageExtraction(pageCount, pages) {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw appError("INVALID_PDF", "The PDF has no readable pages", 422);
  }
  if (!Array.isArray(pages)
    || pages.length !== pageCount
    || Array.from(pages).some((page, index) => {
      if (typeof page === "string") return false;
      return !page
        || typeof page.text !== "string"
        || page.pageNumber !== index + 1;
    })) {
    throw appError("PDF_PAGE_EXTRACTION_INCOMPLETE", "The PDF page text could not be completely extracted", 422);
  }
}

export function validatePersistedTextLength(text) {
  if (typeof text !== "string") {
    throw appError("SOURCE_TEXT_UNAVAILABLE", "Extracted document text is required", 422);
  }
  if (text.length > MAX_PERSISTED_TEXT_LENGTH) {
    throw appError("DOCUMENT_TEXT_TOO_LARGE", "The extracted document exceeds the supported text limit", 422);
  }
}

function mergePageText(digitalText, ocrText) {
  const digital = digitalText.trim();
  const recognized = ocrText.trim();
  if (!digital) return recognized;
  if (!recognized) return digital;

  const normalizedDigital = digital.replace(/\s+/g, " ").toLowerCase();
  const normalizedOcr = recognized.replace(/\s+/g, " ").toLowerCase();
  return normalizedOcr.includes(normalizedDigital)
    ? recognized
    : `${digital}\n${recognized}`;
}

export async function processPdfPageText({ pageData, pageNumber, digitalText, ocrProvider = null }) {
  const text = typeof digitalText === "string" ? digitalText : "";
  if (text.trim().length >= MIN_DIGITAL_PAGE_TEXT_LENGTH) {
    return {
      pageNumber,
      text,
      extractionMethod: "digital",
      extractionStatus: "completed",
      confidence: null,
      errorCode: null,
    };
  }

  if (!ocrProvider || typeof ocrProvider.processPage !== "function") {
    return {
      pageNumber,
      text,
      extractionMethod: "none",
      extractionStatus: "requires_ocr",
      confidence: null,
      errorCode: "OCR_RUNTIME_UNAVAILABLE",
    };
  }

  let result;
  try {
    result = await ocrProvider.processPage({ pageData, pageNumber, digitalText: text });
  } catch (error) {
    return {
      pageNumber,
      text,
      extractionMethod: "ocr",
      extractionStatus: "failed",
      confidence: null,
      errorCode: [
        "OCR_RUNTIME_UNAVAILABLE",
        "OCR_TIMEOUT",
        "OCR_PAGE_LIMIT",
        "OCR_DOCUMENT_TIMEOUT",
      ].includes(error?.code)
        ? error.code
        : "OCR_FAILED",
    };
  }

  if (result?.status === "blank") {
    return {
      pageNumber,
      text,
      extractionMethod: text.trim() ? "ocr" : "blank",
      extractionStatus: "completed",
      confidence: null,
      errorCode: null,
    };
  }

  const confidence = result?.confidence ?? null;
  if (result?.status === "unreadable") {
    return {
      pageNumber,
      text,
      extractionMethod: "ocr",
      extractionStatus: "failed",
      confidence: Number.isFinite(confidence) && confidence >= 0 && confidence <= 1
        ? confidence
        : null,
      errorCode: "OCR_LOW_CONFIDENCE",
    };
  }

  const validConfidence = confidence === null
    || (Number.isFinite(confidence) && confidence >= 0 && confidence <= 1);
  if (result?.status !== "recognized"
    || typeof result.text !== "string"
    || !result.text.trim()
    || !validConfidence) {
    return {
      pageNumber,
      text,
      extractionMethod: "ocr",
      extractionStatus: "failed",
      confidence: validConfidence ? confidence : null,
      errorCode: "OCR_OUTPUT_INVALID",
    };
  }

  return {
    pageNumber,
    text: mergePageText(text, result.text),
    extractionMethod: "ocr",
    extractionStatus: "completed",
    confidence,
    errorCode: null,
  };
}

function buildOcrSummary(pages) {
  const ocrPages = pages.filter((page) => page.extractionMethod === "ocr");
  const confidenceValues = ocrPages
    .map((page) => page.confidence)
    .filter((confidence) => Number.isFinite(confidence));
  return {
    attemptedPages: ocrPages.length,
    completedPages: ocrPages.filter((page) => page.extractionStatus === "completed").length,
    failedPages: ocrPages.filter((page) => page.extractionStatus === "failed").length,
    timeoutPages: ocrPages.filter((page) => page.errorCode === "OCR_TIMEOUT").length,
    limitedPages: ocrPages.filter((page) => ["OCR_PAGE_LIMIT", "OCR_DOCUMENT_TIMEOUT"].includes(page.errorCode)).length,
    unavailablePages: pages.filter((page) => page.errorCode === "OCR_RUNTIME_UNAVAILABLE").length,
    blankPages: pages.filter((page) => page.extractionMethod === "blank").length,
    meanConfidence: confidenceValues.length
      ? confidenceValues.reduce((total, confidence) => total + confidence, 0) / confidenceValues.length
      : null,
  };
}

async function parsePdf(buffer, { ocrProvider = localPdfOcrProvider } = {}) {
  try {
    const pages = [];
    const documentOcrProvider = ocrProvider
      ? createDocumentOcrProvider(ocrProvider)
      : null;
    const parsed = await pdfParse(buffer, {
      pagerender: async (pageData) => {
        const digitalText = await renderPdfPage(pageData);
        const page = await processPdfPageText({
          pageData,
          pageNumber: Number(pageData.pageNumber) || pages.length + 1,
          digitalText,
          ocrProvider: documentOcrProvider,
        });
        pages.push(page);
        return page.text;
      },
    });
    const pageCount = Number(parsed.numpages) || 0;
    const orderedPages = pages.toSorted((left, right) => left.pageNumber - right.pageNumber);
    validatePdfPageExtraction(pageCount, orderedPages);
    const text = orderedPages.map((page) => page.text).join("\f");
    const ocrSummary = buildOcrSummary(orderedPages);
    const requiresOcr = orderedPages.some((page) => page.extractionStatus !== "completed")
      || text.trim().length < MIN_DIGITAL_PAGE_TEXT_LENGTH;

    return {
      pageCount,
      text,
      pages: orderedPages,
      requiresOcr,
      ocrSummary,
      extractionErrorCode: orderedPages.find((page) => page.errorCode)?.errorCode
        || (requiresOcr ? "PDF_REQUIRES_OCR" : null),
    };
  } catch (error) {
    if (["INVALID_PDF", "PDF_PAGE_EXTRACTION_INCOMPLETE"].includes(error.code)) throw error;
    const invalidPdf = appError("INVALID_PDF", "The PDF could not be parsed");
    invalidPdf.cause = error;
    throw invalidPdf;
  }
}

async function parseDocx(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = typeof result.value === "string" ? result.value : "";
    return { pageCount: null, text, requiresOcr: false };
  } catch {
    throw appError("INVALID_DOCX", "The DOCX could not be parsed");
  }
}

async function parseDocument(buffer, extension) {
  return extension === ".docx" ? parseDocx(buffer) : parsePdf(buffer);
}

export async function extractPdfMetadata(buffer, options = {}) {
  return parsePdf(buffer, options);
}

export async function extractDocumentMetadata(buffer, extension = ".pdf", options = {}) {
  return extension === ".docx" ? parseDocument(buffer, extension) : parsePdf(buffer, options);
}

async function findDuplicateVersion(organizationId, sha256) {
  requireOrganizationScope(organizationId);

  const { data, error } = await supabase
    .from("document_versions")
    .select("id, document_id, organization_id, version_number")
    .eq("organization_id", organizationId)
    .eq("sha256", sha256)
    .maybeSingle();

  if (error) throw appError("STORAGE_ERROR", "Duplicate check failed", 503);
  return data;
}

async function getContractRecord(contractId, organizationId) {
  requireOrganizationScope(organizationId);

  const { data, error } = await supabase
    .from("contracts")
    .select("id, organization_id")
    .eq("id", contractId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw appError("STORAGE_ERROR", "Contract lookup failed", 503);
  if (!data) throw appError("CONTRACT_NOT_FOUND", "Contract not found", 404);
  return data;
}

async function createContractRecord({ organizationId, userId, title }) {
  const { data, error } = await supabase
    .from("contracts")
    .insert({
      organization_id: organizationId,
      created_by: userId,
      title,
      status: "draft",
    })
    .select("id, organization_id")
    .single();

  if (error || !data) {
    throw appError("STORAGE_ERROR", "Contract creation failed", 503);
  }

  return data;
}

async function createDocumentRecord({
  documentId,
  organizationId,
  contractId,
  userId,
  filename,
  mimeType,
  fileSize,
  storageKey,
  sha256,
}) {
  const { data, error } = await supabase
    .from("documents")
    .insert({
      id: documentId,
      organization_id: organizationId,
      contract_id: contractId,
      created_by: userId,
      document_type: "aviation_contract",
      filename,
      mime_type: mimeType,
      file_size: fileSize,
      storage_provider: "supabase",
      storage_key: storageKey,
      sha256,
      status: "uploaded",
    })
    .select("id, organization_id, contract_id, status")
    .single();

  if (error || !data) {
    throw appError("STORAGE_ERROR", "Document record creation failed", 503);
  }

  return data;
}

async function createVersionRecord({
  documentId,
  contractId,
  organizationId,
  userId,
  versionNumber,
  sha256,
  storageKey,
  mimeType,
  fileSize,
  pageCount,
}) {
  const { data, error } = await supabase
    .from("document_versions")
    .insert({
      document_id: documentId,
      contract_id: contractId,
      organization_id: organizationId,
      version_number: versionNumber,
      sha256,
      storage_key: storageKey,
      mime_type: mimeType,
      file_size: fileSize,
      page_count: pageCount,
      extraction_status: "queued",
      created_by: userId,
    })
    .select("id, document_id, version_number, extraction_status")
    .single();

  if (error || !data) {
    throw appError("STORAGE_ERROR", "Document version creation failed", 503);
  }

  return data;
}

async function createAnalysisRun({ organizationId, contractId, versionId, userId }) {
  const { data, error } = await supabase
    .from("analysis_runs")
    .insert({
      organization_id: organizationId,
      contract_id: contractId,
      document_version_id: versionId,
      status: "queued",
      pipeline_version: PIPELINE_VERSION,
      requested_by: userId,
    })
    .select("id, status, pipeline_version")
    .single();

  if (error || !data) {
    throw appError("STORAGE_ERROR", "Analysis run creation failed", 503);
  }

  return data;
}

async function updateStatus({
  organizationId,
  documentId,
  versionId,
  analysisRunId,
  documentStatus,
  extractionStatus,
  runStatus,
  startedAt,
  completedAt,
  errorCode = null,
  errorMessage = null,
}) {
  const documentUpdate = { status: documentStatus, updated_at: new Date().toISOString() };
  const versionUpdate = {
    extraction_status: extractionStatus,
    processing_status: documentStatus === "ready" || documentStatus === "requires_ocr" ? "processed" : documentStatus,
  };
  const runUpdate = {
    status: runStatus,
    started_at: startedAt || null,
    completed_at: completedAt || null,
    error_code: errorCode,
    error_message: errorMessage,
  };

  const updates = [
    supabase
      .from("documents")
      .update(documentUpdate)
      .eq("id", documentId)
      .eq("organization_id", organizationId),
    supabase
      .from("document_versions")
      .update(versionUpdate)
      .eq("id", versionId)
      .eq("organization_id", organizationId),
  ];
  if (analysisRunId && runStatus) {
    updates.push(
      supabase
        .from("analysis_runs")
        .update(runUpdate)
        .eq("id", analysisRunId)
        .eq("organization_id", organizationId)
    );
  }
  const results = await Promise.all(updates);

  if (results.some((result) => result.error)) {
    throw appError("STORAGE_ERROR", "Processing status update failed", 503);
  }
}

async function storeExtraction({
  organizationId,
  versionId,
  text,
  status,
  errorCode = null,
}) {
  const { error } = await supabase
    .from("document_version_extractions")
    .insert({
      document_version_id: versionId,
      organization_id: organizationId,
      text_content: text ? text.slice(0, MAX_PERSISTED_TEXT_LENGTH) : null,
      text_length: text?.length || 0,
      text_truncated: (text?.length || 0) > MAX_PERSISTED_TEXT_LENGTH,
      extraction_status: status,
      error_code: errorCode,
    });

  if (error) throw appError("STORAGE_ERROR", "Extraction result persistence failed", 503);
}

export async function ingestContractUpload({
  file,
  organizationId,
  userId,
  requestId,
  title,
  contractId = null,
  documentId = null,
  ocrProvider = localPdfOcrProvider,
}) {
  const validated = validateDocumentFile(file);
  const sha256 = calculateSha256(validated.buffer);
  const context = {
    organizationId,
    userId,
    requestId,
    contractId,
    documentId,
    entityType: "contract_ingestion",
  };

  const duplicate = await findDuplicateVersion(organizationId, sha256);
  if (duplicate) {
    const existingDocument = await getDocumentById(
      duplicate.document_id,
      organizationId
    );
    return {
      duplicate: true,
      contractId: existingDocument.contract_id,
      documentId: duplicate.document_id,
      documentVersionId: duplicate.id,
      analysisRunId: null,
      status: "duplicate",
    };
  }
  const parsed = validated.extension === ".docx"
    ? await parseDocument(validated.buffer, validated.extension)
    : await parsePdf(validated.buffer, { ocrProvider });
  validatePersistedTextLength(parsed.text);

  let createdContractId = contractId;
  let createdDocumentId = documentId;
  let createdVersionId;
  let analysisRunId;
  let storageKey;
  let storageUploaded = false;
  let contractCreatedHere = false;

  try {
    const contract = contractId
      ? await getContractRecord(contractId, organizationId)
      : await createContractRecord({
          organizationId,
          userId,
          title: title || validated.filename,
        });
    contractCreatedHere = !contractId;
    createdContractId = contract.id;
    context.contractId = createdContractId;

    if (contractCreatedHere) {
      await audit("contract.created", context, { pipeline_version: PIPELINE_VERSION });
    }

    if (documentId) {
      const { data, error } = await supabase
        .from("documents")
        .select("id, contract_id")
        .eq("id", documentId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error || !data || data.contract_id !== createdContractId) {
        throw appError("DOCUMENT_NOT_FOUND", "Document not found", 404);
      }
    } else {
      createdDocumentId = crypto.randomUUID();
    }

    createdVersionId = crypto.randomUUID();
    storageKey = buildDocumentStorageKey({
      organizationId,
      documentId: createdDocumentId,
      versionId: createdVersionId,
      extension: validated.extension,
    });

    await uploadDocumentSource({
      storageKey,
      buffer: validated.buffer,
      mimeType: validated.mimeType,
    });
    storageUploaded = true;

    if (!documentId) {
      await createDocumentRecord({
        documentId: createdDocumentId,
        organizationId,
        contractId: createdContractId,
        userId,
        filename: validated.filename,
        mimeType: validated.mimeType,
        fileSize: validated.fileSize,
        storageKey,
        sha256,
      });
      context.documentId = createdDocumentId;
    }

    const { data: latestVersion, error: latestVersionError } = await supabase
      .from("document_versions")
      .select("version_number")
      .eq("document_id", createdDocumentId)
      .eq("organization_id", organizationId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestVersionError) {
      throw appError("STORAGE_ERROR", "Document version lookup failed", 503);
    }

    const version = await createVersionRecord({
      documentId: createdDocumentId,
      contractId: createdContractId,
      organizationId,
      userId,
      versionNumber: (latestVersion?.version_number || 0) + 1,
      sha256,
      storageKey,
      mimeType: validated.mimeType,
      fileSize: validated.fileSize,
      pageCount: parsed.pageCount,
    });
    context.documentVersionId = version.id;
    const analysisRun = await createAnalysisRun({
      organizationId,
      contractId: createdContractId,
      versionId: version.id,
      userId,
    });
    analysisRunId = analysisRun.id;
    context.analysisRunId = analysisRunId;

    await audit("document.uploaded", context, { sha256, file_size: validated.fileSize });
    await audit("document.version.created", context, { version_number: version.version_number, sha256 });

    const startedAt = new Date().toISOString();
    await updateStatus({
      organizationId,
      documentId: createdDocumentId,
      versionId: version.id,
      analysisRunId,
      documentStatus: "processing",
      extractionStatus: "processing",
      runStatus: null,
      startedAt,
    });

    if (parsed.requiresOcr) {
      await storeExtraction({
        organizationId,
        versionId: version.id,
        text: parsed.text,
        status: "requires_ocr",
        errorCode: parsed.extractionErrorCode,
      });
      await updateStatus({
        organizationId,
        documentId: createdDocumentId,
        versionId: version.id,
        analysisRunId,
        documentStatus: "requires_ocr",
        extractionStatus: "requires_ocr",
        runStatus: null,
        startedAt,
        completedAt: new Date().toISOString(),
        errorCode: parsed.extractionErrorCode,
        errorMessage: parsed.extractionErrorCode === "OCR_RUNTIME_UNAVAILABLE"
          ? "OCR is not configured for one or more pages"
          : "OCR did not produce complete text for every required page",
      });
      await audit("document.ocr_required", context, {
        page_count: parsed.pageCount,
        ocr: parsed.ocrSummary,
        page_extraction: parsed.pages.map(({ pageNumber, extractionMethod, extractionStatus, confidence, errorCode }) => ({
          page_number: pageNumber,
          method: extractionMethod,
          status: extractionStatus,
          confidence,
          error_code: errorCode,
        })),
      });
      return {
        contractId: createdContractId,
        documentId: createdDocumentId,
        documentVersionId: version.id,
        analysisRunId,
        status: "requires_ocr",
        sha256,
        pageCount: parsed.pageCount,
        textLength: parsed.text.length,
        ocr: parsed.ocrSummary,
        pageExtraction: parsed.pages.map(({ pageNumber, extractionMethod, extractionStatus, confidence, errorCode }) => ({
          pageNumber,
          method: extractionMethod,
          status: extractionStatus,
          confidence,
          errorCode,
        })),
      };
    }

    await storeExtraction({
      organizationId,
      versionId: version.id,
      text: parsed.text,
      status: "completed",
    });
    const structure = parseDocumentStructure({ text: parsed.text });
    const structureCounts = await persistDocumentStructure({
      supabase,
      organizationId,
      contractId: createdContractId,
      documentId: createdDocumentId,
      documentVersionId: version.id,
      analysisRunId,
      structure,
    });
    await updateStatus({
      organizationId,
      documentId: createdDocumentId,
      versionId: version.id,
      analysisRunId,
      documentStatus: "ready",
      extractionStatus: "completed",
      runStatus: null,
      startedAt,
      completedAt: new Date().toISOString(),
    });
    await audit("document.ready", context, {
      status: "ready",
      page_count: parsed.pageCount,
      text_length: parsed.text.length,
      ocr: parsed.ocrSummary,
      page_extraction: parsed.pages.map(({ pageNumber, extractionMethod, extractionStatus, confidence }) => ({
        page_number: pageNumber,
        method: extractionMethod,
        status: extractionStatus,
        confidence,
      })),
    });

    return {
      contractId: createdContractId,
      documentId: createdDocumentId,
      documentVersionId: version.id,
      analysisRunId,
      status: "ready",
      sha256,
      pageCount: parsed.pageCount,
      textLength: parsed.text.length,
      structure: structureCounts,
      ocr: parsed.ocrSummary,
      pageExtraction: parsed.pages.map(({ pageNumber, extractionMethod, extractionStatus, confidence }) => ({
        pageNumber,
        method: extractionMethod,
        status: extractionStatus,
        confidence,
      })),
    };
  } catch (error) {
    if (analysisRunId) {
      try {
        await updateStatus({
          organizationId,
          documentId: createdDocumentId,
          versionId: createdVersionId,
          analysisRunId,
          documentStatus: "failed",
          extractionStatus: "failed",
          runStatus: analysisRunId ? "failed" : null,
          completedAt: new Date().toISOString(),
          errorCode: error.code || "INGESTION_FAILED",
          errorMessage: "Document processing failed",
        });
        await audit("analysis.failed", context, {
          error_code: error.code || "INGESTION_FAILED",
        });
      } catch (statusError) {
        safeLog("analysis.failed", context, statusError);
      }
    } else {
      if (storageUploaded) await removeDocumentSource(storageKey);

      if (createdDocumentId && !documentId) {
        if (createdVersionId) {
          await supabase
            .from("document_versions")
            .delete()
            .eq("id", createdVersionId)
            .eq("organization_id", organizationId);
        }

        await supabase
          .from("documents")
          .delete()
          .eq("id", createdDocumentId)
          .eq("organization_id", organizationId);
      }

      if (contractCreatedHere && createdContractId) {
        await supabase
          .from("contracts")
          .delete()
          .eq("id", createdContractId)
          .eq("organization_id", organizationId);
      }
    }

    throw error.code ? error : appError("STORAGE_ERROR", "Document ingestion failed", 503);
  }
}

function sanitizeDocument(document) {
  if (!document) return null;
  const { storage_key: _storageKey, ...safeDocument } = document;
  return safeDocument;
}

export async function listDocumentsForContract(contractId, organizationId) {
  requireOrganizationScope(organizationId);
  await getContractRecord(contractId, organizationId);

  const { data, error } = await supabase
    .from("documents")
    .select("id, organization_id, contract_id, created_by, document_type, filename, mime_type, file_size, storage_provider, sha256, status, created_at, updated_at")
    .eq("contract_id", contractId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw appError("STORAGE_ERROR", "Document lookup failed", 503);
  return data || [];
}

export async function getDocumentById(documentId, organizationId) {
  requireOrganizationScope(organizationId);

  const { data, error } = await supabase
    .from("documents")
    .select("id, organization_id, contract_id, created_by, document_type, filename, mime_type, file_size, storage_provider, storage_key, sha256, status, created_at, updated_at")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw appError("STORAGE_ERROR", "Document lookup failed", 503);
  if (!data) throw appError("DOCUMENT_NOT_FOUND", "Document not found", 404);
  return data;
}

export async function getDocumentStructure(documentId, organizationId) {
  requireOrganizationScope(organizationId);
  await getDocumentById(documentId, organizationId);
  const [pagesResult, sectionsResult, chunksResult] = await Promise.all([
    supabase
      .from("contract_document_pages")
      .select("id, document_version_id, page_number, text_length, char_start, char_end, text_hash")
      .eq("document_id", documentId)
      .eq("organization_id", organizationId)
      .order("page_number", { ascending: true }),
    supabase
      .from("contract_sections")
      .select("id, contract_id, document_id, document_version_id, parent_section_id, heading, section_order, page_start, page_end, source_text, metadata")
      .eq("document_id", documentId)
      .eq("organization_id", organizationId)
      .order("section_order", { ascending: true }),
    supabase
      .from("contract_document_chunks")
      .select("id, contract_id, document_id, document_version_id, section_id, page_number, chunk_order, source_text, content_hash, metadata")
      .eq("document_id", documentId)
      .eq("organization_id", organizationId)
      .order("chunk_order", { ascending: true }),
  ]);
  if (pagesResult.error || sectionsResult.error || chunksResult.error) throw appError("STORAGE_ERROR", "Document structure lookup failed", 503);
  return { pages: pagesResult.data || [], sections: sectionsResult.data || [], chunks: chunksResult.data || [] };
}

export async function listDocumentVersions(documentId, organizationId) {
  requireOrganizationScope(organizationId);
  await getDocumentById(documentId, organizationId);
  const { data, error } = await supabase
    .from("document_versions")
    .select("id, document_id, organization_id, version_number, sha256, mime_type, file_size, page_count, extraction_status, processing_status, analysis_status, created_by, created_at")
    .eq("document_id", documentId)
    .eq("organization_id", organizationId)
    .order("version_number", { ascending: false });

  if (error) throw appError("STORAGE_ERROR", "Document version lookup failed", 503);
  const versions = data || [];
  if (!versions.length) return versions;

  const { data: analysisRuns, error: analysisRunsError } = await supabase
    .from("analysis_runs")
    .select("id, document_version_id, status, created_at")
    .eq("organization_id", organizationId)
    .in("document_version_id", versions.map((version) => version.id))
    .order("created_at", { ascending: false });

  if (analysisRunsError) {
    throw appError("STORAGE_ERROR", "Analysis run lookup failed", 503);
  }

  const latestRunByVersion = new Map();
  for (const run of analysisRuns || []) {
    if (!latestRunByVersion.has(run.document_version_id)) {
      latestRunByVersion.set(run.document_version_id, run);
    }
  }

  return versions.map((version) => {
    const latestRun = latestRunByVersion.get(version.id);
    return {
      ...version,
      analysis_run_id: latestRun?.id || null,
      analysis_run_status: latestRun?.status || null,
    };
  });
}

export async function getContractProcessingStatus(contractId, organizationId) {
  requireOrganizationScope(organizationId);
  await getContractRecord(contractId, organizationId);
  const documents = await listDocumentsForContract(contractId, organizationId);
  const latestDocument = documents[0] || null;
  if (!latestDocument) {
    return { contractId, status: "not_uploaded", document: null, version: null };
  }
  const versions = await listDocumentVersions(latestDocument.id, organizationId);
  const latestVersion = versions[0] || null;
  return {
    contractId,
    status: latestDocument.status,
    document: {
      id: latestDocument.id,
      filename: latestDocument.filename,
      status: latestDocument.status,
      createdAt: latestDocument.created_at,
    },
    version: latestVersion,
  };
}

export async function getAnalysisRunById(runId, organizationId) {
  requireOrganizationScope(organizationId);

  const { data, error } = await supabase
    .from("analysis_runs")
    .select("id, organization_id, contract_id, document_version_id, status, pipeline_version, requested_by, started_at, completed_at, error_code, created_at")
    .eq("id", runId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw appError("STORAGE_ERROR", "Analysis run lookup failed", 503);
  if (!data) throw appError("ANALYSIS_RUN_NOT_FOUND", "Analysis run not found", 404);
  return data;
}

export async function downloadDocumentById(documentId, organizationId) {
  requireOrganizationScope(organizationId);
  const document = await getDocumentById(documentId, organizationId);
  const buffer = await downloadDocumentSource(document.storage_key);
  return {
    buffer,
    filename: document.filename,
    mimeType: document.mime_type,
  };
}

export function getIngestionConstants() {
  return { maxFileSize: MAX_FILE_SIZE, pipelineVersion: PIPELINE_VERSION };
}
