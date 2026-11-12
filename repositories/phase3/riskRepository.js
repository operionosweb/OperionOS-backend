import supabase from "../../config/supabase.js";
import defaultPgPool from "../../db.js";
import { assertOrganizationScope, assertResourceId } from "./scope.js";
import { beginFencedAnalysisWrite } from "./fencedAnalysisWrite.js";

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
      const evidenceIds = [...new Set(links.map((link) => link.evidence_id))];
      let evidenceSources = [];
      if (evidenceIds.length) {
        const result = await client.from("intelligence_evidence")
          .select("id, excerpt, page_number, source_locator, confidence, review_status, ambiguity_reason")
          .eq("organization_id", scope.organizationId)
          .eq("contract_id", scope.contractId)
          .eq("document_id", scope.documentId)
          .eq("document_version_id", scope.documentVersionId)
          .eq("analysis_run_id", scope.analysisRunId)
          .in("id", evidenceIds);
        if (result.error) throw result.error;
        evidenceSources = result.data || [];
      }
      const evidenceById = new Map(evidenceSources.map((source) => [source.id, source]));
      return {
        clauses: clauses.map((clause) => ({
          ...clause,
          evidence: links.filter((link) => link.clause_id === clause.id)
            .map((link) => ({ ...link, source: evidenceById.get(link.evidence_id) || null })),
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

    async persistRisks({ risks, reconciliationGroups, ...scope }) {
      assertRunScope(scope);
      if (!Array.isArray(risks)) throw new TypeError("risks must be an array");
      if (!Array.isArray(reconciliationGroups) || reconciliationGroups.some((group) => (
        typeof group.riskVersion !== "string" || !group.riskVersion || !Array.isArray(group.riskIdentities)
      ))) {
        throw new TypeError("valid reconciliation groups are required");
      }
      const columns = [
        "organization_id", "contract_id", "document_id", "document_version_id", "analysis_run_id",
        "clause_id", "risk_category", "risk_type", "title", "description", "rationale", "severity",
        "probability", "impact", "exposure", "explanation", "confidence", "source_type", "source_references",
        "financial_exposure", "consequence", "affected_obligation_ids", "affected_deadline_ids", "condition",
        "status", "risk_version", "metadata", "risk_identity", "review_status",
      ];
      const jsonColumns = new Set(["source_references", "financial_exposure", "metadata"]);
      const pgClient = await pgPool.connect();
      try {
        await pgClient.query("BEGIN");
        await beginFencedAnalysisWrite(pgClient, {
          organizationId: scope.organizationId,
          analysisRunId: scope.analysisRunId,
          fence: scope.fence,
        });
        const persisted = [];
        let insertedRisks = 0;
        let updatedRisks = 0;
        let supersededRisks = 0;
        let insertedEvidenceLinks = 0;
        for (const group of reconciliationGroups) {
          const superseded = await pgClient.query(
            `update risks
               set status = 'superseded',
                   metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
                     'superseded_reason', 'condition_not_detected_on_rerun',
                     'superseded_at', now()
                   )
             where organization_id = $1 and contract_id = $2 and document_id = $3
               and document_version_id = $4 and analysis_run_id = $5
               and risk_version = $6 and status not in ('superseded', 'resolved')
               and (risk_identity is null or not (risk_identity = any($7::text[])))
             returning id`,
            [
              scope.organizationId,
              scope.contractId,
              scope.documentId,
              scope.documentVersionId,
              scope.analysisRunId,
              group.riskVersion,
              group.riskIdentities,
            ]
          );
          supersededRisks += superseded.rowCount || 0;
        }

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
              `select * from risks
                where organization_id = $1 and contract_id = $2 and document_id = $3
                  and document_version_id = $4 and analysis_run_id = $5 and risk_identity = $6
                limit 1 for update`,
              [
                scope.organizationId,
                scope.contractId,
                scope.documentId,
                scope.documentVersionId,
                scope.analysisRunId,
                risk.risk_identity,
              ]
            );
            row = existing.rows[0];
            if (row) {
              const immutableColumns = new Set([
                "organization_id", "contract_id", "document_id", "document_version_id",
                "analysis_run_id", "risk_identity", "review_status", "status",
              ]);
              const updateColumns = columns.filter((column) => !immutableColumns.has(column));
              const updateValues = updateColumns.map((column) => {
                const value = risk[column] === undefined ? null : risk[column];
                return jsonColumns.has(column) && value !== null ? JSON.stringify(value) : value;
              });
              const parameter = (column, index) => jsonColumns.has(column) ? `$${index + 1}::jsonb` : `$${index + 1}`;
              const assignments = updateColumns.map((column, index) => column === "metadata"
                ? `metadata = (coalesce(metadata, '{}'::jsonb) - 'superseded_at' - 'superseded_reason') || ${parameter(column, index)}`
                : `${column} = ${parameter(column, index)}`);
              assignments.push(`status = case when status = 'superseded' then $${updateColumns.length + 1} else status end`);
              const changed = updateColumns.map((column, index) => (
                `(${column} is distinct from ${parameter(column, index)})`
              ));
              changed.push("status = 'superseded'");
              const updateResult = await pgClient.query(
                `update risks set ${assignments.join(", ")}
                  where id = $${updateColumns.length + 2}
                    and organization_id = $${updateColumns.length + 3}
                    and contract_id = $${updateColumns.length + 4}
                    and document_id = $${updateColumns.length + 5}
                    and document_version_id = $${updateColumns.length + 6}
                    and analysis_run_id = $${updateColumns.length + 7}
                    and (${changed.join(" or ")})
                  returning *`,
                [
                  ...updateValues,
                  risk.status,
                  row.id,
                  scope.organizationId,
                  scope.contractId,
                  scope.documentId,
                  scope.documentVersionId,
                  scope.analysisRunId,
                ]
              );
              if (updateResult.rows[0]) {
                row = updateResult.rows[0];
                updatedRisks += 1;
              }
            }
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
        return { risks: persisted, insertedRisks, updatedRisks, supersededRisks, insertedEvidenceLinks };
      } catch (error) {
        try { await pgClient.query("ROLLBACK"); } catch {}
        throw error;
      } finally {
        pgClient.release();
      }
    },
  };
}