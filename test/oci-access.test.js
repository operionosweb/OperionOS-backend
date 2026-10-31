import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createOciAccessMiddleware, createOciRateLimit, ociHttpBoundary, verifyOciIdentity } from "../middleware/ociAccessMiddleware.js";
import { provisionOciSuperAdmin } from "../scripts/bootstrap-oci-superadmin.js";

const userId = "fcaabfe0-83ee-4ec5-8721-c312b9317f54";
const identity = { id: userId, email: "owner@example.test", mfaVerified: true };
const issuer = "https://project.example.test/auth/v1";
const claims = { sub: userId, iss: issuer, aud: "authenticated", exp: 2000000000, aal: "aal2" };
const token = (value) => `header.${Buffer.from(JSON.stringify(value)).toString("base64url")}.signature`;
const provider = (user = { id: userId, email: identity.email, email_confirmed_at: "2026-10-01" }, error = null) => ({ auth: { getUser: async () => ({ data: { user }, error }) } });

test("OCI trusts provider verification, not editable metadata or unverified JWT claims", async () => {
  assert.deepEqual(await verifyOciIdentity(token(claims), { authClient: provider(), issuer, now: 0 }), identity);
  for (const altered of [{ ...claims, sub: "someone-else" }, { ...claims, iss: "attacker" }, { ...claims, aud: "service_role" }, { ...claims, exp: -1 }]) {
    await assert.rejects(verifyOciIdentity(token(altered), { authClient: provider(), issuer, now: 0 }), { code: "OCI_INVALID_SESSION" });
  }
  await assert.rejects(verifyOciIdentity(token(claims), { authClient: provider(null, new Error("untrusted signature")), issuer, now: 0 }), { code: "OCI_INVALID_SESSION" });
  await assert.rejects(verifyOciIdentity(token(claims), { authClient: provider(null, { status: 503 }), issuer, now: 0 }), { code: "OCI_AUTH_UNAVAILABLE" });
  await assert.rejects(verifyOciIdentity(token(claims), { authClient: provider({ id: userId, email: identity.email, user_metadata: { role: "super_admin" } }), issuer, now: 0 }), { code: "OCI_EMAIL_UNVERIFIED" });
  assert.equal((await verifyOciIdentity(token({ ...claims, aal: "aal1" }), { authClient: provider(), issuer, now: 0 })).mfaVerified, false);
});

