import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { generateActions } from "./actionEngine.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

/* ===============================
   SUPABASE INIT
=============================== */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ===============================
   HEALTH CHECK
=============================== */

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Operion Backend Running"
  });
});

/* ===============================
   CONTROL CENTER DATA
=============================== */

app.get("/api/control-center", async (req, res) => {

  try {

    const { data: aircraft, error: aircraftError } = await supabase
      .from("aircraft")
      .select("*");

    if (aircraftError) throw aircraftError;

    const { data: flights, error: flightsError } = await supabase
      .from("flights")
      .select("*");

    if (flightsError) throw flightsError;

    const aircraftRankings = aircraft.map((a) => {

      const relatedFlights = flights.filter(
        (f) => f.aircraft_id === a.id
      );

      const totalHours = relatedFlights.reduce(
        (sum, f) => sum + Number(f.flight_hours || 0),
        0
      );

      const riskScore =
        totalHours * 0.04 + Math.random() * 10;

      const projected30DayCost =
        totalHours * 120 + riskScore * 80;

      return {
        aircraft: a,
        metrics: {
          totalHours,
          riskScore,
          projected30DayCost
        }
      };

    });

    res.json({
      status: "success",
      aircraftRankings
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      status: "error",
      message: err.message
    });

  }

});

/* ===============================
   ACTION ENGINE ENDPOINT
=============================== */

app.get("/api/actions", async (req, res) => {

  try {

    const { data: aircraft } = await supabase
      .from("aircraft")
      .select("*");

    const { data: flights } = await supabase
      .from("flights")
      .select("*");

    const enriched = aircraft.map((a) => {

      const relatedFlights = flights.filter(
        (f) => f.aircraft_id === a.id
      );

      const totalHours = relatedFlights.reduce(
        (sum, f) => sum + Number(f.flight_hours || 0),
        0
      );

      const failure =
        totalHours * 0.03 + Math.random() * 10;

      return {
        id: a.id,
        tail: a.tail_number,
        failure
      };

    });

    const actions = generateActions(enriched);

    res.json({
      status: "success",
      totalActions: actions.length,
      actions
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      status: "error",
      message: err.message
    });

  }

});

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Operion backend running on port ${PORT}`);
});
