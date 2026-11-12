import supabase from "../../config/supabase.js";
import defaultPgPool from "../../db.js";

import { assertOrganizationScope, assertResourceId } from "./scope.js";
import { beginFencedAnalysisWrite, assertFenceContext } from "./fencedAnalysisWrite.js";

export function createAnalysisRunRepository(client = supabase, pgPool = defaultPgPool) {
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

    async claimQueued({ analysisRunId, organizationId, startedAt }) {
      assertResourceId(analysisRunId, "analysisRunId");
      assertOrganizationScope(organizationId);
      const { data, error } = await client.rpc("claim_analysis_execution", {
        p_organization_id: organizationId,
        p_analysis_run_id: analysisRunId,
      });
      if (error) throw error;
      const execution = Array.isArray(data) ? data[0] : data;
      if (!execution) return null;
      const fenceContext = {
        workerId: execution.worker_id,
        executionId: execution.execution_id,
        generation: execution.generation,
        token: execution.token,
      };
      assertFenceContext(fenceContext);
      const run = await this.getById(analysisRunId, organizationId);
      if (!run || run.status !== "processing") {
        throw Object.assign(new Error("The claimed analysis run could not be reloaded"), {
          code: "ANALYSIS_CLAIM_RELOAD_FAILED",
          status: 503,
        });
      }
      return { run, fenceContext };
    },

    async updateStatus({
      analysisRunId,
      organizationId,
      status,
      fence,
      startedAt = null,
      completedAt = null,
      errorCode = null,
      errorMessage = null,
    }) {
      assertResourceId(analysisRunId, "analysisRunId");
      assertOrganizationScope(organizationId);
      assertFenceContext(fence);
      const pgClient = await pgPool.connect();
      try {
        await pgClient.query("begin");
        await beginFencedAnalysisWrite(pgClient, { organizationId, analysisRunId, fence });
        const result = await pgClient.query(
          `update public.analysis_runs
              set status = $3, started_at = $4, completed_at = $5,
                  error_code = $6, error_message = $7
            where id = $1 and organization_id = $2
            returning *`,
          [analysisRunId, organizationId, status, startedAt, completedAt, errorCode, errorMessage]
        );
        if (!result.rows[0]) {
          throw Object.assign(new Error("Analysis run not found"), {
            code: "ANALYSIS_RUN_NOT_FOUND",
            status: 404,
          });
        }
        await pgClient.query("commit");
        return result.rows[0];
      } catch (error) {
        try { await pgClient.query("rollback"); } catch {}
        throw error;
      } finally {
        pgClient.release();
      }
    },

  };
}
