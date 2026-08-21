import supabase from "../../config/supabase.js";

import { assertOrganizationScope, assertResourceId } from "./scope.js";

export function createEvidenceRepository(client = supabase) {
  return {
    async create({ organizationId, evidence }) {
      assertOrganizationScope(organizationId);
      assertResourceId(evidence.contract_id, "contract_id");
      assertResourceId(evidence.document_id, "document_id");
      assertResourceId(evidence.document_version_id, "document_version_id");
      assertResourceId(evidence.analysis_run_id, "analysis_run_id");

      const { data, error } = await client
        .from("intelligence_evidence")
        .insert({ ...evidence, organization_id: organizationId })
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },

    async deleteMany({ organizationId, evidenceIds }) {
      assertOrganizationScope(organizationId);
      if (!evidenceIds.length) return [];

      const { data, error } = await client
        .from("intelligence_evidence")
        .delete()
        .in("id", evidenceIds)
        .eq("organization_id", organizationId)
        .select("id");

      if (error) throw error;
      return data || [];
    },

    async listByRun({ organizationId, analysisRunId }) {
      assertOrganizationScope(organizationId);
      assertResourceId(analysisRunId, "analysisRunId");

      const { data, error } = await client
        .from("intelligence_evidence")
        .select("*")
        .eq("analysis_run_id", analysisRunId)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  };
}
