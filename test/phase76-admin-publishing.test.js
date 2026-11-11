import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import { createPlatformAdminRouter } from "../routes/platformAdminRoutes.js";
import { createPlatformAdminService, adminId } from "../services/platformAdminService.js";
import { createProductionDiagnosticService } from "../services/productionDiagnosticService.js";
import { createPlatformPermissionMiddleware } from "../middleware/superAdminMiddleware.js";
import { createUserAuthMiddleware } from "../middleware/userAuthMiddleware.js";
import { normalizeRichText, articlePlainText, readingMinutes, isPublicArticle } from "../frontend/src/lib/richText.js";
import { renderRichTextHtml, renderBlogIndexHtml } from "../frontend/src/lib/blogRendering.js";
import { createEditorialAnalyzer, resolveAuthor, articleRevision } from "../services/blogEditorialService.js";
import { createBlogController } from "../controllers/blogController.js";
import blogFeed from "../frontend/api/blog-feed.js";

const ACTOR = "acaabfe0-83ee-4ec5-8721-c312b9317f54";
const OTHER = "bcaabfe0-83ee-4ec5-8721-c312b9317f54";
const ORGANIZATION = "fcaabfe0-83ee-4ec5-8721-c312b9317f54";
const fixtureToken = aal => `Bearer fixture.${Buffer.from(JSON.stringify({ aal })).toString("base64url")}.fixture`;
function response() {
  return {
    statusCode: 200, headers: {},
    status(n) { this.statusCode = n; return this; },
    set(k, v) { if (typeof k === "object") Object.assign(this.headers, k); else this.headers[k] = v; return this; },
    setHeader(k, v) { this.headers[k] = v; return this; },
    json(body) { this.body = body; return this; },
    type(value) { this.headers["Content-Type"] = value; return this; },
    send(body) { this.body = body; return this; },
    end() { return this; },
  };
}
async function serverFixture(service, roles, authenticate, diagnostics) {
  const app = express(); app.use(express.json());
  app.use("/admin", createPlatformAdminRouter({
    service,
    diagnostics,
    authenticate: authenticate || function (req, res, next) {
      if (!req.headers.authorization) return res.status(401).json({ error: "Authentication required" });
      req.user = { id: ACTOR }; next();
    },
    authorize: createPlatformPermissionMiddleware("platform:admin", async () => ({ rows: roles.map(role => ({ role })) })),
  }));
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return { base: `http://127.0.0.1:${server.address().port}/admin`, close: () => new Promise(resolve => server.close(resolve)) };
}
test("all administration reads and mutations reject ordinary users and anonymous callers before service invocation", async () => {
  const service = new Proxy({}, { get: () => () => { throw new Error("Unauthorized service invocation"); } });
  const f = await serverFixture(service, ["CUSTOMER_ADMIN"]);
  try {
    for (const [path, method] of [["/summary", "GET"], ["/contract-intelligence", "GET"], ["/production-diagnostics", "GET"], ["/users", "POST"], [`/users/${OTHER}/platform-role`, "PUT"], [`/organizations/${ORGANIZATION}/members/${OTHER}`, "PUT"]]) {
      const anonymous = await fetch(f.base + path, { method });
      assert.equal(anonymous.status, 401);
      const ordinary = await fetch(f.base + path, { method, headers: { Authorization: "local-fixture" } });
      assert.equal(ordinary.status, 403);
    }
  } finally { await f.close(); }
});
test("Super Admin routes are no-store, delegate real actor IDs, and bound mutations", async () => {
  const seen = [];
  const f = await serverFixture({
    summary: async () => ({ metrics: { users: 0 } }),
    recovery: async (...args) => { seen.push(args); return { emailRequested: true }; },
  }, ["SUPERADMIN"]);
  try {
    const r = await fetch(f.base + "/summary", { headers: { Authorization: "local-fixture" } });
    assert.equal(r.status, 200); assert.equal(r.headers.get("cache-control"), "private, no-store");
    for (let i = 0; i < 10; i++) {
      const response = await fetch(f.base + `/users/${OTHER}/recovery`, { method: "POST", headers: { Authorization: "local-fixture", "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Local acceptance" }) });
      assert.equal(response.status, 200);
    }
    const limited = await fetch(f.base + `/users/${OTHER}/recovery`, { method: "POST", headers: { Authorization: "local-fixture" } });
    assert.equal(limited.status, 429);
    assert.equal(seen[0][0], ACTOR); assert.equal(seen[0][1], OTHER);
  } finally { await f.close(); }
});
function databaseFixture(run = () => ({ rows: [] })) {
  const calls = [];
  const query = async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes("select 1 from public.platform_user_roles")) return { rows: [{ authorized: true }] };
    return run(sql, params);
  };
  return { calls, query, connect: async () => ({ query, host: "localhost", ssl: { rejectUnauthorized: true },
    connection: { stream: { encrypted: true, authorized: true, getPeerCertificate: () => ({ subjectaltname: "DNS:localhost" }) } }, release() {} }) };
}
test("self-role and self-deactivation changes fail without Auth or database writes", async () => {
  const db = databaseFixture();
  const service = createPlatformAdminService({ database: db, authClient: () => { throw new Error("Auth must not run"); } });
  await assert.rejects(service.platformRole(ACTOR, ACTOR, { status: "revoked", reason: "Local" }), /own platform role/);
  await assert.rejects(service.accountStatus(ACTOR, ACTOR, { active: false, reason: "Local" }), /own account/);
  await assert.rejects(service.platformRole(ACTOR, ACTOR.toUpperCase(), { status: "revoked", reason: "Local" }), /own platform role/);
  await assert.rejects(service.accountStatus(ACTOR, ACTOR.toUpperCase(), { active: false, reason: "Local" }), /own account/);
  assert.equal(db.calls.length, 0);
  assert.throws(() => adminId("other' OR 1=1"), /valid record/);
});
test("role writes serialize, recheck current administrator, and audit exact target", async () => {
  const db = databaseFixture(sql => ({ rows: sql.includes("select id from auth.users") ? [{ id: OTHER }] : [] }));
  const service = createPlatformAdminService({ database: db });
  await service.platformRole(ACTOR, OTHER, { status: "active", reason: "Approved local fixture" });
  assert.ok(db.calls.some(c => c.sql.includes("pg_advisory_xact_lock")));
  const role = db.calls.find(c => c.sql.includes("insert into public.platform_user_roles"));
  assert.deepEqual(role.params, [OTHER, "active"]);
  const audit = db.calls.find(c => c.params[1] === "PLATFORM_ROLE_CHANGED");
  assert.equal(audit.params[0], ACTOR); assert.equal(audit.params[3], OTHER);
  assert.equal(db.calls.at(-1).sql, "COMMIT");
});
test("organization membership changes preserve the last administrator", async () => {
  const db = databaseFixture(sql => ({ rows: sql.includes("select id,status from public.organizations") ? [{ id: ORGANIZATION, status: "active" }]
    : sql.includes("select id from auth.users") ? [{ id: OTHER }]
    : sql.includes("select role,status") ? [{ role: "owner", status: "active" }]
      : sql.includes("select count(*)") ? [{ count: 0 }] : [] }));
  const service = createPlatformAdminService({ database: db });
  await assert.rejects(service.membership(ACTOR, ORGANIZATION, OTHER, { role: "CUSTOMER_USER", status: "removed", reason: "Local fixture" }), /another active organization administrator/);
  assert.ok(!db.calls.some(c => c.sql.includes("insert into public.organization_memberships")));
  assert.equal(db.calls.at(-1).sql, "ROLLBACK");
});
test("membership assignment writes the canonical role and makes its audit visible to the organization", async () => {
  const db = databaseFixture(sql => ({ rows: sql.includes("select id,status from public.organizations") ? [{ id: ORGANIZATION, status: "active" }]
    : sql.includes("select id from auth.users") ? [{ id: OTHER }]
      : sql.includes("insert into public.organization_memberships") ? [{ user_id: OTHER, organization_id: ORGANIZATION, role: "CUSTOMER_USER", status: "active" }] : [] }));
  const result = await createPlatformAdminService({ database: db }).membership(ACTOR, ORGANIZATION, OTHER, { role: "CUSTOMER_USER", status: "active", reason: "In-memory acceptance" });
  assert.equal(result.membership.organization_id, ORGANIZATION);
  const audit = db.calls.find(c => c.params[1] === "ORGANIZATION_MEMBERSHIP_CHANGED");
  assert.equal(audit.params[5], ORGANIZATION); assert.equal(db.calls.at(-1).sql, "COMMIT");
});
test("Auth creation uses Admin API without supplied password; failed email is explicit, never success-shaped", async () => {
  const db = databaseFixture();
  const creates = [];
  const service = createPlatformAdminService({ database: db, authClient: () => ({ auth: {
    admin: { createUser: async input => { creates.push(input); return { data: { user: { id: OTHER } } }; } },
    resetPasswordForEmail: async () => ({ error: { status: 429 } }),
  } }) });
  const result = await service.provision(ACTOR, { email: "fixture@example.test", full_name: "Local Fixture", reason: "In-memory acceptance" });
  assert.equal(result.accountCreated, true); assert.equal(result.emailRequested, false);
  assert.equal(creates[0].email_confirm, false); assert.ok(!("password" in creates[0]));
  assert.ok(db.calls.some(c => c.params[1] === "AUTH_SETUP_EMAIL_FAILED"));
});
test("organization creation reuses authoritative identity and records a transactional audit", async () => {
  const db = databaseFixture(sql => ({ rows: sql.startsWith("insert into public.organizations") ? [{ id: ORGANIZATION, name: "Local fixture" }] : [] }));
  const result = await createPlatformAdminService({ database: db }).saveOrganization(ACTOR, null, { name: "Local fixture", slug: "local-fixture", reason: "In-memory acceptance" });
  assert.equal(result.organization.id, ORGANIZATION);
  assert.ok(db.calls.some(c => c.params[1] === "ORGANIZATION_CREATED"));
  assert.equal(db.calls.at(-1).sql, "COMMIT");
});
test("directory SQL parameterizes search and selects no passwords or tokens", async () => {
  const db = databaseFixture();
  await createPlatformAdminService({ database: db }).users({ search: "';drop table users;--" });
  const call = db.calls[0];
  assert.equal(call.params[0], "';drop table users;--");
  assert.doesNotMatch(call.sql, /encrypted_password|access_token|refresh_token|select \*/i);
  await assert.rejects(createPlatformAdminService({ database: db }).summary(999), /7, 30 or 90/);
});
test("contract intelligence reports available aggregate counts and marks missing sources unavailable", async () => {
  const db = databaseFixture(sql => {
    if (sql.includes("rolbypassrls")) return { rows: [{ full_scope: true }] };
    if (sql.includes("to_regclass")) return { rows: [
      { name: "analysis_runs", available: true }, { name: "clauses", available: true },
      { name: "obligations", available: false }, { name: "deadlines", available: false },
      { name: "risks", available: false }, { name: "ai_intelligence_usage", available: false },
    ] };
    return { rows: [{ processed_contracts: 2, pending_runs: 1, failed_runs: 3, clauses: 5,
      obligations: null, upcoming_deadlines: null, risks: null, high_severity_risks: null, ai_usage_events: null }] };
  });
  const data = await createPlatformAdminService({ database: db, now: () => new Date("2030-01-01T00:00:00Z") }).contractIntelligence();
  const byKey = Object.fromEntries(data.metrics.map(metric => [metric.key, metric]));
  assert.equal(byKey.processed_contracts.value, 2);
  assert.equal(byKey.clauses.value, 5);
  assert.equal(byKey.obligations.value, null);
  assert.equal(byKey.obligations.available, false);
  assert.match(byKey.clauses.source, /repeated analyses/);
  assert.equal(data.generatedAt, "2030-01-01T00:00:00.000Z");
  assert.doesNotMatch(db.calls[2].sql, /from public\.(obligations|deadlines|risks|ai_intelligence_usage)/);
});
test("contract intelligence refuses a database role that cannot verify global RLS scope", async () => {
  const db = databaseFixture(() => ({ rows: [{ full_scope: false }] }));
  await assert.rejects(createPlatformAdminService({ database: db }).contractIntelligence(), /verified platform-wide database role/);
  assert.equal(db.calls.length, 1);
});
test("contract intelligence refuses absent or unverified TLS before querying", async () => {
  for (const [ssl, stream] of [
    [{ rejectUnauthorized: true }, undefined],
    [{ rejectUnauthorized: true }, { encrypted: false, authorized: true }],
    [{ rejectUnauthorized: true }, { encrypted: true, authorized: false }],
    [{ rejectUnauthorized: false }, { encrypted: true, authorized: true }],
  ]) {
    let released = false;
    const db = { query: async () => { throw new Error("Query must not run"); },
      connect: async () => ({ query: db.query, host: "localhost", ssl, connection: { stream }, release() { released = true; } }) };
    await assert.rejects(createPlatformAdminService({ database: db }).contractIntelligence(), /verified TLS/);
    assert.equal(released, true);
  }
});
test("contract intelligence accepts verified default TLS options and independently checks the hostname", async () => {
  const certificate = { subjectaltname: "DNS:localhost" };
  let queries = 0;
  const client = {
    host: "localhost", ssl: {},
    connection: { stream: { encrypted: true, authorized: true, getPeerCertificate: () => certificate } },
    async query(sql) {
      queries++;
      if (sql.includes("rolbypassrls")) return { rows: [{ full_scope: true }] };
      if (sql.includes("to_regclass")) return { rows: [] };
      return { rows: [{}] };
    },
    release() {},
  };
  const db = { query: client.query, connect: async () => client };
  await createPlatformAdminService({ database: db }).contractIntelligence();
  assert.equal(queries, 3);
  client.host = "wrong.example.invalid";
  queries = 0;
  await assert.rejects(createPlatformAdminService({ database: db }).contractIntelligence(), /verified TLS/);
  assert.equal(queries, 0);
});
test("contract intelligence propagates database failures instead of inventing metrics", async () => {
  const db = databaseFixture(() => { throw Object.assign(new Error("Database unavailable"), { code: "08006" }); });
  await assert.rejects(createPlatformAdminService({ database: db }).contractIntelligence(), /Database unavailable/);
});
test("contract intelligence endpoint requires Super Admin and returns private aggregate data", async () => {
  const f = await serverFixture({ contractIntelligence: async () => ({ metrics: [{ key: "clauses", value: 2, available: true }] }) }, ["SUPERADMIN"]);
  try {
    const r = await fetch(f.base + "/contract-intelligence", { headers: { Authorization: fixtureToken("aal2") } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "private, no-store");
    const body = await r.json();
    assert.deepEqual(body.metrics, [{ key: "clauses", value: 2, available: true }]);
  } finally { await f.close(); }
});
test("contract intelligence rejects a Super Admin without verified MFA before accessing the service", async () => {
  let called = false;
  const f = await serverFixture({ contractIntelligence: async () => { called = true; return { metrics: [] }; } }, ["SUPERADMIN"]);
  try {
    for (const token of [fixtureToken("aal1"), "Bearer malformed"]) {
      const r = await fetch(f.base + "/contract-intelligence", { headers: { Authorization: token } });
      assert.equal(r.status, 403);
      assert.match((await r.json()).error, /multi-factor/);
    }
    assert.equal(called, false);
  } finally { await f.close(); }
});
test("contract intelligence cannot use MFA claims from a token rejected by authentication", async () => {
  const valid = fixtureToken("aal2");
  const authenticate = createUserAuthMiddleware(async token => {
    if (`Bearer ${token}` !== valid) throw new Error("Invalid token");
    return { id: ACTOR };
  });
  const f = await serverFixture({ contractIntelligence: async () => ({ metrics: [] }) }, ["SUPERADMIN"], authenticate);
  try {
    const forged = await fetch(f.base + "/contract-intelligence", { headers: { Authorization: `${valid}forged` } });
    assert.equal(forged.status, 401);
    const accepted = await fetch(f.base + "/contract-intelligence", { headers: { Authorization: valid } });
    assert.equal(accepted.status, 200);
  } finally { await f.close(); }
});
test("contract intelligence reports an unverified database scope without returning counts", async () => {
  const service = createPlatformAdminService({ database: databaseFixture(() => ({ rows: [{ full_scope: false }] })) });
  const f = await serverFixture(service, ["SUPERADMIN"]);
  try {
    const r = await fetch(f.base + "/contract-intelligence", { headers: { Authorization: fixtureToken("aal2") } });
    const body = await r.json();
    assert.equal(r.status, 503);
    assert.match(body.error, /verified platform-wide database role/);
    assert.equal(body.metrics, undefined);
  } finally { await f.close(); }
});
test("production diagnostics require Super Admin MFA and are private", async () => {
  let called = 0;
  const f = await serverFixture({}, ["SUPERADMIN"], undefined, async () => { called++; return { database: { connectivity: "connected" } }; });
  try {
    const weak = await fetch(f.base + "/production-diagnostics", { headers: { Authorization: fixtureToken("aal1") } });
    assert.equal(weak.status, 403);
    assert.equal(called, 0);
    const strong = await fetch(f.base + "/production-diagnostics", { headers: { Authorization: fixtureToken("aal2") } });
    assert.equal(strong.status, 200);
    assert.equal(strong.headers.get("cache-control"), "private, no-store");
    assert.equal(called, 1);
  } finally { await f.close(); }
});
test("production diagnostics cannot use an AAL2 claim from a rejected token", async () => {
  const valid = fixtureToken("aal2");
  const authenticate = createUserAuthMiddleware(async token => {
    if (`Bearer ${token}` !== valid) throw new Error("Invalid token");
    return { id: ACTOR };
  });
  let called = false;
  const f = await serverFixture({}, ["SUPERADMIN"], authenticate, async () => { called = true; return {}; });
  try {
    const r = await fetch(f.base + "/production-diagnostics", { headers: { Authorization: `${valid}forged` } });
    assert.equal(r.status, 401);
    assert.equal(called, false);
  } finally { await f.close(); }
});
test("production diagnostics expose only safe metadata and distinguish missing schema from verified service health", async () => {
  const project = "abcdefghijklmnopqrst";
  const host = `db.${project}.supabase.co`;
  const client = {
    host, user: "postgres", ssl: { rejectUnauthorized: true },
    connection: { stream: { encrypted: true, authorized: true, getPeerCertificate: () => ({ subjectaltname: `DNS:${host}` }) } },
    async query(sql, params) {
      if (sql.includes("unnest")) return { rows: params[0].map(name => ({ name, available: name !== "blog_posts" })) };
      if (sql.includes("to_regclass")) return { rows: [{ present: true }] };
      return { rows: [{ version: "002" }] };
    },
    release() {},
  };
  const diagnostic = createProductionDiagnosticService({
    database: { connect: async () => client },
    oci: { connect: async () => { throw new Error("private connection string"); } },
    env: { NODE_ENV: "production", RENDER_GIT_COMMIT: "abc1234", DATABASE_URL: "private connection string" },
  });
  const result = await diagnostic();
  assert.equal(result.database.projectIdentifier, project);
  assert.equal(result.database.tls, "verified");
  assert.equal(result.schema.migrationVersion, "002");
  assert.equal(result.blog.status, "required_tables_missing");
  assert.equal(result.oci.status, "unavailable");
  assert.doesNotMatch(JSON.stringify(result), /private connection string|db\.abcdefghijklmnopqrst/);
});
test("production diagnostics do not query an unverified database connection", async () => {
  let queried = false;
  const diagnostic = createProductionDiagnosticService({
    database: { connect: async () => ({ host: "db.example.test", ssl: false, query: async () => { queried = true; }, release() {} }) },
    oci: { connect: async () => { throw new Error("unavailable"); } }, env: {},
  });
  const result = await diagnostic();
  assert.equal(result.database.tls, "unverified");
  assert.equal(result.schema.status, "unverified");
  assert.equal(queried, false);
});
test("production diagnostics hide pooler connection and query failure details", async () => {
  const project = "abcdefghijklmnopqrst";
  const host = "region.pooler.supabase.com";
  const sensitive = "fixture-secret-token";
  const client = {
    host, user: `postgres.${project}`, ssl: { rejectUnauthorized: true },
    connection: { stream: { encrypted: true, authorized: true, getPeerCertificate: () => ({ subjectaltname: `DNS:${host}` }) } },
    async query() { throw new Error(`Sensitive database failure: ${sensitive}`); },
    release() {},
  };
  const diagnostic = createProductionDiagnosticService({
    database: { connect: async () => client },
    oci: { connect: async () => { throw new Error(`Sensitive OCI failure: ${sensitive}`); } },
    env: { NODE_ENV: sensitive, RENDER_GIT_COMMIT: sensitive, DATABASE_URL: sensitive },
  });
  const result = await diagnostic();
  assert.equal(result.database.connectionType, "supabase_pooler");
  assert.equal(result.database.projectIdentifier, project);
  assert.equal(result.schema.status, "query_failed");
  assert.equal(result.oci.status, "unavailable");
  assert.equal(result.environment, "unknown");
  assert.equal(result.deploymentCommit, null);
  assert.doesNotMatch(JSON.stringify(result), /fixture-secret-token|region\.pooler|postgres\./);
});
test("missing Blog schema returns an explicit unavailable response without leaking database errors", async () => {
  const controller = createBlogController({ queryFn: async () => { throw Object.assign(new Error("private relation details"), { code: "42P01" }); } });
  const res = response();
  await controller.listAdmin({ query: {} }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, "Blog service is unavailable.");
  assert.doesNotMatch(JSON.stringify(res.body), /private relation details/);
});
const document = { type: "doc", content: [{ type: "paragraph", attrs: { textAlign: "center" }, content: [{ type: "text", text: '<script>alert("fixture")</script>', marks: [{ type: "bold" }, { type: "textStyle", attrs: { color: "#123456", fontSize: "24px", fontFamily: "Georgia" } }] }] }] };
test("structured rich text persists formatting and safely renders text, styles and semantic markup", () => {
  assert.deepEqual(normalizeRichText(JSON.parse(JSON.stringify(document))), document);
  const html = renderRichTextHtml(document);
  assert.match(html, /text-align:center/); assert.match(html, /<strong>/); assert.match(html, /font-size:24px/);
  assert.doesNotMatch(html, /<script>/); assert.match(html, /&lt;script&gt;/);
  assert.equal(readingMinutes({ content: [{ type: "rich_text", document }] }), 1);
});
test("rich text rejects executable links, unsupported nodes, depth and oversized documents", () => {
  assert.throws(() => normalizeRichText({ type: "doc", content: [{ type: "script" }] }), /Unsupported/);
  assert.throws(() => normalizeRichText({ type: "doc", content: [{ type: "text", text: "Unsafe", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }), /protocol/);
  assert.throws(() => normalizeRichText({ type: "doc", content: [{ type: "text", text: "x".repeat(100001) }] }), /limit/);
  const html = renderRichTextHtml({ type: "doc", content: [{ type: "text", text: "Safe", marks: [{ type: "textStyle", attrs: { color: 'red; background:url(javascript:1)', fontFamily: 'x"; onload="bad' } }] }] });
  assert.doesNotMatch(html, /javascript|onload|background/);
});
test("scheduled publication boundaries are exact, and drafts/archived records remain private", () => {
  const now = Date.parse("2030-01-01T10:00:00Z");
  const post = { status: "scheduled", published_at: "2030-01-01T10:00:00Z" };
  assert.equal(isPublicArticle(post, now - 1), false); assert.equal(isPublicArticle(post, now), true);
  assert.equal(isPublicArticle({ ...post, status: "draft" }, now), false);
  assert.equal(isPublicArticle({ ...post, archived_at: "2030-01-01" }, now), false);
});
test("public SQL gates scheduled time consistently for listing, article, sitemap and media", async () => {
  const statements = [];
  const c = createBlogController({ database: {}, queryFn: async sql => { statements.push(sql); return { rows: [] }; } });
  await c.listPublished({ query: {} }, response());
  await c.getPublished({ params: { slug: "fixture" } }, response());
  await c.sitemap({}, response());
  await c.publicMedia({ params: { id: OTHER } }, response());
  for (const sql of statements.filter(s => /blog_posts/.test(s))) {
    assert.match(sql, /published_at<=NOW\(\)/i);
    assert.match(sql, /archived_at IS NULL/i);
  }
});
test("server author binding refuses an absent profile and never substitutes email or logo", async () => {
  const execute = async sql => ({ rows: sql.startsWith("select id,raw_user_meta_data") ? [{ id: ACTOR, raw_user_meta_data: {} }] : [] });
  const incomplete = await resolveAuthor(execute, ACTOR);
  assert.equal(incomplete.author_name, null); assert.equal(incomplete.author_avatar_media, null);
  await assert.rejects(resolveAuthor(execute, ACTOR, { requireComplete: true }), /Complete your author profile/);
});
test("server author binding derives genuine fields from the exact Auth identity", async () => {
  const execute = async sql => ({ rows: sql.startsWith("select id,raw_user_meta_data")
    ? [{ id: ACTOR, raw_user_meta_data: { full_name: "Local Fixture Author", avatar_media_id: OTHER, biography: "Fixture bio" } }]
    : [{ id: OTHER }] });
  const result = await resolveAuthor(execute, ACTOR, { requireComplete: true });
  assert.equal(result.author_id, ACTOR); assert.equal(result.author_name, "Local Fixture Author"); assert.equal(result.author_avatar_media, OTHER);
  assert.equal(result.author_url, `https://operionos.com/blog/authors/${ACTOR}`);
});
test("publication requires explicit review before any database operation", async () => {
  const c = createBlogController({ queryFn: async () => { throw new Error("Must not query"); }, database: {} });
  for (const method of ["publish", "schedule"]) {
    const r = response(); await c[method]({ params: { id: OTHER }, body: {}, user: { id: ACTOR } }, r);
    assert.equal(r.statusCode, 400); assert.match(r.body.error, /review/);
  }
});
test("AI analyzes complete saved rich content with consent, validates suggestions and cannot change author/status", async () => {
  let invocation;
  const analyze = createEditorialAnalyzer({ generate: async (...args) => {
    invocation = args;
    return { provider: "local-mock-not-real-AI", analysis: { seo_title: "Aviation evidence", seo_description: "Reviewing documented aviation clause evidence.", category: "Aircraft Leasing", tags: ["Evidence"], author_name: "Impersonator", status: "published", quality_notes: ["Verify source clauses."] } };
  } });
  const post = { title: "Aircraft lease evidence", excerpt: "Evidence guidance.", updated_at: "2030-01-01", content: [{ type: "rich_text", document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Review actual saved clause evidence. ".repeat(5) }] }] } }] };
  await assert.rejects(analyze(post, { consent: false }), /Confirm/);
  const result = await analyze(post, { consent: true, organizationId: ORGANIZATION });
  assert.match(invocation[0], /actual saved clause evidence/);
  assert.equal(invocation[2].organizationId, ORGANIZATION);
  assert.ok(!("author_name" in result.metadata)); assert.ok(!("status" in result.metadata));
  assert.equal(result.approved, false); assert.equal(result.revision.length, 64);
  assert.match(articlePlainText(post), /actual saved/);
});
test("AI budget membership is verified before accessing the article or invoking provider", async () => {
  let generated = false;
  const c = createBlogController({ database: {}, queryFn: async () => ({ rows: [] }), analyzer: async () => { generated = true; } });
  const r = response();
  await c.analyze({ params: { id: OTHER }, user: { id: ACTOR }, body: { organization_id: ORGANIZATION, public_editorial_consent: true } }, r);
  assert.equal(r.statusCode, 403); assert.equal(generated, false);
});
test("search controls remain usable on empty SSR result sets and never reflect executable HTML", () => {
  const html = renderBlogIndexHtml([], "", { search: '"><script>bad</script>' });
  assert.match(html, /name="search"/); assert.match(html, /name="category"/); assert.match(html, /name="tag"/);
  assert.doesNotMatch(html, /<script>bad<\/script>/);
});
test("RSS excludes drafts, future scheduled and nonindexable posts", async t => {
  const prior = process.env.VITE_API_BASE_URL; process.env.VITE_API_BASE_URL = "https://local-fixture.test";
  t.after(() => { if (prior === undefined) delete process.env.VITE_API_BASE_URL; else process.env.VITE_API_BASE_URL = prior; });
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => ({ posts: [
    { status: "published", published_at: "2020-01-01", slug: "public-fixture", title: "Public fixture" },
    { status: "draft", published_at: "2020-01-01", slug: "private-fixture", title: "Private fixture" },
    { status: "scheduled", published_at: "2099-01-01", slug: "future-fixture", title: "Future fixture" },
    { status: "published", published_at: "2020-01-01", slug: "noindex-fixture", title: "Noindex fixture", is_indexable: false },
  ] }) }));
  const r = response(); await blogFeed({ method: "GET" }, r);
  assert.equal(r.statusCode, 200); assert.match(r.body, /public-fixture/);
  assert.doesNotMatch(r.body, /private-fixture|future-fixture|noindex-fixture/);
});
const editorialPost = {
  id: OTHER, created_by: ACTOR, author_id: ACTOR, title: "Local aviation fixture", slug: "local-aviation-fixture",
  excerpt: "Reviewing documented aviation clause evidence.", category: "Aircraft Leasing", status: "draft",
  seo_title: "Local aviation fixture", seo_description: "Reviewing documented aviation clause evidence.",
  updated_at: "2030-01-01T10:00:00.000Z", content: [{ type: "paragraph", text: "Read original evidence before making an aviation decision." }],
};
const fixtureAuthor = async () => ({ author_id: ACTOR, author_name: "Local Fixture Author", author_bio: "", author_url: "", author_avatar_media: OTHER });
test("stale publication and scheduling approval cannot approve a different saved revision", async () => {
  for (const method of ["publish", "schedule", "update"]) {
    const calls = [];
    const c = createBlogController({ database: {}, authorResolver: fixtureAuthor, queryFn: async sql => { calls.push(sql); return { rows: [{ ...editorialPost }] }; } });
    const r = response();
    await c[method]({ user: { id: ACTOR }, params: { id: OTHER }, body: { ...editorialPost, confirm_review: true, published_at: "2099-01-01T10:00:00Z", expected_updated_at: "2020-01-01T10:00:00Z" } }, r);
    assert.equal(r.statusCode, 409);
    assert.ok(!calls.some(sql => /^(update|insert|delete)/i.test(sql)));
  }
});
test("scheduling stores an explicit UTC due time, authoritative author and auditable approval", async () => {
  const calls = [];
  const c = createBlogController({ database: {}, authorResolver: fixtureAuthor, queryFn: async (sql, params) => {
    calls.push({ sql, params });
    if (/select/i.test(sql.slice(0, 6))) return { rows: [{ ...editorialPost }] };
    if (sql.startsWith("update blog_posts")) return { rows: [{ ...editorialPost, status: "scheduled", published_at: params[0] }] };
    return { rows: [] };
  } });
  const r = response();
  await c.schedule({ user: { id: ACTOR }, params: { id: OTHER }, body: { confirm_review: true, published_at: "2099-01-01T12:00:00+02:00", expected_updated_at: editorialPost.updated_at } }, r);
  assert.equal(r.statusCode, 200, r.body?.error); assert.equal(r.body.post.status, "scheduled");
  assert.equal(r.body.post.published_at, "2099-01-01T10:00:00.000Z");
  assert.ok(calls.some(c => c.sql.includes("approved_at=now()")));
  assert.ok(calls.some(c => c.sql.includes("'scheduled',$3::jsonb)")));
});
test("permanent deletion requires archived state, exact title, saved revision and retained audit", async () => {
  const calls = [];
  const current = { ...editorialPost, status: "archived" };
  const c = createBlogController({ database: {}, queryFn: async (sql, params) => { calls.push({ sql, params }); return { rows: sql.startsWith("select") ? [current] : [] }; } });
  const request = confirm_title => ({ user: { id: ACTOR }, params: { id: OTHER }, body: { confirm_title, expected_updated_at: current.updated_at } });
  const denied = response(); await c.deleteArchived(request("wrong title"), denied);
  assert.equal(denied.statusCode, 400); assert.ok(!calls.some(c => c.sql.startsWith("delete")));
  calls.length = 0;
  const allowed = response(); await c.deleteArchived(request(current.title), allowed);
  assert.equal(allowed.body.deleted, true);
  assert.match(calls[1].sql, /blog_post_audit/); assert.equal(calls.at(-1).sql, "delete from blog_posts where id=$1");
  assert.ok(!calls.some(c => c.sql.includes("delete from blog_media")));
});
test("profile photo ownership is enforced before the Auth profile can be changed", async () => {
  let called = false;
  const c = createBlogController({ database: {}, queryFn: async () => ({ rows: [] }), authClient: () => { called = true; throw new Error("Must not contact Auth"); } });
  const r = response();
  await c.updateProfile({ user: { id: ACTOR }, body: { full_name: "Local Fixture Author", avatar_media_id: OTHER } }, r);
  assert.equal(r.statusCode, 400); assert.equal(called, false);
});
test("AI incomplete output fails explicitly and never fabricates a generated SEO result", async () => {
  const analyze = createEditorialAnalyzer({ generate: async () => ({ provider: "local-fixture", analysis: {} }) });
  await assert.rejects(analyze({ ...editorialPost, content: [{ type: "paragraph", text: "Saved article evidence. ".repeat(10) }] }, { consent: true, organizationId: ORGANIZATION }), /incomplete SEO suggestions/);
});
test("AI results cannot be attached after a concurrent publication", async () => {
  let reads = 0; const statements = [];
  const c = createBlogController({ database: {}, analyzer: async p => ({ revision: articleRevision(p), provider: "local-fixture" }), queryFn: async sql => {
    statements.push(sql);
    if (sql.includes("organization_memberships")) return { rows: [{ authorized: true }] };
    if (/select .*blog_posts/s.test(sql)) { reads++; return { rows: [{ ...editorialPost, status: reads === 1 ? "draft" : "published" }] }; }
    return { rows: [] };
  } });
  const r = response(); await c.analyze({ user: { id: ACTOR }, params: { id: OTHER }, body: { organization_id: ORGANIZATION, public_editorial_consent: true } }, r);
  assert.equal(r.statusCode, 409); assert.ok(!statements.some(sql => sql.startsWith("update blog_posts")));
});
