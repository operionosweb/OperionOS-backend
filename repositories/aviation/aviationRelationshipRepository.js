import { query } from "../../db.js";
import { assertOrganizationScope, assertResourceId } from "../phase3/scope.js";

export function createAviationRelationshipRepository(queryFn = query) {
  return {
    async materializeContractRelationships({ organizationId, contractId, relationshipType, identifiers }) {
      assertOrganizationScope(organizationId);
      assertResourceId(contractId, "contractId");
      const supported = (identifiers || []).filter((identifier) =>
        ["AIRCRAFT_REGISTRATION", "AIRCRAFT_MSN"].includes(identifier.type)
        && identifier.value
        && identifier.evidence?.evidenceId
      );
      const relationships = [];
      for (const identifier of supported) {
        const aircraftColumn = identifier.type === "AIRCRAFT_REGISTRATION" ? "registration" : "serial_number";
        const result = await queryFn(
          `insert into aircraft_contract_relationships (
             organization_id, aircraft_id, contract_id, relationship_type, active,
             confidence, source_reference, source_identifier, source_evidence_id
           )
           select $1, aircraft.id, $2, $3, true, $4, $5, $6, $7
           from aircraft
           join aircraft_organization_relationships organization_relationship
             on organization_relationship.aircraft_id = aircraft.id
            and organization_relationship.organization_id = $1
            and organization_relationship.active = true
           where upper(aircraft.${aircraftColumn}) = upper($8)
           on conflict (organization_id, aircraft_id, contract_id, relationship_type)
           do update set active = true, confidence = excluded.confidence,
             source_reference = excluded.source_reference,
             source_identifier = excluded.source_identifier,
             source_evidence_id = excluded.source_evidence_id
           returning *`,
          [organizationId, contractId, relationshipType, identifier.evidence.confidence || null,
            identifier.evidence.sourceLocation || null, `${identifier.type}:${identifier.value}`,
            identifier.evidence.evidenceId, identifier.value]
        );
        relationships.push(...result.rows);
      }
      return relationships;
    },

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