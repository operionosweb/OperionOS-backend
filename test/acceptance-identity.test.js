import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  CANONICAL_MIGRATIONS, IDENTITY_SCHEMA, SERVICE_ROLES,
  canonicalIdentityManifest, digestIdentityManifest, validateIdentityManifest,
} from "../frontend/tests/acceptance/identity.mjs";
import {
  IDENTITY_DIMENSIONS, compareIdentityFromAdapter, compareIdentityObservations,
} from "../frontend/tests/acceptance/identity-observations.mjs";
import { assertAcceptanceExecutionAllowed } from "../frontend/tests/acceptance/safety.mjs";

// All identifiers, hashes and observations below are synthetic, not an approved environment.
const nowMs = Date.parse("2026-01-01T12:00:00.000Z");
const uuid = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const hash = "a".repeat(64);
const changedHash = "b".repeat(64);
const challenge = uuid(99);

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, ordered(value[key])]));
  }
  return value;
}

function evidenceDigest(dimension, evidence) {
  return createHash("sha256").update(JSON.stringify(ordered({
    schema: "operion-acceptance-evidence/v1", dimension, evidence,
  })), "utf8").digest("hex");
}

function manifestFixture() {
  const endpoints = {
    postgres: "postgresql://127.0.0.1:54322/postgres",
    rest: "http://127.0.0.1:54321/rest/v1",
    auth: "http://127.0.0.1:54321/auth/v1",
    storage: "http://127.0.0.1:54321/storage/v1",
    backend: "http://127.0.0.1:10001/",
    frontend: "http://127.0.0.1:4174/",
  };
  const services = Object.fromEntries(SERVICE_ROLES.map((role, index) => [
    role, { id: uuid(20 + index), runtimeId: uuid(5), imageSha256: hash, endpoint: endpoints[role] },
  ]));
  return {
    schema: IDENTITY_SCHEMA, taskId: uuid(1), environmentId: uuid(2), databaseGenerationId: uuid(3),
    issuedAt: "2026-01-01T11:00:00.000Z", expiresAt: "2026-01-01T13:00:00.000Z",
    runtime: {
      kind: "disposable-linux-vm", ownerId: uuid(4), vmId: uuid(5),
      bootId: uuid(6), stackId: uuid(7), databaseVolumeId: uuid(8), storageVolumeId: uuid(9),
    },
    services,
    database: { serviceId: services.postgres.id, systemIdentifier: "123456789", databaseOid: "12345", name: "postgres" },
    control: { markerId: uuid(10), environmentId: uuid(2), databaseGenerationId: uuid(3), schemaVersion: 1 },
    migrations: CANONICAL_MIGRATIONS.map((file) => ({ version: file.slice(0, 3), file, sha256: hash })),
    databaseSchemaSha256: hash,
    storage: {
      serviceId: services.storage.id, volumeId: uuid(9), bucketId: "synthetic-private", public: false,
      sentinel: { objectId: uuid(11), key: "synthetic/sentinel.json", sha256: hash },
    },
    application: {
      sourceRevision: "a".repeat(40), adapterVersion: "synthetic-v1", frontendBuildSha256: hash,
      frontendConfig: { apiEndpoint: endpoints.backend, supabaseEndpoint: "http://127.0.0.1:54321/", anonKeySha256: hash },
    },
  };
}

