import supabase from "../../config/supabase.js";
import defaultPgPool from "../../db.js";

import { assertOrganizationScope, assertResourceId } from "./scope.js";
import { beginFencedAnalysisWrite } from "./fencedAnalysisWrite.js";

const PORTFOLIO_SEARCH_LIMIT = 25;

export function createSearchChunkRepository(client = supabase, pgPool = defaultPgPool) {
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

    async replaceForRun({ organizationId, analysisRunId, chunks, fence }) {
      assertOrganizationScope(organizationId);
      assertResourceId(analysisRunId, "analysisRunId");
      const pgClient = await pgPool.connect();
      try {
        await pgClient.query("begin");
        await beginFencedAnalysisWrite(pgClient, { organizationId, analysisRunId, fence });
        await pgClient.query(
          "delete from public.contract_search_chunks where organization_id = $1 and analysis_run_id = $2",
          [organizationId, analysisRunId]
        );
        const persisted = [];
        for (const chunk of chunks) {
          assertResourceId(chunk.document_version_id, "document_version_id");
          if (chunk.analysis_run_id !== analysisRunId || chunk.organization_id !== organizationId) {
            throw Object.assign(new Error("Search chunk is outside the fenced analysis scope"), {
              code: "ANALYSIS_FENCE_SCOPE_MISMATCH",
              status: 409,
            });
          }
          const result = await pgClient.query(
            `insert into public.contract_search_chunks (
               organization_id, contract_id, document_id, document_version_id,
               analysis_run_id, chunk_index, text_content, char_start, char_end,
               page_start, page_end, text_hash, index_status
             ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             returning id, organization_id, document_version_id, analysis_run_id,
                       chunk_index, index_status`,
            [
              organizationId, chunk.contract_id, chunk.document_id, chunk.document_version_id,
              analysisRunId, chunk.chunk_index, chunk.text_content, chunk.char_start, chunk.char_end,
              chunk.page_start, chunk.page_end, chunk.text_hash, chunk.index_status,
            ]
          );
          persisted.push(result.rows[0]);
        }
        await pgClient.query("commit");
        return persisted;
      } catch (error) {
        try { await pgClient.query("rollback"); } catch {}
        throw error;
      } finally {
        pgClient.release();
      }
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

    async searchPortfolio({ organizationId, query, limit = 8 }) {
      assertOrganizationScope(organizationId);
      const normalized = String(query || "").trim();
      if (!normalized) return { results: [], incompleteReferences: false };
      const boundedLimit = Math.min(Math.max(Number(limit) || 8, 1), PORTFOLIO_SEARCH_LIMIT);
      const { data: chunks, error: searchError } = await client
        .from("contract_search_chunks")
        .select("id, organization_id, contract_id, document_id, document_version_id, analysis_run_id, text_content, char_start, char_end, page_start, page_end, index_status")
        .eq("organization_id", organizationId)
        .eq("index_status", "ready")
        .textSearch("search_vector", normalized, { config: "simple", type: "websearch" })
        .limit(boundedLimit);

      if (searchError) throw searchError;
      if (!chunks?.length) return { results: [], incompleteReferences: false };

      const runIds = [...new Set(chunks.map((chunk) => chunk.analysis_run_id).filter(Boolean))];
      const contractIds = [...new Set(chunks.map((chunk) => chunk.contract_id).filter(Boolean))];
      const versionIds = [...new Set(chunks.map((chunk) => chunk.document_version_id).filter(Boolean))];
      const [runsResult, contractsResult, versionsResult, clausesResult] = await Promise.all([
        client.from("analysis_runs")
          .select("id, organization_id, contract_id, document_version_id, status")
          .eq("organization_id", organizationId)
          .in("id", runIds),
        client.from("contracts")
          .select("id, organization_id, title")
          .eq("organization_id", organizationId)
          .in("id", contractIds),
        client.from("document_versions")
          .select("id, organization_id, version_number")
          .eq("organization_id", organizationId)
          .in("id", versionIds),
        client.from("clauses")
          .select("id, organization_id, contract_id, document_id, document_version_id, analysis_run_id, clause_number, title, source_text")
          .eq("organization_id", organizationId)
          .in("analysis_run_id", runIds),
      ]);
      if (runsResult.error) throw runsResult.error;
      if (contractsResult.error) throw contractsResult.error;
      if (versionsResult.error) throw versionsResult.error;
      if (clausesResult.error) throw clausesResult.error;

      const runsById = new Map((runsResult.data || [])
        .filter((run) => run.organization_id === organizationId && run.status === "completed")
        .map((run) => [run.id, run]));
      const contractsById = new Map((contractsResult.data || [])
        .filter((contract) => contract.organization_id === organizationId)
        .map((contract) => [contract.id, contract]));
      const versionsById = new Map((versionsResult.data || [])
        .filter((version) => version.organization_id === organizationId)
        .map((version) => [version.id, version]));
      const clausesByRun = new Map();
      for (const clause of clausesResult.data || []) {
        if (clause.organization_id !== organizationId) continue;
        if (!clausesByRun.has(clause.analysis_run_id)) clausesByRun.set(clause.analysis_run_id, []);
        clausesByRun.get(clause.analysis_run_id).push(clause);
      }
      let incompleteReferences = false;
      const results = [];

      for (const chunk of chunks) {
        if (chunk.organization_id !== organizationId) {
          incompleteReferences = true;
          continue;
        }
        const run = runsById.get(chunk.analysis_run_id);
        const contract = contractsById.get(chunk.contract_id);
        const version = versionsById.get(chunk.document_version_id);
        if (!run || run.contract_id !== chunk.contract_id || run.document_version_id !== chunk.document_version_id
          || !contract || !version) {
          incompleteReferences = true;
          continue;
        }
        const matchingClauses = (clausesByRun.get(run.id) || []).filter((clause) =>
          clause.contract_id === chunk.contract_id
          && clause.document_id === chunk.document_id
          && clause.document_version_id === chunk.document_version_id
          && String(clause.source_text || "").trim() === String(chunk.text_content || "").trim());
        if (matchingClauses.length !== 1) incompleteReferences = true;
        results.push({
          id: chunk.id,
          contractId: contract.id,
          contractTitle: contract.title,
          documentId: chunk.document_id,
          documentVersionId: version.id,
          versionNumber: version.version_number,
          analysisRunId: run.id,
          clause: matchingClauses.length === 1 ? {
            id: matchingClauses[0].id,
            number: matchingClauses[0].clause_number || null,
            title: matchingClauses[0].title || null,
          } : null,
          excerpt: chunk.text_content,
          pageStart: chunk.page_start,
          pageEnd: chunk.page_end,
          charStart: chunk.char_start,
          charEnd: chunk.char_end,
        });
      }

      return { results, incompleteReferences };
    },
  };
}
