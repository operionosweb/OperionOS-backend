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

    console.log("===================================");
    console.log("🟢 Database connected successfully");
    console.log("===================================");

    client.release();

  } catch (err) {

    console.error("===================================");
    console.error("❌ Database connection failed");
    console.error(err.message);
    console.error("===================================");

  }

}

testConnection();

// ===============================
// Pool error monitoring
// ===============================
pool.on("error", (err) => {

  console.error("===================================");
  console.error("❌ Unexpected PostgreSQL pool error");
  console.error(err.message);
  console.error("===================================");

});

// ===============================
// 🔐 CORE SAFETY RULE
// ===============================

export function requireOrg(organizationId) {

  if (!organizationId) {

    throw new Error(
      "Missing organization_id - request rejected"
    );

  }

  return organizationId;

}

// ===============================
// Safe query wrapper
// ===============================
export async function query(
  text,
  params = []
) {

  const start = Date.now();

  try {

    const result =
      await pool.query(text, params);

    const duration =
      Date.now() - start;

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
// 🔐 SAFE QUERY HELPERS
// ===============================

// SELECT with org protection
export async function queryOrgSelect(
  table,
  organizationId
) {

  requireOrg(organizationId);

  const text = `
    SELECT *
    FROM ${table}
    WHERE organization_id = $1
  `;

  return query(text, [organizationId]);

}

// INSERT with org enforcement
export async function queryOrgInsert(
  table,
  data,
  organizationId
) {

  requireOrg(organizationId);

  const keys =
    Object.keys(data);

  const values =
    Object.values(data);

  // Force org_id injection
  keys.push("organization_id");
  values.push(organizationId);

  const columns =
    keys.join(", ");

  const placeholders =
    values
      .map((_, i) => `$${i + 1}`)
      .join(", ");

  const text = `
    INSERT INTO ${table}
    (${columns})
    VALUES (${placeholders})
    RETURNING *
  `;

  return query(text, values);

}

// ===============================
// 🛡️ AUDIT LOGGER (NEW)
// ===============================

export async function logAudit({

  user_id,
  company_id,
  action,
  entity_type = null,
  entity_id = null,
  metadata = {}

}) {

  try {

    await query(

      `
      INSERT INTO audit_logs (

        user_id,
        company_id,
        action,
        entity_type,
        entity_id,
        metadata

      )
      VALUES ($1, $2, $3, $4, $5, $6)
      `,

      [

        user_id,
        company_id,
        action,
        entity_type,
        entity_id,
        metadata

      ]

    );

  } catch (err) {

    console.error("❌ Audit log failed");
    console.error(err.message);

  }

}

// ===============================
// Export pool
// ===============================
export default pool;
