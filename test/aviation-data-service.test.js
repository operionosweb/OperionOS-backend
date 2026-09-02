import test from "node:test";
import assert from "node:assert/strict";

import { AVIATION_DATA_STATES, createUnavailableAviationProvider } from "../providers/aviation/aviationProvider.js";
import { createAviationDataService } from "../services/aviation/aviationDataService.js";

const organizationId = "2ed941d7-21e1-4b98-a2a8-bf13fd34878a";

test("production aviation defaults to unavailable without inventing aircraft", async () => {
  const service = createAviationDataService({ provider: createUnavailableAviationProvider() });
  const result = await service.listAircraft({ organizationId });
  assert.deepEqual(result, { state: "UNAVAILABLE", provider: "unconfigured", updatedAt: null, aircraft: [] });
});

test("live provider data is marked delayed when its newest position is stale", async () => {
  const service = createAviationDataService({
    provider: {
      id: "test-provider",
      state: AVIATION_DATA_STATES.LIVE,
      supportsStreaming: false,
      async listAircraft() { return [{ id: "aircraft-1", position: { timestamp: "2026-09-02T10:00:00.000Z" } }]; },
    },
    now: () => Date.parse("2026-09-02T10:03:00.000Z"),
  });
  const result = await service.listAircraft({ organizationId });
  assert.equal(result.state, AVIATION_DATA_STATES.DELAYED);
  assert.equal(result.updatedAt, "2026-09-02T10:00:00.000Z");
});

test("company aircraft filtering is derived from server-side organization relationships", async () => {
  const provider = {
    id: "test-provider",
    state: AVIATION_DATA_STATES.SYNTHETIC,
    async listAircraft() { return [{ id: "aircraft-1" }, { id: "aircraft-2" }]; },
  };
  const relationships = {
    async listAircraftIdsByOrganization(receivedOrganizationId) {
      assert.equal(receivedOrganizationId, organizationId);
      return ["aircraft-2"];
    },
  };
  const service = createAviationDataService({ provider, relationships });
  const result = await service.listAircraft({ organizationId, companyOnly: true });
  assert.deepEqual(result.aircraft.map((item) => item.id), ["aircraft-2"]);
  assert.equal(result.state, AVIATION_DATA_STATES.SYNTHETIC);
});

test("aircraft intelligence passes organization scope to the relationship repository", async () => {
  const aircraftId = "e4e9b464-c1f8-4c74-af04-0d38056b79d4";
  const relationships = {
    async getAircraftIntelligence(scope) {
      assert.deepEqual(scope, { organizationId, aircraftId });
      return { contracts: [], impact: null };
    },
  };
  const service = createAviationDataService({ relationships });
  assert.deepEqual(await service.getAircraftIntelligence({ organizationId, aircraftId }), { contracts: [], impact: null });
});

test("provider failures are surfaced and never converted into empty live data", async () => {
  const service = createAviationDataService({
    provider: {
      id: "failing-provider",
      state: AVIATION_DATA_STATES.LIVE,
      async listAircraft() { throw new Error("Provider unavailable"); },
    },
  });
  await assert.rejects(() => service.listAircraft({ organizationId }), /Provider unavailable/);
});

test("unconfigured weather is explicitly unavailable", async () => {
  const service = createAviationDataService({ provider: createUnavailableAviationProvider() });
  assert.deepEqual(await service.getWeather({ organizationId }), { state: "UNAVAILABLE", updatedAt: null, layers: [] });
});

test("invalid aircraft identifiers are rejected before repository access", async () => {
  let called = false;
  const service = createAviationDataService({ relationships: { async getAircraftIntelligence() { called = true; } } });
  await assert.rejects(() => service.getAircraftIntelligence({ organizationId, aircraftId: "not-an-id" }), /valid UUID/);
  assert.equal(called, false);
});