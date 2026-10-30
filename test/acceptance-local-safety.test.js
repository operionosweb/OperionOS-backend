import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { validateAcceptanceEnvironment } from "../frontend/tests/acceptance/environment.mjs";
import { assertAcceptanceExecutionAllowed } from "../frontend/tests/acceptance/safety.mjs";
import {
  apiRequest, cleanupFixtures, createClients, createTenant,
  readAcceptanceState, uploadContract, writeDocx,
} from "../frontend/tests/acceptance/fixture-support.mjs";

function acceptanceSource(filename) {
  return fs.readFileSync(new URL(`../frontend/tests/acceptance/${filename}`, import.meta.url), "utf8");
}

function isDisabled(error) {
  assert.equal(error.code, "ACCEPTANCE_EXECUTION_DISABLED");
  assert.match(error.message, /identity, durable exact ownership, recovery, and containment/);
  assert.match(error.message, /separately approved/);
  assert.match(error.message, /Preserve incomplete-run resources/);
  return true;
}

function localEnvironment(overrides = {}) {
  return {
    DATABASE_URL: "postgresql://postgres:synthetic-only@127.0.0.1:54322/postgres",
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_ANON_KEY: "synthetic-anon",
    SUPABASE_TEST_SERVICE_ROLE_KEY: "synthetic-service",
    CONTRACT_ACCEPTANCE_ENABLED: "1",
    PHASE3_DB_TEST_ENABLED: "1",
    PHASE3_DB_ENV: "non-production-test",
    ...overrides,
  };
}

test("URL validation accepts loopback configuration but does not authorize execution", () => {
  const environment = localEnvironment();
  const result = validateAcceptanceEnvironment(environment);
  assert.equal(result.CONTRACT_ACCEPTANCE_API_URL, "http://127.0.0.1:10001");
  assert.equal(result.CONTRACT_ACCEPTANCE_WEB_URL, "http://127.0.0.1:4174");
  assert.equal(environment.CONTRACT_ACCEPTANCE_API_URL, undefined);
  assert.throws(() => assertAcceptanceExecutionAllowed(), isDisabled);
});

for (const [index, [name, value]] of [
  ["SUPABASE_URL", "https://amlpybvkzoegnxwuodyn.supabase.co"],
  ["SUPABASE_URL", "https://cvwalskmgniwtmqqbdvj.supabase.co"],
  ["SUPABASE_URL", "http://127.0.0.1.example.com:54321"],
  ["SUPABASE_URL", "http://localhost:54321"],
  ["SUPABASE_URL", "http://user:synthetic@127.0.0.1:54321"],
  ["SUPABASE_URL", "http://127.0.0.1:54321/unexpected"],
  ["SUPABASE_URL", "http://127.0.0.1:54321?host=remote"],
  ["DATABASE_URL", "postgresql://postgres:synthetic@remote.example:54322/postgres"],
  ["DATABASE_URL", "postgresql://postgres:synthetic@127.0.0.1:54322/postgres?host=remote.example"],
  ["DATABASE_URL", "postgresql://postgres:synthetic@127.0.0.1:54322/postgres?hostaddr=203.0.113.1"],
  ["DATABASE_URL", "postgresql://postgres:synthetic@127.0.0.1:54322/existing"],
  ["DATABASE_URL", "postgresql://postgres:synthetic@127.0.0.1:6543/postgres"],
  ["CONTRACT_ACCEPTANCE_API_URL", "https://example.onrender.com"],
  ["CONTRACT_ACCEPTANCE_WEB_URL", "https://example.vercel.app"],
  ["CONTRACT_ACCEPTANCE_API_URL", ""],
  ["VITE_SUPABASE_URL", "https://remote.example"],
  ["SUPABASE_SERVICE_ROLE_KEY", "different-synthetic-service"],
].entries()) {
  test(`rejects unsafe or ambiguous ${name} variant ${index + 1}`, () => {
    assert.throws(() => validateAcceptanceEnvironment(localEnvironment({ [name]: value })), (error) => {
      assert.ok(error.message.includes(name));
      if (value) assert.ok(!error.message.includes(value));
      return true;
    });
  });
}

test("missing local values fail closed without reading an environment file", () => {
  assert.throws(() => validateAcceptanceEnvironment({}), /Missing local acceptance configuration/);
});

test("local labels and loopback URLs do not replace destructive-test opt-in", () => {
  for (const overrides of [
    { CONTRACT_ACCEPTANCE_ENABLED: "0" },
    { PHASE3_DB_TEST_ENABLED: "0" },
    { PHASE3_DB_ENV: "local" },
  ]) {
    assert.throws(() => validateAcceptanceEnvironment(localEnvironment(overrides)));
  }
});

