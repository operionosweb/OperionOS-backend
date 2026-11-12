import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { withScopedOperationLock } from "../services/scopedOperationLock.js";

function fakePool(max = 10) {
  const held = new Set();
  const commands = [];
  return {
    options: { max },
    commands,
    async connect() {
      const acquired = [];
      const client = Object.assign(new EventEmitter(), {
        async query(sql, params = []) {
          commands.push({ sql, params });
          if (sql.includes("pg_try_advisory_xact_lock")) {
            if (held.has(params[0])) return { rows: [{ locked: false }] };
            held.add(params[0]);
            acquired.push(params[0]);
            return { rows: [{ locked: true }] };
          }
          if (sql === "commit" || sql === "rollback") {
            for (const key of acquired) held.delete(key);
          }
          return { rows: [] };
        },
        release() {},
      });
      this.lastClient = client;
      return client;
    },
  };
}

test("scoped transaction locks reject concurrent equivalent operations and release on failure", async () => {
  const pgPool = fakePool();
  let release;
  const waiting = new Promise((resolve) => { release = resolve; });
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const first = withScopedOperationLock(["upload:tenant:hash"], async () => {
    started();
    await waiting;
    throw new Error("synthetic failure");
  }, { pgPool, conflictCode: "INGESTION_IN_PROGRESS" });
  await ready;
  await assert.rejects(withScopedOperationLock(["upload:tenant:hash"], () => assert.fail("must not execute"), {
    pgPool, conflictCode: "INGESTION_IN_PROGRESS",
  }), { code: "INGESTION_IN_PROGRESS" });
  release();
  await assert.rejects(first, /synthetic failure/);
  assert.equal(await withScopedOperationLock(["upload:tenant:hash"], async () => "ok", { pgPool }), "ok");
  assert.ok(pgPool.commands.some(({ sql }) => sql === "rollback"));
});

test("a lost lock connection cannot report successful operation completion", async () => {
  const pgPool = fakePool();
  await assert.rejects(withScopedOperationLock(["one"], async () => {
    pgPool.lastClient.emit("error", new Error("synthetic disconnect"));
    return "completed";
  }, { pgPool }), { code: "OPERATION_LOCK_LOST" });
});

test("the operation can observe lock loss before starting subsequent work", async () => {
  const pgPool = fakePool();
  let subsequentWork = false;
  await assert.rejects(withScopedOperationLock(["one"], async (assertLockHeld) => {
    assertLockHeld();
    pgPool.lastClient.emit("error", new Error("synthetic disconnect"));
    assertLockHeld();
    subsequentWork = true;
  }, { pgPool }), { code: "OPERATION_LOCK_LOST" });
  assert.equal(subsequentWork, false);
});

test("locks leave a pool connection available for work performed inside the operation", async () => {
  const pgPool = fakePool(2);
  let release;
  const waiting = new Promise((resolve) => { release = resolve; });
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const first = withScopedOperationLock(["one"], async () => { started(); await waiting; }, { pgPool });
  await ready;
  await assert.rejects(withScopedOperationLock(["two"], async () => {}, { pgPool }), { code: "OPERATION_CAPACITY_EXHAUSTED" });
  release();
  await first;
  await withScopedOperationLock(["two"], async () => {}, { pgPool });
});
