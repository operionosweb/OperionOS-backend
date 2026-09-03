import supabase from "../../config/supabase.js";
import defaultPgPool from "../../db.js";
import { assertOrganizationScope, assertResourceId } from "./scope.js";

function assertRunScope({ organizationId, contractId, documentId, documentVersionId, analysisRunId }) {
  assertOrganizationScope(organizationId);
  assertResourceId(contractId, "contractId");
  assertResourceId(documentId, "documentId");
  assertResourceId(documentVersionId, "documentVersionId");
  assertResourceId(analysisRunId, "analysisRunId");
}

function insertQuery(table, columns, row) {
  const jsonColumns = new Set(["source_references", "financial_exposure", "metadata"]);
  return {
    sql: `insert into ${table} (${columns.join(", ")}) values (${columns.map((_, index) => `$${index + 1}`).join(", ")})`,
    values: columns.map((column) => {
      const value = row[column] === undefined ? null : row[column];
      return jsonColumns.has(column) && value !== null ? JSON.stringify(value) : value;
    }),
  };
}

export function createRiskRepository(client = supabase, pgPool = defaultPgPool) {
  return {
    async listIntelligence(scope) {
      assertRunScope(scope);
      const applyScope = (query) => query
        .eq("organization_id", scope.organizationId)
        .eq("contract_id", scope.contractId)
        .eq("document_id", scope.documentId)
        .eq("document_version_id", scope.documentVersionId)
        .eq("analysis_run_id", scope.analysisRunId);
      const [clausesResult, obligationsResult, deadlinesResult] = await Promise.all([
        applyScope(client.from("clauses").select("id, clause_number, title, category, source_text, confidence, review_status"))
          .order("created_at", { ascending: true }),
        applyScope(client.from("obligations").select("*"))
          .order("created_at", { ascending: true }),
        applyScope(client.from("deadlines").select("*"))
          .order("created_at", { ascending: true }),
      ]);
      if (clausesResult.error) throw clausesResult.error;
      if (obligationsResult.error) throw obligationsResult.error;
      if (deadlinesResult.error) throw deadlinesResult.error;
      const clauses = clausesResult.data || [];
      let links = [];
      if (clauses.length) {
        const result = await client.from("clause_evidence")
          .select("organization_id, clause_id, evidence_id, rank, support_type, is_primary")
          .eq("organization_id", scope.organizationId)
          .in("clause_id", clauses.map((clause) => clause.id))
          .order("rank", { ascending: true });
        if (result.error) throw result.error;
        links = result.data || [];
      }
      return {
        clauses: clauses.map((clause) => ({
          ...clause,
          evidence: links.filter((link) => link.clause_id === clause.id),
        })),
        obligations: obligationsResult.data || [],
        deadlines: deadlinesResult.data || [],
      };
    },

    async listByRunScope(scope) {
      assertRunScope(scope);
      const { data, error } = await client.from("risks").select("*")
        .eq("organization_id", scope.organizationId)
        .eq("contract_id", scope.contractId)
        .eq("document_id", scope.documentId)
        .eq("document_version_id", scope.documentVersionId)
        .eq("analysis_run_id", scope.analysisRunId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!data?.length) return [];
      const { data: evidence, error: evidenceError } = await client.from("risk_evidence")
        .select("risk_id, evidence_id, rank, support_type, is_primary")
        .eq("organization_id", scope.organizationId)
        .in("risk_id", data.map((risk) => risk.id))
        .order("rank", { ascending: true });
      if (evidenceError) throw evidenceError;
      const evidenceIds = [...new Set((evidence || []).map((link) => link.evidence_id))];
      let sources = [];
      if (evidenceIds.length) {
        const result = await client.from("intelligence_evidence")
          .select("id, excerpt, page_number, char_start, char_end, source_locator, confidence, review_status")
          .eq("organization_id", scope.organizationId)
          .eq("contract_id", scope.contractId)
          .eq("document_id", scope.documentId)
          .eq("document_version_id", scope.documentVersionId)
          .eq("analysis_run_id", scope.analysisRunId)
          .in("id", evidenceIds);
        if (result.error) throw result.error;
        sources = result.data || [];
      }
      const sourcesById = new Map(sources.map((source) => [source.id, source]));
      return data.map((risk) => ({
        ...risk,
        evidence: (evidence || []).filter((link) => link.risk_id === risk.id)
          .map((link) => ({ ...link, source: sourcesById.get(link.evidence_id) || null })),
      }));
    },

    async persistRisks({ risks, ...scope }) {
      assertRunScope(scope);
      if (!risks.length) return { risks: [], insertedRisks: 0, insertedEvidenceLinks: 0 };
      const columns = [
        "organization_id", "contract_id", "document_id", "document_version_id", "analysis_run_id",
        "clause_id", "risk_category", "risk_type", "title", "description", "rationale", "severity",
        "probability", "impact", "exposure", "explanation", "confidence", "source_type", "source_references",
        "financial_exposure", "consequence", "affected_obligation_ids", "affected_deadline_ids", "condition",
        "status", "risk_version", "metadata", "risk_identity", "review_status",
      ];
      const pgClient = await pgPool.connect();
      try {
        await pgClient.query("BEGIN");
        const persisted = [];
        let insertedRisks = 0;
        let insertedEvidenceLinks = 0;
        for (const risk of risks) {
          if (!risk.evidence?.length || !risk.evidence.some((link) => link.is_primary)) {
            throw Object.assign(new Error("Every risk requires primary evidence"), { code: "RISK_EVIDENCE_REQUIRED", status: 422 });
          }
          const query = insertQuery("risks", columns, risk);
          const result = await pgClient.query(
            `${query.sql} on conflict (organization_id, analysis_run_id, risk_identity) do nothing returning *`,
            query.values
          );
          let row = result.rows[0];
          if (row) insertedRisks += 1;
          else {
            const existing = await pgClient.query(
              "select * from risks where organization_id = $1 and analysis_run_id = $2 and risk_identity = $3 limit 1",
              [scope.organizationId, scope.analysisRunId, risk.risk_identity]
            );
            row = existing.rows[0];
          }
          if (!row) throw Object.assign(new Error("Risk persistence failed"), { code: "RISK_PERSISTENCE_FAILED", status: 503 });
          persisted.push(row);
          for (const link of risk.evidence) {
            assertResourceId(link.evidence_id, "evidence_id");
            const linked = await pgClient.query(
              "insert into risk_evidence (organization_id, risk_id, evidence_id, rank, support_type, is_primary) values ($1, $2, $3, $4, $5, $6) on conflict (risk_id, evidence_id) do nothing returning risk_id",
              [scope.organizationId, row.id, link.evidence_id, link.rank || 1, link.support_type || "supports", Boolean(link.is_primary)]
            );
            insertedEvidenceLinks += linked.rowCount;
          }
        }
        await pgClient.query("COMMIT");
        return { risks: persisted, insertedRisks, insertedEvidenceLinks };
      } catch (error) {
        try { await pgClient.query("ROLLBACK"); } catch {}
        throw error;
      } finally {
        pgClient.release();
      }
    },
  };
}