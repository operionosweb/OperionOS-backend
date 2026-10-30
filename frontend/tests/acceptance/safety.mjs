export function assertAcceptanceExecutionAllowed() {
  const error = new Error(
    "Acceptance execution and cleanup are disabled: safety hardening is incomplete. "
    + "Environment identity, durable exact ownership, recovery, and containment must be "
    + "implemented and separately approved before execution can be enabled. "
    + "Preserve incomplete-run resources and evidence for explicit future recovery."
  );
  error.code = "ACCEPTANCE_EXECUTION_DISABLED";
  throw error;
}
