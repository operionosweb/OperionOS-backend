export function createMistralProvider() {
  return {
    provider: "mistral",
    async analyzeStructured() {
      const error = new Error("Mistral Phase 3A adapter is not implemented");
      error.code = "PHASE3_PROVIDER_NOT_IMPLEMENTED";
      throw error;
    },
  };
}
