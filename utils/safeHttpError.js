const PUBLIC_ERRORS = Object.freeze({
  INVALID_FILE: { status: 400, message: "A valid PDF or DOCX file is required" },
  FILE_TOO_LARGE: { status: 413, message: "The uploaded file exceeds the configured size limit" },
  UNSUPPORTED_FILE_TYPE: { status: 400, message: "Only supported PDF and DOCX files can be uploaded" },
  INVALID_PDF: { status: 400, message: "The uploaded PDF could not be processed" },
  INVALID_DOCX: { status: 400, message: "The uploaded DOCX could not be processed" },
  DUPLICATE_DOCUMENT: { status: 409, message: "This document has already been uploaded" },
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