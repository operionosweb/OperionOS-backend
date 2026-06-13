let failureCount = 0;
let lastFailureTime = null;

const FAILURE_THRESHOLD = 3;
const RESET_TIMEOUT = 60 * 1000; // 1 min

export function allowLLMCall() {
  if (!lastFailureTime) return true;

  const now = Date.now();

  if (
    failureCount >= FAILURE_THRESHOLD &&
    now - lastFailureTime < RESET_TIMEOUT
  ) {
    return false;
  }

  if (now - lastFailureTime > RESET_TIMEOUT) {
    failureCount = 0;
    lastFailureTime = null;
  }

  return true;
}

export function recordLLMFailure() {
  failureCount++;
  lastFailureTime = Date.now();
}

export function recordLLMSuccess() {
  failureCount = 0;
  lastFailureTime = null;
}