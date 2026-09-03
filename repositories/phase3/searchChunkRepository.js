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

    async replaceForRun({ organizationId, analysisRunId, chunks }) {
      assertOrganizationScope(organizationId);
      assertResourceId(analysisRunId, "analysisRunId");
      const removed = await client
        .from("contract_search_chunks")
        .delete()
        .eq("analysis_run_id", analysisRunId)
        .eq("organization_id", organizationId);
      if (removed.error) throw removed.error;
      return this.createMany({ organizationId, chunks });
    },

    async search({ organizationId, analysisRunId, query, limit = 20 }) {
      assertOrganizationScope(organizationId);
      assertResourceId(analysisRunId, "analysisRunId");
      const normalized = String(query || "").trim();
      if (!normalized) return [];
      const { data, error } = await client
        .from("contract_search_chunks")
        .select("id, contract_id, document_id, document_version_id, analysis_run_id, chunk_index, text_content, char_start, char_end, page_start, page_end, index_status")
        .eq("organization_id", organizationId)
        .eq("analysis_run_id", analysisRunId)
        .textSearch("search_vector", normalized, { config: "simple", type: "websearch" })
        .limit(Math.min(Math.max(Number(limit) || 20, 1), 100));
      if (error) throw error;
      return data || [];
    },
  };
}