function evidenceFixture(manifest) {
  const { runtime, services, database, control, application, storage } = manifest;
  const binding = { database, control, databaseVolumeId: runtime.databaseVolumeId };
  const evidence = {
    runtime: { ...runtime, listeners: SERVICE_ROLES.map((role) => ({ role, ...services[role] })), noForwarding: true },
    database: { ...binding, migrations: manifest.migrations, databaseSchemaSha256: manifest.databaseSchemaSha256 },
    control,
    services: ["rest", "auth", "storage"].map((role) => ({
      role, ...services[role], ...binding, storageVolumeId: role === "storage" ? runtime.storageVolumeId : null,
    })),
    backend: { service: services.backend, ...binding, sourceRevision: application.sourceRevision, adapterVersion: application.adapterVersion },
    frontend: {
      service: services.frontend, sourceRevision: application.sourceRevision,
      buildSha256: application.frontendBuildSha256, config: application.frontendConfig,
    },
    storage,
  };
  const manifestSha256 = digestIdentityManifest(manifest, { nowMs });
  return JSON.parse(JSON.stringify(Object.fromEntries(IDENTITY_DIMENSIONS.map((dimension) => [
    dimension, {
      status: "available", sourceId: `synthetic-${dimension}`, observedAtMs: nowMs,
      validUntilMs: nowMs + 300_000,
      taskId: manifest.taskId, environmentId: manifest.environmentId,
      databaseGenerationId: manifest.databaseGenerationId, dimension,
      evidenceSha256: evidenceDigest(dimension, evidence[dimension]),
      challenge, manifestSha256, evidence: evidence[dimension],
    },
  ]))));
}

function contextFixture(manifest) {
  return {
    nowMs, challenge,
    trustAnchor: {
      provenance: "approved-provisioning",
      manifestSha256: digestIdentityManifest(manifest, { nowMs }),
      vmId: manifest.runtime.vmId, bootId: manifest.runtime.bootId, stackId: manifest.runtime.stackId,
      observationSources: Object.fromEntries(IDENTITY_DIMENSIONS.map((dimension) => [dimension, `synthetic-${dimension}`])),
    },
  };
}

function invalid(manifest) {
  assert.throws(() => validateIdentityManifest(manifest, { nowMs }), { code: "INVALID_ACCEPTANCE_IDENTITY_MANIFEST" });
}

test("valid synthetic manifest validates without establishing trust or mutating input", () => {
  const input = manifestFixture();
  const before = JSON.stringify(input);
  assert.deepEqual(validateIdentityManifest(input, { nowMs }), input);
  assert.equal(JSON.stringify(input), before);
  assert.notEqual(validateIdentityManifest(input, { nowMs }), input);
});

for (const field of Object.keys(manifestFixture())) {
  test(`missing manifest field ${field} fails closed`, () => {
    const manifest = manifestFixture();
    delete manifest[field];
    invalid(manifest);
  });
}

test("invalid UUIDs, unknown versions, unknown fields and numeric identities are rejected", () => {
  for (const mutate of [
    (m) => { m.taskId = "not-a-uuid"; },
    (m) => { m.schema = "operion-acceptance-identity/v2"; },
    (m) => { m.control.schemaVersion = 2; },
    (m) => { m.secret = "synthetic-secret-must-not-appear-in-errors"; },
    (m) => { m.database.systemIdentifier = "not-a-number"; },
    (m) => { m.database.databaseOid = "4294967296"; },
    (m) => { delete m.runtime.ownerId; },
  ]) {
    const manifest = manifestFixture();
    mutate(manifest);
    invalid(manifest);
  }
});

test("duplicate and contradictory identities, endpoints, references and migration inventory are rejected", () => {
  for (const mutate of [
    (m) => { m.services.auth.id = m.services.rest.id; },
    (m) => { m.runtime.bootId = m.runtime.vmId; },
    (m) => { m.services.auth.runtimeId = uuid(90); },
    (m) => { m.services.auth.endpoint = m.services.rest.endpoint; },
    (m) => { m.services.backend.endpoint = "http://localhost:10001/"; },
    (m) => { m.services.backend.endpoint = "http://user:synthetic@127.0.0.1:10001/"; },
    (m) => { m.database.serviceId = m.services.auth.id; },
    (m) => { m.storage.volumeId = uuid(90); },
    (m) => { m.storage.public = true; },
    (m) => { m.storage.sentinel.key = "synthetic/../escape"; },
    (m) => { m.control.databaseGenerationId = uuid(90); },
    (m) => { m.application.frontendConfig.apiEndpoint = m.services.frontend.endpoint; },
    (m) => { m.migrations[1] = m.migrations[0]; },
    (m) => { m.migrations.reverse(); },
  ]) {
    const manifest = manifestFixture();
    mutate(manifest);
    invalid(manifest);
  }
});

