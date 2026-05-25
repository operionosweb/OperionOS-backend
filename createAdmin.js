import bcrypt from "bcryptjs";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const password = "OperionAdmin2026!";

const hash = await bcrypt.hash(password, 10);

await pool.query(
  `
  INSERT INTO admin_users (
    email,
    password_hash,
    role
  )
  VALUES ($1, $2, $3)
  `,
  [
    "meelis@operionos.com",
    hash,
    "admin"
  ]
);

console.log("✅ Admin user created");

await pool.end();
