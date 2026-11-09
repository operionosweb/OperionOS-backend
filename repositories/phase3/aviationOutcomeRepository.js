import defaultPgPool from "../../db.js";
import { assertOrganizationScope, assertResourceId } from "./scope.js";

function repositoryError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function validateScope(scope) {
  assertOrganizationScope(scope.organizationId);
  for (const [field, value] of Object.entries({
    contractId: scope.contractId,
    documentVersionId: scope.documentVersionId,
    analysisRunId: scope.analysisRunId,
    clauseId: scope.clauseId,
    obligationId: scope.obligationId,
  })) assertResourceId(value, field);
}

async function validateSourceScope(connection, scope) {
  const result = await connection.query(
    `select o.id, o.document_id
       from obligations o
       join clauses c
         on c.id = o.clause_id
        and c.organization_id = o.organization_id
        and c.contract_id = o.contract_id
        and c.document_version_id = o.document_version_id
        and c.analysis_run_id = o.analysis_run_id
      where o.id = $1
        and o.organization_id = $2
        and o.contract_id = $3
        and o.document_version_id = $4
        and o.analysis_run_id = $5
        and o.clause_id = $6
        and o.review_status = 'verified'
        and c.review_status = 'verified'
      for share of o, c`,
    [
      scope.obligationId,
      scope.organizationId,
      scope.contractId,
      scope.documentVersionId,
      scope.analysisRunId,
      scope.clauseId,
    ]
  );
  if (!result.rows[0]) {
    throw repositoryError("AVIATION_OUTCOME_CONTRACT_SCOPE_INVALID", "A verified obligation and clause in this contract version are required", 422);
  }
  return result.rows[0];
}

async function validateEvidence(connection, { scope, evidence, contractDocumentId, requireVerified }) {
  const evidenceIds = evidence.map((item) => item.evidenceId);
  const result = await connection.query(
    `select e.id, e.review_status, e.document_id, e.document_version_id,
            e.analysis_run_id, e.page_number, e.source_locator, e.excerpt,
            d.filename as document_name, v.version_number
       from intelligence_evidence e
       join documents d
         on d.id = e.document_id
        and d.organization_id = e.organization_id
        and d.contract_id = e.contract_id
       join document_versions v
         on v.id = e.document_version_id
        and v.organization_id = e.organization_id
        and v.document_id = e.document_id
       join analysis_runs ar
         on ar.id = e.analysis_run_id
        and ar.organization_id = e.organization_id
        and ar.contract_id = e.contract_id
        and ar.document_version_id = e.document_version_id
      where e.id = any($1::uuid[])
        and e.organization_id = $2
        and e.contract_id = $3
        and e.document_id <> $4
        and e.document_version_id = $5
        and e.analysis_run_id = $6
        and e.review_status <> 'rejected'
        and v.extraction_status = 'completed'
        and ar.status = 'completed'
      for share of e`,
    [evidenceIds, scope.organizationId, scope.contractId, contractDocumentId, scope.documentVersionId, scope.analysisRunId]
  );
  if (result.rows.length !== evidenceIds.length) {
    throw repositoryError("AVIATION_OUTCOME_EVIDENCE_SCOPE_INVALID", "Every evidence reference must belong to a completed, non-source document in this contract", 422);
  }
  if (requireVerified && result.rows.some((item) => item.review_status !== "verified")) {
    throw repositoryError("AVIATION_OUTCOME_EVIDENCE_NOT_VERIFIED", "A verified actual outcome requires individually verified source evidence", 422);
  }
  return result.rows;
}

function handleUniqueViolation(error, entity) {
  if (error?.code === "23505") {
    throw repositoryError(
      entity === "outcome" ? "AVIATION_OUTCOME_DUPLICATE" : "AVIATION_FORECAST_DUPLICATE",
      entity === "outcome"
        ? "This outcome is already recorded; submit a linked correction if the prior record is wrong"
        : "This forecast snapshot already exists",
      409,
    );
  }
}