test("expiry, future issuance, excessive lifetime and missing explicit clock are rejected", () => {
  const manifest = manifestFixture();
  assert.throws(() => validateIdentityManifest(manifest), { code: "INVALID_ACCEPTANCE_IDENTITY_MANIFEST" });
  assert.throws(() => validateIdentityManifest(manifest, { nowMs: Date.parse(manifest.expiresAt) }), { code: "INVALID_ACCEPTANCE_IDENTITY_MANIFEST" });
  assert.throws(() => validateIdentityManifest(manifest, { nowMs: Date.parse(manifest.issuedAt) - 1 }), { code: "INVALID_ACCEPTANCE_IDENTITY_MANIFEST" });
  manifest.expiresAt = "2026-01-03T12:00:00.000Z";
  invalid(manifest);
});

test("canonical bytes ignore object insertion order and commit to every migration digest", () => {
  const manifest = manifestFixture();
  const reordered = Object.fromEntries(Object.entries(manifest).reverse());
  reordered.services = Object.fromEntries(Object.entries(manifest.services).reverse());
  const canonical = canonicalIdentityManifest(manifest, { nowMs });
  assert.equal(canonicalIdentityManifest(reordered, { nowMs }), canonical);
  const digest = digestIdentityManifest(manifest, { nowMs });
  assert.equal(digest, createHash("sha256").update(canonical, "utf8").digest("hex"));
  manifest.migrations[0].sha256 = changedHash;
  assert.notEqual(digestIdentityManifest(manifest, { nowMs }), digest);
});

test("manifest validation invokes no supplied client, filesystem or network adapters", () => {
  let calls = 0;
  const forbidden = () => { calls += 1; throw new Error("Unexpected adapter call"); };
  validateIdentityManifest(manifestFixture(), { nowMs, client: forbidden, filesystem: forbidden, network: forbidden });
  assert.equal(calls, 0);
});

test("matching unauthenticated synthetic evidence is consistent but rejected as unverified", () => {
  const manifest = manifestFixture();
  const result = compareIdentityObservations(manifest, evidenceFixture(manifest), contextFixture(manifest));
  assert.equal(result.status, "rejected");
  assert.equal(result.comparisonStatus, "matched");
  assert.equal(result.manifestValid, true);
  assert.equal(result.evidenceConsistent, true);
  assert.equal(result.evidenceAuthenticated, false);
  assert.equal(result.evidenceFresh, false);
  for (const dimension of IDENTITY_DIMENSIONS) {
    assert.equal(result.dimensions[dimension].code, "OBSERVER_AUTHENTICATION_UNAVAILABLE");
    assert.equal(result.dimensions[dimension].evidenceAuthenticated, false);
    assert.equal(result.dimensions[dimension].evidenceFresh, false);
  }
  assert.equal(result.executionAllowed, false);
  assert.equal(result.infrastructureVerified, false);
  assert.throws(() => assertAcceptanceExecutionAllowed(result), { code: "ACCEPTANCE_EXECUTION_DISABLED" });
});

for (const dimension of IDENTITY_DIMENSIONS) {
  test(`missing or unavailable ${dimension} observations reject identity`, () => {
    const manifest = manifestFixture();
    const evidence = evidenceFixture(manifest);
    delete evidence[dimension];
    const context = contextFixture(manifest);
    assert.equal(compareIdentityObservations(manifest, evidence, context).status, "rejected");
    assert.equal(compareIdentityObservations(manifest, evidence, context).infrastructureVerified, false);
    assert.equal(compareIdentityObservations(manifest, evidence, context).evidenceConsistent, false);
    evidence[dimension] = { status: "unavailable" };
    assert.equal(compareIdentityObservations(manifest, evidence, context).dimensions[dimension].code, "OBSERVATION_UNAVAILABLE");
  });
}

test("a matching database marker alone cannot establish identity", () => {
  const manifest = manifestFixture();
  const evidence = evidenceFixture(manifest);
  assert.equal(compareIdentityObservations(manifest, { control: evidence.control }, contextFixture(manifest)).status, "rejected");
});

