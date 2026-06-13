import { logEvent } from "./logger.js";

/**
 * AIRLINE-GRADE AUDIT LOGGER
 * Every AI decision becomes traceable
 */

export async function auditDecision({
  contract_id,
  company_id,
  request_id,
  input,
  output,
  risk_score,
  provider,
}) {
  const auditRecord = {
    timestamp: new Date().toISOString(),
    contract_id,
    company_id,
    request_id,
    provider,
    risk_score,
    input_snapshot: input,
    output_snapshot: output,
  };

  logEvent("AUDIT_DECISION_CREATED", auditRecord);

  return auditRecord;
}