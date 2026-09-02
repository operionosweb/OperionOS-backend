import { assertOrganizationScope, assertResourceId } from "../../repositories/phase3/scope.js";
import { AVIATION_DATA_STATES, getProductionAviationProvider } from "../../providers/aviation/aviationProvider.js";
import { createAviationRelationshipRepository } from "../../repositories/aviation/aviationRelationshipRepository.js";

const DEFAULT_STALE_AFTER_MS = 90_000;

function latestTimestamp(aircraft) {
  return aircraft.reduce((latest, item) => {
    const timestamp = Date.parse(item.position?.timestamp || item.timestamp || "");
    return Number.isFinite(timestamp) && timestamp > latest ? timestamp : latest;
  }, 0);
}

function deriveState(providerState, aircraft, now, staleAfterMs) {
  if (providerState !== AVIATION_DATA_STATES.LIVE) return providerState;
  const latest = latestTimestamp(aircraft);
  if (!latest || now - latest > staleAfterMs) return AVIATION_DATA_STATES.DELAYED;
  return AVIATION_DATA_STATES.LIVE;
}

export function createAviationDataService({
  provider = getProductionAviationProvider(),
  relationships = createAviationRelationshipRepository(),
  now = () => Date.now(),
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
} = {}) {
  return {
    async getStatus({ organizationId }) {
      assertOrganizationScope(organizationId);
      return {
        state: provider.state,
        provider: provider.id,
        supportsStreaming: Boolean(provider.supportsStreaming),
        updatedAt: null,
      };
    },

    async listAircraft({ organizationId, companyOnly = false }) {
      assertOrganizationScope(organizationId);
      if (provider.state === AVIATION_DATA_STATES.UNAVAILABLE) {
        return { state: AVIATION_DATA_STATES.UNAVAILABLE, provider: provider.id, updatedAt: null, aircraft: [] };
      }

      const aircraft = await provider.listAircraft({ organizationId });
      const companyIds = companyOnly && relationships
        ? new Set(await relationships.listAircraftIdsByOrganization(organizationId))
        : null;
      const visible = companyIds ? aircraft.filter((item) => companyIds.has(item.id)) : aircraft;
      const updatedAtMs = latestTimestamp(visible);

      return {
        state: deriveState(provider.state, visible, now(), staleAfterMs),
        provider: provider.id,
        updatedAt: updatedAtMs ? new Date(updatedAtMs).toISOString() : null,
        aircraft: visible,
      };
    },

    async getAircraftIntelligence({ organizationId, aircraftId }) {
      assertOrganizationScope(organizationId);
      assertResourceId(aircraftId, "aircraftId");
      if (!relationships) return null;
      return relationships.getAircraftIntelligence({ organizationId, aircraftId });
    },

    async getWeather({ organizationId, bounds }) {
      assertOrganizationScope(organizationId);
      const weather = await provider.getWeather({ organizationId, bounds });
      return {
        state: weather.state || AVIATION_DATA_STATES.UNAVAILABLE,
        updatedAt: weather.updatedAt || null,
        layers: weather.layers || [],
      };
    },
  };
}