test("clone, generation, migration, service, build and sentinel mismatches reject", () => {
  for (const [dimension, mutate] of [
    ["runtime", (e) => { e.runtime.evidence.databaseVolumeId = uuid(90); }],
    ["database", (e) => { e.database.evidence.database.systemIdentifier = "987654321"; }],
    ["control", (e) => { e.control.evidence.databaseGenerationId = uuid(90); }],
    ["database", (e) => { e.database.evidence.migrations[0].sha256 = changedHash; }],
    ["services", (e) => { e.services.evidence[0].databaseVolumeId = uuid(90); }],
    ["frontend", (e) => { e.frontend.evidence.buildSha256 = changedHash; }],
    ["storage", (e) => { e.storage.evidence.sentinel.sha256 = changedHash; }],
  ]) {
    const manifest = manifestFixture();
    const evidence = evidenceFixture(manifest);
    mutate(evidence);
    assert.equal(compareIdentityObservations(manifest, evidence, contextFixture(manifest)).dimensions[dimension].code, "IDENTITY_MISMATCH");
  }
});

test("changed expected generation or migration digest cannot reuse an old trust anchor", () => {
  for (const mutate of [
    (m) => { m.databaseGenerationId = uuid(90); m.control.databaseGenerationId = uuid(90); },
    (m) => { m.migrations[0].sha256 = changedHash; },
  ]) {
    const manifest = manifestFixture();
    const context = contextFixture(manifest);
    mutate(manifest);
    assert.throws(() => compareIdentityObservations(manifest, {}, context), { code: "IDENTITY_TRUST_ANCHOR_REQUIRED" });
  }
});

test("untrusted provenance, missing challenge and stale/replayed/unknown-source evidence fail closed", () => {
  const manifest = manifestFixture();
  const context = contextFixture(manifest);
  assert.throws(() => compareIdentityObservations(manifest, {}, { ...context, trustAnchor: undefined }), { code: "IDENTITY_TRUST_ANCHOR_REQUIRED" });
  assert.throws(() => compareIdentityObservations(manifest, {}, {
    ...context, trustAnchor: { ...context.trustAnchor, provenance: "environment-variable" },
  }), { code: "IDENTITY_TRUST_ANCHOR_REQUIRED" });
  assert.throws(() => compareIdentityObservations(manifest, {}, {
    ...context, trustAnchor: { ...context.trustAnchor, observationSources: {} },
  }), { code: "IDENTITY_TRUST_ANCHOR_REQUIRED" });
  assert.throws(() => compareIdentityObservations(manifest, {}, { ...context, challenge: undefined }), { code: "IDENTITY_CHALLENGE_REQUIRED" });
  for (const [code, mutate] of [
    ["STALE_OBSERVATION", (e) => { e.runtime.observedAtMs = nowMs - 300_001; }],
    ["STALE_OBSERVATION", (e) => { e.runtime.observedAtMs = nowMs + 1; }],
    ["OBSERVATION_CONTEXT_MISMATCH", (e) => { e.runtime.challenge = uuid(90); }],
    ["OBSERVATION_CONTEXT_MISMATCH", (e) => { e.runtime.databaseGenerationId = uuid(90); }],
    ["OBSERVATION_CONTEXT_MISMATCH", (e) => { e.runtime.taskId = uuid(90); }],
    ["OBSERVATION_CONTEXT_MISMATCH", (e) => { e.runtime.environmentId = uuid(90); }],
    ["OBSERVATION_CONTEXT_MISMATCH", (e) => { e.runtime.dimension = "database"; }],
    ["STALE_OBSERVATION", (e) => { e.runtime.validUntilMs = nowMs; }],
    ["STALE_OBSERVATION", (e) => { e.runtime.validUntilMs = nowMs + 300_001; }],
    ["EVIDENCE_DIGEST_MISMATCH", (e) => { e.runtime.evidenceSha256 = changedHash; }],
    ["UNTRUSTED_OBSERVATION_SOURCE", (e) => { e.runtime.sourceId = "unapproved"; }],
  ]) {
    const evidence = evidenceFixture(manifest);
    mutate(evidence);
    assert.equal(compareIdentityObservations(manifest, evidence, context).dimensions.runtime.code, code);
  }
});

