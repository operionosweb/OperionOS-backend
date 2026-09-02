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