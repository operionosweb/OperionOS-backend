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
      for (const [path, method] of [["/status", "GET"], ["/sessions", "POST"], ["/sessions/id/turns", "POST"], ["/sessions/id/interrupt", "POST"], ["/sessions/id", "DELETE"]]) {
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
