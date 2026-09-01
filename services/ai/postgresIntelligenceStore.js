import defaultPgPool from "../../db.js";

function budgetRow(row = {}) {
  return {
    allocated: Number(row.allocated_intelligence || 0),
    consumed: Number(row.consumed_intelligence || 0),
    reserved: Number(row.reserved_intelligence || 0),
    warningThreshold: Number(row.warning_threshold || 80),
    hardLimit: row.hard_limit !== false,
  };
}

function jobRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    operation: row.operation_type,
    status: row.status,
    estimatedIntelligence: Number(row.estimated_intelligence || 0),
    actualIntelligence: Number(row.actual_intelligence || 0),
    provider: row.provider,
    model: row.model,
    requestKey: row.request_key,
    technicalUsage: row.technical_usage || {},
    error: row.error,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function createPostgresIntelligenceStore(pgPool = defaultPgPool) {
  return {
    kind: "postgres",

    async getBudget(organizationId) {
      const result = await pgPool.query(
        "select * from ai_intelligence_budgets where organization_id = $1",
        [organizationId]
      );
      return budgetRow(result.rows[0]);
    },

    async setBudget(organizationId, values) {
      const result = await pgPool.query(`
        insert into ai_intelligence_budgets (
          organization_id, billing_period_start, billing_period_end,
          allocated_intelligence, consumed_intelligence, reserved_intelligence,
          warning_threshold, hard_limit
        ) values ($1, current_date, current_date + 30, $2, $3, $4, $5, $6)
        on conflict (organization_id) do update set
          allocated_intelligence = excluded.allocated_intelligence,
          consumed_intelligence = excluded.consumed_intelligence,
          reserved_intelligence = excluded.reserved_intelligence,
          warning_threshold = excluded.warning_threshold,
          hard_limit = excluded.hard_limit,
          updated_at = now()
        returning *
      `, [
        organizationId,
        Number(values.allocated || 0),
        Number(values.consumed || 0),
        Number(values.reserved || 0),
        Number(values.warningThreshold || 80),
        values.hardLimit !== false,
      ]);
      return budgetRow(result.rows[0]);
    },

    async reserveBudget(organizationId, amount) {
      const result = await pgPool.query(`
        update ai_intelligence_budgets
           set reserved_intelligence = reserved_intelligence + $2,
               updated_at = now()
         where organization_id = $1
           and (hard_limit = false or allocated_intelligence - consumed_intelligence - reserved_intelligence >= $2)
        returning *
      `, [organizationId, amount]);
      return result.rows[0] ? budgetRow(result.rows[0]) : null;
    },

    async releaseBudget(organizationId, amount) {
      const result = await pgPool.query(`
        update ai_intelligence_budgets
           set reserved_intelligence = greatest(0, reserved_intelligence - $2),
               updated_at = now()
         where organization_id = $1
        returning *
      `, [organizationId, amount]);
      return budgetRow(result.rows[0]);
    },

    async consumeBudget(organizationId, reservedAmount, actualAmount) {
      const result = await pgPool.query(`
        update ai_intelligence_budgets
           set reserved_intelligence = greatest(0, reserved_intelligence - $2),
               consumed_intelligence = consumed_intelligence + $3,
               updated_at = now()
         where organization_id = $1
        returning *
      `, [organizationId, reservedAmount, actualAmount]);
      if (!result.rows[0]) throw Object.assign(new Error("AI Intelligence Budget is not configured"), { code: "INTELLIGENCE_BUDGET_NOT_CONFIGURED" });
      return budgetRow(result.rows[0]);
    },

    async createJob(job) {
      const result = await pgPool.query(`
        insert into ai_intelligence_jobs (
          id, organization_id, user_id, operation_type, status,
          estimated_intelligence, actual_intelligence, provider, model,
          request_key, technical_usage, error, created_at, completed_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        on conflict (organization_id, request_key)
          where request_key is not null and status in ('pending', 'estimating', 'processing')
          do nothing
        returning *
      `, [
        job.id, job.organizationId, job.userId, job.operation, job.status,
        job.estimatedIntelligence, job.actualIntelligence, job.provider || null,
        job.model || null, job.requestKey || null, job.technicalUsage || {},
        job.error || null, job.createdAt, job.completedAt || null,
      ]);
      if (result.rows[0]) return jobRow(result.rows[0]);
      const existing = await pgPool.query(`
        select * from ai_intelligence_jobs
         where organization_id = $1 and request_key = $2
           and status in ('pending', 'estimating', 'processing')
         order by created_at desc limit 1
      `, [job.organizationId, job.requestKey]);
      return jobRow(existing.rows[0]);
    },

    async updateJob(job) {
      const result = await pgPool.query(`
        update ai_intelligence_jobs
           set status = $3, actual_intelligence = $4, provider = $5, model = $6,
               technical_usage = $7, error = $8, completed_at = $9
         where organization_id = $1 and id = $2
        returning *
      `, [
        job.organizationId, job.id, job.status, job.actualIntelligence,
        job.provider || null, job.model || null, job.technicalUsage || {},
        job.error || null, job.completedAt || null,
      ]);
      return jobRow(result.rows[0]);
    },

    async getJob(organizationId, jobId) {
      const result = await pgPool.query(
        "select * from ai_intelligence_jobs where organization_id = $1 and id = $2",
        [organizationId, jobId]
      );
      return jobRow(result.rows[0]);
    },

    async cancelJob(organizationId, jobId, completedAt) {
      const result = await pgPool.query(`
        update ai_intelligence_jobs
           set status = 'cancelled', completed_at = $3
         where organization_id = $1 and id = $2
           and status in ('pending', 'estimating', 'awaiting_confirmation')
        returning *
      `, [organizationId, jobId, completedAt]);
      return jobRow(result.rows[0]);
    },

    async getCache({ organizationId, documentHash, operation, analysisVersion, promptVersion, provider, model }) {
      const result = await pgPool.query(`
        select result, intelligence_usage, created_at
          from ai_intelligence_cache
         where organization_id = $1 and document_hash = $2 and operation_type = $3
           and analysis_version = $4 and coalesce(prompt_version, '') = coalesce($5, '')
           and coalesce(provider, '') = coalesce($6, '') and coalesce(model, '') = coalesce($7, '')
           and (valid_until is null or valid_until > now())
         limit 1
      `, [organizationId, documentHash, operation, analysisVersion, promptVersion || null, provider || null, model || null]);
      if (!result.rows[0]) return null;
      return {
        result: result.rows[0].result,
        job: result.rows[0].intelligence_usage?.job || null,
        createdAt: result.rows[0].created_at,
      };
    },

    async putCache({ organizationId, documentHash, operation, analysisVersion, promptVersion, provider, model, result, job }) {
      await pgPool.query(`
        insert into ai_intelligence_cache (
          organization_id, document_hash, operation_type, analysis_version,
          prompt_version, provider, model, result, intelligence_usage
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        on conflict (organization_id, document_hash, operation_type, analysis_version,
          (coalesce(prompt_version, '')), (coalesce(provider, '')), (coalesce(model, '')))
        do update set result = excluded.result, intelligence_usage = excluded.intelligence_usage,
          created_at = now(), valid_until = null
      `, [organizationId, documentHash, operation, analysisVersion, promptVersion || null, provider || null, model || null, result, { job }]);
    },

    async recordUsage(usage) {
      await pgPool.query(`
        insert into ai_intelligence_usage (
          organization_id, job_id, user_id, operation_type,
          estimated_intelligence, actual_intelligence, provider, model,
          technical_usage, created_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [
        usage.organizationId, usage.jobId, usage.userId, usage.operation,
        usage.estimatedIntelligence, usage.actualIntelligence, usage.provider,
        usage.model, usage.technicalUsage || {}, usage.createdAt,
      ]);
    },

    async completeRequest({ job, reservedAmount, usage, cache }) {
      const client = await pgPool.connect();
      try {
        await client.query("begin");
        const budgetResult = await client.query(`
          update ai_intelligence_budgets
             set reserved_intelligence = greatest(0, reserved_intelligence - $2),
                 consumed_intelligence = consumed_intelligence + $3,
                 updated_at = now()
           where organization_id = $1
          returning *
        `, [job.organizationId, reservedAmount, job.actualIntelligence]);
        if (!budgetResult.rows[0]) throw Object.assign(new Error("AI Intelligence Budget is not configured"), { code: "INTELLIGENCE_BUDGET_NOT_CONFIGURED" });
        await client.query(`
          update ai_intelligence_jobs
             set status = $3, actual_intelligence = $4, provider = $5, model = $6,
                 technical_usage = $7, error = $8, completed_at = $9
           where organization_id = $1 and id = $2
        `, [job.organizationId, job.id, job.status, job.actualIntelligence, job.provider, job.model, job.technicalUsage, job.error || null, job.completedAt]);
        await client.query(`
          insert into ai_intelligence_usage (
            organization_id, job_id, user_id, operation_type,
            estimated_intelligence, actual_intelligence, provider, model,
            technical_usage, created_at
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `, [usage.organizationId, usage.jobId, usage.userId, usage.operation, usage.estimatedIntelligence, usage.actualIntelligence, usage.provider, usage.model, usage.technicalUsage || {}, usage.createdAt]);
        await client.query(`
          insert into ai_intelligence_cache (
            organization_id, document_hash, operation_type, analysis_version,
            prompt_version, provider, model, result, intelligence_usage
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          on conflict (organization_id, document_hash, operation_type, analysis_version,
            (coalesce(prompt_version, '')), (coalesce(provider, '')), (coalesce(model, '')))
          do update set result = excluded.result, intelligence_usage = excluded.intelligence_usage,
            created_at = now(), valid_until = null
        `, [cache.organizationId, cache.documentHash, cache.operation, cache.analysisVersion, cache.promptVersion || null, cache.provider || null, cache.model || null, cache.result, { job }]);
        await client.query("commit");
        return budgetRow(budgetResult.rows[0]);
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async failRequest(job, reservedAmount) {
      const client = await pgPool.connect();
      try {
        await client.query("begin");
        await client.query(`
          update ai_intelligence_budgets
             set reserved_intelligence = greatest(0, reserved_intelligence - $2),
                 updated_at = now()
           where organization_id = $1
        `, [job.organizationId, reservedAmount]);
        await client.query(`
          update ai_intelligence_jobs
             set status = 'failed', error = $3, completed_at = $4
           where organization_id = $1 and id = $2
        `, [job.organizationId, job.id, job.error, job.completedAt]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}