test("explicit fake adapter is injected; no default observer or implicit service access exists", () => {
  const manifest = manifestFixture();
  const context = contextFixture(manifest);
  let calls = 0;
  const adapter = (input) => {
    calls += 1;
    assert.deepEqual(input, manifest);
    return evidenceFixture(input);
  };
  assert.equal(compareIdentityFromAdapter(manifest, context).status, "rejected");
  assert.equal(calls, 0);
  const result = compareIdentityFromAdapter(manifest, { ...context, adapter });
  assert.equal(result.status, "rejected");
  assert.equal(result.comparisonStatus, "matched");
  assert.equal(result.evidenceAuthenticated, false);
  assert.equal(calls, 1);
  assert.throws(() => compareIdentityFromAdapter(manifest, { ...context, trustAnchor: null, adapter }), { code: "IDENTITY_TRUST_ANCHOR_REQUIRED" });
  assert.equal(calls, 1);
});

test("pure module import graph has no application/client/IO imports and Increment A has no environment bypass", () => {
  const source = (name) => readFileSync(new URL(`../frontend/tests/acceptance/${name}`, import.meta.url), "utf8");
  const identity = source("identity.mjs");
  const observations = source("identity-observations.mjs");
  const imports = (text) => [...text.matchAll(/^import .* from "([^"]+)";$/gm)].map((match) => match[1]);
  assert.deepEqual(imports(identity), ["node:crypto", "zod"]);
  assert.deepEqual(imports(observations), ["node:crypto", "./identity.mjs"]);
  for (const text of [identity, observations]) {
    assert.doesNotMatch(text, /\b(?:process|fetch|createClient|Pool|Client|readFile|writeFile|dotenv)\b/);
    assert.doesNotMatch(text, /\bimport\s*\(/);
  }
  const gate = source("safety.mjs");
  assert.doesNotMatch(gate, /\b(?:import|process|if|switch|return)\b/);
  assert.match(gate, /error\.code = "ACCEPTANCE_EXECUTION_DISABLED";\s+throw error;/);
});

test("a valid manifest alone never authenticates or verifies an environment", () => {
  const manifest = manifestFixture();
  const result = compareIdentityObservations(manifest, {}, contextFixture(manifest));
  assert.equal(result.manifestValid, true);
  for (const field of ["evidenceConsistent", "evidenceAuthenticated", "evidenceFresh", "infrastructureVerified", "executionAllowed"]) {
    assert.equal(result[field], false);
  }
});

test("caller authentication claims and verifier callbacks cannot grant trust", () => {
  const manifest = manifestFixture();
  const context = contextFixture(manifest);
  let calls = 0;
  const result = compareIdentityObservations(manifest, evidenceFixture(manifest), {
    ...context, authenticated: true, evidenceAuthenticated: true, evidenceFresh: true,
    trustAnchor: { ...context.trustAnchor, authenticated: true },
    authenticate: () => { calls += 1; return true; },
  });
  assert.equal(calls, 0);
  assert.equal(result.evidenceConsistent, true);
  assert.equal(result.evidenceAuthenticated, false);
  assert.equal(result.evidenceFresh, false);
  assert.equal(result.infrastructureVerified, false);
  assert.equal(result.executionAllowed, false);
  const evidence = evidenceFixture(manifest);
  evidence.runtime.authenticated = true;
  const claimed = compareIdentityObservations(manifest, evidence, context);
  assert.equal(claimed.dimensions.runtime.code, "INVALID_OBSERVATION_ENVELOPE");
  assert.equal(claimed.evidenceAuthenticated, false);
});

test("repeating matching evidence cannot claim operational replay protection", () => {
  const manifest = manifestFixture();
  const evidence = evidenceFixture(manifest);
  const context = contextFixture(manifest);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = compareIdentityObservations(manifest, evidence, context);
    assert.equal(result.evidenceConsistent, true);
    assert.equal(result.evidenceFresh, false);
    assert.equal(result.infrastructureVerified, false);
    assert.equal(result.status, "rejected");
  }
});