async function rollback(connection, error) {
  try {
    await connection.query("ROLLBACK");
  } catch {
    error.rollbackFailed = true;
  }
  throw error;
}

export function createAviationOutcomeRepository(pgPool = defaultPgPool) {
  return {
    async listOutcomes(scope) {
      assertOrganizationScope(scope.organizationId);
      assertResourceId(scope.contractId, "contractId");
      assertResourceId(scope.documentVersionId, "documentVersionId");
      assertResourceId(scope.analysisRunId, "analysisRunId");
      const result = await pgPool.query(
        `select o.id, o.organization_id, o.contract_id, o.document_version_id,
                o.analysis_run_id, o.clause_id, o.obligation_id, o.outcome_type,
                o.classification, o.value, o.unit, o.measurement_basis, o.currency, o.asset_identifier,
                o.period_start, o.period_end, o.methodology, o.reviewer_user_id,
                o.verified_at, o.supersedes_outcome_id, o.correction_reason,
                o.created_at,
                exists (
                  select 1 from aviation_contract_outcomes newer
                   where newer.supersedes_outcome_id = o.id
                     and newer.organization_id = o.organization_id
                     and newer.contract_id = o.contract_id
                ) as is_superseded,
                coalesce(jsonb_agg(jsonb_build_object(
                  'evidenceId', e.id,
                  'documentId', e.document_id,
                  'documentName', d.filename,
                  'documentVersionId', e.document_version_id,
                  'versionNumber', v.version_number,
                  'analysisRunId', e.analysis_run_id,
                  'pageNumber', e.page_number,
                  'sourceLocator', e.source_locator,
                  'excerpt', e.excerpt,
                  'reviewStatus', e.review_status,
                  'relationship', oe.relationship,
                  'periodStatus', oe.period_status,
                  'reviewerNote', oe.reviewer_note
                ) order by e.created_at, e.id) filter (where e.id is not null), '[]'::jsonb) as evidence
           from aviation_contract_outcomes o
           left join aviation_contract_outcome_evidence oe
             on oe.outcome_id = o.id
            and oe.organization_id = o.organization_id
            and oe.contract_id = o.contract_id
           left join intelligence_evidence e
             on e.id = oe.evidence_id
            and e.organization_id = oe.organization_id
            and e.contract_id = oe.contract_id
           left join documents d
             on d.id = e.document_id
            and d.organization_id = e.organization_id
            and d.contract_id = e.contract_id
           left join document_versions v
             on v.id = e.document_version_id
            and v.organization_id = e.organization_id
            and v.document_id = e.document_id
          where o.organization_id = $1
            and o.contract_id = $2
            and o.document_version_id = $3
            and o.analysis_run_id = $4
          group by o.id
          order by o.created_at, o.id
          limit 1000`,
        [scope.organizationId, scope.contractId, scope.documentVersionId, scope.analysisRunId]
      );
      return result.rows;
    },

    async createOutcome(input) {
      const scope = input;
      validateScope(scope);
      assertResourceId(input.reviewerUserId, "reviewerUserId");
      const connection = await pgPool.connect();
      try {
        await connection.query("BEGIN");
        const obligation = await validateSourceScope(connection, scope);
        const evidenceRows = await validateEvidence(connection, {
          scope,
          evidence: input.evidence,
          contractDocumentId: obligation.document_id,
          requireVerified: input.classification === "verified_actual",
        });
        if (input.supersedesOutcomeId) {
          const previous = await connection.query(
            `select id, obligation_id, clause_id, outcome_type, unit, measurement_basis, currency,
                    period_start, period_end
               from aviation_contract_outcomes
              where id = $1
                and organization_id = $2
                and contract_id = $3
                and document_version_id = $4
                and analysis_run_id = $5
              for update`,
            [input.supersedesOutcomeId, input.organizationId, input.contractId, input.documentVersionId, input.analysisRunId]
          );
          const row = previous.rows[0];
          if (!row || row.obligation_id !== input.obligationId || row.clause_id !== input.clauseId
            || row.outcome_type !== input.outcomeType || row.unit !== input.unit
            || row.measurement_basis !== input.measurementBasis || row.currency !== input.currency
            || String(row.period_start).slice(0, 10) !== input.periodStart
            || String(row.period_end).slice(0, 10) !== input.periodEnd) {
            throw repositoryError("AVIATION_OUTCOME_CORRECTION_SCOPE_INVALID", "A correction must preserve the original outcome, clause, obligation, unit, and reporting period", 422);
          }
          const successor = await connection.query(
            `select id from aviation_contract_outcomes where supersedes_outcome_id = $1 limit 1`,
            [input.supersedesOutcomeId]
          );
          if (successor.rows.length) {
            throw repositoryError("AVIATION_OUTCOME_ALREADY_SUPERSEDED", "Only the latest outcome record can be corrected", 409);
          }
        }
        const inserted = await connection.query(
          `insert into aviation_contract_outcomes
            (organization_id, contract_id, document_version_id, analysis_run_id,
             clause_id, obligation_id, outcome_type, classification, value, unit, measurement_basis,
             currency, asset_identifier, period_start, period_end, methodology,
             reviewer_user_id, verified_at, supersedes_outcome_id, correction_reason,
             dedupe_key)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
           returning id, organization_id, contract_id, document_version_id, analysis_run_id,
                     clause_id, obligation_id, outcome_type, classification, value,
                     unit, measurement_basis, currency, asset_identifier, period_start, period_end,
                     methodology, reviewer_user_id, verified_at, supersedes_outcome_id,
                     correction_reason, created_at`,
          [
            input.organizationId, input.contractId, input.documentVersionId, input.analysisRunId,
            input.clauseId, input.obligationId, input.outcomeType, input.classification, input.value,
            input.unit, input.measurementBasis, input.currency, input.assetIdentifier, input.periodStart, input.periodEnd,
            input.methodology, input.reviewerUserId, input.verifiedAt, input.supersedesOutcomeId,
            input.correctionReason, input.dedupeKey,
          ]
        );
        const outcome = inserted.rows[0];
        for (const evidence of input.evidence) {
          await connection.query(
            `insert into aviation_contract_outcome_evidence
              (outcome_id, organization_id, contract_id, evidence_id, relationship, period_status, reviewer_note)
             values ($1,$2,$3,$4,$5,$6,$7)`,
            [outcome.id, input.organizationId, input.contractId, evidence.evidenceId, evidence.relationship, evidence.periodStatus, evidence.reviewerNote]
          );
        }
        await connection.query("COMMIT");
        return { ...outcome, evidence: evidenceRows.map((row) => ({
          evidenceId: row.id,
          documentId: row.document_id,
          documentName: row.document_name,
          documentVersionId: row.document_version_id,
          versionNumber: row.version_number,
          analysisRunId: row.analysis_run_id,
          pageNumber: row.page_number,
          sourceLocator: row.source_locator,
          excerpt: row.excerpt,
          reviewStatus: row.review_status,
        })) };
      } catch (error) {
        try {
          handleUniqueViolation(error, "outcome");
        } catch (mappedError) {
          await rollback(connection, mappedError);
        }
        await rollback(connection, error);
      } finally {
        connection.release();
      }
    },

    async createForecastSnapshot(input) {
      const scope = input;
      validateScope(scope);
      assertResourceId(input.reviewerUserId, "reviewerUserId");
      if (!input.evidenceIds.length) {
        throw repositoryError("AVIATION_FORECAST_EVIDENCE_REQUIRED", "A forecast snapshot needs its original supporting evidence", 422);
      }
      const connection = await pgPool.connect();
      try {
        await connection.query("BEGIN");
        const obligation = await validateSourceScope(connection, scope);
        const evidenceRows = await validateEvidence(connection, {
          scope,
          evidence: input.evidenceIds.map((evidenceId) => ({ evidenceId })),
          contractDocumentId: obligation.document_id,
          requireVerified: true,
        });
        const inserted = await connection.query(
          `insert into aviation_forecast_snapshots
            (organization_id, contract_id, document_version_id, analysis_run_id,
             clause_id, obligation_id, forecast_type, metric, unit, contractual_limit,
             generated_at, last_observed_date, estimated_threshold_date,
             forecast_horizon_days, inputs, assumption, methodology_version, created_by, dedupe_key)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18,$19)
           returning id, organization_id, contract_id, document_version_id, analysis_run_id,
                     clause_id, obligation_id, forecast_type, metric, unit, contractual_limit,
                     generated_at, last_observed_date, estimated_threshold_date,
                     forecast_horizon_days, inputs, assumption, methodology_version, created_by, created_at`,
          [
            input.organizationId, input.contractId, input.documentVersionId, input.analysisRunId,
            input.clauseId, input.obligationId, input.forecastType, input.metric, input.unit,
            input.contractualLimit, input.generatedAt, input.lastObservedDate,
            input.estimatedThresholdDate, input.forecastHorizonDays, JSON.stringify(input.inputs),
            input.assumption, input.methodologyVersion, input.reviewerUserId, input.dedupeKey,
          ]
        );
        const snapshot = inserted.rows[0];
        for (const evidenceId of input.evidenceIds) {
          await connection.query(
            `insert into aviation_forecast_snapshot_evidence
              (snapshot_id, organization_id, contract_id, evidence_id)
             values ($1,$2,$3,$4)`,
            [snapshot.id, input.organizationId, input.contractId, evidenceId]
          );
        }
        await connection.query("COMMIT");
        return { ...snapshot, evidence: evidenceRows.map((item) => ({
          evidenceId: item.id,
          documentId: item.document_id,
          documentName: item.document_name,
          documentVersionId: item.document_version_id,
          versionNumber: item.version_number,
          analysisRunId: item.analysis_run_id,
          pageNumber: item.page_number,
          sourceLocator: item.source_locator,
          excerpt: item.excerpt,
          reviewStatus: item.review_status,
        })) };
      } catch (error) {
        try {
          handleUniqueViolation(error, "snapshot");
        } catch (mappedError) {
          await rollback(connection, mappedError);
        }
        await rollback(connection, error);
      } finally {
        connection.release();
      }
    },

    async listForecastSnapshots(scope) {
      assertOrganizationScope(scope.organizationId);
      assertResourceId(scope.contractId, "contractId");
      assertResourceId(scope.documentVersionId, "documentVersionId");
      assertResourceId(scope.analysisRunId, "analysisRunId");
      const result = await pgPool.query(
        `select s.*,
                coalesce(jsonb_agg(jsonb_build_object(
                  'evidenceId', e.id,
                  'documentId', e.document_id,
                  'documentName', d.filename,
                  'documentVersionId', e.document_version_id,
                  'versionNumber', v.version_number,
                  'analysisRunId', e.analysis_run_id,
                  'pageNumber', e.page_number,
                  'sourceLocator', e.source_locator,
                  'excerpt', e.excerpt,
                  'reviewStatus', e.review_status
                ) order by e.created_at, e.id) filter (where e.id is not null), '[]'::jsonb) as evidence
           from aviation_forecast_snapshots s
           left join aviation_forecast_snapshot_evidence se
             on se.snapshot_id = s.id
            and se.organization_id = s.organization_id
            and se.contract_id = s.contract_id
           left join intelligence_evidence e
             on e.id = se.evidence_id
            and e.organization_id = se.organization_id
            and e.contract_id = se.contract_id
           left join documents d
             on d.id = e.document_id
            and d.organization_id = e.organization_id
            and d.contract_id = e.contract_id
           left join document_versions v
             on v.id = e.document_version_id
            and v.organization_id = e.organization_id
            and v.document_id = e.document_id
          where s.organization_id = $1
            and s.contract_id = $2
            and s.document_version_id = $3
            and s.analysis_run_id = $4
          group by s.id
          order by s.generated_at, s.id
          limit 1000`,
        [scope.organizationId, scope.contractId, scope.documentVersionId, scope.analysisRunId]
      );
      return result.rows;
    },
  };
}
