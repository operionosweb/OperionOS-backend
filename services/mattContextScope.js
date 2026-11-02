import { assertResourceId } from "../repositories/phase3/scope.js";
import { MATT_CONTEXT_MODES, MATT_PAGE_IDS } from "../shared/operionPlatformKnowledge.js";

export function validateMattContext({ contextMode = "analysis", pageId = "matt", analysisRunId }) {
  const invalid = () => Object.assign(new Error("Select an available Matt scope and page. Account/platform scopes do not accept document, report or flight identifiers."), { code: "MATT_CONTEXT_DENIED", status: 400 });
  if (!MATT_CONTEXT_MODES.includes(contextMode) || !MATT_PAGE_IDS.includes(pageId)) throw invalid();
  if (contextMode === "analysis") assertResourceId(analysisRunId, "analysisRunId");
  else if (analysisRunId !== undefined && analysisRunId !== null) throw invalid();
  return { contextMode, pageId };
}
