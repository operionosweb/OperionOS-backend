import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { query } from "./db.js";
import { applyMaintenanceAccrual } from "./accrualEngine.js";

dotenv.config();

const app = express();

// ===============================
// Middleware
// ===============================
app.use(cors());
app.use(express.json());

// ===============================
// HEALTH CHECK
// ===============================
app.get("/api/test", async (req, res) => {
  res.json({
    status: "ok",
    message: "API is working"
  });
});

// ===============================
// FLIGHT ENDPOINT
// ===============================
app.post("/api/flight", async (req, res) => {
  try {
    const { aircraftId, flightHours } = req.body;

    if (!aircraftId || !flightHours) {
      return res.status(400).json({
        status: "error",
        message: "Missing aircraftId or flightHours"
      });
    }

    // 1. Insert flight
    const flightResult = await query(
      `
      INSERT INTO flight_usage (
        aircraft_id,
        flight_hours,
        flight_date
      )
      VALUES ($1, $2, now())
      RETURNING *
      `,
      [aircraftId, flightHours]
    );

    const flight = flightResult.rows[0];

    // 2. Apply accrual engine
    const accrual = await applyMaintenanceAccrual(
      aircraftId,
      flightHours
    );

    res.json({
      status: "success",
      message: "Flight recorded and maintenance accrual applied",
      flight,
      accrual
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// ===============================
// AIRCRAFT FINANCIAL SUMMARY
// ===============================
app.get("/api/aircraft/:id/summary", async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Aircraft info
    const aircraftResult = await query(
      `
      SELECT id, tail_number, model
      FROM aircraft
      WHERE id = $1
      `,
      [id]
    );

    if (aircraftResult.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Aircraft not found"
      });
    }

    const aircraft = aircraftResult.rows[0];

    // 2. Current reserves
    const reserveResult = await query(
      `
      SELECT
        category,
        SUM(accumulated_amount) AS total
      FROM maintenance_reserves
      WHERE aircraft_id = $1
      GROUP BY category
      `,
      [id]
    );

    // 3. Accrual history
    const auditResult = await query(
      `
      SELECT
        category,
        SUM(increment) AS total
      FROM accrual_audit_log
      WHERE aircraft_id = $1
      GROUP BY category
      `,
      [id]
    );

    // 4. Cost per flight hour
    const costResult = await query(
      `
      SELECT
        SUM(increment) / NULLIF(SUM(flight_hours), 0) AS cost_per_flight_hour
      FROM accrual_audit_log
      WHERE aircraft_id = $1
      `,
      [id]
    );

    // ===============================
    // RESPONSE
    // ===============================
    res.json({
      aircraft,
      reserves: reserveResult.rows,
      accrualHistory: auditResult.rows,
      metrics: {
        costPerFlightHour:
          costResult.rows[0]?.cost_per_flight_hour || 0
      }
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Operion backend running on port ${PORT}`);
});
