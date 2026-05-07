import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import pool from "./db.js";
import { applyMaintenanceAccrual } from "./accrualEngine.js";

dotenv.config();

const app = express();

// =====================
// Middleware
// =====================
app.use(cors());
app.use(express.json());

// =====================
// Health check
// =====================
app.get("/", (req, res) => {
  res.send("Operion backend running");
});

// =====================
// API test
// =====================
app.get("/api/test", (req, res) => {
  res.json({
    status: "ok",
    message: "API is working"
  });
});

// =====================
// MAIN FLIGHT ENDPOINT
// =====================
app.post("/api/flight", async (req, res) => {
  try {
    const { aircraftId, flightHours, flightDate } = req.body;

    // Validation
    if (!aircraftId) {
      return res.status(400).json({ error: "aircraftId is required" });
    }

    if (!flightHours || flightHours <= 0) {
      return res.status(400).json({ error: "flightHours must be > 0" });
    }

    // 1. Insert flight record
    const flightResult = await pool.query(
      `
      INSERT INTO flight_usage (aircraft_id, flight_date, flight_hours)
      VALUES ($1, COALESCE($2, now()), $3)
      RETURNING *
      `,
      [aircraftId, flightDate || null, flightHours]
    );

    const flight = flightResult.rows[0];

    // 2. Run accrual engine
    const accrualResult = await applyMaintenanceAccrual(
      aircraftId,
      flightHours
    );

    // 3. Response
    res.json({
      status: "success",
      message: "Flight recorded and maintenance accrual applied",
      flight,
      accrual: accrualResult
    });

  } catch (error) {
    console.error("❌ /api/flight error:", error.message);

    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// =====================
// Server start
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("===================================");
  console.log("🚀 Operion backend started");
  console.log("🌍 Port:", PORT);
  console.log("===================================");
});
