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
    message: "Operion Control Center running"
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
      `
      SELECT id, tail_number, model
      FROM aircraft
      WHERE id = $1
      `,
      [id]
    );

    const reserves = await query(
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

    const cost = await query(
      `
      SELECT
        SUM(increment) /
        NULLIF(SUM(flight_hours),0)
        AS cost_per_flight_hour
      FROM accrual_audit_log
      WHERE aircraft_id = $1
      `,
      [id]
    );

    res.json({
      aircraft: aircraft.rows[0],
      reserves: reserves.rows,
      metrics: {
        costPerFlightHour:
          cost.rows[0]?.cost_per_flight_hour || 0
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
   🚨 AIRCRAFT PREDICTION
=============================== */
app.get("/api/aircraft/:id/prediction", async (req, res) => {
  try {

    const { id } = req.params;

    const flightResult = await query(
      `
      SELECT
        COALESCE(SUM(flight_hours),0) AS hours
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

    let status = "LOW";

    if (riskScore > 70) status = "HIGH";
    else if (riskScore > 40) status = "MEDIUM";

    res.json({
      aircraftId: id,
      riskScore,
      status
    });

  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});

/* ===============================
   🌍 OPERION CONTROL CENTER
=============================== */
app.get("/api/control-center", async (req, res) => {
  try {

    // ===============================
    // 1. Load all aircraft
    // ===============================
    const aircraftResult = await query(
      `
      SELECT id, tail_number, model
      FROM aircraft
      `
    );

    const aircraftList = aircraftResult.rows;

    const dashboard = [];

    let fleetRiskTotal = 0;
    let fleetCostTotal = 0;

    // ===============================
    // 2. Build intelligence per aircraft
    // ===============================
    for (const aircraft of aircraftList) {

      // Flight hours
      const hoursResult = await query(
        `
        SELECT COALESCE(SUM(flight_hours),0) AS total
        FROM flight_usage
        WHERE aircraft_id = $1
        `,
        [aircraft.id]
      );

      const totalHours =
        Number(hoursResult.rows[0].total);

      // Cost rate
      const costResult = await query(
        `
        SELECT
          SUM(increment) /
          NULLIF(SUM(flight_hours),0)
          AS cost_rate
        FROM accrual_audit_log
        WHERE aircraft_id = $1
        `,
        [aircraft.id]
      );

      const costRate =
        Number(costResult.rows[0]?.cost_rate || 0);

      // Live state
      const stateResult = await query(
        `
        SELECT *
        FROM aircraft_state
        WHERE aircraft_id = $1
        ORDER BY last_updated DESC
        LIMIT 1
        `,
        [aircraft.id]
      );

      const state = stateResult.rows[0];

      // ===============================
      // Risk model
      // ===============================
      let riskScore = totalHours * 0.01;

      if (state?.wind_speed > 25)
        riskScore += 15;

      if (state?.turbulence_index > 7)
        riskScore += 20;

      if (state?.phase === "landing")
        riskScore += 5;

      riskScore = Math.min(riskScore, 100);

      // ===============================
      // Forecast
      // ===============================
      const projected30DayCost =
        totalHours * costRate * 0.1;

      // ===============================
      // Recommendation engine
      // ===============================
      let recommendation =
        "Continue normal operations";

      if (riskScore > 70) {
        recommendation =
          "Prioritize inspection immediately";
      } else if (riskScore > 40) {
        recommendation =
          "Monitor maintenance closely";
      }

      dashboard.push({
        aircraft,
        metrics: {
          totalHours,
          costRate,
          projected30DayCost,
          riskScore
        },
        liveState: state || null,
        recommendation
      });

      fleetRiskTotal += riskScore;
      fleetCostTotal += projected30DayCost;
    }

    // ===============================
    // Fleet ranking
    // ===============================
    dashboard.sort(
      (a, b) =>
        b.metrics.riskScore -
        a.metrics.riskScore
    );

    // ===============================
    // Fleet health score
    // ===============================
    const fleetHealthScore =
      dashboard.length > 0
        ? Math.max(
            0,
            100 -
              fleetRiskTotal / dashboard.length
          )
        : 100;

    // ===============================
    // RESPONSE
    // ===============================
    res.json({
      generatedAt: new Date(),
      fleetHealthScore,
      projectedFleet30DayCost:
        fleetCostTotal,
      aircraftRankings: dashboard
    });

  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});

/* ===============================
   START SERVER
=============================== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `🚀 Operion Control Center running on port ${PORT}`
  );
});
