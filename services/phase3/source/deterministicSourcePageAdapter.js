import crypto from "node:crypto";

export function computeTextHash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function buildCanonicalPageSource({
  documentVersion,
  document,
  analysisRun,
  extraction,
  pageRows = [],
}) {
  if (!extraction || typeof extraction.text_content !== "string" || extraction.text_content.length === 0) {
    const error = new Error("Completed extraction text is required");
    error.code = "SOURCE_TEXT_UNAVAILABLE";
    error.status = 422;
    throw error;
  }

  const text = extraction.text_content;
  const derivedSegments = [];
  const paragraphMatches = [...text.matchAll(/\n\s*\n/g)];
  let cursor = 0;

  for (const match of paragraphMatches) {
    const start = cursor;
    const end = match.index;
    const slice = text.slice(start, end);
    if (slice.trim()) {
      derivedSegments.push({
        char_start: start,
        char_end: end,
        text_content: slice,
      });
    }
    cursor = match.index + match[0].length;
  }

  const tail = text.slice(cursor);
  if (tail.trim()) {
    derivedSegments.push({
      char_start: cursor,
      char_end: text.length,
      text_content: tail,
    });
  }

  if (!derivedSegments.length) {
    derivedSegments.push({
      char_start: 0,
      char_end: text.length,
      text_content: text,
    });
  }

  const candidatePages = [...pageRows]
    .filter((page) => page && typeof page === "object")
    .sort((left, right) => Number(left.page_number || 1) - Number(right.page_number || 1));
  const hasTrustedPageOffsets = candidatePages.length > 0 && candidatePages.every((page) => {
    const start = page.char_start;
    const end = page.char_end;
    return Number.isInteger(start)
      && Number.isInteger(end)
      && start >= 0
      && end > start
      && end <= text.length
      && (typeof page.text_content !== "string" || page.text_content === text.slice(start, end));
  });
  const orderedPages = hasTrustedPageOffsets
    ? candidatePages.map((page, index) => {
      const firstChar = page.char_start;
      const lastChar = page.char_end;
      const pageText = text.slice(firstChar, lastChar);
      return {
        id: page.id || null,
        organization_id: documentVersion.organization_id,
        contract_id: document.contract_id,
        document_id: document.id,
        document_version_id: documentVersion.id,
        analysis_run_id: analysisRun.id,
        page_number: Number(page.page_number || index + 1),
        text_content: pageText,
        text_length: pageText.length,
        char_start: Number.isFinite(firstChar) ? firstChar : 0,
        char_end: Number.isFinite(lastChar) ? lastChar : text.length,
        text_hash: page.text_hash || computeTextHash(pageText),
        extraction_status: page.extraction_status || "completed",
        source_provenance: page.source_provenance || "derived_from_extraction_text",
        source_status: page.source_status || "derived_unavailable",
      };
    })
    : [];

  const canonicalPages = orderedPages.length
    ? orderedPages
    : derivedSegments.length
      ? derivedSegments.map((segment, index) => ({
          id: null,
          organization_id: documentVersion.organization_id,
          contract_id: document.contract_id,
          document_id: document.id,
          document_version_id: documentVersion.id,
          analysis_run_id: analysisRun.id,
          page_number: index + 1,
          text_content: segment.text_content,
          text_length: segment.text_content.length,
          char_start: segment.char_start,
          char_end: segment.char_end,
          text_hash: computeTextHash(segment.text_content),
          extraction_status: "completed",
          source_provenance: "derived_from_extraction_text",
          source_status: "derived_unavailable",
        }))
      : [{
          id: null,
          organization_id: documentVersion.organization_id,
          contract_id: document.contract_id,
          document_id: document.id,
          document_version_id: documentVersion.id,
          analysis_run_id: analysisRun.id,
          page_number: 1,
          text_content: text,
          text_length: text.length,
          char_start: 0,
          char_end: text.length,
          text_hash: computeTextHash(text),
          extraction_status: "completed",
          source_provenance: "derived_from_extraction_text",
          source_status: "derived_unavailable",
        }];

  const normalizedPages = canonicalPages.map((page) => ({
    ...page,
    text_content: page.text_content || text.slice(page.char_start || 0, page.char_end || text.length),
    char_start: Number(page.char_start ?? 0),
    char_end: Number(page.char_end ?? text.length),
    text_length: Number(page.text_length ?? Math.max(0, (page.char_end ?? text.length) - (page.char_start ?? 0))),
  }));

  const pageBoundaries = "derived_unavailable";

  return {
    organizationId: documentVersion.organization_id,
    contractId: document.contract_id,
    documentId: document.id,
    documentVersionId: documentVersion.id,
    analysisRunId: analysisRun.id,
    text,
    textTruncated: Boolean(extraction.text_truncated),
    pageBoundaries,
    pages: normalizedPages,
    sourceStatus: "derived_unavailable",
    sourceLocator: (charStart, charEnd) => `document_version:${documentVersion.id}:char:${charStart}-${charEnd}`,
  };
}
