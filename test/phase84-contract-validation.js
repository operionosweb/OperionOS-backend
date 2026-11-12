import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED = [
  "PHASE3_SUPABASE_PROJECT_REF", "CONTRACT_TEST_PRODUCTION_PROJECT_REF",
  "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_TEST_SERVICE_ROLE_KEY", "DATABASE_URL",
  "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_API_KEY",
  "CONTRACT_TEST_TENANT_A_ID", "CONTRACT_TEST_TENANT_A_EMAIL", "CONTRACT_TEST_TENANT_A_PASSWORD",
  "CONTRACT_TEST_TENANT_B_ID", "CONTRACT_TEST_TENANT_B_EMAIL", "CONTRACT_TEST_TENANT_B_PASSWORD",
];
const APPROVALS = {
  PHASE3_DB_TEST_ENABLED: "1",
  PHASE3_DB_ENV: "non-production-test",
  CONTRACT_AI_ENABLED: "true",
  CONTRACT_AI_PROVIDER_APPROVED: "true",
  CONTRACT_AI_ISOLATION_VERIFIED: "true",
  CONTRACT_AI_DATA_USE_APPROVED: "true",
  CONTRACT_TEST_WRITES_APPROVED: "true",
  CONTRACT_TEST_AI_SPEND_APPROVED: "true",
};
const REF = /^[a-z0-9]{20}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function url(value) {
  try { return new URL(value); } catch { return null; }
}

export function evaluateContractValidationConfig(env) {
  const missing = REQUIRED.filter((name) => !env[name]?.trim());
  const approvals = Object.entries(APPROVALS)
    .filter(([name, value]) => env[name] !== value)
    .map(([name]) => name);
  const errors = [];
  const testRef = env.PHASE3_SUPABASE_PROJECT_REF;
  const productionRef = env.CONTRACT_TEST_PRODUCTION_PROJECT_REF;
  if (testRef && !REF.test(testRef)) errors.push("INVALID_TEST_PROJECT_REF");
  if (productionRef && !REF.test(productionRef)) errors.push("INVALID_PRODUCTION_PROJECT_REF");
  if (testRef && productionRef && testRef === productionRef) errors.push("PRODUCTION_PROJECT_REJECTED");
  if (testRef && /prod|production/i.test(testRef)) errors.push("PRODUCTION_LIKE_PROJECT_REJECTED");

  if (env.SUPABASE_URL && testRef) {
    const target = url(env.SUPABASE_URL);
    if (!target || target.protocol !== "https:" || target.hostname !== `${testRef}.supabase.co`
      || target.username || target.password || target.port || target.search || target.hash
      || !["", "/"].includes(target.pathname)) errors.push("SUPABASE_PROJECT_MISMATCH");
  }
  if (env.DATABASE_URL && testRef) {
    const db = url(env.DATABASE_URL);
    let user = "";
    try { user = db ? decodeURIComponent(db.username) : ""; } catch { errors.push("INVALID_DATABASE_URL"); }
    const direct = db?.hostname === `db.${testRef}.supabase.co`;
    const pooler = db && /^[a-z0-9-]+\.pooler\.supabase\.com$/i.test(db.hostname)
      && user === `postgres.${testRef}`;
    const unsafeParameters = db && [...db.searchParams].some(([name, value]) => {
      const key = name.toLowerCase();
      return (key.startsWith("ssl") && (key !== "sslmode" || value.toLowerCase() !== "verify-full"))
        || ["host", "hostaddr", "port", "user", "password", "database", "dbname"].includes(key);
    });
    if (!db || !["postgres:", "postgresql:"].includes(db.protocol) || (!direct && !pooler) || unsafeParameters) {
      errors.push("DATABASE_PROJECT_MISMATCH");
    }
  }
  if (env.AZURE_OPENAI_ENDPOINT) {
    const azure = url(env.AZURE_OPENAI_ENDPOINT);
    if (!azure || azure.protocol !== "https:" || !/^[a-z0-9-]+\.openai\.azure\.com$/i.test(azure.hostname)
      || azure.username || azure.password || azure.port || azure.search || azure.hash
      || !["", "/"].includes(azure.pathname)) errors.push("INVALID_AZURE_ENDPOINT");
  }
  if (env.AZURE_OPENAI_DEPLOYMENT && !/^[a-zA-Z0-9._-]{1,128}$/.test(env.AZURE_OPENAI_DEPLOYMENT)) {
    errors.push("INVALID_AZURE_DEPLOYMENT");
  }
  if (env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_TEST_SERVICE_ROLE_KEY
    && env.SUPABASE_SERVICE_ROLE_KEY !== env.SUPABASE_TEST_SERVICE_ROLE_KEY) {
    errors.push("SERVICE_ROLE_KEY_MISMATCH");
  }
  for (const name of ["CONTRACT_TEST_TENANT_A_ID", "CONTRACT_TEST_TENANT_B_ID"]) {
    if (env[name] && !UUID.test(env[name])) errors.push(`INVALID_${name}`);
  }
  if (env.CONTRACT_TEST_TENANT_A_ID && env.CONTRACT_TEST_TENANT_B_ID
    && env.CONTRACT_TEST_TENANT_A_ID.toLowerCase() === env.CONTRACT_TEST_TENANT_B_ID.toLowerCase()) {
    errors.push("DISTINCT_TEST_TENANTS_REQUIRED");
  }
  if (env.CONTRACT_TEST_TENANT_A_EMAIL && env.CONTRACT_TEST_TENANT_B_EMAIL
    && env.CONTRACT_TEST_TENANT_A_EMAIL.toLowerCase() === env.CONTRACT_TEST_TENANT_B_EMAIL.toLowerCase()) {
    errors.push("DISTINCT_TEST_USERS_REQUIRED");
  }
  return {
    status: "BLOCKED",
    missing,
    approvalsRequired: approvals,
    errors,
    liveWorkflow: "NOT_EXECUTED",
    message: "Configuration checks do not verify approval or isolation. No live workflow or remote operations were executed.",
  };
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(evaluateContractValidationConfig(process.env)));
  process.exitCode = 2;
}
