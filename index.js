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
   🌦 FETCH REAL WEATHER (NEW)
=============================== */
async function fetchWeather(lat, lon) {
  // Open-Meteo free API (no key needed)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

  const res = await fetch(url);
  const data = await res.json();

  return {
    wind_speed: data?.current_weather?.windspeed || 0,
    temperature: data?.current_weather?.temperature || 0
  };
}

/* ===============================
   🌦 UPDATE AIRCRAFT STATE (NEW)
=============================== */
app.post("/api/aircraft/:id/update-state", async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, phase } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        status: "error",
        message: "Missing coordinates"
      });
    }

    // 1. Get weather
    const weather = await fetchWeather(latitude, longitude);

    // 2. Simple turbulence model (rule-based)
    let turbulence_index = 5;

    if (weather.wind_speed > 30) turbulence_index += 3;
    if (weather.wind_speed > 20) turbulence_index += 1;

    // 3. Store state
    const result = await query(
      `
      INSERT INTO aircraft_state (
        aircraft_id,
        latitude,
        longitude,
        altitude,
        phase,
        wind_speed,
        temperature,
        turbulence_index,
        last_updated
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
      RETURNING *
      `,
      [
        id,
        latitude,
        longitude,
        0,
        phase || "cruise",
        weather.wind_speed,
        weather.temperature,
        turbulence_index
      ]
    );

    res.json({
      status: "success",
      message: "Aircraft state updated with live weather",
      state: result.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

/* ===============================
   AIRCRAFT SUMMARY
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

  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

/* ===============================
   LIVE STATE VIEW
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
      liveState: state,
      operationalImpact: {
        wearMultiplier
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
