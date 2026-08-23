import supabase from "../../config/supabase.js";
import defaultPgPool from "../../db.js";
import { assertOrganizationScope, assertResourceId } from "./scope.js";

// Builds a single parameterized multi-row INSERT so all rows land in one round trip
// inside the caller's transaction.
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
    sql: `insert into ${table} (${columns.join(", ")}) values ${tuples.join(", ")} returning *`,
    values,
  };
}

async function insertRowsInTransaction(pgClient, table, columns, rows) {
  if (!rows.length) return [];
  const { sql, values } = buildInsertQuery(table, columns, rows);
  const { rows: returned } = await pgClient.query(sql, values);
  return returned;
}

export function createClauseRepository(client = supabase, pgPool = defaultPgPool) {
  return {
    async listByRun({ organizationId, documentVersionId, analysisRunId }) {
      assertOrganizationScope(organizationId);
      assertResourceId(documentVersionId, "documentVersionId");
      assertResourceId(analysisRunId, "analysisRunId");

      const { data, error } = await client
        .from("clauses")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("document_version_id", documentVersionId)
        .eq("analysis_run_id", analysisRunId)
        .order("clause_number", { ascending: true });

      if (error) throw error;
      return data || [];
    },

    async insertMany({ organizationId, clauses }) {
      assertOrganizationScope(organizationId);
      clauses.forEach((clause) => {
        assertResourceId(clause.contract_id, "contract_id");
        assertResourceId(clause.document_id, "document_id");
        assertResourceId(clause.document_version_id, "document_version_id");
        assertResourceId(clause.analysis_run_id, "analysis_run_id");
      });

      if (!clauses.length) return [];

      const { data, error } = await client
        .from("clauses")
        .insert(clauses.map((clause) => ({ ...clause, organization_id: organizationId })))
        .select("*");

      if (error) throw error;
      return data || [];
    },

    async deleteMany({ organizationId, clauseIds }) {
      assertOrganizationScope(organizationId);
      if (!clauseIds.length) return [];

      const { data, error } = await client
        .from("clauses")
        .delete()
        .in("id", clauseIds)
        .eq("organization_id", organizationId)
        .select("id");

      if (error) throw error;
      return data || [];
    },

    // Real PostgreSQL transaction (BEGIN/COMMIT/ROLLBACK) over the direct pg driver
    // already used elsewhere in this codebase (see db.js). This is NOT an
    // application-side compensation/rollback sequence: on any failure the whole
    // batch is rolled back by Postgres itself, and nothing is ever partially
    // visible to other readers. The Supabase JS client (PostgREST) cannot span a
    // transaction across multiple requests, so it is not used for the write path.
    async persistDeterministicClauseStage({
      organizationId,
      contractId,
      documentId,
      documentVersionId,
      analysisRunId,
      clauses,
      evidenceRows,
    }) {
      assertOrganizationScope(organizationId);
      assertResourceId(contractId, "contractId");
      assertResourceId(documentId, "documentId");
      assertResourceId(documentVersionId, "documentVersionId");
      assertResourceId(analysisRunId, "analysisRunId");

      if (!clauses.length) {
        return { clauses: [], evidence: [], clauseEvidence: [] };
      }

      const clauseColumns = [
        "id",
        "organization_id",
        "contract_id",
        "document_id",
        "document_version_id",
        "analysis_run_id",
        "parent_clause_id",
        "clause_number",
        "title",
        "category",
        "subtype",
        "source_text",
        "confidence",
        "review_status",
        "clause_identity",
      ];
      const evidenceColumns = [
        "organization_id",
        "contract_id",
        "document_id",
        "document_version_id",
        "analysis_run_id",
        "page_id",
        "page_number",
        "excerpt",
        "char_start",
        "char_end",
        "source_locator",
        "stage",
        "provider",
        "model",
        "prompt_version",
        "pipeline_version",
        "confidence",
        "review_status",
        "ambiguity_reason",
        "evidence_hash",
      ];
      const clauseEvidenceColumns = ["organization_id", "clause_id", "evidence_id", "rank", "support_type", "is_primary"];

      const clausesById = new Map(clauses.map((clause) => [clause.id, clause]));
      clauses.forEach((clause) => {
        if (!clause.parent_clause_id) return;
        const parent = clausesById.get(clause.parent_clause_id);
        if (!parent
          || parent.organization_id !== organizationId
          || parent.contract_id !== contractId
          || parent.document_id !== documentId
          || parent.document_version_id !== documentVersionId
          || parent.analysis_run_id !== analysisRunId) {
          throw new Error("Parent clause must belong to the same deterministic stage scope");
        }
      });

      const pgClient = await pgPool.connect();
      try {
        await pgClient.query("BEGIN");

        const clauseRows = clauses.map((clause) => ({ ...clause, organization_id: organizationId }));
        const insertedClauseRows = await insertRowsInTransaction(pgClient, "clauses", clauseColumns, clauseRows);

        // Postgres does not guarantee RETURNING order matches VALUES order, so
        // correlate by the deterministic clause_identity rather than array index.
        const clauseByIdentity = new Map(insertedClauseRows.map((row) => [row.clause_identity, row]));
        const orderedClauseRows = clauses.map((clause) => {
          const row = clauseByIdentity.get(clause.clause_identity);
          if (!row) {
            throw new Error(`Inserted clause row missing for clause_identity ${clause.clause_identity}`);
          }
          return row;
        });

        const evidenceInsertRows = evidenceRows.map((row) => ({ ...row, organization_id: organizationId }));
        const insertedEvidence = await insertRowsInTransaction(pgClient, "intelligence_evidence", evidenceColumns, evidenceInsertRows);

        const clauseEvidenceLinks = orderedClauseRows.map((clauseRow, index) => ({
          organization_id: organizationId,
          clause_id: clauseRow.id,
          evidence_id: insertedEvidence[index].id,
          rank: 1,
          support_type: "supports",
          is_primary: true,
        }));
        const insertedClauseEvidence = await insertRowsInTransaction(pgClient, "clause_evidence", clauseEvidenceColumns, clauseEvidenceLinks);

        await pgClient.query("COMMIT");

        return {
          clauses: orderedClauseRows,
          evidence: insertedEvidence,
          clauseEvidence: insertedClauseEvidence,
        };
      } catch (error) {
        try {
          await pgClient.query("ROLLBACK");
        } catch {
          // Connection is unusable (e.g. lost mid-transaction); Postgres discards
          // the aborted transaction server-side once the connection is closed.
        }
        throw error;
      } finally {
        pgClient.release();
      }
    },

    async insertEvidenceLinks({ organizationId, links }) {
      assertOrganizationScope(organizationId);
      links.forEach((link) => {
        assertResourceId(link.clause_id, "clause_id");
        assertResourceId(link.evidence_id, "evidence_id");
      });

      if (!links.length) return [];

      const { data, error } = await client
        .from("clause_evidence")
        .insert(links.map((link) => ({ ...link, organization_id: organizationId })))
        .select("*");

      if (error) throw error;
      return data || [];
    },
  };
}
