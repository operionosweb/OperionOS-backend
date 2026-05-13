import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

// ===============================
// Validate environment variables
// ===============================
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL missing");
  process.exit(1);
}

// ===============================
// PostgreSQL Connection Pool
// ===============================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false
  },

  max: 10,
  min: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: false
});

// ===============================
// Connection test
// ===============================
async function testConnection() {
  try {
    const client = await pool.connect();

    console.log("🟢 Database connected successfully");

    client.release();
  } catch (err) {
    console.error("❌ Database connection failed");
    console.error(err.message);
  }
}

testConnection();

// ===============================
// Pool error monitoring
// ===============================
pool.on("error", (err) => {
  console.error("❌ Unexpected PostgreSQL pool error");
  console.error(err.message);
});

// ===============================
// 🔐 CORE SAFETY RULE (NEW)
// ===============================
// Every tenant-aware query MUST include organization_id
// This is your backend enforcement layer

export function requireOrg(organizationId) {
  if (!organizationId) {
    throw new Error("Missing organization_id - request rejected");
  }
  return organizationId;
}

// ===============================
// Safe query wrapper
// ===============================
export async function query(text, params = []) {
  const start = Date.now();

  try {
    const result = await pool.query(text, params);

    const duration = Date.now() - start;

    console.log("🧠 Query executed", {
      duration: `${duration}ms`,
      rows: result.rowCount
    });

    return result;
  } catch (err) {
    console.error("❌ Query failed");
    console.error(err.message);
    throw err;
  }
}

// ===============================
// 🔐 SAFE QUERY HELPERS (IMPORTANT)
// ===============================

// SELECT with org protection
export async function queryOrgSelect(table, organizationId) {
  requireOrg(organizationId);

  const text = `
    SELECT * FROM ${table}
    WHERE organization_id = $1
  `;

  return query(text, [organizationId]);
}

// INSERT with org enforcement
export async function queryOrgInsert(table, data, organizationId) {
  requireOrg(organizationId);

  const keys = Object.keys(data);
  const values = Object.values(data);

  // Force org_id injection
  keys.push("organization_id");
  values.push(organizationId);

  const columns = keys.join(", ");
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

  const text = `
    INSERT INTO ${table} (${columns})
    VALUES (${placeholders})
    RETURNING *
  `;

  return query(text, values);
}

// ===============================
// Export pool
// ===============================
export default pool;
