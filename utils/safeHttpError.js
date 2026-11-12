const PUBLIC_ERRORS = Object.freeze({
  INVALID_FILE: { status: 400, message: "A valid PDF or DOCX file is required" },
  FILE_TOO_LARGE: { status: 413, message: "The uploaded file exceeds the configured size limit" },
  UNSUPPORTED_FILE_TYPE: { status: 400, message: "Only supported PDF and DOCX files can be uploaded" },
  INVALID_PDF: { status: 400, message: "The uploaded PDF could not be processed" },
  PDF_PAGE_EXTRACTION_INCOMPLETE: { status: 422, message: "The uploaded PDF could not be fully extracted" },
  OCR_FAILED: { status: 422, message: "OCR could not read one or more document pages" },
  INVALID_DOCX: { status: 400, message: "The uploaded DOCX could not be processed" },
  DOCUMENT_TEXT_TOO_LARGE: { status: 422, message: "The extracted document exceeds the supported text limit" },
  DUPLICATE_DOCUMENT: { status: 409, message: "This document has already been uploaded" },
  INGESTION_RECOVERY_REQUIRED: { status: 409, message: "An incomplete upload already exists and requires review" },
  INGESTION_IN_PROGRESS: { status: 409, message: "An equivalent upload is already in progress" },
  INGESTION_NOT_READY: { status: 409, message: "Document ingestion must finish before analysis" },
  ANALYSIS_DISPATCH_PENDING: { status: 503, message: "Document is retained; analysis dispatch requires recovery" },
  ANALYSIS_IN_PROGRESS: { status: 409, message: "This analysis is already in progress" },
  ANALYSIS_RECOVERY_REQUIRED: { status: 409, message: "The previous analysis must be reviewed before recovery" },
  OPERATION_CAPACITY_EXHAUSTED: { status: 503, message: "Operation capacity is exhausted; retry later" },
  OPERATION_LOCK_LOST: { status: 503, message: "The operation's lock connection was lost; review its status before retrying" },
  AI_RETRY_REQUIRES_REVIEW: { status: 409, message: "Review the previous AI attempt and its provider usage before starting another run" },
  CONTRACT_NOT_FOUND: { status: 404, message: "Contract not found" },
  DOCUMENT_NOT_FOUND: { status: 404, message: "Document not found" },
  DOCUMENT_VERSION_NOT_FOUND: { status: 404, message: "Document version not found" },
  ANALYSIS_RUN_NOT_FOUND: { status: 404, message: "Analysis run not found" },
  CONTRACT_PROFILE_NOT_FOUND: { status: 404, message: "Contract profile not found" },
  SEARCH_QUERY_REQUIRED: { status: 400, message: "Search query is required" },
  SOURCE_TEXT_UNAVAILABLE: { status: 422, message: "Required contract source text is unavailable" },
  ORGANIZATION_ACCESS_DENIED: { status: 403, message: "Organization access denied" },
  CONFIRMATION_REQUIRED: { status: 409, message: "Confirmation is required before this analysis can run" },
  INSUFFICIENT_INTELLIGENCE_BUDGET: { status: 409, message: "The organization has insufficient analysis budget" },
  REQUEST_IN_PROGRESS: { status: 409, message: "An equivalent analysis request is already in progress" },
  CONTRACT_AI_NOT_APPROVED: { status: 503, message: "AI contract analysis requires approved provider, isolation and data-use settings" },
  AI_CONFIRMATION_REQUIRED: { status: 400, message: "Confirm document authorization and AI budget use before requesting AI analysis" },
  AI_NEW_RUN_REQUIRED: { status: 409, message: "Create a new analysis run for AI review; existing results are immutable" },
  AI_SOURCE_INCOMPLETE: { status: 422, message: "AI analysis requires complete extracted document text" },
  AI_SOURCE_UNAVAILABLE: { status: 422, message: "AI analysis requires verifiable document evidence" },
  AI_SOURCE_TOO_LARGE: { status: 422, message: "The document exceeds the supported AI analysis size" },
  AI_OUTPUT_INVALID: { status: 502, message: "AI analysis returned an invalid structured response" },
  AI_SOURCE_MISMATCH: { status: 502, message: "AI analysis could not be verified against its source evidence" },
  AI_REQUEST_BLOCKED: { status: 409, message: "AI analysis could not start; check approval and budget settings" },
  INVALID_STRUCTURED_OUTPUT: { status: 502, message: "The AI provider returned an invalid structured response" },
  PROVIDER_UNAVAILABLE: { status: 502, message: "The AI provider is unavailable" },
  INVALID_PROVIDER_CONFIGURATION: { status: 503, message: "The AI provider is not configured correctly" },
});

export function toSafeHttpError(error, fallback = {}) {
  const publicError = PUBLIC_ERRORS[error?.code];
  if (publicError) {
    return {
      status: publicError.status,
      body: { success: false, code: error.code, error: publicError.message },
    };
  }

  return {
    status: fallback.status || 500,
    body: {
      success: false,
      code: fallback.code || "INTERNAL_ERROR",
      error: fallback.message || "The request could not be completed",
    },
  };
}

export function sendSafeHttpError(res, error, fallback) {
  const response = toSafeHttpError(error, fallback);
  return res.status(response.status).json(response.body);
}