import supabase from "../../config/supabase.js";
import defaultPgPool from "../../db.js";
import { assertOrganizationScope, assertResourceId } from "./scope.js";

function buildInsertQuery(table, columns, rows) {
  const values = [];
  const tuples = rows.map((row, rowIndex) => {
    const placeholders = columns.map((column, columnIndex) => {
      values.push(row[column] === undefined ? null : row[column]);
      return `$${rowIndex * columns.length + columnIndex + 1}`;
    });
    return `(${placeholders.join(", ")})`;
  });

  return {
    sql: `insert into ${table} (${columns.join(", ")}) values ${tuples.join(", ")}`,
    values,
  };
}

function stageError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

export function createObligationRepository(client = supabase, pgPool = defaultPgPool) {
  return {
    async listByRunScope({
      organizationId,
      contractId,
      documentId,
      documentVersionId,
      analysisRunId,
    }) {
      assertOrganizationScope(organizationId);
      assertResourceId(contractId, "contractId");
      assertResourceId(documentId, "documentId");
      assertResourceId(documentVersionId, "documentVersionId");
      assertResourceId(analysisRunId, "analysisRunId");

      const { data, error } = await client
        .from("obligations")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("contract_id", contractId)
        .eq("document_id", documentId)
        .eq("document_version_id", documentVersionId)
        .eq("analysis_run_id", analysisRunId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },

    async listClausesByRunScope({
      organizationId,
      contractId,
      documentId,
      documentVersionId,
      analysisRunId,
    }) {
      assertOrganizationScope(organizationId);
      assertResourceId(contractId, "contractId");
      assertResourceId(documentId, "documentId");
      assertResourceId(documentVersionId, "documentVersionId");
      assertResourceId(analysisRunId, "analysisRunId");

      const { data, error } = await client
        .from("clauses")
        .select("id, organization_id, contract_id, document_id, document_version_id, analysis_run_id, clause_number, title, source_text")
        .eq("organization_id", organizationId)
        .eq("contract_id", contractId)
        .eq("document_id", documentId)
        .eq("document_version_id", documentVersionId)
        .eq("analysis_run_id", analysisRunId)
        .order("clause_number", { ascending: true });

      if (error) throw error;
      return data || [];
    },

    async listClauseEvidenceLinks({ organizationId, clauseIds }) {
      assertOrganizationScope(organizationId);
      if (!Array.isArray(clauseIds) || clauseIds.length === 0) return [];

      const { data, error } = await client
        .from("clause_evidence")
        .select("organization_id, clause_id, evidence_id, rank, support_type, is_primary")
        .eq("organization_id", organizationId)
        .in("clause_id", clauseIds)
        .order("rank", { ascending: true });

      if (error) throw error;
      return data || [];
    },

    async listEvidenceByScopeAndIds({
      organizationId,
      contractId,
      documentId,
      documentVersionId,
      analysisRunId,
      evidenceIds,
    }) {
      assertOrganizationScope(organizationId);
      assertResourceId(contractId, "contractId");
      assertResourceId(documentId, "documentId");
      assertResourceId(documentVersionId, "documentVersionId");
      assertResourceId(analysisRunId, "analysisRunId");
      if (!Array.isArray(evidenceIds) || evidenceIds.length === 0) return [];

      const { data, error } = await client
        .from("intelligence_evidence")
        .select("id, organization_id, contract_id, document_id, document_version_id, analysis_run_id, excerpt, page_number, char_start, char_end, evidence_hash")
        .eq("organization_id", organizationId)
        .eq("contract_id", contractId)
        .eq("document_id", documentId)
        .eq("document_version_id", documentVersionId)
        .eq("analysis_run_id", analysisRunId)
        .in("id", evidenceIds);

      if (error) throw error;
      return data || [];
    },

    async persistDeterministicObligationStage({
      organizationId,
      contractId,
      documentId,
      documentVersionId,
      analysisRunId,
      obligations,
      obligationEvidenceByIdentity,
    }) {
      assertOrganizationScope(organizationId);
      assertResourceId(contractId, "contractId");
      assertResourceId(documentId, "documentId");
      assertResourceId(documentVersionId, "documentVersionId");
      assertResourceId(analysisRunId, "analysisRunId");

      if (!Array.isArray(obligations) || obligations.length === 0) {
        return {
          obligations: [],
          obligationEvidence: [],
          insertedObligations: 0,
          insertedEvidenceLinks: 0,
        };
      }

      const obligationColumns = [
        "organization_id",
        "contract_id",
        "document_id",
        "document_version_id",
        "analysis_run_id",
        "clause_id",
        "description",
        "obligation_type",
        "trigger_expression",
        "conditionality",
        "frequency",
        "priority",
        "status",
        "confidence",
        "review_status",
        "actor",
        "action",
        "object",
        "beneficiary",
        "condition",
        "timing_expression",
        "consequence",
        "modality",
        "metadata",
        "obligation_identity",
      ];

      const pgClient = await pgPool.connect();
      try {
        await pgClient.query("BEGIN");

        const resolvedObligations = [];
        let insertedObligations = 0;

        for (const obligation of obligations) {
          assertResourceId(obligation.clause_id, "clause_id");
          const links = obligationEvidenceByIdentity.get(obligation.obligation_identity) || [];
          if (!links.length) {
            throw stageError("OBLIGATION_EVIDENCE_REQUIRED", "Every obligation must include at least one evidence link", 422);
          }
          if (!links.some((link) => link.is_primary === true)) {
            throw stageError("PRIMARY_EVIDENCE_REQUIRED", "Every obligation must include one primary evidence link", 422);
          }

          const insertQuery = buildInsertQuery("obligations", obligationColumns, [{
            ...obligation,
            metadata: obligation.metadata ?? {},
          }]);
          const { rows: insertedRows } = await pgClient.query(
            `${insertQuery.sql} on conflict (organization_id, analysis_run_id, clause_id, obligation_identity) do nothing returning *`,
            insertQuery.values
          );

          let persisted = insertedRows[0] || null;
          if (persisted) {
            insertedObligations += 1;
          } else {
            const existing = await pgClient.query(
              `select *
                 from obligations
                where organization_id = $1
                  and contract_id = $2
                  and document_id = $3
                  and document_version_id = $4
                  and analysis_run_id = $5
                  and clause_id = $6
                  and obligation_identity = $7
                limit 1`,
              [
                organizationId,
                contractId,
                documentId,
                documentVersionId,
                analysisRunId,
                obligation.clause_id,
                obligation.obligation_identity,
              ]
            );
            persisted = existing.rows[0] || null;
          }

          if (!persisted) {
            throw stageError("OBLIGATION_PERSISTENCE_FAILED", "Obligation insert did not return a persisted row", 503);
          }

          resolvedObligations.push(persisted);
        }

        const obligationIdByIdentity = new Map(
          resolvedObligations.map((row) => [row.obligation_identity, row.id])
        );

        const linkRows = [];
        for (const [identity, links] of obligationEvidenceByIdentity.entries()) {
          const obligationId = obligationIdByIdentity.get(identity);
          if (!obligationId) {
            throw stageError("OBLIGATION_LINK_RESOLUTION_FAILED", "Unable to map obligation identity to persisted obligation", 503);
          }
          for (const link of links) {
            assertResourceId(link.evidence_id, "evidence_id");
            linkRows.push({
              organization_id: organizationId,
              obligation_id: obligationId,
              evidence_id: link.evidence_id,
              rank: link.rank || 1,
              support_type: link.support_type || "supports",
              is_primary: Boolean(link.is_primary),
            });
          }
        }

        const linkColumns = [
          "organization_id",
          "obligation_id",
          "evidence_id",
          "rank",
          "support_type",
          "is_primary",
        ];

        let insertedEvidenceLinks = 0;
        let insertedLinkRows = [];
        if (linkRows.length) {
          const linkQuery = buildInsertQuery("obligation_evidence", linkColumns, linkRows);
          const response = await pgClient.query(
            `${linkQuery.sql} on conflict (obligation_id, evidence_id) do nothing returning *`,
            linkQuery.values
          );
          insertedLinkRows = response.rows || [];
          insertedEvidenceLinks = insertedLinkRows.length;
        }

        await pgClient.query("COMMIT");

        return {
          obligations: resolvedObligations,
          obligationEvidence: insertedLinkRows,
          insertedObligations,
          insertedEvidenceLinks,
        };
      } catch (error) {
        try {
          await pgClient.query("ROLLBACK");
        } catch {
          // Best-effort rollback guard for broken connections.
        }
        throw error;
      } finally {
        pgClient.release();
      }
    },
  };
}
