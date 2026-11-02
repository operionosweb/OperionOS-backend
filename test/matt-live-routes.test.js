import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createMattLiveRouter } from "../routes/mattLiveRoutes.js";
import { createMattLiveService } from "../services/mattLiveService.js";

async function serve(router, run) {
  const app = express();
  app.use(express.json({ limit: "16kb" }));
  app.use("/api/matt", router);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { await run(`http://127.0.0.1:${server.address().port}/api/matt`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}
test("the actual router rejects unauthenticated live access before any provider or data access", async () => {
  let calls = 0;
  await serve(createMattLiveRouter({ service: { status() { calls++; } } }), async (origin) => {
    const response = await fetch(`${origin}/status`);
    assert.equal(response.status, 401);
    assert.equal(calls, 0);
  });
});
test("membership and permission boundaries protect every live endpoint", async () => {
  for (const boundary of ["membership", "permission"]) {
    let calls = 0;
    const service = new Proxy({}, { get: () => () => { calls++; } });
    const pass = (_req, _res, next) => next();
    const deny = (_req, res) => res.status(403).json({ error: "Denied" });
    const router = createMattLiveRouter({ service, authenticate: pass, membership: boundary === "membership" ? deny : pass, permission: boundary === "permission" ? deny : pass });
    await serve(router, async (origin) => {
      for (const [path, method] of [["/status", "GET"], ["/sessions", "POST"], ["/sessions/id/turns", "POST"], ["/sessions/id/interrupt", "POST"], ["/sessions/id/speech", "POST"], ["/sessions/id/speech", "DELETE"], ["/sessions/id", "DELETE"]]) {
        assert.equal((await fetch(`${origin}${path}`, { method })).status, 403);
      }
    });
    assert.equal(calls, 0);
  }
});
test("authorized HTTP turns bind user and tenant from middleware, not request-body impersonation", async () => {
  const seen = [];
  const organizationId = "10000000-0000-4000-8000-000000000001";
  const service = createMattLiveService({
    provider: { create: async () => ({ conversationId: "room", url: "https://tavus.daily.co/room", token: "scoped-token" }), end: async () => {} },
    generateAnswer: async (request) => { seen.push(request); return { answer: "The source establishes the return condition.", evidence: [], findings: [], established: true }; },
    configuration: () => ({ enabled: true, missing: [] }), allowedOrganization: () => true,
  });

  const attach = (req, _res, next) => { req.user = { id: req.headers["x-test-user"] || "authenticated-user" }; req.organization = { id: organizationId }; next(); };
  await serve(createMattLiveRouter({ service, authenticate: attach, membership: (_req, _res, next) => next(), permission: (_req, _res, next) => next(), logger: { error() {} } }), async (origin) => {
    const sessionResponse = await fetch(`${origin}/sessions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent: true }) });
    assert.equal(sessionResponse.headers.get("cache-control"), "no-store");
    const session = await sessionResponse.json();
    const turn = await fetch(`${origin}/sessions/${session.id}/turns`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: "attacker", userId: "attacker", analysisRunId: "scope", question: "Which return condition applies?" }) });
    assert.equal(turn.status, 200);
    assert.equal(seen[0].organizationId, organizationId);
    assert.equal(seen[0].userId, "authenticated-user");
    assert.equal((await fetch(`${origin}/sessions/${session.id}`, { method: "DELETE", headers: { "x-test-user": "other-user" } })).status, 404);
    assert.equal((await fetch(`${origin}/sessions/${session.id}`, { method: "DELETE" })).status, 200);
  });
});

for (const operation of ["creation", "speech"]) {
  test(`revocation during ${operation} withholds credentials and closes the original provider room`, async () => {
    let revoked = false, release, entered, ended;
    const gate = new Promise((resolve) => { release = resolve; });
    const started = new Promise((resolve) => { entered = resolve; });
    const terminated = new Promise((resolve) => { ended = resolve; });
    const wait = async () => { entered(); await gate; };
    const service = createMattLiveService({
      provider: { async create() { if (operation === "creation") await wait(); return { conversationId: "private-room", token: "PRIVATE-ROOM-CREDENTIAL" }; }, async end() { ended(); } },
      speechProvider: { async create() { await wait(); return { id: "speech-call", sdp: "PRIVATE-SDP" }; }, async end() {} },
      speechConfiguration: () => ({ provider: "openai-realtime", enabled: true, missing: [] }),
      configuration: () => ({ enabled: true, missing: [] }), allowedOrganization: () => true,
    });
    const authenticate = (req, _res, next) => { req.user = { id: "fixture-user" }; next(); };
    const membership = (req, res, next) => {
      if (revoked) return res.status(403).json({ error: "Membership revoked" });
      req.organization = { id: "10000000-0000-4000-8000-000000000001" }; next();
    };
    await serve(createMattLiveRouter({ service, authenticate, membership, permission: (_req, _res, next) => next(), logger: { error() {} } }), async (origin) => {
      const post = (path, body) => fetch(`${origin}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      let session;
      try {
        if (operation === "speech") session = await (await post("/sessions", { consent: true })).json();
        const request = post(session ? `/sessions/${session.id}/speech` : "/sessions", session
          ? { consent: true, sdp: "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n" } : { consent: true });
        await started; revoked = true; release();
        const response = await request, text = await response.text();
        assert.equal(response.status, 403);
        assert.doesNotMatch(text, /PRIVATE|private-room|speech-call/);
        await terminated;
      } finally { release(); }
    });
  });
}

for (const boundary of ["membership", "permission"]) {
  test(`new-request ${boundary} revocation closes only the authenticated owner scope and restoration requires a fresh session`, async () => {
    const orgA = "10000000-0000-4000-8000-000000000001", orgB = "20000000-0000-4000-8000-000000000002";
    let revoked = false, roomCount = 0;
    const ended = [], seen = [];
    const service = createMattLiveService({
      provider: { async create() { return { conversationId: `room-${++roomCount}` }; }, async end(id) { ended.push(id); } },
      generateAnswer: async (input) => { seen.push(input); return { answer: `PRIVATE:${input.organizationId}:${input.userId}`, evidence: [], findings: [], established: true }; },
      configuration: () => ({ enabled: true, missing: [] }), allowedOrganization: () => true,
    });
    const authenticate = (req, _res, next) => { req.user = { id: req.get("x-test-user") || "owner-a" }; next(); };
    const deny = (req, res) => revoked && req.user.id === "owner-a" && req.get("x-org-id") === orgA
      ? res.status(403).json({ error: "Access revoked" }) : null;
    const membership = (req, res, next) => {
      if (boundary === "membership" && deny(req, res)) return;
      req.organization = { id: req.get("x-org-id") }; next();
    };
    const permission = (req, res, next) => { if (boundary === "permission" && deny(req, res)) return; next(); };
    await serve(createMattLiveRouter({ service, authenticate, membership, permission, logger: { error() {} } }), async (origin) => {
      const request = (path, method, body, organizationId = orgA, userId = "owner-a") => fetch(`${origin}${path}`, {
        method, headers: { "Content-Type": "application/json", "x-org-id": organizationId, "x-test-user": userId }, ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const create = async (org, user) => {
        const response = await request("/sessions", "POST", { consent: true }, org, user);
        assert.equal(response.status, 200);
        return response.json();
      };
      const question = { analysisRunId: "scope", question: "Which obligation applies?" };
      try {
        const own = await create(orgA, "owner-a"), otherUser = await create(orgA, "owner-b"), otherOrg = await create(orgB, "owner-a");
        assert.equal((await request(`/sessions/${own.id}/turns`, "POST", question)).status, 200);
        assert.equal((await request(`/sessions/${own.id}/turns`, "POST", question, orgA, "owner-b")).status, 404);
        revoked = true;
        const denial = await request(`/sessions/${own.id}/turns`, "POST", { ...question, userId: "owner-b", organizationId: orgB });
        assert.equal(denial.status, 403);
        assert.doesNotMatch(await denial.text(), /PRIVATE|room-|owner-b/);
        assert.deepEqual(ended, ["room-1"]);
        assert.equal(seen.length, 1);
        assert.equal((await request(`/sessions/${own.id}`, "DELETE")).status, 403);
        assert.deepEqual(ended, ["room-1"]);
        revoked = false;
        assert.equal((await request(`/sessions/${own.id}/turns`, "POST", question)).status, 404);
        assert.equal(seen.length, 1);
        assert.equal((await request(`/sessions/${otherUser.id}/turns`, "POST", question, orgA, "owner-b")).status, 200);
        assert.equal((await request(`/sessions/${otherOrg.id}/turns`, "POST", question, orgB, "owner-a")).status, 200);
        const fresh = await create(orgA, "owner-a");
        assert.notEqual(fresh.id, own.id);
        assert.equal((await request(`/sessions/${fresh.id}/turns`, "POST", question)).status, 200);
        assert.deepEqual(seen.at(-1).history, []);
      } finally {
        revoked = false;
        await Promise.all([
          service.revoke({ organizationId: orgA, userId: "owner-a" }),
          service.revoke({ organizationId: orgA, userId: "owner-b" }),
          service.revoke({ organizationId: orgB, userId: "owner-a" }),
        ]);
      }
    });
  });
}

test("revoked session stays unusable and blocks replacement if provider termination fails, with explicit cleanup logging", async () => {
  const organizationId = "10000000-0000-4000-8000-000000000001";
  let revoked = false, failCleanup = true, calls = 0;
  const logs = [];
  const service = createMattLiveService({
    provider: { async create() { return { conversationId: "room" }; }, async end() { if (failCleanup) throw Object.assign(new Error("Fixture termination failed"), { code: "MATT_PROVIDER_FAILED" }); } },
    generateAnswer: async () => { calls++; return { answer: "OWN-CANARY", evidence: [], findings: [], established: true }; },
    configuration: () => ({ enabled: true, missing: [] }), allowedOrganization: () => true,
  });
  const authenticate = (req, _res, next) => { req.user = { id: "owner" }; next(); };
  const membership = (req, res, next) => {
    if (revoked) return res.status(403).json({ error: "Membership revoked" });
    req.organization = { id: organizationId }; next();
  };
  await serve(createMattLiveRouter({ service, authenticate, membership, permission: (_req, _res, next) => next(), logger: { error(...args) { logs.push(args); } } }), async (origin) => {
    const request = (path, body) => fetch(`${origin}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-org-id": organizationId }, body: JSON.stringify(body),
    });
    try {
      const session = await (await request("/sessions", { consent: true })).json();
      revoked = true;
      assert.equal((await request(`/sessions/${session.id}/turns`, { question: "Which obligation applies?" })).status, 403);
      revoked = false;
      const replay = await request(`/sessions/${session.id}/turns`, { question: "Which obligation applies?" });
      assert.equal(replay.status, 409);
      assert.equal((await replay.json()).code, "MATT_SESSION_CLOSING");
      assert.equal(calls, 0);
      assert.equal((await request("/sessions", { consent: true })).status, 409);
      assert.ok(logs.some(([message, code]) => message === "Matt authorization cleanup failed" && code === "MATT_PROVIDER_FAILED"));
    } finally {
      failCleanup = false;
      await service.revoke({ organizationId, userId: "owner" });
    }
  });
});
