import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

/* ===============================
   DATABASE CONNECTION
=============================== */

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL missing");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

/* ===============================
   CONNECTION TEST
=============================== */

pool.connect()
  .then(client => {
    console.log("🟢 DB connected (audit layer active)");
    client.release();
  })
  .catch(err => {
    console.error("❌ DB connection failed");
    console.error(err.message);
  });

/* ===============================
   SAFE QUERY WRAPPER
=============================== */

export async function query(text, params = []) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error("❌ Query failed:", err.message);
    throw err;
  }
}

/* ===============================
   AUDIT LOGGER (SAFE)
=============================== */

export async function logAudit({
  user_id,
  company_id,
  action,
  entity_type,
  entity_id = null,
  metadata = {}
}) {
  try {
    await query(
      `
      INSERT INTO ai_extraction_logs
      (user_id, company_id, action, entity_type, entity_id, metadata, created_at)
      VALUES ($1,$2,$3,$4,$5,$6, NOW())
      `,
      [
        user_id || null,
        company_id || null,
        action,
        entity_type,
        entity_id,
        JSON.stringify(metadata || {})
      ]
    );

  } catch (err) {
    // IMPORTANT: never break backend if audit fails
    console.error("⚠️ Audit log failed:", err.message);
  }
}

export default pool;
