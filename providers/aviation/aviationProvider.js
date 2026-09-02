export const AVIATION_DATA_STATES = Object.freeze({
  LIVE: "LIVE",
  DELAYED: "DATA_DELAYED",
  SYNTHETIC: "SYNTHETIC",
  UNAVAILABLE: "UNAVAILABLE",
});

export function createUnavailableAviationProvider() {
  return {
    id: "unconfigured",
    state: AVIATION_DATA_STATES.UNAVAILABLE,
    supportsStreaming: false,
    async listAircraft() {
      return [];
    },
    async getWeather() {
      return { state: AVIATION_DATA_STATES.UNAVAILABLE, layers: [], updatedAt: null };
    },
  };
}

export function getProductionAviationProvider() {
  return createUnavailableAviationProvider();
}