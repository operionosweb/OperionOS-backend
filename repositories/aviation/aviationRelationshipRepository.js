import { query } from "../../db.js";
import { assertOrganizationScope, assertResourceId } from "../phase3/scope.js";

export function createAviationRelationshipRepository(queryFn = query) {
  return {
    async listAircraftIdsByOrganization(organizationId) {
      assertOrganizationScope(organizationId);
      const result = await queryFn(
        "select aircraft_id from aircraft_organization_relationships where organization_id = $1 and active = true",
        [organizationId]
      );
      return result.rows.map((row) => row.aircraft_id);
    },

    async getAircraftIntelligence({ organizationId, aircraftId }) {
      assertOrganizationScope(organizationId);
      assertResourceId(aircraftId, "aircraftId");
      const access = await queryFn(
        "select relationship_type from aircraft_organization_relationships where organization_id = $1 and aircraft_id = $2 and active = true",
        [organizationId, aircraftId]
      );
      if (!access.rows.length) return null;

      const contracts = await queryFn(
        `select relationship.contract_id, relationship.relationship_type, relationship.confidence,
                relationship.source_reference, contract.title, contract.status
         from aircraft_contract_relationships relationship
         join contracts contract on contract.id = relationship.contract_id and contract.organization_id = relationship.organization_id
         where relationship.organization_id = $1 and relationship.aircraft_id = $2 and relationship.active = true
         order by contract.title`,
        [organizationId, aircraftId]
      );
      const contractIds = contracts.rows.map((row) => row.contract_id);
      if (!contractIds.length) {
        return { organizationRelationship: access.rows[0].relationship_type, contracts: [], impact: null };
      }

      const counts = await queryFn(
        `select
           (select count(*) from obligations where organization_id = $1 and contract_id = any($2::uuid[]))::int as obligations,
           (select count(*) from deadlines where organization_id = $1 and contract_id = any($2::uuid[]))::int as deadlines,
           (select count(*) from risks where organization_id = $1 and contract_id = any($2::uuid[]) and status = 'active')::int as risks`,
        [organizationId, contractIds]
      );
      return {
        organizationRelationship: access.rows[0].relationship_type,
        contracts: contracts.rows,
        impact: { contracts: contractIds.length, ...counts.rows[0] },
      };
    },
  };
}