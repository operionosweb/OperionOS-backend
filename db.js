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

  // Pool tuning
  max: 10,
  min: 1,

  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,

  allowExitOnIdle: false
});

// ===============================
// Initial connection test
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
// Safe query wrapper
// ===============================
export async function query(text, params) {
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

export default pool;
