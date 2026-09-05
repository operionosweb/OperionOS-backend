import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

export const acceptanceRoot = path.dirname(fileURLToPath(import.meta.url));
export const frontendRoot = path.resolve(acceptanceRoot, "../..");
export const repositoryRoot = path.resolve(frontendRoot, "..");
export const acceptanceStatePath = path.join(repositoryRoot, ".acceptance-temp", "state.json");

export function loadAcceptanceEnvironment() {
  dotenv.config({ path: path.join(repositoryRoot, ".env.phase3-test.local"), override: false, quiet: true });

  const required = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_TEST_SERVICE_ROLE_KEY"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing acceptance configuration: ${missing.join(", ")}`);
  if (process.env.CONTRACT_ACCEPTANCE_ENABLED !== "1") {
    throw new Error("Authenticated acceptance is disabled. Set CONTRACT_ACCEPTANCE_ENABLED=1 for a disposable non-production target.");
  }
  if (process.env.PHASE3_DB_TEST_ENABLED !== "1" || process.env.PHASE3_DB_ENV !== "non-production-test") {
    throw new Error("Authenticated acceptance requires PHASE3_DB_TEST_ENABLED=1 and PHASE3_DB_ENV=non-production-test.");
  }

  const projectRef = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
  if (/(^|[-_])(prod|production)($|[-_])/i.test(projectRef)) {
    throw new Error("Refusing to run authenticated acceptance against a production-like Supabase project.");
  }

  process.env.CONTRACT_ACCEPTANCE_API_URL ||= "http://127.0.0.1:10001";
  process.env.CONTRACT_ACCEPTANCE_WEB_URL ||= "http://127.0.0.1:4174";
  process.env.VITE_API_BASE_URL = process.env.CONTRACT_ACCEPTANCE_API_URL;
  process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL;
  process.env.VITE_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  return process.env;
}