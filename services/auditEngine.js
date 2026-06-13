import redis from "./redisClient.js";

/**
 * =========================================
 * AUDIT ENGINE (IMMUTABLE DECISION LOGS)
 * =========================================
 *
 * Every AI decision is stored for:
 * - compliance
 * - legal review
 * - airline audits
 */

export async function logDecisionTrace({
  contract_id,
  tenant_id,
  input,
  output,
  model,
}) {
  try {
    const entry = {
      id: `${contract_id}-${Date.now()}`,
      contract_id,
      tenant_id,
      input,
      output,
      model,
      timestamp: new Date().toISOString(),
    };

    const key = `audit:${tenant_id}:${contract_id}`;

    await redis.lpush(key, JSON.stringify(entry));

    return entry;
  } catch (err) {
    console.error("❌ AUDIT LOG ERROR:", err.message);
    return null;
  }
}

/**
 * =========================================
 * REPLAY ENGINE (DECISION RECONSTRUCTION)
 * =========================================
 */

export async function replayDecision({ tenant_id, contract_id }) {
  try {
    const key = `audit:${tenant_id}:${contract_id}`;

    const logs = await redis.lrange(key, 0, -1);

    return logs.map((l) => JSON.parse(l));
  } catch (err) {
    console.error("❌ AUDIT REPLAY ERROR:", err.message);
    return [];
  }
}