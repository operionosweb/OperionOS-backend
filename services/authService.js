import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { query } from "../db.js";

/* =====================================================
   ADMIN LOGIN
===================================================== */

export async function adminLogin(req, res) {

  try {

    console.log("📥 Login request received");

    const { email, password } = req.body;

    console.log("EMAIL:", email);
    console.log("PASSWORD:", password);

    if (!email || !password) {

      return res.status(400).json({
        success: false,
        error: "Email and password required"
      });

    }

    const result = await query(
      `
      SELECT *
      FROM admin_users
      WHERE email = $1
      LIMIT 1
      `,
      [email]
    );

    console.log("DB RESULT:", result.rows);

    if (!result.rows.length) {

      return res.status(401).json({
        success: false,
        error: "Invalid credentials"
      });

    }

    const admin = result.rows[0];

    const validPassword = await bcrypt.compare(
      password,
      admin.password_hash
    );

    console.log("PASSWORD VALID:", validPassword);

    if (!validPassword) {

      return res.status(401).json({
        success: false,
        error: "Invalid credentials"
      });

    }

    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: admin.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (err) {

    console.error("❌ LOGIN ERROR:", err);

    res.status(500).json({
      success: false,
      error: "Login failed"
    });

  }
}
