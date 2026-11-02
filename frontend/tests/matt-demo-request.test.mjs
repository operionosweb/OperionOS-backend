import test from "node:test";
import assert from "node:assert/strict";
import { createMattDemoRequest } from "../src/components/matt/mattDemoRequest.js";

test("Demo transport uses only its own namespace, keeps capabilities private to sessions, and never forwards SaaS credentials", async () => {
  const calls = [];
  let issued = 0;
  const request = createMattDemoRequest({ baseUrl: "https://api.example.test", fetchFn: async (url, options) => {
    calls.push({ url, ...options });
    const body = url.endsWith("/status") ? { enabled: true }
      : url.endsWith("/access") ? { token: `capability-${++issued}`, expiresAt: "2099-01-01T00:00:00Z" }
        : url.endsWith("/sessions") ? { id: `session-${issued}` } : { success: true };
    return { ok: true, json: async () => body };
  } });
  await request("/status");
  await request("/sessions", { method: "POST", body: { consent: true } });
  await request("/sessions", { method: "POST", body: { consent: true } });
  await request("/sessions/session-1/interrupt", { method: "POST" });
  await request("/sessions/session-2/speech", { method: "POST", body: { consent: true, sdp: "test" } });
  await request("/sessions/session-1", { method: "DELETE", keepalive: true });
  assert.equal(calls.find((item) => item.url.endsWith("/session-1/interrupt")).headers["X-Matt-Demo-Token"], "capability-1");
  assert.equal(calls.find((item) => item.url.endsWith("/session-2/speech")).headers["X-Matt-Demo-Token"], "capability-2");
  assert.ok(calls.every((item) => item.url.startsWith("https://api.example.test/api/demo/matt/") && item.credentials === "omit" && !item.headers.Authorization && !item.headers["x-org-id"]));
  assert.equal(calls[0].headers["X-Matt-Demo-Token"], undefined);
  assert.equal(calls.at(-1).keepalive, true);
  await assert.rejects(request("/sessions/session-1/interrupt", { method: "POST" }), /No authorized Demo session/);
});

test("Demo configuration/token failures are explicit and cannot silently fall back to tenant endpoints", async () => {
  const paths = [];
  const blocked = createMattDemoRequest({ fetchFn: async (path) => {
    paths.push(path);
    return { ok: false, status: 503, json: async () => ({ code: "MATT_DEMO_NOT_CONFIGURED", error: "Operator approval is missing" }) };
  } });
  await assert.rejects(blocked("/sessions", { method: "POST", body: { consent: true } }), { message: "Operator approval is missing", status: 503 });
  assert.deepEqual(paths, ["/api/demo/matt/access"]);
  const malformed = createMattDemoRequest({ fetchFn: async () => ({ ok: true, json: async () => ({}) }) });
  await assert.rejects(malformed("/sessions", { method: "POST", body: { consent: true } }), /authorization is invalid/);
});
