import { ANALYSIS_RUN_STATES } from "./enums.js";

const TRANSITIONS = Object.freeze({
  queued: ["processing", "failed", "cancelled"],
  processing: ["extracting", "failed", "cancelled"],
  extracting: ["analysing", "failed", "cancelled"],
  analysing: ["indexing", "failed", "cancelled", "requires_review"],
  indexing: ["completed", "failed", "cancelled", "requires_review"],
  failed: ["processing"],
  requires_review: [],
  completed: [],
  cancelled: [],
});

export function isAnalysisRunState(value) {
  return ANALYSIS_RUN_STATES.includes(value);
}

export function getAllowedAnalysisRunTransitions(state) {
  if (!isAnalysisRunState(state)) {
    throw new TypeError(`Unknown analysis run state: ${state}`);
  }

  return [...TRANSITIONS[state]];
}

export function canTransitionAnalysisRun(from, to) {
  return isAnalysisRunState(from) && TRANSITIONS[from].includes(to);
}

export function assertAnalysisRunTransition(from, to) {
  if (!canTransitionAnalysisRun(from, to)) {
    const error = new Error(`Invalid analysis run transition from ${from} to ${to}`);
    error.code = "INVALID_ANALYSIS_RUN_TRANSITION";
    throw error;
  }
}

export function assertAnalysisRunRetry(run) {
  if (run?.status !== "failed") {
    const error = new Error("Only failed analysis runs can be retried");
    error.code = "ANALYSIS_RUN_RETRY_NOT_ALLOWED";
    throw error;
  }
}
