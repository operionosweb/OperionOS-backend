import path from "node:path";
import { fileURLToPath } from "node:url";

export const acceptanceRoot = path.dirname(fileURLToPath(import.meta.url));
export const frontendRoot = path.resolve(acceptanceRoot, "../..");
export const repositoryRoot = path.resolve(frontendRoot, "..");
export const acceptanceStatePath = path.join(repositoryRoot, ".acceptance-temp", "state.json");

const localTargets = Object.freeze({
  SUPABASE_URL: ["http:", "54321"],
  CONTRACT_ACCEPTANCE_API_URL: ["http:", "10001"],
  CONTRACT_ACCEPTANCE_WEB_URL: ["http:", "4174"],
});

function validateLocalUrl(value, name, protocol, port, database = false) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid explicit local URL.`);
  }
  const validProtocol = database
    ? ["postgres:", "postgresql:"].includes(url.protocol)
    : url.protocol === protocol;
  if (!validProtocol || url.hostname !== "127.0.0.1" || url.port !== port
    || url.hash || (database
      ? url.pathname !== "/postgres" || !url.username || [...url.searchParams].some(
        ([key, entry]) => key !== "sslmode" || entry !== "disable"
      )
      : url.username || url.password || url.search || !["", "/"].includes(url.pathname))) {
    throw new Error(`${name} must use the expected numeric loopback host, port and path without target overrides.`);
  }
}

export function validateAcceptanceEnvironment(environment) {
  const required = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_TEST_SERVICE_ROLE_KEY"];
  const missing = required.filter((name) => !environment[name]?.trim());
  if (missing.length) throw new Error(`Missing local acceptance configuration: ${missing.join(", ")}`);
  if (environment.CONTRACT_ACCEPTANCE_ENABLED !== "1") {
    throw new Error("Local acceptance creates and deletes synthetic data. Set CONTRACT_ACCEPTANCE_ENABLED=1 only for a verified disposable local stack.");
  }
  if (environment.PHASE3_DB_TEST_ENABLED !== "1" || environment.PHASE3_DB_ENV !== "non-production-test") {
    throw new Error("Local acceptance requires PHASE3_DB_TEST_ENABLED=1 and PHASE3_DB_ENV=non-production-test.");
  }

  validateLocalUrl(environment.DATABASE_URL, "DATABASE_URL", "postgresql:", "54322", true);
  const targets = {
    ...environment,
    CONTRACT_ACCEPTANCE_API_URL: environment.CONTRACT_ACCEPTANCE_API_URL ?? "http://127.0.0.1:10001",
    CONTRACT_ACCEPTANCE_WEB_URL: environment.CONTRACT_ACCEPTANCE_WEB_URL ?? "http://127.0.0.1:4174",
  };
  for (const [name, [protocol, port]] of Object.entries(localTargets)) {
    validateLocalUrl(targets[name], name, protocol, port);
  }
  for (const [name, expected] of [
    ["VITE_API_BASE_URL", targets.CONTRACT_ACCEPTANCE_API_URL],
    ["VITE_SUPABASE_URL", targets.SUPABASE_URL],
    ["VITE_SUPABASE_ANON_KEY", targets.SUPABASE_ANON_KEY],
    ["SUPABASE_SERVICE_ROLE_KEY", targets.SUPABASE_TEST_SERVICE_ROLE_KEY],
  ]) {
    if (environment[name] !== undefined && environment[name] !== expected) {
      throw new Error(`${name} conflicts with the explicit local acceptance configuration.`);
    }
  }
  return targets;
}

export function loadAcceptanceEnvironment() {
  const targets = validateAcceptanceEnvironment(process.env);
  process.env.CONTRACT_ACCEPTANCE_API_URL = targets.CONTRACT_ACCEPTANCE_API_URL;
  process.env.CONTRACT_ACCEPTANCE_WEB_URL = targets.CONTRACT_ACCEPTANCE_WEB_URL;
  process.env.VITE_API_BASE_URL = process.env.CONTRACT_ACCEPTANCE_API_URL;
  process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL;
  process.env.VITE_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  return process.env;
}