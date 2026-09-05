import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAviationRelationshipRepository } from "../repositories/aviation/aviationRelationshipRepository.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("aviation migration is tenant scoped and authenticated read only", async () => {
  const migration = await read("supabase/migrations/015_aviation_intelligence_foundation.sql");
  for (const table of ["aircraft_organization_relationships", "aviation_flights", "flight_positions", "aircraft_contract_relationships"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(migration, /public\.is_organization_member\(organization_id\)/);
  assert.match(migration, /grant select .* to authenticated/s);
  assert.doesNotMatch(migration, /grant (insert|update|delete|all).* to authenticated/i);
  assert.doesNotMatch(migration, /for (insert|update|delete|all) to authenticated/i);
});

test("aviation API derives organization scope from authenticated middleware", async () => {
  const routes = await read("routes/aviationRoutes.js");
  assert.match(routes, /authenticateUser, requireOrganizationMembership, requireOrganizationPermission\("contract:read"\)/);
  assert.match(routes, /organizationId: req\.auth\.organizationId/g);
  assert.doesNotMatch(routes, /organizationId: req\.(body|query|params)/);
  assert.doesNotMatch(routes, /router\.(post|put|patch|delete)/);
});

test("production frontend never imports the synthetic aviation provider", async () => {
  const page = await read("frontend/src/routes/ProductionLiveTracking.jsx");
  const api = await read("frontend/src/lib/aviationApi.js");
  assert.match(page, /No synthetic positions are shown in production/);
  assert.match(page, /Weather data temporarily unavailable/);
  assert.doesNotMatch(`${page}\n${api}`, /demo\/aviationDataProvider|SyntheticAviationProvider/);
});

test("aviation schema preserves nullable provider fields and contract lineage", async () => {
  const migration = await read("supabase/migrations/015_aviation_intelligence_foundation.sql");
  assert.match(migration, /aircraft_id uuid not null references public\.aircraft/);
  assert.match(migration, /contract_id uuid not null references public\.contracts/);
  assert.match(migration, /confidence numeric\(5,4\)/);
  assert.doesNotMatch(migration, /altitude_meters double precision not null/);
  assert.doesNotMatch(migration, /ground_speed_kph double precision not null/);
});

test("aircraft relationship repository applies organization scope to every query", async () => {
  const organizationId = "2ed941d7-21e1-4b98-a2a8-bf13fd34878a";
  const aircraftId = "e4e9b464-c1f8-4c74-af04-0d38056b79d4";
  const calls = [];
  const repository = createAviationRelationshipRepository(async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes("aircraft_organization_relationships")) return { rows: [{ relationship_type: "operates" }] };
    return { rows: [] };
  });
  const result = await repository.getAircraftIntelligence({ organizationId, aircraftId });
  assert.deepEqual(result, { organizationRelationship: "operates", contracts: [], impact: null });
  assert.equal(calls.length, 2);
  for (const call of calls) assert.deepEqual(call.params, [organizationId, aircraftId]);
});

test("contract relationship reads require active tenant aircraft and contract scope", async () => {
  const organizationId = "2ed941d7-21e1-4b98-a2a8-bf13fd34878a";
  const contractId = "ae8c2f74-a905-4537-a207-4a839b23ccac";
  const calls = [];
  const repository = createAviationRelationshipRepository(async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ id: "relationship-1", registration: "G-SYN1" }] };
  });

  const result = await repository.listByContract({ organizationId, contractId });

  assert.deepEqual(result, [{ id: "relationship-1", registration: "G-SYN1" }]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, [organizationId, contractId]);
  assert.match(calls[0].sql, /organization_relationship\.organization_id = relationship\.organization_id/);
  assert.match(calls[0].sql, /organization_relationship\.active = true/);
  assert.match(calls[0].sql, /relationship\.organization_id = \$1[\s\S]*relationship\.contract_id = \$2[\s\S]*relationship\.active = true/);
});

test("contract relationship materialization requires evidence and active tenant aircraft", async () => {
  const organizationId = "2ed941d7-21e1-4b98-a2a8-bf13fd34878a";
  const contractId = "ae8c2f74-a905-4537-a207-4a839b23ccac";
  const evidenceId = "fb2df312-b5f9-44d8-b7ac-eebda8d772f9";
  const calls = [];
  const repository = createAviationRelationshipRepository(async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ id: "relationship-1" }] };
  });

  const skipped = await repository.materializeContractRelationships({
    organizationId,
    contractId,
    relationshipType: "leased_under",
    identifiers: [{ type: "AIRCRAFT_REGISTRATION", value: "G-SYN1", evidence: null }],
  });
  assert.deepEqual(skipped, []);
  assert.equal(calls.length, 0);

  const relationships = await repository.materializeContractRelationships({
    organizationId,
    contractId,
    relationshipType: "leased_under",
    identifiers: [{ type: "AIRCRAFT_REGISTRATION", value: "G-SYN1", evidence: { evidenceId, confidence: 0.95, sourceLocation: "page:1" } }],
  });
  assert.deepEqual(relationships, [{ id: "relationship-1" }]);
  assert.match(calls[0].sql, /organization_relationship\.organization_id = \$1[\s\S]*organization_relationship\.active = true/);
  assert.match(calls[0].sql, /upper\(aircraft\.registration\) = upper\(\$8\)/);
  assert.deepEqual(calls[0].params, [organizationId, contractId, "leased_under", 0.95, "page:1", "AIRCRAFT_REGISTRATION:G-SYN1", evidenceId, "G-SYN1"]);
});