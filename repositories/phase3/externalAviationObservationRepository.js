import pool from "../../db.js";
import { assertOrganizationScope, assertResourceId } from "./scope.js";

const OBSERVATION_COLUMNS = [
  "indicator_id",
  "category",
  "value",
  "unit",
  "currency",
  "base_currency",
  "quote_currency",
  "market_applicability",
  "observation_date",
  "publication_timestamp",
  "retrieval_timestamp",
  "source_id",
  "source_reference",
  "data_quality_status",
  "record_type",
  "is_historical",
];
const AVIATION_INDICATOR_IDS = [
  "fuel.jet.us.gulf_coast",
  "fx.eur.usd",
  "fx.eur.gbp",
  "fx.eur.chf",
  "fx.eur.jpy",
  "fx.eur.cad",
  "fx.eur.aud",
  "fx.eur.cny",
  "fx.eur.dkk",
  "fx.eur.hkd",
  "fx.eur.nok",
  "fx.eur.nzd",
  "fx.eur.sek",
  "fx.eur.sgd",
  "interest.us.sofr",
  "inflation.us.cpi.cuur0000sa0",
  "inflation.ea20.hicp.cp00.i15",
];

export function createExternalAviationObservationRepository(pgPool = pool) {
  return {
    async insertReviewedInflationObservation(observation, reviewerId) {
      assertResourceId(reviewerId, "reviewerId");
      const columns = [...OBSERVATION_COLUMNS, "reviewed_by", "reviewed_at"];
      const values = [...OBSERVATION_COLUMNS.map((column) => observation[column]), reviewerId, observation.retrieval_timestamp];
      const result = await pgPool.query(
        `insert into external_market_observations (${columns.join(", ")}, update_status)
         select ${values.map((_, index) => `$${index + 1}`).join(", ")},
           case when exists (
             select 1 from external_market_observations
             where indicator_id = $1 and observation_date = $9::date and value is distinct from $3::numeric
           ) then 'revision' else 'recorded' end
         on conflict do nothing`,
        values,
      );
      return { inserted: result.rowCount || 0 };
    },

    async insertObservations(observations) {
      if (!Array.isArray(observations)) throw new TypeError("Observations must be an array");
      if (observations.length === 0) return { inserted: 0 };

      const values = [];
      const rows = observations.map((observation, rowIndex) => {
        const placeholders = OBSERVATION_COLUMNS.map((column, columnIndex) => {
          values.push(observation[column]);
          return `$${rowIndex * OBSERVATION_COLUMNS.length + columnIndex + 1}`;
        });
        return `(${placeholders.join(", ")})`;
      });
      const result = await pgPool.query(
        `insert into external_market_observations (${OBSERVATION_COLUMNS.join(", ")}, update_status)
         select incoming.*,
                case when exists (
                  select 1
                  from external_market_observations prior
                  where prior.source_id = incoming.source_id
                    and prior.indicator_id = incoming.indicator_id
                    and prior.observation_date = incoming.observation_date
                    and prior.value is distinct from incoming.value
                ) then 'revision' else 'recorded' end
         from (values ${rows.join(", ")}) as incoming (${OBSERVATION_COLUMNS.join(", ")})
         on conflict do nothing`,
        values,
      );
      return { inserted: result.rowCount || 0 };
    },

    async listRecentObservations() {
      const result = await pgPool.query(
        `with ranked_observations as (
           select id, indicator_id, category, value, unit, currency, base_currency,
                  quote_currency, market_applicability, observation_date,
                  publication_timestamp, retrieval_timestamp, source_id,
                  source_reference, data_quality_status, record_type, is_historical,
                  update_status,
                  to_jsonb(external_market_observations)->>'reviewed_by' as reviewed_by,
                  to_jsonb(external_market_observations)->>'reviewed_at' as reviewed_at,
                  row_number() over (
                    partition by indicator_id
                    order by observation_date desc, retrieval_timestamp desc, id desc
                  ) as observation_rank,
                  count(*) over (partition by indicator_id) as indicator_record_count
           from external_market_observations
           where indicator_id = any($1::text[])
         )
         select id, indicator_id, category, value, unit, currency, base_currency,
                quote_currency, market_applicability, observation_date,
                publication_timestamp, retrieval_timestamp, source_id,
                source_reference, data_quality_status, record_type, is_historical,
                update_status, reviewed_by, reviewed_at, indicator_record_count
         from ranked_observations
         where observation_rank <= 501
         order by indicator_id, observation_date desc, retrieval_timestamp desc, id desc`,
        [AVIATION_INDICATOR_IDS],
      );
      return result.rows;
    },

    async listVerifiedContractProvisions(organizationId, { contractId = null, analysisRunId = null } = {}) {
      assertOrganizationScope(organizationId);
      if (contractId) assertResourceId(contractId, "contractId");
      if (analysisRunId) assertResourceId(analysisRunId, "analysisRunId");
      const result = await pgPool.query(
        `with ranked_runs as (
           select run.id as analysis_run_id, run.organization_id, run.contract_id,
                  run.document_version_id, contract.title as contract_title,
                  profile.classification,
                  row_number() over (
                    partition by run.contract_id
                    order by run.completed_at desc nulls last, run.created_at desc nulls last, run.id desc
                  ) as run_rank
           from analysis_runs run
           join contracts contract
             on contract.id = run.contract_id
            and contract.organization_id = run.organization_id
           left join contract_intelligence_profiles profile
             on profile.analysis_run_id = run.id
            and profile.organization_id = run.organization_id
           where run.organization_id = $1
             and run.status = 'completed'
             and profile.classification ->> 'status' = 'confirmed'
             and profile.classification ->> 'type' = any($2::text[])
             and ($3::uuid is null or run.contract_id = $3)
             and ($4::uuid is null or run.id = $4)
         )
         select clause.id as clause_id, clause.organization_id, clause.contract_id,
                clause.document_version_id, clause.analysis_run_id,
                clause.clause_number, clause.title as clause_title,
                clause.source_text, clause.review_status as clause_review_status,
                run.contract_title, run.classification,
                evidence.id as evidence_id, evidence.page_number,
                evidence.source_locator, evidence.excerpt,
                evidence.review_status as evidence_review_status,
                linked_obligation.id as obligation_id,
                linked_obligation.description as obligation_description,
                linked_obligation.review_status as obligation_review_status,
                linked_obligation.obligation_evidence_id,
                linked_obligation.obligation_page_number,
                linked_obligation.obligation_source_locator,
                linked_obligation.obligation_excerpt,
                linked_obligation.obligation_evidence_review_status
         from ranked_runs run
         join clauses clause
           on clause.organization_id = run.organization_id
          and clause.contract_id = run.contract_id
          and clause.document_version_id = run.document_version_id
          and clause.analysis_run_id = run.analysis_run_id
         join clause_evidence link
           on link.organization_id = clause.organization_id
          and link.clause_id = clause.id
          and link.support_type = 'supports'
         join intelligence_evidence evidence
           on evidence.id = link.evidence_id
          and evidence.organization_id = link.organization_id
          and evidence.contract_id = clause.contract_id
          and evidence.document_version_id = clause.document_version_id
          and evidence.analysis_run_id = clause.analysis_run_id
         left join lateral (
           select obligation.id, obligation.description, obligation.review_status,
                  obligation_source.id as obligation_evidence_id,
                  obligation_source.page_number as obligation_page_number,
                  obligation_source.source_locator as obligation_source_locator,
                  obligation_source.excerpt as obligation_excerpt,
                  obligation_source.review_status as obligation_evidence_review_status
           from obligations obligation
           join obligation_evidence obligation_link
             on obligation_link.organization_id = obligation.organization_id
            and obligation_link.obligation_id = obligation.id
            and obligation_link.support_type = 'supports'
           join intelligence_evidence obligation_source
             on obligation_source.id = obligation_link.evidence_id
            and obligation_source.organization_id = obligation_link.organization_id
            and obligation_source.contract_id = obligation.contract_id
            and obligation_source.document_id = obligation.document_id
            and obligation_source.document_version_id = obligation.document_version_id
            and obligation_source.analysis_run_id = obligation.analysis_run_id
           where obligation.organization_id = clause.organization_id
             and obligation.contract_id = clause.contract_id
             and obligation.document_id = clause.document_id
             and obligation.document_version_id = clause.document_version_id
             and obligation.analysis_run_id = clause.analysis_run_id
             and obligation.clause_id = clause.id
             and obligation.obligation_type = 'payment'
             and obligation.review_status = 'verified'
             and obligation_source.review_status = 'verified'
           order by obligation_link.is_primary desc, obligation_link.rank asc,
                    obligation.confidence desc, obligation.id
           limit 1
         ) linked_obligation on true
         where run.run_rank = 1
           and clause.review_status = 'verified'
           and evidence.review_status = 'verified'
         order by clause.contract_id, clause.clause_number, evidence.page_number
         limit 2001`,
        [organizationId, [
          "AIRCRAFT_LEASE",
          "AIRCRAFT_PURCHASE",
          "MRO",
          "ENGINE_MAINTENANCE",
          "POWER_BY_HOUR",
          "COMPONENT_SUPPORT",
          "INSURANCE",
          "GROUND_HANDLING",
          "AIRPORT_SERVICES",
          "SUPPLIER",
          "FINANCING",
        ], contractId, analysisRunId],
      );
      return result.rows;
    },
  };
}
