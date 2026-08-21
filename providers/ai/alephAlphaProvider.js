export function createAlephAlphaProvider() {
  return {
    provider: "aleph_alpha",
    async analyzeStructured() {
      const error = new Error("Aleph Alpha Phase 3A adapter is not implemented");
      error.code = "PHASE3_PROVIDER_NOT_IMPLEMENTED";
      throw error;
    },
  };
}
