import pool from "../../db.js";
import { assertOrganizationScope } from "./scope.js";

const MAX_PORTFOLIO_RUNS = 201;
const MAX_AIRCRAFT_RELATIONSHIPS = 2001;

export function createAviationContractPortfolioRepository(pgPool = pool) {
  return {
    async listLatestCompletedRuns(organizationId) {
      assertOrganizationScope(organizationId);
      const result = await pgPool.query(
        `with ranked_runs as (
           select run.id as analysis_run_id, run.organization_id, run.contract_id,
                  run.document_version_id, run.completed_at, contract.title as contract_title,
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
         )
         select analysis_run_id, organization_id, contract_id, document_version_id,
                completed_at, contract_title, classification
         from ranked_runs
         where run_rank = 1
         order by contract_title asc, contract_id asc
         limit $2`,
        [organizationId, MAX_PORTFOLIO_RUNS],
      );
      return result.rows;
    },

    async listAircraftRelationships(organizationId) {
      assertOrganizationScope(organizationId);
      const result = await pgPool.query(
        `select relationship.id, relationship.organization_id, relationship.contract_id,
                relationship.aircraft_id, relationship.relationship_type,
                relationship.confidence, relationship.source_reference,
                relationship.source_identifier, relationship.source_evidence_id,
                contract.title as contract_title, aircraft.registration,
                aircraft.serial_number, aircraft.aircraft_type,
                evidence.review_status as evidence_review_status,
                evidence.document_version_id as evidence_document_version_id,
                evidence.page_number, evidence.source_locator, evidence.excerpt
         from aircraft_contract_relationships relationship
         join contracts contract
           on contract.id = relationship.contract_id
          and contract.organization_id = relationship.organization_id
         join aircraft
           on aircraft.id = relationship.aircraft_id
         join aircraft_organization_relationships organization_relationship
           on organization_relationship.aircraft_id = relationship.aircraft_id
          and organization_relationship.organization_id = relationship.organization_id
          and organization_relationship.active = true
         left join intelligence_evidence evidence
           on evidence.id = relationship.source_evidence_id
          and evidence.organization_id = relationship.organization_id
          and evidence.contract_id = relationship.contract_id
         where relationship.organization_id = $1
           and relationship.active = true
         order by relationship.aircraft_id, contract.title, relationship.id
         limit $2`,
        [organizationId, MAX_AIRCRAFT_RELATIONSHIPS],
      );
      return result.rows;
    },
  };
}
