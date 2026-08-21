import supabase from "../../config/supabase.js";

import { assertOrganizationScope, assertResourceId } from "./scope.js";

export function createSearchChunkRepository(client = supabase) {
  return {
    async createMany({ organizationId, chunks }) {
      assertOrganizationScope(organizationId);
      chunks.forEach((chunk) => {
        assertResourceId(chunk.document_version_id, "document_version_id");
        assertResourceId(chunk.analysis_run_id, "analysis_run_id");
      });

      if (!chunks.length) return [];

      const { data, error } = await client
        .from("contract_search_chunks")
        .insert(chunks.map((chunk) => ({ ...chunk, organization_id: organizationId })))
        .select("id, organization_id, document_version_id, analysis_run_id, chunk_index, index_status");

      if (error) throw error;
      return data || [];
    },

    async listByVersion({ organizationId, documentVersionId, analysisRunId }) {
      assertOrganizationScope(organizationId);
      assertResourceId(documentVersionId, "documentVersionId");
      assertResourceId(analysisRunId, "analysisRunId");

      const { data, error } = await client
        .from("contract_search_chunks")
        .select("id, organization_id, document_version_id, analysis_run_id, chunk_index, text_content, page_start, page_end, index_status")
        .eq("document_version_id", documentVersionId)
        .eq("analysis_run_id", analysisRunId)
        .eq("organization_id", organizationId)
        .order("chunk_index", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  };
}
