import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateMattLocal } from "../scripts/validate-matt-local.js";

function configured() {
  return {
    MATT_LIVE_ENABLED: "true", MATT_LIVE_APPROVAL_ID: "test-approval", MATT_LIVE_ORGANIZATIONS: "test-organization",
    TAVUS_API_KEY: "not-a-real-api-key", TAVUS_MATT_ECHO_PAL_ID: "test-pal", TAVUS_MATT_FACE_ID: "test-face", TAVUS_MATT_VOICE_ID: "test-voice",
    MATT_ECHO_PAL_APPROVED: "true", MATT_FIXED_VOICE_APPROVED: "true", MATT_DATA_PROCESSING_APPROVED: "true", MATT_BUDGET_APPROVED: "true",
    MISTRAL_API_KEY: "not-a-real-model-key",
  };
}
test("offline local validator reports missing gates without calling providers or claiming readiness", () => {
  const result = validateMattLocal({});
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.configurationStatus, "BLOCKED");
  assert.ok(result.missing.includes("TAVUS_API_KEY"));
  assert.ok(result.missing.includes("MATT_FIXED_VOICE_APPROVED"));
  assert.equal(result.networkRequests, 0);
  assert.equal(result.liveSessionCreated, false);
  assert.equal(result.demo.status, "BLOCKED");
  assert.equal(result.demo.allowed, true);
  assert.equal(result.demo.readiness, "configuration_incomplete");
  assert.equal(result.demo.missing.includes("MATT_DEMO_ENABLED"), false);
  assert.equal(result.demo.limits.processSessionAuthorizations, 0);
});
test("syntactically configured environments still cannot claim genuine activation or leak values", () => {
  const env = configured(), result = validateMattLocal(env);
  assert.equal(result.configurationStatus, "VERIFIED");
  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(result.missing, []);
  const text = JSON.stringify(result);
  for (const name of ["TAVUS_API_KEY", "MISTRAL_API_KEY", "TAVUS_MATT_FACE_ID", "MATT_LIVE_APPROVAL_ID", "MATT_LIVE_ORGANIZATIONS"]) {
    assert.equal(text.includes(env[name]), false);
  }
});
test("invalid identity, empty approval/allowlist and unsupported models are reported by field name only", () => {
  const env = { ...configured(), TAVUS_MATT_FACE_ID: "invalid/identity-value", MATT_LIVE_APPROVAL_ID: "  ", MATT_LIVE_ORGANIZATIONS: "one,,", AI_PROVIDER: "unsupported-vendor" };
  const result = validateMattLocal(env);
  assert.equal(result.configurationStatus, "BLOCKED");
  assert.deepEqual(result.invalid, ["TAVUS_MATT_FACE_ID", "MATT_LIVE_APPROVAL_ID", "MATT_LIVE_ORGANIZATIONS"]);
  assert.ok(result.missing.includes("MATT_SUPPORTED_MODEL_PROVIDER"));
  assert.equal(JSON.stringify(result).includes("invalid/identity-value"), false);
  assert.equal(JSON.stringify(result).includes("unsupported-vendor"), false);
});
test("standalone validator fails closed and never automatically loads a root environment file", () => {
  const run = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/validate-matt-local.js", import.meta.url))], {
    encoding: "utf8", env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH },
  });
  assert.equal(run.status, 1);
  const result = JSON.parse(run.stdout);
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.missing.includes("MATT_LIVE_ENABLED"));
  assert.equal(run.stderr, "");
});
