import supabase from "../../../config/supabase.js";
import { assertOrganizationScope, assertResourceId } from "../../../repositories/phase3/scope.js";
import { buildCanonicalPageSource } from "./deterministicSourcePageAdapter.js";

function sourceError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

export function requireUsableExtractionText(extraction) {
  if (!extraction || extraction.extraction_status !== "completed") {
    throw sourceError("SOURCE_TEXT_UNAVAILABLE", "Completed extraction text is required", 422);
  }

  if (typeof extraction.text_content !== "string" || extraction.text_content.length === 0) {
    throw sourceError("SOURCE_TEXT_UNAVAILABLE", "Extraction text is empty", 422);
  }

  return extraction.text_content;
}

export function buildSourceRepresentation({
  documentVersion,
  document,
  analysisRun,
  extraction,
  pageRows = [],
}) {
  const text = requireUsableExtractionText(extraction);
  return buildCanonicalPageSource({
    documentVersion,
    document,
    analysisRun,
    extraction: { ...extraction, text_content: text },
    pageRows,
  });
}

export function createDocumentVersionSourceService(client = supabase) {
  return {
    async load({ documentVersionId, analysisRunId, organizationId }) {
      assertResourceId(documentVersionId, "documentVersionId");
      assertResourceId(analysisRunId, "analysisRunId");
      assertOrganizationScope(organizationId);

      const { data: documentVersion, error: versionError } = await client
        .from("document_versions")
        .select("id, document_id, organization_id, version_number, extraction_status")
        .eq("id", documentVersionId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (versionError) throw sourceError("SOURCE_LOOKUP_FAILED", "Document version lookup failed", 503);
      if (!documentVersion) throw sourceError("DOCUMENT_VERSION_NOT_FOUND", "Document version not found", 404);

      const { data: document, error: documentError } = await client
        .from("documents")
        .select("id, contract_id, organization_id")
        .eq("id", documentVersion.document_id)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (documentError) throw sourceError("SOURCE_LOOKUP_FAILED", "Document lookup failed", 503);
      if (!document) throw sourceError("DOCUMENT_NOT_FOUND", "Document not found", 404);

      const { data: analysisRun, error: runError } = await client
        .from("analysis_runs")
        .select("id, organization_id, contract_id, document_version_id, status, pipeline_version")
        .eq("id", analysisRunId)
        .eq("organization_id", organizationId)
        .eq("document_version_id", documentVersionId)
        .eq("contract_id", document.contract_id)
        .maybeSingle();

      if (runError) throw sourceError("SOURCE_LOOKUP_FAILED", "Analysis run lookup failed", 503);
      if (!analysisRun) throw sourceError("ANALYSIS_RUN_NOT_FOUND", "Analysis run not found", 404);

      const { data: extraction, error: extractionError } = await client
        .from("document_version_extractions")
        .select("document_version_id, organization_id, text_content, text_length, text_truncated, extraction_status")
        .eq("document_version_id", documentVersionId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (extractionError) throw sourceError("SOURCE_LOOKUP_FAILED", "Extraction lookup failed", 503);

      const { data: pageRows, error: pageError } = await client
        .from("document_version_pages")
        .select("id, organization_id, contract_id, document_id, document_version_id, analysis_run_id, page_number, text_content, text_length, char_start, char_end, text_hash, extraction_status")
        .eq("document_version_id", documentVersionId)
        .eq("analysis_run_id", analysisRunId)
        .eq("organization_id", organizationId)
        .order("page_number", { ascending: true });

      if (pageError) throw sourceError("SOURCE_LOOKUP_FAILED", "Page source lookup failed", 503);

      return buildSourceRepresentation({
        documentVersion,
        document,
        analysisRun,
        extraction,
        pageRows: pageRows || [],
      });
    },
  };
}