async function requestMiddleware(options, headers = { authorization: "Bearer valid-session" }) {
  const events = [];
  let accessed = false;
  const middleware = createOciAccessMiddleware({ verify: async () => identity, queryFn: async () => ({ rows: [{ user_id: userId }] }), audit: async (actor, action) => events.push({ actor, action }), ...options });
  const app = express().use(middleware).get("/records", (_req, res) => { accessed = true; res.json({ success: true }); });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/records`, { headers });
    return { status: response.status, body: await response.json(), cache: response.headers.get("cache-control"), events, accessed };
  } finally { await new Promise((resolve) => server.close(resolve)); }
}

test("direct OCI access rejects anonymous, ordinary, forged role and non-MFA sessions", async () => {
  const anon = await requestMiddleware({}, {});
  assert.equal(anon.status, 401);
  assert.equal(anon.accessed, false);
  assert.equal(anon.events[0].action, "ACCESS_DENIED");
  const ordinary = await requestMiddleware({ queryFn: async (sql, params) => {
    assert.deepEqual(params, [userId]);
    assert.match(sql, /oci\.role = 'super_admin'/);
    assert.match(sql, /platform\.role = 'SUPERADMIN'/);
    return { rows: [] };
  } }, { authorization: "Bearer valid-session", "x-role": "super_admin" });
  assert.equal(ordinary.status, 403);
  assert.equal(ordinary.accessed, false);
  const mfa = await requestMiddleware({ verify: async () => ({ ...identity, mfaVerified: false }) });
  assert.equal(mfa.body.code, "OCI_MFA_REQUIRED");
  assert.equal(mfa.accessed, false);
  const valid = await requestMiddleware({});
  assert.equal(valid.status, 200);
  assert.equal(valid.cache, "private, no-store");
  assert.equal(valid.events[0].action, "ACCESS_GRANTED");
});

test("role lookup and audit outages fail closed", async () => {
  const database = await requestMiddleware({ queryFn: async () => { throw new Error("offline"); } });
  assert.equal(database.status, 503);
  assert.equal(database.accessed, false);
  const audit = await requestMiddleware({ audit: async () => { throw new Error("offline"); } });
  assert.equal(audit.status, 503);
  assert.equal(audit.body.code, "OCI_AUDIT_UNAVAILABLE");
  assert.equal(audit.accessed, false);
});

test("OCI role revocation takes effect on the next protected request", async () => {
  let active = true;
  const options = { queryFn: async () => ({ rows: active ? [{ user_id: userId }] : [] }) };
  assert.equal((await requestMiddleware(options)).status, 200);
  active = false;
  const revoked = await requestMiddleware(options);
  assert.equal(revoked.status, 403);
  assert.equal(revoked.accessed, false);
});

test("OCI origin and bounded rate protection do not rely on client roles", () => {
  const result = { headers: {}, statusCode: 0, set(name, value) { this.headers[name] = value; return this; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; }, vary() {}, sendStatus(value) { this.statusCode = value; } };
  let passed = 0;
  ociHttpBoundary({ headers: { origin: "https://attacker.test" }, method: "GET" }, result, () => passed++);
  assert.equal(result.statusCode, 403);
  ociHttpBoundary({ headers: { origin: "https://oci.operionos.com" }, method: "OPTIONS" }, result, () => passed++);
  assert.equal(result.statusCode, 204);
  assert.equal(result.headers["Access-Control-Allow-Origin"], "https://oci.operionos.com");
  const limiter = createOciRateLimit({ limit: 2, now: () => 1 });
  for (let count = 0; count < 3; count++) limiter({ ip: "127.0.0.1" }, result, () => passed++);
  assert.equal(passed, 2);
  assert.equal(result.statusCode, 429);
  assert.equal(result.headers["Retry-After"], "60");
});

function bootstrapDatabase(existing = [], failAudit = false, platform = []) {
  const commands = [];
  let released = false;
  return { commands, get released() { return released; }, connect: async () => ({
    query: async (sql, params) => {
      commands.push({ sql, params });
      if (sql.startsWith("select user_id")) return { rows: existing };
      if (sql.startsWith("select status")) return { rows: platform };
      if (sql.startsWith("insert into public.platform_user_roles")) return { rows: [{ status: "active" }] };
      if (failAudit && sql.includes("oci_audit_events")) throw new Error("audit failed");
      return { rows: [] };
    },
    release: () => { released = true; },
  }) };
}

test("bootstrap requires verified email ownership and MFA, defaults to no mutation", async () => {
  const database = bootstrapDatabase();
  const args = { token: "short-lived-session", email: identity.email, verify: async () => identity, database };
  assert.deepEqual(await provisionOciSuperAdmin(args), { verified: true, applied: false });
  assert.equal(database.commands.length, 0);
  await assert.rejects(provisionOciSuperAdmin({ ...args, email: "different@example.test" }), { code: "OCI_BOOTSTRAP_IDENTITY" });
  await assert.rejects(provisionOciSuperAdmin({ ...args, verify: async () => ({ ...identity, mfaVerified: false }) }), { code: "OCI_BOOTSTRAP_IDENTITY" });
  assert.deepEqual(await provisionOciSuperAdmin({ ...args, apply: true }), { verified: true, applied: true });
  assert.equal(database.commands.at(-1).sql, "COMMIT");
  assert.ok(database.commands.some(({ sql }) => sql.includes("pg_advisory_xact_lock")));
  assert.ok(database.commands.some(({ sql }) => sql.includes("oci_audit_events")));
  assert.equal(database.released, true);
});

test("bootstrap never reactivates revoked platform access and active provisioning is idempotent", async () => {
  const args = { token: "session", email: identity.email, apply: true, verify: async () => identity };
  for (const database of [
    bootstrapDatabase([], false, [{ status: "revoked" }]),
    bootstrapDatabase([{ user_id: userId, status: "active" }]),
  ]) {
    await assert.rejects(provisionOciSuperAdmin({ ...args, database }), { code: "OCI_BOOTSTRAP_CLOSED" });
    assert.equal(database.commands.at(-1).sql, "ROLLBACK");
    assert.ok(!database.commands.some(({ sql }) => sql.startsWith("insert")));
  }
  const database = bootstrapDatabase([{ user_id: userId, status: "active" }], false, [{ status: "active" }]);
  assert.deepEqual(await provisionOciSuperAdmin({ ...args, database }), { verified: true, applied: false, alreadyProvisioned: true });
  assert.equal(database.commands.at(-1).sql, "COMMIT");
  assert.ok(!database.commands.some(({ sql }) => sql.startsWith("insert")));
});

test("bootstrap is closed after another administrator or a revocation, and audit failure rolls back", async () => {
  for (const existing of [[{ user_id: "another-user", status: "active" }], [{ user_id: userId, status: "revoked" }]]) {
    const database = bootstrapDatabase(existing);
    await assert.rejects(provisionOciSuperAdmin({ token: "session", email: identity.email, apply: true, verify: async () => identity, database }), { code: "OCI_BOOTSTRAP_CLOSED" });
    assert.equal(database.commands.at(-1).sql, "ROLLBACK");
  }
  const database = bootstrapDatabase([], true);
  await assert.rejects(provisionOciSuperAdmin({ token: "session", email: identity.email, apply: true, verify: async () => identity, database }), /audit failed/);
  assert.equal(database.commands.at(-1).sql, "ROLLBACK");
});
