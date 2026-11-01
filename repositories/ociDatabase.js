import pg from "pg";
import { X509Certificate } from "node:crypto";
import { assertDedicatedOciDatabaseTarget } from "../config/ociProjectTarget.js";

function configError(code, message) {
  return Object.assign(new Error(message), { status: 503, code });
}
export function createOciDatabaseConfig(env = process.env) {
  let url;
  try {
    url = assertDedicatedOciDatabaseTarget({
      target: env.OCI_DATABASE_TARGET,
      projectRef: env.OCI_SUPABASE_PROJECT_REF,
      databaseUrl: env.OCI_DATABASE_URL,
    });
  } catch {
    throw configError("OCI_DATABASE_INVALID_TARGET", "OCI requires an explicit database endpoint for its dedicated Supabase project");
  }
  // pg connection-string SSL parameters take precedence over the supplied SSL object.
  for (const key of [...url.searchParams.keys()]) {
    if (["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert"].includes(key.toLowerCase()))
      url.searchParams.delete(key);
  }
  const ssl = { rejectUnauthorized: true };
  if (env.OCI_DATABASE_CA) {
    const certificates = env.OCI_DATABASE_CA.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
    if (!certificates?.length || env.OCI_DATABASE_CA.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g, "").trim())
      throw configError("OCI_DATABASE_INVALID_CA", "OCI database CA must contain approved PEM certificates");
    try { for (const certificate of certificates) new X509Certificate(certificate); }
    catch { throw configError("OCI_DATABASE_INVALID_CA", "OCI database CA contains an invalid certificate"); }
    ssl.ca = env.OCI_DATABASE_CA;
  }
  return { connectionString: url.toString(), ssl, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 };
}

// No dotenv, pool construction, probe, connection or sensitive query logging at import.
export function createOciDatabase({ env = process.env, Pool = pg.Pool } = {}) {
  let pool;
  const database = {
    getPool() {
      if (!pool) {
        pool = new Pool(createOciDatabaseConfig(env));
        pool.on?.("error", () => console.error("OCI database idle connection unavailable"));
      }
      return pool;
    },
    query(text, params = []) { return database.getPool().query(text, params); },
    connect() { return database.getPool().connect(); },
    async end() { if (pool) { const current = pool; pool = undefined; await current.end(); } },
  };
  return database;
}
const database = createOciDatabase();
export const query = (text, params = []) => database.query(text, params);
export const getOciPool = () => database.getPool();
export default database;
