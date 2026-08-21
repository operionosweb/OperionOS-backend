import { createPageRepository } from "../../../repositories/phase3/pageRepository.js";
import { assertOrganizationScope, assertResourceId } from "../../../repositories/phase3/scope.js";

export function createPageService(repository = createPageRepository()) {
  return {
    async createPages({ organizationId, pages }) {
      assertOrganizationScope(organizationId);
      return repository.createMany({ organizationId, pages });
    },

    async listPages({ organizationId, documentVersionId, analysisRunId }) {
      assertOrganizationScope(organizationId);
      assertResourceId(documentVersionId, "documentVersionId");
      assertResourceId(analysisRunId, "analysisRunId");
      return repository.listByVersion({ organizationId, documentVersionId, analysisRunId });
    },
  };
}
