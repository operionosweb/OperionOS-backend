import supabase from "../../config/supabase.js";
import defaultPgPool from "../../db.js";
import { assertOrganizationScope, assertResourceId } from "./scope.js";

function insertQuery(table, columns, row) {
  const jsonColumns = new Set(["structured_timing", "recurrence", "metadata"]);
  return {
    sql: `insert into ${table} (${columns.join(", ")}) values (${columns.map((_, index) => `$${index + 1}`).join(", ")})`,
    values: columns.map((column) => {
      const value = row[column] === undefined ? null : row[column];
      return jsonColumns.has(column) && value !== null ? JSON.stringify(value) : value;
    }),
  };
}

function assertRunScope({ organizationId, contractId, documentId, documentVersionId, analysisRunId }) {
  assertOrganizationScope(organizationId);
  assertResourceId(contractId, "contractId");
  assertResourceId(documentId, "documentId");
  assertResourceId(documentVersionId, "documentVersionId");
  assertResourceId(analysisRunId, "analysisRunId");
}

export function createDeadlineRepository(client = supabase, pgPool = defaultPgPool) {
  return {
    async listByRunScope(scope) {
      assertRunScope(scope);
      const { data, error } = await client.from("deadlines").select("*")
        .eq("organization_id", scope.organizationId)
        .eq("contract_id", scope.contractId)
        .eq("document_id", scope.documentId)
        .eq("document_version_id", scope.documentVersionId)
        .eq("analysis_run_id", scope.analysisRunId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async listObligationsWithEvidence(scope) {
      assertRunScope(scope);
      const { data: obligations, error } = await client.from("obligations").select("*")
        .eq("organization_id", scope.organizationId)
        .eq("contract_id", scope.contractId)
        .eq("document_id", scope.documentId)
        .eq("document_version_id", scope.documentVersionId)
        .eq("analysis_run_id", scope.analysisRunId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!obligations?.length) return [];

      const obligationIds = obligations.map((row) => row.id);
      const { data: links, error: linksError } = await client.from("obligation_evidence")
        .select("organization_id, obligation_id, evidence_id, rank, support_type, is_primary")
        .eq("organization_id", scope.organizationId).in("obligation_id", obligationIds).order("rank", { ascending: true });
      if (linksError) throw linksError;
      const byObligation = new Map();
      for (const link of links || []) {
        if (!byObligation.has(link.obligation_id)) byObligation.set(link.obligation_id, []);
        byObligation.get(link.obligation_id).push(link);
      }
      return obligations.map((obligation) => ({ ...obligation, evidence: byObligation.get(obligation.id) || [] }));
    },

    async listClausesForDefinitions(scope) {
      assertRunScope(scope);
      const { data, error } = await client.from("clauses")
        .select("id, source_text")
        .eq("organization_id", scope.organizationId)
        .eq("contract_id", scope.contractId)
        .eq("document_id", scope.documentId)
        .eq("document_version_id", scope.documentVersionId)
        .eq("analysis_run_id", scope.analysisRunId);
      if (error) throw error;
      if (!data?.length) return [];
      const { data: links, error: linksError } = await client.from("clause_evidence")
        .select("clause_id, evidence_id, rank, is_primary")
        .eq("organization_id", scope.organizationId)
        .in("clause_id", data.map((clause) => clause.id))
        .order("rank", { ascending: true });
      if (linksError) throw linksError;
      return data.map((clause) => {
        const source = (links || []).find((link) => link.clause_id === clause.id && link.is_primary)
          || (links || []).find((link) => link.clause_id === clause.id);
        return { ...clause, source_evidence_id: source?.evidence_id || null };
      });
    },

    async persistDeadlines({ ...input }) {
      const { organizationId, contractId, documentId, documentVersionId, analysisRunId, deadlines } = input;
      assertRunScope(input);
      if (!deadlines.length) return { deadlines: [], insertedDeadlines: 0, insertedEvidenceLinks: 0 };
      const columns = [
        "organization_id", "contract_id", "document_id", "document_version_id", "analysis_run_id",
        "obligation_id", "source_clause_id", "source_evidence_id", "deadline_type", "original_expression",
        "timing_expression", "structured_timing", "trigger_type", "trigger_expression", "condition", "amount",
        "unit", "calendar_type", "absolute_date", "anchor_reference", "direction", "recurrence", "computability",
        "ambiguity", "confidence", "status", "review_status", "metadata", "deadline_identity",
      ];
      const pgClient = await pgPool.connect();
      try {
        await pgClient.query("BEGIN");
        const persisted = [];
        let insertedDeadlines = 0;
        let insertedEvidenceLinks = 0;
        for (const deadline of deadlines) {
          assertResourceId(deadline.obligation_id, "obligation_id");
          assertResourceId(deadline.source_clause_id, "source_clause_id");
          assertResourceId(deadline.source_evidence_id, "source_evidence_id");
          if (!deadline.evidence?.some((link) => link.is_primary)) throw Object.assign(new Error("Every deadline requires primary evidence"), { code: "DEADLINE_EVIDENCE_REQUIRED", status: 422 });
          const query = insertQuery("deadlines", columns, deadline);
          const result = await pgClient.query(`${query.sql} on conflict (organization_id, analysis_run_id, obligation_id, deadline_identity) do nothing returning *`, query.values);
          let row = result.rows[0];
          if (row) insertedDeadlines += 1;
          else {
            const existing = await pgClient.query(
              "select * from deadlines where organization_id = $1 and analysis_run_id = $2 and obligation_id = $3 and deadline_identity = $4 limit 1",
              [organizationId, analysisRunId, deadline.obligation_id, deadline.deadline_identity]
            );
            row = existing.rows[0];
          }
          if (!row) throw Object.assign(new Error("Deadline persistence failed"), { code: "DEADLINE_PERSISTENCE_FAILED", status: 503 });
          persisted.push(row);
          for (const link of deadline.evidence) {
            const linked = await pgClient.query(
              "insert into deadline_evidence (organization_id, deadline_id, evidence_id, rank, support_type, is_primary) values ($1, $2, $3, $4, $5, $6) on conflict (deadline_id, evidence_id) do nothing returning deadline_id",
              [organizationId, row.id, link.evidence_id, link.rank || 1, link.support_type || "supports", Boolean(link.is_primary)]
            );
            insertedEvidenceLinks += linked.rowCount;
          }
        }
        await pgClient.query("COMMIT");
        return { deadlines: persisted, insertedDeadlines, insertedEvidenceLinks };
      } catch (error) {
        try { await pgClient.query("ROLLBACK"); } catch {}
        throw error;
      } finally {
        pgClient.release();
      }
    },
  };
}