import defaultPgPool from "../../db.js";
import { assertOrganizationScope, assertResourceId } from "./scope.js";

function repositoryError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

export function createObligationFulfilmentRepository(pgPool = defaultPgPool) {
  return {
    async listLatestForRun({ scope, obligationIds }) {
      assertOrganizationScope(scope.organizationId);
      assertResourceId(scope.contractId, "contractId");
      assertResourceId(scope.documentId, "documentId");
      assertResourceId(scope.documentVersionId, "documentVersionId");
      assertResourceId(scope.analysisRunId, "analysisRunId");
      if (!Array.isArray(obligationIds)) throw new TypeError("obligationIds must be an array");
      if (!obligationIds.length) return [];
      obligationIds.forEach((id) => assertResourceId(id, "obligationId"));
      const result = await pgPool.query(
        `with assessment_history as (
           select a.id, a.organization_id, a.contract_id, a.obligation_id,
                  a.reviewer_user_id, a.status, a.explanation, a.created_at,
                  row_number() over (
                    partition by a.obligation_id order by a.created_at desc, a.id desc
                  ) as position,
                  lead(a.status) over (
                    partition by a.obligation_id order by a.created_at desc, a.id desc
                  ) as previous_status
             from obligation_fulfilment_assessments a
             join obligations o
               on o.id = a.obligation_id
              and o.organization_id = a.organization_id
              and o.contract_id = a.contract_id
            where a.organization_id = $1
              and a.contract_id = $2
              and a.obligation_id = any($6::uuid[])
              and o.document_id = $3
              and o.document_version_id = $4
              and o.analysis_run_id = $5
         ), latest as (
           select * from assessment_history where position = 1
         )
         select l.id, l.organization_id, l.contract_id, l.obligation_id,
                l.reviewer_user_id, l.status, l.explanation, l.created_at,
                l.previous_status,
                coalesce(
                  jsonb_agg(jsonb_build_object(
                    'evidence_id', e.id,
                    'document_name', d.filename,
                    'version_number', v.version_number,
                    'source_locator', e.source_locator,
                    'page_number', e.page_number,
                    'excerpt', e.excerpt,
                    'confidence', e.confidence,
                    'ambiguity_reason', e.ambiguity_reason,
                    'review_status', e.review_status,
                    'relationship', ae.relationship,
                    'period_status', ae.period_status,
                    'reviewer_note', ae.reviewer_note
                  ) order by e.created_at, e.id) filter (where e.id is not null),
                  '[]'::jsonb
                ) as evidence
           from latest l
           left join obligation_fulfilment_assessment_evidence ae
             on ae.assessment_id = l.id
            and ae.obligation_id = l.obligation_id
            and ae.organization_id = l.organization_id
            and ae.contract_id = l.contract_id
           left join intelligence_evidence e
             on e.id = ae.evidence_id
            and e.organization_id = ae.organization_id
            and e.contract_id = ae.contract_id
           left join documents d
             on d.id = e.document_id
            and d.organization_id = e.organization_id
            and d.contract_id = e.contract_id
           left join document_versions v
             on v.id = e.document_version_id
            and v.organization_id = e.organization_id
            and v.document_id = e.document_id
          group by l.id, l.organization_id, l.contract_id, l.obligation_id,
                   l.reviewer_user_id, l.status, l.explanation, l.created_at,
                   l.previous_status
          order by l.obligation_id`,
        [
          scope.organizationId,
          scope.contractId,
          scope.documentId,
          scope.documentVersionId,
          scope.analysisRunId,
          obligationIds,
        ]
      );
      return result.rows;
    },

    async listAvailableEvidence({ organizationId, contractId, excludedDocumentId, limit = 200 }) {
      assertOrganizationScope(organizationId);
      assertResourceId(contractId, "contractId");
      assertResourceId(excludedDocumentId, "excludedDocumentId");
      const boundedLimit = Math.min(Math.max(Number(limit) || 200, 1), 200);
      const result = await pgPool.query(
        `select e.id, e.organization_id, e.contract_id, e.document_id,
                e.document_version_id, e.analysis_run_id, e.page_number,
                e.source_locator, e.excerpt, e.stage, e.review_status,
                e.confidence, e.ambiguity_reason, e.created_at,
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
          where e.organization_id = $1
            and e.contract_id = $2
            and e.document_id <> $3
            and e.review_status <> 'rejected'
            and v.extraction_status = 'completed'
            and ar.status = 'completed'
          order by e.created_at desc, e.id
          limit $4`,
        [organizationId, contractId, excludedDocumentId, boundedLimit]
      );
      return result.rows;
    },

    async listByObligation({ organizationId, contractId, obligationId }) {
      assertOrganizationScope(organizationId);
      assertResourceId(contractId, "contractId");
      assertResourceId(obligationId, "obligationId");
      const result = await pgPool.query(
        `select a.id, a.organization_id, a.contract_id, a.obligation_id,
                a.reviewer_user_id, a.status, a.explanation, a.created_at,
                coalesce(
                  jsonb_agg(
                    jsonb_build_object(
                      'id', e.id,
                      'documentId', e.document_id,
                      'documentVersionId', e.document_version_id,
                      'analysisRunId', e.analysis_run_id,
                      'documentName', d.filename,
                      'versionNumber', v.version_number,
                      'pageNumber', e.page_number,
                      'sourceLocator', e.source_locator,
                      'excerpt', e.excerpt,
                      'confidence', e.confidence,
                      'ambiguityReason', e.ambiguity_reason,
                      'reviewStatus', e.review_status,
                      'relationship', ae.relationship,
                      'periodStatus', ae.period_status,
                      'reviewerNote', ae.reviewer_note
                    ) order by e.created_at, e.id
                  ) filter (where e.id is not null),
                  '[]'::jsonb
                ) as evidence
           from obligation_fulfilment_assessments a
           left join obligation_fulfilment_assessment_evidence ae
             on ae.assessment_id = a.id
            and ae.obligation_id = a.obligation_id
            and ae.organization_id = a.organization_id
            and ae.contract_id = a.contract_id
           left join intelligence_evidence e
             on e.id = ae.evidence_id
            and e.organization_id = ae.organization_id
            and e.contract_id = ae.contract_id
           left join documents d
             on d.id = e.document_id
            and d.organization_id = e.organization_id
            and d.contract_id = e.contract_id
           left join document_versions v
             on v.id = e.document_version_id
            and v.organization_id = e.organization_id
            and v.document_id = e.document_id
          where a.organization_id = $1
            and a.contract_id = $2
            and a.obligation_id = $3
          group by a.id
          order by a.created_at desc, a.id`,
        [organizationId, contractId, obligationId]
      );
      return result.rows;
    },

    async createAssessment({
      organizationId,
      contractId,
      obligationId,
      reviewerUserId,
      status,
      explanation,
      evidence,
    }) {
      assertOrganizationScope(organizationId);
      assertResourceId(contractId, "contractId");
      assertResourceId(obligationId, "obligationId");
      assertResourceId(reviewerUserId, "reviewerUserId");

      const connection = await pgPool.connect();
      try {
        await connection.query("BEGIN");
        const obligationResult = await connection.query(
          `select id, document_id
             from obligations
            where id = $1 and organization_id = $2 and contract_id = $3
            for share`,
          [obligationId, organizationId, contractId]
        );
        const obligation = obligationResult.rows[0];
        if (!obligation) {
          throw repositoryError("OBLIGATION_NOT_FOUND", "Obligation not found", 404);
        }

        const evidenceIds = evidence.map((item) => item.evidenceId);
        if (evidenceIds.length) {
          const evidenceResult = await connection.query(
            `select e.id
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
                and e.review_status <> 'rejected'
                and v.extraction_status = 'completed'
                and ar.status = 'completed'
              for share of e`,
            [evidenceIds, organizationId, contractId, obligation.document_id]
          );
          if (evidenceResult.rows.length !== evidenceIds.length) {
            throw repositoryError("FULFILMENT_EVIDENCE_SCOPE_INVALID", "Evidence must be available, non-rejected, and belong to this contract outside the source obligation document", 422);
          }
        }

        const assessmentResult = await connection.query(
          `insert into obligation_fulfilment_assessments
            (organization_id, contract_id, obligation_id, reviewer_user_id, status, explanation)
           values ($1, $2, $3, $4, $5, $6)
           returning id, organization_id, contract_id, obligation_id,
                     reviewer_user_id, status, explanation, created_at`,
          [organizationId, contractId, obligationId, reviewerUserId, status, explanation]
        );
        const assessment = assessmentResult.rows[0];

        for (const item of evidence) {
          await connection.query(
            `insert into obligation_fulfilment_assessment_evidence
              (assessment_id, obligation_id, organization_id, contract_id,
               evidence_id, relationship, period_status, reviewer_note)
             values ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              assessment.id,
              obligationId,
              organizationId,
              contractId,
              item.evidenceId,
              item.relationship,
              item.periodStatus,
              item.reviewerNote || null,
            ]
          );
        }
        await connection.query("COMMIT");
        return assessment;
      } catch (error) {
        try {
          await connection.query("ROLLBACK");
        } catch {
          // Keep the original persistence error.
        }
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}
