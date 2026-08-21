import { createSearchChunkRepository } from "../../../repositories/phase3/searchChunkRepository.js";
import { assertOrganizationScope, assertResourceId } from "../../../repositories/phase3/scope.js";

export function createSearchChunkService(repository = createSearchChunkRepository()) {
  return {
    async createChunks({ organizationId, chunks }) {
      assertOrganizationScope(organizationId);
      return repository.createMany({ organizationId, chunks });
    },

    async listChunks({ organizationId, documentVersionId, analysisRunId }) {
      assertOrganizationScope(organizationId);
      assertResourceId(documentVersionId, "documentVersionId");
      assertResourceId(analysisRunId, "analysisRunId");
      return repository.listByVersion({ organizationId, documentVersionId, analysisRunId });
    },
  };
}
