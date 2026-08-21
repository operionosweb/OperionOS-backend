import supabase from "../../config/supabase.js";

import { assertOrganizationScope, assertResourceId } from "./scope.js";

export function createPageRepository(client = supabase) {
  return {
    async createMany({ organizationId, pages }) {
      assertOrganizationScope(organizationId);
      pages.forEach((page) => {
        assertResourceId(page.document_version_id, "document_version_id");
        assertResourceId(page.analysis_run_id, "analysis_run_id");
      });

      if (!pages.length) return [];

      const { data, error } = await client
        .from("document_version_pages")
        .insert(pages.map((page) => ({ ...page, organization_id: organizationId })))
        .select("*");

      if (error) throw error;
      return data || [];
    },

    async listByVersion({ organizationId, documentVersionId, analysisRunId }) {
      assertOrganizationScope(organizationId);
      assertResourceId(documentVersionId, "documentVersionId");
      assertResourceId(analysisRunId, "analysisRunId");

      const { data, error } = await client
        .from("document_version_pages")
        .select("*")
        .eq("document_version_id", documentVersionId)
        .eq("analysis_run_id", analysisRunId)
        .eq("organization_id", organizationId)
        .order("page_number", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  };
}
