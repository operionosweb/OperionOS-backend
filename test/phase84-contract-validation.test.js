import assert from "node:assert/strict";
import test from "node:test";
import { evaluateContractValidationConfig } from "./phase84-contract-validation.js";

function config() {
  return {
    PHASE3_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
    CONTRACT_TEST_PRODUCTION_PROJECT_REF: "zyxwvutsrqponmlkjihg",
    SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    SUPABASE_ANON_KEY: "synthetic-anon",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-service",
    SUPABASE_TEST_SERVICE_ROLE_KEY: "synthetic-service",
    DATABASE_URL: "postgresql://postgres.abcdefghijklmnopqrst:synthetic@aws-0.pooler.supabase.com:6543/postgres",
    AZURE_OPENAI_ENDPOINT: "https://synthetic.openai.azure.com",
    AZURE_OPENAI_DEPLOYMENT: "synthetic-model",
    AZURE_OPENAI_API_KEY: "synthetic-key",
    CONTRACT_TEST_TENANT_A_ID: "11111111-1111-4111-8111-111111111111",
    CONTRACT_TEST_TENANT_A_EMAIL: "a@example.invalid",
    CONTRACT_TEST_TENANT_A_PASSWORD: "synthetic-a",
    CONTRACT_TEST_TENANT_B_ID: "22222222-2222-4222-8222-222222222222",
    CONTRACT_TEST_TENANT_B_EMAIL: "b@example.invalid",
    CONTRACT_TEST_TENANT_B_PASSWORD: "synthetic-b",
    PHASE3_DB_TEST_ENABLED: "1",
    PHASE3_DB_ENV: "non-production-test",
    CONTRACT_AI_ENABLED: "true",
    CONTRACT_AI_PROVIDER_APPROVED: "true",
    CONTRACT_AI_ISOLATION_VERIFIED: "true",
    CONTRACT_AI_DATA_USE_APPROVED: "true",
    CONTRACT_TEST_WRITES_APPROVED: "true",
    CONTRACT_TEST_AI_SPEND_APPROVED: "true",
  };
}

test("missing credentials and approvals are reported without exposing values", () => {
  const report = evaluateContractValidationConfig({ AZURE_OPENAI_API_KEY: "private-synthetic-value" });
  assert.equal(report.status, "BLOCKED");
  assert.ok(report.missing.includes("DATABASE_URL"));
  assert.ok(report.approvalsRequired.includes("CONTRACT_AI_PROVIDER_APPROVED"));
  assert.equal(JSON.stringify(report).includes("private-synthetic-value"), false);
});

test("production and mismatched project references are rejected", () => {
  const env = config();
  env.CONTRACT_TEST_PRODUCTION_PROJECT_REF = env.PHASE3_SUPABASE_PROJECT_REF;
  env.DATABASE_URL = "postgresql://postgres.otherproject:synthetic@aws-0.pooler.supabase.com:6543/postgres";
  const report = evaluateContractValidationConfig(env);
  assert.ok(report.errors.includes("PRODUCTION_PROJECT_REJECTED"));
  assert.ok(report.errors.includes("DATABASE_PROJECT_MISMATCH"));
});

test("insecure or malformed database URLs fail closed", () => {
  for (const value of [
    "postgresql://postgres.abcdefghijklmnopqrst:synthetic@aws-0.pooler.supabase.com/postgres?sslmode=disable",
    "postgresql://%XX:synthetic@aws-0.pooler.supabase.com/postgres",
  ]) {
    const report = evaluateContractValidationConfig({ ...config(), DATABASE_URL: value });
    assert.ok(report.errors.length > 0);
    assert.equal(report.status, "BLOCKED");
  }
});

test("missing write or AI spend approval cannot enable remote work", () => {
  const env = config();
  delete env.CONTRACT_TEST_WRITES_APPROVED;
  delete env.CONTRACT_TEST_AI_SPEND_APPROVED;
  const report = evaluateContractValidationConfig(env);
  assert.deepEqual(report.approvalsRequired, ["CONTRACT_TEST_WRITES_APPROVED", "CONTRACT_TEST_AI_SPEND_APPROVED"]);
  assert.equal(report.status, "BLOCKED");
});

test("two distinct users and tenants are mandatory", () => {
  const env = config();
  env.CONTRACT_TEST_TENANT_B_ID = env.CONTRACT_TEST_TENANT_A_ID;
  env.CONTRACT_TEST_TENANT_B_EMAIL = env.CONTRACT_TEST_TENANT_A_EMAIL;
  const report = evaluateContractValidationConfig(env);
  assert.ok(report.errors.includes("DISTINCT_TEST_TENANTS_REQUIRED"));
  assert.ok(report.errors.includes("DISTINCT_TEST_USERS_REQUIRED"));
});

test("even fully populated configuration never masquerades as live validation", () => {
  const report = evaluateContractValidationConfig(config());
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.approvalsRequired, []);
  assert.deepEqual(report.errors, []);
  assert.equal(report.status, "BLOCKED");
  assert.equal(report.liveWorkflow, "NOT_EXECUTED");
});
