import pool from "../db.js";

const activeLocks = new WeakMap();

export async function withScopedOperationLock(keys, operation, { pgPool = pool, conflictCode = "REQUEST_IN_PROGRESS" } = {}) {
  if (pgPool === pool && !process.env.DATABASE_URL) {
    throw Object.assign(new Error("DATABASE_URL is not configured"), { code: "DATABASE_NOT_CONFIGURED", status: 503 });
  }
  const maxConnections = pgPool.options?.max || 10;
  const count = activeLocks.get(pgPool) || 0;
  if (count >= maxConnections - 1) {
    throw Object.assign(new Error("Operation capacity is exhausted; retry later"), { code: "OPERATION_CAPACITY_EXHAUSTED", status: 503 });
  }
  activeLocks.set(pgPool, count + 1);
  let client;
  let inTransaction = false;
  let discard = false;
  let lockLost = false;
  const onClientError = () => {
    lockLost = true;
    discard = true;
    console.error("Scoped operation lock connection failed", { code: "OPERATION_LOCK_LOST" });
  };
  const assertLockHeld = () => {
    if (lockLost) {
      throw Object.assign(new Error("Operation lock connection was lost; review the operation before retrying"), { code: "OPERATION_LOCK_LOST", status: 503 });
    }
  };
  try {
    client = await pgPool.connect();
    client.on("error", onClientError);
    await client.query("begin");
    inTransaction = true;
    for (const key of [...new Set(keys)].sort()) {
      const result = await client.query("select pg_try_advisory_xact_lock(hashtextextended($1, 0)) as locked", [key]);
      if (result.rows[0]?.locked !== true) {
        throw Object.assign(new Error("An equivalent operation is already in progress"), { code: conflictCode, status: 409 });
      }
    }
    assertLockHeld();
    const result = await operation(assertLockHeld);
    assertLockHeld();
    await client.query("commit");
    inTransaction = false;
    return result;
  } catch (error) {
    if (inTransaction) {
      try {
        await client.query("rollback");
      } catch {
        discard = true;
        console.error("Scoped operation lock rollback failed", { code: "LOCK_ROLLBACK_FAILED" });
      }
    }
    throw error;
  } finally {
    try {
      if (client) {
        client.removeListener("error", onClientError);
        client.release(discard);
      }
    } finally {
      activeLocks.set(pgPool, activeLocks.get(pgPool) - 1);
    }
  }
}
