import { createEvidenceRepository } from "../../../repositories/phase3/evidenceRepository.js";
import { assertOrganizationScope, assertResourceId } from "../../../repositories/phase3/scope.js";

export function createEvidenceService(repository = createEvidenceRepository()) {
  return {
    async create({ organizationId, evidence }) {
      assertOrganizationScope(organizationId);
      return repository.create({ organizationId, evidence });
    },

    async listByRun({ organizationId, analysisRunId }) {
      assertOrganizationScope(organizationId);
      assertResourceId(analysisRunId, "analysisRunId");
      return repository.listByRun({ organizationId, analysisRunId });
    },
  };
}
