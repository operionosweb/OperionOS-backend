import supabase from "../../config/supabase.js";

import { assertOrganizationScope, assertResourceId } from "./scope.js";

export function createAnalysisRunRepository(client = supabase) {
  return {
    async getById(analysisRunId, organizationId) {
      assertResourceId(analysisRunId, "analysisRunId");
      assertOrganizationScope(organizationId);

      const { data, error } = await client
        .from("analysis_runs")
        .select("*")
        .eq("id", analysisRunId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    async updateStatus({
      analysisRunId,
      organizationId,
      status,
      startedAt = null,
      completedAt = null,
      errorCode = null,
      errorMessage = null,
    }) {
      assertResourceId(analysisRunId, "analysisRunId");
      assertOrganizationScope(organizationId);

      const { data, error } = await client
        .from("analysis_runs")
        .update({
          status,
          started_at: startedAt,
          completed_at: completedAt,
          error_code: errorCode,
          error_message: errorMessage,
        })
        .eq("id", analysisRunId)
        .eq("organization_id", organizationId)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },

    async createRetry({ run, organizationId }) {
      assertOrganizationScope(organizationId);
      assertResourceId(run.contract_id, "contract_id");
      assertResourceId(run.document_version_id, "document_version_id");
      assertResourceId(run.requested_by, "requested_by");

      const { data, error } = await client
        .from("analysis_runs")
        .insert({
          organization_id: organizationId,
          contract_id: run.contract_id,
          document_version_id: run.document_version_id,
          status: "processing",
          pipeline_version: run.pipeline_version,
          intelligence_schema_version: run.intelligence_schema_version || "phase3a-v1",
          extraction_version: run.extraction_version || null,
          prompt_version: run.prompt_version || null,
          provider: run.provider || null,
          model: run.model || null,
          retry_count: Number(run.retry_count || 0) + 1,
          requested_by: run.requested_by,
          started_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
  };
}
