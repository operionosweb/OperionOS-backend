// Importing this module never opens a database connection. Offline callers inject query.
import { compileOciGeographicQuery, countryMatchesScope, OCI_COUNTRY_CODES, OCI_DEFAULT_MARKET } from "../shared/ociGeography.js";
import { OCI_ACCOUNT_FIT_CRITERIA } from "../shared/ociAccountFit.js";
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
    async listRecords(kind, { search, status, sort, page, pageSize, geography = { scope: OCI_DEFAULT_MARKET } }) {
      const sorts = { updated_desc: "updated_at desc,id", updated_at_desc: "updated_at desc,id", updated_at_asc: "updated_at asc,id", created_desc: "created_at desc,id", name_asc: "coalesce(data->>'name',data->>'title','') asc,id", name_desc: "coalesce(data->>'name',data->>'title','') desc,id" };
      if (!Object.hasOwn(sorts, sort)) throw new TypeError("Invalid sort");
      const geo = compileOciGeographicQuery(kind, geography, 6);
      const pattern = search ? `%${search.replace(/[\\%_]/g, "\\$&")}%` : "";
      const result = await one(`with enriched as (${geo.projection}),
        filtered as (select * from enriched where kind=$1 and ($2='all' or status=$2)
          and ($3='' or data::text ilike $3 escape '\\') and ${geo.where}),
        selected as (select * from filtered order by ${sorts[sort]} limit $4 offset $5)
        select (select count(*)::int from filtered) as total, coalesce((select jsonb_agg(selected order by ${sorts[sort]}) from selected),'[]'::jsonb) as records`,
      [kind, status, pattern, pageSize, (page - 1) * pageSize, ...geo.params]);
      return result;
    },
    async geographyOptions(scope = OCI_DEFAULT_MARKET) {
      const geo = compileOciGeographicQuery("dashboard", { scope }, 1);
      const result = await rows(`with enriched as (${geo.projection})
        select distinct kind, geo_country as country_code,
          case when kind='accounts' then data->>'country' else data->>'geography' end as legacy_country,
          geo_region as administrative_region, geo_city as city, geo_airports as airports,
          geo_segment as segment, geo_company_type as company_type
        from enriched where kind in ('accounts','market') and status='active' and ${geo.where}
        order by kind, country_code, administrative_region, city, airport, segment, company_type
        limit 2001`, geo.params);
      return { options: result.slice(0, 2000), truncated: result.length > 2000 };
    },
    createRecord(kind, input, actorId) {
      if (kind === "activities" && input.data.recommendationId) {
        return one(`with recommendation_lock as materialized (
            select pg_advisory_xact_lock(hashtext($6))
          )
          insert into public.oci_records(kind,data,account_id,opportunity_id,created_by,updated_by)
          select $1,$2::jsonb,$3,$4,$5,$5 from recommendation_lock
          where not exists (select 1 from public.oci_records
            where kind='activities' and data->>'recommendationId'=$6)
          returning *`,
        [kind, JSON.stringify(input.data), input.accountId, input.opportunityId, actorId, input.data.recommendationId]);
      }
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
    async dashboard(geography = { scope: OCI_DEFAULT_MARKET }) {
      const geo = compileOciGeographicQuery("dashboard", geography, 1);
      const europeanCountries = OCI_COUNTRY_CODES.filter(code => countryMatchesScope(code, "EUROPE"));
      const europePlaceholder = `$${geo.params.length + 2}`;
      return one(`with enriched as (${geo.projection}),
        all_active as (select *, case when data->>'data_origin' in ('Real','Synthetic') then data->>'data_origin' else 'Unclassified' end as data_origin from enriched where status='active'),
        active as (select * from all_active where ${geo.where}),
        financial as (select data->>'currency' as currency,data->>'basis' as basis,
          coalesce(data->>'revenueClass','Unclassified legacy') as "revenueClass",
          data->>'periodDate' as "periodDate",data_origin as "dataOrigin",geo_country as "countryCode",geo_segment as segment,
          bool_and(data ? 'amount') as "amountComplete",
          bool_and(coalesce(data->>'costBasis' in ('Estimated','Recorded'),false)
            and data ?& array['deliveryCost','infrastructureCost','aiProcessingCost','storageCost']) as "costComplete",
          bool_or(data->>'costBasis'='Estimated') as "hasEstimatedCosts",
          sum(coalesce((data->>'amount')::numeric,0)) as amount,
          sum(case when data->>'revenueType'='Pilot' then coalesce((data->>'amount')::numeric,0) else 0 end) as "pilotRevenue",
          sum(case when data->>'revenueType'='Subscription' then coalesce((data->>'amount')::numeric,0) else 0 end) as "subscriptionRevenue",
          ${["mrr", "arr", "annualContractValue", "deliveryCost", "acquisitionCost", "infrastructureCost", "aiProcessingCost", "storageCost", "lifetimeValue"].map(k => `sum((data->>'${k}')::numeric) as "${k}"`).join(",")}
          from active where kind='revenue' group by data->>'currency',data->>'basis',coalesce(data->>'revenueClass','Unclassified legacy'),
            data->>'periodDate',data_origin,geo_country,geo_segment order by 1,2,3,4,5,6,7),
        pipeline as (select data->>'currency' as currency,data_origin as "dataOrigin",geo_country as "countryCode",geo_segment as segment,
          count(*)::int as "opportunityCount",sum(coalesce((data->>'value')::numeric,0)) as value,
          bool_and(nullif(data->>'probability','') is not null) as "probabilityComplete",
          case when bool_and(nullif(data->>'probability','') is not null)
            then sum((data->>'value')::numeric*(data->>'probability')::numeric/100) else null end as "weightedValue"
          from active where kind='opportunities' and data->>'stage' not in ('Won','Lost','On hold')
          group by data->>'currency',data_origin,geo_country,geo_segment order by 1,2,3,4),
        action_active as (select * from all_active where ${geo.where}
            or (kind='activities' and (geo_country is null or data->>'actionScope'='Global'))),
        action_candidates as (select r.id,r.kind,r.data,r.updated_at,r.account_id,r.opportunity_id,
          case when r.kind='accounts' then r.id else r.account_id end as "actionAccountId",
          r.kind||':'||r.id::text||':founder-next-step-v1' as "recommendationId",
          r.geo_country as "countryCode",r.geo_city as city,r.geo_segment as segment,
          account.data->>'name' as "accountName",coalesce(r.data->>'name',r.data->>'title') as "sourceName",
          coalesce(nullif(r.data->>'followUpDate',''),nullif(r.data->>'dueDate',''),
            nullif(r.data->>'expectedDecisionDate',''),nullif(r.data->>'expectedCloseDate','')) as "dueDate",
          case when nullif(r.data->>'followUpDate','') < current_date::text
              or nullif(r.data->>'dueDate','') < current_date::text
              or coalesce(nullif(r.data->>'expectedDecisionDate',''),nullif(r.data->>'expectedCloseDate','')) <= (current_date+7)::text
              or (r.kind='opportunities' and nullif(r.data->>'lastInteraction','') <= (current_date-30)::text)
            then 'Urgent' else 'Routine' end as urgency,
          case
            when r.kind='accounts' then 'Explicit high priority; account research is not complete.'
            when r.kind='contacts' then 'A sourced stakeholder is identified, but no contact attempt is recorded.'
            when r.kind='discovery' then 'Discovery is completed or needs follow-up, with no next action recorded.'
            when r.kind='opportunities' and nullif(r.data->>'followUpDate','') < current_date::text then 'The recorded opportunity follow-up date has passed.'
            when r.kind='opportunities' and nullif(btrim(r.data->>'nextAction'),'') is null then 'The open opportunity has no documented next action.'
            when r.kind='opportunities' and nullif(r.data->>'lastInteraction','') <= (current_date-30)::text then 'The last recorded interaction is at least 30 days old.'
            when r.kind='opportunities' then 'The recorded customer decision date is within 14 days.'
            when r.kind='pilots' then 'Proposal is awaiting the customer decision and has no current follow-up.'
            else 'A planned commercial activity is due or overdue.' end as "recommendationReason",
          case
            when r.kind='accounts' then 'Complete source-backed research and confirm the next relevant stakeholder.'
            when r.kind='contacts' then 'Review the source and record a human-approved contact attempt or next step.'
            when r.kind='discovery' then 'Record interview findings and set a dated next action.'
            when r.kind='opportunities' and nullif(btrim(r.data->>'nextAction'),'') is null then 'Agree and record the next human-approved commercial step and due date.'
            when r.kind='opportunities' and nullif(r.data->>'lastInteraction','') <= (current_date-30)::text then 'Review the recorded relationship history and agree a human-approved next step.'
            when r.kind='opportunities' then 'Confirm the decision timeline with the account team and update the next action.'
            when r.kind='pilots' then 'Record the customer decision or schedule an approved follow-up.'
            else coalesce(nullif(r.data->>'nextAction',''),'Complete or reschedule the planned activity.') end as "recommendedAction",
          coalesce(nullif(btrim(r.data->>'source'),''),nullif(btrim(r.data->>'sourceEvidence'),''),
            nullif(btrim(r.data->>'validationEvidence'),''),nullif(btrim(r.data->>'fitEvidence'),''),
            'Recorded workflow status: '||coalesce(r.data->>'stage',r.data->>'discoveryStatus',r.data->>'pilotStatus',r.data->>'relationshipStatus',r.data->>'activityStatus','active')
              ||'; last updated '||r.updated_at::date::text) as evidence
          from active r left join public.oci_records account
            on account.id=r.account_id and account.kind='accounts' and account.status='active'
          where ((r.kind='accounts' and r.data->>'accountStatus'='Target' and r.data->>'priority'='High'
              and coalesce(r.data->>'researchStatus','Not researched') in ('Not researched','Needs verification'))
            or (r.kind='contacts' and r.data->>'relationshipStatus'='Identified' and nullif(btrim(r.data->>'source'),'') is not null)
            or (r.kind='discovery' and r.data->>'discoveryStatus' in ('Interview completed','Needs follow-up')
              and nullif(btrim(r.data->>'nextAction'),'') is null)
            or (r.kind='opportunities' and r.data->>'stage'='Qualified'
              and nullif(r.data->>'followUpDate','') < current_date::text)
            or (r.kind='opportunities' and r.data->>'stage' not in ('Won','Lost','On hold')
              and coalesce(nullif(r.data->>'expectedDecisionDate',''),nullif(r.data->>'expectedCloseDate',''))
                between current_date::text and (current_date+14)::text)
            or (r.kind='opportunities' and r.data->>'stage' not in ('Won','Lost','On hold')
              and nullif(btrim(r.data->>'nextAction'),'') is null)
            or (r.kind='opportunities' and r.data->>'stage' not in ('Won','Lost','On hold')
              and nullif(r.data->>'lastInteraction','') <= (current_date-30)::text)
            or (r.kind='pilots' and r.data->>'offerType'='Proposal' and r.data->>'proposalStatus'='Awaiting customer'
              and (nullif(btrim(r.data->>'nextAction'),'') is null or nullif(r.data->>'followUpDate','') is null
                or nullif(r.data->>'followUpDate','')<current_date::text))
            or (r.kind='activities' and r.data->>'activityStatus'='Planned'
              and nullif(r.data->>'dueDate','') is not null and nullif(r.data->>'dueDate','')<=(current_date+7)::text)
          )
            and not exists (select 1 from public.oci_records saved
              where saved.kind='activities' and saved.data->>'recommendationId'=
                r.kind||':'||r.id::text||':founder-next-step-v1')),
        actions as (select jsonb_build_object('id',id,'kind',kind,'data',data,'accountName',"accountName",
            'recommendationId',"recommendationId",'accountId',"actionAccountId",
            'opportunityId',case when kind='opportunities' then id else opportunity_id end,
            'relatedRecordKind',kind,'relatedRecordId',id,
            'relatedRecordName',"sourceName",
            'actionCategory',case kind when 'accounts' then 'Research' when 'contacts' then 'Contact'
              when 'discovery' then 'Discovery' when 'opportunities' then 'Opportunity'
              when 'pilots' then 'Pilot / proposal' else 'Follow-up' end,
            'countryCode',"countryCode",'city',city,'segment',segment,'dueDate',"dueDate",
            'urgency',urgency,'recommendationReason',"recommendationReason",
            'recommendedAction',"recommendedAction",'evidence',evidence) as recommendation
          from action_candidates order by case urgency when 'Urgent' then 0 else 1 end,
            coalesce("dueDate",'9999-12-31'),updated_at desc,id limit 25),
        execution_action_candidates as (select r.id,r.version,r.account_id,r.opportunity_id,r.data,r.updated_at,r.data_origin as "dataOrigin",
            case when r.data->>'actionStatus'='Snoozed' then nullif(r.data->>'reviewDate','')
              else coalesce(nullif(r.data->>'dueDate',''),nullif(r.data->>'followUpDate','')) end as "dueDate",
            account.data->>'name' as "accountName",r.geo_country as "countryCode",
            r.geo_city as city,r.geo_segment as segment,
            (select coalesce(source.data->>'name',source.data->>'title') from public.oci_records source
              where source.id::text=r.data->>'relatedRecordId'
                and source.kind=r.data->>'relatedRecordKind' and source.status='active') as "relatedRecordName",
            case when r.data->>'actionScope'='Global' then 'Global action'
              when r.geo_country is null then 'Geography unresolved' else 'Account geography' end as "geographicStatus"
          from action_active r left join public.oci_records account
            on account.id=r.account_id and account.kind='accounts' and account.status='active'
          where r.kind='activities'
            and (r.data->>'actionStatus' in ('Accepted','In progress','Snoozed')
              or (r.data->>'actionStatus' is null and r.data->>'activityStatus'='Planned'))),
        execution_actions as (select jsonb_build_object('id',id,'version',version,'accountId',account_id,
            'opportunityId',opportunity_id,'data',data,'accountName',"accountName",
            'countryCode',"countryCode",'city',city,'segment',segment,'geographicStatus',"geographicStatus",
            'dataOrigin',"dataOrigin",'relatedRecordName',"relatedRecordName",
            'dueDate',"dueDate",'timeBucket',case when "dueDate" is null then 'Unscheduled'
              when "dueDate"<current_date::text then 'Overdue'
              when "dueDate"=current_date::text then 'Today' else 'Upcoming' end,
            'priority',case when "dueDate"<current_date::text then 'Urgent'
              when "dueDate"<= (current_date+2)::text then 'High' else 'Routine' end) as action
          from execution_action_candidates order by
            case when "dueDate"<current_date::text then 0 when "dueDate"=current_date::text then 1
              when "dueDate" is null then 3 else 2 end,
            coalesce("dueDate",'9999-12-31'),updated_at desc,id limit 50),
        waiting_for_response as (select jsonb_build_object('id',r.id,'accountName',account.data->>'name',
            'title',r.data->>'title','followUpDate',r.data->>'followUpDate','outcome',r.data->>'outcome',
            'countryCode',r.geo_country,'city',r.geo_city,'geographicStatus',
            case when r.data->>'actionScope'='Global' then 'Global action'
              when r.geo_country is null then 'Geography unresolved' else 'Account geography' end,
            'dataOrigin',r.data_origin) as item
          from action_active r left join public.oci_records account
            on account.id=r.account_id and account.kind='accounts' and account.status='active'
          where r.kind='activities' and r.data->>'responseStatus'='Awaiting external response'
            and r.data->>'activityStatus'='Completed'
            and r.data->>'type' in ('Meeting','Call','Email')
            and nullif(btrim(r.data->>'outcome'),'') is not null
            and nullif(r.data->>'followUpDate','') is not null
          order by r.data->>'followUpDate',r.updated_at desc,r.id limit 25),
        accounts_by_country as (select geo_country as "countryCode",geo_segment as segment,data_origin as "dataOrigin",count(*)::int as count
          from active where kind='accounts' and data->>'accountStatus'='Target' and geo_country is not null
          group by geo_country,geo_segment,data_origin order by 1,2,3),
        accounts_by_segment as (select geo_segment as segment,data_origin as "dataOrigin",count(*)::int as count
          from active where kind='accounts' and data->>'accountStatus'='Target'
          group by geo_segment,data_origin order by 1,2),
        account_verification as (select case
            when data->>'classification'='Verified fact' and nullif(btrim(data->>'source'),'') is not null
              and nullif(btrim(data->>'researchDate'),'') is not null then 'Verified'
            else 'Unverified / insufficient evidence' end as "verificationStatus",
          data_origin as "dataOrigin",count(*)::int as count
          from active where kind='accounts' group by 1,data_origin order by 1,2),
        accounts_awaiting_research as (select id,data->>'name' as name,geo_country as "countryCode",
          geo_city as city,geo_segment as segment,data_origin as "dataOrigin",
          coalesce(data->>'researchStatus','Not researched') as "researchStatus"
          from active where kind='accounts' and data->>'accountStatus'='Target'
            and coalesce(data->>'researchStatus','Not researched') in ('Not researched','Needs verification')
          order by coalesce(data->>'priority'='High',false) desc,updated_at desc,id limit 25),
        high_priority_european_accounts as (select id,data->>'name' as name,geo_country as "countryCode",
          geo_city as city,geo_segment as segment,data_origin as "dataOrigin",data->>'researchStatus' as "researchStatus",
          data->>'classification' as classification,data->>'source' as source,data->>'researchDate' as "researchDate",
          jsonb_build_object('fitEvidence',data->'fitEvidence',
            ${OCI_ACCOUNT_FIT_CRITERIA.map(({ key }) => `'${key}',data->'${key}'`).join(",")}) as "fitAssessment"
          from active where kind='accounts' and data->>'accountStatus'='Target'
            and data->>'priority'='High' and geo_country=ANY(${europePlaceholder}::text[])
          order by case data->>'researchStatus' when 'Needs verification' then 1 when 'Not researched' then 2 when 'In progress' then 3 else 4 end,
            updated_at desc,id limit 25),
        opportunities_by_country as (select geo_country as "countryCode",data_origin as "dataOrigin",count(*)::int as count
          from active where kind='opportunities' and data->>'stage'='Qualified' and geo_country is not null
          group by geo_country,data_origin order by 1,2),
        pipeline_by_country as (select geo_country as "countryCode",geo_segment as segment,data->>'currency' as currency,data_origin as "dataOrigin",
          count(*)::int as count,sum(coalesce((data->>'value')::numeric,0)) as value,
          bool_and(nullif(data->>'probability','') is not null) as "probabilityComplete",
          case when bool_and(nullif(data->>'probability','') is not null)
            then sum((data->>'value')::numeric*(data->>'probability')::numeric/100) else null end as "weightedValue"
          from active where kind='opportunities' and data->>'stage' not in ('Won','Lost','On hold') and geo_country is not null
          group by geo_country,geo_segment,data->>'currency',data_origin order by 1,2,3,4),
        discovery_by_country as (select geo_country as "countryCode",data_origin as "dataOrigin",count(*)::int as count
          from active where kind='discovery' and geo_country is not null group by geo_country,data_origin order by 1,2),
        validated_customer_problems as (select geo_country as "countryCode",data_origin as "dataOrigin",count(*)::int as count
          from active where kind='discovery' and data->>'validation'='Customer-validated'
            and nullif(btrim(data->>'validationEvidence'),'') is not null
            and nullif(btrim(data->>'problems'),'') is not null and geo_country is not null
          group by geo_country,data_origin order by 1,2),
        potential_pilot_candidates as (select geo_country as "countryCode",data_origin as "dataOrigin",
            count(distinct account_id)::int as count
          from active where kind='discovery' and data->>'validation'='Customer-validated'
            and nullif(btrim(data->>'validationEvidence'),'') is not null
            and nullif(btrim(data->>'problems'),'') is not null
            and nullif(btrim(data->>'contractIntelligenceNeeds'),'') is not null
            and nullif(btrim(data->>'validatedUseCases'),'') is not null
            and geo_country is not null and account_id is not null
          group by geo_country,data_origin order by 1,2),
        pilots_by_country as (select geo_country as "countryCode",data->>'offerType' as "offerType",data_origin as "dataOrigin",count(*)::int as count
          from active where kind='pilots' and geo_country is not null group by geo_country,data->>'offerType',data_origin order by 1,2,3),
        revenue_by_country as (select geo_country as "countryCode",geo_segment as segment,data->>'currency' as currency,
          data->>'basis' as basis,coalesce(data->>'revenueClass','Unclassified legacy') as "revenueClass",
          data->>'periodDate' as "periodDate",data_origin as "dataOrigin",sum((data->>'amount')::numeric) as amount,count(*)::int as count
          from active where kind='revenue' and geo_country is not null
          group by geo_country,geo_segment,data->>'currency',data->>'basis',coalesce(data->>'revenueClass','Unclassified legacy'),
            data->>'periodDate',data_origin order by 1,2,3,4,5,6,7),
        priority_opportunities as (select active.id,active.data->>'name' as name,active.data->>'stage' as stage,
          active.data->>'currency' as currency,(active.data->>'value')::numeric as value,
          (active.data->>'probability')::numeric as probability,active.data_origin as "dataOrigin",
          active.geo_country as "countryCode",active.geo_account_priority as priority,
          accounts.data->>'name' as "accountName"
          from active join public.oci_records accounts on accounts.id=active.account_id and accounts.kind='accounts'
          where active.kind='opportunities' and active.data->>'stage' not in ('Won','Lost','On hold')
            and active.geo_country is not null and active.geo_account_priority in ('High','Medium','Low')
          order by case active.geo_account_priority when 'High' then 1 when 'Medium' then 2 else 3 end,
            coalesce((active.data->>'probability')::numeric,0) desc, active.updated_at desc, active.id limit 10),
        data_origins as (select data_origin as origin,count(*)::int as records,
          count(*) filter (where kind='accounts' and data->>'accountStatus'='Target')::int as "targetOrganisations",
          count(*) filter (where kind='opportunities' and data->>'stage'='Qualified')::int as "qualifiedOpportunities",
          count(*) filter (where kind='opportunities' and data->>'stage' not in ('Won','Lost','On hold'))::int as "openOpportunities",
          count(*) filter (where kind='discovery')::int as "discoveryRecords",
          count(*) filter (where kind='pilots')::int as "pilotProposalRecords",
          count(*) filter (where kind='revenue')::int as "revenueRecords"
          from active group by data_origin order by data_origin),
        unresolved_coverage as (select kind,data_origin as origin,count(*)::int as records
          from all_active where kind in ('accounts','contacts','opportunities','activities','discovery','pilots','revenue','market')
            and geo_country is null and (geo_market_scope is null or geo_market_scope='UNRESOLVED')
          group by kind,data_origin order by kind,data_origin)
        select jsonb_build_object(
          'targetOrganisations',(select count(*) from active where kind='accounts' and data->>'accountStatus'='Target'),
          'activeOrganisations',(select count(*) from active where kind='accounts'),
          'qualifiedAccounts',(select count(*) from active where kind='accounts' and data->>'accountStatus'='Qualified'),
          'activeOpportunities',(select count(*) from active where kind='opportunities' and data->>'stage' not in ('Won','Lost','On hold')),
          'onHoldOpportunities',(select count(*) from active where kind='opportunities' and data->>'stage'='On hold'),
          'upcomingActivities',(select count(*) from active where kind='activities' and data->>'activityStatus'='Planned' and data->>'dueDate'>=current_date::text),
          'overdueActivities',(select count(*) from active where kind='activities' and data->>'activityStatus'='Planned' and data->>'dueDate'<current_date::text),
          'overdueCommercialActions',(select count(*) from active where nullif(data->>'followUpDate','') is not null
            and data->>'followUpDate'<current_date::text and nullif(btrim(data->>'nextAction'),'') is not null),
          'outstandingActions',(select count(*) from action_active where kind='activities'
            and (data->>'actionStatus' in ('Accepted','In progress','Snoozed')
              or (data->>'actionStatus' is null and data->>'activityStatus'='Planned'))),
          'overdueActions',(select count(*) from action_active where kind='activities'
            and (data->>'actionStatus' in ('Accepted','In progress','Snoozed')
              or (data->>'actionStatus' is null and data->>'activityStatus'='Planned'))
            and (case when data->>'actionStatus'='Snoozed' then nullif(data->>'reviewDate','')
              else coalesce(nullif(data->>'dueDate',''),nullif(data->>'followUpDate','')) end)<current_date::text),
          'actionsDueToday',(select count(*) from action_active where kind='activities'
            and (data->>'actionStatus' in ('Accepted','In progress','Snoozed')
              or (data->>'actionStatus' is null and data->>'activityStatus'='Planned'))
            and (case when data->>'actionStatus'='Snoozed' then nullif(data->>'reviewDate','')
              else coalesce(nullif(data->>'dueDate',''),nullif(data->>'followUpDate','')) end)=current_date::text),
          'actionsDueSoon',(select count(*) from action_active where kind='activities'
            and (data->>'actionStatus' in ('Accepted','In progress','Snoozed')
              or (data->>'actionStatus' is null and data->>'activityStatus'='Planned'))
            and (case when data->>'actionStatus'='Snoozed' then nullif(data->>'reviewDate','')
              else coalesce(nullif(data->>'dueDate',''),nullif(data->>'followUpDate','')) end)
              between (current_date+1)::text and (current_date+7)::text),
          'actionsCompletedThisMonth',(select count(*) from action_active where kind='activities'
            and coalesce(nullif(data->>'completedDate',''),nullif(data->>'dueDate',''))
              between date_trunc('month',current_date)::date::text and current_date::text
            and (data->>'actionStatus'='Completed' or data->>'activityStatus'='Completed')),
          'followUpCompletionRate',(select case when count(*) filter (
              where data->>'activityStatus'<>'Cancelled'
                and nullif(data->>'dueDate','') between date_trunc('month',current_date)::date::text and current_date::text)=0
              then null else round(count(*) filter (where data->>'activityStatus'='Completed'
                and nullif(data->>'dueDate','') between date_trunc('month',current_date)::date::text and current_date::text)::numeric*100/
                nullif(count(*) filter (where data->>'activityStatus'<>'Cancelled'
                and nullif(data->>'dueDate','') between date_trunc('month',current_date)::date::text and current_date::text),0),1) end
            from action_active where kind='activities'),
          'opportunitiesWithNextAction',(select count(*) from active where kind='opportunities'
            and data->>'stage' not in ('Won','Lost','On hold') and nullif(btrim(data->>'nextAction'),'') is not null),
          'opportunitiesWithoutNextAction',(select count(*) from active where kind='opportunities'
            and data->>'stage' not in ('Won','Lost','On hold') and nullif(btrim(data->>'nextAction'),'') is null),
          'opportunitiesWithoutRecentActivity',(select count(*) from active where kind='opportunities'
            and data->>'stage' not in ('Won','Lost','On hold')
            and nullif(data->>'lastInteraction','') <= (current_date-30)::text),
          'staleActivityThresholdDays',30,
          'proposalsAwaitingDecision',(select count(*) from active where kind='pilots'
            and data->>'offerType'='Proposal' and data->>'proposalStatus'='Awaiting customer'),
          'pilotsAwaitingCustomerDecision',(select count(*) from active where kind='pilots'
            and data->>'offerType'='Pilot' and data->>'pilotStatus'='Proposed'
            and data->>'proposalStatus'='Awaiting customer'),
          'validatedDiscoveriesLinkedToOpportunity',(select count(distinct discovery.id) from active discovery
            join active opportunity on opportunity.kind='opportunities' and opportunity.account_id=discovery.account_id
              and opportunity.data->>'stage' not in ('Won','Lost','On hold')
            where discovery.kind='discovery' and discovery.data->>'validation'='Customer-validated'),
          'discoveryConversations',(select count(*) from active where kind='discovery'),
          'activeDiscoveries',(select count(*) from active where kind='discovery'
            and data->>'discoveryStatus' in ('Preparing','Interview scheduled','Needs follow-up')),
          'demonstrations',(select count(*) from active where kind='opportunities' and data->>'stage'='Product demonstration'),
          'pilotOpportunities',(select count(*) from active where kind='pilots' and data->>'offerType'='Pilot' and data->>'pilotStatus' in ('Proposed','Active')),
          'pilotProposals',(select count(*) from active where kind='pilots' and data->>'offerType'='Proposal'
            and data->>'proposalStatus' in ('Draft','Internal review','Awaiting customer')),
          'proposalsIssued',(select count(*) from active where kind='pilots' and data->>'offerType'='Proposal'
            and (data->>'proposalStatus' in ('Awaiting customer','Accepted','Declined')
              or (data->>'proposalStatus' is null and data->>'pilotStatus' not in ('Draft','Cancelled')))),
          'wonOpportunities',(select count(*) from active where kind='opportunities' and data->>'stage'='Won'),
          'lostOpportunities',(select count(*) from active where kind='opportunities' and data->>'stage'='Lost'),
          'closedOpportunityWinRate',(select case when count(*)=0 then null
            else round(count(*) filter (where data->>'stage'='Won')::numeric/count(*)*100,1) end
            from active where kind='opportunities' and data->>'stage' in ('Won','Lost')),
          'recognisedRevenueRecords',(select count(*) from active where kind='revenue' and data->>'revenueClass'='Recognised actual'),
          'contractedRevenueRecords',(select count(*) from active where kind='revenue' and data->>'revenueClass'='Contracted future'),
          'committedPilotRevenueRecords',(select count(*) from active where kind='revenue' and data->>'revenueClass'='Committed pilot'),
          'speculativeForecastRecords',(select count(*) from active where kind='revenue' and data->>'revenueClass'='Speculative forecast')) as metrics,
          coalesce((select jsonb_agg(recommendation order by
            case recommendation->>'urgency' when 'Urgent' then 0 else 1 end,
            coalesce(recommendation->>'dueDate','9999-12-31')) from actions),'[]'::jsonb) as "nextActions",
          coalesce((select jsonb_agg(action order by
            case action->>'timeBucket' when 'Overdue' then 0 when 'Today' then 1
              when 'Upcoming' then 2 else 3 end,coalesce(action->>'dueDate','9999-12-31'))
            from execution_actions),'[]'::jsonb) as "executionActions",
          coalesce((select jsonb_agg(item) from waiting_for_response),'[]'::jsonb) as "waitingForResponse",
          coalesce((select jsonb_agg(financial) from financial),'[]'::jsonb) as financials,
          coalesce((select jsonb_agg(pipeline) from pipeline),'[]'::jsonb) as pipeline,
          coalesce((select jsonb_agg(accounts_by_country) from accounts_by_country),'[]'::jsonb) as "accountsByCountry",
          coalesce((select jsonb_agg(accounts_by_segment) from accounts_by_segment),'[]'::jsonb) as "accountsBySegment",
          coalesce((select jsonb_agg(account_verification) from account_verification),'[]'::jsonb) as "accountVerification",
          coalesce((select jsonb_agg(accounts_awaiting_research) from accounts_awaiting_research),'[]'::jsonb) as "accountsAwaitingResearch",
          coalesce((select jsonb_agg(high_priority_european_accounts) from high_priority_european_accounts),'[]'::jsonb) as "highPriorityEuropeanAccounts",
          coalesce((select jsonb_agg(opportunities_by_country) from opportunities_by_country),'[]'::jsonb) as "opportunitiesByCountry",
          coalesce((select jsonb_agg(pipeline_by_country) from pipeline_by_country),'[]'::jsonb) as "pipelineByCountry",
          coalesce((select jsonb_agg(discovery_by_country) from discovery_by_country),'[]'::jsonb) as "discoveryByCountry",
          coalesce((select jsonb_agg(validated_customer_problems) from validated_customer_problems),'[]'::jsonb) as "validatedCustomerProblems",
          coalesce((select jsonb_agg(potential_pilot_candidates) from potential_pilot_candidates),'[]'::jsonb) as "potentialPilotCandidates",
          coalesce((select jsonb_agg(pilots_by_country) from pilots_by_country),'[]'::jsonb) as "pilotsByCountry",
          coalesce((select jsonb_agg(revenue_by_country) from revenue_by_country),'[]'::jsonb) as "revenueByCountry",
          coalesce((select jsonb_agg(priority_opportunities) from priority_opportunities),'[]'::jsonb) as "priorityOpportunities",
          coalesce((select jsonb_agg(data_origins) from data_origins),'[]'::jsonb) as "dataOrigins",
          coalesce((select jsonb_agg(unresolved_coverage) from unresolved_coverage),'[]'::jsonb) as "unresolvedCoverage",
          $${geo.params.length + 1}::text as "geographicScope"`, [...geo.params, geography.scope, europeanCountries]);
    },
  };
}
