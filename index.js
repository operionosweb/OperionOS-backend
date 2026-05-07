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
   HEALTH
=============================== */
app.get("/api/test", (req, res) => {
  res.json({
    status: "ok",
    message: "API running"
  });
});

/* ===============================
   FLIGHT INGESTION
=============================== */
app.post("/api/flight", async (req, res) => {
  try {
    const { aircraftId, flightHours } = req.body;

    const flightResult = await query(
      `
      INSERT INTO flight_usage (
        aircraft_id,
        flight_hours,
        flight_date
      )
      VALUES ($1,$2,now())
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
      flight,
      accrual
    });

  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});

/* ===============================
   🌦 GET LATEST STATE
=============================== */
app.get("/api/aircraft/:id/live-state", async (req, res) => {
  try {
    const { id } = req.params;

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

    const state = stateResult.rows[0];

    let wearMultiplier = 1;

    if (state?.wind_speed > 25) wearMultiplier += 0.10;
    if (state?.turbulence_index > 7) wearMultiplier += 0.15;

    res.json({
      state,
      wearMultiplier
    });

  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});

/* ===============================
   📊 AIRCRAFT SUMMARY
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
      aircraft: aircraftResult.rows[0],
      reserves: reserveResult.rows,
      accrualHistory: auditResult.rows,
      metrics: {
        costPerFlightHour:
          costResult.rows[0]?.cost_per_flight_hour || 0
      }
    });

  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});

/* ===============================
   🚨 PREDICTION ENGINE (NEW)
=============================== */
app.get("/api/aircraft/:id/prediction", async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get total flight hours
    const flightResult = await query(
      `
      SELECT COALESCE(SUM(flight_hours),0) AS hours
      FROM flight_usage
      WHERE aircraft_id = $1
      `,
      [id]
    );

    const hours = Number(flightResult.rows[0].hours);

    // 2. Get latest environmental stress
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

    const state = stateResult.rows[0];

    // ===============================
    // PREDICTION MODEL (RULE-BASED)
    // ===============================

    let riskScore = 0;

    // Utilization factor
    riskScore += hours * 0.01;

    // Weather stress
    if (state?.wind_speed > 25) riskScore += 15;
    if (state?.turbulence_index > 7) riskScore += 20;

    // Flight phase risk
    if (state?.phase === "landing") riskScore += 5;

    // Normalize
    const normalizedRisk = Math.min(riskScore, 100);

    // Classification
    let status = "LOW";

    if (normalizedRisk > 70) status = "HIGH";
    else if (normalizedRisk > 40) status = "MEDIUM";

    // ===============================
    // RESPONSE
    // ===============================
    res.json({
      aircraftId: id,
      riskScore: normalizedRisk,
      status,
      factors: {
        totalFlightHours: hours,
        windSpeed: state?.wind_speed || 0,
        turbulence: state?.turbulence_index || 0
      },
      recommendation:
        status === "HIGH"
          ? "Immediate inspection recommended"
          : status === "MEDIUM"
          ? "Monitor closely"
          : "Normal operation"
    });

  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});

/* ===============================
   START
=============================== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Operion predictive engine running");
});
