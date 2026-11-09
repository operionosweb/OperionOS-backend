import defaultPgPool from "../../db.js";
import { assertOrganizationScope, assertResourceId } from "./scope.js";

const DECISION_TRANSITIONS = Object.freeze({
  suggested: new Set(["under_review", "accepted", "rejected"]),
  under_review: new Set(["accepted", "rejected"]),
  accepted: new Set(["completed", "rejected"]),
  rejected: new Set(),
  completed: new Set(),
  superseded: new Set(),
});

function repositoryError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function assertRunScope(scope) {
  assertOrganizationScope(scope.organizationId);
  assertResourceId(scope.contractId, "contractId");
  assertResourceId(scope.documentId, "documentId");
  assertResourceId(scope.documentVersionId, "documentVersionId");
  assertResourceId(scope.analysisRunId, "analysisRunId");
}

export function createAviationLeaseRecommendationRepository(pgPool = defaultPgPool) {
  return {
    async listByRun(scope) {
      assertRunScope(scope);
      const result = await pgPool.query(
        `select r.id, r.organization_id, r.contract_id, r.document_id,
                r.document_version_id, r.analysis_run_id, r.obligation_id,
                r.source_risk_key, r.recommendation_key, r.clause_id,
                r.recommendation_type, r.action, r.business_rationale,
                r.urgency, r.owner_role, r.confidence, r.review_status, r.created_at,
                coalesce((
                  select jsonb_agg(jsonb_build_object(
                    'id', h.id,
                    'status', h.status,
                    'actor_type', h.actor_type,
                    'reviewer_user_id', h.reviewer_user_id,
                    'explanation', h.explanation,
                    'created_at', h.created_at
                  ) order by h.sequence_number)
                    from recommendation_decision_history h
                   where h.recommendation_id = r.id
                     and h.organization_id = r.organization_id
                     and h.contract_id = r.contract_id
                ), '[]'::jsonb) as decision_history,
                coalesce((
                  select jsonb_agg(jsonb_build_object(
                    'evidenceId', e.id,
                    'supportType', re.support_type,
                    'isPrimary', re.is_primary,
                    'confidence', e.confidence,
                    'reviewStatus', e.review_status,
                    'sourceLocator', e.source_locator,
                    'pageNumber', e.page_number,
                    'excerpt', e.excerpt,
                    'documentName', d.filename,
                    'versionNumber', v.version_number,
                    'ambiguityReason', e.ambiguity_reason
                  ) order by re.rank, e.id)
                    from recommendation_evidence re
                    join intelligence_evidence e
                      on e.id = re.evidence_id
                     and e.organization_id = re.organization_id
                     and e.contract_id = r.contract_id
                    left join documents d
                      on d.id = e.document_id
                     and d.organization_id = e.organization_id
                     and d.contract_id = e.contract_id
                    left join document_versions v
                      on v.id = e.document_version_id
                     and v.organization_id = e.organization_id
                     and v.document_id = e.document_id
                   where re.recommendation_id = r.id
                     and re.organization_id = r.organization_id
                ), '[]'::jsonb) as evidence
           from recommendations r
          where r.organization_id = $1
            and r.contract_id = $2
            and r.document_id = $3
            and r.document_version_id = $4
            and r.analysis_run_id = $5
            and r.recommendation_key is not null
          order by r.created_at, r.id`,
        [
          scope.organizationId,
          scope.contractId,
          scope.documentId,
          scope.documentVersionId,
          scope.analysisRunId,
        ]
      );
      return result.rows;
    },

    async recordDecision({ recommendation, reviewerUserId, status, explanation }) {
      const scope = {
        organizationId: recommendation.organization_id,
        contractId: recommendation.contract_id,
        documentId: recommendation.document_id,
        documentVersionId: recommendation.document_version_id,
        analysisRunId: recommendation.analysis_run_id,
      };
      assertRunScope(scope);
      assertResourceId(recommendation.obligation_id, "obligationId");
      assertResourceId(recommendation.clause_id, "clauseId");
      assertResourceId(reviewerUserId, "reviewerUserId");
      if (typeof recommendation.recommendation_key !== "string" || !/^[a-f0-9]{64}$/.test(recommendation.recommendation_key)) {
        throw repositoryError("RECOMMENDATION_KEY_INVALID", "Recommendation identity is invalid");
      }
      if (recommendation.status !== status && !DECISION_TRANSITIONS[recommendation.status]?.has(status)) {
        throw repositoryError("RECOMMENDATION_TRANSITION_INVALID", "The requested recommendation transition is not allowed", 409);
      }
      const evidence = Array.isArray(recommendation.evidence) ? recommendation.evidence : [];
      const evidenceIds = [...new Set(evidence.map((item) => item.evidenceId))];
      if (!evidenceIds.length) {
        throw repositoryError("RECOMMENDATION_EVIDENCE_REQUIRED", "At least one linked source evidence item is required", 422);
      }
      evidenceIds.forEach((id) => assertResourceId(id, "evidenceId"));

      const connection = await pgPool.connect();
      try {
        await connection.query("BEGIN");
        await connection.query(
          "select pg_advisory_xact_lock(hashtextextended($1, 0))",
          [`${scope.organizationId}:${scope.analysisRunId}:${recommendation.recommendation_key}`]
        );
        const obligationResult = await connection.query(
          `select o.id
             from obligations o
             join clauses c
               on c.id = $2
              and c.organization_id = o.organization_id
              and c.contract_id = o.contract_id
              and c.document_id = o.document_id
              and c.document_version_id = o.document_version_id
              and c.analysis_run_id = o.analysis_run_id
            where o.id = $1
              and o.organization_id = $3
              and o.contract_id = $4
              and o.document_id = $5
              and o.document_version_id = $6
              and o.analysis_run_id = $7
              and o.clause_id = c.id
            for share of o, c`,
          [
            recommendation.obligation_id,
            recommendation.clause_id,
            scope.organizationId,
            scope.contractId,
            scope.documentId,
            scope.documentVersionId,
            scope.analysisRunId,
          ]
        );
        if (!obligationResult.rows.length) {
          throw repositoryError("RECOMMENDATION_SCOPE_INVALID", "The recommendation obligation and clause must belong to this completed analysis run", 422);
        }
        const evidenceResult = await connection.query(
          `select id, confidence
             from intelligence_evidence
            where id = any($1::uuid[])
              and organization_id = $2
              and contract_id = $3
              and review_status <> 'rejected'
            for share`,
          [evidenceIds, scope.organizationId, scope.contractId]
        );
        if (evidenceResult.rows.length !== evidenceIds.length) {
          throw repositoryError("RECOMMENDATION_EVIDENCE_SCOPE_INVALID", "Recommendation evidence must be non-rejected and belong to this organization and contract", 422);
        }

        let recommendationResult = await connection.query(
          `select id, recommendation_key, source_risk_key, obligation_id, clause_id,
                  action, business_rationale
             from recommendations
            where organization_id = $1 and contract_id = $2 and document_id = $3
              and document_version_id = $4 and analysis_run_id = $5
              and recommendation_key = $6
            for update`,
          [
            scope.organizationId,
            scope.contractId,
            scope.documentId,
            scope.documentVersionId,
            scope.analysisRunId,
            recommendation.recommendation_key,
          ]
        );
        let stored = recommendationResult.rows[0];
        if (stored && (
          stored.source_risk_key !== recommendation.source_risk_key
          || stored.obligation_id !== recommendation.obligation_id
          || stored.clause_id !== recommendation.clause_id
          || stored.action !== recommendation.action
          || stored.business_rationale !== recommendation.business_rationale
        )) {
          throw repositoryError("RECOMMENDATION_IDENTITY_CONFLICT", "The stored recommendation does not match the current evidence-derived recommendation", 409);
        }

        if (!stored) {
          const confidences = evidenceResult.rows.map((item) => Number(item.confidence))
            .filter((value) => Number.isFinite(value) && value >= 0 && value <= 1);
          const confidence = confidences.length ? Math.min(...confidences) : 0;
          recommendationResult = await connection.query(
            `insert into recommendations
              (organization_id, contract_id, document_id, document_version_id, analysis_run_id,
               risk_id, clause_id, recommendation_type, action, business_rationale, urgency,
               owner_role, confidence, review_status, obligation_id, source_risk_key, recommendation_key)
             values ($1, $2, $3, $4, $5, null, $6, $7, $8, $9, $10, $11, $12, 'pending', $13, $14, $15)
             returning id`,
            [
              scope.organizationId,
              scope.contractId,
              scope.documentId,
              scope.documentVersionId,
              scope.analysisRunId,
              recommendation.clause_id,
              recommendation.recommendation_type,
              recommendation.action,
              recommendation.business_rationale,
              recommendation.urgency,
              recommendation.owner_role,
              confidence,
              recommendation.obligation_id,
              recommendation.source_risk_key,
              recommendation.recommendation_key,
            ]
          );
          stored = { id: recommendationResult.rows[0].id };
          for (const [index, item] of evidence.entries()) {
            await connection.query(
              `insert into recommendation_evidence
                (organization_id, recommendation_id, evidence_id, rank, support_type, is_primary)
               values ($1, $2, $3, $4, $5, $6)`,
              [
                scope.organizationId,
                stored.id,
                item.evidenceId,
                index + 1,
                ["supports", "contradicts", "context"].includes(item.supportType) ? item.supportType : "supports",
                Boolean(item.isPrimary),
              ]
            );
          }
          await connection.query(
            `insert into recommendation_decision_history
              (recommendation_id, organization_id, contract_id, sequence_number,
               status, actor_type, reviewer_user_id, explanation)
             values ($1, $2, $3, 1, 'suggested', 'system', null, $4)`,
            [
              stored.id,
              scope.organizationId,
              scope.contractId,
              "Deterministic recommendation generated from the current evidence-linked aviation lease risk finding.",
            ]
          );
        }

        const latestResult = await connection.query(
          `select id, sequence_number, status, reviewer_user_id, explanation, created_at
             from recommendation_decision_history
            where recommendation_id = $1
              and organization_id = $2
              and contract_id = $3
            order by sequence_number desc
            limit 1
            for update`,
          [stored.id, scope.organizationId, scope.contractId]
        );
        const latest = latestResult.rows[0];
        if (latest?.status === status) {
          await connection.query("COMMIT");
          return {
            id: stored.id,
            decision: latest,
          };
        }
        if (!latest || !DECISION_TRANSITIONS[latest.status]?.has(status)) {
          throw repositoryError("RECOMMENDATION_TRANSITION_INVALID", "The recommendation has already changed and cannot accept this decision", 409);
        }
        const decisionResult = await connection.query(
          `insert into recommendation_decision_history
            (recommendation_id, organization_id, contract_id, sequence_number,
             status, actor_type, reviewer_user_id, explanation)
           values ($1, $2, $3, $4, $5, 'human', $6, $7)
           returning id, recommendation_id, sequence_number, status, reviewer_user_id, explanation, created_at`,
          [stored.id, scope.organizationId, scope.contractId, latest.sequence_number + 1, status, reviewerUserId, explanation]
        );
        await connection.query("COMMIT");
        return {
          id: stored.id,
          decision: decisionResult.rows[0],
        };
      } catch (error) {
        try {
          await connection.query("ROLLBACK");
        } catch {
          throw repositoryError("RECOMMENDATION_ROLLBACK_FAILED", "Recommendation decision could not be rolled back", 503);
        }
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}
