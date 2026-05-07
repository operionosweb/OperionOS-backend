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
    message: "Operion running"
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
   🌦 LIVE STATE
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

    const aircraft = await query(
      `SELECT id, tail_number, model FROM aircraft WHERE id = $1`,
      [id]
    );

    const reserves = await query(
      `
      SELECT category, SUM(accumulated_amount) AS total
      FROM maintenance_reserves
      WHERE aircraft_id = $1
      GROUP BY category
      `,
      [id]
    );

    const cost = await query(
      `
      SELECT
        SUM(increment) / NULLIF(SUM(flight_hours),0) AS cost_per_flight_hour
      FROM accrual_audit_log
      WHERE aircraft_id = $1
      `,
      [id]
    );

    res.json({
      aircraft: aircraft.rows[0],
      reserves: reserves.rows,
      metrics: {
        costPerFlightHour: cost.rows[0]?.cost_per_flight_hour || 0
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
   🚨 RISK FORECAST (ENHANCED)
=============================== */
app.get("/api/aircraft/:id/prediction", async (req, res) => {
  try {
    const { id } = req.params;

    const flightResult = await query(
      `
      SELECT COALESCE(SUM(flight_hours),0) AS hours
      FROM flight_usage
      WHERE aircraft_id = $1
      `,
      [id]
    );

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

    const hours = Number(flightResult.rows[0].hours);
    const state = stateResult.rows[0];

    let riskScore = hours * 0.01;

    if (state?.wind_speed > 25) riskScore += 15;
    if (state?.turbulence_index > 7) riskScore += 20;
    if (state?.phase === "landing") riskScore += 5;

    riskScore = Math.min(riskScore, 100);

    res.json({
      aircraftId: id,
      riskScore,
      status:
        riskScore > 70
          ? "HIGH"
          : riskScore > 40
          ? "MEDIUM"
          : "LOW"
    });

  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});

/* ===============================
   📈 FLEET FORECAST (NEW CORE FEATURE)
=============================== */
app.get("/api/fleet/forecast", async (req, res) => {
  try {

    // 1. Get all aircraft
    const aircraftResult = await query(`SELECT id, model, tail_number FROM aircraft`);

    const fleet = [];

    for (const aircraft of aircraftResult.rows) {

      // 2. Flight hours
      const flightResult = await query(
        `
        SELECT COALESCE(SUM(flight_hours),0) AS hours
        FROM flight_usage
        WHERE aircraft_id = $1
        `,
        [aircraft.id]
      );

      const hours = Number(flightResult.rows[0].hours);

      // 3. Cost rate
      const costResult = await query(
        `
        SELECT
          SUM(increment) / NULLIF(SUM(flight_hours),0) AS cost_rate
        FROM accrual_audit_log
        WHERE aircraft_id = $1
        `,
        [aircraft.id]
      );

      const costRate = Number(costResult.rows[0]?.cost_rate || 0);

      // 4. Forecast (30 days simple projection)
      const projectedCost = hours * costRate * 0.1;

      // 5. Simple risk model
      let risk = hours * 0.01;

      if (projectedCost > 5000) risk += 20;

      fleet.push({
        aircraft,
        totalHours: hours,
        costRate,
        projected30DayCost: projectedCost,
        riskScore: Math.min(risk, 100)
      });
    }

    // 6. Sort by risk
    fleet.sort((a, b) => b.riskScore - a.riskScore);

    res.json({
      fleet
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
  console.log("🚀 Operion forecasting engine running");
});
