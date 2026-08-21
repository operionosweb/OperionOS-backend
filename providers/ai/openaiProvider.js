export function createOpenAIProvider() {
  return {
    provider: "openai",
    async analyzeStructured() {
      const error = new Error("OpenAI Phase 3A adapter is not implemented");
      error.code = "PHASE3_PROVIDER_NOT_IMPLEMENTED";
      throw error;
    },
  };
}
