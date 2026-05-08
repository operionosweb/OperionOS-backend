import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { generateActions } from "./actionEngine.js";
import { interpretCommand } from "./ai/commandEngine.js";
import { generateDailyOpsReport } from "./ops/autonomousEngine.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

/* ===============================
   SUPABASE CLIENT
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
    message: "Operion Autonomous Ops Backend Running"
  });
});

/* ===============================
   CONTROL CENTER API
=============================== */

app.get("/api/control-center", async (req, res) => {

  try {

    const { data: aircraft } = await supabase
      .from("aircraft")
      .select("*");

    const { data: flights } = await supabase
      .from("flights")
      .select("*");

    const aircraftRankings = aircraft.map((a) => {

      const related = flights.filter(
        (f) => f.aircraft_id === a.id
      );

      const totalHours = related.reduce(
        (sum, f) => sum + Number(f.flight_hours || 0),
        0
      );

      const riskScore =
        totalHours * 0.04 + Math.random() * 10;

      return {
        aircraft: a,
        metrics: {
          totalHours,
          riskScore
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
   ACTION ENGINE API
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

      const related = flights.filter(
        (f) => f.aircraft_id === a.id
      );

      const totalHours = related.reduce(
        (sum, f) => sum + Number(f.flight_hours || 0),
        0
      );

      const failure =
        Math.min(100, totalHours * 0.05 + Math.random() * 20);

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
   AI COMMAND ENDPOINT
=============================== */

app.post("/api/ai/command", async (req, res) => {

  try {

    const { command } = req.body;

    const { data: aircraft } = await supabase
      .from("aircraft")
      .select("*");

    const { data: flights } = await supabase
      .from("flights")
      .select("*");

    const fleet = aircraft.map((a) => {

      const related = flights.filter(
        f => f.aircraft_id === a.id
      );

      const totalHours = related.reduce(
        (sum, f) => sum + Number(f.flight_hours || 0),
        0
      );

      const failure =
        Math.min(100, totalHours * 0.08 + Math.random() * 25);

      return {
        id: a.id,
        tail: a.tail_number,
        model: a.model,
        failure
      };

    });

    const actions = generateActions(fleet);

    const result = interpretCommand(
      command,
      fleet,
      actions
    );

    res.json({
      status: "success",
      command,
      ...result
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
   AUTONOMOUS OPS REPORT (NEW)
=============================== */

app.get("/api/ops/daily-report", async (req, res) => {

  try {

    const { data: aircraft } = await supabase
      .from("aircraft")
      .select("*");

    const { data: flights } = await supabase
      .from("flights")
      .select("*");

    const fleet = aircraft.map((a) => {

      const related = flights.filter(
        f => f.aircraft_id === a.id
      );

      const totalHours = related.reduce(
        (sum, f) => sum + Number(f.flight_hours || 0),
        0
      );

      const failure =
        Math.min(100, totalHours * 0.08 + Math.random() * 25);

      return {
        id: a.id,
        tail: a.tail_number,
        model: a.model,
        failure
      };

    });

    const { generateActions } = await import("./actionEngine.js");

    const actions = generateActions(fleet);

    const report = generateDailyOpsReport(fleet, actions);

    res.json({
      status: "success",
      report
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
  console.log(`Operion Autonomous Ops running on port ${PORT}`);
});
