const PROVIDER_PRIORITY = Object.freeze(["mistral", "aleph_alpha"]);

export function getProviderPriority() {
  return [...PROVIDER_PRIORITY];
}

export function createProviderRouter({ providers = {} } = {}) {
  return {
    async analyzeStructured() {
      const available = getProviderPriority().filter((name) => providers[name]);
      const error = new Error(
        available.length
          ? "Phase 3A provider execution is intentionally disabled"
          : "No Phase 3A providers are configured"
      );
      error.code = "PHASE3_PROVIDER_NOT_IMPLEMENTED";
      throw error;
    },
  };
}
