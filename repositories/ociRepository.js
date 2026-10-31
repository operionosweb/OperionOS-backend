// Importing this module never opens a database connection. Offline callers inject query.
async function defaultQuery(sql, params) { const { query } = await import("./ociDatabase.js"); return query(sql, params); }
export function createOciRepository(queryFn = defaultQuery) {
  async function rows(sql, params = []) {
    try { return (await queryFn(sql, params)).rows; }
    catch (error) {
      if (error.code === "23505") {
        const failure = new Error("An active OCI record with this organisation or professional email already exists");
        failure.status = 409; failure.code = "OCI_DUPLICATE_CONFLICT"; throw failure;
      }
      if (["23503", "23514", "40001"].includes(error.code)) {
        const failure = new Error("OCI relationship, stage or concurrent mutation conflict");
        failure.status = 409; failure.code = "OCI_INTEGRITY_CONFLICT"; throw failure;
      }
      throw error;
    }
  }
  async function one(sql, params = []) { return (await rows(sql, params))[0] ?? null; }
  return {
    getRecord(kind, id) { return one("select * from public.oci_records where kind=$1 and id=$2", [kind, id]); },
    async listRecords(kind, { search, status, sort, page, pageSize }) {
      const sorts = { updated_desc: "updated_at desc,id", updated_at_desc: "updated_at desc,id", updated_at_asc: "updated_at asc,id", created_desc: "created_at desc,id", name_asc: "coalesce(data->>'name',data->>'title','') asc,id", name_desc: "coalesce(data->>'name',data->>'title','') desc,id" };
      if (!Object.hasOwn(sorts, sort)) throw new TypeError("Invalid sort");
      const filter = "kind=$1 and ($2='all' or status=$2) and ($3='' or data::text ilike $3 escape '\\')";
      const pattern = search ? `%${search.replace(/[\\%_]/g, "\\$&")}%` : "";
      const result = await one(`with filtered as (select * from public.oci_records where ${filter}),
        selected as (select * from filtered order by ${sorts[sort]} limit $4 offset $5)
        select (select count(*)::int from filtered) as total, coalesce((select jsonb_agg(selected order by ${sorts[sort]}) from selected),'[]'::jsonb) as records`,
      [kind, status, pattern, pageSize, (page - 1) * pageSize]);
      return result;
    },
    createRecord(kind, input, actorId) {
      return one(`insert into public.oci_records(kind,data,account_id,opportunity_id,created_by,updated_by)
        values($1,$2::jsonb,$3,$4,$5,$5) returning *`, [kind, JSON.stringify(input.data), input.accountId, input.opportunityId, actorId]);
    },
    updateRecord(kind, id, input, actorId) {
      return one(`update public.oci_records set data=$3::jsonb,account_id=$4,opportunity_id=$5,
        version=version+1,updated_by=$7,updated_at=now()
        where kind=$1 and id=$2 and version=$6 and status='active' returning *`,
      [kind, id, JSON.stringify(input.data), input.accountId, input.opportunityId, input.version, actorId]);
    },
    archiveRecord(kind, id, version, actorId) {
      return one(`update public.oci_records set status='archived',version=version+1,updated_by=$4,updated_at=now()
        where kind=$1 and id=$2 and version=$3 and status='active' returning *`, [kind, id, version, actorId]);
    },
    eraseContact(id, version, actorId) {
      return one(`update public.oci_records set data='{"name":"Erased contact","privacyErased":true}'::jsonb,
        status='archived',version=version+1,updated_by=$3,updated_at=now()
        where kind='contacts' and id=$1 and version=$2 and not(data @> '{"privacyErased":true}'::jsonb) returning *`, [id, version, actorId]);
    },
    async hasActiveReferences(id) {
      return (await one("select exists(select 1 from public.oci_records where status='active' and (account_id=$1 or opportunity_id=$1)) as present", [id])).present;
    },
    async hasMismatchedOpportunityReferences(id, accountId) {
      return (await one("select exists(select 1 from public.oci_records where status='active' and opportunity_id=$1 and account_id is distinct from $2::uuid) as present", [id, accountId])).present;
    },
    async getStages() {
      const setting = await one("select value from public.oci_settings where scope='stages'");
      if (!setting || !Array.isArray(setting.value)) {
        const failure = new Error("OCI persisted stage configuration is unavailable");
        failure.status = 503; failure.code = "OCI_SETTINGS_UNAVAILABLE"; throw failure;
      }
      return setting.value;
    },
    async usedStages() { return (await rows("select distinct data->>'stage' as stage from public.oci_records where kind='opportunities'")).map(r => r.stage); },
    setStages(stages, actorId) {
      return one(`insert into public.oci_settings(scope,value,updated_by) values('stages',$1::jsonb,$2)
        on conflict(scope) do update set value=excluded.value,updated_by=excluded.updated_by,updated_at=now() returning *`, [JSON.stringify(stages), actorId]);
    },
    listAudit(limit) {
      return rows("select id,actor_id,action,entity_kind,entity_id,metadata,created_at from public.oci_audit_events order by created_at desc,id desc limit $1", [limit]);
    },
    async dashboard() {
      // One statement supplies a consistent persisted snapshot, with bounded next actions.
      return one(`with active as (select * from public.oci_records where status='active'),
        financial as (select data->>'currency' as currency,data->>'basis' as basis,data->>'periodDate' as "periodDate",
          bool_and(data ? 'amount') as "amountComplete",
          bool_and(coalesce(data->>'costBasis' in ('Estimated','Recorded'),false)
            and data ?& array['deliveryCost','infrastructureCost','aiProcessingCost','storageCost']) as "costComplete",
          bool_or(data->>'costBasis'='Estimated') as "hasEstimatedCosts",
          sum(coalesce((data->>'amount')::numeric,0)) as amount,
          sum(case when data->>'revenueType'='Pilot' then coalesce((data->>'amount')::numeric,0) else 0 end) as "pilotRevenue",
          sum(case when data->>'revenueType'='Subscription' then coalesce((data->>'amount')::numeric,0) else 0 end) as "subscriptionRevenue",
          ${["mrr", "arr", "annualContractValue", "deliveryCost", "acquisitionCost", "infrastructureCost", "aiProcessingCost", "storageCost", "lifetimeValue"].map(k => `sum((data->>'${k}')::numeric) as "${k}"`).join(",")}
          from active where kind='revenue' group by data->>'currency',data->>'basis',data->>'periodDate' order by 1,2,3),
        pipeline as (select data->>'currency' as currency,sum(coalesce((data->>'value')::numeric,0)) as value,
          sum(coalesce((data->>'value')::numeric,0)*coalesce((data->>'probability')::numeric,0)/100) as "weightedValue"
          from active where kind='opportunities' and data->>'stage' not in ('Won','Lost') group by data->>'currency' order by 1),
        actions as (select * from active where (kind<>'activities' or data->>'activityStatus'='Planned') and
          (nullif(data->>'nextAction','') is not null or (kind='activities' and data->>'activityStatus'='Planned'))
          order by coalesce(data->>'followUpDate',data->>'dueDate','9999-12-31'),updated_at desc,id limit 25)
        select jsonb_build_object(
          'targetOrganisations',(select count(*) from active where kind='accounts'),
          'qualifiedAccounts',(select count(*) from active where kind='accounts' and data->>'accountStatus'='Qualified'),
          'activeOpportunities',(select count(*) from active where kind='opportunities' and data->>'stage' not in ('Won','Lost')),
          'upcomingActivities',(select count(*) from active where kind='activities' and data->>'activityStatus'='Planned' and data->>'dueDate'>=current_date::text),
          'overdueActivities',(select count(*) from active where kind='activities' and data->>'activityStatus'='Planned' and data->>'dueDate'<current_date::text),
          'discoveryConversations',(select count(*) from active where kind='discovery'),
          'pilotOpportunities',(select count(*) from active where kind='pilots' and data->>'offerType'='Pilot' and data->>'pilotStatus' in ('Proposed','Active')),
          'proposalsIssued',(select count(*) from active where kind='pilots' and data->>'offerType'='Proposal' and data->>'pilotStatus' <> 'Draft' and data->>'pilotStatus' <> 'Cancelled'),
          'wonOpportunities',(select count(*) from active where kind='opportunities' and data->>'stage'='Won'),
          'lostOpportunities',(select count(*) from active where kind='opportunities' and data->>'stage'='Lost')) as metrics,
          coalesce((select jsonb_agg(actions) from actions),'[]'::jsonb) as "nextActions",
          coalesce((select jsonb_agg(financial) from financial),'[]'::jsonb) as financials,
          coalesce((select jsonb_agg(pipeline) from pipeline),'[]'::jsonb) as pipeline`);
    },
  };
}