test("environment loader has no environment-file reader", () => {
  const source = acceptanceSource("environment.mjs");
  assert.doesNotMatch(source, /dotenv|readFile|import\s*\(/);
  assert.match(source, /validateAcceptanceEnvironment\(process\.env\)/);
});

test("gate refuses without configuration or bypass inputs", () => {
  assert.throws(() => assertAcceptanceExecutionAllowed(), isDisabled);
  for (const purportedBypass of [
    localEnvironment(),
    { CONTRACT_ACCEPTANCE_ENABLED: "1", CONTRACT_ACCEPTANCE_FORCE: "1", ACCEPTANCE_SKIP_SAFETY: "1" },
    { environmentIdentityVerified: true, ownershipVerified: true, hardeningComplete: true },
    ["--force", "--skip-safety", "--build"],
    "http://127.0.0.1:54321",
  ]) {
    assert.throws(() => assertAcceptanceExecutionAllowed(purportedBypass), isDisabled);
  }
  const source = acceptanceSource("safety.mjs");
  assert.match(source, /export function assertAcceptanceExecutionAllowed\(\)/);
  assert.match(source, /throw error;/);
  assert.doesNotMatch(source, /\bimport\b|\bprocess\b|\bif\s*\(|\breturn\b|\bfetch\s*\(/);
});

for (const [label, state] of [
  ["missing", undefined],
  ["null", null],
  ["malformed", "{invalid-json"],
  ["empty", {}],
  ["incomplete", { tenants: [], aircraftIds: [] }],
  ["unverified identifiers", { tenants: [{ organizationId: "unrelated", user: { id: "unrelated" } }] }],
]) {
  test(`cleanup refuses ${label} ownership state without touching clients`, async () => {
    const calls = [];
    const client = new Proxy({}, {
      get(_target, property) {
        calls.push(property);
        throw new Error("Client access is forbidden");
      },
    });
    await assert.rejects(cleanupFixtures({ admin: client, pool: client, state }), isDisabled);
    assert.deepEqual(calls, []);
  });
}

test("cleanup refuses even without arguments or with unreadable arguments", async () => {
  await assert.rejects(cleanupFixtures(), isDisabled);
  await assert.rejects(cleanupFixtures(new Proxy({}, {
    get() { throw new Error("Cleanup must not read supplied arguments"); },
  })), isDisabled);
});

test("state reader refuses before filesystem access even when optional is requested", async () => {
  await assert.rejects(readAcceptanceState(), isDisabled);
  await assert.rejects(readAcceptanceState({ optional: true }), isDisabled);
  const source = acceptanceSource("fixture-support.mjs");
  assert.match(source, /export async function readAcceptanceState\(\) \{\s*assertAcceptanceExecutionAllowed\(\);\s*\}/);
});

test("direct fixture helpers refuse before clients, requests or file writes", async () => {
  assert.throws(() => createClients(), isDisabled);
  await assert.rejects(apiRequest("/api/contracts/upload"), isDisabled);
  await assert.rejects(createTenant({}), isDisabled);
  await assert.rejects(uploadContract({}), isDisabled);
  await assert.rejects(writeDocx("must-not-be-created.docx", "synthetic"), isDisabled);
  const source = acceptanceSource("fixture-support.mjs");
  for (const name of ["createClients", "apiRequest", "createTenant", "writeDocx", "uploadContract"]) {
    assert.match(source, new RegExp(`export (?:async )?function ${name}\\([^\\n]*\\) \\{\\s*assertAcceptanceExecutionAllowed\\(\\);`));
  }
});

test("fixture paths contain no stale discovery, destructive cleanup or shared-directory deletion", () => {
  const support = acceptanceSource("fixture-support.mjs");
  const setup = acceptanceSource("global-setup.mjs");
  const teardown = acceptanceSource("global-teardown.mjs");
  assert.doesNotMatch([support, setup, teardown].join("\n"), /cleanupStaleFixtures|slug\s+like|playwright-acceptance-%|fs\.(?:rm|rmdir|unlink)\s*\(/i);
  assert.doesNotMatch(support, /delete\s+from|deleteUser|\.remove\s*\(/i);
  assert.match(support, /export async function cleanupFixtures\(\) \{\s*assertAcceptanceExecutionAllowed\(\);\s*\}/);
  assert.doesNotMatch(setup, /cleanupFixtures|\bcatch\s*\(/);
  assert.doesNotMatch(teardown, /createClients|cleanupFixtures|readAcceptanceState/);
});

for (const [filename, firstOperation] of [
  ["run.mjs", 'import.meta.resolve("@playwright/test/cli")'],
  ["playwright.config.js", 'await import("@playwright/test")'],
  ["start-backend.mjs", "loadAcceptanceEnvironment();"],
  ["start-frontend.mjs", 'await import("vite")'],
  ["global-setup.mjs", 'await import("./fixture-support.mjs")'],
  ["contract-workspace.spec.js", 'await import("@playwright/test")'],
]) {
  test(`${filename} gates before imports, configuration or execution`, () => {
    const source = acceptanceSource(filename);
    assert.match(source, /import \{ assertAcceptanceExecutionAllowed \} from "\.\/safety\.mjs";/);
    const gate = source.indexOf("assertAcceptanceExecutionAllowed();");
    assert.ok(gate >= 0);
    assert.ok(source.indexOf(firstOperation) > gate);
    assert.doesNotMatch(source.slice(0, gate), /import\s+[^;]*from\s+["'](?:vite|@playwright\/test|\.\/fixture-support\.mjs)["']/);
    if (filename === "run.mjs") {
      assert.match(source, /try \{\s*assertAcceptanceExecutionAllowed\(\);/);
    } else if (filename === "global-setup.mjs") {
      assert.match(source, /export default async function globalSetup\(\) \{\s*assertAcceptanceExecutionAllowed\(\);/);
    } else {
      assert.match(source, /from "\.\/safety\.mjs";\s*assertAcceptanceExecutionAllowed\(\);/);
    }
  });
}

test("teardown contains only an unconditional refusal before any state or clients", () => {
  assert.match(acceptanceSource("global-teardown.mjs"), /^import \{ assertAcceptanceExecutionAllowed \} from "\.\/safety\.mjs";\s*export default async function globalTeardown\(\) \{\s*assertAcceptanceExecutionAllowed\(\);\s*\}\s*$/);
});
