import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

/**
 * Operion Database Connection Pool
 * ---------------------------------
 * Uses DATABASE_URL from Render environment variables.
 * Works with Supabase / Render Postgres / Neon.
 */

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is missing in environment variables");
  throw new Error("DATABASE_URL not configured");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Required for cloud databases (Render / Supabase / Neon)
  ssl: {
    rejectUnauthorized: false
  },

  // Stability tuning for production
  max: 10,              // max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Optional: connection test on startup
pool.connect()
  .then((client) => {
    console.log("===================================");
    console.log("🟢 Database connected successfully");
    console.log("===================================");
    client.release();
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
  });

export default pool;
