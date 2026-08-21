import {
  assertAnalysisRunRetry,
  assertAnalysisRunTransition,
} from "../../../domain/contractIntelligence/stateMachine.js";
import {
  createAnalysisRunRepository,
} from "../../../repositories/phase3/analysisRunRepository.js";
import { assertOrganizationScope, assertResourceId } from "../../../repositories/phase3/scope.js";

export function createAnalysisRunService(repository = createAnalysisRunRepository()) {
  return {
    async getAnalysisRun({ analysisRunId, organizationId }) {
      assertOrganizationScope(organizationId);
      assertResourceId(analysisRunId, "analysisRunId");
      return repository.getById(analysisRunId, organizationId);
    },

    async transition({
      analysisRunId,
      organizationId,
      status,
      startedAt = null,
      completedAt = null,
      errorCode = null,
      errorMessage = null,
    }) {
      const current = await this.getAnalysisRun({ analysisRunId, organizationId });
      if (!current) {
        const error = new Error("Analysis run not found");
        error.code = "ANALYSIS_RUN_NOT_FOUND";
        throw error;
      }

      assertAnalysisRunTransition(current.status, status);
      return repository.updateStatus({
        analysisRunId,
        organizationId,
        status,
        startedAt,
        completedAt,
        errorCode,
        errorMessage,
      });
    },

    async retry({ analysisRunId, organizationId }) {
      const current = await this.getAnalysisRun({ analysisRunId, organizationId });
      if (!current) {
        const error = new Error("Analysis run not found");
        error.code = "ANALYSIS_RUN_NOT_FOUND";
        throw error;
      }

      assertAnalysisRunRetry(current);
      return repository.createRetry({ run: current, organizationId });
    },
  };
}
