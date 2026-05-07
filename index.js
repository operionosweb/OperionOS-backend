import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { query } from "./db.js";
import { applyMaintenanceAccrual } from "./accrualEngine.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

/* ===============================
   HEALTH CHECK
=============================== */
app.get("/api/test", (req, res) => {
  res.json({
    status: "ok",
    message: "API is working"
  });
});

/* ===============================
   FLIGHT INGESTION
=============================== */
app.post("/api/flight", async (req, res) => {
  try {
    const { aircraftId, flightHours } = req.body;

    if (!aircraftId || !flightHours) {
      return res.status(400).json({
        status: "error",
        message: "Missing aircraftId or flightHours"
      });
    }

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

/* ===============================
   AIRCRAFT SUMMARY (FINANCIAL)
=============================== */
app.get("/api/aircraft/:id/summary", async (req, res) => {
  try {
    const { id } = req.params;

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

    const reserveResult = await query(
      `
      SELECT category, SUM(accumulated_amount) AS total
      FROM maintenance_reserves
      WHERE aircraft_id = $1
      GROUP BY category
      `,
      [id]
    );

    const auditResult = await query(
      `
      SELECT category, SUM(increment) AS total
      FROM accrual_audit_log
      WHERE aircraft_id = $1
      GROUP BY category
      `,
      [id]
    );

    const costResult = await query(
      `
      SELECT
        SUM(increment) / NULLIF(SUM(flight_hours), 0) AS cost_per_flight_hour
      FROM accrual_audit_log
      WHERE aircraft_id = $1
      `,
      [id]
    );

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

/* ===============================
   🌦 LIVE AIRCRAFT STATE (NEW)
=============================== */
app.get("/api/aircraft/:id/live-state", async (req, res) => {
  try {
    const { id } = req.params;

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

    const stateResult = await query(
      `
      SELECT *
      FROM aircraft_state
      WHERE aircraft_id = $1
      ORDER BY last_updated DESC
      LIMIT 1
      `,
      [id]
    );

    const state = stateResult.rows[0] || null;

    // ===============================
    // Wear model (rule-based)
    // ===============================
    let wearMultiplier = 1;

    if (state?.wind_speed > 25) wearMultiplier += 0.10;
    if (state?.turbulence_index > 7) wearMultiplier += 0.15;
    if (state?.phase === "landing" && state?.wind_speed > 20) wearMultiplier += 0.05;

    res.json({
      aircraft,
      liveState: state,
      operationalImpact: {
        wearMultiplier,
        note:
          wearMultiplier > 1
            ? "Elevated maintenance stress detected"
            : "Normal operating conditions"
      }
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

/* ===============================
   START SERVER
=============================== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Operion backend running on port ${PORT}`);
});
